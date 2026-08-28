import crypto from "crypto";
import type { Request, Response } from "express";

const VISITOR_COOKIE = "xw_analytics_visitor";
const SESSION_COOKIE = "xw_analytics_session";
const VISITOR_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
const SESSION_MAX_AGE_SECONDS = 30 * 60;

function signingSecret(): string {
  return process.env.SESSION_SECRET?.trim() || "wordplay-dev-secret";
}

function signature(id: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(id).digest("base64url");
}

function signId(id: string): string {
  return `${id}.${signature(id)}`;
}

function verifySignedId(value: string | undefined): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const id = value.slice(0, separator);
  const supplied = value.slice(separator + 1);
  const expected = signature(id);
  if (supplied.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)) ? id : null;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value.join("="));
    } catch {
      // Ignore malformed client-controlled cookie values.
    }
  }
  return cookies;
}

function cookieHeader(name: string, value: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export interface AnalyticsIdentity {
  visitorId: string;
  sessionId: string;
}

export function getExistingAnalyticsIdentity(req: Request): AnalyticsIdentity | null {
  const cookies = parseCookies(req);
  const visitorId = verifySignedId(cookies[VISITOR_COOKIE]);
  const sessionId = verifySignedId(cookies[SESSION_COOKIE]);
  return visitorId && sessionId ? { visitorId, sessionId } : null;
}

export function getOrCreateAnalyticsIdentity(req: Request, res: Response): AnalyticsIdentity {
  const cookies = parseCookies(req);
  const visitorId = verifySignedId(cookies[VISITOR_COOKIE]) ?? crypto.randomUUID();
  const sessionId = verifySignedId(cookies[SESSION_COOKIE]) ?? crypto.randomUUID();
  res.append("Set-Cookie", cookieHeader(VISITOR_COOKIE, signId(visitorId), VISITOR_MAX_AGE_SECONDS));
  res.append("Set-Cookie", cookieHeader(SESSION_COOKIE, signId(sessionId), SESSION_MAX_AGE_SECONDS));
  return { visitorId, sessionId };
}

export function namespacedDedupeKey(sessionId: string, clientKey: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(`${sessionId}:${clientKey}`).digest("hex");
}