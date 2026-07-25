export type TabType = 
  | 'office'
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

export interface OcrItem {
  id: string;
  fileName: string;
  fileSize: number;
  text: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  timestamp: string;
  fileUrl?: string;
  fileType?: string;
  tags?: string[];
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

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  modelUsed?: string;
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  author?: string;
  fontFamily: 'helvetica' | 'times' | 'courier';
  fontSize: number; // 10, 12, 14, 16
  margin: 'narrow' | 'normal' | 'wide'; // 10, 15, 25mm
  themeColor: 'indigo' | 'swiss-red' | 'emerald' | 'slate' | 'navy';
  showPageNumbers: boolean;
  showDate: boolean;
  watermark?: string;
  lineSpacing: number; // 1.2, 1.5, 2.0
}

export interface GoogleUserProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
  accessToken: string;
  expiresAt?: number;
}

export interface MicrosoftUserProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
  accessToken: string;
  accountType: 'office365' | 'personal' | 'school';
  expiresAt?: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink?: string;
  size?: string;
}

export type AppThemeMode = 'auto' | 'light' | 'dark';
export type AppFontFamily = 'sans' | 'serif' | 'mono' | 'dyslexic';
export type AppFontSize = 'compact' | 'normal' | 'large';

export interface HistoryRecord {
  id: string;
  type: 'ocr' | 'word' | 'excel' | 'powerpoint' | 'canva' | 'chat' | 'compare' | 'ai' | 'image' | 'audio';
  title: string;
  summary: string;
  details?: string;
  mediaUrl?: string;
  timestamp: string;
  tags?: string[];
}

export type HistoryItem = HistoryRecord;

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
  fontFamily?: string;
}

