import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { gameReportInputSchema } from "@shared/schema";
import { registerGameReportRoutes } from "./routes/game-reports.routes";
import { initStorage, storage } from "./storage";

test("game reports reject blank and oversized messages without trimming valid text", () => {
  const message = "  First paragraph\n\n  Second paragraph  ";
  assert.equal(gameReportInputSchema.parse({ gameSlug: "definition-match", message }).message, message);
  assert.equal(gameReportInputSchema.safeParse({ gameSlug: "definition-match", message: " \n  " }).success, false);
  assert.equal(gameReportInputSchema.safeParse({ gameSlug: "definition-match", message: "a".repeat(5001) }).success, false);
});

test("guest and signed-in reports stay separate from contact and are admin-only", async () => {
  await initStorage();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const role = req.header("x-test-role");
    (req as any).isAuthenticated = () => role === "player" || role === "admin";
    if (role) (req as any).user = { id: role === "admin" ? 1 : 7, isAdmin: role === "admin" };
    next();
  });
  registerGameReportRoutes(app);
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    const base = `http://127.0.0.1:${address.port}`;
    const send = (message: string, role?: string, gameSlug = "definition-match") =>
      fetch(`${base}/api/game-reports`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(role ? { "x-test-role": role } : {}) },
        body: JSON.stringify({ gameSlug, message }),
      });

    const text = "  First line\n\nSecond line  ";
    assert.equal((await send(text)).status, 201);
    assert.equal((await send("Signed-in report", "player")).status, 201);
    assert.equal((await send("   \n  ")).status, 400);
    assert.equal((await send("Invalid game", undefined, "not-a-game")).status, 404);

    const stored = await storage.getGameReports();
    assert.equal(stored.length, 2);
    assert.equal(stored[0].message, "Signed-in report");
    assert.equal(stored[1].message, text);
    assert.equal((await storage.getContactMessages()).length, 0);

    assert.equal((await fetch(`${base}/api/admin/game-reports`)).status, 403);
    assert.equal((await fetch(`${base}/api/admin/game-reports/${stored[0].id}/read`, { method: "PATCH" })).status, 403);
    const inbox = await fetch(`${base}/api/admin/game-reports`, { headers: { "x-test-role": "admin" } });
    assert.equal(inbox.status, 200);
    const reports = await inbox.json();
    assert.equal(reports[1].gameName, "Definition Match");
    const read = await fetch(`${base}/api/admin/game-reports/${reports[1].id}/read`, {
      method: "PATCH", headers: { "x-test-role": "admin" },
    });
    assert.equal(read.status, 200);
    assert.ok((await storage.getGameReports())[1].readAt);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});