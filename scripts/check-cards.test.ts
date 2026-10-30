// To do:
// [x] a valid deck: prints "ok: N cards, M topics, version V" and exits 0
// [x] --version, before or after the path, prints only the version: the one the server reports
// [x] a bad deck: prints every problem on its own line to stderr and exits 1, with --version too
// [x] an unreadable file or no path: says so and exits 1
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDeck } from "../server/deck";

const fixture = `${import.meta.dir}/../tests/fixtures/cards.toml`;
const { version } = loadDeck(await Bun.file(fixture).text());

const dir = await mkdtemp(join(tmpdir(), "flash-check-"));
afterAll(() => rm(dir, { recursive: true }));
const bad = join(dir, "bad.toml");
await writeFile(
  bad,
  'topics = ["Redis", "Edge"]\n\n[[card]]\nquestion = "Short?"\ntopics = ["Redis"]\nanswer = "# Heading"\n',
);

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

  test("lists every problem of a bad deck on stderr, one per line, and fails, with --version too", async () => {
    const failed = {
      stdout: "",
      stderr: [
        'topic "Edge" is not used by any card',
        'card 1 "short": answer has a heading (a line starting with #, or a line underlined with --- or ===)',
        "",
      ].join("\n"),
      code: 1,
    };

    expect(await check(bad)).toEqual(failed);
    expect(await check("--version", bad)).toEqual(failed);
  });

  test("says when it can't read the file, and fails", async () => {
    const missing = join(dir, "missing.toml");

    expect(await check(missing)).toEqual({ stdout: "", stderr: `can't read ${missing} (ENOENT)\n`, code: 1 });
    expect(await check(dir)).toEqual({ stdout: "", stderr: `can't read ${dir} (EISDIR)\n`, code: 1 });
  });

  test("shows its usage without exactly one path, and fails", async () => {
    const usage = { stdout: "", stderr: "usage: bun scripts/check-cards.ts [--version] <file>\n", code: 1 };

    expect(await check("--version")).toEqual(usage);
    expect(await check(fixture, fixture)).toEqual(usage);
  });
});
