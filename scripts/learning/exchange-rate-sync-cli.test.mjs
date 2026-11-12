import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inspect as inspectError } from "node:util";
import ts from "typescript";
import {
  readDisposablePostgresTarget,
  requireDisposablePostgresTarget,
} from "../../tests/test-support/disposable-fixture.ts";
import {
  localRateCredentials,
  localRateEntrypoint,
} from "../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-source.mjs";
import { rateSyncCases } from "../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-cases.mjs";
import { createRateSyncFixture } from "../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-fixture.mjs";

const owner = "bc100000-0000-4000-8000-000000000001";
const project = "pt5-e2e-rate-unit",
  api = "http://127.0.0.1:48041";
const sourceFile = new URL(
  "../../../PT5-dropshipping-supabase/scripts/test-exchange-rate-sync-local.mjs",
  import.meta.url,
);
const source = fs.readFileSync(sourceFile, "utf8");

/** 只执行原入口的敏感读取前置；Docker/CLI/配置是合成端口，认证正文不加载也不执行。 */
function preflight(options = {}) {
  const calls = [],
    reads = [];
  const env = {
    PLAYWRIGHT_BASE_URL: api,
    NEXT_PUBLIC_SUPABASE_URL: api,
    PT5_E2E_FIXTURE_MODE: "disposable",
    PT5_E2E_DATABASE_PROJECT: project,
    PT5_E2E_DATABASE_CONTAINER: "supabase_db_" + project,
    PT5_E2E_RATE_OWNER: owner,
    ...options.env,
  };
  const prefix = source.slice(0, source.indexOf("const seedSql ="));
  assert(prefix.length > 500 && !prefix.includes("async function signIn"));
  const tree = ts.createSourceFile(sourceFile.href, source, ts.ScriptTarget.Latest, true);
  const parsers = tree.statements.filter(
    (node) =>
      ts.isFunctionDeclaration(node) && ["parseEnvironment", "requiredValue"].includes(node.name.text),
  );
  assert.equal(parsers.length, 2);
  const scoped = prefix + parsers.map((node) => node.getText(tree)).join("\n");
  const compiled = ts.transpileModule(scoped.replaceAll("import.meta.url", JSON.stringify(sourceFile.href)), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  const execute = () =>
    vm.runInNewContext(
      compiled,
      {
        exports: {},
        process: { env },
        URL,
        require: (name) => {
          if (name === "node:assert/strict") return assert;
          if (name === "node:path") return path;
          if (name === "node:url") return { fileURLToPath };
          if (name.endsWith("/disposable-fixture.ts")) return { readDisposablePostgresTarget };
          if (name === "./exchange-rate-sync-source.mjs") return { localRateCredentials };
          if (
            [
              "./exchange-rate-sync-environment.mjs",
              "./exchange-rate-sync-fixture.mjs",
              "./exchange-rate-sync-cases.mjs",
            ].includes(name)
          )
            return {};
          if (name === "node:fs")
            return {
              readFileSync: (file) => {
                reads.push(file);
                assert(file.endsWith(path.join("supabase", "config.toml")), "前置不得读取种子或账号文件");
                return `project_id = "${options.configProject ?? project}"\n[api]\nport=48041\n`;
              },
            };
          if (name === "node:child_process")
            return {
              execFileSync: (command, args) => {
                calls.push({ command, args });
                if (command === "docker") {
                  if (args[0] === "inspect")
                    return JSON.stringify({
                      running: true,
                      labels: { "com.supabase.cli.project": project },
                      ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: options.port ?? "48041" }] },
                      networks: { own: { NetworkID: "unit-network" } },
                    });
                  assert.equal(args[0], "exec");
                  return options.scheduler ?? "off|0|0";
                }
                assert.equal(command, "supabase");
                assert.deepEqual(Array.from(args.slice(0, 3)), ["status", "-o", "env"]);
                assert.equal(args[3], "--workdir");
                if (options.statusFailure)
                  throw Object.assign(Error("sample-sensitive-status"), {
                    stdout: "sample-sensitive-status",
                  });
                return `API_URL="${options.statusApi ?? api}"\nANON_KEY="synthetic-anon"\nSERVICE_ROLE_KEY="synthetic-service"\n`;
              },
            };
          throw Error("未登记的前置导入：" + name);
        },
      },
      { filename: "rate-cli-preflight-only" },
    );
  let error;
  try {
    execute();
  } catch (value) {
    error = value;
  }
  return { calls, reads, error, cliCalls: calls.filter((call) => call.command !== "docker") };
}

