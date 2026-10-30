// 使用合成边界运行真实恢复模块；不读取账号辅助文件、环境密钥或实际认证服务。
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");

const modules = new Map();
const configBoundary = { isEnabledWorkspaceBusinessKey: (key) => key === "wholesale" };
const allowed = new Set(["auth-failure", "auth-request-transport", "login-recovery", "login-context",
  "current-app-access-context", "auth-metadata", "value-normalizers", "verified-workspace-business", "verified-session-context"]);
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  assert(allowed.has(name), `测试只允许加载明确列出的模块: ${name}`);
  const filename = path.resolve(__dirname, `../lib/${name}.ts`);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const target = { exports: {} };
  modules.set(name, target);
  const dependencies = (id) => {
    if (id === "react") return { cache: (fn) => fn };
    if (id === "./workspace-config") return configBoundary;
    if (id === "./server-performance") return { measureServerStage: (_name, task) => task() };
    if (id === "./workspace-business-availability") return {
      getSignedInWorkspaceDestination: (role, businesses) => businesses.length ? `/${role}/home` : "/business-unavailable",
    };
    return load(id.replace(/^\.\//, ""));
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(dependencies, target, target.exports);
  return target.exports;
}
const { AuthFlowError, classifyAuthFailure } = load("auth-failure");
const { LoginRecoveryCoordinator } = load("login-recovery");
const { createAuthRequestTransport, waitForAuthTask } = load("auth-request-transport");
const { getVerifiedLoginContext } = load("login-context");
const { getVerifiedWorkspaceBusinesses } = load("verified-workspace-business");
const { getVerifiedSessionContext } = load("verified-session-context");
const session = { access_token: "synthetic-secret-token", user: { id: "synthetic-user", email: "test@example.invalid" } };
const context = { user: session.user, role: "salesman", businesses: ["wholesale"], destination: "/salesman/home" };
const connection = () => Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError", status: 0 });
const turn = () => new Promise((resolve) => setImmediate(resolve));

function harness(overrides = {}, timing = { totalMs: 250, retryMs: 1 }) {
  const states = [], diagnostics = [];
  const calls = { password: 0, session: 0, verify: 0, clear: 0, navigate: 0 };
  let flow;
  const dependencies = {
    signIn: async () => { calls.password++; return session; },
    readSession: async () => { calls.session++; return session; },
    verify: async (_session, _email, authenticated) => { calls.verify++; authenticated(); return context; },
    withSignal: async (_signal, task) => task(),
    clearSession: async () => { calls.clear++; },
    onVerified: () => { calls.navigate++; flow.dispose(); },
    onState: (state) => states.push(state), diagnose: (event) => diagnostics.push(event),
    ...overrides,
  };
  flow = new LoginRecoveryCoordinator(dependencies, timing);
  return { flow, states, diagnostics, calls, dependencies, last: () => states.at(-1) };
}

test("正常登录只提交一次密码，权限确认后才导航", async () => {
  const h = harness();
  await h.flow.signIn(session.user.email, "synthetic-password");
  assert.equal(h.calls.password, 1); assert.equal(h.calls.verify, 1); assert.equal(h.calls.navigate, 1);
  assert.equal(h.last().phase, "navigation"); assert.equal(h.diagnostics.length, 0);
});

for (const serverProcessed of [false, true]) test(`密码响应丢失且无本地会话，服务端处理=${serverProcessed} 时仍保持待确认`, async () => {
  let serverEffects = 0, passwordCalls = 0, readCalls = 0;
  const h = harness({ signIn: async () => { passwordCalls++; if (serverProcessed) serverEffects++; throw connection(); },
    readSession: async () => { readCalls++; return null; } });
  await h.flow.signIn(session.user.email, "never-log-this-password");
  assert.equal(passwordCalls, 1); assert.equal(serverEffects, Number(serverProcessed)); assert.equal(readCalls, 2);
  assert.equal(h.last().outcome, "unverified"); assert.equal(h.last().canRecover, true);
  assert.equal(h.calls.navigate, 0); assert.equal(h.calls.clear, 0);
  const logged = JSON.stringify(h.diagnostics);
  for (const secret of [session.user.email, session.access_token, "never-log-this-password"]) assert(!logged.includes(secret));
  assert.deepEqual(Object.keys(h.diagnostics[0]).sort(), ["attemptId", "category", "durationMs", "event", "occurredAt", "outcome", "phase"].sort());
});

test("断线后已有可核验会话时继续，不重放密码", async () => {
  let passwords = 0;
  const h = harness({ signIn: async () => { passwords++; throw connection(); } });
  await h.flow.signIn(session.user.email, "synthetic-password");
  assert.equal(passwords, 1); assert.equal(h.calls.session, 1); assert.equal(h.calls.navigate, 1);
});

test("权限读取短暂失败最多读两次，成功后只导航一次", async () => {
  let reads = 0;
  const h = harness({ verify: async (_s, _e, authenticated) => {
    authenticated(); if (++reads === 1) throw connection(); return context;
  } });
  await h.flow.signIn(session.user.email, "synthetic-password");
  assert.equal(reads, 2); assert.equal(h.calls.password, 1); assert.equal(h.calls.navigate, 1);
});

test("会话已建立但权限持续失败，记录 partial_failed 并保留会话", async () => {
  const h = harness({ verify: async (_s, _e, authenticated) => { authenticated(); throw connection(); } });
  await h.flow.signIn(session.user.email, "synthetic-password");
  assert.equal(h.last().outcome, "partial_failed"); assert.equal(h.last().canRecover, true);
  assert.equal(h.calls.clear, 0); assert.equal(h.calls.navigate, 0);
  h.dependencies.verify = async (_s, _e, authenticated) => { authenticated(); return context; };
  await h.flow.recover();
  assert.equal(h.calls.password, 1); assert.equal(h.calls.navigate, 1);
});

for (const [failure, kind] of [
  [{ code: "invalid_credentials", status: 400 }, "invalidCredentials"],
  [{ code: "email_not_confirmed", status: 400 }, "emailNotConfirmed"],
  [{ code: "email_address_invalid", status: 400 }, "invalidEmail"],
  [{ status: 429 }, "tooFrequent"],
]) test(`明确认证拒绝 ${kind} 不使用旧会话冒充本次登录`, async () => {
  const h = harness({ signIn: async () => { throw failure; } });
  await h.flow.signIn(session.user.email, "wrong-password");
  assert.equal(h.last().failure, kind); assert.equal(h.last().canRecover, false);
  assert.equal(h.calls.session, 0); assert.equal(h.calls.navigate, 0); assert.equal(h.calls.clear, 0);
});

for (const [kind, clears] of [["invalidSession", 1], ["accountInactive", 1], ["accountMismatch", 0], ["accessUnavailable", 0]]) {
  test(`${kind} 的清理和跳转边界`, async () => {
    const h = harness({ verify: async () => { throw new AuthFlowError(kind); } });
    await h.flow.signIn(session.user.email, "synthetic-password");
    assert.equal(h.calls.clear, clears); assert.equal(h.calls.navigate, 0); assert.equal(h.last().failure, kind);
  });
}

test("重复提交与认证事件不会并发产生密码请求", async () => {
  let release, count = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = harness({ signIn: async () => { count++; await gate; return session; } });
  const first = h.flow.signIn(session.user.email, "synthetic-password");
  await h.flow.signIn(session.user.email, "synthetic-password");
  h.flow.onAuthSession(session); release(); await first;
  assert.equal(count, 1); assert.equal(h.calls.verify, 1); assert.equal(h.calls.navigate, 1);
});

test("卸载后旧请求晚到不能核验或跳转", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = harness({ signIn: async () => { await gate; return session; } });
  const pending = h.flow.signIn(session.user.email, "synthetic-password");
  const snapshots = h.states.length; h.flow.dispose(); release(); await pending; await turn();
  assert.equal(h.calls.verify, 0); assert.equal(h.calls.navigate, 0); assert.equal(h.states.length, snapshots);
});

test("总预算结束会取消信号，迟到的核验结果不能导航", async () => {
  let release, signal;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = harness({ withSignal: async (s, task) => { signal = s; return task(); },
    verify: async () => { await gate; return context; } }, { totalMs: 20, retryMs: 1 });
  await h.flow.signIn(session.user.email, "synthetic-password");
  assert.equal(signal.aborted, true); assert.equal(h.last().failure, "timeout");
  release(); await turn(); assert.equal(h.calls.navigate, 0);
});

test("导航未落地不会立即当作成功，超时保留恢复入口", async () => {
  let navigations = 0;
  const h = harness({ onVerified: () => { navigations++; } }, { totalMs: 20, retryMs: 1 });
  await h.flow.signIn(session.user.email, "synthetic-password");
  assert.equal(navigations, 1); assert.equal(h.last().phase, "navigation");
  assert.equal(h.last().outcome, "partial_failed"); assert.equal(h.last().canRecover, true);
});

test("网络恢复事件每次人工操作最多触发一个恢复周期", async () => {
  let reads = 0;
  const h = harness({ verify: async () => { reads++; throw connection(); } });
  await h.flow.signIn(session.user.email, "synthetic-password");
  h.flow.onOnline(); h.flow.onOnline();
  await new Promise((resolve) => setTimeout(resolve, 12));
  h.flow.onOnline(); await turn();
  assert.equal(reads, 4); assert.equal(h.calls.password, 1);
  h.flow.dispose();
});

test("同一候选会话的重复事件只核验一次周期", async () => {
  let reads = 0;
  const h = harness({ verify: async () => { reads++; throw new AuthFlowError("accessUnavailable"); } });
  h.flow.onAuthSession(session); await turn(); h.flow.onAuthSession(session); await turn();
  assert.equal(reads, 1); assert.equal(h.calls.password, 0); h.flow.dispose();
});

test("跨标签切换账号会取消旧核验，不能清除新账号或跳错账号", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const h = harness({ verify: async () => { await gate; return context; } });
  const pending = h.flow.signIn(session.user.email, "synthetic-password"); await turn();
  h.flow.onAuthSession({ ...session, user: { id: "other-user" }, access_token: "other-synthetic-token" });
  await pending; release(); await turn();
  assert.equal(h.last().failure, "accountMismatch"); assert.equal(h.calls.clear, 0); assert.equal(h.calls.navigate, 0);
});

