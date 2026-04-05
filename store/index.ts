import { create } from 'zustand';
import {
  BackendUrlMode,
  Chat,
  ChatMessage,
  ChatMode,
  NicheId,
  Religion,
  Theme,
} from '@/types';
import { getNicheById, NICHES, RELIGIONS } from '@/constants/niches';
import { logError, logWarn } from '@/utils/logger';
import {
  isRecord,
  isValidHttpUrl,
  safeArray,
  safeEnum,
  safeJsonParse,
  safeNumber,
  safeString,
} from '@/utils/safe';
import {
  getStorageItem,
  removeStorageItem,
  setStorageEntries,
  setStorageItem,
} from '@/utils/storage';

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
} as const;

const DEFAULT_NICHE: NicheId = 'raw';
const DEFAULT_RELIGION: Religion = 'islam';
const DEFAULT_THEME: Theme = 'system';
const DEFAULT_CHAT_MODE: ChatMode = 'fast';
const DEFAULT_BACKEND_URL_MODE: BackendUrlMode = 'default';

const VALID_NICHE_IDS = NICHES.map((niche) => niche.id) as NicheId[];
const VALID_RELIGIONS = RELIGIONS.map((religion) => religion.id) as Religion[];
const VALID_THEMES: Theme[] = ['light', 'dark', 'system'];
const VALID_CHAT_MODES: ChatMode[] = ['fast', 'thinking'];
const VALID_BACKEND_URL_MODES: BackendUrlMode[] = ['default', 'custom'];

function sanitizeNicheId(value: unknown): NicheId {
  return safeEnum(value, VALID_NICHE_IDS, DEFAULT_NICHE);
}

function sanitizeReligion(value: unknown): Religion {
  return safeEnum(value, VALID_RELIGIONS, DEFAULT_RELIGION);
}

function sanitizeTheme(value: unknown): Theme {
  return safeEnum(value, VALID_THEMES, DEFAULT_THEME);
}

function sanitizeChatMode(value: unknown): ChatMode {
  return safeEnum(value, VALID_CHAT_MODES, DEFAULT_CHAT_MODE);
}

function sanitizeBackendUrlMode(value: unknown): BackendUrlMode {
  return safeEnum(value, VALID_BACKEND_URL_MODES, DEFAULT_BACKEND_URL_MODE);
}

function sanitizeCustomPrompt(value: unknown): string {
  return safeString(value).trim();
}

function sanitizeStoredBackendUrl(value: unknown): string {
  const normalized = normalizeBackendUrl(safeString(value));
  return isValidHttpUrl(normalized) ? normalized : '';
}

function createFallbackMessageId(index: number): string {
  return `msg_recovered_${Date.now()}_${index}`;
}

function buildChatTitle(
  nicheId: NicheId,
  messages: ChatMessage[],
  fallbackTitle?: string,
): string {
  const trimmedFallback = safeString(fallbackTitle).trim();
  if (trimmedFallback) {
    return trimmedFallback;
  }

  const firstUserMessage = messages.find(
    (message) => message.role === 'user' && message.content.trim().length > 0,
  );

  if (firstUserMessage) {
    const preview = firstUserMessage.content.trim();
    return preview.slice(0, 40) + (preview.length > 40 ? '…' : '');
  }

  return `${getNicheById(nicheId).label} Chat`;
}

function normalizeMessage(value: unknown, index: number): ChatMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const role = value.role === 'assistant' ? 'assistant' : value.role === 'user' ? 'user' : null;
  if (!role) {
    return null;
  }

  const timestamp = safeNumber(value.timestamp, Date.now());
  const id = safeString(value.id).trim() || createFallbackMessageId(index);

  return {
    id,
    role,
    content: safeString(value.content),
    timestamp,
    isWebSearch: Boolean(value.isWebSearch),
    webSearchStatus: safeString(value.webSearchStatus) || undefined,
  };
}

