import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { request as httpRequest } from "node:http";
import test from "node:test";
import ts from "typescript";
import {
  localRateCredentials,
  localRateEntrypoint,
  startLocalRateSource,
} from "../../../PT5-dropshipping-supabase/scripts/exchange-rate-sync-source.mjs";

const owner = "bc000000-0000-4000-8000-000000000001";
const instant = "2026-11-10T07:00:00.000Z";
const credentials = localRateCredentials(owner);
const gateway = "http://127.0.0.1:48201";
const supplier = "https://sapi.k780.com/";
const normalize = (value) => JSON.parse(JSON.stringify(value));
function form(overrides = {}) {
  return new URLSearchParams({
    app: "finance.rate_cnyquot",
    ...credentials,
    curno: "USD",
    bankno: "BOC",
    format: "json",
    ...overrides,
  });
}
async function source(t, options = {}) {
  const result = await startLocalRateSource(owner, {
    port: 0,
    now: () => new Date(instant),
    ...options,
  });
  t.after(() => result.close());
  return result;
}
async function post(server, body, options = {}) {
  return fetch(server.origin + "/rate", {
    method: "POST",
    body,
    signal: AbortSignal.timeout(2000),
    ...options,
  });
}

/** 执行原样生成的启动壳，仅把末尾index加载换成可观测端口；不加载认证或数据库入口。 */
async function adapter(server, { env = {}, originalFetch } = {}) {
  const calls = [],
    boots = [];
  const code = localRateEntrypoint(owner, server.origin);
  const marker = 'await import("./index.ts");';
  assert.equal(code.split(marker).length, 2);
  const values = {
    SUPABASE_URL: gateway,
    NOWAPI_APP_KEY: credentials.appkey,
    NOWAPI_SIGN: credentials.sign,
    ...env,
  };
  const context = vm.createContext({
    Request,
    Response,
    URL,
    URLSearchParams,
    Error,
    Deno: { env: { get: (key) => values[key] } },
    startActualModule: async () => {
      boots.push("import-port-only");
    },
    fetch: async (input, init) => {
      calls.push({ input, init });
      if (originalFetch) return originalFetch(input, init);
      const target = typeof input === "string" ? input : input.url;
      // 双重保护：测试端口只能请求本次HTTP服务，即便壳意外失效也不会连接供应商。
      assert.equal(target, server.origin + "/rate");
      return fetch(input, init);
    },
  });
  await new vm.Script(`(async () => {${code.replace(marker, "await startActualModule();")}})()`).runInContext(
    context,
  );
  return { fetch: context.fetch, calls, boots };
}

/** 白名单加载三个真实纯模块；只注入时钟、环境和外部fetch，绝不跟随原测试的Auth导入。 */
function providers(fetchPort) {
  const files = new Set(["providers.ts", "shared.ts", "nowapi-quotes.ts"]);
  const cache = new Map();
  const backend = new URL(
    "../../../PT5-dropshipping-supabase/supabase/functions/exchange-rate-sync/",
    import.meta.url,
  );
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [instant]));
    }
    static now() {
      return Date.parse(instant);
    }
  }
  function load(name) {
    assert(files.has(name), "测试不得加载原Auth、SDK或其他模块");
    if (cache.has(name)) return cache.get(name);
    const exports = {};
    cache.set(name, exports);
    const source = fs.readFileSync(new URL(name, backend), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    vm.runInNewContext(
      compiled,
      {
        exports,
        Date: FixedDate,
        Response,
        AbortSignal,
        URLSearchParams,
        Deno: {
          env: { get: (key) => ({ NOWAPI_APP_KEY: credentials.appkey, NOWAPI_SIGN: credentials.sign })[key] },
        },
        fetch: fetchPort,
        require: (specifier) => {
          assert(specifier.startsWith("./"));
          return load(specifier.slice(2));
        },
      },
      { filename: name },
    );
    return exports;
  }
  return load("providers.ts");
}

