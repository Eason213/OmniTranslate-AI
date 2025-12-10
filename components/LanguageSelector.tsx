import React from 'react';
import { Language } from '../types';
import { SUPPORTED_LANGUAGES } from '../constants';
import { ChevronDown, ArrowRightLeft } from 'lucide-react';

interface Props {
  selected: Language;
  onSelect: (lang: Language) => void;
  label: string;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<Props> = ({ selected, onSelect, label, disabled }) => {
  return (
    <div className="flex flex-col gap-1 relative group">
      <span className="text-xs text-white/40 uppercase tracking-widest font-medium ml-2">{label}</span>
      <div className="relative">
        <select
          className="appearance-none w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-10 text-white font-medium focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          value={selected.code}
          onChange={(e) => {
            const lang = SUPPORTED_LANGUAGES.find(l => l.code === e.target.value);
            if (lang) onSelect(lang);
          }}
          disabled={disabled}
        >
          {SUPPORTED_LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code} className="bg-gray-900 text-white">
              {lang.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none group-hover:text-white/70 transition-colors" />
      </div>
    </div>
  );
};
