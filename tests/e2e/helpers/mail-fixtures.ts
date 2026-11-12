import { getMailAdmin } from "./mail-fixture-admin";
import { clearIntegratedMailFixture } from "./mail-fixture-reset";
import { seedMailFixtureMailbox } from "./mail-fixture-mailbox";
import { seedMailFixtureAgents } from "./mail-fixture-agents";
import { seedMailFixtureConversation } from "./mail-fixture-messages";

/** 只调度专用实例的准备顺序；任一步缺少独立凭证即停止，不进入后续测试。 */
export async function resetIntegratedMailFixture() {
  const client = getMailAdmin();
  await clearIntegratedMailFixture(client);
  const now = new Date().toISOString();
  await seedMailFixtureMailbox(client, now);
  await seedMailFixtureAgents(client);
  await seedMailFixtureConversation(client, now);
}
