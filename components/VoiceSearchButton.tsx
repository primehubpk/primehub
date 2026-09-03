'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff } from 'lucide-react';
import { interpretSearchQuery } from '@/lib/aiSearchClient';

type Props = {
  onTranscript: (text: string) => void;
  className?: string;
};

function extensionForMime(mime: string) {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

export default function VoiceSearchButton({ onTranscript, className = '' }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<number | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setSupported(Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder));
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function transcribe(blob: Blob) {
    setProcessing(true);
    try {
      const form = new FormData();
      form.append('audio', blob, `voice.${extensionForMime(blob.type)}`);
      const response = await fetch('/api/search/transcribe', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({}));
      const transcript = typeof data?.text === 'string' ? data.text.trim() : '';
      if (!response.ok || !transcript) return;

      onTranscript(transcript);
      const intent = await interpretSearchQuery(transcript);
      if (intent.query) onTranscript(intent.query);
    } catch {
      // Keep voice search non-blocking; normal text search remains available.
    } finally {
      setProcessing(false);
    }
  }

  function stopRecording() {
    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  async function startRecording() {
    if (!supported || processing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstart = () => {
        setListening(true);
        stopTimerRef.current = window.setTimeout(stopRecording, 15000);
      };
      recorder.onerror = () => {
        setListening(false);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onstop = () => {
        setListening(false);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (blob.size > 0) void transcribe(blob);
      };

      recorder.start(250);
    } catch {
      setListening(false);
    }
  }

  function toggleListening() {
    if (listening) stopRecording();
    else void startRecording();
  }

  if (!supported) return null;

  const active = listening || processing;
  const label = listening ? 'Stop voice search' : processing ? 'Understanding voice search' : 'Search by voice';

  return (
    <button
      type="button"
      onClick={toggleListening}
      disabled={processing}
      aria-label={label}
      title={listening ? 'Listening… tap to search' : processing ? 'Understanding your search…' : 'Search by voice'}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${active ? 'bg-[#E1352B] text-white shadow-sm' : 'text-black/40 hover:bg-black/5 hover:text-[#14140F]'} disabled:cursor-wait ${className}`}
    >
      {processing ? <Loader2 size={15} className="animate-spin" /> : listening ? <MicOff size={15} /> : <Mic size={15} />}
      <span className="sr-only">{label}</span>
    </button>
  );
}
