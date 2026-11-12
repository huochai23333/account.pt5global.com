import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

test.use({ learningRole: "salesman" });

for (const [locale, width, messages] of [["zh", 1440, zh], ["en", 390, en]] as const) {
  test(`公告已读部分失败可重试 ${locale}/${width}`, async ({ page, learningUser }, testInfo) => {
    const successfulId = randomUUID();
    const failedId = randomUUID();
    const title = `Learning announcement ${failedId}`;
    const copy = messages.DashboardShell.announcements;
    const requests = new Map<string, number>();
    const errors: string[] = [];
    // 两条合成公告模拟一条写入成功、另一条暂时失败。核对只用专属账号和这两个编号。
    const readReceipts = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(r order by announcement_id),'[]') from (
      select announcement_id, read_at, xmin::text as version from public.user_announcement_reads
      where user_id='${learningUser.id}' and announcement_id in ('${successfulId}','${failedId}')
    ) r;`)) as { announcement_id: string; read_at: string; version: string }[];
    try {
      await page.setViewportSize({ width, height: 900 });
      page.on("pageerror", (error) => errors.push(error.message));
      await loginLearningUser(page, learningUser);
      await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
      executeLearningSql(`insert into public.announcements(id,title,content,audience,status,created_by_user_id)
        values ('${successfulId}','${title} first','Local learning fixture','internal','published','${learningUser.id}'),
        ('${failedId}','${title} retry','Local learning fixture','internal','published','${learningUser.id}');`);
      await page.goto("/salesman/home");
      const dialog = page.getByRole("dialog", { name: copy.newTitle });
      await expect(dialog.getByText(`${title} retry`, { exact: true })).toBeVisible();
      await page.route("**/rpc/mark_announcement_read", async (route) => {
        const id = route.request().postDataJSON()._announcement_id as string;
        const attempt = (requests.get(id) ?? 0) + 1;
        requests.set(id, attempt);
        if (id === failedId && attempt === 1) {
          await route.fulfill({ status: 200, json: null });
          return;
        }
        // 桌面场景让另一条真实写入成功后丢失响应，确认按原编号读回。
        if (locale === "zh" && id === successfulId && attempt === 1) {
          const response = await route.fetch({ maxRetries: 0 });
          expect(response.ok()).toBe(true);
          await route.abort("connectionreset");
          return;
        }
        await route.continue();
      });

      const acknowledge = dialog.getByRole("button", { name: copy.acknowledge });
      await acknowledge.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
      await expect(dialog.getByText(copy.readPartialError, { exact: true })).toBeVisible();
      await expect(dialog.getByText(`${title} retry`, { exact: true })).toBeVisible();
      await expect(dialog.getByText(`${title} first`, { exact: true })).toHaveCount(0);
      const first = readReceipts();
      expect(first.map((row) => row.announcement_id)).toEqual([successfulId]);
      expect(requests.get(successfulId)).toBe(1);
      expect(requests.get(failedId)).toBe(1);
      await page.screenshot({ path: testInfo.outputPath("partial-read.png"), animations: "disabled" });

      await acknowledge.click();
      await expect(dialog).toHaveCount(0);
      const terminal = readReceipts();
      expect(terminal).toHaveLength(2);
      expect(terminal.find((row) => row.announcement_id === successfulId)).toEqual(first[0]);
      expect(requests.get(successfulId)).toBe(1);
      expect(requests.get(failedId)).toBe(2);
      await page.reload();
      const bell = page.getByRole("button", { name: copy.open });
      await expect(bell).toBeVisible();
      await expect(dialog).toHaveCount(0);
      await bell.click();
      const recent = page.getByRole("dialog", { name: copy.recentTitle });
      await expect(recent.getByText(`${title} retry`, { exact: true })).toBeVisible();
      await expect(recent.getByRole("button", { name: copy.acknowledge })).toHaveCount(0);
      expect(readReceipts()).toEqual(terminal);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("recent.png"), animations: "disabled" });
      await writeFile(testInfo.outputPath("read-receipts.json"), JSON.stringify({ first, terminal }, null, 2));
    } finally {
      executeLearningSql(`delete from public.announcements where id in ('${successfulId}','${failedId}') and created_by_user_id='${learningUser.id}';`);
      expect(readReceipts()).toEqual([]);
      expect(executeLearningSql(`select count(*) from public.announcements where id in ('${successfulId}','${failedId}');`)).toBe("0");
    }
  });
}
