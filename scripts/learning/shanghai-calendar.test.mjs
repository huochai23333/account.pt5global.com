import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const source = pathToFileURL(path.resolve("tests/test-support/shanghai-calendar.ts")).href;

for (const timeZone of ["Asia/Shanghai", "UTC", "America/Los_Angeles"]) {
  test(`上海月界与跨年不受宿主时区 ${timeZone} 影响`, () => {
    // 子进程只加载纯日历模块，完全不进入账号或管理员辅助入口。
    const child = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `
      import {shanghaiDate,nextShanghaiDayLocal,nextShanghaiMonthStartLocal} from ${JSON.stringify(source)};
      const dates=['2026-02-28T16:30:00Z','2026-12-31T16:00:00Z','2024-02-28T16:00:00Z'];
      console.log(JSON.stringify(dates.map(value=>{
        const now=new Date(value);
        return [shanghaiDate(now),nextShanghaiMonthStartLocal(now),nextShanghaiDayLocal(now)];
      })));
    `], { env: { ...process.env, TZ: timeZone }, encoding: "utf8", windowsHide: true });
    assert.equal(child.status, 0, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), [
      ["2026-03-01", "2026-04-01T00:00", "2026-03-02T00:30"],
      ["2027-01-01", "2027-02-01T00:00", "2027-01-02T00:00"],
      ["2024-02-29", "2024-03-01T00:00", "2024-03-01T00:00"],
    ]);
  });
}
