import { useState, useCallback, useRef } from 'react';
import * as Speech from 'expo-speech';

interface VoiceState {
  isListening: boolean;
  transcript: string;
  error: string | null;
}

const LANG_MAP: Record<string, string> = {
  hi: 'hi-IN', en: 'en-IN', ta: 'ta-IN', bn: 'bn-IN', mr: 'mr-IN',
};

export function useVoiceInput(defaultLang: string = 'hi') {
  const [state, setState] = useState<VoiceState>({
    isListening: false, transcript: '', error: null,
  });
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(async () => {
    setState({ isListening: true, transcript: '', error: null });

    try {
      // @ts-ignore — expo-speech-recognition types may not be available
      const { SpeechRecognition } = require('expo-speech-recognition');
      recognitionRef.current = SpeechRecognition.start({
        lang: LANG_MAP[defaultLang] || 'hi-IN',
        interimResults: true,
        onResult: (result: string) => {
          setState(s => ({ ...s, transcript: result }));
        },
        onEnd: () => {
          setState(s => ({ ...s, isListening: false }));
        },
        onError: (err: string) => {
          setState(s => ({ ...s, isListening: false, error: err }));
        },
      });
    } catch {
      // Fallback: no speech recognition available, use text input
      setState({ isListening: false, transcript: '', error: 'Speech recognition not available' });
    }
  }, [defaultLang]);

  const stopListening = useCallback(() => {
    try {
      const { SpeechRecognition } = require('expo-speech-recognition');
      SpeechRecognition.stop();
    } catch {}
    setState(s => ({ ...s, isListening: false }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    transcript: state.transcript,
  };
}

export function speak(text: string, lang: string = 'hi') {
  Speech.stop();
  const clean = text.replace(/\[\d+\]/g, '').replace(/\*+/g, '').trim();
  Speech.speak(clean, {
    language: LANG_MAP[lang] || 'hi-IN',
    rate: 0.9,
    pitch: 1.0,
  });
}
