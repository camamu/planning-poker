import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { ContainerSize } from '../seatLayout.js';

/** Mide en píxeles el elemento referenciado, actualizándose con `ResizeObserver`. `null` hasta la primera medición. */
export function useContainerSize(ref: RefObject<HTMLElement | null>): ContainerSize | null {
  const [size, setSize] = useState<ContainerSize | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
