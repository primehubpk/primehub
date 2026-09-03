'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { interpretSearchQuery } from '@/lib/aiSearchClient';

type SpeechRecognitionEventLike = Event & {
  results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }>;
};

type SpeechRecognitionErrorEventLike = Event & { error?: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoiceWindow = Window & typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type Props = {
  onTranscript: (text: string) => void;
  className?: string;
  language?: string;
};

export default function VoiceSearchButton({ onTranscript, className = '', language = 'en-PK' }: Props) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const voiceWindow = window as VoiceWindow;
    setSupported(Boolean(voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition));
    return () => recognitionRef.current?.abort();
  }, []);

  function toggleListening() {
    if (!supported) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const voiceWindow = window as VoiceWindow;
    const Recognition = voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = language;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event) => {
      let transcript = '';
      let final = false;
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i]?.[0]?.transcript || '';
        if (event.results[i]?.isFinal) final = true;
      }
      const clean = transcript.trim();
      if (!clean) return;
      onTranscript(clean);
      if (final) {
        void interpretSearchQuery(clean).then((intent) => {
          if (intent.query) onTranscript(intent.query);
        });
      }
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggleListening}
      aria-label={listening ? 'Stop voice search' : 'Search by voice'}
      title={listening ? 'Listening… tap to stop' : 'Search by voice'}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${listening ? 'bg-[#E1352B] text-white shadow-sm' : 'text-black/40 hover:bg-black/5 hover:text-[#14140F]'} ${className}`}
    >
      {listening ? <MicOff size={15} /> : <Mic size={15} />}
      <span className="sr-only">{listening ? 'Listening' : 'Voice search'}</span>
    </button>
  );
}
