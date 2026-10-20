import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { useResultSharing } from "@/hooks/use-result-sharing";
import { ManualCopyDialog } from "@/components/manual-copy-dialog";
import { SiX, SiFacebook, SiWhatsapp, SiReddit } from "react-icons/si";
import { Copy, Check, Share2, Linkedin } from "lucide-react";

interface ShareResultsProps {
  gameName: string;
  gameSlug: string;
  score: number;
  wordsCompleted?: number;
  challengeName?: string;
  isWin: boolean;
  customMessage?: string;
  additionalDetails?: string;
  customPlay?: boolean;
}

export function ShareResults({
  gameName,
  gameSlug,
  score,
  wordsCompleted,
  challengeName,
  isWin,
  customMessage,
  additionalDetails,
  customPlay,
}: ShareResultsProps) {
  const sharing = useResultSharing({ title: "Copied!", description: "Results copied to clipboard" });

  if (customPlay) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const gameUrl = `${baseUrl}/game/${gameSlug}`;

  const resultText = isWin ? "completed" : "played";

  const baseShareText = customMessage ||
    `I just ${resultText} ${gameName}${challengeName ? ` - ${challengeName}` : ""} on xtraWordinary!\n\n` +
    `Score: ${score} points${wordsCompleted !== undefined ? `\nWords: ${wordsCompleted}` : ""}\n\n` +
    `Can you beat my score? Try it here:`;
  const shareText = additionalDetails
    ? `${baseShareText}\n\n${additionalDetails}`
    : baseShareText;

  const fullShareText = `${shareText}\n${gameUrl}`;

  const handleCopyLink = (event: MouseEvent<HTMLButtonElement>) => {
    void sharing.copy(fullShareText, event.currentTarget);
  };

  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullShareText)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(gameUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(facebookUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(gameUrl)}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareWhatsApp = () => {
    const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(fullShareText)}`;
    window.open(whatsAppUrl, "_blank", "noopener,noreferrer");
  };

  const handleShareReddit = () => {
    const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(gameUrl)}&title=${encodeURIComponent(shareText)}`;
    window.open(redditUrl, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = (event: MouseEvent<HTMLButtonElement>) => {
    void sharing.share({
      title: `xtraWordinary - ${gameName}`,
      text: shareText,
      url: gameUrl,
    }, fullShareText, event.currentTarget);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">Share your results</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          size="sm"
          onClick={handleShareTwitter}
          className="gap-2 bg-black text-white hover:bg-black/80 border-0"
          data-testid="button-share-twitter"
          disabled={sharing.isPending}
        >
          <SiX className="w-4 h-4" />
          <span className="hidden sm:inline">X</span>
        </Button>
        <Button
          size="sm"
          onClick={handleShareFacebook}
          className="gap-2 bg-[#1877F2] text-white hover:bg-[#1877F2]/80 border-0"
          data-testid="button-share-facebook"
          disabled={sharing.isPending}
        >
          <SiFacebook className="w-4 h-4" />
          <span className="hidden sm:inline">Facebook</span>
        </Button>
        <Button
          size="sm"
          onClick={handleShareLinkedIn}
          className="gap-2 bg-[#0A66C2] text-white hover:bg-[#0A66C2]/80 border-0"
          data-testid="button-share-linkedin"
          disabled={sharing.isPending}
        >
          <Linkedin className="w-4 h-4" />
          <span className="hidden sm:inline">LinkedIn</span>
        </Button>
        <Button
          size="sm"
          onClick={handleShareWhatsApp}
          className="gap-2 bg-[#25D366] text-white hover:bg-[#25D366]/80 border-0"
          data-testid="button-share-whatsapp"
          disabled={sharing.isPending}
        >
          <SiWhatsapp className="w-4 h-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </Button>
        <Button
          size="sm"
          onClick={handleShareReddit}
          className="gap-2 bg-[#FF4500] text-white hover:bg-[#FF4500]/80 border-0"
          data-testid="button-share-reddit"
          disabled={sharing.isPending}
        >
          <SiReddit className="w-4 h-4" />
          <span className="hidden sm:inline">Reddit</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="gap-2"
          data-testid="button-copy-results"
          aria-label={sharing.copied ? "Results copied" : "Copy results"}
          disabled={sharing.isPending}
          aria-busy={sharing.isPending}
        >
          {sharing.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span className="hidden sm:inline">{sharing.copied ? "Copied" : "Copy"}</span>
        </Button>
        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNativeShare}
            className="gap-2"
            data-testid="button-share-native"
            aria-label="Share results"
            disabled={sharing.isPending}
            aria-busy={sharing.isPending}
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        )}
      </div>
      <ManualCopyDialog text={sharing.manualText} onClose={sharing.closeManualCopy} restoreFocus={sharing.restoreFocus} />
    </div>
  );
}
