// 只读取锁文件并执行本机依赖；不连接账号、数据库、邮件或托管平台。
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { Worker } = require("node:worker_threads");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const nextRequire = createRequire(require.resolve("eslint-config-next"));
const modernRequire = createRequire(require.resolve("@typescript-eslint/typescript-estree"));

/** 官方GHSA-g3hv-75wg-m249现行范围是>=7.0.0 <11.0.1，不能把3.x强制换成不同导出形状的11.x。 */
function affectedByGlobAmplification(version) {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  assert(parts, `需要人工核对非稳定版本：${version}`);
  const [major, minor, patch] = parts.slice(1).map(Number);
  return major >= 7 && (major < 11 || (major === 11 && minor === 0 && patch < 1));
}

test("本CVE范围排除3.x，并拒绝7.x至11.0.0回退", () => {
  for (const version of ["7.0.0", "9.0.5", "10.2.6", "11.0.0"]) assert(affectedByGlobAmplification(version));
  for (const version of ["3.1.5", "6.2.3", "11.0.1", "11.0.4"]) assert(!affectedByGlobAmplification(version));
  assert.throws(() => affectedByGlobAmplification("11.0.1-preview"));
});

test("锁文件所有minimatch节点与实际安装一致，且均不落入本CVE范围", () => {
  const entries = Object.entries(lock.packages).filter(([name]) => name.endsWith("/minimatch"));
  assert(entries.length > 0);
  for (const [name, value] of entries) {
    assert(!affectedByGlobAmplification(value.version), `${name}@${value.version}需要修补`);
    const installed = JSON.parse(fs.readFileSync(path.join(root, name, "package.json"), "utf8"));
    assert.equal(installed.version, value.version, `${name}安装与锁文件不一致`);
  }
});

test("现有ESLint调用方仍取得可直接调用的3.x匹配器", () => {
  const entries = [require.resolve("eslint"), require.resolve("@eslint/config-array"), require.resolve("@eslint/eslintrc"),
    ...["eslint-plugin-import", "eslint-plugin-react", "eslint-plugin-jsx-a11y"].map(name => nextRequire.resolve(name))];
  for (const entry of entries) {
    // 从真实调用方解析，避免只检查根目录的11.x而漏掉插件的嵌套依赖。
    const consumer = createRequire(entry), matcher = consumer("minimatch");
    assert.equal(typeof matcher, "function");
    assert.equal(consumer("minimatch/package.json").version.split(".")[0], "3");
    assert(matcher("src/example.ts", "src/**/*.ts"));
    assert(!matcher("src/example.js", "src/**/*.ts"));
  }
});

test("TypeScript解析器实际取得已修补的命名匹配接口", () => {
  const matcher = modernRequire("minimatch");
  const version = modernRequire("minimatch/package.json").version;
  assert(!affectedByGlobAmplification(version));
  assert.equal(typeof matcher.minimatch, "function");
  assert(matcher.minimatch("src/example.ts", "src/**/*.ts", { optimizationLevel: 2 }));
  assert(!matcher.minimatch("src/example.js", "src/**/*.ts", { optimizationLevel: 2 }));
});

test("已修补优化器限制重复父路径的展开数量", { timeout: 6000 }, async () => {
  // 独立线程设内存及时间边界，即便依赖意外回退，也不能让安全回归拖住整个维护进程。
  const worker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    const { Minimatch } = require(workerData.entry);
    const compiled = new Minimatch(workerData.pattern, { optimizationLevel: 2, braceExpandMax: 64 });
    parentPort.postMessage({ parts: compiled.globParts.length, matched: compiled.match('file.ts') });
  `, { eval: true, workerData: { entry: modernRequire.resolve("minimatch"), pattern: "a/**/../".repeat(20) + "*.ts" },
    resourceLimits: { maxOldGenerationSizeMb: 64, stackSizeMb: 2 } });
  let timer;
  try {
    const result = await new Promise((resolve, reject) => {
      let receipt;
      worker.once("message", value => { receipt = value; });
      worker.once("error", reject);
      worker.once("exit", code => code === 0 && receipt ? resolve(receipt) : reject(new Error(`展开探针未正常结束：${code}`)));
      timer = setTimeout(() => { void worker.terminate(); reject(new Error("展开探针超过4秒")); }, 4000);
    });
    assert(result.parts > 1 && result.parts <= 64);
    assert.equal(typeof result.matched, "boolean");
  } finally {
    clearTimeout(timer);
    await worker.terminate();
  }
});
