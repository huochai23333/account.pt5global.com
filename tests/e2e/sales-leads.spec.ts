import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { getPeerSalesmanRegressionAccount } from "./helpers/accounts";
import { expectForbiddenPage, loginAs, loginWithAccount } from "./helpers/auth";
import { saveOpenLeadAsCustomer, cleanupSalesLeadConversion } from "./helpers/sales-lead-conversion";
import { chooseSelectOption, getSelectOptionValueAt } from "./helpers/select-control";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
import { readLocalPostgresRows, localSqlValue } from "./helpers/local-postgres-query";
import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import { buildLearningLeadWriteSql, buildLearningLeadReadSql, verifyLearningLeadReceipt } from "../../../PT5-dropshipping-supabase/scripts/learning-lead-fixture-sql.mjs";

test.describe.serial("sales lead hall", () => {
  test.setTimeout(120_000);
  test.beforeEach(({ baseURL }) => {
    // 固定角色的登录和线索读取也有写入；每个场景先核对专属API/DB及暂停状态。
    readDisposablePostgresTarget({ baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      mode: process.env.PT5_E2E_FIXTURE_MODE, project: process.env.PT5_E2E_DATABASE_PROJECT,
      container: process.env.PT5_E2E_DATABASE_CONTAINER }, args =>
      execFileSync("docker", args, { encoding: "utf8", timeout: 12000, windowsHide: true }).trim());
  });

  test("two salespeople compete for one lead and keep the full history", async ({ browser, baseURL }) => {
    const peerAccount = getPeerSalesmanRegressionAccount();
    test.skip(!peerAccount, "需要第二名专属本地业务员核对竞争结果。");
    if (!peerAccount) return;
    await withOwnedLead(baseURL, async fixture => {
      const contactNote = `客户希望下周收到完整报价单 ${fixture.id}`;
      const returnNote = `交给更熟悉该市场的同事继续联系 ${fixture.id}`;
      const firstPage = await fixture.openPage(browser), peerPage = await fixture.openPage(browser);
      const firstAccount = await loginAs(firstPage, "salesman");
      await loginWithAccount(peerPage, peerAccount);
      const firstActor = readActorQuota("email", firstAccount.email), peerActor = readActorQuota("email", peerAccount.email);
      expect(firstActor.user_id).not.toBe(peerActor.user_id);
      await Promise.all([firstPage.goto("/salesman/wholesale/leads"), peerPage.goto("/salesman/wholesale/leads")]);
      for (const page of [firstPage, peerPage]) {
        await page.getByRole("button", { name: "线索大厅", exact: true }).click();
        await page.getByLabel("搜索线索").fill(fixture.name);
        await expect(page.getByTestId(`claim-lead-${fixture.id}`)).toBeVisible();
      }
      // 先等待第一份请求完成并查到真实负责人，再提交另一页面保留的旧按钮；失败不能建立新周期。
      const firstClaim = firstPage.waitForResponse(response => response.url().includes("/rpc/claim_sales_lead"));
      await firstPage.getByTestId(`claim-lead-${fixture.id}`).click();
      expect((await firstClaim).ok()).toBe(true);
      await expect.poll(() => readLeadSnapshot(fixture.id).current_assignee_user_id).toBe(firstActor.user_id);
      const claimed = readLeadSnapshot(fixture.id);
      const rejected = peerPage.waitForResponse(response => response.url().includes("/rpc/claim_sales_lead"));
      await peerPage.getByTestId(`claim-lead-${fixture.id}`).click();
      expect((await rejected).ok()).toBe(false);
      await expect(peerPage.getByText("这条线索刚刚已被其他业务员认领。")).toBeVisible();
      expect(readLeadSnapshot(fixture.id)).toEqual(claimed);

      await firstPage.getByRole("button", { name: "我的线索" }).click();
      await openLead(firstPage, fixture.name);
      await firstPage.getByRole("button", { name: "记录联系" }).click();
      await firstPage.getByTestId("sales-lead-action-note").fill(contactNote);
      await firstPage.getByTestId("submit-lead-contact").click();
      await expect.poll(() => readLeadSnapshot(fixture.id).contacts.length).toBe(1);
      const contacted = readLeadSnapshot(fixture.id);
      expect(contacted.contacts[0]).toMatchObject({ note: contactNote, author_user_id: firstActor.user_id,
        assignment_id: claimed.current_assignment_id });
      await openLead(firstPage, fixture.name);
      await expect(firstPage.getByRole("region", { name: "联系记录", exact: true }).getByText(contactNote, { exact: true })).toBeVisible();
      await firstPage.getByRole("button", { name: "退回大厅" }).click();
      await firstPage.getByTestId("sales-lead-action-note").fill(returnNote);
      await firstPage.getByTestId("submit-lead-return").click();
      await expect.poll(() => readLeadSnapshot(fixture.id).status).toBe("hall");
      const returned = readLeadSnapshot(fixture.id);
      expect(returned.history).toHaveLength(1);
      expect(returned.history[0]).toMatchObject({ assignee_user_id: firstActor.user_id, ended_reason: "voluntary_return",
        ended_by_user_id: firstActor.user_id, end_note: returnNote });

      await peerPage.reload();
      await peerPage.getByRole("button", { name: "线索大厅", exact: true }).click();
      await peerPage.getByLabel("搜索线索").fill(fixture.name);
      await peerPage.getByTestId(`claim-lead-${fixture.id}`).click();
      await expect.poll(() => readLeadSnapshot(fixture.id).current_assignee_user_id).toBe(peerActor.user_id);
      await peerPage.getByRole("button", { name: "我的线索" }).click();
      await openLead(peerPage, fixture.name);
      await expect(peerPage.getByRole("region", { name: "联系记录", exact: true }).getByText(contactNote, { exact: true })).toBeVisible();
      await expect(peerPage.getByRole("region", { name: "认领记录", exact: true }).getByText(`业务员主动退回 · ${returnNote}`, { exact: true })).toBeVisible();
      fixture.markConversion();
      const proof = await saveOpenLeadAsCustomer(peerPage, fixture.id, `客户已确认合作资料 ${fixture.id}`);
      const converted = readLeadSnapshot(fixture.id);
      expect(converted.status).toBe("converted");
      expect(converted.customer_id).toBe(proof.customer_id);
      expect(converted.history).toHaveLength(2);
      expect(converted.contacts).toEqual(contacted.contacts);
      expect(converted.history[0]).toEqual(returned.history[0]);
      expect(converted.history[1]).toMatchObject({ assignee_user_id: peerActor.user_id, ended_reason: "converted" });
      await peerPage.reload();
      await peerPage.getByRole("button", { name: /^已成为客户/ }).click();
      await openLead(peerPage, fixture.name);
      await expect(peerPage.getByRole("region", { name: "跟进进度" }).getByText("客户编号")).toBeVisible();
      expect(readLeadSnapshot(fixture.id)).toEqual(converted);
    });
  });

  test("administrator can assign hall leads and the page fits desktop and mobile", async ({ browser, baseURL }) => {
    await withOwnedLead(baseURL, async fixture => {
      const page = await fixture.openPage(browser), account = await loginAs(page, "administrator");
      // 安排他人不消耗管理员本人的认领额度，下面单独核对实际接收人的额度。
      const actor = readActorQuota("email", account.email, false);
      await page.goto("/admin/wholesale/leads");
      await expect(page.getByRole("button", { name: "立即同步" })).toBeVisible();
      await page.getByLabel("搜索线索").fill(fixture.name);
      for (const width of [1440, 375, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await expectNoHorizontalOverflow(page);
        await expect(page.getByRole("heading", { name: fixture.name, exact: true })).toBeVisible();
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await openLead(page, fixture.name);
      await page.getByRole("button", { name: "安排业务员" }).click();
      const assignee = page.getByRole("dialog").getByRole("combobox");
      const assigneeId = await getSelectOptionValueAt(assignee, 0);
      readActorQuota("user_id", assigneeId);
      await chooseSelectOption(assignee, { value: assigneeId });
      const assignNote = `安排业务员继续新的联系周期 ${fixture.id}`;
      await page.getByTestId("sales-lead-action-note").fill(assignNote);
      await page.getByTestId("submit-lead-assign").click();
      await expect.poll(() => readLeadSnapshot(fixture.id).current_assignee_user_id).toBe(assigneeId);
      const assigned = readLeadSnapshot(fixture.id);
      expect(assigned.history).toHaveLength(1);
      expect(assigned.history[0]).toMatchObject({ assignee_user_id: assigneeId, claimed_by_user_id: actor.user_id });
      await page.getByRole("button", { name: "全部认领" }).click();
      await page.getByLabel("搜索线索").fill(fixture.name);
      await openLead(page, fixture.name);
      await page.getByRole("button", { name: "退回大厅", exact: true }).click();
      const returnNote = `测试结束后退回大厅 ${fixture.id}`;
      await page.getByTestId("sales-lead-action-note").fill(returnNote);
      await page.getByTestId("submit-lead-return").click();
      await expect.poll(() => readLeadSnapshot(fixture.id).status).toBe("hall");
      const returned = readLeadSnapshot(fixture.id);
      expect(returned.current_assignee_user_id).toBeNull();
      expect(returned.history[0]).toMatchObject({ id: assigned.current_assignment_id, ended_by_user_id: actor.user_id,
        ended_reason: "admin_return", end_note: returnNote });
      await page.reload();
      await page.getByRole("button", { name: "线索大厅", exact: true }).click();
      await page.getByLabel("搜索线索").fill(fixture.name);
      await expect(page.getByRole("heading", { name: fixture.name, exact: true })).toBeVisible();
      expect(readLeadSnapshot(fixture.id)).toEqual(returned);
    });
  });

  test("finance and client cannot open lead pages", async ({ browser, baseURL }) => {
    for (const role of ["finance", "client"] as const) {
      const context = await browser.newContext({ baseURL }), errors: unknown[] = [];
      try {
        const page = await context.newPage();
        await loginAs(page, role);
        await page.goto(`/${role}/wholesale/leads`);
        await expectForbiddenPage(page);
      } catch (error) { errors.push(error); }
      await finishLeadTest(errors, [() => context.close()]);
    }
  });
});

type OwnedLead = { id: string; name: string; markConversion: () => void; openPage: (browser: Browser) => Promise<Page> };
type LeadSnapshot = { id: string; status: string; customer_id: string | null; current_assignee_user_id: string | null;
  current_assignment_id: string | null; history: Record<string, unknown>[]; contacts: Record<string, unknown>[] };

/** 核对真实影响数与另连接读回，复用后端学习夹具的锁后归属和原子清理，不移动其他领取历史。 */
function executeOwnedLead(action: "create" | "cleanup", id: string) {
  const output = runLocalSupabaseSql(buildLearningLeadWriteSql(action, id));
  const receipts = output.split(/\r?\n/).filter(line => line.startsWith("WRITE_RECEIPT "));
  if (receipts.length !== 1) throw new Error("本次线索影响行数未确认");
  const affected = JSON.parse(receipts[0].slice("WRITE_RECEIPT ".length)).affected;
  const receipt = JSON.parse(runLocalSupabaseSql(buildLearningLeadReadSql(id)));
  return verifyLearningLeadReceipt(action, receipt, affected);
}

async function withOwnedLead(baseURL: string | undefined, run: (lead: OwnedLead) => Promise<void>) {
  if (!baseURL) throw new Error("线索测试需要显式本地页面地址");
  const id = randomUUID(), contexts: BrowserContext[] = [], errors: unknown[] = [];
  let conversionStarted = false;
  const fixture: OwnedLead = { id, name: "", markConversion: () => { conversionStarted = true; },
    openPage: async browser => { const context = await browser.newContext({ baseURL }); contexts.push(context); return context.newPage(); } };
  try {
    // ID在准备前登记；任一步丢回执仍能按精确身份核对，不能预删固定日期或来源前缀。
    fixture.name = executeOwnedLead("create", id).lead.name;
    const updated = runLocalSupabaseSql(`update public.sales_leads set email=${localSqlValue(`${id}@example.test`)}
      where id=${localSqlValue(id)} and primary_source_lead_id=${localSqlValue(`PT5-LEARNING-${id}`)} returning id;`);
    if (updated !== id) throw new Error("本次线索公开联系方式未确认");
    await run(fixture);
  } catch (error) { errors.push(error); }
  await finishLeadTest(errors, [
    ...contexts.map(context => () => context.close()),
    async () => { if (conversionStarted) return cleanupSalesLeadConversion(id); },
    async () => executeOwnedLead("cleanup", id),
  ], id);
}

/** 收尾失败不能挡住后续步骤，正文/上下文/数据库原错误全部保留，包括非Error抛出值。 */
async function finishLeadTest(errors: unknown[], steps: (() => Promise<unknown>)[], fixtureId?: string) {
  try { await cleanupFixtureResources(...steps); }
  catch (error) { errors.push(...(error instanceof AggregateError ? error.errors : [error])); }
  if (errors.length) throw new AggregateError(errors, `线索大厅验证未完成${fixtureId ? `，本次编号 ${fixtureId}` : ""}`);
}

function readActorQuota(column: "email" | "user_id", value: string, needsClaimRoom = true) {
  const rows = readLocalPostgresRows<{ user_id: string; claim_count: number }>(`select p.user_id,
    (select count(*)::integer from public.sales_lead_assignments a where a.assignee_user_id=p.user_id
      and a.claimed_at >= (date_trunc('day',now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
      and a.claimed_at < ((date_trunc('day',now() at time zone 'Asia/Shanghai')+interval '1 day') at time zone 'Asia/Shanghai')) as claim_count
    from public.user_profiles p where p.${column}=${localSqlValue(value)}`);
  expect(rows).toHaveLength(1);
  expect(rows[0].user_id).toMatch(/^[a-f0-9-]{36}$/i);
  // 固定角色须留有当天额度；准备不足就失败，不改已有claimed_at来腾额度。
  if (needsClaimRoom) expect(rows[0].claim_count, "专属账号当天认领额度不足，请准备可重建夹具").toBeLessThan(5);
  return rows[0];
}

function readLeadSnapshot(id: string) {
  const rows = readLocalPostgresRows<LeadSnapshot>(`select l.*,l.xmin::text as row_version,
    (select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('row_version',a.xmin::text)order by a.claimed_at,a.id),'[]'::jsonb)
      from public.sales_lead_assignments a where a.lead_id=l.id)as history,
    (select coalesce(jsonb_agg(to_jsonb(n)||jsonb_build_object('row_version',n.xmin::text)order by n.created_at,n.id),'[]'::jsonb)
      from public.sales_lead_contact_notes n where n.lead_id=l.id)as contacts
    from public.sales_leads l where l.id=${localSqlValue(id)}`);
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function openLead(page: Page, leadName: string) {
  const card = page.locator('[data-testid^="sales-lead-row-"]').filter({ has: page.getByRole("heading", { name: leadName, exact: true }) });
  await card.getByRole("button", { name: "查看详情" }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const squeezedText = await page.locator("main *").evaluateAll((elements) => elements.some((element) => {
    const rect = element.getBoundingClientRect();
    const text = element.textContent?.trim() ?? "";
    return text.length >= 4 && rect.width > 0 && rect.width < 18 && rect.height > rect.width * 3;
  }));
  expect(squeezedText).toBe(false);
}
