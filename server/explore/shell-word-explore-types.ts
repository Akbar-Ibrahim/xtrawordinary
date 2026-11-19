import type {
  ShellWordExploreBrowseInput,
  ShellWordExploreCheck,
  ShellWordExploreCheckInput,
  ShellWordExplorePage,
} from "@shared/shell-word-explore";

export interface ShellWordExploreSource {
  search(
    input: ShellWordExploreBrowseInput,
    limit: number,
    cursor?: string,
  ): Promise<ShellWordExplorePage>;
  check(input: ShellWordExploreCheckInput): Promise<ShellWordExploreCheck>;
}
