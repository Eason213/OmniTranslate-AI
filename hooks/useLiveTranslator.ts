import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState, TranscriptItem, Language } from '../types';
import { MODEL_NAME, AUDIO_SAMPLE_RATE_INPUT, AUDIO_SAMPLE_RATE_OUTPUT } from '../constants';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio';

interface UseLiveTranslatorProps {
  langA: Language;
  langB: Language;
  autoPlay: boolean;
  apiKey: string; // New prop for dynamic API Key
  onAudioLevelChange?: (level: number) => void;
}

export const useLiveTranslator = ({ langA, langB, autoPlay, apiKey, onAudioLevelChange }: UseLiveTranslatorProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs for audio handling to avoid re-renders
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null); // To hold the active session
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isAiSpeakingRef = useRef<boolean>(false); // Flag to track if AI is currently outputting audio
  
  // Keep autoPlay current in callbacks without reconnecting
  const autoPlayRef = useRef(autoPlay);
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  // Transcriptions buffering
  const currentInputTransRef = useRef<string>('');
  const currentOutputTransRef = useRef<string>('');

  const disconnect = useCallback(() => {
    // Close session
    if (sessionRef.current) {
      // The SDK doesn't expose a direct close method on the session object easily in all versions,
      // but usually closing the underlying websocket or stopping processing is enough.
      // We'll rely on stopping the audio processing to "stop" the interaction effectively.
    }
    
    // Stop Microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Stop Input Processing
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }

    // Stop Output Processing
    activeSourcesRef.current.forEach(source => source.stop());
    activeSourcesRef.current.clear();
    isAiSpeakingRef.current = false;
    
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    setConnectionState(ConnectionState.DISCONNECTED);
    nextStartTimeRef.current = 0;
  }, []);

  const connect = useCallback(async () => {
    // Priority: Prop Key -> Env Key
    const keyToUse = apiKey || (process.env.API_KEY as string);

    if (!keyToUse) {
      setError("API Key is missing. Please click the Key icon to set it.");
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);
      isAiSpeakingRef.current = false;

      // Initialize Audio Contexts
      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const inputCtx = new InputContextClass({ sampleRate: AUDIO_SAMPLE_RATE_INPUT });
      inputAudioContextRef.current = inputCtx;

      const OutputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const outputCtx = new OutputContextClass({ sampleRate: AUDIO_SAMPLE_RATE_OUTPUT });
      outputAudioContextRef.current = outputCtx;
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      // Get Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: keyToUse });
      
      const systemInstruction = `
        You are a professional, high-end simultaneous interpreter strictly translating between ${langA.name} and ${langB.name}.
        
        CRITICAL RULES:
        1. [TRANSLATION ONLY] 
           - If you hear ${langA.name}, translate it immediately to ${langB.name}.
           - If you hear ${langB.name}, translate it immediately to ${langA.name}.
           - DO NOT act as a chatbot. DO NOT answer questions. ONLY TRANSLATE.
        
        2. [LANGUAGE FILTERING]
           - IGNORE any speech that is NOT in ${langA.name} or ${langB.name}.
           - If the audio is background noise, music, or unintelligible, OUTPUT NOTHING (Silence).
           - Do not output text for languages other than ${langA.name} and ${langB.name}.

        3. [STYLE & FORMAT]
           - Maintain a natural, conversational tone.
           - For Traditional Chinese, use Taiwan vocabulary (繁體中文-臺灣).
           - If the input is short or fragmented, wait for context or translate as-is if clear.
      `;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } // Fenrir is usually deep/calm
          },
          inputAudioTranscription: {}, // Helper for transcription
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            // Setup Input Stream Processing
            const source = inputCtx.createMediaStreamSource(stream);
            sourceNodeRef.current = source;
            
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              // PREVENT ECHO: Stop sending input if AI is speaking
              if (isAiSpeakingRef.current) {
                if (onAudioLevelChange) onAudioLevelChange(0);
                return;
              }

              const inputData = e.inputBuffer.getChannelData(0);
              
              // Audio Level Visualization
              if (onAudioLevelChange) {
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                   sum += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sum / inputData.length);
                onAudioLevelChange(rms);
              }

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const { serverContent } = msg;

            // Handle Transcriptions
            if (serverContent?.inputTranscription) {
              const text = serverContent.inputTranscription.text;
              if (text) {
                currentInputTransRef.current += text;
                // Update specific item in state or create new one
                updateLastTranscript(currentInputTransRef.current, true, false);
              }
            }
            
            if (serverContent?.outputTranscription) {
               const text = serverContent.outputTranscription.text;
               if (text) {
                 currentOutputTransRef.current += text;
                 updateLastTranscript(currentOutputTransRef.current, false, false);
               }
            }

            if (serverContent?.turnComplete) {
              // Finalize the current items
              if (currentInputTransRef.current.trim()) {
                 updateLastTranscript(currentInputTransRef.current, true, true);
                 currentInputTransRef.current = '';
              }
              if (currentOutputTransRef.current.trim()) {
                 updateLastTranscript(currentOutputTransRef.current, false, true);
                 currentOutputTransRef.current = '';
              }
            }

            // Handle Audio Output
            const audioData = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current) {
              
              // ONLY Play if autoPlay is true
              if (autoPlayRef.current) {
                const ctx = outputAudioContextRef.current;
                // Ensure nextStartTime is valid
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

                const audioBytes = base64ToUint8Array(audioData);
                const audioBuffer = await decodeAudioData(audioBytes, ctx, AUDIO_SAMPLE_RATE_OUTPUT);
                
                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNode);
                
                source.addEventListener('ended', () => {
                  activeSourcesRef.current.delete(source);
                  // If no more sources are playing, we can resume listening
                  if (activeSourcesRef.current.size === 0) {
                     // IMPORTANT: Add a small buffer delay to allow room echo to die down
                     // before enabling the microphone again.
                     setTimeout(() => {
                        isAiSpeakingRef.current = false;
                     }, 400); 
                  }
                });

                // Set flag to true to pause microphone input
                isAiSpeakingRef.current = true;
                
                source.start(nextStartTimeRef.current);
                activeSourcesRef.current.add(source);
                nextStartTimeRef.current += audioBuffer.duration;
              }
            }
          },
          onclose: () => {
            setConnectionState(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
            console.error(err);
            setConnectionState(ConnectionState.ERROR);
            setError("Connection Error");
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setConnectionState(ConnectionState.ERROR);
      setError(err.message || "Failed to connect");
      disconnect();
    }
  }, [langA, langB, apiKey, disconnect, onAudioLevelChange]); // Note: autoPlay is not a dependency here, handled via ref

  // Helper to update transcript state intelligently
  const updateLastTranscript = (text: string, isUser: boolean, isFinal: boolean) => {
    setTranscripts(prev => {
      // Find the last item that matches the type (isUser) and is not final
      let indexToUpdate = -1;
      
      // Search backwards for an active (non-final) item of the same speaker
      for (let i = prev.length - 1; i >= 0; i--) {
        const item = prev[i];
        if (item.isUser === isUser && !item.isFinal) {
           indexToUpdate = i;
           break;
        }
      }

      // If found, update it
      if (indexToUpdate !== -1) {
        const updatedItems = [...prev];
        updatedItems[indexToUpdate] = {
           ...updatedItems[indexToUpdate],
           text,
           isFinal
        };
        return updatedItems;
      }
      
      // Otherwise add a new item, but only if there is text
      if (text.trim()) {
        return [...prev, {
          id: Date.now().toString() + Math.random().toString(),
          text,
          isUser,
          isFinal,
          timestamp: Date.now()
        }];
      }
      
      return prev;
    });
  };

  return {
    connectionState,
    transcripts,
    error,
    connect,
    disconnect
  };
};