// To do:
// - [x] toggle adds a label that isn't selected
// - [ ] toggle removes a label that is selected, as a new set, leaving the old one alone
// - [ ] loadSelection reads the JSON array under flash:v1:topics
// - [ ] loadSelection drops unknown labels
// - [ ] loadSelection gives the empty set for nothing stored, invalid JSON or a non-array
// - [ ] loadSelection gives the empty set for a throwing storage or no storage
// - [ ] saveSelection writes the JSON array under flash:v1:topics
// - [ ] saveSelection swallows a throwing storage and does nothing without one

import { describe, expect, it } from "vitest";
import { toggle } from "./selection";

describe("toggle", () => {
  it("adds a label that isn't selected", () => {
    expect(toggle(new Set(["Redis"]), "Queues")).toEqual(new Set(["Redis", "Queues"]));
  });
});
