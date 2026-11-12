import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const root = path.resolve(import.meta.dirname, "../..");
const envFile = path.join(root, ".env.development.local");
const probeDir = path.join(root, "app/api/learning-assessment-probe");
const probeFile = path.join(probeDir, "route.ts");
const mockUrl = "http://127.0.0.1:38481";
const mockKey = "pt5-learning-assessment";
const envContents = `DEEPSEEK_BASE_URL=${mockUrl}\nDEEPSEEK_API_KEY=${mockKey}\n`;
const probeContents = `// 只证明本地模拟配置是否生效，不读取或返回任何原有凭证。\nexport function GET() { return Response.json({ localMock: process.env.DEEPSEEK_BASE_URL === "${mockUrl}" && process.env.DEEPSEEK_API_KEY === "${mockKey}" }); }\n`;
const require = createRequire(import.meta.url);

// 复用现有 Web 服务，通过热加载切换外部边界，恢复后再删除只返回布尔值的探针。
async function waitForMock(expected) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const response = await fetch("http://localhost:3000/api/learning-assessment-probe", {
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok && (await response.json()).localMock === expected) return;
    } catch {
      // 现有 Next 服务编译探针时可能短暂超时，按固定次数等待。
    }
    await wait(1000);
  }
  throw new Error(expected ? "现有 Web 服务未读到模拟配置。" : "现有 Web 服务未确认恢复原配置。");
}

function runPlaywright() {
  const cli = path.join(path.dirname(require.resolve("@playwright/test/package.json")), "cli.js");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      cli, "test", "--config=tests/learning/playwright.config.ts", "wholesale-order-assessment",
      "--output", `output/learning-assessment-${Date.now()}`, ...process.argv.slice(2),
    ], {
      cwd: root, env: { ...process.env, PT5_LEARNING_ASSESSMENT_MOCK: "1" },
      stdio: "inherit", windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

assert(!existsSync(envFile) && !existsSync(probeDir), "模拟配置或探针已存在，请先核对其归属。");
const health = await fetch("http://localhost:3000/login", { signal: AbortSignal.timeout(5000) });
assert(health.ok, "请先启动本项目的本地 Web 服务。");
writeFileSync(envFile, envContents, { flag: "wx" });
let createdProbeDir = false;
try {
  mkdirSync(probeDir);
  createdProbeDir = true;
  writeFileSync(probeFile, probeContents, { flag: "wx" });
  await waitForMock(true);
  process.exitCode = await runPlaywright();
} finally {
  // 文件中途有其他改动时交由维护者核对，避免误删用户配置或源码。
  assert.equal(readFileSync(envFile, "utf8"), envContents, "模拟配置内容已改变，停止清理。");
  // Windows 上仅删除开发环境文件可能不会触发 Next 热加载。先清空并读回，再删除。
  writeFileSync(envFile, "");
  if (createdProbeDir) {
    if (existsSync(probeFile)) {
      assert.equal(readFileSync(probeFile, "utf8"), probeContents, "探针内容已改变，停止清理。");
      await waitForMock(false);
      unlinkSync(probeFile);
    }
    rmdirSync(probeDir);
  }
  assert.equal(readFileSync(envFile, "utf8"), "", "空配置已被其他进程写入，停止清理。");
  unlinkSync(envFile);
  console.log("模拟配置已撤回，原 Web 服务配置已读回。");
}
