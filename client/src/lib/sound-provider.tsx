import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";

type SoundType = "correct" | "wrong" | "win" | "lose" | "tick" | "click" | "notify" | "countdown";

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  playSound: (type: SoundType, pitchMultiplier?: number) => void;
  playSoundBypass: (type: SoundType, pitchMultiplier?: number) => void;
  volume: number;
  setVolume: (v: number) => void;
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
  notify: [
    { frequency: 880, duration: 0.08, type: "sine" },
    { frequency: 1108.73, duration: 0.12, type: "sine" },
  ],
  countdown: [
    { frequency: 523.25, duration: 0.1, type: "sine" },
    { frequency: 659.25, duration: 0.1, type: "sine" },
    { frequency: 783.99, duration: 0.15, type: "sine" },
  ],
};

export function SoundProvider({ children }: { children: ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("soundEnabled");
      return stored !== null ? stored === "true" : true;
    }
    return true;
  });

  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("soundVolume");
      return stored !== null ? parseFloat(stored) : 0.3;
    }
    return 0.3;
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(soundEnabled);
  const volumeRef = useRef(volume);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem("soundEnabled", String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    volumeRef.current = volume;
    localStorage.setItem("soundVolume", String(volume));
  }, [volume]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.max(0, Math.min(1, v)));
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSoundRaw = useCallback((type: SoundType, pitchMultiplier = 1) => {
    try {
      const audioContext = getAudioContext();
      const notes = SOUND_FREQUENCIES[type];
      const gain = volumeRef.current;

      let startTime = audioContext.currentTime;

      notes.forEach((note) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = note.type;
        oscillator.frequency.setValueAtTime(note.frequency * pitchMultiplier, startTime);

        gainNode.gain.setValueAtTime(gain, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + note.duration);

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

  const playSound = useCallback((type: SoundType, pitchMultiplier = 1) => {
    if (!soundEnabledRef.current) return;
    playSoundRaw(type, pitchMultiplier);
  }, [playSoundRaw]);

  const playSoundBypass = useCallback((type: SoundType, pitchMultiplier = 1) => {
    playSoundRaw(type, pitchMultiplier);
  }, [playSoundRaw]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, playSound, playSoundBypass, volume, setVolume }}>
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
