import React, { useState, useEffect, useRef } from 'react';
import { ConnectionState, Language } from './types';
import { SUPPORTED_LANGUAGES } from './constants';
import { useLiveTranslator } from './hooks/useLiveTranslator';
import { LanguageSelector } from './components/LanguageSelector';
import { Visualizer } from './components/Visualizer';
import { Mic, Square, ArrowRightLeft, Sparkles, Download, Key, X, ExternalLink, Settings2, Volume2, VolumeX } from 'lucide-react';
import { clsx } from 'clsx';

export default function App() {
  const [langA, setLangA] = useState<Language>(SUPPORTED_LANGUAGES[0]); // Traditional Chinese
  const [langB, setLangB] = useState<Language>(SUPPORTED_LANGUAGES[1]); // English
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('GEMINI_API_KEY') || '';
  });
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const { connectionState, transcripts, error, connect, disconnect } = useLiveTranslator({
    langA,
    langB,
    autoPlay,
    apiKey,
    onAudioLevelChange: setAudioLevel
  });

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  // Auto-scroll to bottom on new transcripts
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

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
    if (isConnected) return;
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
    const textContent = transcripts.map(t => `[${t.isUser ? 'Original' : 'Translated'}] ${t.text}`).join('\n\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `translation_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative h-[100dvh] w-full flex flex-col bg-black overflow-hidden text-white font-sans selection:bg-indigo-500/30">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,_#1a1a2e_0%,_#000000_100%)] z-0" />
      <div className="fixed top-1/4 -left-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 -right-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header - Compact */}
      <header className="relative z-20 w-full px-5 pt-[env(safe-area-inset-top)] pb-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-base tracking-tight text-white/90">OmniLive</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className={clsx(
              "p-2 rounded-full transition-all",
              !apiKey ? "bg-amber-500/20 text-amber-400 animate-pulse" : "text-white/40 hover:bg-white/10"
            )}
          >
            <Settings2 className="w-5 h-5" />
          </button>
          <div className={clsx(
            "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest border transition-all",
            isConnected ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-white/5 border-white/10 text-white/30"
          )}>
            {isConnected ? "LIVE" : "READY"}
          </div>
        </div>
      </header>

      {/* Language Bar - Optimized for one-hand operation */}
      <div className="relative z-20 w-full px-5 py-2 shrink-0">
         <div className="glass-island rounded-3xl p-2 flex items-center gap-2">
          <div className="flex-1">
            <LanguageSelector selected={langA} onSelect={setLangA} label="From" disabled={isConnected} />
          </div>
          <button 
            onClick={swapLanguages}
            disabled={isConnected}
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-20"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <LanguageSelector selected={langB} onSelect={setLangB} label="To" disabled={isConnected} />
          </div>
        </div>
      </div>

      {/* Main Translation Display Area - Maximized for iPhone */}
      <main className="relative flex-1 w-full overflow-hidden z-10">
        <div 
          ref={scrollRef}
          className="absolute inset-0 overflow-y-auto px-5 py-6 space-y-6 scroll-smooth"
        >
          {transcripts.length === 0 && !isConnected && (
            <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4 opacity-50">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                <Mic className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-center max-w-[240px] leading-relaxed">
                {apiKey ? "Tap the microphone to start real-time simultaneous translation." : "Set your Gemini API key in settings to begin."}
              </p>
            </div>
          )}

          {transcripts.map((item) => (
            <div key={item.id} className={clsx(
              "flex flex-col gap-1.5 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4",
              item.isUser ? "items-end" : "items-start"
            )}>
              <div className={clsx(
                "max-w-[85%] px-5 py-3.5 rounded-2xl text-[16px] md:text-lg leading-snug shadow-sm",
                item.isUser 
                  ? "bg-white/10 text-white/90 rounded-tr-none border border-white/5" 
                  : "bg-indigo-600/90 text-white rounded-tl-none border border-indigo-400/20"
              )}>
                {item.text}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 px-1">
                {item.isUser ? langA.label : langB.label}
              </span>
            </div>
          ))}
          <div className="h-20" /> {/* Safe padding at bottom of list */}
        </div>
        
        {/* Gradients to fade out content top/bottom */}
        <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-black to-transparent pointer-events-none z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none z-10" />
      </main>

      {/* Bottom Interface - Safe Area Handling */}
      <footer className="relative z-20 w-full shrink-0 px-6 pb-[env(safe-area-inset-bottom)] pt-4 bg-black/80 backdrop-blur-3xl border-t border-white/5">
        <div className="max-w-md mx-auto flex items-center justify-between pb-4">
            
            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={transcripts.length === 0}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-10 transition-all"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* Main Action Button */}
            <div className="relative -mt-10">
                <button
                    onClick={handleToggle}
                    className={clsx(
                      "relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
                      isConnected 
                          ? "bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]" 
                          : "bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95"
                    )}
                >
                    {isConnected && (
                      <div className="absolute inset-0 rounded-full border-4 border-red-400/50 animate-ping" />
                    )}
                    
                    {isConnected ? (
                        <Square className="w-8 h-8 fill-white text-white" />
                    ) : (
                        <Mic className="w-8 h-8" />
                    )}
                </button>
                {/* Visualizer centered below button */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-24 flex justify-center h-4">
                     <Visualizer level={audioLevel} active={isConnected} />
                </div>
            </div>

             {/* AutoPlay Toggle */}
             <button
                onClick={() => setAutoPlay(!autoPlay)}
                className={clsx(
                    "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all",
                    autoPlay 
                    ? "bg-white/10 border-indigo-500/30 text-indigo-400" 
                    : "bg-white/5 border-white/10 text-white/20"
                )}
            >
                {autoPlay ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
        </div>
      </footer>

      {/* Setting Modal - iPhone Optimized */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative w-full max-w-lg bg-[#121212] border-t border-white/10 rounded-t-[3rem] p-8 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
            
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Key className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">API Configuration</h3>
                  <p className="text-sm text-white/40">Required for Gemini 2.5 Live features</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter your Gemini API Key..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    defaultValue={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                
                <button
                  onClick={() => saveApiKey(apiKey)}
                  className="w-full bg-white text-black font-bold py-4 rounded-2xl active:scale-[0.98] transition-all"
                >
                  Save and Start
                </button>

                <div className="flex justify-center">
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-indigo-400 hover:underline"
                  >
                    <span>Get a free key from Google AI Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
