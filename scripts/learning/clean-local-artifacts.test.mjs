import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, rmdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../clean-local-artifacts.mjs", import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "pt5-clean-artifacts-"));
  // 每个用例只清理自己建立的临时目录，脚本运行路径也指向该夹具。
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, "project");
  const playwright = path.join(project, "output", "playwright");
  await mkdir(playwright, { recursive: true });
  return { root, project, playwright };
}

function clean(project, ...flags) {
  return execFileSync(process.execPath, [script, "artifacts", ...flags], {
    cwd: project, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
}

test("预演只报告移动，既不移动文件也不创建目标目录", async (t) => {
  const { project, playwright } = await fixture(t);
  await writeFile(path.join(playwright, "page.png"), "screenshot");
  assert.match(clean(project, "--dry-run"), /dry-run/);
  assert.deepEqual(await readdir(playwright), ["page.png"]);
});

test("保留已有同名证据与新截图", async (t) => {
  const { project, playwright } = await fixture(t);
  const archive = path.join(playwright, "screenshots", "adhoc");
  await mkdir(archive, { recursive: true });
  await writeFile(path.join(archive, "page.png"), "old screenshot");
  await writeFile(path.join(playwright, "page.png"), "new screenshot");
  assert.match(clean(project), /already exists/);
  assert.equal(await readFile(path.join(archive, "page.png"), "utf8"), "old screenshot");
  assert.equal(await readFile(path.join(playwright, "page.png"), "utf8"), "new screenshot");
});

test("拒绝通过目录链接清理项目外日志", async (t) => {
  const { root, project, playwright } = await fixture(t);
  const external = path.join(root, "external");
  await rmdir(playwright);
  await mkdir(external);
  await writeFile(path.join(external, "preserve.log"), "protected");
  await symlink(external, playwright, "junction");
  assert.throws(() => clean(project), /unsafe resolved path/);
  assert.equal(await readFile(path.join(external, "preserve.log"), "utf8"), "protected");
});

test("归档成功时文件完整且原目录不再留副本", async (t) => {
  const { project, playwright } = await fixture(t);
  await writeFile(path.join(playwright, "page.png"), "screenshot");
  assert.match(clean(project), /moved=1/);
  assert.equal(await readFile(path.join(playwright, "screenshots", "adhoc", "page.png"), "utf8"), "screenshot");
  assert.deepEqual(await readdir(playwright), ["screenshots"]);
});
