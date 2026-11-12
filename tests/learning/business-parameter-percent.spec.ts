import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const parameter = "wholesale_referral_order_amount_rate";

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  const copy = (locale === "zh" ? zh : en).Commission.settings;
  test(`业务参数百分数预览和请求 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const read = () => executeLearningSql(`select md5(coalesce(jsonb_agg(to_jsonb(v) order by v.id)::text,'[]'))
      from public.business_parameter_versions v where parameter_code='${parameter}';`);
    const before = read();
    const writes: Record<string, unknown>[] = [];
    // 参数会影响全局订单。在共享项目中捕获真实页面请求并阻断，数据库写入由隔离 SQL 验证。
    await page.route(/\/rpc\/(publish_business_parameter_version|cancel_scheduled_business_parameter_version)$/, async (route) => {
      writes.push(route.request().postDataJSON());
      await route.abort("blockedbyclient");
    });
    await page.setViewportSize({ width, height: 900 });
    await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
      await page.keyboard.press("Escape");
    });
    await loginLearningUser(page, learningUser);
    await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
    await page.goto("/admin/wholesale/settings");
    const record = page.getByTestId(`business-parameter-${width === 1440 ? "row" : "card"}-${parameter}`);
    await record.getByRole("button", { name: copy.actions.edit, exact: true }).click();
    const input = page.getByTestId("business-parameter-input-rate");
    const editor = page.getByRole("dialog").filter({ has: input });
    const after = editor.getByText(copy.editor.after, { exact: true }).locator("..");
    for (const value of ["0.5", "100", "1"]) {
      await input.fill(value);
      await expect(after.getByText(`${value}%`, { exact: true })).toBeVisible();
      await expect(editor.getByText(copy.calculations.wholesaleReferralOrderAmount.replace("{rate}", `${value}%`), { exact: true })).toBeVisible();
    }
    await expect(editor.getByText(copy.editor.rateHint, { exact: true })).toBeVisible();
    await after.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("parameter-percent.png"), animations: "disabled" });
    await editor.getByTestId("business-parameter-change-reason").fill("Local learning percent check");
    await input.fill("0.001");
    await editor.getByTestId("business-parameter-review-publish").click();
    await expect(editor.getByText(copy.validation.rate, { exact: true })).toBeInViewport();
    expect(writes).toHaveLength(0);
    await input.fill("1");
    await editor.getByTestId("business-parameter-review-publish").click();
    const confirm = page.getByRole("dialog", { name: copy.publish.confirmTitle, exact: true });
    await confirm.getByRole("button", { name: copy.actions.confirmPublish, exact: true }).click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toMatchObject({
      p_parameter_code: parameter,
      p_config: { rate: 0.01 },
      p_effective_from: null,
      p_request_id: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
    await expect(editor.locator('[data-slot="feedback-notice"][data-tone="error"]')).toBeInViewport();
    await expect(editor).toBeVisible();
    expect(read()).toBe(before);
    await page.reload();
    await expect(record).toBeVisible();
    expect(read()).toBe(before);
    await writeFile(testInfo.outputPath("percent-receipt.json"), JSON.stringify({ before, after: read(), sent: writes[0].p_config }));
  });
}
