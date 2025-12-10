import React from 'react';
import { clsx } from 'clsx';
import { Volume2, VolumeX } from 'lucide-react';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export const Toggle: React.FC<Props> = ({ checked, onChange, label }) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95"
    >
      <div className={clsx(
        "relative w-10 h-6 rounded-full transition-colors duration-300",
        checked ? "bg-green-500/80" : "bg-white/20"
      )}>
        <div className={clsx(
          "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </div>
      
      <div className="flex items-center gap-2">
        {checked ? (
            <Volume2 className="w-4 h-4 text-white/80" />
        ) : (
            <VolumeX className="w-4 h-4 text-white/40" />
        )}
        {label && <span className="text-sm font-medium text-white/80">{label}</span>}
      </div>
    </button>
  );
};
