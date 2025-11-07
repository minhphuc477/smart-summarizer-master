import { useState, useEffect, useCallback } from 'react';

type SpeechState = 'idle' | 'speaking' | 'paused';

export function useSpeech() {
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [isPaused, setIsPaused] = useState(false);

  // Kiểm tra xem trình duyệt có hỗ trợ Web Speech API không
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!isSupported) return;

    const synth = window.speechSynthesis;

    // Cleanup khi component unmount
    return () => {
      synth.cancel();
    };
  }, [isSupported]);

  const speak = useCallback((text: string, options?: { rate?: number; pitch?: number; volume?: number; lang?: string }) => {
    if (!isSupported || !text.trim()) return;

    const synth = window.speechSynthesis;
    
    // Dừng bất kỳ speech nào đang chạy
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Cấu hình các tham số
    utterance.rate = options?.rate ?? 1.0; // Tốc độ (0.1 - 10)
    utterance.pitch = options?.pitch ?? 1.0; // Cao độ (0 - 2)
    utterance.volume = options?.volume ?? 1.0; // Âm lượng (0 - 1)
    utterance.lang = options?.lang ?? 'vi-VN'; // Ngôn ngữ

    utterance.onstart = () => {
      setSpeechState('speaking');
      setIsPaused(false);
    };

    utterance.onend = () => {
      setSpeechState('idle');
      setIsPaused(false);
    };

    utterance.onerror = (event) => {
      // Ignore 'interrupted' and 'canceled' errors - these are expected when user stops speech
      const errorEvent = event as SpeechSynthesisErrorEvent;
      if (errorEvent.error !== 'interrupted' && errorEvent.error !== 'canceled') {
        console.error('Speech synthesis error:', errorEvent.error, event);
      }
      setSpeechState('idle');
      setIsPaused(false);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    synth.speak(utterance);
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    if (synth.speaking && !synth.paused) {
      synth.pause();
      setSpeechState('paused');
    }
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    if (synth.paused) {
      synth.resume();
      setSpeechState('speaking');
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    setSpeechState('idle');
    setIsPaused(false);
  }, [isSupported]);

  return {
    speak,
    pause,
    resume,
    stop,
    speechState,
    isPaused,
    isSupported,
    isSpeaking: speechState === 'speaking' && !isPaused,
  };
}
