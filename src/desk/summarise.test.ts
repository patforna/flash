// To do:
// [x] nothing selected reads "all topics"
// [x] one or two selected are named
// [x] three or more: the first two, then how many more
import { describe, expect, test } from "vitest";
import { summarise } from "./summarise";

describe("summarise", () => {
  test("nothing selected is every topic", () => {
    expect(summarise([])).toBe("all topics");
  });

  test("names one or two", () => {
    expect(summarise(["Redis"])).toBe("Redis");
    expect(summarise(["Redis", "Postgres"])).toBe("Redis, Postgres");
  });

  test("names the first two of three or more, then counts the rest", () => {
    expect(summarise(["Redis", "Postgres", "Queues"])).toBe("Redis, Postgres and 1 more");
    expect(summarise(["Redis", "Postgres", "Queues", "Streams"])).toBe("Redis, Postgres and 2 more");
  });
});
