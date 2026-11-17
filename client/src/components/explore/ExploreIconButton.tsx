import { LoaderCircle, Search } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExploreIconButtonProps extends Omit<ButtonProps, "children" | "size"> {
  label: string;
  isLoading?: boolean;
}

export function ExploreIconButton({
  label,
  isLoading = false,
  className,
  ...buttonProps
}: ExploreIconButtonProps) {
  return (
    <Button
      {...buttonProps}
      type={buttonProps.type ?? "submit"}
      size="icon"
      aria-label={label}
      aria-busy={isLoading || undefined}
      title={label}
      data-explore-icon-button=""
      className={cn("h-11 w-11 shrink-0", className)}
    >
      {isLoading ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Search aria-hidden="true" />
      )}
    </Button>
  );
}
