import { test, expect } from "./fixtures";
import { writeFile } from "node:fs/promises";
import {
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";
import zh from "../../messages/zh.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };

// 写入只针对本次专属账号；管理员直接保存、员工申请审核两条链都独立查数据库并刷新。
for (const language of ["zh", "en"] as const) {
  test(`个人资料修改与审核终态：${language}`, async ({
    page,
    context,
    learningUser,
    learningStaff: staff,
    browser,
  }, testInfo) => {
    test.setTimeout(120_000);
    const messages = language === "zh" ? zh : en;
    const copy = messages.DashboardMy;
    const stateCopy = messages.DashboardMyState;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const staffContext = await browser.newContext({
      viewport: { width: 390, height: 1000 },
    });
    try {
      await context.addCookies([
        { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
      ]);
      await loginLearningUser(page, learningUser);
      await context.addCookies([
        { name: "bs-locale", value: language, url: "http://localhost:3000" },
      ]);
      await page.goto("/admin/my");

      // 证件弹窗保持原来没有底栏的结构，媒体弹窗保留上传/删除区；这里只检查空态，不写隐私和媒体。
      for (const [title, hasActions] of [
        [stateCopy.identityTitle, false],
        [stateCopy.passportTitle, false],
        [stateCopy.photosTitle, true],
        [stateCopy.videosTitle, true],
      ] as const) {
        await page
          .locator("#account-verification")
          .getByRole("button")
          .filter({ hasText: title })
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(
          dialog.getByTestId("dashboard-dialog-actions"),
        ).toHaveCount(hasActions ? 1 : 0);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }

      const adminName = `学习维护 ${learningUser.runId}`;
      const adminCity = `Learning city ${language}`;
      const readProfile = (id: string) =>
        JSON.parse(
          executeLearningSql(
            `select row_to_json(t) from (select user_id,name,city from public.user_profiles where user_id='${id}') t;`,
          ),
        );
      await page
        .getByRole("button", { name: copy.editProfile, exact: true })
        .click();
      const edit = page.getByRole("dialog");
      // Field 的可见标签含必填星号；按控件的无障碍名称定位，避免把装饰字符算进精确标签。
      await edit
        .getByRole("textbox", { name: copy.nameLabel, exact: true })
        .fill(adminName);
      await edit
        .getByRole("textbox", { name: copy.cityLabel, exact: true })
        .fill(adminCity);
      await edit
        .getByRole("button", { name: copy.saveProfile, exact: true })
        .click();
      await expect
        .poll(() => readProfile(learningUser.id))
        .toMatchObject({ name: adminName, city: adminCity });
      await expect(
        edit.getByText(stateCopy.profileSaved, { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(page.locator("#personal-center")).toContainText(adminName);

      const staffPage = await staffContext.newPage();
      staffPage.on("pageerror", (error) => errors.push(error.message));
      await staffContext.addCookies([
        { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
      ]);
      await loginLearningUser(staffPage, staff);
      await staffContext.addCookies([
        { name: "bs-locale", value: language, url: "http://localhost:3000" },
      ]);
      await staffPage.goto("/salesman/my");
      const previousStaff = readProfile(staff.id);
      const requestedName = `学习申请 ${staff.runId}`;
      const requestedCity = `Review city ${language}`;
      await staffPage
        .getByRole("button", { name: copy.editProfile, exact: true })
        .click();
      const requestDialog = staffPage.getByRole("dialog");
      await requestDialog
        .getByRole("textbox", { name: copy.nameLabel, exact: true })
        .fill(requestedName);
      await requestDialog
        .getByRole("textbox", { name: copy.cityLabel, exact: true })
        .fill(requestedCity);
      await requestDialog
        .getByRole("button", { name: copy.saveProfile, exact: true })
        .click();
      const readRequests = () =>
        JSON.parse(
          executeLearningSql(`select coalesce(json_agg(t),'[]') from (
        select id,user_id,requested_name,requested_city,status,reviewer_user_id,reviewed_at
        from public.user_profile_change_requests where user_id='${staff.id}') t;`),
        );
      await expect.poll(() => readRequests().length).toBe(1);
      await expect(
        requestDialog.getByText(stateCopy.profileChangeSubmitted, {
          exact: true,
        }),
      ).toBeVisible();
      expect(readRequests()[0]).toMatchObject({
        requested_name: requestedName,
        requested_city: requestedCity,
        status: "pending",
      });
      expect(readProfile(staff.id)).toEqual(previousStaff);

      await page.goto("/admin/reviews");
      const row = page.getByRole("article").filter({ hasText: staff.email });
      await row
        .getByRole("button", {
          name: messages.ReviewsUI.actions.approve,
          exact: true,
        })
        .click();
      await page
        .getByRole("dialog")
        .getByRole("button", {
          name: messages.DashboardFramework.confirm.accept,
          exact: true,
        })
        .click();
      await expect.poll(() => readRequests()[0]?.status).toBe("approved");
      expect(readRequests()[0].reviewer_user_id).toBe(learningUser.id);
      expect(readRequests()[0].reviewed_at).toBeTruthy();
      expect(readProfile(staff.id)).toMatchObject({
        name: requestedName,
        city: requestedCity,
      });
      await expect(row).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByRole("article").filter({ hasText: staff.email }),
      ).toHaveCount(0);
      await staffPage.reload();
      await expect(staffPage.locator("#personal-center")).toContainText(
        requestedName,
      );
      for (const width of [1440, 390]) {
        await staffPage.setViewportSize({ width, height: 1000 });
        // 尺寸切换可能重新装载页面；先等已核对的资料和认证区恢复，避免把加载占位截图当作终态。
        await expect(staffPage.locator("#personal-center")).toContainText(requestedName);
        await expect(staffPage.locator("#account-verification")).toBeVisible();
        expect(
          await staffPage.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await staffPage.screenshot({
          path: testInfo.outputPath(`profile-${language}-${width}.png`),
          fullPage: true,
        });
      }
      expect(errors).toEqual([]);
      await writeFile(
        testInfo.outputPath("profile-business-receipts.json"),
        JSON.stringify(
          {
            admin: readProfile(learningUser.id),
            request: readRequests()[0],
            staff: readProfile(staff.id),
            reloadConsistent: true,
          },
          null,
          2,
        ),
      );
    } finally {
      // 页面关闭和员工账号清理分属不同生命周期，避免关闭失败挡住账号 teardown。
      await staffContext.close();
    }
  });
}
