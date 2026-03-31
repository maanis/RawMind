import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NicheId, Religion, Chat, ChatMessage, Theme } from '@/types';
import { NICHES } from '@/constants/niches';

const STORAGE_KEYS = {
  NICHE: '@rawmind/niche',
  RELIGION: '@rawmind/religion',
  THEME: '@rawmind/theme',
  CHATS: '@rawmind/chats',
  ACTIVE_CHAT: '@rawmind/active_chat',
};

interface AppStore {
  // Niche
  nicheId: NicheId;
  religion: Religion;
  setNiche: (id: NicheId) => void;
  setReligion: (r: Religion) => void;

  // Theme
  theme: Theme;
  setTheme: (t: Theme) => void;

  // Chats
  chats: Chat[];
  activeChatId: string | null;
  setActiveChat: (id: string | null) => void;
  createChat: (nicheId: NicheId, religion?: Religion) => Chat;
  addMessage: (chatId: string, message: ChatMessage) => void;
  updateLastMessage: (chatId: string, content: string) => void;
  deleteChat: (chatId: string) => void;
  clearAllChats: () => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  // Hydration
  hydrate: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  nicheId: 'raw',
  religion: 'islam',
  theme: 'system',
  chats: [],
  activeChatId: null,
  sidebarOpen: false,

  setNiche: (id) => {
    set({ nicheId: id });
    AsyncStorage.setItem(STORAGE_KEYS.NICHE, id);
  },

  setReligion: (r) => {
    set({ religion: r });
    AsyncStorage.setItem(STORAGE_KEYS.RELIGION, r);
  },

  setTheme: (t) => {
    set({ theme: t });
    AsyncStorage.setItem(STORAGE_KEYS.THEME, t);
  },

  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  setActiveChat: (id) => {
    set({ activeChatId: id });
    if (id) AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, id);
  },

  createChat: (nicheId, religion) => {
    const niche = NICHES.find((n) => n.id === nicheId)!;
    const chat: Chat = {
      id: `chat_${Date.now()}`,
      nicheId,
      religion,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      title: `${niche.label} Chat`,
    };
    const chats = [chat, ...get().chats];
    set({ chats, activeChatId: chat.id });
    AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, chat.id);
    return chat;
  },

  addMessage: (chatId, message) => {
    const chats = get().chats.map((c) => {
      if (c.id !== chatId) return c;
      const messages = [...c.messages, message];
      // Update title from first user message
      const title =
        c.messages.length === 0 && message.role === 'user'
          ? message.content.slice(0, 40) + (message.content.length > 40 ? '…' : '')
          : c.title;
      return { ...c, messages, updatedAt: Date.now(), title };
    });
    set({ chats });
    AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  },

  updateLastMessage: (chatId, content) => {
    const chats = get().chats.map((c) => {
      if (c.id !== chatId) return c;
      const messages = [...c.messages];
      if (messages.length === 0) return c;
      messages[messages.length - 1] = { ...messages[messages.length - 1], content };
      return { ...c, messages, updatedAt: Date.now() };
    });
    set({ chats });
  },

  deleteChat: (chatId) => {
    const chats = get().chats.filter((c) => c.id !== chatId);
    const activeChatId = get().activeChatId === chatId ? null : get().activeChatId;
    set({ chats, activeChatId });
    AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  },

  clearAllChats: () => {
    set({ chats: [], activeChatId: null });
    AsyncStorage.removeItem(STORAGE_KEYS.CHATS);
    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT);
  },

  hydrate: async () => {
    try {
      const [nicheId, religion, theme, chatsRaw, activeChatId] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.NICHE),
        AsyncStorage.getItem(STORAGE_KEYS.RELIGION),
        AsyncStorage.getItem(STORAGE_KEYS.THEME),
        AsyncStorage.getItem(STORAGE_KEYS.CHATS),
        AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT),
      ]);

      set({
        nicheId: (nicheId as NicheId) ?? 'raw',
        religion: (religion as Religion) ?? 'islam',
        theme: (theme as Theme) ?? 'system',
        chats: chatsRaw ? JSON.parse(chatsRaw) : [],
        activeChatId: activeChatId ?? null,
      });
    } catch (e) {
      console.error('Hydration failed', e);
    }
  },
}));