test("传输层保持项目 URL、请求头与正文，同时合并调用方取消信号", async () => {
  let seen;
  const transport = createAuthRequestTransport(async (input, init) => {
    seen = { input, init };
    return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }));
  });
  const caller = new AbortController();
  const pending = transport.fetch("https://example.invalid/auth/v1/token?grant_type=password", {
    method: "POST", body: "synthetic", headers: { "x-test": "keep" }, signal: caller.signal,
  });
  caller.abort(new AuthFlowError("timeout"));
  await assert.rejects(pending, (error) => error.kind === "timeout");
  assert.equal(seen.input, "https://example.invalid/auth/v1/token?grant_type=password");
  assert.equal(seen.init.body, "synthetic"); assert.deepEqual(seen.init.headers, { "x-test": "keep" });
});

test("密码响应头之后正文卡住仍在 15 秒内取消", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const transport = createAuthRequestTransport(async (_input, init) => new Response(new ReadableStream({
    start(controller) { init.signal.addEventListener("abort", () => controller.error(init.signal.reason), { once: true }); },
  })));
  const pending = transport.fetch("https://example.invalid/auth/v1/token?grant_type=password");
  const expected = assert.rejects(pending, (error) => error.kind === "timeout");
  await turn(); t.mock.timers.tick(15_000); await expected;
});

