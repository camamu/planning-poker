import { describe, expect, it } from 'vitest';

describe('entorno de tests de casos de uso', () => {
  it('ejecuta tests sin infraestructura', () => {
    expect(1 + 1).toBe(2);
  });
});
