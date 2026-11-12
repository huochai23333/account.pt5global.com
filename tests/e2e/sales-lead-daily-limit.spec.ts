import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { loginAs, setTestLocale } from "./helpers/auth";
import { runLocalSupabaseSql } from "./helpers/local-supabase";
import { readLocalPostgresRows, localSqlValue as quote } from "./helpers/local-postgres-query";
import { readDisposablePostgresTarget } from "../test-support/disposable-fixture";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import { buildLearningLeadWriteSql, buildLearningLeadReadSql, verifyLearningLeadReceipt } from "../../../PT5-dropshipping-supabase/scripts/learning-lead-fixture-sql.mjs";

test.beforeEach(({ baseURL }) => {
  // 声明与实际DB/Kong/API、暂停状态都核对后，才允许登录和准备前四次认领。
  readDisposablePostgresTarget({ baseURL, supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.PT5_E2E_FIXTURE_MODE, project: process.env.PT5_E2E_DATABASE_PROJECT,
    container: process.env.PT5_E2E_DATABASE_CONTAINER }, args =>
    execFileSync("docker", args, { encoding: "utf8", timeout: 12000, windowsHide: true }).trim());
});

test.describe("sales lead daily claim limit", () => {
  test.setTimeout(120_000);
  test("the fifth lead succeeds and every later page attempt keeps the database at five", async ({ page }) => {
    const account = await loginAs(page, "salesman");
    await withDailyLimitFixture(page, account.email, async fixture => {
      const fifth = fixture.leads[4], sixth = fixture.leads[5];
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/salesman/wholesale/leads");
      // 页面当前介绍30天期限；每日5次仍由数据库及拒绝提示证明，不断言已移除的规则文案。
      const rules = page.getByTestId("sales-lead-rules-desktop");
      await expect(rules.locator("dt")).toHaveText(["30天内成为客户"]);
      await expectNoHorizontalOverflow(page);
      await page.getByRole("button", { name: "线索大厅", exact: true }).click();
      await page.getByLabel("搜索线索").fill(fifth.name);
      const fifthLead = getLeadRow(page, fifth.name);
      await expect(fifthLead).toBeVisible();
      const fifthResponse = page.waitForResponse(response => response.url().endsWith("/rpc/claim_sales_lead") && response.request().method() === "POST");
      // 第五次必须由原页面发起；独立读回实际负责人、唯一周期和全天总数才算完成。
      await fifthLead.getByRole("button", { name: "认领线索" }).click();
      expect((await fifthResponse).ok()).toBe(true);
      await expect.poll(() => readDailyLimitProof(fixture.actorId, fifth.id).daily_claims).toBe(5);
      const claimed = readDailyLimitProof(fixture.actorId, fifth.id);
      expect(claimed).toMatchObject({ daily_claims: 5, status: "claimed", current_assignee_user_id: fixture.actorId });
      expect(claimed.history).toHaveLength(1);
      expect(claimed.history[0]).toMatchObject({ id: claimed.current_assignment_id, assignee_user_id: fixture.actorId,
        claimed_by_user_id: fixture.actorId, ended_at: null });
      await expect(page.getByRole("button", { name: "我的线索" })).toHaveAttribute("aria-pressed", "true");

      await page.getByRole("button", { name: "线索大厅" }).click();
      await page.getByLabel("搜索线索").fill(sixth.name);
      const unclaimed = readDailyLimitProof(fixture.actorId, sixth.id);
      expect(unclaimed).toMatchObject({ daily_claims: 5, status: "hall", current_assignee_user_id: null, current_assignment_id: null });
      expect(unclaimed.history).toHaveLength(0);
      expect(unclaimed.contacts).toHaveLength(0);
      const sixthLead = getLeadRow(page, sixth.name);
      await expect(sixthLead).toBeVisible();
      const sixthResponse = page.waitForResponse(response => response.url().endsWith("/rpc/claim_sales_lead") && response.request().method() === "POST");
      await sixthLead.getByRole("button", { name: "认领线索" }).click();
      const rejected = await sixthResponse;
      expect(rejected.ok()).toBe(false);
      expect(await rejected.json()).toMatchObject({ message: "sales_lead_daily_limit_reached" });
      await expect(page.getByText("你今天已领取 5 条线索，请明天再领取。")).toBeVisible();
      // 拒绝不能新增周期或改写任何已有字段/版本，两条目标均独立保持。
      expect(readDailyLimitProof(fixture.actorId, sixth.id)).toEqual(unclaimed);
      expect(readDailyLimitProof(fixture.actorId, fifth.id)).toEqual(claimed);
      await page.reload();
      await page.getByRole("button", { name: "线索大厅" }).click();
      await page.getByLabel("搜索线索").fill(sixth.name);
      await expect(getLeadRow(page, sixth.name).getByRole("button", { name: "认领线索" })).toBeVisible();
      expect(readDailyLimitProof(fixture.actorId, sixth.id)).toEqual(unclaimed);

      await setTestLocale(page, "en");
      for (const width of [375, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.reload();
        const mobileRules = page.getByTestId("sales-lead-rules");
        if (await mobileRules.getAttribute("open") === null) await mobileRules.locator("summary").click();
        await expect(mobileRules.locator("dt")).toHaveText(["Convert within 30 days"]);
        await page.getByRole("button", { name: "Lead Hall" }).click();
        await page.getByLabel("Search leads").fill(sixth.name);
        const response = page.waitForResponse(item => item.url().endsWith("/rpc/claim_sales_lead") && item.request().method() === "POST");
        await getLeadRow(page, sixth.name).getByRole("button", { name: "Claim lead" }).click();
        expect((await response).ok()).toBe(false);
        await expect(page.getByText("You have already received 5 leads today. Please continue tomorrow.")).toBeVisible();
        expect(readDailyLimitProof(fixture.actorId, sixth.id)).toEqual(unclaimed);
        expect(readDailyLimitProof(fixture.actorId, fifth.id)).toEqual(claimed);
        await expectNoHorizontalOverflow(page);
      }
    });
  });
});

type DailyLead = { id: string; name: string };
type DailyFixture = { actorId: string; leads: DailyLead[] };
type DailyProof = { id: string; status: string; daily_claims: number; current_assignee_user_id: string | null;
  current_assignment_id: string | null; history: Record<string, unknown>[]; contacts: Record<string, unknown>[] };

/** 上下界都先在上海取自然日，再转换为时刻，结果不依赖连接时区。 */
function dailyCountSql(actorId: string) {
  return `(select count(*)::integer from public.sales_lead_assignments where assignee_user_id=${quote(actorId)}
    and claimed_at >= (date_trunc('day',now() at time zone 'Asia/Shanghai') at time zone 'Asia/Shanghai')
    and claimed_at < ((date_trunc('day',now() at time zone 'Asia/Shanghai')+interval '1 day') at time zone 'Asia/Shanghai'))`;
}
function readDailyCount(actorId: string) {
  const rows = readLocalPostgresRows<{ count: number }>(`select ${dailyCountSql(actorId)} as count`);
  expect(rows).toHaveLength(1);
  expect(Number.isSafeInteger(rows[0].count)).toBe(true);
  return rows[0].count;
}
function readDailyLimitProof(actorId: string, id: string) {
  const rows = readLocalPostgresRows<DailyProof>(`select l.*,l.xmin::text as row_version,${dailyCountSql(actorId)} as daily_claims,
    (select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('row_version',a.xmin::text)order by a.claimed_at,a.id),'[]'::jsonb)
      from public.sales_lead_assignments a where a.lead_id=l.id) as history,
    (select coalesce(jsonb_agg(to_jsonb(n)||jsonb_build_object('row_version',n.xmin::text)order by n.created_at,n.id),'[]'::jsonb)
      from public.sales_lead_contact_notes n where n.lead_id=l.id) as contacts
    from public.sales_leads l where l.id=${quote(id)}`);
  expect(rows).toHaveLength(1);
  return rows[0];
}
function writeDailyLead(action: "create" | "cleanup", id: string) {
  const output = runLocalSupabaseSql(buildLearningLeadWriteSql(action, id));
  const receipts = output.split(/\r?\n/).filter(line => line.startsWith("WRITE_RECEIPT "));
  if (receipts.length !== 1) throw new Error("daily_limit_fixture_receipt_missing");
  return verifyLearningLeadReceipt(action, JSON.parse(runLocalSupabaseSql(buildLearningLeadReadSql(id))),
    JSON.parse(receipts[0].slice("WRITE_RECEIPT ".length)).affected);
}

/** 只回收准备前登记的六个随机编号；已有本日记录时拒绝，不清空固定账号或按前缀删除。 */
async function withDailyLimitFixture(page: Page, email: string, run: (fixture: DailyFixture) => Promise<void>) {
  const leads: DailyLead[] = [], errors: unknown[] = [];
  try {
    const actors = readLocalPostgresRows<{ user_id: string }>(`select user_id from public.user_profiles where email=${quote(email)} and status='active'`);
    expect(actors).toHaveLength(1);
    const actorId = actors[0].user_id;
    expect(actorId).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    expect(readDailyCount(actorId), "需要本次专属身份当天零认领，不能清除既有历史").toBe(0);
    for (let index = 0; index < 6; index++) {
      const lead = { id: randomUUID(), name: "" };
      leads.push(lead);
      lead.name = writeDailyLead("create", lead.id).lead.name;
    }
    for (let index = 0; index < 4; index++) {
      runLocalSupabaseSql(`begin;set local request.jwt.claim.sub=${quote(actorId)};set local role authenticated;
        select public.claim_sales_lead(${quote(leads[index].id)});commit;`);
      const proof = readDailyLimitProof(actorId, leads[index].id);
      expect(proof).toMatchObject({ daily_claims: index + 1, status: "claimed", current_assignee_user_id: actorId });
      expect(proof.history).toHaveLength(1);
    }
    await run({ actorId, leads });
  } catch (error) { errors.push(error); }
  try {
    // 页面先关闭，避免迟到请求在数据回收后重新写入；单条失败不挡住其余自有线索。
    await cleanupFixtureResources(() => page.close(), ...leads.slice().reverse().map(lead => async () => writeDailyLead("cleanup", lead.id)));
  } catch (error) { errors.push(...(error instanceof AggregateError ? error.errors : [error])); }
  if (errors.length) throw new AggregateError(errors, `每日认领验证未完成，本次编号 ${leads.map(lead => lead.id).join(",")}`);
}

function getLeadRow(page: Page, name: string) {
  return page.getByTestId("sales-lead-list").locator('[data-testid^="sales-lead-row-"]').filter({ has: page.getByRole("heading", { name, exact: true }) });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);

  const squeezedText = await page.locator("main *").evaluateAll((elements) =>
    elements.some((element) => {
      const rect = element.getBoundingClientRect();
      const text = element.textContent?.trim() ?? "";
      return text.length >= 4 && rect.width > 0 && rect.width < 18 && rect.height > rect.width * 3;
    }),
  );
  expect(squeezedText).toBe(false);
}
