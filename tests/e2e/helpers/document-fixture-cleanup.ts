import { appendFileSync } from "node:fs";
import { getRegressionAccount, type RegressionRole } from "./accounts";
import { documentAdmin, documentReader } from "./document-access";
import { createDocumentFixtureStore } from "../../test-support/document-fixture-store";
import { cleanupDocumentFixtures } from "../../test-support/document-fixture-cleanup";
import { readStorageObjectPresence } from "@/lib/storage-operation-object-presence";

/** 批次权限属于发起人；管理员身份不能替代其他岗位释放锁。 */
async function readerForActor(actorId: string) {
  const profile = await documentAdmin()
    .from("user_profiles")
    .select("email")
    .eq("user_id", actorId)
    .single();
  if (profile.error) throw profile.error;
  const roles: RegressionRole[] = [
    "administrator",
    "manager",
    "operator",
    "recruiter",
    "salesman",
    "promoter",
    "finance",
    "client",
  ];
  const role = roles.find(
    (candidate) => getRegressionAccount(candidate).email === profile.data.email,
  );
  if (!role) throw new Error("fixture_batch_actor_not_seeded");
  const reader = await documentReader(role);
  const identity = await reader.auth.getUser();
  if (identity.error) throw identity.error;
  if (identity.data.user?.id !== actorId)
    throw new Error("fixture_batch_actor_mismatch");
  return reader;
}

/** 原测试入口继续负责提供能力；核心和存储模块自身不寻找认证入口。 */
export async function cleanupDocuments(prefix: string) {
  const store = createDocumentFixtureStore(
    documentAdmin(),
    readerForActor,
    readStorageObjectPresence,
  );
  const receipts = await cleanupDocumentFixtures(prefix, store);
  for (const receipt of receipts) {
    appendFileSync(
      "output/document-explorer-batches.jsonl",
      JSON.stringify(receipt) + "\n",
    );
  }
}
