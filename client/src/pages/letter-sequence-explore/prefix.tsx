import { SequenceExplorePage } from "./SequenceExplorePage";

export default function PrefixSearch() {
  return (
    <SequenceExplorePage
      config={{
        type: "prefix",
        title: "Prefix Search",
        seoTitle: "Explore Prefixes — Find Words That Start With Letters",
        seoDescription: "Search the dictionary for words that begin with a letter sequence of your choice.",
        path: "/explore/prefix-search",
        heading: "Find words from the very first letter.",
        intro: "Enter a beginning and browse dictionary words that start with that exact sequence. A simple way to follow the opening shape of a word.",
        detail: "A prefix is the sequence at the very start of a word. Results begin with your letters, in the order you entered them.",
        icon: "prefix",
      }}
    />
  );
}
