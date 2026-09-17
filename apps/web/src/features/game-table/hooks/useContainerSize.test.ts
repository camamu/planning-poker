import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useContainerSize } from './useContainerSize.js';

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observed: Element | null = null;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed = target;
  }

  unobserve(): void {
    this.observed = null;
  }

  disconnect(): void {
    this.observed = null;
  }

  trigger(rect: Partial<DOMRectReadOnly>): void {
    this.callback([{ contentRect: rect } as ResizeObserverEntry], this);
  }
}

describe('useContainerSize', () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve null hasta que el ResizeObserver mide el contenedor por primera vez', () => {
    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, 'current', { value: document.createElement('div'), writable: true });

    const { result } = renderHook(() => useContainerSize(ref));

    expect(result.current).toBeNull();
  });

  it('actualiza el tamaño cuando el ResizeObserver reporta el contenedor', () => {
    const ref = createRef<HTMLDivElement>();
    Object.defineProperty(ref, 'current', { value: document.createElement('div'), writable: true });

    const { result } = renderHook(() => useContainerSize(ref));
    act(() => {
      FakeResizeObserver.instances[0]?.trigger({ width: 900, height: 520 });
    });

    expect(result.current).toEqual({ width: 900, height: 520 });
  });
});
