import { expect } from "@playwright/test";
import { test, loginMailAccount as login } from "./helpers/mail-test";

// 页面关键操作与独立凭证沿用原场景；自动夹具负责本例准备和模拟服务回收。
for (const role of ["administrator", "salesman"] as const) {
  test(`${role} 从左侧工作栏进入邮件工作台`, async ({ page }) => {
    await login(page, role);
    const workspace = role === "administrator" ? "admin" : "salesman";
    await page.goto(`/${workspace}/home`);
    const entry = page.getByRole("link", { name: "邮件工作台" });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(page).toHaveURL(new RegExp(`/${workspace}/mail`));
    await expect(page.getByText("New wholesale inquiry")).toBeVisible();
  });
}

for (const role of [
  "client",
  "finance",
  "manager",
  "operator",
  "promoter",
  "recruiter",
] as const) {
  test(`${role} 没有邮件入口且服务端拒绝`, async ({ page }) => {
    await login(page, role);
    await expect(page.getByRole("link", { name: "邮件工作台" })).toHaveCount(0);
    const response = await page.request.get("/api/mail/workspace", {
      maxRedirects: 0,
    });
    expect([302, 307, 400, 401, 403]).toContain(response.status());
    const agentsResponse = await page.request.get(
      "/api/mail/assignable-agents",
      { maxRedirects: 0 },
    );
    expect([302, 307, 400, 401, 403]).toContain(agentsResponse.status());
    const rulesResponse = await page.request.get("/api/mail/intake-rules", {
      maxRedirects: 0,
    });
    const quarantineResponse = await page.request.get("/api/mail/quarantine", {
      maxRedirects: 0,
    });
    expect([302, 307, 400, 401, 403]).toContain(rulesResponse.status());
    expect([302, 307, 400, 401, 403]).toContain(quarantineResponse.status());
    await page.goto(`/${role}/mail`);
    await expect(page.getByRole("heading", { name: "邮件工作台" })).toHaveCount(
      0,
    );
  });
}
