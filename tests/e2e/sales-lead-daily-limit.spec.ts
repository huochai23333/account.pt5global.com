import { expect, test, type Page } from "@playwright/test";

import { loginAs, setTestLocale } from "./helpers/auth";
import {
  isLocalSupabaseTestTarget,
  runLocalSupabaseSql,
} from "./helpers/local-supabase";

const SALESMAN_ID = "55555555-5555-4555-8555-555555555555";
const TEST_SOURCE_PREFIX = "E2E-DAILY-LIMIT-";

test.describe("sales lead daily claim limit", () => {
  test.setTimeout(120_000);

  test("the fifth lead succeeds and every later page attempt keeps the database at five", async ({
    page,
  }) => {
    test.skip(
      !isLocalSupabaseTestTarget(),
      "This regression requires the local Docker Supabase authority.",
    );

    prepareDailyLimitFixture();

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await loginAs(page, "salesman");
      await page.goto("/salesman/wholesale/leads");

      const rules = page.getByTestId("sales-lead-rules");
      await expect(rules).toContainText("每人每天最多领取 5 条");
      await expectNoHorizontalOverflow(page);

      // 前四个周期由数据库夹具准备，第五次必须从真实页面发起并取得 RPC 最终响应。
      await page.getByLabel("搜索线索").fill("每日限额页面测试 5");
      const fifthLead = getLeadRow(page, "每日限额页面测试 5");
      await expect(fifthLead).toBeVisible();
      const fifthResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/rpc/claim_sales_lead") &&
          response.request().method() === "POST",
      );
      await fifthLead.getByRole("button", { name: "认领线索" }).click();
      expect((await fifthResponse).ok()).toBe(true);

      // HTTP 成功不作为凭证：独立数据库查询必须确认当天正好 5 个周期，且第五条真实归当前账号。
      expect(readDailyLimitProof(5)).toBe(`5|1|claimed|${SALESMAN_ID}`);
      await expect(page.getByRole("button", { name: "我的线索" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      await page.getByRole("button", { name: "线索大厅" }).click();
      await page.getByLabel("搜索线索").fill("每日限额页面测试 6");
      const sixthLead = getLeadRow(page, "每日限额页面测试 6");
      await expect(sixthLead).toBeVisible();
      const sixthResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/rpc/claim_sales_lead") &&
          response.request().method() === "POST",
      );
      await sixthLead.getByRole("button", { name: "认领线索" }).click();
      const rejected = await sixthResponse;
      expect(rejected.ok()).toBe(false);
      expect(await rejected.json()).toMatchObject({
        message: "sales_lead_daily_limit_reached",
      });
      await expect(
        page.getByText("你今天已领取 5 条线索，请明天再领取。"),
      ).toBeVisible();
      expect(readDailyLimitProof(6)).toBe("5|0|hall|");

      // 刷新后仍以权威状态为准：第六条留在大厅，按钮仍可见而不会伪装成已领取。
      await page.reload();
      await page.getByRole("button", { name: "线索大厅" }).click();
      await page.getByLabel("搜索线索").fill("每日限额页面测试 6");
      await expect(
        getLeadRow(page, "每日限额页面测试 6").getByRole("button", {
          name: "认领线索",
        }),
      ).toBeVisible();

      // 手机宽度下再次从页面发起第六次请求，同时核对英文提示和长规则文字的排版。
      await setTestLocale(page, "en");
      await page.setViewportSize({ width: 375, height: 900 });
      await page.reload();
      await expect(page.getByTestId("sales-lead-rules")).toContainText(
        "Each person can receive up to 5 leads per day",
      );
      await page.getByRole("button", { name: "Lead Hall" }).click();
      await page.getByLabel("Search leads").fill("每日限额页面测试 6");
      await getLeadRow(page, "每日限额页面测试 6")
        .getByRole("button", { name: "Claim lead" })
        .click();
      await expect(
        page.getByText(
          "You have already received 5 leads today. Please continue tomorrow.",
        ),
      ).toBeVisible();
      expect(readDailyLimitProof(6)).toBe("5|0|hall|");
      await expectNoHorizontalOverflow(page);
    } finally {
      cleanupDailyLimitFixture();
    }
  });
});

