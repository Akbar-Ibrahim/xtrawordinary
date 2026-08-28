import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeFusionAnswer,
  switchToTappedFusionAnswer,
  switchToTypedFusionAnswer,
} from "./word-fusion-input";

const tile = { id: "0-0", letter: "N", componentIndex: 0, position: 0 };

test("typed Word Fusion input is normalized and replaces tapped tiles", () => {
  assert.equal(normalizeFusionAnswer("n-otebook!", 8), "NOTEBOOK");
  assert.deepEqual(
    switchToTypedFusionAnswer("n ot", 8),
    { typedAnswer: "NOT", selectedTiles: [] },
  );
});

test("tapping a Word Fusion tile clears typed text instead of combining answers", () => {
  assert.deepEqual(
    switchToTappedFusionAnswer(tile, [{ id: "1-0", letter: "E", componentIndex: 1, position: 0 }]),
    {
      typedAnswer: "",
      selectedTiles: [
        { id: "1-0", letter: "E", componentIndex: 1, position: 0 },
        tile,
      ],
    },
  );
});