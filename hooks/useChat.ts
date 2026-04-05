import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import { streamChat, StreamCallbacks } from '@/services/ai';
import { ChatMessage, NicheId, Religion } from '@/types';
import { logError } from '@/utils/logger';
import { safeArray, safeString, toErrorMessage } from '@/utils/safe';
import { setStorageItem } from '@/utils/storage';

const MIN_STATUS_VISIBLE_MS = 700;
const CHATS_STORAGE_KEY = '@rawmind/chats';
type StoreChat = ReturnType<typeof useAppStore.getState>['chats'][number];

type ChatConfig = {
  currentChat: StoreChat | undefined;
  chatNicheId: NicheId;
  chatReligion: Religion;
  chatCustomPrompt: string | undefined;
};

export const useChat = (chatId: string) => {
  const {
    chats,
    nicheId,
    religion,
    customPersonaPrompt,
    chatMode,
    addMessage,
    updateLastMessage,
    setChatMessages,
  } = useAppStore();

  const chat = safeArray<StoreChat>(chats).find((currentChat) => currentChat.id === chatId);
  const messages = safeArray<ChatMessage>(chat?.messages ?? []);

  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const statusQueueRef = useRef<string[]>([]);
  const statusDrainPromiseRef = useRef<Promise<void> | null>(null);
  const statusSequenceRef = useRef(0);

  const persistChats = useCallback(async () => {
    const currentChats = useAppStore.getState().chats;
    await setStorageItem(CHATS_STORAGE_KEY, JSON.stringify(safeArray<StoreChat>(currentChats)));
  }, []);

  const resetStatusQueue = useCallback(() => {
    statusQueueRef.current = [];
    statusSequenceRef.current += 1;
    setStatusMessage(null);
  }, []);

  const clearWebSearchState = useCallback(() => {
    resetStatusQueue();
    setActionMessage(null);
  }, [resetStatusQueue]);

  const enqueueStatus = useCallback((message: string) => {
    if (!message.trim()) {
      return;
    }

    statusQueueRef.current.push(message);

    if (statusDrainPromiseRef.current) {
      return;
    }

    const sequence = statusSequenceRef.current;
    statusDrainPromiseRef.current = (async () => {
      try {
        while (
          statusQueueRef.current.length > 0 &&
          sequence === statusSequenceRef.current
        ) {
          const nextStatus = statusQueueRef.current.shift() ?? null;
          if (!nextStatus) {
            continue;
          }

          setStatusMessage(nextStatus);
          await new Promise((resolve) => setTimeout(resolve, MIN_STATUS_VISIBLE_MS));
        }
      } catch (statusError) {
        logError('Status queue failed', statusError);
      }
    })().finally(() => {
      statusDrainPromiseRef.current = null;
    });
  }, []);

  const getChatConfig = useCallback(
    (effectiveChatId: string): ChatConfig => {
      const currentChat = safeArray<StoreChat>(
        useAppStore
          .getState()
          .chats,
      ).find((entry) => entry.id === effectiveChatId);

      return {
        currentChat,
        chatNicheId: (currentChat?.nicheId ?? nicheId) as NicheId,
        chatReligion: (currentChat?.religion ?? religion) as Religion,
        chatCustomPrompt: (currentChat?.customPrompt ?? customPersonaPrompt) || undefined,
      };
    },
    [customPersonaPrompt, nicheId, religion],
  );

  const startStreaming = useCallback(
    async ({
      effectiveChatId,
      contextMessages,
      promptText,
      chatNicheId,
      chatReligion,
      chatCustomPrompt,
    }: {
      effectiveChatId: string;
      contextMessages: ChatMessage[];
      promptText: string;
      chatNicheId: NicheId;
      chatReligion: Religion;
      chatCustomPrompt: string | undefined;
    }) => {
      setIsStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      let accumulated = '';

      const finishStreaming = async () => {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }

        setIsStreaming(false);
        await persistChats();
      };

      const callbacks: StreamCallbacks = {
        onAction: (message) => {
          setActionMessage(message);
        },

        onStatus: (message) => {
          enqueueStatus(message);
        },

        onChunk: (chunk) => {
          accumulated += safeString(chunk);
          updateLastMessage(effectiveChatId, accumulated);
        },

        onDone: (fullText) => {
          updateLastMessage(effectiveChatId, safeString(fullText));
          clearWebSearchState();
          void finishStreaming();
        },

        onError: (streamError) => {
          const safeError = safeString(streamError) || 'Something went wrong while streaming.';
          setError(safeError);
          updateLastMessage(effectiveChatId, `⚠️ ${safeError}`);
          clearWebSearchState();
          void finishStreaming();
        },
      };

      try {
        await streamChat(
          contextMessages,
          promptText,
          chatNicheId,
          chatReligion,
          chatNicheId === 'custom' ? chatCustomPrompt : undefined,
          chatMode,
          callbacks,
          controller.signal,
        );
      } catch (streamError) {
        logError('Streaming request crashed unexpectedly', streamError);
        callbacks.onError(toErrorMessage(streamError, 'Unexpected streaming failure.'));
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [chatMode, clearWebSearchState, enqueueStatus, persistChats, updateLastMessage],
  );

  const sendMessage = useCallback(
    async (text: string, targetChatId?: string) => {
      const trimmedText = text.trim();
      if (!trimmedText || isStreaming) {
        return;
      }

      setError(null);
      clearWebSearchState();

      const effectiveChatId = targetChatId ?? chatId;
      const { currentChat, chatNicheId, chatReligion, chatCustomPrompt } = getChatConfig(effectiveChatId);
      const contextMessages = safeArray<ChatMessage>(currentChat?.messages ?? messages);

      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: trimmedText,
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      try {
        addMessage(effectiveChatId, userMessage);
        addMessage(effectiveChatId, assistantMessage);

        await startStreaming({
          effectiveChatId,
          contextMessages,
          promptText: userMessage.content,
          chatNicheId,
          chatReligion,
          chatCustomPrompt,
        });
      } catch (sendError) {
        logError('Failed to send chat message', sendError);
        setError(toErrorMessage(sendError, 'Failed to send message.'));
        updateLastMessage(effectiveChatId, `⚠️ ${toErrorMessage(sendError, 'Failed to send message.')}`);
        setIsStreaming(false);
      }
    },
    [
      addMessage,
      chatId,
      clearWebSearchState,
      getChatConfig,
      isStreaming,
      messages,
      startStreaming,
      updateLastMessage,
    ],
  );

  const replaceUserMessage = useCallback(
    async (messageId: string, updatedText: string) => {
      const trimmedText = updatedText.trim();
      if (!trimmedText || isStreaming || !chatId) {
        return;
      }

      setError(null);
      clearWebSearchState();

      const { currentChat, chatNicheId, chatReligion, chatCustomPrompt } = getChatConfig(chatId);
      const currentMessages = safeArray<ChatMessage>(currentChat?.messages ?? messages);
      const userIndex = currentMessages.findIndex(
        (message) => message.id === messageId && message.role === 'user',
      );

      if (userIndex === -1) {
        return;
      }

      const historyBeforeUser = currentMessages.slice(0, userIndex);
      const existingUserMessage = currentMessages[userIndex];
      const existingAssistantMessage = currentMessages
        .slice(userIndex + 1)
        .find((message) => message.role === 'assistant');

      const replacementUserMessage: ChatMessage = {
        ...existingUserMessage,
        content: trimmedText,
        timestamp: Date.now(),
      };

      const replacementAssistantMessage: ChatMessage = existingAssistantMessage
        ? { ...existingAssistantMessage, content: '', timestamp: Date.now() }
        : {
            id: `msg_${Date.now() + 1}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          };

      try {
        setChatMessages(chatId, [
          ...historyBeforeUser,
          replacementUserMessage,
          replacementAssistantMessage,
        ]);

        await startStreaming({
          effectiveChatId: chatId,
          contextMessages: historyBeforeUser,
          promptText: replacementUserMessage.content,
          chatNicheId,
          chatReligion,
          chatCustomPrompt,
        });
      } catch (replaceError) {
        logError('Failed to replace user message', replaceError);
        setError(toErrorMessage(replaceError, 'Failed to update the message.'));
        setIsStreaming(false);
      }
    },
    [chatId, clearWebSearchState, getChatConfig, isStreaming, messages, setChatMessages, startStreaming],
  );

  const regenerateAtMessage = useCallback(
    async (messageId: string) => {
      if (isStreaming || !chatId) {
        return;
      }

      setError(null);
      clearWebSearchState();

      const { currentChat, chatNicheId, chatReligion, chatCustomPrompt } = getChatConfig(chatId);
      const currentMessages = safeArray<ChatMessage>(currentChat?.messages ?? messages);
      const targetIndex = currentMessages.findIndex((message) => message.id === messageId);

      if (targetIndex === -1) {
        return;
      }

      const targetMessage = currentMessages[targetIndex];
      const userIndex =
        targetMessage.role === 'user'
          ? targetIndex
          : (() => {
              for (let index = targetIndex - 1; index >= 0; index -= 1) {
                if (currentMessages[index]?.role === 'user') {
                  return index;
                }
              }

              return -1;
            })();

      if (userIndex === -1) {
        return;
      }

      const sourceUserMessage = currentMessages[userIndex];
      const historyBeforeUser = currentMessages.slice(0, userIndex);
      const assistantCandidate =
        targetMessage.role === 'assistant'
          ? targetMessage
          : currentMessages
              .slice(userIndex + 1)
              .find((message) => message.role === 'assistant');

      const replacementAssistantMessage: ChatMessage = assistantCandidate
        ? { ...assistantCandidate, content: '', timestamp: Date.now() }
        : {
            id: `msg_${Date.now() + 1}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
          };

      try {
        setChatMessages(chatId, [
          ...historyBeforeUser,
          sourceUserMessage,
          replacementAssistantMessage,
        ]);

        await startStreaming({
          effectiveChatId: chatId,
          contextMessages: historyBeforeUser,
          promptText: sourceUserMessage.content,
          chatNicheId,
          chatReligion,
          chatCustomPrompt,
        });
      } catch (regenerateError) {
        logError('Failed to regenerate message', regenerateError);
        setError(toErrorMessage(regenerateError, 'Failed to regenerate response.'));
        setIsStreaming(false);
      }
    },
    [chatId, clearWebSearchState, getChatConfig, isStreaming, messages, setChatMessages, startStreaming],
  );

  const stopStreaming = useCallback(() => {
    try {
      abortRef.current?.abort();
    } catch (stopError) {
      logError('Failed to abort streaming request', stopError);
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      clearWebSearchState();
      void persistChats();
    }
  }, [clearWebSearchState, persistChats]);

  return {
    messages,
    isStreaming,
    statusMessage,
    actionMessage,
    error,
    sendMessage,
    replaceUserMessage,
    regenerateAtMessage,
    stopStreaming,
  };
};
