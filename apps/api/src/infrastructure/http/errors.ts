import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { GameNotFoundError } from '../../application/use-cases/GameNotFoundError.js';
import { DomainError } from '../../domain/shared/DomainError.js';

/**
 * Un `DomainError` es una regla de negocio incumplida (422); un `GameNotFoundError` es un id que
 * no existe (404); un `ZodError` es un payload que no cumple el contrato de borde (400). Cualquier
 * otra cosa se relanza para que el manejador por defecto de Fastify la loguee y devuelva 500 —
 * eso no es un fallo esperado del dominio, es un bug.
 */
export function sendError(reply: FastifyReply, error: unknown): void {
  if (error instanceof ZodError) {
    reply.code(400).send({ error: 'ValidationError', message: error.message });
    return;
  }
  if (error instanceof GameNotFoundError) {
    reply.code(404).send({ error: error.name, message: error.message });
    return;
  }
  if (error instanceof DomainError) {
    reply.code(422).send({ error: error.name, message: error.message });
    return;
  }
  throw error;
}