test("原汇率入口先拒绝共享/活跃环境，再允许读取配置与CLI；原认证正文未执行", () => {
  for (const [options, reason] of [
    [{ env: { PT5_E2E_FIXTURE_MODE: undefined } }, /destructive E2E fixtures/],
    [{ env: { PT5_E2E_DATABASE_PROJECT: "pt5-dropshipping" } }, /document_lock_requires_dedicated_project/],
    [{ env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid" } }, /fixture endpoint must be local/],
    [
      { env: { NEXT_PUBLIC_SUPABASE_URL: "http://user:sample-sensitive-status@127.0.0.1:48041" } },
      /fixture endpoint must be local/,
    ],
    [{ port: "48021" }, /document_lock_api_port_mismatch/],
    [{ scheduler: "on|0|0" }, /paused_scheduler_and_empty_queue/],
    [{ scheduler: "off|1|0" }, /paused_scheduler_and_empty_queue/],
    [{ scheduler: "off|0|1" }, /paused_scheduler_and_empty_queue/],
  ]) {
    const result = preflight(options);
    assert(result.error);
    assert.match(result.error.message, reason);
    assert.equal(result.reads.length, 0);
    assert.equal(result.cliCalls.length, 0);
    assert(!String(result.error).includes("sample-sensitive-status"));
  }
});

test("本地模式默认开放，真实来源/非法归属和状态地址在种子读取前拒绝，CLI错误脱敏", () => {
  const good = preflight();
  assert.equal(good.error, undefined);
  assert.equal(good.cliCalls.length, 1);
  assert.equal(good.reads.length, 1);
  for (const [options, reason] of [
    [{ env: { PT5_E2E_PROVIDER_MODE: "unknown" } }, /rate_fixture_provider_mode_invalid/],
    [
      { env: { PT5_E2E_PROVIDER_MODE: "real", PT5_E2E_REAL_PROVIDER: undefined } },
      /真实供应商验收需要单独授权/,
    ],
    [{ env: { PT5_E2E_RATE_OWNER: "sample-sensitive-status" } }, /rate_source_owner_invalid/],
    [{ configProject: "other-project" }, /CLI工作目录必须属于声明/],
    [{ statusApi: "https://example.invalid" }, /CLI API必须匹配/],
    [{ statusFailure: true }, /无法读取专属Supabase状态/],
  ]) {
    const result = preflight(options);
    assert(result.error);
    assert.match(result.error.message, reason);
    assert(!String(result.error).includes("sample-sensitive-status"));
    assert.equal(result.reads.length, 1);
    assert(result.cliCalls.length <= 1);
  }
});

test("保留四个原非法输入及USD重复/CNY场景，所有写请求预声明独立键且拒绝非法清理清单", () => {
  const plan = rateSyncCases(owner, "2026-11-10");
  assert.equal(plan.yesterday, "2026-11-09");
  assert.deepEqual(
    plan.cases.map((item) => item.status),
    [400, 400, 400, 400, 200, 200, 200],
  );
  assert.deepEqual(plan.cases[3].body.baseCurrencies, [
    "AAA",
    "AAB",
    "AAC",
    "AAD",
    "AAE",
    "AAF",
    "AAG",
    "AAH",
    "AAI",
    "AAJ",
    "AAK",
  ]);
  assert.deepEqual(plan.cases[4].body.baseCurrencies, ["USD", "ZZZ"]);
  assert.deepEqual(plan.cases[5].body.baseCurrencies, ["USD"]);
  assert.deepEqual(plan.cases[6].body.baseCurrencies, ["USD", "CNY"]);
  const tables = Array.from({ length: 105 }, (_, index) => "public.fixture_" + index);
  const fixture = createRateSyncFixture({ owner, ...plan, tables });
  for (const extra of [
    { owner: "bad-owner" },
    { today: "2026-02-30" },
    { yesterday: "2026-11-08" },
    { cases: plan.cases.slice(0, 6) },
    { tables: tables.slice(0, 2) },
    { tables: [...tables, "public.a;drop"] },
    { tables: [...tables, tables[0]] },
    {
      cases: plan.cases.map((item, index) =>
        index ? item : { ...item, body: { ...item.body, idempotencyKey: "foreign" } },
      ),
    },
  ])
    assert.throws(() => createRateSyncFixture({ owner, ...plan, tables, ...extra }));
  assert.throws(() => fixture.sql("register", "foreign"));
  assert.throws(() => fixture.sql("capture", plan.cases[0].body.idempotencyKey, "unknown"));
  for (const ids of [["1"], [-1], [1.5], [Number.MAX_SAFE_INTEGER + 1]])
    assert.throws(() => fixture.sql("empty", ids), /transport_ids_invalid/);
});

test("临近午夜只等待真实新业务日，不把今日非法输入的跨日变化当成产品失败", async () => {
  const file = new URL(
    "../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-cases.mjs",
    import.meta.url,
  );
  const tree = ts.createSourceFile(file.href, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const node = tree.statements.find(
    (item) => ts.isFunctionDeclaration(item) && item.name.text === "waitForRateTestDay",
  );
  assert(node);
  const compiled = ts.transpileModule(node.getText(tree), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [instant, expected, expectedWaits] of [
    ["2026-11-10T07:00:00Z", "2026-11-10", 0],
    ["2026-11-10T15:59:00Z", "2026-11-11", 12],
  ]) {
    let clock = Date.parse(instant),
      waits = 0;
    class ClockDate extends Date {
      static now() {
        return clock;
      }
    }
    const exports = {};
    vm.runInNewContext(compiled, {
      exports,
      assert,
      Date: ClockDate,
      console: { log() {} },
      setTimeout: (callback, duration) => {
        assert(duration <= 5000);
        clock += duration;
        waits++;
        callback();
      },
    });
    assert.equal(await exports.waitForRateTestDay(), expected);
    assert.equal(waits, expectedWaits);
  }
});

/** 只替换进程和文件端口执行真实环境校验；错误必须连AssertionError的actual字段也不含输入。 */
function edgeGuard(options = {}) {
  const fake = localRateCredentials(owner);
  const entry = localRateEntrypoint(owner, "http://host.docker.internal:43194").trim();
  const config = {
    verifyJWT: false,
    entrypointPath: "supabase/functions/exchange-rate-sync/local-mock-entry.ts",
  };
  const environment = {
    NOWAPI_APP_KEY: options.key ?? fake.appkey,
    NOWAPI_SIGN: options.sign ?? fake.sign,
    SUPABASE_URL: options.origin ?? "http://kong:8000",
    SUPABASE_INTERNAL_FUNCTIONS_CONFIG:
      options.invalidConfig ?? JSON.stringify({ "exchange-rate-sync": config }),
  };
  const values = Object.entries(environment).map(([key, value]) => key + "=" + value);
  const scope = {
    URL,
    process: {
      env: {
        PLAYWRIGHT_BASE_URL: api,
        PT5_E2E_FIXTURE_MODE: "disposable",
        PT5_E2E_DATABASE_PROJECT: project,
        PT5_E2E_DATABASE_CONTAINER: "supabase_db_" + project,
      },
    },
    require: (name) => {
      if (name === "./exchange-rate-sync-edge.mjs")
        return loadEnvironmentModule("exchange-rate-sync-edge.mjs");
      if (name === "node:assert/strict") return assert;
      if (name === "node:path") return path;
      if (name.endsWith("/disposable-fixture.ts")) return { requireDisposablePostgresTarget };
      if (name === "./exchange-rate-sync-source.mjs") return { localRateCredentials, localRateEntrypoint };
      if (name === "node:fs")
        return {
          readFileSync: (name) => (name.endsWith("local-mock-entry.ts") ? entry : "export const probe=1;"),
          readdirSync: () => [{ name: "index.ts", isSymbolicLink: () => false, isDirectory: () => false }],
        };
      if (name === "node:child_process")
        return {
          execFileSync: (command, args, input) => {
            assert.equal(command, "docker");
            if (args[0] === "inspect") {
              if (args.includes("{{json .Config.Env}}")) return JSON.stringify(values);
              if (args.includes("{{json .Mounts}}"))
                return JSON.stringify([{ Type: "bind", Destination: "/project/supabase/functions" }]);
              return JSON.stringify({
                running: true,
                labels: { "com.supabase.cli.project": project },
                ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "48041" }] },
                networks: { own: { NetworkID: "unit" } },
              });
            }
            if (args.includes("cat"))
              return args.at(-1).endsWith("local-mock-entry.ts")
                ? (options.bootstrap ?? entry)
                : (options.source ?? "export const probe=1;");
            assert(args.includes("psql"));
            return input.input.startsWith("select count(*)") ? "1" : "off|0|0";
          },
        };
      throw Error("未登记的环境导入：" + name);
    },
  };
  // CLI 和提取后的共享校验都执行原实现，测试仍只替换合成 Docker 与文件端口。
  function loadEnvironmentModule(name) {
    const file = new URL(`../../../PT5-dropshipping-supabase/scripts/${name}`, import.meta.url);
    const code = fs.readFileSync(file, "utf8")
      .replaceAll("import.meta.dirname", JSON.stringify(path.dirname(fileURLToPath(file))));
    const compiled = ts.transpileModule(code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const exports = {};
    vm.runInNewContext(compiled, { ...scope, exports });
    return exports;
  }
  return loadEnvironmentModule("exchange-rate-sync-environment.mjs")
    .rateSyncEnvironment({
      root: path.dirname(fileURLToPath(sourceFile)),
      owner,
      mode: "mock",
      apiUrl: api,
      keys: rateSyncCases(owner, "2026-11-10").cases.map((item) => item.body.idempotencyKey),
    })
    .verifyEdge();
}

test("环境漂移固定拒绝，误放的凭据、URL和源码内容不会通过错误对象泄露", () => {
  assert.equal(edgeGuard().verifiedFiles, 2);
  for (const [options, reason] of [
    [{ key: "sample-sensitive-key" }, /requires_fake_key/],
    [{ sign: "sample-sensitive-sign" }, /requires_fake_sign/],
    [{ origin: "sample-sensitive-origin" }, /internal_origin_invalid/],
    [{ origin: "http://u:sample-sensitive@kong:8000" }, /internal_origin_invalid/],
    [{ invalidConfig: "sample-sensitive-config" }, /edge_config_invalid/],
    [{ bootstrap: "sample-sensitive-bootstrap" }, /bootstrap_changed/],
    [{ source: "sample-sensitive-code" }, /source_changed/],
  ])
    assert.throws(
      () => edgeGuard(options),
      (error) => {
        assert.match(error.message, reason);
        assert(!inspectError(error, { depth: 5 }).includes("sample-sensitive"));
        return true;
      },
    );
});
