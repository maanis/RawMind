import { useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { streamChat, StreamCallbacks } from '@/services/ai';
import { ChatMessage } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MIN_STATUS_VISIBLE_MS = 700;

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

  const chat = chats.find((currentChat) => currentChat.id === chatId);
  const messages = chat?.messages ?? [];

  const [isStreaming, setIsStreaming] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const statusQueueRef = useRef<string[]>([]);
  const statusDrainPromiseRef = useRef<Promise<void> | null>(null);
  const statusSequenceRef = useRef(0);

  const persistChats = useCallback(() => {
    const currentChats = useAppStore.getState().chats;
    AsyncStorage.setItem('@rawmind/chats', JSON.stringify(currentChats));
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
    statusQueueRef.current.push(message);

    if (statusDrainPromiseRef.current) {
      return;
    }

    const sequence = statusSequenceRef.current;
    statusDrainPromiseRef.current = (async () => {
      while (
        statusQueueRef.current.length > 0 &&
        sequence === statusSequenceRef.current
      ) {
        const nextStatus = statusQueueRef.current.shift() ?? null;
        if (!nextStatus) continue;

        setStatusMessage(nextStatus);
        await new Promise((resolve) => setTimeout(resolve, MIN_STATUS_VISIBLE_MS));
      }
    })().finally(() => {
      statusDrainPromiseRef.current = null;
    });
  }, []);

  const getChatConfig = useCallback((effectiveChatId: string) => {
    const currentChat = useAppStore.getState().chats.find((entry) => entry.id === effectiveChatId);

    return {
      currentChat,
      chatNicheId: currentChat?.nicheId ?? nicheId,
      chatReligion: currentChat?.religion ?? religion,
      chatCustomPrompt: currentChat?.customPrompt ?? customPersonaPrompt,
    };
  }, [customPersonaPrompt, nicheId, religion]);

  const startStreaming = useCallback(async ({
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
    chatNicheId: string;
    chatReligion: any;
    chatCustomPrompt: string | undefined;
  }) => {
    setIsStreaming(true);
    abortRef.current = new AbortController();

    let accumulated = '';

    const callbacks: StreamCallbacks = {
      onAction: (message) => {
        setActionMessage(message);
      },

      onStatus: (message) => {
        enqueueStatus(message);
      },

      onChunk: (chunk) => {
        accumulated += chunk;
        updateLastMessage(effectiveChatId, accumulated);
      },

      onDone: (fullText) => {
        updateLastMessage(effectiveChatId, fullText);
        setIsStreaming(false);
        clearWebSearchState();
        persistChats();
      },

      onError: (streamError) => {
        setError(streamError);
        updateLastMessage(effectiveChatId, `⚠️ ${streamError}`);
        setIsStreaming(false);
        clearWebSearchState();
        persistChats();
      },
    };

    await streamChat(
      contextMessages,
      promptText,
      chatNicheId as any,
      chatReligion,
      chatNicheId === 'custom' ? chatCustomPrompt : undefined,
      chatMode,
      callbacks,
      abortRef.current.signal
    );
  }, [chatMode, clearWebSearchState, enqueueStatus, persistChats, updateLastMessage]);

  const sendMessage = useCallback(
    async (text: string, targetChatId?: string) => {
      if (!text.trim() || isStreaming) return;

      setError(null);
      clearWebSearchState();

      const effectiveChatId = targetChatId ?? chatId;
      const { currentChat, chatNicheId, chatReligion, chatCustomPrompt } = getChatConfig(effectiveChatId);
      const contextMessages = currentChat?.messages ?? messages;

      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

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
    },
    [
      addMessage,
      chatId,
      clearWebSearchState,
      getChatConfig,
      isStreaming,
      messages,
      startStreaming,
    ]
  );

  const replaceUserMessage = useCallback(async (messageId: string, updatedText: string) => {
    if (!updatedText.trim() || isStreaming || !chatId) return;

    setError(null);
    clearWebSearchState();

    const { currentChat, chatNicheId, chatReligion, chatCustomPrompt } = getChatConfig(chatId);
    const currentMessages = currentChat?.messages ?? messages;
    const userIndex = currentMessages.findIndex(
      (message) => message.id === messageId && message.role === 'user'
    );

    if (userIndex === -1) return;

    const historyBeforeUser = currentMessages.slice(0, userIndex);
    const existingUserMessage = currentMessages[userIndex];
    const existingAssistantMessage = currentMessages
      .slice(userIndex + 1)
      .find((message) => message.role === 'assistant');

    const replacementUserMessage: ChatMessage = {
      ...existingUserMessage,
      content: updatedText.trim(),
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
  }, [chatId, clearWebSearchState, getChatConfig, isStreaming, messages, setChatMessages, startStreaming]);

  const regenerateAtMessage = useCallback(async (messageId: string) => {
    if (isStreaming || !chatId) return;

    setError(null);
    clearWebSearchState();

    const { currentChat, chatNicheId, chatReligion, chatCustomPrompt } = getChatConfig(chatId);
    const currentMessages = currentChat?.messages ?? messages;
    const targetIndex = currentMessages.findIndex((message) => message.id === messageId);

    if (targetIndex === -1) return;

    const targetMessage = currentMessages[targetIndex];
    const userIndex =
      targetMessage.role === 'user'
        ? targetIndex
        : (() => {
            for (let index = targetIndex - 1; index >= 0; index -= 1) {
              if (currentMessages[index].role === 'user') {
                return index;
              }
            }
            return -1;
          })();

    if (userIndex === -1) return;

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
  }, [chatId, clearWebSearchState, getChatConfig, isStreaming, messages, setChatMessages, startStreaming]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    clearWebSearchState();
    persistChats();
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
