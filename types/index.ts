export type NicheId =
  | 'religion'
  | 'darkweb'
  | 'career'
  | 'villain'
  | 'founder'
  | 'profiler'
  | 'conspiracy'
  | 'debate'
  | 'raw'
  | 'custom';

export type Religion =
  | 'islam'
  | 'christianity'
  | 'hinduism'
  | 'buddhism'
  | 'judaism'
  | 'atheism';

export interface Niche {
  id: NicheId;
  label: string;
  persona: string;
  icon: string;
  description: string;
  color: string;
  hasSubOptions?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  // Web search metadata (only on assistant messages)
  isWebSearch?: boolean;
  webSearchStatus?: string; // last status seen during pipeline
}

export interface Chat {
  id: string;
  nicheId: NicheId;
  religion?: Religion;
  customPrompt?: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  title: string;
}

export type Theme = 'light' | 'dark' | 'system';
export type ChatMode = 'fast' | 'thinking';

// SSE event types from backend
export type SSEEvent =
  | { type: 'action'; message: string }
  | { type: 'status'; message: string }
  | { type: 'token'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
