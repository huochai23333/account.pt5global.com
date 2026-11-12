import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

type Dependencies = {
  readLocalEnvValue: (name: string) => string | null | undefined;
  getRegressionAccount: (role: "operator") => {
    email: string;
    password: string;
  };
  makeClient?: typeof createClient;
};
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

/** 原凭据读取器与原运营账号由页面入口传入；不在新模块导入受限辅助文件或替换认证实现。 */
export async function expectUserMediaDeleteOperation(
  operationId: unknown,
  deletedAssetId: string,
  deps: Dependencies,
) {
  if (
    typeof operationId !== "string" ||
    !uuid.test(operationId) ||
    !uuid.test(deletedAssetId)
  )
    throw new Error("media_operation_identity_invalid");
  const url = deps.readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    deps.readLocalEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    deps.readLocalEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key)
    throw new Error("local_supabase_public_credentials_required");
  const endpoint = new URL(url);
  if (
    endpoint.protocol !== "http:" ||
    !endpoint.port ||
    !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname) ||
    endpoint.username ||
    endpoint.password
  )
    throw new Error("media_verifier_requires_local_endpoint");
  const verifier = (deps.makeClient ?? createClient)(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const account = deps.getRegressionAccount("operator");
  let signedIn = false,
    bodyError: unknown;
  try {
    const { error: signInError } = await verifier.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (signInError) throw signInError;
    signedIn = true;
    const { data, error } = await verifier.rpc("get_operation_run", {
      p_operation_id: operationId,
    });
    if (error) throw error;
    expect(data).toMatchObject({
      completedAt: expect.any(String),
      failedCount: 0,
      operationId,
      operationKey: "user-media-delete",
      resultProof: {
        deletedAssetIds: [deletedAssetId],
        deletedCount: 1,
        storageDeletionVerified: true,
      },
      status: "succeeded",
      succeededCount: 1,
    });
    if (!Number.isFinite(Date.parse(data.completedAt)))
      throw new Error("media_operation_completion_invalid");
  } catch (error) {
    bodyError = error;
    throw error;
  } finally {
    if (signedIn) {
      // 默认signOut会影响该账号其他会话；local只撤销本验证连接，不能登出正在验收的浏览器。
      let error: unknown;
      try {
        error = (await verifier.auth.signOut({ scope: "local" })).error;
      } catch (failure) {
        error = failure;
      }
      if (error) {
        if (bodyError)
          throw new AggregateError(
            [bodyError, error],
            "media_verifier_body_and_cleanup_failed",
          );
        throw error;
      }
    }
  }
}
