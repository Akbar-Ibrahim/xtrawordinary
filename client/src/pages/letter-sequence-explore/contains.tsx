import { SequenceExplorePage } from "./SequenceExplorePage";

export default function ContainsSearch() {
  return (
    <SequenceExplorePage
      config={{
        type: "contains",
        title: "Contains Search",
        seoTitle: "Explore Words Containing a Letter Sequence",
        seoDescription: "Find dictionary words with a chosen letter sequence strictly inside the word, not at either end.",
        path: "/explore/contains-search",
        heading: "Look for letters tucked inside a word.",
        intro: "Search for a sequence that sits within a word. This tool only shows matches with at least one letter before and after your sequence.",
        detail: "A match must be strictly internal: the sequence cannot start or finish the word. For example, searching “art” won’t include a word that begins with “art” or ends with “art”.",
        icon: "contains",
      }}
    />
  );
}
