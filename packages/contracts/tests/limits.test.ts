import { describe, expect, it } from 'vitest';
import {
  MAX_CARD_LENGTH,
  MAX_CARDS_PER_DECK,
  MAX_COUNTDOWN_SECONDS,
  MAX_DECK_NAME_LENGTH,
  MAX_EMOJI_LENGTH,
  MAX_GAME_NAME_LENGTH,
  MAX_ID_LENGTH,
  MAX_IMPORTED_ISSUES,
  MAX_ISSUE_DESCRIPTION_LENGTH,
  MAX_ISSUE_TITLE_LENGTH,
  MAX_NAMED_REVEALERS,
  MAX_PLAYER_NAME_LENGTH,
  MAX_REORDERED_ISSUES,
  MAX_TEAM_NAME_LENGTH,
  MAX_TIMER_SECONDS,
  MAX_URL_LENGTH,
  addIssueCommandSchema,
  addWebhookCommandSchema,
  createGameCommandSchema,
  createTeamCommandSchema,
  editIssueCommandSchema,
  importIssuesCommandSchema,
  joinGameCommandSchema,
  reorderIssuesCommandSchema,
  saveCustomDeckCommandSchema,
  wsDiscussionTimerControlCommandSchema,
  wsEmojiThrownCommandSchema,
  wsVoteCommandSchema,
} from '../src/index.js';

const repeat = (length: number): string => 'a'.repeat(length);

const validGame = {
  name: 'Sprint 42',
  deckId: 'fibonacci',
  facilitatorName: 'Ana',
  settings: { autoReveal: true, whoCanReveal: 'ANYONE' as const },
};

