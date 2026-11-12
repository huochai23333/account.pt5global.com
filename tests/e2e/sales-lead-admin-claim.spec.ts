import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { loginAs, setTestLocale } from "./helpers/auth";
import { saveOpenLeadAsCustomer, cleanupSalesLeadConversion } from "./helpers/sales-lead-conversion";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
import { readLocalPostgresRows, localSqlValue } from "./helpers/local-postgres-query";
import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import { buildLearningLeadWriteSql, buildLearningLeadReadSql, verifyLearningLeadReceipt } from "../../../PT5-dropshipping-supabase/scripts/learning-lead-fixture-sql.mjs";

test.describe("lead rules and administrator claims", () => {
  test.setTimeout(120_000);
  test.beforeEach(({ baseURL }) => {
    // 登录和列表读取也可能写记录，先验证本次专属API/DB及暂停状态。
    readDisposablePostgresTarget({ baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      mode: process.env.PT5_E2E_FIXTURE_MODE, project: process.env.PT5_E2E_DATABASE_PROJECT,
      container: process.env.PT5_E2E_DATABASE_CONTAINER }, args =>
      execFileSync("docker", args, { encoding: "utf8", timeout: 12000, windowsHide: true }).trim());
  });

  test("both roles see complete rules above the boards in Chinese and English", async ({ browser, baseURL }, testInfo) => {
    for (const role of ["administrator", "salesman"] as const) {
      const context = await browser.newContext({ baseURL }), errors: unknown[] = [];
      try {
        const page = await context.newPage();
        await loginAs(page, role);
        for (const locale of ["zh", "en"] as const) {
          await setTestLocale(page, locale);
          await page.goto(`/${role === "administrator" ? "admin" : role}/wholesale/leads`);
          const rules = page.getByTestId("sales-lead-rules");
          await expect(rules.locator("dt")).toHaveText(locale === "zh"
            ? ["30天内成为客户"] : ["Convert within 30 days"]);
          await expect(rules.locator("dd").last()).toContainText(locale === "zh" ? "记录联系不会延长期限" : "Contact records do not extend");
          await expect(rules.locator("p")).toContainText(locale === "zh" ? "管理员和业务员遵循相同规则" : "Administrators and salespeople follow the same rules");
          for (const width of [1440, 375, 390]) {
            await page.setViewportSize({ width, height: 900 });
            const visibleRules = width < 768 ? rules : page.getByTestId("sales-lead-rules-desktop");
            // 375切到390仍是同一details，不重复点击已展开的summary把规则关掉。
            if (width < 768 && await visibleRules.getAttribute("open") === null) await visibleRules.locator("summary").click();
            await visibleRules.scrollIntoViewIfNeeded();
            const board = page.getByRole("button", { name: locale === "zh" ? "我的线索" : "My Leads" });
            const rulesBox = await visibleRules.boundingBox(), boardBox = await board.boundingBox();
            expect(rulesBox).not.toBeNull();
            expect(boardBox).not.toBeNull();
            expect(rulesBox!.y + rulesBox!.height).toBeLessThanOrEqual(boardBox!.y);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
            // 必须真的存在规则文字，空集合的every不能算排版通过。
            const text = visibleRules.locator("dt, dd, p");
            await expect(text.first()).toBeVisible();
            expect(await text.evaluateAll(elements => elements.length > 0 && elements.every(element => {
              const rect = element.getBoundingClientRect();
              return rect.width >= 100 && element.scrollWidth <= element.clientWidth + 1;
            }))).toBe(true);
            await page.screenshot({ path: testInfo.outputPath(`lead-rules-${role}-${locale}-${width}.png`) });
          }
          await page.getByRole("button", { name: locale === "zh" ? "我的线索" : "My Leads" }).click();
          await expect(page.getByTestId("sales-lead-rules")).toBeVisible();
        }
      } catch (error) { errors.push(error); }
      await finishLeadTest(errors, [() => context.close()]);
    }
  });

  test("administrator claims for self, records contact, returns, reclaims and converts the lead", async ({ browser, baseURL }) => {
    await withOwnedLead(baseURL, async fixture => {
      const page = await fixture.openPage(browser), account = await loginAs(page, "administrator");
      const actor = readActorQuota("email", account.email);
      // 本例自己领取两次；额度不足时明确失败，不改历史claimed_at为测试腾位置。
      expect(actor.claim_count).toBeLessThanOrEqual(3);
      const contactNote = `管理员已联系客户，等待确认采购清单 ${fixture.id}`;
      await page.goto("/admin/wholesale/leads");
      await page.getByRole("button", { name: "线索大厅", exact: true }).click();
      await page.getByLabel("搜索线索").fill(fixture.name);
      const claimId = `claim-lead-${fixture.id}`;
      await page.getByTestId(claimId).click();
      await expect.poll(() => readLeadSnapshot(fixture.id).current_assignee_user_id).toBe(actor.user_id);
      const claimed = readLeadSnapshot(fixture.id);
      expect(claimed.history).toHaveLength(1);
      expect(claimed.history[0]).toMatchObject({ assignee_user_id: actor.user_id, claimed_by_user_id: actor.user_id });
      await expect(page.getByRole("button", { name: "我的线索" })).toHaveAttribute("aria-pressed", "true");
      await openLead(page, fixture.name);
      await expect(page.getByRole("region", { name: "跟进进度" }).getByText("成为客户截止时间")).toBeVisible();
      await page.getByRole("button", { name: "记录联系", exact: true }).click();
      await page.getByTestId("sales-lead-action-note").fill(contactNote);
      await page.getByTestId("submit-lead-contact").click();
      await expect.poll(() => readLeadSnapshot(fixture.id).contacts.length).toBe(1);
      const contacted = readLeadSnapshot(fixture.id);
      expect(contacted.contacts[0]).toMatchObject({ author_user_id: actor.user_id, assignment_id: claimed.current_assignment_id, note: contactNote });
      await openLead(page, fixture.name);
      await expect(page.getByRole("region", { name: "联系记录", exact: true }).getByText(contactNote, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "退回大厅", exact: true }).click();
      const returnNote = `调整跟进计划后退回 ${fixture.id}`;
      await page.getByTestId("sales-lead-action-note").fill(returnNote);
      await page.getByTestId("submit-lead-return").click();
      await expect.poll(() => readLeadSnapshot(fixture.id).status).toBe("hall");
      const returned = readLeadSnapshot(fixture.id);
      expect(returned.history[0]).toMatchObject({ ended_by_user_id: actor.user_id, ended_reason: "admin_return", end_note: returnNote });
      await page.getByRole("button", { name: "线索大厅" }).click();
      await page.getByTestId(claimId).click();
      await expect.poll(() => readLeadSnapshot(fixture.id).current_assignee_user_id).toBe(actor.user_id);
      await openLead(page, fixture.name);
      await expect(page.getByRole("region", { name: "联系记录", exact: true }).getByText(contactNote, { exact: true })).toBeVisible();
      fixture.markConversion();
      const proof = await saveOpenLeadAsCustomer(page, fixture.id, `管理员跟进的客户已确认合作 ${fixture.id}`);
      expect(proof.owner).toBe(actor.user_id);
      const converted = readLeadSnapshot(fixture.id);
      expect(converted.customer_id).toBe(proof.customer_id);
      expect(converted.history).toHaveLength(2);
      expect(converted.history[0]).toEqual(returned.history[0]);
      expect(converted.history[1]).toMatchObject({ assignee_user_id: actor.user_id, ended_by_user_id: actor.user_id, ended_reason: "converted" });
      expect(converted.contacts).toEqual(contacted.contacts);
      expect(readActorQuota("user_id", actor.user_id, false).claim_count).toBe(actor.claim_count + 2);
      await page.reload();
      await page.getByRole("button", { name: /^已成为客户/ }).click();
      await openLead(page, fixture.name);
      await expect(page.getByRole("region", { name: "跟进进度" }).getByText(proof.customer_id!, { exact: true })).toBeVisible();
      expect(readLeadSnapshot(fixture.id)).toEqual(converted);
    });
  });

  test("administrator and salesperson cannot claim the same lead together", async ({ browser, baseURL }) => {
    await withOwnedLead(baseURL, async fixture => {
      const admin = await fixture.openPage(browser), sales = await fixture.openPage(browser);
      const accounts = await Promise.all([loginAs(admin, "administrator"), loginAs(sales, "salesman")]);
      const actors = accounts.map(account => readActorQuota("email", account.email));
      expect(actors[0].user_id).not.toBe(actors[1].user_id);
      await Promise.all([admin.goto("/admin/wholesale/leads"), sales.goto("/salesman/wholesale/leads")]);
      const id = `claim-lead-${fixture.id}`;
      for (const page of [admin, sales]) {
        await page.getByRole("button", { name: "线索大厅", exact: true }).click();
        await page.getByLabel("搜索线索").fill(fixture.name);
        await expect(page.getByTestId(id)).toBeVisible();
      }
      const claimResponses = [admin, sales].map(page => page.waitForResponse(response =>
        response.url().endsWith("/rpc/claim_sales_lead") && response.request().method() === "POST"));
      // 同时提交两个已经渲染的按钮，保留原竞争场景；返回后另查唯一实际周期和双方额度。
      await Promise.all([admin, sales].map(page => page.getByTestId(id).evaluate((button: HTMLElement) => button.click())));
      const results = await Promise.all(claimResponses);
      expect(results.filter(response => response.ok())).toHaveLength(1);
      expect((await results.find(response => !response.ok())!.json()).message).toBe("sales_lead_already_claimed");
      const winnerIndex = results[0].ok() ? 0 : 1, loserIndex = 1 - winnerIndex;
      const claimed = readLeadSnapshot(fixture.id);
      expect(claimed.status).toBe("claimed");
      expect(claimed.current_assignee_user_id).toBe(actors[winnerIndex].user_id);
      expect(claimed.contacts).toHaveLength(0);
      expect(claimed.history).toHaveLength(1);
      expect(claimed.history[0]).toMatchObject({ id: claimed.current_assignment_id, assignee_user_id: actors[winnerIndex].user_id,
        claimed_by_user_id: actors[winnerIndex].user_id, ended_at: null });
      for (const index of [winnerIndex, loserIndex]) expect(readActorQuota("user_id", actors[index].user_id, false).claim_count)
        .toBe(actors[index].claim_count + (index === winnerIndex ? 1 : 0));
      await Promise.all([admin, sales].map(page => page.reload()));
      await Promise.all([admin, sales].map(page => page.getByRole("button", { name: "我的线索" }).click()));
      const winner = [admin, sales][winnerIndex], loser = [admin, sales][loserIndex];
      await expect(winner.getByRole("heading", { name: fixture.name, exact: true })).toBeVisible();
      await expect(loser.getByRole("heading", { name: fixture.name, exact: true })).toHaveCount(0);
      expect(readLeadSnapshot(fixture.id)).toEqual(claimed);
      await openLead(winner, fixture.name);
      await winner.getByRole("button", { name: "退回大厅", exact: true }).click();
      const note = `并发验证后退回大厅 ${fixture.id}`;
      await winner.getByTestId("sales-lead-action-note").fill(note);
      await winner.getByTestId("submit-lead-return").click();
      await expect.poll(() => readLeadSnapshot(fixture.id).status).toBe("hall");
      const returned = readLeadSnapshot(fixture.id);
      expect(returned.history[0]).toMatchObject({ id: claimed.current_assignment_id, ended_by_user_id: actors[winnerIndex].user_id,
        ended_reason: winnerIndex === 0 ? "admin_return" : "voluntary_return", end_note: note });
      await winner.reload();
      await winner.getByRole("button", { name: "线索大厅", exact: true }).click();
      await winner.getByLabel("搜索线索").fill(fixture.name);
      await expect(winner.getByRole("heading", { name: fixture.name, exact: true })).toBeVisible();
      expect(readLeadSnapshot(fixture.id)).toEqual(returned);
    });
  });
});

async function openLead(page: Page, name: string) {
  await page.getByTestId("sales-lead-list").locator('[data-testid^="sales-lead-row-"]').filter({ has: page.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "查看详情" }).click();
}

type OwnedLead = { id: string; name: string; markConversion: () => void; openPage: (browser: Browser) => Promise<Page> };
type LeadSnapshot = { id: string; status: string; customer_id: string | null; current_assignee_user_id: string | null;
  current_assignment_id: string | null; history: Record<string, unknown>[]; contacts: Record<string, unknown>[] };

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
