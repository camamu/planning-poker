import { describe, expect, it } from 'vitest';
import type { EventPublisher } from '../../src/application/ports/EventPublisher.js';
import type { GameEvent } from '../../src/domain/game/events/GameEvent.js';
import { GameId } from '../../src/domain/game/ids.js';
import { CompositeEventPublisher } from '../../src/infrastructure/events/CompositeEventPublisher.js';

const EVENTS: ReadonlyArray<GameEvent> = [
  {
    type: 'GameCreated',
    occurredAt: new Date('2026-08-07T10:00:00Z'),
    gameId: GameId.of('game-1'),
  },
];

class Recorder implements EventPublisher {
  readonly received: Array<ReadonlyArray<GameEvent>> = [];

  publishAll(events: ReadonlyArray<GameEvent>): Promise<void> {
    this.received.push(events);
    return Promise.resolve();
  }
}

describe('CompositeEventPublisher', () => {
  it('entrega los eventos al publicador principal y a los de segundo plano', async () => {
    const primary = new Recorder();
    const background = new Recorder();
    const composite = new CompositeEventPublisher(primary, [background], () => undefined);

    await composite.publishAll(EVENTS);
    await Promise.resolve();

    expect(primary.received).toEqual([EVENTS]);
    await expect.poll(() => background.received.length).toBe(1);
  });

  it('no espera a los de segundo plano: una entrega lenta no retrasa la acción', async () => {
    const never: EventPublisher = { publishAll: () => new Promise(() => undefined) };
    const composite = new CompositeEventPublisher(new Recorder(), [never], () => undefined);

    await expect(composite.publishAll(EVENTS)).resolves.toBeUndefined();
  });

  it('un error de segundo plano no se propaga y se comunica a quien lo vigila', async () => {
    const failing: EventPublisher = {
      publishAll: () => Promise.reject(new Error('receptor caído')),
    };
    const reported: unknown[] = [];
    const composite = new CompositeEventPublisher(new Recorder(), [failing], (error) => {
      reported.push(error);
    });

    await expect(composite.publishAll(EVENTS)).resolves.toBeUndefined();

    await expect.poll(() => reported.length).toBe(1);
    expect(reported[0]).toEqual(new Error('receptor caído'));
  });

  it('también recoge un fallo síncrono de un publicador de segundo plano', async () => {
    const throwing: EventPublisher = {
      publishAll: () => {
        throw new Error('fallo síncrono');
      },
    };
    const reported: unknown[] = [];
    const composite = new CompositeEventPublisher(new Recorder(), [throwing], (error) => {
      reported.push(error);
    });

    await composite.publishAll(EVENTS);

    await expect.poll(() => reported.length).toBe(1);
  });

  it('un error del publicador principal sí se propaga y no se llama a los de segundo plano', async () => {
    const failing: EventPublisher = { publishAll: () => Promise.reject(new Error('socket caído')) };
    const background = new Recorder();
    const composite = new CompositeEventPublisher(failing, [background], () => undefined);

    await expect(composite.publishAll(EVENTS)).rejects.toThrow('socket caído');
    expect(background.received).toEqual([]);
  });

  it('un publicador de segundo plano que falla no impide que los demás reciban los eventos', async () => {
    const failing: EventPublisher = { publishAll: () => Promise.reject(new Error('no')) };
    const healthy = new Recorder();
    const composite = new CompositeEventPublisher(
      new Recorder(),
      [failing, healthy],
      () => undefined,
    );

    await composite.publishAll(EVENTS);

    await expect.poll(() => healthy.received.length).toBe(1);
  });
});