test("取消的操作不能在锁等待结束后补发请求", async () => {
  let calls = 0;
  const transport = createAuthRequestTransport(async () => { calls++; return new Response("{}"); });
  const controller = new AbortController(); controller.abort(new AuthFlowError("timeout"));
  await assert.rejects(transport.run(controller.signal, () => transport.fetch("https://example.invalid/auth/v1/user")));
  assert.equal(calls, 0);
});

test("旧 SDK 任务未结束时拒绝新的作用域", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const transport = createAuthRequestTransport();
  const controller = new AbortController();
  const first = transport.run(controller.signal, () => gate);
  await assert.rejects(transport.run(controller.signal, async () => undefined), (error) => error.kind === "busy");
  release(); await first;
});

test("已经取消的等待仍处理迟到的任务拒绝", async () => {
  const controller = new AbortController(); controller.abort(new AuthFlowError("timeout"));
  await assert.rejects(waitForAuthTask(Promise.reject(new Error("late failure")), controller.signal));
  await turn();
});

test("普通数据请求不添加认证超时或改变请求参数", async () => {
  const init = { method: "GET" };
  let seen;
  const transport = createAuthRequestTransport(async (_input, options) => { seen = options; return new Response("[]"); });
  await transport.fetch("https://example.invalid/rest/v1/items", init);
  assert.equal(seen, init);
});
test("注册等独立认证流程继续使用自己的等待规则", async () => {
  const init = { method: "POST", body: "synthetic" };
  let seen;
  const transport = createAuthRequestTransport(async (_input, options) => { seen = options; return new Response("{}"); });
  await transport.fetch("https://example.invalid/auth/v1/signup", init);
  assert.equal(seen, init);
});

