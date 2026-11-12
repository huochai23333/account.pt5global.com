import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "../..");

for (const scenario of ["race", "recovery"]) {
  test(`Auth ${scenario} 用例未完成时必须返回失败`, { timeout: 15000 }, () => {
    const filename = path.join(root, `tests/unit/admin-auth-sync-${scenario}.mjs`);
    const source = readFileSync(filename, "utf8");
    // 故意卡住真实测试的首个异步屏障；只改子进程输入，不改磁盘源码和生产模块。
    assert.equal(source.split("await firstEntered;").length, 2);
    const stalled = source
      .replace("await firstEntered;", "await new Promise(() => {});")
      .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(filename).href));
    // 子进程自行报告结果，不继承父测试运行器的内部通信上下文。
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ["--test-reporter=tap", "--input-type=module"], {
      cwd: root,
      env: environment,
      input: stalled,
      encoding: "utf8",
      timeout: 12000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /test timed out after 5000ms|Promise resolution is still pending/);
    assert.doesNotMatch(result.stdout, /auth metadata (?:race repaired|recovery after readback outage repaired)/);
  });
}