test("原供应商请求与解析通过本次HTTP来源，日末取最后一条且CNY不请求供应商", async (t) => {
  const server = await source(t);
  const boundary = await adapter(server);
  const actual = providers(boundary.fetch);
  const current = await actual.fetchCurrentCnyRate("USD");
  assert.deepEqual(normalize(current), {
    rate: 6.6993,
    bankQuote: "669.93",
    providerUpdatedAt: instant,
    providerRateDate: "2026-11-10",
  });
  const historical = await actual.fetchHistoricalCnyRate("USD", "2026-11-09");
  assert.deepEqual(normalize(historical), {
    rate: 6.6993,
    bankQuote: "669.93",
    providerUpdatedAt: "2026-11-09T15:59:59.000Z",
    providerRateDate: "2026-11-09",
    baseCurrency: "USD",
    rateDate: "2026-11-09",
  });
  assert.notEqual(669.93 / 100, current.rate);
  const before = server.snapshot().accepted;
  assert.equal((await actual.fetchCurrentCnyRate("CNY")).rate, 1);
  assert.equal((await actual.fetchHistoricalCnyRate("CNY", "2026-11-09")).rate, 1);
  assert.equal(server.snapshot().accepted, before);
  await assert.rejects(actual.fetchHistoricalCnyRate("ZZZ", "2026-11-09"), /未完成/);
  assert.deepEqual(server.snapshot().requests, [
    { app: "finance.rate_cnyquot", currency: "USD", day: "2026-11-10" },
    { app: "finance.rate_cnyquot_history", currency: "USD", day: "2026-11-09" },
    { app: "finance.rate_cnyquot_history", currency: "ZZZ", day: "2026-11-09" },
  ]);
  assert.deepEqual(server.snapshot().errors, []);
  assert.equal(boundary.boots.length, 1);
  assert.equal(boundary.calls.length, 3);
  for (const call of boundary.calls) assert.equal(call.init.redirect, "error");
});

test("来源拒绝错误凭据、重复字段、银行/日期/正文契约；诊断不保留正文和凭据", async (t) => {
  const server = await source(t);
  for (const [body, options, status] of [
    [form({ appkey: "sample-private-value" }), {}, 403],
    [form({ bankno: "OTHER" }), {}, 400],
    [form({ format: "xml" }), {}, 400],
    [form({ unexpected: "sample-private-value" }), {}, 400],
    [form({ curno: "usd" }), {}, 400],
    [form({ date: "20261109" }), {}, 400],
    [form({ app: "finance.rate_cnyquot_history", date: "20260230" }), {}, 400],
    [form({ app: "finance.rate_cnyquot_history", date: "20261110" }), {}, 400],
    [form({ app: "finance.rate_cnyquot_history", date: "20261111" }), {}, 400],
    [form({ app: "unknown" }), {}, 400],
    [form(), { headers: { "content-type": "text/plain" } }, 400],
    [
      form().toString() + "&appkey=sample-private-value",
      {
        headers: { "content-type": "application/x-www-form-urlencoded" },
      },
      400,
    ],
  ]) {
    const response = await post(server, body, options);
    assert.equal(response.status, status);
    assert(!JSON.stringify(await response.json()).includes("sample-private-value"));
  }
  assert.equal((await fetch(server.origin + "/rate")).status, 404);
  assert.equal((await fetch(server.origin + "/unknown")).status, 404);
  const diagnostic = JSON.stringify(server.snapshot());
  for (const value of ["sample-private-value", credentials.appkey, credentials.sign])
    assert(!diagnostic.includes(value));
  assert.equal(server.snapshot().accepted, 0);
  assert.equal(server.snapshot().errors.length, 12);
});

test("启动壳透传同项目请求，不修改载荷或模拟认证结果", async (t) => {
  const server = await source(t);
  let forwarded;
  const boundary = await adapter(server, {
    originalFetch: async (request) => {
      forwarded = request;
      return Response.json({ port: "sdk-transport-only" });
    },
  });
  const response = await boundary.fetch(gateway + "/rest/v1/rpc/example", {
    method: "POST",
    headers: { authorization: "Bearer synthetic-test-only" },
    body: JSON.stringify({ id: owner }),
  });
  assert.deepEqual(await response.json(), { port: "sdk-transport-only" });
  assert.equal(boundary.calls.length, 1);
  assert.equal(boundary.calls[0].input, forwarded);
  assert.equal(forwarded.url, gateway + "/rest/v1/rpc/example");
  assert.equal(forwarded.method, "POST");
  assert.equal(forwarded.headers.get("authorization"), "Bearer synthetic-test-only");
  assert.deepEqual(await forwarded.json(), { id: owner });
  assert.equal(server.snapshot().accepted, 0);
});

