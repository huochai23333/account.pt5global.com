// 只替换数据库和 Auth 边界，直接运行真实同步模块，复现旧写入晚于新写入的顺序。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../lib/admin-people-auth-metadata.ts");
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let dbRole = "salesman";
let authRole = "client";
let row = { user_id: "synthetic-user", desired_role: dbRole, desired_status: "active", sync_status: "pending", updated_at: "v1" };
let releaseFirst;
let signalFirst;
const firstEntered = new Promise((resolve) => { signalFirst = resolve; });
const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
let updates = 0;

const client = {
  from(table) {
    const query = { filters: [], values: null };
    const builder = {
      select() { return builder; },
      eq(key, value) { query.filters.push([key, value]); return builder; },
      update(values) { query.values = values; return builder; },
      single: run,
      maybeSingle: run,
      then(resolve, reject) { return run().then(resolve, reject); },
    };
    async function run() {
      if (table === "user_profiles") return { data: { status: "active" }, error: null };
      if (table === "user_roles_data") return { data: { user_roles: { role: dbRole } }, error: null };
      if (table !== "admin_auth_metadata_sync") throw new Error(`unexpected table: ${table}`);
      const matched = query.filters.every(([key, value]) => row[key] === value);
      if (query.values && matched) row = { ...row, ...query.values };
      return { data: matched ? { ...row } : null, error: null };
    }
    return builder;
  },
  auth: { admin: {
    getUserById: async () => ({ data: { user: { app_metadata: { role: authRole, status: "active" } } }, error: null }),
    updateUserById: async (_id, input) => {
      if (++updates === 1) { signalFirst(); await firstGate; }
      authRole = input.app_metadata.role;
      return { error: null };
    },
  } },
};
const dependencies = {
  "./request-timeout": { withRequestTimeout: (promise) => promise },
  "./supabase-admin-server": { getSupabaseServiceRoleClient: () => client },
};
const moduleTarget = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
  (name) => dependencies[name], moduleTarget, moduleTarget.exports,
);
// 两份模块实例各有自己的进程内锁，用同一组边界模拟两个服务器实例。
const secondModule = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })(
  (name) => dependencies[name], secondModule, secondModule.exports,
);

(async () => {
  const sync = moduleTarget.exports.syncPendingTargetAuthMetadata;
  const older = sync("synthetic-user");
  await firstEntered;
  dbRole = "manager";
  row = { ...row, desired_role: dbRole, sync_status: "pending", updated_at: "v2" };
  assert.equal(await secondModule.exports.syncPendingTargetAuthMetadata("synthetic-user"), true);
  releaseFirst();
  await older;
  // 旧写入返回后，最终 Auth 与数据库角色一致，且同步回执指向最新版本。
  assert.equal(authRole, dbRole);
  assert.equal(row.sync_status, "synced");
  assert.equal(row.updated_at, "v2");
  assert.ok(updates >= 3);
  process.stdout.write("auth metadata race repaired\n");
})().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