test("服务端临时认证错误向上抛出，不能转换成空用户触发退出", async () => {
  const error = connection();
  await assert.rejects(getVerifiedSessionContext({ auth: { getUser: async () => ({ data: { user: null }, error }) } }),
    (actual) => actual === error);
  const missing = await getVerifiedSessionContext({ auth: { getUser: async () => ({ data: { user: null }, error: { status: 401 } }) } });
  assert.equal(missing.user, null);
});

for (const data of [null, {}, [null], [{ business_key: null }]]) test(`权限响应 ${JSON.stringify(data)} 不是有效的空业务`, async () => {
  await assert.rejects(getVerifiedWorkspaceBusinesses({ rpc: async () => ({ data, error: null }) }), (e) => e.kind === "accessUnavailable");
});
test("真实空业务保持为空，权限错误不使用角色默认值", async () => {
  assert.deepEqual(await getVerifiedWorkspaceBusinesses({ rpc: async () => ({ data: [], error: null }) }), []);
  await assert.rejects(getVerifiedWorkspaceBusinesses({ rpc: async () => ({ data: null, error: connection() }) }));
});

function contextClient(overrides = {}) {
  return { auth: {
    getUser: async () => ({ data: { user: { ...session.user, app_metadata: { role: "client" } } }, error: null }),
    getSession: async () => ({ data: { session }, error: null }),
    ...overrides.auth,
  }, rpc: overrides.rpc ?? (async (name) => ({ error: null, data: name === "get_current_app_access_context"
    ? [{ role: "finance", status: "active" }] : [{ business_key: "wholesale" }] })) };
}
test("登录上下文使用数据库实际角色，不使用旧元数据", async () => {
  const result = await getVerifiedLoginContext(contextClient(), session, session.user.email);
  assert.equal(result.role, "finance"); assert.equal(result.destination, "/finance/home");
});
test("目标邮箱不一致时不继续读取权限", async () => {
  const client = contextClient({ rpc: async () => { assert.fail("不应查询权限"); } });
  await assert.rejects(getVerifiedLoginContext(client, session, "different@example.invalid"), (e) => e.kind === "accountMismatch");
});
test("权限读取期间切换身份必须拒绝拼接结果", async () => {
  const client = contextClient({ auth: { getSession: async () => ({ data: { session: { user: { id: "other-user" } } }, error: null }) } });
  await assert.rejects(getVerifiedLoginContext(client, session), (e) => e.kind === "accountMismatch");
});
test("未知异常不会误判成密码错误或明确会话失效", () => {
  assert.equal(classifyAuthFailure(new Error("unexpected")), "serviceUnavailable");
  assert.equal(classifyAuthFailure({ name: "AuthRetryableFetchError", message: "timeout", status: 0 }), "timeout");
});

