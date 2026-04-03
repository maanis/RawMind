import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NicheId, Religion, Chat, ChatMessage, Theme, ChatMode, BackendUrlMode } from '@/types';
import { NICHES } from '@/constants/niches';

function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

const STORAGE_KEYS = {
  NICHE: '@rawmind/niche',
  RELIGION: '@rawmind/religion',
  THEME: '@rawmind/theme',
  CHAT_MODE: '@rawmind/chat_mode',
  CHATS: '@rawmind/chats',
  ACTIVE_CHAT: '@rawmind/active_chat',
  CUSTOM_PROMPT: '@rawmind/custom_prompt',
  BACKEND_URL_MODE: '@rawmind/backend_url_mode',
  CUSTOM_BACKEND_URL: '@rawmind/custom_backend_url',
};

interface AppStore {
  nicheId: NicheId;
  religion: Religion;
  setNiche: (id: NicheId) => void;
  setReligion: (r: Religion) => void;

  // Custom persona
  customPersonaPrompt: string;
  setCustomPersonaPrompt: (p: string) => void;

  theme: Theme;
  setTheme: (t: Theme) => void;

  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;

  backendUrlMode: BackendUrlMode;
  customBackendUrl: string;
  setBackendUrlMode: (mode: BackendUrlMode) => void;
  setCustomBackendUrl: (url: string) => void;

  chats: Chat[];
  activeChatId: string | null;
  setActiveChat: (id: string | null) => void;
  createChat: (nicheId: NicheId, religion?: Religion, customPrompt?: string) => Chat;
  addMessage: (chatId: string, message: ChatMessage) => void;
  updateLastMessage: (chatId: string, content: string) => void;
  setChatMessages: (chatId: string, messages: ChatMessage[]) => void;
  deleteChat: (chatId: string) => void;
  clearAllChats: () => void;

  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;

  nicheBottomSheetOpen: boolean;
  setNicheBottomSheetOpen: (v: boolean) => void;

  // Custom persona builder sheet
  customPersonaSheetOpen: boolean;
  setCustomPersonaSheetOpen: (v: boolean) => void;

  hydrate: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  nicheId: 'raw',
  religion: 'islam',
  theme: 'system',
  chatMode: 'fast',
  backendUrlMode: 'default',
  customBackendUrl: '',
  chats: [],
  activeChatId: null,
  sidebarOpen: false,
  nicheBottomSheetOpen: false,
  customPersonaSheetOpen: false,
  customPersonaPrompt: '',

  setNiche: (id) => {
    set({ nicheId: id });
    AsyncStorage.setItem(STORAGE_KEYS.NICHE, id);
  },

  setReligion: (r) => {
    set({ religion: r });
    AsyncStorage.setItem(STORAGE_KEYS.RELIGION, r);
  },

  setCustomPersonaPrompt: (p) => {
    set({ customPersonaPrompt: p });
    AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_PROMPT, p);
  },

  setTheme: (t) => {
    set({ theme: t });
    AsyncStorage.setItem(STORAGE_KEYS.THEME, t);
  },

  setChatMode: (mode) => {
    set({ chatMode: mode });
    AsyncStorage.setItem(STORAGE_KEYS.CHAT_MODE, mode);
  },

  setBackendUrlMode: (mode) => {
    set({ backendUrlMode: mode });
    AsyncStorage.setItem(STORAGE_KEYS.BACKEND_URL_MODE, mode);
  },

  setCustomBackendUrl: (url) => {
    const normalizedUrl = normalizeBackendUrl(url);
    set({ customBackendUrl: normalizedUrl });
    AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_BACKEND_URL, normalizedUrl);
  },

  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setNicheBottomSheetOpen: (v) => set({ nicheBottomSheetOpen: v }),
  setCustomPersonaSheetOpen: (v) => set({ customPersonaSheetOpen: v }),

  setActiveChat: (id) => {
    set({ activeChatId: id });
    if (id) AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, id);
  },

  createChat: (nicheId, religion, customPrompt) => {
    const niche = NICHES.find((n) => n.id === nicheId)!;
    const chat: Chat = {
      id: `chat_${Date.now()}`,
      nicheId,
      religion,
      customPrompt,
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
    // Debounced persist — don't hammer AsyncStorage on every token
    // Persist happens on done/error in useChat
  },

  setChatMessages: (chatId, messages) => {
    const chats = get().chats.map((chat) => {
      if (chat.id !== chatId) return chat;

      const firstUserMessage = messages.find((message) => message.role === 'user');
      const title =
        firstUserMessage
          ? firstUserMessage.content.slice(0, 40) + (firstUserMessage.content.length > 40 ? '…' : '')
          : chat.title;

      return {
        ...chat,
        messages,
        updatedAt: Date.now(),
        title,
      };
    });

    set({ chats });
    AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  },

  deleteChat: (chatId) => {
    const chats = get().chats.filter((c) => c.id !== chatId);
    const activeChatId = get().activeChatId === chatId ? (chats[0]?.id ?? null) : get().activeChatId;
    set({ chats, activeChatId });
    AsyncStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
    if (activeChatId) AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT, activeChatId ?? '');
  },

  clearAllChats: () => {
    set({ chats: [], activeChatId: null });
    AsyncStorage.removeItem(STORAGE_KEYS.CHATS);
    AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT);
  },

  hydrate: async () => {
    try {
      const [
        nicheId,
        religion,
        theme,
        chatMode,
        chatsRaw,
        activeChatId,
        customPrompt,
        backendUrlMode,
        customBackendUrl,
      ] =
        await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.NICHE),
          AsyncStorage.getItem(STORAGE_KEYS.RELIGION),
          AsyncStorage.getItem(STORAGE_KEYS.THEME),
          AsyncStorage.getItem(STORAGE_KEYS.CHAT_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.CHATS),
          AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT),
          AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_PROMPT),
          AsyncStorage.getItem(STORAGE_KEYS.BACKEND_URL_MODE),
          AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_BACKEND_URL),
        ]);

      set({
        nicheId: (nicheId as NicheId) ?? 'raw',
        religion: (religion as Religion) ?? 'islam',
        theme: (theme as Theme) ?? 'system',
        chatMode: (chatMode as ChatMode) ?? 'fast',
        backendUrlMode: (backendUrlMode as BackendUrlMode) ?? 'default',
        customBackendUrl: normalizeBackendUrl(customBackendUrl ?? ''),
        chats: chatsRaw ? JSON.parse(chatsRaw) : [],
        activeChatId: activeChatId ?? null,
        customPersonaPrompt: customPrompt ?? '',
      });
    } catch (e) {
      console.error('Hydration failed', e);
    }
  },
}));
