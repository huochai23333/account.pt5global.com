import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC9sAAAAASUVORK5CYII=", "base64");
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

for (const [locale, width, kind, decision] of [
  ["zh", 1440, "media", "approve"],
  ["en", 390, "privacy", "reject"],
  ["en", 390, "media", "reject"],
  ["zh", 1440, "privacy", "approve"],
] as const) {
  const messages = locale === "zh" ? zh : en;
  test(`审核回执 ${kind} ${locale}/${width}`, async ({ browser, page, learningUser, learningStaff }, testInfo) => {
    test.setTimeout(110_000);
    let id: string = randomUUID();
    const owner = learningStaff.id;
    const reviewer = learningUser.id;
    const media = kind === "media";
    const table = media ? "user_media_assets" : "user_privacy_requests";
    const approved = decision === "approve";
    const rpc = `${approved ? "approve" : "deny"}_user_${media ? "media_asset" : "privacy_request"}`;
    const timestamp = media ? "reviewed_at" : "review_at";
    const target = approved ? "pass" : "denied";
    const success = messages.Reviews.feedback[`${kind}${approved ? "Approved" : "Rejected"}`];
    const syntheticPassport = `LEARNING-${id}`;
    const path = `${owner}/${id}.png`;
    const bucket = learningStaff.client.storage.from("user-media");
    const read = () => JSON.parse(executeLearningSql(`select coalesce((select row_to_json(r) from (
      select id,user_id,status,reviewer_user_id,${timestamp} as reviewed_at,xmin::text as version
      from public.${table} where id='${id}' and user_id='${owner}'
    ) r),'null'::json);`));
    const errors: string[] = [];
    let requests = 0;
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().endsWith(`/rpc/${rpc}`)) requests += 1;
    });
    let uploaded = false;
    const submitterContext = media ? null : await browser.newContext({ viewport: { width, height: 900 } });
    const submitterPage = submitterContext ? await submitterContext.newPage() : null;
    const profile = "/salesman/my";
    const passportTitle = messages.DashboardMyState.passportTitle;
    const passportDialog = submitterPage?.getByRole("dialog", { name: passportTitle, exact: true });
    const openPassport = () => submitterPage!.locator("#account-verification")
      .getByRole("button").filter({ hasText: passportTitle }).click({ timeout: 15_000 });
    try {
      // 图片由专属夹具准备。隐私申请通过员工页面提交，管理员从审核中心处理同一记录。
      if (media) {
        const upload = await bucket.upload(path, image, { contentType: "image/png" });
        expect(upload.error).toBeNull();
        uploaded = true;
        executeLearningSql(`insert into public.user_media_assets(id,user_id,kind,bucket_name,storage_path,original_name,mime_type,file_size_bytes)
          values ('${id}','${owner}','image','user-media','${path}','Learning image.png','image/png',${image.length});`);
      } else if (submitterPage && submitterContext && passportDialog) {
        await submitterContext.addCookies([{ name: "bs-locale", value: "zh", url: "http://localhost:3000" }]);
        await loginLearningUser(submitterPage, learningStaff);
        const zhAnnouncement = zh.DashboardShell.announcements;
        const enAnnouncement = en.DashboardShell.announcements;
        const announcements = submitterPage.getByRole("dialog", { name: zhAnnouncement.newTitle, exact: true })
          .or(submitterPage.getByRole("dialog", { name: enAnnouncement.newTitle, exact: true }));
        // 公告可能在登录完成后才出现，先确认才能操作证件卡片。
        await submitterPage.addLocatorHandler(announcements, async (dialog) => {
          await dialog.getByRole("button", { name: zhAnnouncement.acknowledge, exact: true })
            .or(dialog.getByRole("button", { name: enAnnouncement.acknowledge, exact: true }))
            .click();
        });
        await submitterContext.addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
        await submitterPage.goto(profile);
        await openPassport();
        const copy = messages.DashboardMy;
        await expect(passportDialog).toBeVisible();
        await passportDialog.getByPlaceholder(copy.passportPlaceholder).fill(syntheticPassport);
        await passportDialog.getByRole("button", { name: copy.passportSubmit, exact: true }).click();
        await expect(passportDialog.getByText(copy.passportPendingDescription, { exact: true }).first()).toBeVisible();
        const submitted = executeLearningSql(`select id from public.user_privacy_requests
          where user_id='${owner}' and passport_requests='${syntheticPassport}' and status='pending';`);
        expect(submitted).toMatch(/^[a-f0-9-]{36}$/);
        id = submitted;
        await submitterPage.reload();
        await openPassport();
        await expect(passportDialog.getByText(copy.passportPendingDescription, { exact: true })).toBeVisible();
      }
      const pending = read();
      expect(pending).toMatchObject({ id, user_id: owner, status: "pending", reviewer_user_id: null });
      await page.setViewportSize({ width, height: 900 });
      await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
        await page.keyboard.press("Escape");
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      await page.goto("/admin/reviews");
      const tab = page.getByRole("button", { name: new RegExp(messages.Reviews.tabs[kind]) });
      await tab.click();
      const article = page.locator("article").filter({ hasText: learningStaff.email });
      if (media) {
        await article.getByRole("button").filter({ has: page.getByRole("img", { name: "Learning image.png" }) }).click();
        const preview = page.getByRole("dialog", { name: "Learning image.png", exact: true });
        await expect(preview.getByRole("img", { name: "Learning image.png" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(preview).toHaveCount(0);
      }
      const action = article.getByRole("button", { name: messages.ReviewsUI.actions[decision], exact: true });
      const confirmCopy = messages.DashboardFramework.confirm;
      const confirm = page.getByRole("dialog", { name: confirmCopy.title, exact: true }).getByRole("button", { name: confirmCopy.accept, exact: true });
      await page.route(`**/rpc/${rpc}`, (route) => route.fulfill({
        status: 200, contentType: "application/json", body: "null",
      }), { times: 1 });
      await action.click();
      await confirm.click();
      await expect(page.getByText(messages.Reviews.feedback.unconfirmed, { exact: true })).toBeVisible();
      await expect(action).toBeEnabled();
      await expect(page.getByText(success, { exact: true })).toHaveCount(0);
      await expect(article).toBeVisible();
      expect(read()).toEqual(pending);

      await page.route(`**/rpc/${rpc}`, async (route) => {
        const response = await route.fetch({ maxRetries: 0 });
        expect(response.ok()).toBe(true);
        expect(read().status).toBe(target);
        if (media && approved) await route.abort("connectionreset");
        else await route.fulfill({ response });
      }, { times: 1 });
      await action.click();
      await confirm.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(page.getByText(success, { exact: true })).toBeVisible();
      await expect(article).toHaveCount(0);
      const terminal = read();
      expect(terminal).toMatchObject({ id, user_id: owner, status: target, reviewer_user_id: reviewer, reviewed_at: expect.any(String) });
      expect(terminal.version).not.toBe(pending.version);
      expect(requests).toBe(2);
      let storageSha: string | null = null;
      if (media) {
        const download = await bucket.download(path);
        expect(download.error).toBeNull();
        storageSha = digest(Buffer.from(await download.data!.arrayBuffer()));
        expect(storageSha).toBe(digest(image));
        const source = executeLearningSql(`select review_source || '|' || (purge_after is not null)::text
          from public.user_media_assets where id='${id}' and user_id='${owner}';`);
        expect(source).toBe(approved ? "manual|false" : "manual|true");
      } else {
        const privacy = executeLearningSql(`select count(*) from public.user_privacy_data
          where user_id='${owner}' and passport='${syntheticPassport}';`);
        expect(privacy).toBe(approved ? "1" : "0");
        if (!submitterPage || !passportDialog) throw new Error("缺少申请者浏览器页面");
        await submitterPage.reload();
        await openPassport();
        if (approved) {
          await expect(passportDialog.getByText(messages.DashboardMy.passportApprovedDescription, { exact: true })).toBeVisible();
        } else {
          await expect(passportDialog.getByPlaceholder(messages.DashboardMy.passportPlaceholder)).toBeVisible();
        }
      }
      await page.reload();
      await tab.click();
      await expect(article).toHaveCount(0);
      expect(read()).toEqual(terminal);
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("review.png"), animations: "disabled" });
      await writeFile(testInfo.outputPath("review-receipt.json"), JSON.stringify({ pending, terminal, storageSha }, null, 2));
    } finally {
      await submitterContext?.close();
      const selector = media ? `id='${id}'` : `passport_requests='${syntheticPassport}'`;
      executeLearningSql(`delete from public.${table} where user_id='${owner}' and ${selector};`);
      expect(read()).toBeNull();
      if (!media) {
        executeLearningSql(`delete from public.user_privacy_data where user_id='${owner}' and passport='${syntheticPassport}';`);
        expect(executeLearningSql(`select count(*) from public.user_privacy_data where user_id='${owner}';`)).toBe("0");
      }
      if (uploaded) {
        const removal = await bucket.remove([path]);
        expect(removal.error).toBeNull();
        expect(executeLearningSql(`select count(*) from storage.objects where bucket_id='user-media' and name='${path}';`)).toBe("0");
      }
    }
  });
}

test.describe("审核中心权限", () => {
  test.use({ learningRole: "salesman" });
  test("业务员只能到达访问受限页", async ({ page, learningUser }) => {
    await loginLearningUser(page, learningUser);
    await page.goto("/salesman/reviews");
    await expect(page).toHaveURL(/\/access-limited$/);
    await expect(page.getByRole("button", { name: zh.ReviewsUI.actions.approve, exact: true })).toHaveCount(0);
  });
});
