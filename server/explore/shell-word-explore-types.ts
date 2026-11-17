import type {
  ShellWordExploreBrowseInput,
  ShellWordExploreCheck,
  ShellWordExploreDirection,
  ShellWordExplorePage,
} from "@shared/shell-word-explore";

export interface ShellWordExploreSource {
  search(
    input: ShellWordExploreBrowseInput,
    limit: number,
    cursor?: string,
  ): Promise<ShellWordExplorePage>;
  check(input: {
    direction: ShellWordExploreDirection;
    word: string;
  }): Promise<ShellWordExploreCheck>;
}
