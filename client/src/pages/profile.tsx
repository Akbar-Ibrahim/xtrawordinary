import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { User } from "lucide-react";
import { motion } from "framer-motion";
import { PlayerChallengeDialog } from "@/components/player-challenge-dialog";
import { useProfileData } from "./profile/useProfileData";
import { ProfileHeader } from "./profile/ProfileHeader";
import { ProfileStatCards } from "./profile/ProfileStatCards";
import { DuelRatingCard } from "./profile/DuelRatingCard";
import { GuildWarsCard } from "./profile/GuildWarsCard";
import { WordWarsCard } from "./profile/WordWarsCard";
import { EditProfileDialog } from "./profile/EditProfileDialog";
import { ProfileTabs } from "./profile/ProfileTabs";

const PROFILE_TABS = ["stats", "quizzes", "rankings", "achievements", "duels", "social", "settings"] as const;
type ProfileTab = typeof PROFILE_TABS[number];

function getProfileTabFromSearch(): ProfileTab {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return (PROFILE_TABS as readonly string[]).includes(tab ?? "") ? (tab as ProfileTab) : "stats";
}

export default function Profile() {
  const [, params] = useRoute("/profile/:id");
  const userId = parseInt(params?.id || "0");
  const [location] = useLocation();

  const [activeTab, setActiveTab] = useState<ProfileTab>(getProfileTabFromSearch);

  useEffect(() => {
    setActiveTab(getProfileTabFromSearch());
  }, [location]);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playerChallengeOpen, setPlayerChallengeOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deleteQuizCode, setDeleteQuizCode] = useState<string | null>(null);

  const {
    profile, isLoading, isOwnProfile, isAuthenticated,
    gameMap, formatGameName,
    friendship, sendRequest, downgradePremium, updateProfile, deleteAccount, deleteQuiz,
    duelRating, hasDuelActivity, duelRank, totalDuelPlayers,
    championships, wordWarsStats, guildWarsChampionships,
    ownStreak, ownDailyStreak, viewedStreak,
    duelHistory, duelHistoryLoading,
    quizzes, quizzesLoading,
    myFriends, friendsLoading, myGroups,
    unlockedIds, achievementPoints, maxPoints,
    localStats, localStreak, localDuelStats,
  } = useProfileData(userId);

  function copyQuizLink(shareCode: string) {
    navigator.clipboard.writeText(`${window.location.origin}/quiz/${shareCode}`);
    setCopiedCode(shareCode);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl text-center">
        <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold">Profile not found</h1>
      </div>
    );
  }

  const totalGames = profile.stats.reduce((sum, s) => sum + s.gamesPlayed, 0);
  const totalWins = profile.stats.reduce((sum, s) => sum + s.gamesWon, 0);
  const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <ProfileHeader
          profile={profile}
          isOwnProfile={isOwnProfile}
          isAuthenticated={isAuthenticated}
          championships={championships}
          guildWarsChampionships={guildWarsChampionships}
          friendship={friendship}
          sendRequestPending={sendRequest.isPending}
          onSendFriendRequest={() => sendRequest.mutate()}
          downgradePremiumPending={downgradePremium.isPending}
          onDowngradePremium={() => downgradePremium.mutate()}
          onOpenEdit={() => setEditOpen(true)}
          onOpenChallenge={() => setPlayerChallengeOpen(true)}
        />

        <ProfileStatCards
          totalGames={totalGames}
          winRate={winRate}
          achievementPoints={achievementPoints}
          rankingsCount={profile.leaderboardRankings.length}
        />

        <DuelRatingCard duelRating={duelRating} hasDuelActivity={hasDuelActivity} duelRank={duelRank} totalDuelPlayers={totalDuelPlayers} />
        <GuildWarsCard guildWarsChampionships={guildWarsChampionships} />
        <WordWarsCard wordWarsStats={wordWarsStats} championships={championships} />

        <ProfileTabs
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab as ProfileTab)}
          isOwnProfile={isOwnProfile}
          profileName={profile.user.name}
          stats={profile.stats}
          rankings={profile.leaderboardRankings}
          formatGameName={formatGameName}
          gameMap={gameMap}
          ownStreak={ownStreak}
          ownDailyStreak={ownDailyStreak}
          viewedStreak={viewedStreak}
          isAuthenticated={isAuthenticated}
          quizzes={quizzes}
          quizzesLoading={quizzesLoading}
          copiedCode={copiedCode}
          onCopyLink={copyQuizLink}
          onDeleteQuizClick={setDeleteQuizCode}
          unlockedIds={unlockedIds}
          achievementPoints={achievementPoints}
          maxPoints={maxPoints}
          localStats={localStats}
          localStreak={localStreak}
          localDuelStats={localDuelStats}
          duelHistory={duelHistory}
          duelHistoryLoading={duelHistoryLoading}
          myFriends={myFriends}
          myGroups={myGroups}
          friendsLoading={friendsLoading}
          onDeleteAccount={() => setDeleteDialogOpen(true)}
        />
      </motion.div>

      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profileUser={{ name: profile.user.name, avatarUrl: profile.user.avatarUrl, bio: (profile.user as any).bio ?? null }}
        onSave={(data) => updateProfile.mutate(data, { onSuccess: () => setEditOpen(false) })}
        isPending={updateProfile.isPending}
      />

      {isAuthenticated && !isOwnProfile && (
        <PlayerChallengeDialog targetUser={profile.user} open={playerChallengeOpen} onOpenChange={setPlayerChallengeOpen} />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-account">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove your account, stats, achievements, and all associated data. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-account">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAccount.mutate()} disabled={deleteAccount.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-account">
              {deleteAccount.isPending ? "Deleting…" : "Delete Forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteQuizCode} onOpenChange={(open) => { if (!open) setDeleteQuizCode(null); }}>
        <AlertDialogContent data-testid="dialog-delete-quiz">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the quiz and all submitted scores. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-quiz">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteQuizCode && deleteQuiz.mutate(deleteQuizCode, { onSuccess: () => setDeleteQuizCode(null) })} disabled={deleteQuiz.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete-quiz">
              {deleteQuiz.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
