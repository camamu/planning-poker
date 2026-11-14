import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import './zodConfig.js';

describe('configuración de zod para el navegador', () => {
  it('desactiva la compilación de validadores con new Function, que la CSP no permite', () => {
    expect(z.config().jitless).toBe(true);
  });
});
