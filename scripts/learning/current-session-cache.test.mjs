import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { extname } from "node:path";
import test from "node:test";
import ts from "typescript";

const libRoot = new URL("../../lib/", import.meta.url).href;
// Next.js 会解析源码的无后缀导入。Node 测试仅为这组仓库内 TS 文件补后缀，直接运行原模块。
const resolver = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(libRoot) && specifier.startsWith(".") && !extname(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.startsWith(libRoot) || !url.endsWith(".ts")) return next(url, context);
    const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    return { format: "module", shortCircuit: true, source };
  },
});
const { getCurrentSession, getCurrentUser, getCurrentClaims } = await import("../../lib/current-session-auth.ts");
const { getCurrentAppAccessContext } = await import("../../lib/current-session-access-context.ts");
const { getCurrentSessionContext, resetCurrentAuthContextCache } = await import("../../lib/current-session-context.ts");
resolver.deregister();

const oldUser = { id: "first", app_metadata: { role: "administrator", status: "active" } };
const nextUser = { id: "second", app_metadata: { role: "client", status: "active" } };
const oldSession = { user: oldUser, access_token: "synthetic-old" };
const nextSession = { user: nextUser, access_token: "synthetic-new" };
const oldAccess = { role: "administrator", status: "active" };
const nextAccess = { role: "client", status: "active" };

function fixture() {
  let listener;
  const pending = { session: [], user: [], claims: [], access: [] };
  function request(key) {
    const next = pending[key].shift();
    assert(next, `unexpected ${key} request`);
    next.started.resolve();
    return next.response.promise;
  }
  const supabase = {
    auth: {
      onAuthStateChange(callback) {
        listener = callback;
        return { data: { subscription: { unsubscribe: () => { listener = undefined; } } } };
      },
      getSession: () => request("session"),
      getUser: () => request("user"),
      getClaims: () => request("claims"),
    },
    rpc: () => request("access"),
  };
  return {
    supabase,
    emit: (event, session) => listener(event, session),
    queue(key) {
      const started = Promise.withResolvers();
      const response = Promise.withResolvers();
      pending[key].push({ started, response });
      return {
        started: started.promise,
        deliver: (data) => response.resolve({ data, error: null }),
      };
    },
  };
}

test("退出后迟到的会话、用户、声明和数据库岗位均丢弃", async () => {
  const { supabase, emit, queue } = fixture();
  const session = queue("session");
  const user = queue("user");
  const claims = queue("claims");
  const access = queue("access");
  const reads = [
    getCurrentSession(supabase), getCurrentUser(supabase),
    getCurrentClaims(supabase), getCurrentAppAccessContext(supabase),
  ];
  emit("SIGNED_OUT", null);
  session.deliver({ session: oldSession });
  user.deliver({ user: oldUser });
  claims.deliver({ claims: { sub: oldUser.id } });
  access.deliver([oldAccess]);
  assert.deepEqual(await Promise.all(reads), [null, null, null, null]);
  assert.deepEqual(await Promise.all([
    getCurrentSession(supabase), getCurrentUser(supabase),
    getCurrentClaims(supabase), getCurrentAppAccessContext(supabase),
  ]), [null, null, null, null]);
});

test("旧权限请求结束时不能清除新账号正在执行的请求", async () => {
  const { supabase, emit, queue } = fixture();
  const old = queue("access");
  const next = queue("access");
  const before = getCurrentAppAccessContext(supabase);
  emit("SIGNED_IN", nextSession);
  const after = getCurrentAppAccessContext(supabase);
  old.deliver([oldAccess]);
  assert.equal(await before, null);
  const joined = getCurrentAppAccessContext(supabase);
  next.deliver([nextAccess]);
  assert.deepEqual(await Promise.all([after, joined]), [nextAccess, nextAccess]);
});

test("显式重置立即使尚未返回的请求失效", async () => {
  const { supabase, queue } = fixture();
  const old = queue("user");
  const before = getCurrentUser(supabase);
  resetCurrentAuthContextCache();
  old.deliver({ user: oldUser });
  assert.equal(await before, null);
  const next = queue("user");
  const after = getCurrentUser(supabase);
  next.deliver({ user: nextUser });
  assert.deepEqual(await after, nextUser);
});

test("组合结果不能把旧身份和新岗位放在一起，首次会话通知仍允许首轮读取", async (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = {};
  t.after(() => { globalThis.window = previousWindow; });
  const { supabase, emit, queue } = fixture();
  const session = queue("session");
  const user = queue("user");
  const claims = queue("claims");
  const access = queue("access");
  const current = getCurrentSessionContext(supabase);
  emit("INITIAL_SESSION", oldSession);
  session.deliver({ session: oldSession });
  user.deliver({ user: oldUser });
  claims.deliver({ claims: { sub: oldUser.id } });
  await access.started;
  emit("SIGNED_IN", nextSession);
  access.deliver([oldAccess]);
  assert.deepEqual(await current, { session: null, user: null, role: null, status: null });

  const freshUser = queue("user");
  const freshClaims = queue("claims");
  const freshAccess = queue("access");
  const fresh = getCurrentSessionContext(supabase);
  freshUser.deliver({ user: nextUser });
  freshClaims.deliver({ claims: { sub: nextUser.id } });
  freshAccess.deliver([nextAccess]);
  assert.deepEqual(await fresh, { session: nextSession, user: nextUser, ...nextAccess });
});
