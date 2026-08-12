import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { DeckNotFoundError } from '../../application/use-cases/DeckNotFoundError.js';
import { GameNotFoundError } from '../../application/use-cases/GameNotFoundError.js';
import { TeamNotFoundError } from '../../application/use-cases/TeamNotFoundError.js';
import { DomainError } from '../../domain/shared/DomainError.js';

const NOT_FOUND_ERRORS = [GameNotFoundError, TeamNotFoundError, DeckNotFoundError];

/**
 * Un `DomainError` es una regla de negocio incumplida (422); un `*NotFoundError` es un id (o,
 * para `TeamNotFoundError`, un token) que no resuelve (404); un `ZodError` es un payload que no
 * cumple el contrato de borde (400). Cualquier otra cosa se relanza para que el manejador por
 * defecto de Fastify la loguee y devuelva 500 — eso no es un fallo esperado del dominio, es un bug.
 */
export function sendError(reply: FastifyReply, error: unknown): void {
  if (error instanceof ZodError) {
    reply.code(400).send({ error: 'ValidationError', message: error.message });
    return;
  }
  if (NOT_FOUND_ERRORS.some((errorClass) => error instanceof errorClass)) {
    const notFound = error as Error;
    reply.code(404).send({ error: notFound.name, message: notFound.message });
    return;
  }
  if (error instanceof DomainError) {
    reply.code(422).send({ error: error.name, message: error.message });
    return;
  }
  throw error;
}
