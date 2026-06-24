import type { Express } from "express";
import type { Server } from "http";
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

export function registerAllRoutes(httpServer: Server, app: Express): Server {
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