function normalizeChat(value: unknown, index: number): Chat | null {
  if (!isRecord(value)) {
    return null;
  }

  const nicheId = sanitizeNicheId(value.nicheId);
  const messages = safeArray<unknown>(value.messages)
    .map((message, messageIndex) => normalizeMessage(message, messageIndex))
    .filter((message): message is ChatMessage => Boolean(message));
  const createdAt = safeNumber(value.createdAt, Date.now());
  const updatedAt = safeNumber(value.updatedAt, createdAt);
  const religion = nicheId === 'religion' ? sanitizeReligion(value.religion) : undefined;
  const customPrompt =
    nicheId === 'custom' ? sanitizeCustomPrompt(value.customPrompt) || undefined : undefined;
  const id = safeString(value.id).trim() || `chat_recovered_${createdAt}_${index}`;

  return {
    id,
    nicheId,
    religion,
    customPrompt,
    messages,
    createdAt,
    updatedAt,
    title: buildChatTitle(nicheId, messages, safeString(value.title) || undefined),
  };
}

function normalizeChats(value: unknown): Chat[] {
  const seenIds = new Set<string>();

  return safeArray<unknown>(value)
    .map((chat, index) => normalizeChat(chat, index))
    .filter((chat): chat is Chat => Boolean(chat))
    .map((chat, index) => {
      if (!seenIds.has(chat.id)) {
        seenIds.add(chat.id);
        return chat;
      }

      const repairedId = `${chat.id}_${index}`;
      seenIds.add(repairedId);
      return { ...chat, id: repairedId };
    });
}

function sanitizeMessage(message: ChatMessage): ChatMessage {
  return normalizeMessage(message, Date.now()) ?? {
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  };
}

function resolveActiveChatId(chats: Chat[], activeChatId: unknown): string | null {
  const requestedId = safeString(activeChatId).trim();
  if (requestedId && chats.some((chat) => chat.id === requestedId)) {
    return requestedId;
  }

  return chats[0]?.id ?? null;
}

async function persistChatsState(chats: Chat[], activeChatId: string | null): Promise<void> {
  await setStorageItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));

  if (activeChatId) {
    await setStorageItem(STORAGE_KEYS.ACTIVE_CHAT, activeChatId);
    return;
  }

  await removeStorageItem(STORAGE_KEYS.ACTIVE_CHAT);
}

interface AppStore {
  nicheId: NicheId;
  religion: Religion;
  setNiche: (id: NicheId) => void;
  setReligion: (r: Religion) => void;

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

  customPersonaSheetOpen: boolean;
  setCustomPersonaSheetOpen: (v: boolean) => void;

  hydrate: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  nicheId: DEFAULT_NICHE,
  religion: DEFAULT_RELIGION,
  theme: DEFAULT_THEME,
  chatMode: DEFAULT_CHAT_MODE,
  backendUrlMode: DEFAULT_BACKEND_URL_MODE,
  customBackendUrl: '',
  chats: [],
  activeChatId: null,
  sidebarOpen: false,
  nicheBottomSheetOpen: false,
  customPersonaSheetOpen: false,
  customPersonaPrompt: '',

  setNiche: (id) => {
    const nextNicheId = sanitizeNicheId(id);
    set({ nicheId: nextNicheId });
    void setStorageItem(STORAGE_KEYS.NICHE, nextNicheId);
  },

  setReligion: (religion) => {
    const nextReligion = sanitizeReligion(religion);
    set({ religion: nextReligion });
    void setStorageItem(STORAGE_KEYS.RELIGION, nextReligion);
  },

  setCustomPersonaPrompt: (prompt) => {
    const nextPrompt = sanitizeCustomPrompt(prompt);
    set({ customPersonaPrompt: nextPrompt });
    void setStorageItem(STORAGE_KEYS.CUSTOM_PROMPT, nextPrompt || null);
  },

