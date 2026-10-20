import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  armChimeUnlock,
  CHIME_NOTES_HZ,
  createChime,
  type AudioContextLike,
} from '@/app/(private)/components/notifications/chime';

function fakeContext(initialState: string, resumeTo = 'running') {
  const oscillators: { type: string; frequency: number; start: number; stop: number }[] = [];
  const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const context = {
    state: initialState,
    currentTime: 5,
    destination: {},
    resume: vi.fn(async () => {
      context.state = resumeTo;
    }),
    createOscillator: vi.fn(() => {
      const record = { type: '', frequency: 0, start: -1, stop: -1 };
      oscillators.push(record);
      return {
        set type(value: OscillatorType) {
          record.type = value;
        },
        get type() {
          return record.type as OscillatorType;
        },
        frequency: { ...param(), setValueAtTime: vi.fn((value: number) => { record.frequency = value; }) },
        connect: vi.fn(),
        start: vi.fn((at: number) => { record.start = at; }),
        stop: vi.fn((at: number) => { record.stop = at; }),
      };
    }),
    createGain: vi.fn(() => ({ gain: param(), connect: vi.fn() })),
  };
  return { context: context as AudioContextLike & typeof context, oscillators };
}

const SOURCE = readFileSync(
  join(process.cwd(), 'app/(private)/components/notifications/chime.ts'),
  'utf8',
);

describe('chime', () => {
  it('R44: el tono son dos osciladores senoidales de ≈880 y 1320 Hz, uno tras otro', async () => {
    const { context, oscillators } = fakeContext('running');
    const chime = createChime(() => context);

    expect(await chime.play()).toBe('played');
    expect(oscillators.map((o) => o.type)).toEqual(['sine', 'sine']);
    expect(oscillators.map((o) => o.frequency)).toEqual([...CHIME_NOTES_HZ]);
    expect(CHIME_NOTES_HZ).toEqual([880, 1320]);
    expect(oscillators[0].start).toBe(5);
    expect(oscillators[1].start).toBeGreaterThanOrEqual(oscillators[0].stop);
    expect(oscillators.every((o) => o.stop - o.start <= 0.15)).toBe(true);
  });

  it('R44: no carga ningún archivo de audio', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { context } = fakeContext('running');
    await createChime(() => context).play();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(SOURCE).not.toMatch(/new Audio\(|\.mp3|\.wav|\.ogg|decodeAudioData|<audio/);
    fetchSpy.mockRestore();
  });

  it('R44: no existe API para silenciarlo', () => {
    const { context } = fakeContext('running');
    const chime = createChime(() => context);
    expect(Object.keys(chime).sort()).toEqual(['play', 'unlock']);
    expect(SOURCE).not.toMatch(/mute|silenc|volume/i);
  });

  it('R45: sin contexto de audio, o sin poder reanudarlo, responde unavailable sin lanzar', async () => {
    expect(await createChime(() => null).play()).toBe('unavailable');

    const { context: suspended } = fakeContext('suspended', 'suspended');
    expect(await createChime(() => suspended).play()).toBe('unavailable');

    const { context: rejecting } = fakeContext('suspended');
    rejecting.resume.mockRejectedValueOnce(new Error('NotAllowedError'));
    await expect(createChime(() => rejecting).play()).resolves.toBe('unavailable');

    const throwing = createChime(() => {
      throw new Error('sin audio');
    });
    await expect(throwing.play()).resolves.toBe('unavailable');
  });

  it('el primer pointerdown o keydown reanuda el audio una sola vez', async () => {
    const { context } = fakeContext('suspended');
    const chime = createChime(() => context);
    const target = new EventTarget();
    armChimeUnlock(chime, target);

    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(await chime.play()).toBe('played');
  });
});
