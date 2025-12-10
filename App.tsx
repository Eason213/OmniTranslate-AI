import React, { useState, useEffect, useRef } from 'react';
import { ConnectionState, Language } from './types';
import { SUPPORTED_LANGUAGES } from './constants';
import { useLiveTranslator } from './hooks/useLiveTranslator';
import { LanguageSelector } from './components/LanguageSelector';
import { Visualizer } from './components/Visualizer';
import { Toggle } from './components/Toggle';
import { Mic, Square, ArrowRightLeft, Sparkles, Download, Key, X, ExternalLink, Settings2 } from 'lucide-react';
import { clsx } from 'clsx';

export default function App() {
  const [langA, setLangA] = useState<Language>(SUPPORTED_LANGUAGES[0]); // Traditional Chinese
  const [langB, setLangB] = useState<Language>(SUPPORTED_LANGUAGES[1]); // English
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(true); // Default to true for better experience
  
  // API Key State with Persistence
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('GEMINI_API_KEY') || '';
  });
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  // Use a ref for transcripts container auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);

  const { connectionState, transcripts, error, connect, disconnect } = useLiveTranslator({
    langA,
    langB,
    autoPlay,
    apiKey, // Pass the managed key
    onAudioLevelChange: setAudioLevel
  });

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  // Check if we need to show settings on first load if no key
  useEffect(() => {
    if (!apiKey && !process.env.API_KEY) {
      const timer = setTimeout(() => setShowSettings(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleToggle = () => {
    if (isConnected || isConnecting) {
      disconnect();
    } else {
      if (!apiKey && !process.env.API_KEY) {
        setShowSettings(true);
        return;
      }
      connect();
    }
  };

  const swapLanguages = () => {
    if (isConnected) return; // Disable swap while active
    setLangA(langB);
    setLangB(langA);
  };

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('GEMINI_API_KEY', key);
    setShowSettings(false);
  };

  const handleExport = () => {
    if (transcripts.length === 0) return;

    const textContent = transcripts.map(t => {
      const role = t.isUser ? "Original" : "Translation";
      const time = new Date(t.timestamp).toLocaleTimeString();
      return `[${time}] ${role}: ${t.text}`;
    }).join('\n\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Build Filename
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    link.download = `OmniTranslate_${dateStr}_${timeStr}.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    // Use 100dvh for proper mobile height handling including address bars
    <div className="relative h-[100dvh] w-full flex flex-col items-center bg-black overflow-hidden text-white selection:bg-indigo-500/30 font-sans">
      
      {/* Background Ambience */}
      <div className="fixed top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-black to-black pointer-events-none" />
      <div className="fixed top-10 left-10 w-64 h-64 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-10 right-10 w-80 h-80 bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Status Bar Area - Safe Area Top Padding handled via utility or inline style if needed, usually PT-safe-area */}
      <div className="w-full flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-3 h-3 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white/90">OmniTranslate</span>
        </div>
        
        <div className="flex items-center gap-2">
           <button
              onClick={() => setShowSettings(true)}
              className={clsx(
                "p-2 rounded-full transition-all",
                !apiKey ? "bg-amber-500/20 text-amber-400 animate-pulse" : "text-white/40 hover:bg-white/10 hover:text-white"
              )}
            >
              <Settings2 className="w-4 h-4" />
            </button>
            <div className={clsx(
              "px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border transition-all",
              isConnected ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/5 border-white/10 text-white/30"
            )}>
              {isConnected ? "LIVE" : "READY"}
            </div>
        </div>
      </div>

      {/* Compact Language Bar */}
      <div className="w-full max-w-lg px-4 pb-2 z-20 shrink-0">
         <div className="glass-island rounded-2xl p-2 flex items-center gap-2">
          <div className="flex-1">
            <LanguageSelector 
              selected={langA} 
              onSelect={setLangA} 
              label="Input" 
              disabled={isConnected}
            />
          </div>
          
          <button 
            onClick={swapLanguages}
            disabled={isConnected}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all disabled:opacity-30"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>

          <div className="flex-1">
            <LanguageSelector 
              selected={langB} 
              onSelect={setLangB} 
              label="Target"
              disabled={isConnected}
            />
          </div>
        </div>
      </div>

      {/* Main Transcript Area - Maximized */}
      <div className="flex-1 w-full max-w-xl relative overflow-hidden z-10">
           {/* Top fade */}
           <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-black to-transparent pointer-events-none z-10" />

           <div 
             ref={scrollRef}
             className="absolute inset-0 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth pb-12"
           >
             {transcripts.length === 0 && !isConnected && (
               <div className="h-full flex flex-col items-center justify-center text-white/20 gap-3 pb-20">
                 <Mic className="w-8 h-8 opacity-20" />
                 <p className="text-xs font-medium text-center max-w-[200px]">
                    {apiKey ? "Ready to translate. Tap the mic below." : "Please set your API Key to begin."}
                 </p>
               </div>
             )}

             {transcripts.map((item) => (
               <div key={item.id} className={clsx(
                 "flex flex-col gap-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2",
                 item.isUser ? "items-end" : "items-start"
               )}>
                 <div className={clsx(
                   "max-w-[90%] px-4 py-2.5 rounded-2xl text-[15px] leading-snug backdrop-blur-sm",
                   item.isUser 
                     ? "bg-white/10 text-white rounded-tr-sm border border-white/5" 
                     : "bg-indigo-600/90 text-white rounded-tl-sm shadow-md shadow-indigo-900/10 border border-indigo-400/20"
                 )}>
                   {item.text}
                 </div>
                 {/* Only show label for translation to keep UI clean */}
                 {!item.isUser && (
                   <span className="text-[9px] uppercase tracking-wider text-white/30 px-1">
                     Translation
                   </span>
                 )}
               </div>
             ))}

             <div className="h-4" /> {/* Spacer for bottom scroll */}
           </div>
           
           {/* Bottom fade */}
           <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-10" />
      </div>

      {/* Bottom Control Area - Compact & Safe Area Aware */}
      <div className="w-full shrink-0 z-20 bg-black/40 backdrop-blur-xl border-t border-white/5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 px-6 rounded-t-[2.5rem]">
        <div className="max-w-md mx-auto flex items-center justify-between">
            
            {/* Left Controls */}
            <div className="flex gap-2">
                 <button
                    onClick={handleExport}
                    disabled={transcripts.length === 0}
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all"
                  >
                    <Download className="w-4 h-4" />
                  </button>
            </div>

            {/* Center Mic Button */}
            <div className="relative -mt-8"> {/* Floating effect */}
                <button
                    onClick={handleToggle}
                    className={clsx(
                    "relative group w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl",
                    isConnected 
                        ? "bg-red-500 hover:bg-red-600 shadow-red-500/40" 
                        : "bg-white text-black hover:scale-105 shadow-white/20"
                    )}
                >
                    {isConnected && (
                    <div 
                        className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-30"
                    />
                    )}
                    
                    {isConnected ? (
                        <Square className="w-8 h-8 fill-white text-white" />
                    ) : (
                        <Mic className="w-8 h-8" />
                    )}
                </button>
                {/* Visualizer integrated below button */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-20 flex justify-center h-4">
                     <Visualizer level={audioLevel} active={isConnected} />
                </div>
            </div>

             {/* Right Controls */}
             <div className="flex gap-2">
                <button
                    onClick={() => setAutoPlay(!autoPlay)}
                    className={clsx(
                        "w-10 h-10 rounded-full border flex items-center justify-center transition-all",
                        autoPlay 
                        ? "bg-white/10 border-white/20 text-white" 
                        : "bg-white/5 border-white/5 text-white/30"
                    )}
                >
                    <ToggleIcon enabled={autoPlay} />
                </button>
            </div>
        </div>
      </div>

      {/* Settings Modal (API Key) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pb-20">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setShowSettings(false)}
          />
          <div className="relative w-full max-w-sm bg-[#161616] border border-white/10 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Setup</h3>
                  <p className="text-xs text-white/40">Enter Gemini API key</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <input
                  type="password"
                  placeholder="AIza..."
                  className="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all"
                  defaultValue={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                
                <button
                  onClick={() => saveApiKey(apiKey)}
                  className="w-full bg-white text-black font-semibold py-3 rounded-2xl hover:bg-gray-200 transition-colors active:scale-[0.98]"
                >
                  Save Key
                </button>

                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 py-2"
                >
                  <span>Get Free Key</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple icon component for the toggle button
const ToggleIcon = ({ enabled }: { enabled: boolean }) => (
    enabled 
    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
);
