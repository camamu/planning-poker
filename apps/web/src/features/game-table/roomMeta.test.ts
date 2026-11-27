import { describe, expect, it } from 'vitest';
import { roomMeta } from './roomMeta.js';

const FIBONACCI = ['0.5', '1', '2', '3', '5', '8', '13', '?', '☕'];

describe('roomMeta', () => {
  it('cuenta los valores sin las cartas especiales y en plural cuando toca', () => {
    expect(roomMeta(FIBONACCI, 6, 2)).toBe('7 valores · 6 votantes · 2 mirones');
  });

  it('en singular cuando hay solo uno', () => {
    expect(roomMeta(['1', '?', '☕'], 1, 1)).toBe('1 valor · 1 votante · 1 mirón');
  });
});
