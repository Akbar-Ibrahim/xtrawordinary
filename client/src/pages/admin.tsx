import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Trophy, BarChart3, Gamepad2, MessageSquare, Swords } from "lucide-react";
import { motion } from "framer-motion";
import { OverviewTab } from "./admin/OverviewTab";
import { UsersTab } from "./admin/UsersTab";
import { LeaderboardTab } from "./admin/LeaderboardTab";
import { GamesTab } from "./admin/GamesTab";
import { CommentsTab } from "./admin/CommentsTab";
import { GroupsTab } from "./admin/GroupsTab";
import { GuildWarsTab } from "./admin/GuildWarsTab";
import { WordWarsTab } from "./admin/WordWarsTab";
import { SiteTab } from "./admin/SiteTab";

export default function Admin() {
  const { user, isAuthenticated } = useAuth();
  const [gameFilter, setGameFilter] = useState("all");

  if (!isAuthenticated || !user?.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16 text-center" data-testid="admin-access-denied">
        <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground">You need admin privileges to view this page.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-6 flex items-center gap-2" data-testid="text-admin-title">
          <Shield className="h-8 w-8" /> Admin Dashboard
        </h1>
        <Tabs defaultValue="overview" data-testid="admin-tabs">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview" data-testid="tab-overview"><BarChart3 className="h-4 w-4 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
            <TabsTrigger value="leaderboard" data-testid="tab-leaderboard"><Trophy className="h-4 w-4 mr-1" />Leaderboard</TabsTrigger>
            <TabsTrigger value="groups" data-testid="tab-groups"><Users className="h-4 w-4 mr-1" />Groups</TabsTrigger>
            <TabsTrigger value="games" data-testid="tab-games"><Gamepad2 className="h-4 w-4 mr-1" />Games</TabsTrigger>
            <TabsTrigger value="comments" data-testid="tab-comments"><MessageSquare className="h-4 w-4 mr-1" />Comments</TabsTrigger>
            <TabsTrigger value="word-wars" data-testid="tab-word-wars"><Swords className="h-4 w-4 mr-1" />Word Wars</TabsTrigger>
            <TabsTrigger value="guild-wars" data-testid="tab-guild-wars"><Swords className="h-4 w-4 mr-1" />Guild Wars</TabsTrigger>
            <TabsTrigger value="site" data-testid="tab-site"><Shield className="h-4 w-4 mr-1" />Site</TabsTrigger>
          </TabsList>
          <TabsContent value="overview"><OverviewTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="leaderboard"><LeaderboardTab gameFilter={gameFilter} setGameFilter={setGameFilter} /></TabsContent>
          <TabsContent value="groups"><GroupsTab /></TabsContent>
          <TabsContent value="games"><GamesTab /></TabsContent>
          <TabsContent value="comments"><CommentsTab /></TabsContent>
          <TabsContent value="word-wars"><WordWarsTab /></TabsContent>
          <TabsContent value="guild-wars"><GuildWarsTab /></TabsContent>
          <TabsContent value="site"><SiteTab /></TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
