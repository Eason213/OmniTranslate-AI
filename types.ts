export interface Language {
  code: string;
  name: string;
  label: string; // Native name or display label
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface TranscriptItem {
  id: string;
  text: string;
  isUser: boolean; // true = user input, false = AI translation
  isFinal: boolean;
  timestamp: number;
}