function getLeadRow(page: Page, name: string) {
  return page
    .getByTestId("sales-lead-list")
    .locator('[data-testid^="sales-lead-row-"]')
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
}

function prepareDailyLimitFixture() {
  runLocalSupabaseSql(`
    begin;

    -- 清除这个本地测试账号当天可能由其他回归留下的周期，保证额度测试可重复执行。
    delete from public.sales_lead_contact_notes
    where assignment_id in (
      select id
      from public.sales_lead_assignments
      where assignee_user_id = '${SALESMAN_ID}'
        and claimed_at >= date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai'
        and claimed_at < (date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai') + interval '1 day'
    );

    update public.sales_leads
    set status = 'hall', current_assignee_user_id = null, current_assignment_id = null,
        claimed_at = null, first_contact_at = null, last_contact_at = null,
        next_follow_up_at = null, expires_at = null, hard_deadline_at = null,
        used_at = null, used_by_user_id = null, used_summary = null
    where current_assignment_id in (
      select id
      from public.sales_lead_assignments
      where assignee_user_id = '${SALESMAN_ID}'
        and claimed_at >= date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai'
        and claimed_at < (date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai') + interval '1 day'
    );

    delete from public.sales_lead_assignments
    where assignee_user_id = '${SALESMAN_ID}'
      and claimed_at >= date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai'
      and claimed_at < (date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai') + interval '1 day';

    delete from public.sales_leads where primary_source_lead_id like '${TEST_SOURCE_PREFIX}%';

    insert into public.sales_leads (
      primary_source_lead_id, latest_source_date, name, category, country, priority, source_url
    )
    select
      '${TEST_SOURCE_PREFIX}' || n,
      timezone('Asia/Shanghai', now())::date,
      '每日限额页面测试 ' || n,
      '测试',
      'CN',
      'A',
      'https://example.test/e2e-daily-limit/' || n
    from generate_series(1, 6) as n;

    select private.start_sales_lead_assignment(
      lead.id,
      '${SALESMAN_ID}',
      '${SALESMAN_ID}',
      now()
    )
    from public.sales_leads as lead
    where lead.primary_source_lead_id in (
      '${TEST_SOURCE_PREFIX}1',
      '${TEST_SOURCE_PREFIX}2',
      '${TEST_SOURCE_PREFIX}3',
      '${TEST_SOURCE_PREFIX}4'
    )
    order by lead.primary_source_lead_id;

    commit;
  `);
}

function readDailyLimitProof(number: 5 | 6) {
  return runLocalSupabaseSql(`
    with bounds as (
      select date_trunc('day', timezone('Asia/Shanghai', now())) at time zone 'Asia/Shanghai' as day_start
    ), target as (
      select * from public.sales_leads where primary_source_lead_id = '${TEST_SOURCE_PREFIX}${number}'
    )
    select concat_ws('|',
      (select count(*) from public.sales_lead_assignments, bounds where assignee_user_id = '${SALESMAN_ID}' and claimed_at >= day_start and claimed_at < day_start + interval '1 day'),
      (select count(*) from public.sales_lead_assignments where lead_id = (select id from target)),
      (select status from target),
      coalesce((select current_assignee_user_id::text from target), '')
    );
  `);
}

function cleanupDailyLimitFixture() {
  if (!isLocalSupabaseTestTarget()) return;

  runLocalSupabaseSql(`
    begin;
    delete from public.sales_lead_contact_notes
    where lead_id in (select id from public.sales_leads where primary_source_lead_id like '${TEST_SOURCE_PREFIX}%');
    update public.sales_leads
    set status = 'hall', current_assignee_user_id = null, current_assignment_id = null,
        claimed_at = null, first_contact_at = null, last_contact_at = null,
        next_follow_up_at = null, expires_at = null, hard_deadline_at = null,
        used_at = null, used_by_user_id = null, used_summary = null
    where primary_source_lead_id like '${TEST_SOURCE_PREFIX}%';
    delete from public.sales_lead_assignments
    where lead_id in (select id from public.sales_leads where primary_source_lead_id like '${TEST_SOURCE_PREFIX}%');
    delete from public.sales_leads where primary_source_lead_id like '${TEST_SOURCE_PREFIX}%';
    commit;
  `);
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
