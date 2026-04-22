import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getAvatarColor, getInitials } from "@/lib/avatar-utils";

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  "data-testid"?: string;
}

export function UserAvatar({ name, avatarUrl, className, "data-testid": testId }: UserAvatarProps) {
  const initials = getInitials(name);
  const color = getAvatarColor(name);

  return (
    <Avatar className={cn("shrink-0", className)} data-testid={testId}>
      <AvatarImage src={avatarUrl ?? undefined} alt={name} />
      <AvatarFallback className={cn("text-white font-semibold", color)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