test("启动前拒绝非本次假凭据，任意外部地址与错误供应商载荷不发生网络调用", async (t) => {
  const server = await source(t);
  for (const env of [{ NOWAPI_APP_KEY: "another-value" }, { NOWAPI_SIGN: undefined }])
    await assert.rejects(adapter(server, { env }), /rate_mock_requires_fake_credentials/);
  const boundary = await adapter(server);
  for (const [url, init] of [
    [supplier, {}],
    [supplier + "?appkey=sample-private-value", { method: "POST", body: form() }],
    [supplier + "other", { method: "POST", body: form() }],
    ["https://example.invalid/", { method: "POST", body: form() }],
    [supplier, { method: "POST", body: form({ sign: "another-value" }) }],
  ])
    await assert.rejects(
      boundary.fetch(url, init),
      /rate_mock_(external_request|payload_credentials)_refused/,
    );
  assert.equal(boundary.calls.length, 0);
  assert.equal(server.snapshot().accepted, 0);
});

test("多个并行报价互不污染，快照副本不能修改服务状态", async (t) => {
  const server = await source(t);
  const boundary = await adapter(server);
  const actual = providers(boundary.fetch);
  const results = await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      index % 2 ? actual.fetchHistoricalCnyRate("USD", "2026-11-09") : actual.fetchCurrentCnyRate("USD"),
    ),
  );
  assert(results.every((row) => row.rate === 6.6993));
  assert.equal(server.snapshot().accepted, 6);
  const copy = server.snapshot();
  copy.requests[0].currency = "OTHER";
  copy.errors.push("foreign");
  assert(server.snapshot().requests.every((row) => row.currency === "USD"));
  assert.deepEqual(server.snapshot().errors, []);
});

test("正文溢出和无效时钟不生成成功报价，服务关闭后可精确复用端口", async (t) => {
  const server = await source(t);
  // 超限正文可能在迭代器销毁连接后表现为传输失败，两者都不得生成可用报价。
  await post(server, "x".repeat(17000)).then(
    async (response) => {
      assert(response.status >= 400);
      await response.text();
    },
    () => {},
  );
  assert.equal(server.snapshot().accepted, 0);
  assert.deepEqual(server.snapshot().errors, ["request-unconfirmed"]);
  const broken = await source(t, { now: () => new Date(NaN) });
  assert.equal((await post(broken, form())).status, 500);
  assert.equal(broken.snapshot().accepted, 0);
  const port = Number(new URL(server.origin).port);
  await server.close();
  await server.close();
  const replacement = await source(t, { port });
  await assert.rejects(startLocalRateSource(owner, { port }), (error) => error.code === "EADDRINUSE");
  // 端口立即重绑必须新建连接，不能让fetch连接池复用刚关闭的上一服务套接字。
  const status = await new Promise((resolve, reject) => {
    const request = httpRequest(
      replacement.origin + "/rate",
      {
        agent: false,
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      },
      (response) => {
        response.on("error", reject);
        response.on("end", () => resolve(response.statusCode));
        response.resume();
      },
    );
    request.on("error", reject);
    request.setTimeout(2000, () => request.destroy(new Error("rebound_probe_timeout")));
    request.end(form().toString());
  });
  assert.equal(status, 200);
  assert.equal(replacement.snapshot().accepted, 1);
});

test("夹具归属、监听端口和启动来源严格限本机，错误提示不回显输入", async () => {
  for (const id of ["", "x", "bc000000-0000-4000-8000-000000000001'", null])
    assert.throws(() => localRateCredentials(id), /rate_source_owner_invalid/);
  for (const port of [-1, 1.5, 65536, "43194"])
    await assert.rejects(startLocalRateSource(owner, { port }), /rate_source_port_invalid/);
  for (const origin of [
    "sample-private-value",
    "https://127.0.0.1:1234",
    "http://example.invalid:1234",
    "http://user:sample-private-value@localhost:1234",
    "http://localhost",
    "http://127.0.0.1:1234/path",
    "http://127.0.0.1:1234?x=1",
    "http://127.0.0.1:1234#hash",
  ]) {
    assert.throws(
      () => localRateEntrypoint(owner, origin),
      (error) => error.message === "rate_source_origin_invalid",
    );
  }
  for (const origin of [
    "http://127.0.0.1:1234",
    "http://localhost:1234",
    "http://host.docker.internal:1234",
    "http://[::1]:1234",
  ])
    assert(localRateEntrypoint(owner, origin).includes('await import("./index.ts")'));
});
