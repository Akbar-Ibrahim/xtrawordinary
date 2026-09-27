import type { Response } from "express";

const notifClients = new Map<number, Set<Response>>();

export function registerNotifSSE(userId: number, res: Response): void {
  if (!notifClients.has(userId)) notifClients.set(userId, new Set());
  notifClients.get(userId)!.add(res);
}

export function unregisterNotifSSE(userId: number, res: Response): void {
  notifClients.get(userId)?.delete(res);
  if (notifClients.get(userId)?.size === 0) notifClients.delete(userId);
}

export function pushNotifToUser(userId: number): void {
  const clients = notifClients.get(userId);
  if (!clients || clients.size === 0) return;
  const data = `data: ${JSON.stringify({ type: "new_notification" })}\n\n`;
  for (const res of clients) {
    try {
      res.write(data);
    } catch {
      clients.delete(res);
    }
  }
}
