import {
  LetterPoolSession,
  type LetterPoolSessionProps,
} from "./letter-pool";

type LetterPoolWithoutPoolPrototypeProps = Omit<
  LetterPoolSessionProps,
  "initialChallenge"
>;

// Dormant prototype; intentionally not registered in the game catalogue or routes.
export function LetterPoolWithoutPoolPrototype(
  props: LetterPoolWithoutPoolPrototypeProps,
) {
  return <LetterPoolSession {...props} initialChallenge="without-pool" />;
}
