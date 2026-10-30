// To do:
// - [x] toggle adds a label that isn't selected
// - [x] toggle removes a label that is selected, as a new set, leaving the old one alone
// - [x] loadSelection reads the JSON array under flash:v1:topics
// - [x] loadSelection drops unknown labels
// - [x] loadSelection gives the empty set for nothing stored, invalid JSON or a non-array
// - [ ] loadSelection gives the empty set for a throwing storage or no storage
// - [ ] saveSelection writes the JSON array under flash:v1:topics
// - [ ] saveSelection swallows a throwing storage and does nothing without one

import { describe, expect, it } from "vitest";
import { loadSelection, toggle } from "./selection";

const known = ["Redis", "Postgres", "Queues"];
// A storage holding value under the selection's key, and nothing else.
const holding = (value: string | null): Pick<Storage, "getItem"> => ({
  getItem: (key) => (key === "flash:v1:topics" ? value : null),
});

describe("toggle", () => {
  it("adds a label that isn't selected", () => {
    expect(toggle(new Set(["Redis"]), "Queues")).toEqual(new Set(["Redis", "Queues"]));
  });

  it("removes a label that is selected, as a new set, leaving the old one alone", () => {
    const selected = new Set(["Redis", "Queues"]);
    expect(toggle(selected, "Redis")).toEqual(new Set(["Queues"]));
    expect(selected).toEqual(new Set(["Redis", "Queues"]));
  });
});

describe("loadSelection", () => {
  it("reads the JSON array under flash:v1:topics", () => {
    expect(loadSelection(holding('["Redis","Queues"]'), known)).toEqual(new Set(["Redis", "Queues"]));
  });

  it("drops unknown labels", () => {
    expect(loadSelection(holding('["Redis","Gone",7,null]'), known)).toEqual(new Set(["Redis"]));
  });

  it.each([null, "{", "null", '"Redis"', '{"Redis":true}'])("gives the empty set when it holds %j", (value) => {
    expect(loadSelection(holding(value), known)).toEqual(new Set());
  });
});
