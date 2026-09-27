import type { Response } from "express";

/** tournamentId → Map<userId, SSE Response> */
const wordWarsSSE = new Map<number, Map<number, Response>>();

export function registerSSEClient(tournamentId: number, userId: number, res: Response): void {
  if (!wordWarsSSE.has(tournamentId)) wordWarsSSE.set(tournamentId, new Map());
  wordWarsSSE.get(tournamentId)!.set(userId, res);
}

export function unregisterSSEClient(tournamentId: number, userId: number): void {
  wordWarsSSE.get(tournamentId)?.delete(userId);
  if (wordWarsSSE.get(tournamentId)?.size === 0) wordWarsSSE.delete(tournamentId);
}

export function ssePublishToUsers(
  tournamentId: number,
  userIds: number[],
  payload: Record<string, unknown>,
): void {
  const clients = wordWarsSSE.get(tournamentId);
  if (!clients || clients.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const uid of userIds) {
    const res = clients.get(uid);
    if (!res) continue;
    try {
      res.write(data);
    } catch {
      clients.delete(uid);
    }
  }
}

export function ssePublishAll(
  tournamentId: number,
  payload: Record<string, unknown>,
): void {
  const clients = wordWarsSSE.get(tournamentId);
  if (!clients || clients.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const [uid, res] of clients) {
    try {
      res.write(data);
    } catch {
      clients.delete(uid);
    }
  }
}
