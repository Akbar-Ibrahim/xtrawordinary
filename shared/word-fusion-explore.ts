export const WORD_FUSION_EXPLORE_MIN_COMPONENTS = 2;
export const WORD_FUSION_EXPLORE_MAX_COMPONENTS = 8;
export const WORD_FUSION_EXPLORE_MIN_WORD_LENGTH = 2;
export const WORD_FUSION_EXPLORE_MAX_COMPONENT_LENGTH = 40;

export interface WordFusionExploreItem {
  word: string;
}

export interface WordFusionExplorePage {
  components: string[];
  items: WordFusionExploreItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
  source: "preview" | "database";
}
