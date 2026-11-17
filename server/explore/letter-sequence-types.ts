import type {
  LetterSequenceExplorePage,
  LetterSequenceType,
} from "@shared/letter-sequence-explore";

export type { LetterSequenceExplorePage, LetterSequenceType };

export interface LetterSequenceExploreSource {
  search(
    type: LetterSequenceType,
    sequence: string,
    limit: number,
    cursor?: string,
    length?: number | null,
  ): Promise<LetterSequenceExplorePage>;
}
