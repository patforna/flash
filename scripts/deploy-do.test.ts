import { expect, test } from "bun:test";
import { join } from "node:path";

// Only what runs without DigitalOcean: never call the script with a subcommand here, as up, cards, logs and down reach
// the droplet, its DNS record or rsync.
// To do:
// [x] with no argument it prints usage naming every subcommand and exits non-zero, with or without .env.deploy
// [x] bash parses it
// [x] shellcheck finds nothing

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

test("without .env.deploy it says what to set and exits non-zero, before any subcommand", () => {
  const { exitCode, err } = run(["env", "-u", "DOMAIN", "-u", "SSH_KEY", "DEPLOY_ENV=/nonexistent", script, "link"]);
  expect(exitCode).not.toBe(0);
  expect(err).toMatch(/DOMAIN|SSH_KEY/);
});

test("bash parses it", () => {
  expect(run(["bash", "-n", script])).toEqual({ exitCode: 0, out: "", err: "" });
});

test("shellcheck finds nothing", () => {
  expect(run(["shellcheck", script])).toEqual({ exitCode: 0, out: "", err: "" });
});
