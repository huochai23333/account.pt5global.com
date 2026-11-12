import { test, expect } from "@playwright/test";
import { cleanupTemplateDocumentFixtures } from "../test-support/template-document-fixture-cleanup";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import { randomUUID } from "node:crypto";
import {
  documentAdmin,
  documentLogin,
  documentUser,
} from "./helpers/document-library";
import {
  confirmDocumentFolder,
  readPersonalDocument,
  expectDocumentContains,
  expectDocumentSaved,
} from "./helpers/company-template-documents";

test.use({ video: "off" });

test("管理员创建客户文档，业务员编辑及归档，客户始终不可访问", async ({
  page,
  browser,
}) => {
  test.setTimeout(150000);
  const admin = documentAdmin();
  const ids: string[] = [];
  const viewer = await browser.newContext();
  const client = await viewer.newPage();
  try {
    await documentLogin(page, "administrator");
    await page.goto("/admin/company-templates");
    const destinations = await (
      await page.request.get("/api/company-template-documents/destinations", {
        maxRetries: 2,
      })
    ).json();
    const archive = destinations.archives.find(
      (item: { customer_id: string }) =>
        item.customer_id === "c1000000-0000-4000-8000-000000000002",
    );
    const internal = destinations.folders.find(
      (item: { archive_id: string; system_key: string }) =>
        item.archive_id === archive.id && item.system_key === "personal",
    );
    await page
      .getByRole("button", { name: "新建文档", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/documents\/drafts\//);
    ids.push(page.url().split("/").pop()!);
    await confirmDocumentFolder(page, internal.id);
    await expectDocumentSaved(page);
    const id = page.url().split("/").pop()!;
    ids.push(id);
    await page
      .frameLocator("iframe")
      .locator("#client")
      .fill("Admin created customer doc");
    await expectDocumentContains(page, id, "Admin created customer doc");
    await documentLogin(page, "salesman");
    await page.goto(`/salesman/documents/templates/${id}`);
    await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(
      "Admin created customer doc",
    );
    await page
      .frameLocator("iframe")
      .locator("#client")
      .fill("Salesman edited other employee");
    await expectDocumentContains(page, id, "Salesman edited other employee");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveCount(0);
    expect((await readPersonalDocument(id)).folder_id).toBe(internal.id);
    // 手动保存可以直接确认当前资料目录；客户权限由档案授权独立核对。
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    // 客户身份始终没有资料库访问权，不能打开或读取文档正文。
    await documentLogin(client, "client");
    await client.goto("/client/documents?scope=folder");
    await expect(
      client.locator(`[data-template-document="${id}"]`),
    ).toHaveCount(0);
    await client.goto(`/client/documents/templates/${id}`);
    await expect(client.locator("iframe")).toHaveCount(0);
    expect(
      (
        await client.request.get(
          `/api/company-template-documents/${id}/content?loadToken=${randomUUID()}`,
        )
      ).status(),
    ).toBe(403);
    const doc = await readPersonalDocument(id);
    const blocked = await client.request.post(
      "/api/company-template-documents",
      {
        data: {
          action: "save",
          documentId: id,
          operationId: randomUUID(),
          expectedRevision: doc.revision,
          state: { forbidden: true },
        },
      },
    );
    expect(blocked.status()).toBe(403);
    expect((await readPersonalDocument(id)).revision).toBe(doc.revision);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await client.reload();
    await expect(client.frameLocator("iframe").locator("#client")).toHaveCount(
      0,
    );
    expect(
      (
        await client.request.get(
          `/api/company-template-documents/${id}/content?loadToken=${randomUUID()}`,
        )
      ).status(),
    ).toBe(403);
    await page.reload();
    await expect(page.frameLocator("iframe").locator("#client")).toHaveValue(
      "Salesman edited other employee",
    );
    // 业务员不能通过目录接口看到其他员工的资料文件夹。
    const salesmanDestinations = await (
      await page.request.get("/api/company-template-documents/destinations", {
        maxRetries: 2,
      })
    ).json();
    const adminUser = await documentUser("administrator");
    expect(
      salesmanDestinations.archives.some(
        (item: { user_id: string }) => item.user_id === adminUser,
      ),
    ).toBe(false);
  } finally {
    await cleanupFixtureResources(
      () => viewer.close(),
      () => cleanupTemplateDocumentFixtures(admin, ids),
    );
  }
});
