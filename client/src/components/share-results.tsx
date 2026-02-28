import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SiX, SiFacebook, SiLinkedin } from "react-icons/si";
import { Copy, Check, Share2 } from "lucide-react";

interface ShareResultsProps {
  gameName: string;
  gameSlug: string;
  score: number;
  wordsCompleted?: number;
  challengeName?: string;
  isWin: boolean;
  customMessage?: string;
}

export function ShareResults({
  gameName,
  gameSlug,
  score,
  wordsCompleted,
  challengeName,
  isWin,
  customMessage,
}: ShareResultsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const gameUrl = `${baseUrl}/game/${gameSlug}`;

  const resultText = isWin ? "completed" : "played";

  const shareText = customMessage || 
    `I just ${resultText} ${gameName}${challengeName ? ` - ${challengeName}` : ""} on WordPlay!\n\n` +
    `Score: ${score} points${wordsCompleted !== undefined ? `\nWords: ${wordsCompleted}` : ""}\n\n` +
    `Can you beat my score? Try it here:`;

  const fullShareText = `${shareText}\n${gameUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullShareText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Results copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
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

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `WordPlay - ${gameName}`,
          text: shareText,
          url: gameUrl,
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast({
            title: "Error",
            description: "Failed to share",
            variant: "destructive",
          });
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">Share your results</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleShareTwitter}
          className="gap-2"
          data-testid="button-share-twitter"
        >
          <SiX className="w-4 h-4" />
          <span className="hidden sm:inline">X</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShareFacebook}
          className="gap-2"
          data-testid="button-share-facebook"
        >
          <SiFacebook className="w-4 h-4" />
          <span className="hidden sm:inline">Facebook</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShareLinkedIn}
          className="gap-2"
          data-testid="button-share-linkedin"
        >
          <SiLinkedin className="w-4 h-4" />
          <span className="hidden sm:inline">LinkedIn</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className="gap-2"
          data-testid="button-copy-results"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </Button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleNativeShare}
            className="gap-2"
            data-testid="button-share-native"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        )}
      </div>
    </div>
  );
}
