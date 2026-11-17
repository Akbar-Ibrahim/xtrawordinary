import type {
  ShellWordExploreBrowseInput,
  ShellWordExploreCheck,
  ShellWordExploreDirection,
  ShellWordExploreItem,
  ShellWordExplorePage,
} from "@shared/shell-word-explore";

export type ExploreDirection = ShellWordExploreDirection;
export type ExploreBrowseInput = ShellWordExploreBrowseInput & { cursor?: string };
export type { ShellWordExploreCheck, ShellWordExploreItem, ShellWordExplorePage };
