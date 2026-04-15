import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthModal } from "@/components/auth-modal";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  targetType: "game" | "comment";
  targetId: string;
  initialCount?: number;
  initialLikedByMe?: boolean;
  size?: "default" | "sm";
  className?: string;
}

export function LikeButton({
  targetType,
  targetId,
  initialCount = 0,
  initialLikedByMe = false,
  size = "default",
  className,
}: LikeButtonProps) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(initialLikedByMe);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const handleClick = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (loading) return;
    setLoading(true);
    const newLiked = !liked;
    const newCount = newLiked ? count + 1 : count - 1;
    setLiked(newLiked);
    setCount(newCount);
    try {
      const res = await apiRequest("POST", "/api/likes", { targetType, targetId });
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      setLiked(liked);
      setCount(count);
    } finally {
      setLoading(false);
    }
  };

  if (size === "sm") {
    return (
      <>
        <button
          onClick={handleClick}
          data-testid={`like-button-${targetType}-${targetId}`}
          className={cn(
            "flex items-center gap-1 text-xs transition-colors",
            liked
              ? "text-rose-500"
              : "text-muted-foreground hover:text-rose-400",
            className
          )}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
          {count > 0 && <span>{count}</span>}
        </button>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        data-testid={`like-button-${targetType}-${targetId}`}
        className={cn(
          "flex items-center gap-2 transition-colors",
          liked
            ? "border-rose-300 text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:border-rose-800 dark:hover:bg-rose-950/50"
            : "hover:border-rose-300 hover:text-rose-500",
          className
        )}
        aria-label={liked ? "Unlike" : "Like"}
      >
        <Heart className={cn("h-4 w-4", liked && "fill-current")} />
        <span>{count > 0 ? count : ""} {liked ? "Liked" : "Like"}</span>
      </Button>
      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
