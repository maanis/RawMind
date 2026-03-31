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
    async (text: string) => {
      if (!text.trim() || isStreaming) return;
      setError(null);

      // Add user message
      const userMsg: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: text.trim(),
        timestamp: Date.now(),
      };
      addMessage(chatId, userMsg);

      // Placeholder AI message
      const aiMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      addMessage(chatId, aiMsg);

      setIsStreaming(true);
      setStreamingText('');

      abortRef.current = new AbortController();
      let accumulated = '';

      await streamChat(
        messages,
        text.trim(),
        chat?.nicheId ?? nicheId,
        chat?.religion ?? religion,
        (chunk) => {
          accumulated += chunk;
          setStreamingText(accumulated);
          updateLastMessage(chatId, accumulated);
        },
        (full) => {
          updateLastMessage(chatId, full);
          setIsStreaming(false);
          setStreamingText('');
        },
        (err) => {
          setError(err);
          updateLastMessage(chatId, `⚠️ ${err}`);
          setIsStreaming(false);
          setStreamingText('');
        },
        abortRef.current.signal
      );
    },
    [chatId, messages, isStreaming, nicheId, religion, chat]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setStreamingText('');
  }, []);

  return { messages, isStreaming, streamingText, error, sendMessage, stopStreaming };
};
