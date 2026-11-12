import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { test, expect } from "./fixtures";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  test(`批发人员目录支持键盘打开和返回 ${locale}/${width}`, async ({ page, learningUser, learningStaff }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
    // 英文环境里的本地公告由专属账号关闭，避免影响后续目录操作。
    if (locale === "en") {
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
    }
    const readProfile = () => JSON.parse(executeLearningSql(
      `select row_to_json(t) from (select user_id,name,email,status,xmin::text as row_version from public.user_profiles where user_id='${learningStaff.id}') t;`,
    ));
    const profile = readProfile();
    expect(profile).toMatchObject({ user_id: learningStaff.id, email: learningStaff.email, status: "active" });

    await loginLearningUser(page, learningUser);
    await page.goto("/admin/wholesale/people");
    await expect(page.getByRole("heading", { name: locale === "zh" ? "人员管理" : "People management" })).toBeVisible();
    const search = page.getByPlaceholder(locale === "zh" ? "姓名、邮箱、手机或城市" : "Name, email, mobile phone or city");
    const open = page.getByRole("button", { name: new RegExp(profile.name) });
    await search.fill(learningStaff.runId);
    await expect(page.getByText(profile.name, { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(open).toBeVisible();
    await open.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: profile.name });
    await expect(dialog.getByText(learningStaff.email, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(dialog).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath(`people-${locale}-${width}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();

    await search.fill(`missing-${learningStaff.runId}`);
    await expect(open).toHaveCount(0);
    await expect(search).toBeVisible();
    await page.reload();
    await search.fill(learningStaff.email);
    await expect(open).toBeVisible();
    expect(readProfile()).toEqual(profile);
    expect(errors).toEqual([]);
  });
}

test.describe("批发客户的目录权限", () => {
  test.use({ learningRole: "client" });

  test("能查看推荐页，不能新增推荐或打开人员目录", async ({ page, learningUser }) => {
    // 用真实本地客户身份访问页面，验证按钮与直接输入地址的权限边界一致。
    await page.context().addCookies([{ name: "bs-locale", value: "zh", url: "http://localhost:3000" }]);
    await loginLearningUser(page, learningUser);
    await page.goto("/client/wholesale/referrals");
    await expect(page.getByRole("heading", { name: "推荐树", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "新增推荐关系", exact: true })).toHaveCount(0);
    await page.goto("/client/wholesale/people");
    await expect(page).toHaveURL(/\/access-limited$/);
    await expect(page.getByRole("heading", { name: "人员管理", exact: true })).toHaveCount(0);
  });
});
