import { existsSync } from "node:fs";
import { link, mkdir, readdir, realpath, rm, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = await realpath(process.cwd());
const mode = process.argv[2] ?? "artifacts";
const dryRun = process.argv.includes("--dry-run");

const validModes = new Set(["artifacts", "cache", "all"]);

if (!validModes.has(mode)) {
  console.error(
    `Unknown mode "${mode}". Use one of: ${Array.from(validModes).join(", ")}.`,
  );
  process.exit(1);
}

const stats = {
  moved: 0,
  removed: 0,
  skipped: 0,
};

function logAction(action, target, detail = "") {
  const suffix = detail ? ` (${detail})` : "";
  console.log(`${action}: ${path.relative(projectRoot, target) || "."}${suffix}`);
}

async function assertInsideProject(targetPath) {
  const relative = path.relative(projectRoot, targetPath);

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative === ""
  ) {
    throw new Error(`Refusing to touch unsafe path: ${targetPath}`);
  }

  // 目标尚未建立时向上找实际存在的父目录。拒绝重定向，避免通过链接清理别处的文件。
  for (let candidate = targetPath; candidate !== projectRoot; candidate = path.dirname(candidate)) {
    let resolved;
    try {
      resolved = await realpath(candidate);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (path.relative(candidate, resolved) !== "") {
      throw new Error(`Refusing to touch unsafe resolved path: ${targetPath}`);
    }
    return;
  }
}

async function removePath(targetPath) {
  await assertInsideProject(targetPath);

  if (!existsSync(targetPath)) {
    stats.skipped += 1;
    logAction("skip", targetPath, "not found");
    return;
  }

  if (dryRun) {
    stats.removed += 1;
    logAction("remove", targetPath, "dry-run");
    return;
  }

  await rm(targetPath, { force: true, recursive: true });
  stats.removed += 1;
  logAction("remove", targetPath);
}

async function movePath(fromPath, toPath) {
  await assertInsideProject(fromPath);
  await assertInsideProject(toPath);

  if (!existsSync(fromPath)) {
    stats.skipped += 1;
    logAction("skip", fromPath, "not found");
    return;
  }

  if (existsSync(toPath)) {
    stats.skipped += 1;
    logAction("skip", fromPath, "destination already exists");
    return;
  }

  if (dryRun) {
    stats.moved += 1;
    logAction("move", fromPath, `dry-run -> ${path.relative(projectRoot, toPath)}`);
    return;
  }

  await mkdir(path.dirname(toPath), { recursive: true });
  // 建立硬链接时目标必须不存在。即使另一次运行刚写入归档，也不会覆盖已有证据。
  try {
    await link(fromPath, toPath);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    stats.skipped += 1;
    logAction("skip", fromPath, "destination already exists");
    return;
  }
  await unlink(fromPath);
  stats.moved += 1;
  logAction("move", fromPath, `-> ${path.relative(projectRoot, toPath)}`);
}

async function organizePlaywrightOutput() {
  const playwrightOutputRoot = path.join(projectRoot, "output", "playwright");
  await assertInsideProject(playwrightOutputRoot);

  if (!existsSync(playwrightOutputRoot)) {
    stats.skipped += 1;
    logAction("skip", playwrightOutputRoot, "not found");
    return;
  }

  const entries = await readdir(playwrightOutputRoot, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(playwrightOutputRoot, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === ".playwright-cli" ||
        entry.name.startsWith("workspace-session-") ||
        /^tasks-.*-url$/u.test(entry.name)
      ) {
        await removePath(entryPath);
      }

      continue;
    }

    if (entry.isFile()) {
      if (entry.name.endsWith(".log")) {
        await removePath(entryPath);
        continue;
      }

      if (entry.name.endsWith("-report.json")) {
        await movePath(
          entryPath,
          path.join(playwrightOutputRoot, "reports", entry.name),
        );
        continue;
      }

      if (entry.name.endsWith(".png")) {
        await movePath(
          entryPath,
          path.join(playwrightOutputRoot, "screenshots", "adhoc", entry.name),
        );
      }
    }
  }
}

async function main() {
  if (mode === "artifacts" || mode === "all") {
    await removePath(path.join(projectRoot, ".playwright-cli"));
    await organizePlaywrightOutput();
  }

  if (mode === "cache" || mode === "all") {
    await removePath(path.join(projectRoot, ".next"));
    await removePath(path.join(projectRoot, "tsconfig.tsbuildinfo"));
  }

  console.log(
    `Done. removed=${stats.removed} moved=${stats.moved} skipped=${stats.skipped}${dryRun ? " (dry-run)" : ""}`,
  );
}

await main();
