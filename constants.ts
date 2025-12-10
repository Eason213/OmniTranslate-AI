import { Language } from './types';

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'zh-TW', name: 'Traditional Chinese (Taiwan)', label: '中文' },
  { code: 'en-US', name: 'English', label: 'English' },
  { code: 'ja-JP', name: 'Japanese', label: '日本語' },
  { code: 'ko-KR', name: 'Korean', label: '한국어' },
  { code: 'de-DE', name: 'German', label: 'Deutsch' },
  { code: 'vi-VN', name: 'Vietnamese', label: 'Tiếng Việt' },
  { code: 'th-TH', name: 'Thai', label: 'ไทย' },
  { code: 'ar-SA', name: 'Arabic', label: 'العربية' },
];

export const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
export const AUDIO_SAMPLE_RATE_INPUT = 16000;
export const AUDIO_SAMPLE_RATE_OUTPUT = 24000;
