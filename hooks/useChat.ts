import { useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { streamChat } from '@/services/ai';
import { ChatMessage } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useChat = (chatId: string) => {
  const { chats, nicheId, religion, customPersonaPrompt, addMessage, updateLastMessage } =
    useAppStore();
  const chat = chats.find((c) => c.id === chatId);
  const messages = chat?.messages ?? [];

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const persistChats = useCallback(() => {
    const currentChats = useAppStore.getState().chats;
    AsyncStorage.setItem('@rawmind/chats', JSON.stringify(currentChats));
  }, []);

  const sendMessage = useCallback(
    async (text: string, targetChatId?: string) => {
      if (!text.trim() || isStreaming) return;
      setError(null);

      const effectiveChatId = targetChatId ?? chatId;
      const currentChat = useAppStore.getState().chats.find((c) => c.id === effectiveChatId);

      // Use the chat's own niche/religion/customPrompt — isolated per chat
      const chatNicheId = currentChat?.nicheId ?? nicheId;
      const chatReligion = currentChat?.religion ?? religion;
      const chatCustomPrompt = currentChat?.customPrompt ?? customPersonaPrompt;

      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };
      addMessage(effectiveChatId, userMsg);

      const aiMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      addMessage(effectiveChatId, aiMsg);

      setIsStreaming(true);

      abortRef.current = new AbortController();
      let accumulated = '';

      // Use messages BEFORE adding user msg (context doesn't include current exchange yet)
      const contextMessages = currentChat?.messages ?? messages;

      await streamChat(
        contextMessages,
        text.trim(),
        chatNicheId,
        chatReligion,
        chatNicheId === 'custom' ? chatCustomPrompt : undefined,
        (chunk) => {
          accumulated += chunk;
          updateLastMessage(effectiveChatId, accumulated);
        },
        (full) => {
          updateLastMessage(effectiveChatId, full);
          setIsStreaming(false);
          persistChats(); // persist after completion
        },
        (err) => {
          setError(err);
          updateLastMessage(effectiveChatId, `⚠️ ${err}`);
          setIsStreaming(false);
          persistChats();
        },
        abortRef.current.signal
      );
    },
    [chatId, chats, messages, isStreaming, nicheId, religion, customPersonaPrompt]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    persistChats();
  }, []);

  return { messages, isStreaming, error, sendMessage, stopStreaming };
};
