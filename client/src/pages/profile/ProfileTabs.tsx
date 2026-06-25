import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, GraduationCap, Trophy, Award, Swords, Heart, Bell } from "lucide-react";
import type { Game } from "@shared/schema";
import type { QuizSessionWithCount, DuelHistoryEntry, FriendEntry, GroupSummary } from "./types";
import type { UserGameStats } from "@shared/schema";
import { StatsTab } from "./StatsTab";
import { QuizzesTab } from "./QuizzesTab";
import { RankingsTab } from "./RankingsTab";
import { AchievementsTab } from "./AchievementsTab";
import { DuelsTab } from "./DuelsTab";
import { SocialTab } from "./SocialTab";
import { SettingsTab } from "./SettingsTab";
import type { loadStats, loadStreak, loadDuelStats } from "@/lib/game-stats";

interface Props {
  isOwnProfile: boolean;
  profileName: string;
  stats: UserGameStats[];
  rankings: Array<{ gameSlug: string; rank: number; score: number }>;
  formatGameName: (slug: string) => string;
  gameMap: Map<string, Game>;

  ownStreak: { currentStreak: number; longestStreak: number; lastPlayedDate: string | null } | null | undefined;
  ownDailyStreak: { streak: number; longest: number } | null | undefined;
  viewedStreak: { currentStreak: number; longestStreak: number; lastPlayedDate: string | null } | null | undefined;
  isAuthenticated: boolean;

  quizzes: QuizSessionWithCount[];
  quizzesLoading: boolean;
  copiedCode: string | null;
  onCopyLink: (shareCode: string) => void;
  onDeleteQuizClick: (shareCode: string) => void;

  unlockedIds: Set<string>;
  achievementPoints: number;
  maxPoints: number;
  localStats: ReturnType<typeof loadStats> | null;
  localStreak: ReturnType<typeof loadStreak> | null;
  localDuelStats: ReturnType<typeof loadDuelStats> | null;

  duelHistory: DuelHistoryEntry[];
  duelHistoryLoading: boolean;

  myFriends: FriendEntry[];
  myGroups: GroupSummary[];
  friendsLoading: boolean;

  onDeleteAccount: () => void;
}

export function ProfileTabs({
  isOwnProfile, profileName, stats, rankings, formatGameName, gameMap,
  ownStreak, ownDailyStreak, viewedStreak, isAuthenticated,
  quizzes, quizzesLoading, copiedCode, onCopyLink, onDeleteQuizClick,
  unlockedIds, achievementPoints, maxPoints, localStats, localStreak, localDuelStats,
  duelHistory, duelHistoryLoading,
  myFriends, myGroups, friendsLoading,
  onDeleteAccount,
}: Props) {
  return (
    <Card>
      <CardContent className="pt-4">
        <Tabs defaultValue="stats">
          <div className="w-full overflow-x-auto">
            <TabsList className="flex w-max min-w-full h-auto" data-testid="tabs-profile-sections">
              <TabsTrigger value="stats" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-game-stats">
                <Gamepad2 className="h-4 w-4" /><span className="hidden sm:inline">Game Stats</span>
              </TabsTrigger>
              <TabsTrigger value="quizzes" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-my-quizzes">
                <GraduationCap className="h-4 w-4" /><span className="hidden sm:inline">{isOwnProfile ? "My Quizzes" : "Quizzes"}</span>
                {quizzes.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{quizzes.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="rankings" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-rankings">
                <Trophy className="h-4 w-4" /><span className="hidden sm:inline">Rankings</span>
              </TabsTrigger>
              <TabsTrigger value="achievements" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-achievements">
                <Award className="h-4 w-4" /><span className="hidden sm:inline">Achievements</span>
                {achievementPoints > 0 && <Badge variant="secondary" className="ml-1 text-xs">{achievementPoints}pts</Badge>}
              </TabsTrigger>
              <TabsTrigger value="duels" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-duels">
                <Swords className="h-4 w-4" /><span className="hidden sm:inline">Duels</span>
                {duelHistory.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{duelHistory.length}</Badge>}
              </TabsTrigger>
              {isOwnProfile && (
                <TabsTrigger value="social" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-social">
                  <Heart className="h-4 w-4" /><span className="hidden sm:inline">Social</span>
                  {(myFriends.length + myGroups.length) > 0 && <Badge variant="secondary" className="ml-1 text-xs">{myFriends.length + myGroups.length}</Badge>}
                </TabsTrigger>
              )}
              {isOwnProfile && (
                <TabsTrigger value="settings" className="flex items-center gap-1.5 flex-shrink-0" data-testid="tab-settings">
                  <Bell className="h-4 w-4" /><span className="hidden sm:inline">Settings</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          <TabsContent value="stats" className="mt-4">
            <StatsTab profileName={profileName} stats={stats} isOwnProfile={isOwnProfile} isAuthenticated={isAuthenticated} ownStreak={ownStreak} ownDailyStreak={ownDailyStreak} viewedStreak={viewedStreak} formatGameName={formatGameName} />
          </TabsContent>
          <TabsContent value="quizzes" className="mt-4">
            <QuizzesTab isOwnProfile={isOwnProfile} quizzesLoading={quizzesLoading} quizzes={quizzes} gameMap={gameMap} copiedCode={copiedCode} onCopyLink={onCopyLink} onDeleteClick={onDeleteQuizClick} />
          </TabsContent>
          <TabsContent value="rankings" className="mt-4">
            <RankingsTab rankings={rankings} formatGameName={formatGameName} />
          </TabsContent>
          <TabsContent value="achievements" className="mt-4">
            <AchievementsTab unlockedIds={unlockedIds} achievementPoints={achievementPoints} maxPoints={maxPoints} isOwnProfile={isOwnProfile} localStats={localStats} localStreak={localStreak} localDuelStats={localDuelStats} />
          </TabsContent>
          <TabsContent value="duels" className="mt-4">
            <DuelsTab duelHistoryLoading={duelHistoryLoading} duelHistory={duelHistory} formatGameName={formatGameName} />
          </TabsContent>
          {isOwnProfile && (
            <TabsContent value="social" className="mt-4">
              <SocialTab myFriends={myFriends} myGroups={myGroups} friendsLoading={friendsLoading} />
            </TabsContent>
          )}
          {isOwnProfile && (
            <TabsContent value="settings" className="mt-4">
              <SettingsTab onDeleteAccount={onDeleteAccount} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
