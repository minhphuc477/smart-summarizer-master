"use client";

import { useState, useEffect, useCallback } from 'react';

type BasicRecognitionEvent = {
  resultIndex: number;
  results: Array<{
    0: { transcript: string };
    isFinal: boolean;
  }> & { length: number };
};

type BasicSpeechRecognition = {
  start: () => void;
  stop: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BasicRecognitionEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

// Custom hook for voice recognition
export function useVoiceInput() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [recognition, setRecognition] = useState<BasicSpeechRecognition | null>(null);

  useEffect(() => {
    // Check if browser supports Speech Recognition
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setIsSupported(true);
  const recognitionInstance: BasicSpeechRecognition = new SpeechRecognition();
        
        // Configuration
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'en-US'; // Default to English
        
        // Event handlers
        recognitionInstance.onresult = (event: BasicRecognitionEvent) => {
          let interim = '';
          let final = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPiece = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              final += transcriptPiece + ' ';
            } else {
              interim += transcriptPiece;
            }
          }
          
          if (final) {
            setTranscript(prev => prev + final);
          }
          setInterimTranscript(interim);
        };
        
        recognitionInstance.onerror = (event: { error?: string }) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };
        
        recognitionInstance.onend = () => {
          setIsListening(false);
        };
        
        setRecognition(recognitionInstance);
      }
    }
  }, []);

  const startListening = useCallback((language = 'en-US') => {
    if (recognition) {
      recognition.lang = language;
      recognition.start();
      setIsListening(true);
      setTranscript('');
      setInterimTranscript('');
    }
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  }, [recognition]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}

export default useVoiceInput;
