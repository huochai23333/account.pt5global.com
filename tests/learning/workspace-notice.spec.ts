import { test, expect } from "./fixtures";
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";

test("旅游订单直接访问显示停用说明，批发订单仍能打开", async ({ page, context, learningUser }, testInfo) => {
  const origin = "http://localhost:3000";
  await context.addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
  await loginLearningUser(page, learningUser);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // 用真实会话访问已知业务地址。停用说明应在载入订单渲染器之前出现。
  for (const [locale, width, title] of [
    ["zh", 1440, "旅游业务暂时停止服务"],
    ["en", 390, "Travel services are temporarily unavailable"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await context.addCookies([{ name: "bs-locale", value: locale, url: origin }]);
    await page.goto("/admin/tourism/orders");
    await expect(page).toHaveURL(/\/business-unavailable\?business=tourism$/);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator("aside")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`tourism-disabled-${locale}-${width}.png`) });

    // 这些保留栏目仍受同一个业务入口守卫约束。
    for (const section of ["records", "team", "tasks", "commission"]) {
      await page.goto(`/admin/tourism/${section}`);
      await expect(page).toHaveURL(/\/business-unavailable\?business=tourism$/);
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
    // 刷新历史佣金地址跳转后的说明页，确认页面不会暴露结算操作。
    await page.reload();
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /标记已结算|Mark as paid/i })).toHaveCount(0);
  }

  await page.goto("/admin/wholesale/orders");
  await expect(page).toHaveURL(/\/admin\/wholesale\/orders$/);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(0);

  // 旅游设置同样停用，批发设置只能显示自己的业务参数。
  await context.addCookies([{ name: "bs-locale", value: "zh", url: origin }]);
  await page.goto("/admin/tourism/settings");
  await expect(page).toHaveURL(/\/business-unavailable\?business=tourism$/);
  await expect(page.getByRole("heading", { name: "旅游业务暂时停止服务", exact: true })).toBeVisible();
  await page.goto("/admin/wholesale/settings");
  await expect(page).toHaveURL(/\/admin\/wholesale\/settings$/);
  await expect(page.getByTestId("business-parameter-card-wholesale_referral_order_amount_rate")).toBeVisible();
  await expect(page.getByRole("heading", { name: /^(服务价格|服务订单折扣|零售服务费设置)$/ })).toHaveCount(0);

  // 用同一夹具身份验证数据库的独立边界，避免把页面跳转当成数据权限证明。
  const database = JSON.parse(executeLearningSql(`begin read only;
    set local role authenticated;
    set local "request.jwt.claim.sub" = '${learningUser.id}';
    select json_build_object(
      'tourismEnabled', public.is_workspace_business_enabled('tourism'::text),
      'wholesaleEnabled', public.is_workspace_business_enabled('wholesale'::text),
      'viewerRole', public.current_app_role(),
      'visibleOrdinaryOrders', (select count(*) from public.order_overview),
      'canReadTourismTeamDirectory', has_function_privilege(current_user, 'public.get_visible_team_overview()', 'execute'),
      'canSettleOrderCommission', has_function_privilege(current_user, 'public.update_commission_settlement(uuid,commission_settlement_status,timestamp with time zone,text)', 'execute'),
      'canSettleTaskCommission', has_function_privilege(current_user, 'public.update_task_commission_settlement(uuid,commission_settlement_status,timestamp with time zone,text)', 'execute')
    );
    rollback;`));
  expect(database).toEqual({
    tourismEnabled: false, wholesaleEnabled: true, viewerRole: "administrator",
    visibleOrdinaryOrders: 0, canReadTourismTeamDirectory: false,
    canSettleOrderCommission: false, canSettleTaskCommission: false,
  });
  await testInfo.attach("tourism-database-boundary", { body: JSON.stringify(database), contentType: "application/json" });
  expect(errors).toEqual([]);
});

// 客户的资料库准入仍由 requireDocumentWorkspace 拒绝；说明页必须给出同一权限内的入口。
for (const role of ["client", "administrator"] as const) {
  test.describe(role, () => {
    test.use({ learningRole: role });
    test("服务说明页只显示本人可用入口，中英文及手机刷新一致", async ({
      page,
      context,
      learningUser,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type()))
          errors.push(message.text());
      });
      await context.addCookies([
        { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
      ]);
      await loginLearningUser(page, learningUser);
      const basePath = role === "client" ? "/client" : "/admin";
      for (const language of ["zh", "en"] as const) {
        await context.addCookies([
          { name: "bs-locale", value: language, url: "http://localhost:3000" },
        ]);
        await page.goto("/business-unavailable");
        const documentLink = page.locator(`a[href="${basePath}/documents"]`);
        await expect(documentLink).toHaveCount(role === "client" ? 0 : 1);
        await expect(
          page.locator(`a[href="${basePath}/company-templates"]`),
        ).toHaveCount(role === "client" ? 0 : 1);
        await expect(
          page.getByRole("heading", {
            name:
              language === "zh"
                ? "当前没有可使用的业务"
                : "No service is currently available for this account",
            exact: true,
          }),
        ).toBeVisible();
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          // 员工的资料入口仅在桌面可见，客户在任何宽度都不应收到不可用链接。
          if (role === "administrator") {
            if (width === 1440) await expect(documentLink).toBeVisible();
            else await expect(documentLink).toBeHidden();
          }
          // 页面不溢出仍可能把按钮挤成逐字换行，必须核对每个可见操作的文字布局。
          const wrappedActions = await page
            .locator("main a, main button")
            .evaluateAll((elements) =>
              elements
                .filter((element) => {
                  if (!element.getClientRects().length) return false;
                  const range = document.createRange();
                  range.selectNodeContents(element);
                  return range.getClientRects().length > 1;
                })
                .map((element) => element.textContent),
            );
          expect(wrappedActions).toEqual([]);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          ).toBe(true);
          await page.screenshot({
            path: testInfo.outputPath(`notice-${language}-${width}.png`),
            fullPage: true,
          });
          await page.reload();
          await expect(documentLink).toHaveCount(role === "client" ? 0 : 1);
          await expect(
            page.locator("nextjs-portal [data-nextjs-dialog]"),
          ).toHaveCount(0);
        }
      }
      expect(errors).toEqual([]);
    });
  });
}
