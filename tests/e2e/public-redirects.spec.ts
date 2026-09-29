import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const authRoutes = ["/api/mail/oauth/google/start", "/api/mail/oauth/google/callback", "/api/mail/oauth/feishu/start", "/api/mail/oauth/feishu/callback"];

test("未登录的授权及八类工作台入口均进入本站登录页", async ({ page }) => {
  for (const path of [...authRoutes, ...["admin", "manager", "recruiter", "salesman", "promoter", "operator", "finance", "client"].map((role) => `/${role}/home`)]) {
    await page.goto(path);
    await expect(page).toHaveURL(/http:\/\/localhost:3000\/login$/);
    await expect(page.getByRole("button", { name: /^(登录|Sign In)$/ })).toBeVisible();
  }
});

test("权限不足的飞书入口进入权限提示页，不把框架跳转写进网址", async ({ page }) => {
  await loginAs(page, "finance");
  for (const path of ["/api/mail/oauth/feishu/start", "/api/mail/oauth/feishu/callback?code=bad&state=bad"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/access-limited$/);
    expect(page.url()).not.toMatch(/NEXT_REDIRECT|0\.0\.0\.0|connectionError/);
  }
});

test("认证入口拒绝未知转发来源和外域返回路径", async ({ request }) => {
  for (const forwarded of ["0.0.0.0:3000", "evil.example.com", "evil.example.com, localhost:3000"]) {
    for (const path of ["/auth/confirm", "/auth/sign-out?next=%2F%5Coutside.example"]) {
      const response = await request.get(path, { headers: { "x-forwarded-host": forwarded }, maxRedirects: 0 });
      const destination = new URL(response.headers().location);
      expect(destination.origin).toBe("http://localhost:3000");
      expect(destination.pathname).toBe(path.startsWith("/auth/confirm") ? "/login" : "/auth/sign-out/confirm");
      expect(destination.search).not.toContain("outside.example");
    }
  }
});
