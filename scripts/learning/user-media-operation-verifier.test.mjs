import assert from "node:assert/strict";
import test from "node:test";
import { expectUserMediaDeleteOperation } from "../../tests/e2e/helpers/user-media-operation-verifier.ts";

const run = "b1000000-0000-4000-8000-000000000001",
  asset = "b2000000-0000-4000-8000-000000000001";
function harness(mode = {}) {
  const calls = [],
    bodyError = new Error("read failed"),
    cleanupError = new Error("local logout failed");
  const deps = {
    readLocalEnvValue: (name) =>
      name.endsWith("URL")
        ? (mode.url ?? "http://127.0.0.1:48051")
        : "synthetic-public-key",
    getRegressionAccount: (role) => {
      calls.push(["account", role]);
      return { email: "fake@fixture.test", password: "synthetic-only" };
    },
    makeClient: (...args) => {
      calls.push(["client", args[2]]);
      return {
        auth: {
          signInWithPassword: async () => {
            calls.push(["login"]);
            return { error: mode.loginError ? bodyError : null };
          },
          signOut: async (options) => {
            calls.push(["logout", options]);
            if (mode.throwLogout) throw cleanupError;
            return { error: mode.logoutError ? cleanupError : null };
          },
        },
        rpc: async (name, body) => {
          calls.push(["rpc", name, body]);
          return {
            error: mode.rpcError ? bodyError : null,
            data: {
              completedAt: mode.badTime ? "" : "2026-11-11T00:00:00Z",
              failedCount: 0,
              succeededCount: 1,
              operationId: run,
              operationKey: "user-media-delete",
              status: "succeeded",
              resultProof: {
                deletedAssetIds: [asset],
                deletedCount: 1,
                storageDeletionVerified: !mode.fakeProof,
              },
            },
          };
        },
      };
    },
  };
  return { deps, calls, bodyError, cleanupError };
}
// 只验证原认证调用的依赖边界与local撤销协议；真实GoTrue双会话另在专属项目核对。
test("无效操作/资产编号不能读取凭据或创建认证连接", async () => {
  let calls = 0;
  await assert.rejects(
    expectUserMediaDeleteOperation("bad", asset, {
      readLocalEnvValue: () => {
        calls++;
      },
    }),
    /identity_invalid/,
  );
  assert.equal(calls, 0);
});
test("远程地址必须在获取账号或登录前拒绝", async () => {
  const h = harness({ url: "https://remote.invalid" });
  await assert.rejects(
    expectUserMediaDeleteOperation(run, asset, h.deps),
    /local_endpoint/,
  );
  assert.deepEqual(h.calls, []);
});
test("正确凭证读取原公开入口并只撤销本验证会话", async () => {
  const h = harness();
  await expectUserMediaDeleteOperation(run, asset, h.deps);
  assert.deepEqual(h.calls.find((c) => c[0] === "client")[1], {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  assert.deepEqual(
    h.calls.find((c) => c[0] === "rpc"),
    ["rpc", "get_operation_run", { p_operation_id: run }],
  );
  assert.deepEqual(h.calls.at(-1), ["logout", { scope: "local" }]);
});
test("登录失败不查询运行，也不撤销其他会话", async () => {
  const h = harness({ loginError: true });
  await assert.rejects(
    expectUserMediaDeleteOperation(run, asset, h.deps),
    (e) => e === h.bodyError,
  );
  assert(!h.calls.some((c) => c[0] === "rpc" || c[0] === "logout"));
});
test("伪Storage凭证、空完成时间和查询失败都保留失败并清理自身连接", async () => {
  for (const mode of [
    { fakeProof: true },
    { badTime: true },
    { rpcError: true },
  ]) {
    const h = harness(mode);
    await assert.rejects(expectUserMediaDeleteOperation(run, asset, h.deps));
    assert.deepEqual(h.calls.at(-1), ["logout", { scope: "local" }]);
  }
});
test("撤销返回错误或抛异常均同时保留正文和清理错误", async () => {
  for (const mode of [
    { rpcError: true, logoutError: true },
    { rpcError: true, throwLogout: true },
  ]) {
    const h = harness(mode);
    await assert.rejects(
      expectUserMediaDeleteOperation(run, asset, h.deps),
      (e) =>
        e instanceof AggregateError &&
        e.errors[0] === h.bodyError &&
        e.errors[1] === h.cleanupError,
    );
  }
});