  setTheme: (theme) => {
    const nextTheme = sanitizeTheme(theme);
    set({ theme: nextTheme });
    void setStorageItem(STORAGE_KEYS.THEME, nextTheme);
  },

  setChatMode: (mode) => {
    const nextMode = sanitizeChatMode(mode);
    set({ chatMode: nextMode });
    void setStorageItem(STORAGE_KEYS.CHAT_MODE, nextMode);
  },

  setBackendUrlMode: (mode) => {
    const nextMode = sanitizeBackendUrlMode(mode);
    set({ backendUrlMode: nextMode });
    void setStorageItem(STORAGE_KEYS.BACKEND_URL_MODE, nextMode);
  },

  setCustomBackendUrl: (url) => {
    const normalizedUrl = sanitizeStoredBackendUrl(url);

    if (!normalizedUrl && safeString(url).trim()) {
      logWarn('Rejected invalid backend URL', url);
    }

    set({ customBackendUrl: normalizedUrl });
    void setStorageItem(STORAGE_KEYS.CUSTOM_BACKEND_URL, normalizedUrl || null);
  },

  setSidebarOpen: (value) => set({ sidebarOpen: Boolean(value) }),
  setNicheBottomSheetOpen: (value) => set({ nicheBottomSheetOpen: Boolean(value) }),
  setCustomPersonaSheetOpen: (value) => set({ customPersonaSheetOpen: Boolean(value) }),

  setActiveChat: (id) => {
    const chats = safeArray<Chat>(get().chats);
    const nextActiveChatId = resolveActiveChatId(chats, id);
    set({ activeChatId: nextActiveChatId });
    void persistChatsState(chats, nextActiveChatId);
  },

  createChat: (nicheId, religion, customPrompt) => {
    const nextNicheId = sanitizeNicheId(nicheId);
    const now = Date.now();
    const chat: Chat = {
      id: `chat_${now}`,
      nicheId: nextNicheId,
      religion: nextNicheId === 'religion' ? sanitizeReligion(religion) : undefined,
      customPrompt:
        nextNicheId === 'custom' ? sanitizeCustomPrompt(customPrompt) || undefined : undefined,
      messages: [],
      createdAt: now,
      updatedAt: now,
      title: `${getNicheById(nextNicheId).label} Chat`,
    };

    const existingChats = safeArray<Chat>(get().chats);
    const chats = [chat, ...existingChats];
    set({ chats, activeChatId: chat.id });
    void persistChatsState(chats, chat.id);
    return chat;
  },

  addMessage: (chatId, message) => {
    const normalizedMessage = sanitizeMessage(message);
    const chats = safeArray<Chat>(get().chats).map((chat) => {
      if (chat.id !== chatId) {
        return chat;
      }

      const currentMessages = safeArray<ChatMessage>(chat.messages);
      const messages = [...currentMessages, normalizedMessage];
      return {
        ...chat,
        messages,
        updatedAt: Date.now(),
        title: buildChatTitle(chat.nicheId, messages, chat.title),
      };
    });

    set({ chats });
    void setStorageItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  },

  updateLastMessage: (chatId, content) => {
    const safeContent = safeString(content);
    const chats = safeArray<Chat>(get().chats).map((chat) => {
      if (chat.id !== chatId) {
        return chat;
      }

      const messages = [...safeArray<ChatMessage>(chat.messages)];
      if (messages.length === 0) {
        return chat;
      }

      const lastMessage = messages[messages.length - 1];
      messages[messages.length - 1] = {
        ...lastMessage,
        content: safeContent,
      };

      return {
        ...chat,
        messages,
        updatedAt: Date.now(),
      };
    });

    set({ chats });
  },

