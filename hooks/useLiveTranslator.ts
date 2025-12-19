import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ConnectionState, TranscriptItem, Language } from '../types';
import { MODEL_NAME, AUDIO_SAMPLE_RATE_INPUT, AUDIO_SAMPLE_RATE_OUTPUT } from '../constants';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audio';

interface UseLiveTranslatorProps {
  langA: Language;
  langB: Language;
  autoPlay: boolean;
  apiKey: string;
  onAudioLevelChange?: (level: number) => void;
}

export const useLiveTranslator = ({ langA, langB, autoPlay, apiKey, onAudioLevelChange }: UseLiveTranslatorProps) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isAiSpeakingRef = useRef<boolean>(false);
  
  const autoPlayRef = useRef(autoPlay);
  useEffect(() => {
    autoPlayRef.current = autoPlay;
  }, [autoPlay]);

  const currentInputTransRef = useRef<string>('');
  const currentOutputTransRef = useRef<string>('');

  const disconnect = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

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
    const keyToUse = apiKey || (process.env.API_KEY as string);

    if (!keyToUse) {
      setError("API Key is missing. Please check your settings.");
      return;
    }

    try {
      setConnectionState(ConnectionState.CONNECTING);
      setError(null);
      isAiSpeakingRef.current = false;

      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const inputCtx = new InputContextClass({ sampleRate: AUDIO_SAMPLE_RATE_INPUT });
      inputAudioContextRef.current = inputCtx;

      const OutputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const outputCtx = new OutputContextClass({ sampleRate: AUDIO_SAMPLE_RATE_OUTPUT });
      outputAudioContextRef.current = outputCtx;
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

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
        You are an elite SIMULTANEOUS INTERPRETER designed for real-time translation earphones. 
        Current Task: Bidirectional translation between ${langA.name} and ${langB.name}.

        MODE: SIMULTANEOUS (Real-time Earphone)
        - Start translating IMMEDIATELY once you have enough context for a coherent phrase.
        - DO NOT wait for long pauses. DO NOT wait for the end of a long sentence.
        - Emulate the "Earphone mode" where the listener hears the translation almost instantly as the speaker talks.
        - Translate in small, accurate, and fluid chunks.

        RULES:
        1. [NO CONVERSATION] You are a machine. Never speak to the user. ONLY output the translation.
        2. [AUTO-DETECTION] Detect which language is being spoken and translate to the other.
        3. [CLEAN OUTPUT] Ignore background noise or speech in other languages.
        4. [TAIWAN TRADITIONAL] For Chinese translations, use Taiwan vocabulary and Traditional characters.
      `;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            const source = inputCtx.createMediaStreamSource(stream);
            sourceNodeRef.current = source;
            
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              // We keep recording even if AI is speaking to allow true simultaneous feel,
              // but we rely on browser echo cancellation.
              const inputData = e.inputBuffer.getChannelData(0);
              
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

            // Handle Transcriptions for Display
            if (serverContent?.inputTranscription) {
              const text = serverContent.inputTranscription.text;
              if (text) {
                currentInputTransRef.current += text;
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
              if (currentInputTransRef.current.trim()) {
                 updateLastTranscript(currentInputTransRef.current, true, true);
                 currentInputTransRef.current = '';
              }
              if (currentOutputTransRef.current.trim()) {
                 updateLastTranscript(currentOutputTransRef.current, false, true);
                 currentOutputTransRef.current = '';
              }
            }

            // Handle Audio Playback
            const audioData = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputAudioContextRef.current && autoPlayRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

              const audioBytes = base64ToUint8Array(audioData);
              const audioBuffer = await decodeAudioData(audioBytes, ctx, AUDIO_SAMPLE_RATE_OUTPUT);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              
              source.addEventListener('ended', () => {
                activeSourcesRef.current.delete(source);
                if (activeSourcesRef.current.size === 0) {
                   isAiSpeakingRef.current = false;
                }
              });

              isAiSpeakingRef.current = true;
              source.start(nextStartTimeRef.current);
              activeSourcesRef.current.add(source);
              nextStartTimeRef.current += audioBuffer.duration;
            }
          },
          onclose: () => {
            setConnectionState(ConnectionState.DISCONNECTED);
            disconnect();
          },
          onerror: (err) => {
            console.error(err);
            setConnectionState(ConnectionState.ERROR);
            setError("Connection disrupted.");
          }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setConnectionState(ConnectionState.ERROR);
      setError(err.message || "Failed to establish connection.");
      disconnect();
    }
  }, [langA, langB, apiKey, disconnect, onAudioLevelChange]);

  const updateLastTranscript = (text: string, isUser: boolean, isFinal: boolean) => {
    setTranscripts(prev => {
      let indexToUpdate = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        const item = prev[i];
        if (item.isUser === isUser && !item.isFinal) {
           indexToUpdate = i;
           break;
        }
      }

      if (indexToUpdate !== -1) {
        const updatedItems = [...prev];
        updatedItems[indexToUpdate] = { ...updatedItems[indexToUpdate], text, isFinal };
        return updatedItems;
      }
      
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

  return { connectionState, transcripts, error, connect, disconnect };
};
