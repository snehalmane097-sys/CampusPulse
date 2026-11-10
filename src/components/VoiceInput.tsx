"use client";

import { useRef, useState } from "react";

interface Props {
  onResult: (text: string) => void;
}

// Wraps the browser's Web Speech API so a student can speak a grievance
// instead of typing it: "Voice -> Text -> Classification -> Priority ->
// Department -> Submit", per the PDF's Voice Grievance feature.
export default function VoiceInput({ onResult }: Props) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  function start() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  if (!supported) {
    return (
      <p className="text-xs text-slate-soft">
        Voice input isn&apos;t supported in this browser — try Chrome, or type your grievance instead.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
        listening
          ? "border-critical text-critical bg-critical/10"
          : "border-ink-line text-slate-soft hover:border-signal hover:text-signal"
      }`}
    >
      <span className="relative flex h-2.5 w-2.5">
        {listening && (
          <span className="animate-ping1 absolute inline-flex h-full w-full rounded-full bg-critical opacity-75" />
        )}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${listening ? "bg-critical" : "bg-slate-soft"}`} />
      </span>
      {listening ? "Listening… tap to stop" : "Speak your grievance"}
    </button>
  );
}
