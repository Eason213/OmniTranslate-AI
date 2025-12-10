import React, { useState, useEffect, useRef } from 'react';
import { ConnectionState, Language } from './types';
import { SUPPORTED_LANGUAGES } from './constants';
import { useLiveTranslator } from './hooks/useLiveTranslator';
import { LanguageSelector } from './components/LanguageSelector';
import { Visualizer } from './components/Visualizer';
import { Toggle } from './components/Toggle';
import { Mic, Square, ArrowRightLeft, Sparkles, Download } from 'lucide-react';
import { clsx } from 'clsx';

export default function App() {
  const [langA, setLangA] = useState<Language>(SUPPORTED_LANGUAGES[0]); // Traditional Chinese
  const [langB, setLangB] = useState<Language>(SUPPORTED_LANGUAGES[1]); // English
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState<boolean>(false); // Default false as requested
  
  // Use a ref for transcripts container auto-scroll
  const scrollRef = useRef<HTMLDivElement>(null);

  const { connectionState, transcripts, error, connect, disconnect } = useLiveTranslator({
    langA,
    langB,
    autoPlay,
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

  const handleToggle = () => {
    if (isConnected || isConnecting) {
      disconnect();
    } else {
      connect();
    }
  };

  const swapLanguages = () => {
    if (isConnected) return; // Disable swap while active
    setLangA(langB);
    setLangB(langA);
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

    // Build Filename: Date + Languages + Time
    const now = new Date();
    
    // Date: YYYY-MM-DD (Using dashes instead of slashes for filesystem compatibility)
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Time: 12-hour format (e.g., 03-30PM)
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}-${minutes}${ampm}`;

    // Languages (e.g., 中文-English)
    const langStr = `${langA.label}-${langB.label}`;

    link.download = `${dateStr}_${langStr}_${timeStr}.txt`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center bg-black overflow-hidden text-white selection:bg-indigo-500/30">
      
      {/* Background Ambience */}
      <div className="fixed top-[-20%] left-[-20%] w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-black to-black pointer-events-none" />
      <div className="fixed top-10 left-10 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="fixed bottom-10 right-10 w-80 h-80 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-md mx-auto p-6 flex flex-col gap-4 z-10">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">OmniTranslate</span>
          </div>
          <div className={clsx(
            "px-3 py-1 rounded-full text-xs font-medium border transition-all",
            isConnected ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/5 border-white/10 text-white/40"
          )}>
            {isConnected ? "LIVE" : "READY"}
          </div>
        </div>
        
        {/* Settings Bar */}
        <div className="flex justify-end items-center gap-3">
           <button
             onClick={handleExport}
             disabled={transcripts.length === 0}
             className="p-2 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
             title="Export Transcript"
           >
             <Download className="w-5 h-5" />
           </button>
           <div className="h-6 w-px bg-white/10 mx-1" />
           <Toggle 
             checked={autoPlay} 
             onChange={setAutoPlay} 
             label="Auto-speak" 
           />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col gap-4 z-10 relative h-full">
        
        {/* Language Controls Island */}
        <div className="glass-island rounded-3xl p-5 flex items-center gap-4 mx-2">
          <div className="flex-1">
            <LanguageSelector 
              selected={langA} 
              onSelect={setLangA} 
              label="From" 
              disabled={isConnected}
            />
          </div>
          
          <button 
            onClick={swapLanguages}
            disabled={isConnected}
            className="mt-5 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all disabled:opacity-30"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <LanguageSelector 
              selected={langB} 
              onSelect={setLangB} 
              label="To"
              disabled={isConnected}
            />
          </div>
        </div>

        {/* Transcript Area */}
        <div className="flex-1 min-h-0 relative rounded-[2.5rem] overflow-hidden border border-white/5 bg-white/[0.02]">
           <div 
             ref={scrollRef}
             className="absolute inset-0 overflow-y-auto p-6 space-y-6 scroll-smooth"
           >
             {transcripts.length === 0 && !isConnected && (
               <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                 <Mic className="w-12 h-12 opacity-20" />
                 <p className="text-sm font-medium">Tap the microphone to start translating</p>
               </div>
             )}

             {transcripts.map((item) => (
               <div key={item.id} className={clsx(
                 "flex flex-col gap-2 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4",
                 item.isUser ? "items-end" : "items-start"
               )}>
                 <div className={clsx(
                   "max-w-[85%] px-5 py-3 rounded-2xl text-base leading-relaxed backdrop-blur-md",
                   item.isUser 
                     ? "bg-white/10 text-white rounded-tr-sm border border-white/10" 
                     : "bg-indigo-600/80 text-white rounded-tl-sm shadow-lg shadow-indigo-900/20 border border-indigo-400/20"
                 )}>
                   {item.text}
                 </div>
                 <span className="text-[10px] uppercase tracking-wider text-white/30 px-2 font-medium">
                   {item.isUser ? "Original" : "Translation"}
                 </span>
               </div>
             ))}

             {isConnected && transcripts.length > 0 && (
                <div className="h-12" /> /* Spacer for visual breathing room at bottom */
             )}
           </div>
           
           {/* Fade overlay at top */}
           <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-sm p-3 rounded-2xl text-center mx-4">
            {error}
          </div>
        )}

        {/* Bottom Control Island */}
        <div className="mb-6 mx-auto">
          <button
            onClick={handleToggle}
            className={clsx(
              "relative group w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl",
              isConnected 
                ? "bg-red-500/10 hover:bg-red-500/20 border border-red-500/50" 
                : "bg-white text-black hover:scale-105 border-4 border-white/10"
            )}
          >
            {/* Visualizer Ring (Only when connected) */}
            {isConnected && (
               <div 
                 className="absolute inset-0 rounded-full border-2 border-red-500/50 animate-ping opacity-20"
                 style={{ animationDuration: '2s' }}
               />
            )}
            
            {/* Active Glow */}
            <div className={clsx(
              "absolute inset-0 rounded-full blur-xl transition-all duration-500",
              isConnected ? "bg-red-500/30 scale-125" : "bg-white/30 scale-0 opacity-0 group-hover:scale-110 group-hover:opacity-100"
            )} />

            {/* Icon */}
            {isConnected ? (
              <Square className="w-8 h-8 fill-red-500 text-red-500 relative z-10" />
            ) : (
              <Mic className="w-8 h-8 relative z-10" />
            )}
          </button>
        </div>

        {/* Visualizer Display (Below button) */}
        <div className="h-8 flex justify-center items-end">
           <Visualizer level={audioLevel} active={isConnected} />
        </div>

      </main>
    </div>
  );
}
