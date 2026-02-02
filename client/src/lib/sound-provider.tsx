import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";

type SoundType = "correct" | "wrong" | "win" | "lose" | "tick" | "click";

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  playSound: (type: SoundType) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_FREQUENCIES: Record<SoundType, { frequency: number; duration: number; type: OscillatorType; ramp?: boolean }[]> = {
  correct: [
    { frequency: 523.25, duration: 0.1, type: "sine" },
    { frequency: 659.25, duration: 0.15, type: "sine" },
  ],
  wrong: [
    { frequency: 200, duration: 0.15, type: "square" },
    { frequency: 150, duration: 0.2, type: "square" },
  ],
  win: [
    { frequency: 523.25, duration: 0.1, type: "sine" },
    { frequency: 659.25, duration: 0.1, type: "sine" },
    { frequency: 783.99, duration: 0.1, type: "sine" },
    { frequency: 1046.50, duration: 0.3, type: "sine" },
  ],
  lose: [
    { frequency: 392, duration: 0.15, type: "sine" },
    { frequency: 349.23, duration: 0.15, type: "sine" },
    { frequency: 329.63, duration: 0.15, type: "sine" },
    { frequency: 261.63, duration: 0.3, type: "sine" },
  ],
  tick: [
    { frequency: 800, duration: 0.05, type: "sine" },
  ],
  click: [
    { frequency: 600, duration: 0.03, type: "sine" },
  ],
};

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("soundEnabled");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem("soundEnabled", String(soundEnabled));
  }, [soundEnabled]);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((type: SoundType) => {
    if (!soundEnabledRef.current) return;

    try {
      const audioContext = getAudioContext();
      const notes = SOUND_FREQUENCIES[type];
      
      let startTime = audioContext.currentTime;
      
      notes.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = note.type;
        oscillator.frequency.setValueAtTime(note.frequency, startTime);
        
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + note.duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + note.duration);
        
        startTime += note.duration;
      });
    } catch (error) {
      console.warn("Could not play sound:", error);
    }
  }, [getAudioContext]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, playSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error("useSound must be used within a SoundProvider");
  }
  return context;
}
