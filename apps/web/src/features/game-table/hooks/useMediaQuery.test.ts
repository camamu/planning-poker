import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery.js';

class FakeMediaQueryList extends EventTarget {
  constructor(public matches: boolean) {
    super();
  }

  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
}

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sigue a la media query cuando cambia, p. ej. al girar el móvil', () => {
    const list = new FakeMediaQueryList(true);
    vi.stubGlobal('matchMedia', () => list);

    const { result } = renderHook(() => useMediaQuery('(max-width: 639px)'));
    expect(result.current).toBe(true);

    act(() => {
      list.change(false);
    });
    expect(result.current).toBe(false);
  });

  it('sin matchMedia (jsdom) no se cumple y no lanza', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useMediaQuery('(max-width: 639px)'));

    expect(result.current).toBe(false);
  });
});
