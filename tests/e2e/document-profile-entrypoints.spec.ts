import { expect, test } from "@playwright/test";
import { documentUser, documentLogin, readLibrary } from "./helpers/document-library";
import { requireDisposableFixture } from "../test-support/disposable-fixture";

// 固定账号、全局故障或过期清理只能在实际可重建的专属完整实例执行。
test.beforeAll(() => requireDisposableFixture({
  baseURL: process.env.PLAYWRIGHT_BASE_URL,
  supabaseURL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  mode: process.env.PT5_E2E_FIXTURE_MODE,
}));

// 个人资料与人员详情只进入已授权档案；不与版本竞争和跨档案写入混排。
test.use({ video: "off" });
test("个人资料和管理员人员详情入口打开对应档案，其他员工档案拒绝访问", async ({ page }) => {
    const operator = await documentUser("operator"), salesman = await documentUser("salesman");
    await documentLogin(page, "operator");
    await page.goto("/operator/my");
    await page.getByRole("link", { name: "查看资料", exact: true }).click();
    await expect(page).toHaveURL(/\/operator\/documents$/);
    expect((await readLibrary(page)).archives.filter((item) => item.kind === "employee").map((item) => item.user_id)).toEqual([operator]);
    expect((await page.request.get(`/api/document-library?user=${salesman}&query=内部`)).status()).toBe(403);
    await documentLogin(page, "administrator");
    await page.goto("/admin/accounts");
    await page.getByRole("button", { name: "查看 本地业务员 的账号详情" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "查看资料", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`user=${salesman}`));
    const library = await readLibrary(page);
    expect(library.archives.find((item) => item.id === library.archiveId)?.user_id).toBe(salesman);
});
