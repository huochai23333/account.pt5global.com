/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function fixture() {
  const tables = {
    mail_agent_profiles: [
      { user_id: "admin", enabled: true, alias_local_part: "admin", ref_prefix: "ADMIN" },
      { user_id: "salesman", enabled: true, alias_local_part: "sales", ref_prefix: "SALES" },
      { user_id: "inactive", enabled: true, alias_local_part: "inactive", ref_prefix: "INACTIVE" },
      { user_id: "disabled", enabled: false, alias_local_part: "disabled", ref_prefix: "DISABLED" },
    ],
    user_roles: [{ id: "admin-role", role: "administrator" }, { id: "sales-role", role: "salesman" }],
    user_roles_data: [
      { user_id: "admin", role_id: "admin-role" }, { user_id: "salesman", role_id: "sales-role" },
      { user_id: "inactive", role_id: "sales-role" }, { user_id: "disabled", role_id: "sales-role" },
    ],
    user_profiles: [
      { user_id: "admin", name: "Administrator", status: "active" },
      { user_id: "salesman", name: "Salesperson", status: "active" },
      { user_id: "inactive", name: "Inactive", status: "inactive" },
      { user_id: "disabled", name: "Disabled sender", status: "active" },
    ],
  };
  const failedTables = new Set();
  const client = {
    from(table) {
      assert(Object.hasOwn(tables, table), "未声明的名单数据来源");
      let rows = tables[table].slice();
      const query = {
        select() { return query; },
        eq(key, value) { rows = rows.filter(row => row[key] === value); return query; },
        in(key, values) { rows = rows.filter(row => values.includes(row[key])); return query; },
        then(resolve, reject) {
          return Promise.resolve(failedTables.has(table)
            ? { data: null, error: new Error("local directory unavailable") }
            : { data: rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const source = fs.readFileSync(path.join(__dirname, "../lib/mail", name + ".ts"), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    const boundaries = {
      "server-only": {},
      "node:crypto": require("node:crypto"),
      "@/lib/supabase-admin-server": { getSupabaseServiceRoleClient: () => client },
      "./mail-thread-access": { databaseError(message, cause) { throw new Error(message, { cause }); } },
    };
    vm.runInNewContext(compiled, { exports, Map, require(dependency) {
      if (dependency === "./mail-agent-directory") return load("mail-agent-directory");
      assert(Object.hasOwn(boundaries, dependency), "未声明的名单模块依赖");
      return boundaries[dependency];
    } }, { timeout: 2000 });
    cache.set(name, exports);
    return exports;
  }
  return { tables, failedTables, routing: load("mail-routing-service"), directory: load("mail-agent-directory") };
}

test("入站候选与负责人目录遵循同一业务员岗位边界", async () => {
  const { routing, directory } = fixture();
  const candidates = await routing.loadMailRoutingAgents();
  const assignable = await directory.listAssignableMailAgents({ userId: "local-admin" });
  assert.deepEqual(Array.from(candidates, agent => agent.memberId), ["salesman"]);
  assert.deepEqual(Array.from(assignable.agents, agent => agent.memberId), ["disabled", "salesman"]);
  assert.equal(candidates[0].displayName, "Salesperson");
});
test("岗位撤回后旧发件配置不能继续接收分配", async () => {
  const f = fixture();
  f.tables.user_roles_data.find(row => row.user_id === "salesman").role_id = "admin-role";
  assert.equal((await f.routing.loadMailRoutingAgents()).length, 0);
});
test("名单查询失败必须拒绝，不能退回已缓存的发件配置", async () => {
  const f = fixture();
  f.failedTables.add("user_profiles");
  await assert.rejects(() => f.routing.loadMailRoutingAgents(), error =>
    error.message.includes("暂时无法读取") && error.cause?.message === "local directory unavailable");
});
