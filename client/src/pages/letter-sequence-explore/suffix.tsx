import { SequenceExplorePage } from "./SequenceExplorePage";

export default function SuffixSearch() {
  return (
    <SequenceExplorePage
      config={{
        type: "suffix",
        title: "Suffix Search",
        seoTitle: "Explore Suffixes — Find Words That End With Letters",
        seoDescription: "Search dictionary words that end with a letter sequence of your choice.",
        path: "/explore/suffix-search",
        heading: "Follow a word to its final letters.",
        intro: "Choose a sequence and see dictionary words that finish with it. Explore endings, from a familiar sound to a precise final pattern.",
        detail: "A suffix sits at the end of a word. Each result ends with your exact sequence, in the order you entered it.",
        icon: "suffix",
      }}
    />
  );
}