/** 入口代理使用纯请求／响应边界，检查临时故障和 Cookie 防缓存，不连接真实项目。 */
function proxyHarness(options = {}) {
  function cookieJar(initial = []) {
    const values = new Map(initial.map((cookie) => [cookie.name, cookie]));
    return { getAll: () => [...values.values()], set: (cookie, value) => {
      const row = typeof cookie === "string" ? { name: cookie, value } : cookie;
      values.set(row.name, row);
    } };
  }
  const response = (destination) => ({ headers: new Headers(destination ? { location: String(destination) } : {}), cookies: cookieJar() });
  const sourcePath = path.resolve(__dirname, "../lib/supabase-proxy.ts");
  const code = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const target = { exports: {} };
  const dependencies = {
    "@supabase/ssr": { createServerClient: (_url, _key, config) => ({ auth: { getUser: async () => {
      if (options.refresh) config.cookies.setAll([{ name: "sb-synthetic-auth-token", value: "synthetic-refreshed" }], {
        "cache-control": "private, no-store", pragma: "no-cache", expires: "0",
      });
      return { data: { user: options.error ? null : { id: "synthetic-user" } }, error: options.error ?? null };
    } } }) },
    "next/server": { NextResponse: { next: () => response(), redirect: (url) => response(url) } },
    "./current-app-access-context": { getCurrentAppAccessContext: async () => options.access ?? { role: "finance", status: "active" } },
    "./auth-failure": load("auth-failure"),
    "./auth-request-transport": load("auth-request-transport"),
    "./auth-routing": { getWorkspaceBasePath: (pathname) => pathname.startsWith("/salesman/") ? "/salesman" : null },
    "./supabase": { getSupabaseEnv: () => ({ supabaseUrl: "https://project.example.invalid", supabaseKey: "synthetic" }) },
    "./public-site-origin": { getRequestPublicOrigin: () => "https://app.example.invalid" },
    "./verified-workspace-business": { getVerifiedWorkspaceBusinesses: async () => {
      if (options.businessError) throw options.businessError; return ["wholesale"];
    } },
    "./workspace-business-availability": { getSignedInWorkspaceDestination: () => "/finance/home" },
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: sourcePath })(
    (name) => { assert(Object.hasOwn(dependencies, name), `不允许未隔离的依赖 ${name}`); return dependencies[name]; },
    target, target.exports,
  );
  const request = { nextUrl: new URL(`https://app.example.invalid${options.pathname ?? "/login"}`),
    cookies: cookieJar([{ name: "sb-synthetic-auth-token", value: "synthetic-original" }]) };
  return { run: () => target.exports.updateSession(request), request };
}
test("入口代理遇到临时认证故障时不跳转退出、不清 Cookie", async () => {
  const h = proxyHarness({ error: connection(), pathname: "/salesman/home" });
  const response = await h.run();
  assert.equal(response.headers.get("location"), null); assert.deepEqual(response.cookies.getAll(), []);
  assert.equal(h.request.cookies.getAll()[0].value, "synthetic-original");
});
test("入口代理跳转继承刷新 Cookie 和所有 SDK 防缓存头", async () => {
  const response = await proxyHarness({ refresh: true }).run();
  assert.equal(response.headers.get("location"), "https://app.example.invalid/finance/home");
  assert.equal(response.cookies.getAll()[0].value, "synthetic-refreshed");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("pragma"), "no-cache"); assert.equal(response.headers.get("expires"), "0");
});
test("入口代理读取业务权限失败时不会通过默认业务继续跳转", async () => {
  const response = await proxyHarness({ businessError: connection() }).run();
  assert.equal(response.headers.get("location"), null);
});
test("入口代理缺少账号状态时不把未知结果当作账号停用", async () => {
  const response = await proxyHarness({ access: { role: "finance", status: null } }).run();
  assert.equal(response.headers.get("location"), null);
});
