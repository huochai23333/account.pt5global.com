import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const authRoutes = ["/api/mail/oauth/google/start", "/api/mail/oauth/google/callback", "/api/mail/oauth/feishu/start", "/api/mail/oauth/feishu/callback"];

test("未登录的授权及八类工作台入口均进入本站登录页", async ({ page, baseURL }) => {
  const loginURL = new URL("/login", baseURL).href;
  for (const path of [...authRoutes, ...["admin", "manager", "recruiter", "salesman", "promoter", "operator", "finance", "client"].map((role) => `/${role}/home`)]) {
    await page.goto(path);
    await expect(page).toHaveURL(loginURL);
    await expect(page.getByRole("button", { name: /^(登录|Sign In)$/ })).toBeVisible();
  }
});

test("权限不足的飞书入口进入权限提示页，不把框架跳转写进网址", async ({ page }) => {
  await loginAs(page, "finance");
  for (const path of ["/api/mail/oauth/feishu/start", "/api/mail/oauth/feishu/callback?code=bad&state=bad"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/access-limited$/);
    expect(page.url()).not.toMatch(/NEXT_REDIRECT|0\.0\.0\.0|connectionError/);
    await expect(page.getByRole("heading", { name: "这个页面不在你的工作范围内", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "返回我的首页", exact: true })).toHaveAttribute("href", "/finance/home");
  }
});

// Each forwarded source/path has its own result; one early failure cannot hide the others.
for (const forwarded of ["0.0.0.0:3000", "evil.example.com", "evil.example.com, localhost:3000"]) {
  for (const path of ["/auth/confirm", "/auth/sign-out?next=%2F%5Coutside.example"]) {
    test(`认证入口拒绝转发来源 ${forwarded} on ${path}`, async ({ request, baseURL }) => {
      const response = await request.get(path, { headers: { "x-forwarded-host": forwarded }, maxRedirects: 0 });
      expect([302, 303, 307, 308]).toContain(response.status());
      const destination = new URL(response.headers().location);
      expect(destination.origin).toBe(new URL(baseURL!).origin);
      expect(destination.pathname).toBe(path.startsWith("/auth/confirm") ? "/login" : "/auth/sign-out/confirm");
      expect(destination.search).not.toContain("outside.example");
    });
  }
}
