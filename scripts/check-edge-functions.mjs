import fs from "node:fs";
import path from "node:path";
import { repositoryRoots } from "./learning/catalogue.mjs";
import { recordTestRun } from "./record-test-run.mjs";

// Web 的 tsc 不扫描 Deno；此检查编译真实函数入口及其依赖，不启动服务或执行请求。
const root = repositoryRoots.supabase;
const entries = [];
for (const directory of [
  "supabase/functions",
  "logistics-supabase/supabase/functions",
]) {
  for (const entry of fs.readdirSync(path.join(root, directory), {
    withFileTypes: true,
  })) {
    const file = path.join(root, directory, entry.name, "index.ts");
    if (entry.isDirectory() && fs.existsSync(file)) entries.push(file);
  }
}
const npm = process.env.npm_execpath;
if (!npm || !fs.existsSync(npm))
  throw new Error("请通过 npm run check:edge 调用，使用项目声明的 npm 版本。");
const result = await recordTestRun(
  process.execPath,
  [
    npm,
    "exec",
    "--yes",
    "--package=deno@2.9.6",
    "--",
    "deno",
    "check",
    "--no-lock",
    "--node-modules-dir=none",
    ...entries,
  ],
  {
    cwd: root,
    outputRoot: path.resolve("output/test-runs"),
  },
);
console.log(
  JSON.stringify({
    kind: "real_edge_entrypoint_typecheck",
    entries: entries.length,
    exitCode: result.exitCode,
    directory: result.directory,
  }),
);
process.exitCode = result.exitCode;
