import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  playImpactSound,
  playReactionSound,
  playRevealSound,
  playThrowSound,
  playVoteSound,
} from './sounds.js';

class FakeGain {
  gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect(): this {
    return this;
  }
}

class FakeOscillator {
  type = 'sine';
  frequency = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn(() => new FakeGain());
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  createOscillator(): FakeOscillator {
    return new FakeOscillator();
  }
  createGain(): FakeGain {
    return new FakeGain();
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
}

describe('shared/audio/sounds', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no sintetiza nada si muted es true (ni siquiera crea un AudioContext)', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => {
      playVoteSound(true);
      playRevealSound(true, true);
      playThrowSound(true);
      playImpactSound(true);
      playReactionSound(true);
    }).not.toThrow();
  });

  it('sintetiza el sonido de voto sin lanzar', () => {
    expect(() => {
      playVoteSound(false);
    }).not.toThrow();
  });

  it('sintetiza el arpegio de unanimidad y el de desacuerdo sin lanzar', () => {
    expect(() => {
      playRevealSound(true, false);
      playRevealSound(false, false);
    }).not.toThrow();
  });
});
