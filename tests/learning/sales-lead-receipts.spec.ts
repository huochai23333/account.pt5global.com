import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { test as base, expect } from "./fixtures";

type LeadReceipt = {
  lead: { status: string; current_assignee_user_id: string; current_assignment_id: string; updated_at: string } | null;
  assignmentCount: number;
  contactCount: number;
};

function leadFixture(action: "create" | "inspect" | "cleanup", leadId: string): LeadReceipt {
  const script = resolve("../PT5-dropshipping-supabase/scripts/learning-lead-fixture.mjs");
  return JSON.parse(execFileSync(process.execPath, [script, action, leadId], { encoding: "utf8" }));
}

// 线索依赖账号夹具：Playwright 会先清理线索，再清理其负责人账号。
// 正文超时时，正文 finally 与其他夹具可能交叠，不能让账号删除抢在线索解除引用之前。
const test = base.extend<{ learningLeadId: string }>({
  learningLeadId: [async ({ learningUser }, provide, testInfo) => {
    expect(learningUser.id).toBeTruthy();
    const id = randomUUID();
    leadFixture("create", id);
    try {
      await provide(id);
    } finally {
      const cleanup = leadFixture("cleanup", id);
      expect(cleanup).toMatchObject({ lead: null, assignmentCount: 0, contactCount: 0 });
      await writeFile(testInfo.outputPath("lead-cleanup.json"), JSON.stringify(cleanup, null, 2));
    }
  }, { timeout: 30_000 }],
});

// 本机单次独立 Docker 查询约 3.2 秒；多次终态核对另加浏览器操作需要独立的正文预算。
// 保留全部查回及刷新断言，准备/清理分别使用上面的夹具预算。
test.setTimeout(120_000);

// 数据库额度窗口修复后，两种语言与两种宽度都复走同一条真实写入、刷新和清理链路。
for (const [locale, width] of [["zh", 1440], ["zh", 390], ["en", 1440], ["en", 390]] as const) {
  test(`线索认领与联系凭证 ${locale}/${width}`, async ({ page, learningUser, learningLeadId: id }, testInfo) => {
    const note = `Learning contact ${id}`;
    const errors: string[] = [];
    const inspect = () => leadFixture("inspect", id);
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
    // 登录夹具已处理中文公告。英文提示若出现，则按真实界面关闭，已读标记只归属本次账号。
    if (locale === "en") {
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
    }
      await loginLearningUser(page, learningUser);
      await page.goto("/admin/wholesale/leads");
      const search = page.getByRole("searchbox", { name: locale === "zh" ? "搜索线索" : "Search leads", exact: true });
      await search.fill(id);
      await page.getByTestId(`claim-lead-${id}`).click();
      const row = page.getByTestId(`sales-lead-row-${id}`);
      await expect(row.getByTestId(`claim-lead-${id}`)).toHaveCount(0);
      await expect(row).toBeVisible();
      const claim = inspect();
      expect(claim).toMatchObject({
        assignmentCount: 1, contactCount: 0,
        lead: { status: "claimed", current_assignee_user_id: learningUser.id },
      });
      expect(claim.lead?.current_assignment_id).toBeTruthy();

      await row.getByRole("button", { name: locale === "zh" ? "查看详情" : "View details", exact: true }).click();
      await page.getByRole("button", { name: locale === "zh" ? "记录联系" : "Record contact", exact: true }).click();
      const dialog = page.getByRole("dialog");
      const submit = dialog.getByTestId("submit-lead-contact");
      await expect(submit).toBeDisabled();
      await dialog.getByTestId("sales-lead-action-note").fill(note);
      // 只截取这一次联系写入。返回空凭证，数据库应保持原版本，表单应保留。
      await page.route("**/rpc/add_sales_lead_contact", (route) => route.fulfill({ json: null }), { times: 1 });
      await submit.click();
      await expect(dialog).toContainText(locale === "zh" ? "保存结果待确认" : "The save result is awaiting confirmation");
      expect(inspect()).toEqual(claim);
      await expect(dialog.getByTestId("sales-lead-action-note")).toHaveValue(note);

      let releaseContact!: () => void;
      const contactGate = new Promise<void>((resolveGate) => { releaseContact = resolveGate; });
      let contactRequests = 0;
      await page.route("**/rpc/add_sales_lead_contact", async (route) => {
        contactRequests += 1;
        await contactGate;
        await route.continue();
      });
      try {
        await submit.click();
        await expect.poll(() => contactRequests).toBe(1);
        await expect(submit).toBeDisabled();
        await page.keyboard.press("Enter");
        expect(contactRequests).toBe(1);
      } finally {
        releaseContact();
      }
      await expect(dialog).toHaveCount(0);
      const saved = inspect();
      expect(saved.contactCount).toBe(1);
      expect(saved.assignmentCount).toBe(1);
      expect(saved.lead?.current_assignment_id).toBe(claim.lead?.current_assignment_id);
      expect(saved.lead?.updated_at).not.toBe(claim.lead?.updated_at);
      const contact = JSON.parse(executeLearningSql(
        `select row_to_json(c) from (select id,author_user_id,note from public.sales_lead_contact_notes where lead_id='${id}') c;`,
      ));
      expect(contact).toMatchObject({ author_user_id: learningUser.id, note });
      expect(contact.id).toBeTruthy();

      await page.reload();
      await page.getByRole("button", { name: locale === "zh" ? /我的线索/ : /My leads/i }).click();
      await search.fill(id);
      await row.getByRole("button", { name: locale === "zh" ? "查看详情" : "View details", exact: true }).click();
      await expect(dialog.getByText(note, { exact: true })).toBeVisible();
      expect(inspect()).toEqual(saved);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`lead-${locale}-${width}.png`) });

      await dialog.getByRole("button", { name: locale === "zh" ? "退回大厅" : "Return to hall", exact: true }).click();
      await dialog.getByTestId("sales-lead-action-note").fill(`Learning return ${id}`);
      await dialog.getByTestId("submit-lead-return").click();
      await expect(dialog).toHaveCount(0);
      const returned = inspect();
      expect(returned).toMatchObject({
        assignmentCount: 1, contactCount: 1,
        lead: { status: "hall", current_assignee_user_id: null, current_assignment_id: null },
      });
      expect(executeLearningSql(
        `select ended_reason from public.sales_lead_assignments where id='${claim.lead?.current_assignment_id}' and ended_at is not null;`,
      )).toBe("admin_return");
      await page.reload();
      await search.fill(id);
      await expect(row.getByTestId(`claim-lead-${id}`)).toBeVisible();
      expect(inspect()).toEqual(returned);
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath("lead-receipt.json"), JSON.stringify({ claim, saved, contact, returned }, null, 2));
  });
}