  setChatMessages: (chatId, messages) => {
    const normalizedMessages = safeArray<ChatMessage>(messages)
      .map((message, index) => normalizeMessage(message, index))
      .filter((message): message is ChatMessage => Boolean(message));

    const chats = safeArray<Chat>(get().chats).map((chat) => {
      if (chat.id !== chatId) {
        return chat;
      }

      return {
        ...chat,
        messages: normalizedMessages,
        updatedAt: Date.now(),
        title: buildChatTitle(chat.nicheId, normalizedMessages, chat.title),
      };
    });

    set({ chats });
    void setStorageItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
  },

  deleteChat: (chatId) => {
    const chats = safeArray<Chat>(get().chats).filter((chat) => chat.id !== chatId);
    const activeChatId = get().activeChatId === chatId ? chats[0]?.id ?? null : get().activeChatId;
    set({ chats, activeChatId });
    void persistChatsState(chats, activeChatId);
  },

  clearAllChats: () => {
    set({ chats: [], activeChatId: null });
    void removeStorageItem(STORAGE_KEYS.CHATS);
    void removeStorageItem(STORAGE_KEYS.ACTIVE_CHAT);
  },

  hydrate: async () => {
    try {
      const [
        storedNicheId,
        storedReligion,
        storedTheme,
        storedChatMode,
        chatsRaw,
        storedActiveChatId,
        customPrompt,
        storedBackendUrlMode,
        storedCustomBackendUrl,
      ] = await Promise.all([
        getStorageItem(STORAGE_KEYS.NICHE),
        getStorageItem(STORAGE_KEYS.RELIGION),
        getStorageItem(STORAGE_KEYS.THEME),
        getStorageItem(STORAGE_KEYS.CHAT_MODE),
        getStorageItem(STORAGE_KEYS.CHATS),
        getStorageItem(STORAGE_KEYS.ACTIVE_CHAT),
        getStorageItem(STORAGE_KEYS.CUSTOM_PROMPT),
        getStorageItem(STORAGE_KEYS.BACKEND_URL_MODE),
        getStorageItem(STORAGE_KEYS.CUSTOM_BACKEND_URL),
      ]);

      const chats = normalizeChats(safeJsonParse<unknown>(chatsRaw, []));
      const activeChatId = resolveActiveChatId(chats, storedActiveChatId);
      const nicheId = sanitizeNicheId(storedNicheId);
      const religion = sanitizeReligion(storedReligion);
      const theme = sanitizeTheme(storedTheme);
      const chatMode = sanitizeChatMode(storedChatMode);
      const backendUrlMode = sanitizeBackendUrlMode(storedBackendUrlMode);
      const customBackendUrl = sanitizeStoredBackendUrl(storedCustomBackendUrl);
      const customPersonaPrompt = sanitizeCustomPrompt(customPrompt);

      set({
        nicheId,
        religion,
        theme,
        chatMode,
        backendUrlMode,
        customBackendUrl,
        chats,
        activeChatId,
        customPersonaPrompt,
      });

      await setStorageEntries([
        [STORAGE_KEYS.NICHE, nicheId],
        [STORAGE_KEYS.RELIGION, religion],
        [STORAGE_KEYS.THEME, theme],
        [STORAGE_KEYS.CHAT_MODE, chatMode],
        [STORAGE_KEYS.BACKEND_URL_MODE, backendUrlMode],
      ]);
      await setStorageItem(STORAGE_KEYS.CUSTOM_PROMPT, customPersonaPrompt || null);
      await setStorageItem(STORAGE_KEYS.CUSTOM_BACKEND_URL, customBackendUrl || null);
      await persistChatsState(chats, activeChatId);
    } catch (error) {
      logError('Hydration failed, using safe defaults', error);
      set({
        nicheId: DEFAULT_NICHE,
        religion: DEFAULT_RELIGION,
        theme: DEFAULT_THEME,
        chatMode: DEFAULT_CHAT_MODE,
        backendUrlMode: DEFAULT_BACKEND_URL_MODE,
        customBackendUrl: '',
        chats: [],
        activeChatId: null,
        customPersonaPrompt: '',
      });
    }
  },
}));