describe('límites de tamaño en el borde (ADR 0031)', () => {
  it('rechaza un nombre de participante de más de MAX_PLAYER_NAME_LENGTH caracteres', () => {
    const join = { role: 'VOTER' as const };
    expect(
      joinGameCommandSchema.safeParse({ ...join, displayName: repeat(MAX_PLAYER_NAME_LENGTH) })
        .success,
    ).toBe(true);
    expect(
      joinGameCommandSchema.safeParse({ ...join, displayName: repeat(MAX_PLAYER_NAME_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it('mide el nombre ya recortado: los espacios sobrantes no cuentan', () => {
    const padded = `  ${repeat(MAX_PLAYER_NAME_LENGTH)}  `;
    expect(joinGameCommandSchema.safeParse({ displayName: padded, role: 'VOTER' }).success).toBe(
      true,
    );
  });

  it('rechaza el nombre del facilitador y de la partida por encima de su tope', () => {
    expect(
      createGameCommandSchema.safeParse({
        ...validGame,
        facilitatorName: repeat(MAX_PLAYER_NAME_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      createGameCommandSchema.safeParse({ ...validGame, name: repeat(MAX_GAME_NAME_LENGTH + 1) })
        .success,
    ).toBe(false);
    expect(createGameCommandSchema.safeParse(validGame).success).toBe(true);
  });

  it('rechaza un identificador de más de MAX_ID_LENGTH caracteres', () => {
    const vote = { gameId: 'g', participantId: 'p', card: '5' };
    expect(wsVoteCommandSchema.safeParse(vote).success).toBe(true);
    expect(
      wsVoteCommandSchema.safeParse({ ...vote, gameId: repeat(MAX_ID_LENGTH + 1) }).success,
    ).toBe(false);
    expect(
      wsVoteCommandSchema.safeParse({ ...vote, participantId: repeat(MAX_ID_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it('rechaza una carta de más de MAX_CARD_LENGTH caracteres al votar', () => {
    const vote = { gameId: 'g', participantId: 'p' };
    expect(wsVoteCommandSchema.safeParse({ ...vote, card: repeat(MAX_CARD_LENGTH) }).success).toBe(
      true,
    );
    expect(
      wsVoteCommandSchema.safeParse({ ...vote, card: repeat(MAX_CARD_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it('rechaza un título de tarea de más de MAX_ISSUE_TITLE_LENGTH caracteres', () => {
    expect(addIssueCommandSchema.safeParse({ title: repeat(MAX_ISSUE_TITLE_LENGTH) }).success).toBe(
      true,
    );
    expect(
      addIssueCommandSchema.safeParse({ title: repeat(MAX_ISSUE_TITLE_LENGTH + 1) }).success,
    ).toBe(false);
    expect(
      editIssueCommandSchema.safeParse({
        participantId: 'p',
        title: repeat(MAX_ISSUE_TITLE_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('rechaza una descripción de tarea de más de MAX_ISSUE_DESCRIPTION_LENGTH caracteres', () => {
    const issue = { title: 'Login' };
    expect(
      addIssueCommandSchema.safeParse({
        ...issue,
        description: repeat(MAX_ISSUE_DESCRIPTION_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      addIssueCommandSchema.safeParse({
        ...issue,
        description: repeat(MAX_ISSUE_DESCRIPTION_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('rechaza un enlace de tarea de más de MAX_URL_LENGTH caracteres', () => {
    const path = repeat(MAX_URL_LENGTH);
    expect(
      addIssueCommandSchema.safeParse({ title: 'x', externalUrl: `https://acme.test/${path}` })
        .success,
    ).toBe(false);
    expect(
      addIssueCommandSchema.safeParse({ title: 'x', externalUrl: 'https://acme.test/ABC-1' })
        .success,
    ).toBe(true);
  });

  it('rechaza una URL de webhook de más de MAX_URL_LENGTH caracteres', () => {
    expect(
      addWebhookCommandSchema.safeParse({
        url: `https://hooks.acme.test/${repeat(MAX_URL_LENGTH)}`,
        events: ['issue.estimated'],
      }).success,
    ).toBe(false);
  });

  it('rechaza un nombre de equipo o de baraja por encima de su tope', () => {
    expect(
      createTeamCommandSchema.safeParse({ name: repeat(MAX_TEAM_NAME_LENGTH + 1) }).success,
    ).toBe(false);
    expect(
      saveCustomDeckCommandSchema.safeParse({
        name: repeat(MAX_DECK_NAME_LENGTH + 1),
        cards: ['1'],
      }).success,
    ).toBe(false);
  });

  it('rechaza una baraja con más de MAX_CARDS_PER_DECK cartas o con una carta demasiado larga', () => {
    const cards = Array.from({ length: MAX_CARDS_PER_DECK + 1 }, (_, index) => index.toString());
    expect(saveCustomDeckCommandSchema.safeParse({ name: 'Mía', cards }).success).toBe(false);
    expect(
      saveCustomDeckCommandSchema.safeParse({
        name: 'Mía',
        cards: [repeat(MAX_CARD_LENGTH + 1)],
      }).success,
    ).toBe(false);
    expect(
      saveCustomDeckCommandSchema.safeParse({ name: 'Mía', cards: cards.slice(0, 3) }).success,
    ).toBe(true);
  });

  it('rechaza un emoji lanzado de más de MAX_EMOJI_LENGTH caracteres', () => {
    const throwEmoji = { gameId: 'g', participantId: 'p', toParticipantId: null };
    expect(wsEmojiThrownCommandSchema.safeParse({ ...throwEmoji, emoji: '🎉' }).success).toBe(true);
    expect(
      wsEmojiThrownCommandSchema.safeParse({ ...throwEmoji, emoji: repeat(MAX_EMOJI_LENGTH + 1) })
        .success,
    ).toBe(false);
  });

  it('rechaza más de MAX_NAMED_REVEALERS personas autorizadas a revelar', () => {
    const namedRevealers = Array.from(
      { length: MAX_NAMED_REVEALERS + 1 },
      (_, index) => `p${index.toString()}`,
    );
    expect(
      createGameCommandSchema.safeParse({
        ...validGame,
        settings: { ...validGame.settings, whoCanReveal: 'NAMED_LIST', namedRevealers },
      }).success,
    ).toBe(false);
  });

  it('rechaza una cuenta atrás o un tiempo de discusión de más de una hora', () => {
    expect(
      createGameCommandSchema.safeParse({
        ...validGame,
        settings: { ...validGame.settings, countdownSeconds: MAX_COUNTDOWN_SECONDS + 1 },
      }).success,
    ).toBe(false);
    const timer = {
      gameId: 'g',
      participantId: 'p',
      roundId: 'r',
      action: 'addSeconds' as const,
    };
    expect(
      wsDiscussionTimerControlCommandSchema.safeParse({ ...timer, seconds: MAX_TIMER_SECONDS })
        .success,
    ).toBe(true);
    expect(
      wsDiscussionTimerControlCommandSchema.safeParse({ ...timer, seconds: MAX_TIMER_SECONDS + 1 })
        .success,
    ).toBe(false);
  });

  it('rechaza una orden de reordenación con más de MAX_REORDERED_ISSUES ids', () => {
    const issueIds = Array.from({ length: MAX_REORDERED_ISSUES + 1 }, (_, index) =>
      index.toString(),
    );
    expect(reorderIssuesCommandSchema.safeParse({ participantId: 'p', issueIds }).success).toBe(
      false,
    );
  });

  it('cabe en 1 MiB una importación de MAX_IMPORTED_ISSUES tareas al máximo de cada campo', () => {
    const issue = {
      title: repeat(MAX_ISSUE_TITLE_LENGTH),
      description: repeat(MAX_ISSUE_DESCRIPTION_LENGTH),
      externalUrl: `https://acme.test/${repeat(MAX_URL_LENGTH - 'https://acme.test/'.length)}`,
    };
    const body = JSON.stringify({
      issues: Array.from({ length: MAX_IMPORTED_ISSUES }, () => issue),
    });
    expect(new TextEncoder().encode(body).length).toBeLessThan(1024 * 1024);
    expect(importIssuesCommandSchema.safeParse(JSON.parse(body)).success).toBe(true);
  });
});
