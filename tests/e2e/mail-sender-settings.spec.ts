import { expect } from "@playwright/test";
import { test, loginMailAccount as login } from "./helpers/mail-test";
import { SALESMAN_ID, PEER_SALESMAN_ID, ADMIN_ID } from "./helpers/mail-fixture-identity";
import { getMailAdmin } from "./helpers/mail-fixture-admin";

// 页面关键操作与独立凭证沿用原场景；自动夹具负责本例准备和模拟服务回收。
test("业务员修改并恢复自己的别名和 Ref，但不能修改其他人", async ({ page }) => {
  await login(page, "salesman");
  await page.goto("/salesman/mail");
  await page.getByRole("button", { name: "我的发件设置" }).click();
  const card = page.getByTestId(`mail-agent-${SALESMAN_ID}`);
  await card.getByLabel("加号别名").fill("local.sales.updated");
  await card.getByLabel("Ref 前缀").fill("LOCALNEW");
  await card.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("发件人配置已保存。")).toBeVisible();
  let profile = await getMailAdmin()
    .from("mail_agent_profiles")
    .select("alias_local_part,ref_prefix,version")
    .eq("user_id", SALESMAN_ID)
    .single();
  expect(profile.data).toMatchObject({
    alias_local_part: "local.sales.updated",
    ref_prefix: "LOCALNEW",
    version: 2,
  });

  const forbidden = await page.request.put("/api/mail/agents", {
    data: {
      memberId: PEER_SALESMAN_ID,
      aliasLocalPart: "stolen-alias",
      refPrefix: "STOLEN",
      senderDisplayName: "No access",
      signatureHtml: "",
      enabled: true,
      version: 1,
    },
  });
  expect(forbidden.ok()).toBe(false);
  const peer = await getMailAdmin()
    .from("mail_agent_profiles")
    .select("alias_local_part,ref_prefix,version")
    .eq("user_id", PEER_SALESMAN_ID)
    .single();
  expect(peer.data).toMatchObject({
    alias_local_part: "peer-sales",
    ref_prefix: "PEER",
    version: 1,
  });

  await card.getByRole("button", { name: "恢复系统建议" }).click();
  await expect(page.getByText("发件人配置已保存。")).toBeVisible();
  profile = await getMailAdmin()
    .from("mail_agent_profiles")
    .select("alias_local_part,ref_prefix,version")
    .eq("user_id", SALESMAN_ID)
    .single();
  expect(profile.data).toMatchObject({
    alias_local_part: "local.salesman",
    ref_prefix: "LOCALSALESMAN",
    version: 3,
  });
  await page.reload();
  await page.getByRole("button", { name: "我的发件设置" }).click();
  await expect(
    page.getByTestId(`mail-agent-${SALESMAN_ID}`).getByLabel("加号别名"),
  ).toHaveValue("local.salesman");
});

test("管理员可以修改管理员和业务员的发件设置", async ({ page }) => {
  await login(page, "administrator");
  await page.goto("/admin/mail");
  await page.getByRole("button", { name: "邮箱设置" }).click();
  const adminCard = page.getByTestId(`mail-agent-${ADMIN_ID}`);
  await expect(adminCard.getByText("管理员", { exact: true })).toBeVisible();
  await expect(adminCard.getByLabel("加号别名")).toHaveValue("local.admin");
  const peerCard = page.getByTestId(`mail-agent-${PEER_SALESMAN_ID}`);
  await peerCard.getByLabel("加号别名").fill("peer.custom");
  await peerCard.getByLabel("Ref 前缀").fill("PEERCUSTOM");
  await peerCard.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("发件人配置已保存。")).toBeVisible();
  const { data: profile } = await getMailAdmin()
    .from("mail_agent_profiles")
    .select("alias_local_part,ref_prefix,version")
    .eq("user_id", PEER_SALESMAN_ID)
    .single();
  expect(profile).toMatchObject({
    alias_local_part: "peer.custom",
    ref_prefix: "PEERCUSTOM",
    version: 2,
  });
  await page.reload();
  await page.getByRole("button", { name: "邮箱设置" }).click();
  await expect(
    page.getByTestId(`mail-agent-${PEER_SALESMAN_ID}`).getByLabel("加号别名"),
  ).toHaveValue("peer.custom");
});
