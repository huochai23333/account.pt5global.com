import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

for (const [locale, width, messages] of [["zh", 1440, zh], ["en", 390, en]] as const) {
  test(`公告维护和受众筛选 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const label = `Learning announcement ${randomUUID()}`;
    const internal = `${label} staff`;
    const everybody = `${label} all`;
    const copy = messages.Announcements;
    const adminUrl = "/admin/announcements";
    const requests: string[] = [];
    const errors: string[] = [];
    const read = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(r),'[]') from (
      select id, status, audience, published_at, title, content, xmin::text as version from public.announcements
      where created_by_user_id='${learningUser.id}' and title in ('${internal}','${everybody}')
    ) r;`)) as { id: string; status: string; audience: string; title: string; content: string; published_at: string | null; version: string }[];
    const row = page.locator("article").filter({ has: page.getByRole("heading", { name: internal, exact: true }) });
    const statusBadge = row.locator('[data-slot="status-badge"]');
    try {
      page.setDefaultTimeout(8_000);
      // 全体受众样本保持草稿。真实发布只作用于本次内部公告。
      executeLearningSql(`insert into public.announcements(title,content,audience,created_by_user_id)
        values ('${everybody}','Learning draft','all','${learningUser.id}');`);
      await page.setViewportSize({ width, height: 900 });
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (request.url().includes("/rest/v1/announcements") && request.method() !== "GET") requests.push(request.method());
      });
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      const noticeCopy = messages.DashboardShell.announcements;
      const notice = page.getByRole("dialog", { name: noticeCopy.newTitle, exact: true });
      // 管理列表与工作台共用顶栏，自动弹出的阅读通知须先处理。
      await page.addLocatorHandler(notice, async () => {
        await notice.getByRole("button", { name: noticeCopy.acknowledge, exact: true }).click();
      });
      await page.goto(adminUrl);
      await page.getByRole("button", { name: copy.header.create }).click();
      const dialog = page.getByRole("dialog", { name: copy.dialog.createTitle });
      await dialog.getByPlaceholder(copy.dialog.titlePlaceholder).fill(internal);
      await dialog.getByPlaceholder(copy.dialog.contentPlaceholder).fill("Local learning draft");
      await dialog.locator('[data-slot="select"]').click();
      await page.getByRole("option", { name: copy.audience.internal, exact: true }).click();
      await dialog.getByRole("button", { name: copy.dialog.createSubmit }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(statusBadge).toHaveText(copy.status.draft);
      const draft = read().filter((entry) => entry.title === internal);
      expect(draft).toHaveLength(1);
      expect(draft[0]).toMatchObject({ audience: "internal", status: "draft", published_at: null });
      expect(requests).toEqual(["POST"]);

      if (width === 390) {
        await page.getByRole("button", { name: messages.DashboardFramework.filters.expand, exact: true }).click();
      }
      const audience = page.getByRole("combobox", { name: copy.filters.audienceLabel, exact: true });
      await audience.click();
      await page.getByRole("option", { name: copy.audience.all, exact: true }).click();
      await expect(page.getByRole("heading", { name: everybody, exact: true })).toBeVisible();
      await expect(row).toHaveCount(0);
      await audience.click();
      await page.getByRole("option", { name: copy.filters.allAudiences, exact: true }).click();

      const publish = row.getByRole("button", { name: copy.list.publish, exact: true });
      await page.route("**/rest/v1/announcements?*", (route) => route.request().method() === "PATCH"
        ? route.fulfill({ status: 200, json: [] })
        : route.fallback());
      await publish.click();
      await expect(page.getByText(copy.feedback.notFoundError, { exact: true })).toBeVisible();
      expect(read().find(({ id }) => id === draft[0].id)).toEqual(draft[0]);
      await page.unroute("**/rest/v1/announcements?*");
      await publish.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(statusBadge).toHaveText(copy.status.published);
      const published = read().find(({ id }) => id === draft[0].id);
      expect(published).toMatchObject({ status: "published", published_at: expect.any(String) });
      expect(published?.version).not.toBe(draft[0].version);
      expect(requests).toEqual(["POST", "PATCH", "PATCH"]);
      expect(executeLearningSql(`begin; set local role anon;
        select count(*) from public.get_latest_public_announcement() where id='${draft[0].id}'; rollback;`)).toBe("0");

      await page.reload();
      await expect(statusBadge).toHaveText(copy.status.published);
      expect(read().find(({ id }) => id === draft[0].id)).toEqual(published);
      await page.screenshot({ path: testInfo.outputPath("published.png"), animations: "disabled" });

      await row.getByRole("button", { name: copy.list.edit, exact: true }).click();
      const edit = page.getByRole("dialog", { name: copy.dialog.editTitle });
      await edit.getByPlaceholder(copy.dialog.contentPlaceholder).fill("Local learning revision");
      await edit.getByRole("button", { name: copy.dialog.editSubmit, exact: true }).click();
      await expect(row.getByText("Local learning revision", { exact: true })).toBeVisible();
      const edited = read().find(({ id }) => id === draft[0].id);
      expect(edited).toMatchObject({ content: "Local learning revision", status: "published", published_at: published?.published_at });
      expect(edited?.version).not.toBe(published?.version);

      await row.getByRole("button", { name: copy.list.offline, exact: true }).click();
      await expect(statusBadge).toHaveText(copy.status.offline);
      const offline = read().find(({ id }) => id === draft[0].id);
      expect(offline).toMatchObject({ status: "offline", published_at: null });
      expect(offline?.version).not.toBe(edited?.version);
      await row.getByRole("button", { name: copy.list.delete, exact: true }).click();
      const confirm = messages.DashboardFramework.confirm;
      await page.getByRole("dialog", { name: confirm.title, exact: true }).getByRole("button", { name: confirm.accept, exact: true }).click();
      await expect(row).toHaveCount(0);
      expect(read().filter(({ id }) => id === draft[0].id)).toHaveLength(0);
      await page.reload();
      await expect(row).toHaveCount(0);
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await writeFile(testInfo.outputPath("announcement-lifecycle.json"), JSON.stringify({ draft: draft[0], published, edited, offline, deletedRows: 0 }, null, 2));
    } finally {
      executeLearningSql(`delete from public.announcements where created_by_user_id='${learningUser.id}' and title in ('${internal}','${everybody}');`);
      expect(read()).toEqual([]);
    }
  });
}
