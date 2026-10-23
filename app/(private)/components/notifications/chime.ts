type AudioParamLike = {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
};

type OscillatorLike = {
  type: OscillatorType;
  readonly frequency: AudioParamLike;
  connect(node: unknown): unknown;
  start(when: number): void;
  stop(when: number): void;
};

type GainLike = {
  readonly gain: AudioParamLike;
  connect(node: unknown): unknown;
};

export type AudioContextLike = {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
};

export type ChimeOutcome = 'played' | 'unavailable';

export interface Chime {
  /** Crea y reanuda el contexto de audio. Solo funciona dentro de un gesto del usuario. */
  unlock(): Promise<void>;
  play(): Promise<ChimeOutcome>;
}

export const CHIME_NOTES_HZ = [880, 1320] as const;
const NOTE_SECONDS = 0.12;
const PEAK_GAIN = 0.2;

function scheduleNote(context: AudioContextLike, frequency: number, at: number): void {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, at);
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.linearRampToValueAtTime(PEAK_GAIN, at + 0.01);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_SECONDS);
  oscillator.connect(envelope);
  envelope.connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + NOTE_SECONDS);
}

/** El tono sale de dos osciladores: no hay archivo de audio que cargar. */
export function createChime(createContext: () => AudioContextLike | null): Chime {
  let context: AudioContextLike | null = null;

  // Sin un gesto previo el navegador deja el contexto suspendido o rechaza reanudarlo: las dos
  // cosas significan «sin sonido», nunca un error.
  const ensureRunning = async (): Promise<AudioContextLike | null> => {
    try {
      context ??= createContext();
      if (context === null) return null;
      if (context.state !== 'running') await context.resume();
      return context.state === 'running' ? context : null;
    } catch {
      return null;
    }
  };

  return {
    async unlock() {
      await ensureRunning();
    },
    async play() {
      const running = await ensureRunning();
      if (running === null) return 'unavailable';
      try {
        const start = running.currentTime;
        CHIME_NOTES_HZ.forEach((frequency, index) => scheduleNote(running, frequency, start + index * NOTE_SECONDS));
        return 'played';
      } catch {
        return 'unavailable';
      }
    },
  };
}

type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };

export function browserAudioContext(): AudioContextLike | null {
  if (typeof window === 'undefined') return null;
  const Context = window.AudioContext ?? (window as WindowWithAudio).webkitAudioContext;
  if (Context === undefined) return null;
  try {
    return new Context();
  } catch {
    return null;
  }
}

type GestureTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

const UNLOCK_EVENTS = ['pointerdown', 'keydown'] as const;

/** Desbloquea el audio en el primer gesto de la página. Devuelve cómo desarmarlo. */
export function armChimeUnlock(chime: Chime, target: GestureTarget): () => void {
  const disarm = () => {
    for (const type of UNLOCK_EVENTS) target.removeEventListener(type, onGesture);
  };
  function onGesture() {
    disarm();
    void chime.unlock();
  }
  for (const type of UNLOCK_EVENTS) target.addEventListener(type, onGesture);
  return disarm;
}
