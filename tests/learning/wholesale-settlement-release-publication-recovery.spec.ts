import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import en from "../../messages/en.json" with { type: "json" };
import zh from "../../messages/zh.json" with { type: "json" };
import { executeLearningSql, loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import { expect, test } from "./fixtures";

const rpcPath = "**/rpc/create_wholesale_settlement_release";
const readPath = /\/wholesale_settlement_releases\?.*publication_request_id=eq\./;

for (const [locale, width] of [["zh", 1440], ["en", 390]] as const) {
  test.describe(`发布收款恢复 ${locale}/${width}`, () => {
    test.use({ learningRole: locale === "zh" ? "administrator" : "finance" });
    const namespace = (locale === "zh" ? zh : en).UiText;
    const form = namespace.components_dashboard_wholesale_wholesale_settlement_release_dialogs;
    const section = namespace.components_dashboard_wholesale_wholesale_settlement_release_section;
    const table = namespace.components_dashboard_wholesale_wholesale_settlement_release_table;
    test("丢失响应后核对原收款，确认完成后相同内容可另行发布", async ({ page, learningUser }, testInfo) => {
      const owner = learningUser.id;
      const storageKey = `pt5:settlement-publication:${owner}`;
      const marker = `Learning payment ${randomUUID()}`;
      const read = () => JSON.parse(executeLearningSql(`select coalesce(json_agg(r order by created_at,id),'[]') from (
        select id,publication_request_id,customer_id,customer_name,release_amount,release_currency,
          received_on,status,note,published_by_user_id,created_at from public.wholesale_settlement_releases
        where published_by_user_id='${owner}' and customer_name='${marker}'
      ) r;`));
      const requestIds: (string | undefined)[] = [];
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (request.url().endsWith("/rpc/create_wholesale_settlement_release")) {
          requestIds.push(request.postDataJSON().p_publication_request_id);
        }
      });
      try {
        await page.setViewportSize({ width, height: 900 });
        await page.addLocatorHandler(page.getByRole("dialog").filter({ hasText: "这是一条面向所有角色的本地测试公告" }), async () => {
          await page.keyboard.press("Escape");
        });
        await loginLearningUser(page, learningUser);
        await page.context().addCookies([{ name: "bs-locale", value: locale, url: "http://localhost:3000" }]);
        await page.goto(`/${locale === "zh" ? "admin" : "finance"}/wholesale/settlement-releases`);
        const open = page.getByRole("button", { name: section.text001.trim(), exact: true });
        const dialog = page.getByRole("dialog", { name: form.attribute002, exact: true });
        const submit = dialog.getByRole("button", { name: form.text003.trim(), exact: true });
        const fill = async () => {
          await dialog.locator('input[name="customer_name"]').fill(marker);
          await dialog.locator('input[name="release_amount"]').fill("100.25");
          await dialog.getByRole("combobox", { name: form.attribute008, exact: true }).click();
          await page.getByRole("option", { name: "CNY", exact: true }).click();
          await dialog.locator('textarea[name="note"]').fill("Dedicated local verification");
        };
        await open.click();
        await fill();
        // 暂停发布回执读取，直到页面明确提示待核对，再恢复本地连接。
        await page.route(readPath, (route) => route.abort("connectionreset"));
        await page.route(rpcPath, async (route) => {
          const result = await route.fetch({ maxRetries: 0 });
          expect(result.ok()).toBe(true);
          expect(read()).toHaveLength(1);
          await route.abort("connectionreset");
        }, { times: 1 });
        await submit.evaluate((button: HTMLButtonElement) => {
          button.click();
          button.click();
        });
        await expect.poll(read).toHaveLength(1);
        const alert = dialog.getByRole("alert");
        await expect(alert).toHaveText(form.publicationUnconfirmed, { timeout: 20000 });
        const recover = dialog.getByRole("button", { name: form.recoverPublication, exact: true });
        await expect(alert).toBeInViewport({ ratio: 0.95 });
        await expect(recover).toBeInViewport({ ratio: 0.95 });
        await expect(submit).toBeEnabled();
        await page.unroute(readPath);
        const [original] = read();
        const saved = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null"), storageKey);
        expect(saved).toEqual({ requestId: original.publication_request_id, fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
        expect(requestIds).toEqual([original.publication_request_id]);
        await page.screenshot({ path: testInfo.outputPath("publication-unconfirmed.png"), animations: "disabled" });
        if (locale === "en") {
          await page.reload();
          await open.click();
          await recover.click();
        } else {
          const amount = dialog.locator('input[name="release_amount"]');
          await amount.fill("101.25");
          await submit.click();
          await expect(alert).toHaveText(form.publicationDifferent);
          expect(requestIds).toEqual([original.publication_request_id]);
          expect(read()).toEqual([original]);
          await amount.fill("100.25");
          await submit.click();
        }
        await expect(dialog).toBeHidden();
        expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();
        expect(read(), "原发布请求只产生一笔收款").toEqual([original]);
        expect(original).toMatchObject({
          customer_id: null, customer_name: marker, release_amount: 100.25, release_currency: "CNY",
          note: "Dedicated local verification", published_by_user_id: owner, status: "pending",
        });
        expect(original.publication_request_id).toMatch(/^[a-f0-9-]{36}$/);
        expect(requestIds).toEqual(locale === "zh" ? [original.publication_request_id, original.publication_request_id] : [original.publication_request_id]);
        await page.reload();
        const search = page.getByRole("textbox", { name: section.attribute006, exact: true });
        await search.fill(marker);
        await expect(page.getByTestId(`wholesale-settlement-release-row-${original.id}`))
          .toContainText(table.status.pending);
        expect(read()).toEqual([original]);
        await open.click();
        await expect(recover).toHaveCount(0);
        await fill();
        await submit.click();
        await expect(dialog).toBeHidden();
        const final = read();
        expect(final).toHaveLength(2);
        expect(final[0]).toEqual(original);
        expect(final[1].publication_request_id).not.toBe(original.publication_request_id);
        expect(final[1].id).not.toBe(original.id);
        expect(requestIds.at(-1)).toBe(final[1].publication_request_id);
        await page.reload();
        await search.fill(marker);
        for (const release of final) {
          await expect(page.getByTestId(`wholesale-settlement-release-row-${release.id}`)).toContainText(table.status.pending);
        }
        expect(read()).toEqual(final);
        expect(errors).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath("publication.png"), animations: "disabled" });
        await writeFile(testInfo.outputPath("publication-receipts.json"), JSON.stringify({ original, final, requestIds }, null, 2));
      } finally {
        executeLearningSql(`delete from public.wholesale_settlement_releases where published_by_user_id='${owner}' and customer_name='${marker}';`);
        expect(read()).toEqual([]);
        await writeFile(testInfo.outputPath("publication-cleanup.json"), JSON.stringify({ releases: 0 }));
      }
    });
  });
}
