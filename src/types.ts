export type TabType = 
  | 'extract' 
  | 'word' 
  | 'excel' 
  | 'powerpoint' 
  | 'canva' 
  | 'image' 
  | 'chat' 
  | 'compare' 
  | 'ai' 
  | 'audio' 
  | 'history';

export type AiActionType = 'translate' | 'summarize' | 'grammar' | 'improve' | 'expand' | 'rewrite';
export type AudioSubTabType = 'tts' | 'stt';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatFile {
  name: string;
  type: string;
  content: string;
  preview?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  files?: ChatFile[];
  timestamp: Date;
}

export interface HistoryItem {
  id: string;
  type: 'ocr' | 'word' | 'excel' | 'powerpoint' | 'canva' | 'chat' | 'compare' | 'ai' | 'image' | 'audio';
  title: string;
  summary: string;
  details?: string;
  mediaUrl?: string;
  timestamp: string;
}

export interface EngineOption {
  id: string;
  provider: string;
  model: string;
  label: string;
  emoji: string;
  description: string;
}

export interface SlideData {
  id: string;
  title: string;
  subtitle?: string;
  bullets: string[];
  image?: string;
  bgGradient: string;
  layout: 'title' | 'content' | 'two-column' | 'image' | 'quote';
  notes?: string;
}

export interface PresentationDeck {
  id: string;
  title: string;
  slides: SlideData[];
}

export interface ExcelCell {
  value: string;
  formula?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  bgColor?: string;
  textColor?: string;
}

