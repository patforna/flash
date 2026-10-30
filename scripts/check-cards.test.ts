// To do:
// [x] a valid deck: prints "ok: N cards, M topics, version V" and exits 0
// [x] --version, before or after the path, prints only the version: the one the server reports
// [ ] a bad deck: prints every problem on its own line to stderr and exits 1, with --version too
// [ ] an unreadable file or no path: says so and exits 1
import { describe, expect, test } from "bun:test";
import { loadDeck } from "../server/deck";

const fixture = `${import.meta.dir}/../tests/fixtures/cards.toml`;
const { version } = loadDeck(await Bun.file(fixture).text());

async function check(...args: string[]) {
  const proc = Bun.spawn([process.execPath, `${import.meta.dir}/check-cards.ts`, ...args], { stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

describe("check-cards", () => {
  test("passes a valid deck with its size and version", async () => {
    expect(await check(fixture)).toEqual({
      stdout: `ok: 9 cards, 7 topics, version ${version}\n`,
      stderr: "",
      code: 0,
    });
  });

  test.each([
    ["--version", fixture],
    [fixture, "--version"],
  ])("prints only the version, the one the server reports, for %s %s", async (first, second) => {
    expect(await check(first, second)).toEqual({ stdout: `${version}\n`, stderr: "", code: 0 });
  });
});
