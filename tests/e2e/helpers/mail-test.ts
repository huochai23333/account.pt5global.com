import { expect, test as base, type Page } from "@playwright/test";
import { requireDisposableFixture } from "../../test-support/disposable-fixture";
import { closeLoopbackBoundary } from "../../test-support/loopback-http-boundary";
import { getRegressionAccount, type RegressionRole } from "./accounts";
import { setTestLocale } from "./auth";
import { startMailBoundaryMockServer } from "./mail-boundary-mock-server";
import { resetIntegratedMailFixture } from "./mail-fixtures";

/**
 * 原邮件夹具会清空整张业务表：声明与本地 URL 仅是准入条件，还必须实际提供隔离完整实例。
 * 自动夹具保证失败也关闭模拟连接；这里沿用原账号入口，受限时整套用例保持未执行。
 */
export const test = base.extend<{ integratedMail: void }>({
  integratedMail: [
    async ({ baseURL }, runTest) => {
      requireDisposableFixture({
        baseURL,
        supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        mode: process.env.PT5_E2E_FIXTURE_MODE,
      });
      const server = await startMailBoundaryMockServer();
      try {
        await resetIntegratedMailFixture();
        await runTest();
      } finally {
        await closeLoopbackBoundary(server);
      }
    },
    { auto: true },
  ],
});

/** 保留原邮件套件的登录步骤和固定账号来源；不建立替代认证入口。 */
export async function loginMailAccount(page: Page, role: RegressionRole) {
  const account = getRegressionAccount(role);
  await setTestLocale(page, "zh");
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('input[name="email"]')).toHaveCount(0, {
    timeout: 30_000,
  });
  const acknowledge = page.getByRole("button", { name: "我知道了" });
  if (await acknowledge.isVisible().catch(() => false))
    await acknowledge.click();
}
