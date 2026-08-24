import type { Express } from "express";
import type { Server } from "http";
import { gamesData } from "../game-data";
import { SITE_BASE_URL } from "../seo";
import { registerGamesRoutes } from "./games.routes";
import { registerAuthRoutes } from "./auth.routes";
import { registerStatsRoutes } from "./stats.routes";
import { registerLeaderboardRoutes } from "./leaderboard.routes";
import { registerProfileRoutes } from "./profile.routes";
import { registerFriendsRoutes } from "./friends.routes";
import { registerChallengesRoutes } from "./challenges.routes";
import { registerGroupsRoutes } from "./groups.routes";
import { registerHuddleRoutes } from "./huddle.routes";
import { registerTeamRaceRoutes } from "./team-race.routes";
import { registerCommentsRoutes } from "./comments.routes";
import { registerQuizRoutes } from "./quiz.routes";
import { registerDuelsRoutes } from "./duels.routes";
import { registerWordWarsRoutes } from "./word-wars.routes";
import { registerGuildWarsRoutes } from "./guild-wars.routes";
import { registerAdminRoutes } from "./admin.routes";
import { registerWordExamplesRoutes } from "./word-examples.routes";
import { registerShareRoutes } from "./share.routes";

// Static pages included in the sitemap alongside game pages.
const SITEMAP_STATIC_PATHS = [
  "/",
  "/daily",
  "/leaderboard",
  "/duels",
  "/duels/leaderboard",
  "/word-wars",
  "/guild-wars",
  "/about",
  "/pricing",
  "/groups/browse",
  "/privacy",
  "/terms",
];

export function registerAllRoutes(httpServer: Server, app: Express): Server {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── /sitemap.xml ─────────────────────────────────────────────────────────
  app.get("/sitemap.xml", (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);

    const urlEntry = (path: string, priority: string, changefreq: string) =>
      [
        "  <url>",
        `    <loc>${SITE_BASE_URL}${path}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");

    const gameEntries = gamesData
      .map((g) => urlEntry(`/game/${g.slug}`, "0.9", "weekly"))
      .join("\n");

    const staticEntries = SITEMAP_STATIC_PATHS.map((p) => {
      const priority = p === "/" ? "1.0" : "0.7";
      const changefreq = p === "/daily" ? "daily" : "weekly";
      return urlEntry(p, priority, changefreq);
    }).join("\n");

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      staticEntries,
      gameEntries,
      "</urlset>",
    ].join("\n");

    res
      .status(200)
      .set({
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      })
      .end(xml);
  });

  registerShareRoutes(app);
  registerWordExamplesRoutes(app);
  registerGamesRoutes(app);
  registerAuthRoutes(app);
  registerStatsRoutes(app);
  registerLeaderboardRoutes(app);
  registerProfileRoutes(app);
  registerFriendsRoutes(app);
  registerChallengesRoutes(app);
  registerGroupsRoutes(app);
  registerHuddleRoutes(app);
  registerTeamRaceRoutes(app);
  registerCommentsRoutes(app);
  registerQuizRoutes(app);
  registerDuelsRoutes(app);
  registerWordWarsRoutes(app);
  registerGuildWarsRoutes(app);
  registerAdminRoutes(app);
  return httpServer;
}
