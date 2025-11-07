"use client";

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import useVoiceInput from '@/lib/useVoiceInput';

type VoiceInputButtonProps = {
  onTranscript: (text: string) => void;
  language?: string;
  className?: string;
};

export default function VoiceInputButton({ 
  onTranscript, 
  language = 'en-US',
  className 
}: VoiceInputButtonProps) {
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceInput();

  // Send transcript when it changes
  useEffect(() => {
    if (transcript) {
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening(language);
    }
  };

  if (!isSupported) {
    return null; // Don't show button if not supported
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant={isListening ? "destructive" : "outline"}
        size="sm"
        onClick={handleToggle}
        className="relative"
      >
        {isListening ? (
          <>
            <MicOff className="h-4 w-4 mr-2" />
            Stop Recording
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          </>
        ) : (
          <>
            <Mic className="h-4 w-4 mr-2" />
            Voice Input
          </>
        )}
      </Button>
      
      {/* Show interim transcript while listening */}
      {isListening && interimTranscript && (
        <div className="mt-2 text-xs text-muted-foreground italic">
          Listening: {interimTranscript}
        </div>
      )}
    </div>
  );
}
