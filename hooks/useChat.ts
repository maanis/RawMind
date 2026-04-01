import { useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { streamChat } from '@/services/ai';
import { ChatMessage } from '@/types';

export const useChat = (chatId: string) => {
  const { chats, nicheId, religion, addMessage, updateLastMessage } = useAppStore();
  const chat = chats.find((c) => c.id === chatId);
  const messages = chat?.messages ?? [];

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string, targetChatId?: string) => {
      if (!text.trim() || isStreaming) return;
      setError(null);
      const effectiveChatId = targetChatId ?? chatId;
      const currentChat = chats.find((c) => c.id === effectiveChatId);

      // Add user message
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };
      addMessage(effectiveChatId, userMsg);

      // Placeholder AI message
      const aiMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      addMessage(effectiveChatId, aiMsg);

      setIsStreaming(true);
      setStreamingText('');

      abortRef.current = new AbortController();
      let accumulated = '';

      await streamChat(
        currentChat?.messages ?? messages,
        text.trim(),
        currentChat?.nicheId ?? nicheId,
        currentChat?.religion ?? religion,
        (chunk) => {
          accumulated += chunk;
          setStreamingText(accumulated);
          updateLastMessage(effectiveChatId, accumulated);
        },
        (full) => {
          updateLastMessage(effectiveChatId, full);
          setIsStreaming(false);
          setStreamingText('');
        },
        (err) => {
          setError(err);
          updateLastMessage(effectiveChatId, `⚠️ ${err}`);
          setIsStreaming(false);
          setStreamingText('');
        },
        abortRef.current.signal
      );
    },
    [chatId, chats, messages, isStreaming, nicheId, religion, addMessage, updateLastMessage]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingText('');
  }, []);

  return { messages, isStreaming, streamingText, error, sendMessage, stopStreaming };
};
