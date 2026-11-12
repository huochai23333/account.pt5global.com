import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { documentAdmin } from "./document-library";
import { documentLogin } from "./document-library";
import { holdDocumentWrites } from "./document-write-lock";
import { test } from "./template-draft-fixture";
import { openDraft } from "./template-draft-fixture";
import { draft } from "./template-draft-fixture";
import { cleanup } from "./template-draft-fixture";
/** 旧修订、超时及断网恢复；重试沿用原操作编号，结果单独查库。 */
export function registerDraftRecoveryCases() {
  test("草稿旧窗口不能覆盖新修订，未提交的另存为取消后继续自动保存", async ({ page }) => {
    test.setTimeout(120000);
    const ids: string[] = [];
    const prefix = `draft-conflict-${randomUUID()}-`;
    const second = await page.context().newPage();
    let newer: Page | undefined;
    try {
      await documentLogin(page, "salesman");
      const id = await openDraft(page, ids);
      await second.goto(page.url());
      await expect(second.getByRole("status").filter({ hasText: /^草稿已保存$/ })).toBeVisible();
      await page
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "新修订");
      await expect.poll(async () => JSON.stringify((await draft(id)).state)).toContain(prefix + "新修订");
      const authoritative = await draft(id);
      await second
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "旧窗口");
      await expect(second.getByRole("status").filter({ hasText: /草稿已有新修改/ })).toBeVisible();
      expect((await draft(id)).revision).toBe(authoritative.revision);
      expect(JSON.stringify((await draft(id)).state)).toContain(prefix + "新修订");
      await page.getByRole("button", { name: "另存为", exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: "取消", exact: true }).click();
      await page
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "取消后修改");
      await expect.poll(async () => JSON.stringify((await draft(id)).state)).toContain(prefix + "取消后修改");
      await page.reload();
      await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix + "取消后修改");
      // 写入已完成但响应丢失后，另一窗口还能继续更新；旧回执必须识别为冲突并停止重送。
      let originalOperation = "";
      await page.route("**/api/company-template-document-drafts", async (route) => {
        originalOperation = route.request().postDataJSON().operationId;
        await route.fetch();
        await route.abort("connectionreset");
      });
      await page
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "响应未到");
      await expect(page.getByRole("status").filter({ hasText: /草稿保存未完成/ })).toBeVisible();
      expect(JSON.stringify((await draft(id)).state)).toContain(prefix + "响应未到");
      await page.unroute("**/api/company-template-document-drafts");
      newer = await page.context().newPage();
      await newer.goto(page.url());
      await expect(newer.frameLocator("iframe").locator("#client")).toHaveValue(prefix + "响应未到");
      await newer
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "另一窗口继续修改");
      await expect
        .poll(async () => JSON.stringify((await draft(id)).state))
        .toContain(prefix + "另一窗口继续修改");
      const latest = await draft(id);
      let retryOperation = "";
      await page.route("**/api/company-template-document-drafts", async (route) => {
        retryOperation = route.request().postDataJSON().operationId;
        await route.continue();
      });
      await page.getByRole("button", { name: "重试", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: /草稿已有新修改/ })).toBeVisible();
      expect(retryOperation).toBe(originalOperation);
      await page.unroute("**/api/company-template-document-drafts");
      await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix + "响应未到");
      await page
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "冲突后本地填写");
      await page.waitForTimeout(1600);
      expect((await draft(id)).revision).toBe(latest.revision);
      expect(JSON.stringify((await draft(id)).state)).toContain(prefix + "另一窗口继续修改");
    } finally {
      await newer?.close();
      await second.close();
      await cleanup(page, ids, prefix);
    }
  });

  test("真实草稿行锁超时保留内容和原操作，人工重试及断网恢复不重复保存", async ({ page }, testInfo) => {
    test.setTimeout(150000);
    const ids: string[] = [];
    const prefix = `draft-timeout-${randomUUID()}-`;
    let release: (() => Promise<void>) | undefined;
    try {
      await documentLogin(page, "salesman");
      const id = await openDraft(page, ids);
      const before = await draft(id);
      const operations: string[] = [];
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          new URL(request.url()).pathname === "/api/company-template-document-drafts"
        ) {
          const body = request.postDataJSON();
          if (body.action === "save" && body.draftId === id) operations.push(body.operationId);
        }
      });
      release = await holdDocumentWrites(id);
      await page.frameLocator("iframe").locator("#client").fill(prefix);
      await expect(page.getByRole("status").filter({ hasText: /正在保存草稿/ })).toBeVisible();
      await expect(page.getByRole("status").filter({ hasText: /^草稿已保存$/ })).toHaveCount(0);
      await expect(page.getByRole("status").filter({ hasText: /草稿保存未完成/ })).toBeVisible({
        timeout: 45000,
      });
      expect((await draft(id)).revision).toBe(before.revision);
      await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix);
      await release();
      release = undefined;
      await page.getByRole("button", { name: "重试", exact: true }).click();
      await expect
        .poll(async () => JSON.stringify((await draft(id)).state), { timeout: 45000 })
        .toContain(prefix);
      await expect(page.getByRole("status").filter({ hasText: /^草稿已保存$/ })).toBeVisible();
      expect(operations[1]).toBe(operations[0]);
      const saved = await draft(id);
      // 浏览器确实断网后再次填写，服务器记录不变；在线事件重送失败的原请求。
      await page.context().setOffline(true);
      await page
        .frameLocator("iframe")
        .locator("#client")
        .fill(prefix + "离线填写");
      await expect(page.getByRole("status").filter({ hasText: /草稿保存未完成/ })).toBeVisible();
      expect((await draft(id)).revision).toBe(saved.revision);
      await page.context().setOffline(false);
      await expect
        .poll(async () => JSON.stringify((await draft(id)).state), { timeout: 45000 })
        .toContain(prefix + "离线填写");
      expect(operations[3]).toBe(operations[2]);
      expect(operations).toHaveLength(4);
      for (const operation of [operations[0], operations[2]])
        expect(
          (
            await documentAdmin()
              .from("company_template_draft_operations")
              .select("receipt")
              .eq("operation_id", operation)
              .eq("draft_id", id)
          ).data,
        ).toHaveLength(1);
      await page.reload();
      await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(prefix + "离线填写");
      expect(
        (await documentAdmin().from("company_template_document_drafts").select("id").eq("id", id)).data,
      ).toHaveLength(1);
      writeFileSync(
        testInfo.outputPath("draft-retry-proof.json"),
        JSON.stringify(
          {
            draftId: id,
            revision: (await draft(id)).revision,
            operationIds: [operations[0], operations[2]],
            manualRetry: true,
            onlineRetry: true,
            uniqueReceipts: true,
          },
          null,
          2,
        ),
      );
    } finally {
      if (release) await release();
      await page.context().setOffline(false);
      await cleanup(page, ids, prefix);
    }
  });
}
