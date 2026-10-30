import { expect, test } from "bun:test";
import { join } from "node:path";

// Only what can run without a droplet: never call the script with a subcommand here, each one touches the droplet,
// DNS or rsync.
// To do:
// [x] with no argument it prints usage naming every subcommand and exits non-zero
// [x] bash parses it
// [ ] shellcheck finds nothing

const script = join(import.meta.dir, "deploy-do.sh");
const run = (cmd: string[]) => {
  const { exitCode, stdout, stderr } = Bun.spawnSync(cmd);
  return { exitCode, out: stdout.toString(), err: stderr.toString() };
};

test("with no argument it prints usage naming every subcommand and exits non-zero", () => {
  const { exitCode, out } = run([script]);
  for (const subcommand of ["up", "cards", "link", "logs", "down"]) {
    expect(out).toContain(`scripts/deploy-do.sh ${subcommand} `);
  }
  expect(exitCode).not.toBe(0);
});

test("bash parses it", () => {
  expect(run(["bash", "-n", script])).toEqual({ exitCode: 0, out: "", err: "" });
});
