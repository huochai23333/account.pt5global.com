import { expect, test, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getRegressionAccount } from "./helpers/accounts";
import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

const ORDER_ID = "c2000000-0000-4000-8000-000000000002";
const ORDER_NUMBER = buildCurrentLocalOrderNumber(2);
const BUCKET_NAME = "wholesale-order-lists";

type AttachmentReceipt = {
  bucket_name: string;
  id: string;
  original_name: string;
  storage_path: string;
};

test.describe("Order List 最终业务凭证", () => {
  test("页面上传和删除后，数据库、Storage 与刷新页面保持一致", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const admin = requireLocalAdminClient();
    const account = getRegressionAccount("administrator");
    const runKey = Date.now();
    const fileNames = [
      `receipt-${runKey}-a.csv`,
      `receipt-${runKey}-b.xlsx`,
    ];

    try {
      await page.setViewportSize({ height: 900, width: 1440 });
      await loginAs(page, "administrator");
      await page.goto("/admin/wholesale/orders");
      const orderRow = await findOrderRow(page);
      await orderRow.getByRole("button", { name: "管理附件" }).click();

      const dialog = page.getByRole("dialog", { name: /Order List 附件/ });
      await dialog.locator('input[type="file"]').setInputFiles([
        {
          buffer: Buffer.from("sku,quantity\nVERIFY-001,2\n", "utf8"),
          mimeType: "text/csv",
          name: fileNames[0],
        },
        {
          buffer: Buffer.from("verified xlsx payload", "utf8"),
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          name: fileNames[1],
        },
      ]);
      await dialog.getByRole("button", { name: "上传附件" }).click();
      await expect(page.getByText("Order List 附件已上传。")).toBeVisible();

      // 页面提示不是成功凭证；这里用服务角色从另一条连接独立读取数据库和对象存储。
      const rows = await readAuthoritativeAttachments(admin, fileNames);
      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row) => row.id)).size).toBe(2);
      for (const row of rows) {
        expect(row.bucket_name).toBe(BUCKET_NAME);
        const existence = await admin.storage
          .from(row.bucket_name)
          .exists(row.storage_path);
        expect(existence.error).toBeNull();
        expect(existence.data).toBe(true);
      }

      // 强制整页刷新后重新查单，确认页面不是只依赖内存中的乐观结果。
      await page.reload();
      const refreshedRow = await findOrderRow(page);
      await expect(
        refreshedRow.getByRole("button", { name: fileNames[0] }),
      ).toBeVisible();
      await expect(
        refreshedRow.getByRole("button", { name: fileNames[1] }),
      ).toBeVisible();

      await refreshedRow.getByRole("button", { name: "管理附件" }).click();
      const refreshedDialog = page.getByRole("dialog", {
        name: /Order List 附件/,
      });
      for (const row of rows) {
        await refreshedDialog
          .locator(`[data-attachment-name="${row.original_name}"]`)
          .getByRole("button", { name: "删除" })
          .click();
        await page
          .getByRole("dialog", { name: "请确认这项操作" })
          .getByRole("button", { name: "确认操作" })
          .click();
        await expect(page.getByText("Order List 附件已删除。")).toBeVisible();
        await expectAttachmentMissing(admin, row);
      }

      await page.reload();
      const finalRow = await findOrderRow(page);
      await finalRow.getByRole("button", { name: "管理附件" }).click();
      const finalDialog = page.getByRole("dialog", { name: /Order List 附件/ });
      await expect(finalDialog.getByText(fileNames[0])).toHaveCount(0);
      await expect(finalDialog.getByText(fileNames[1])).toHaveCount(0);
    } finally {
      await cleanupNamedAttachments(admin, fileNames, account.email);
    }
  });

  test("故意返回 HTTP 200 的部分登记结果时，页面拒绝成功并清理对象", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const admin = requireLocalAdminClient();
    const account = getRegressionAccount("administrator");
    const runKey = Date.now();
    const fileNames = [
      `broken-receipt-${runKey}-a.csv`,
      `broken-receipt-${runKey}-b.csv`,
    ];

    try {
      await page.setViewportSize({ height: 844, width: 390 });
      await loginAs(page, "administrator");
      await page.goto("/admin/wholesale/orders");
      const orderCard = await findOrderCard(page);
      await orderCard.click();
      const orderDialog = page.getByRole("dialog", { name: `订单 ${ORDER_NUMBER}` });
      await orderDialog.getByRole("button", { name: "管理附件" }).click();
      const attachmentDialog = page.getByRole("dialog", {
        name: /Order List 附件/,
      });

      // 这里故意破坏业务结果：请求返回 200，但只返回两份附件中的一份。
      // 测试必须看到错误且数据库、Storage 都没有残留，否则这条回归就是无效的。
      await page.route(
        "**/rest/v1/rpc/register_wholesale_order_list_attachments",
        async (route) => {
          const request = route.request().postDataJSON() as {
            p_attachments?: Array<Record<string, unknown>>;
            p_order_id?: string;
          };
          const first = request.p_attachments?.[0] ?? {};
          await route.fulfill({
            body: JSON.stringify([
              {
                ...first,
                id: "00000000-0000-4000-8000-000000000001",
                order_id: request.p_order_id,
              },
            ]),
            contentType: "application/json",
            status: 200,
          });
        },
      );

      await attachmentDialog.locator('input[type="file"]').setInputFiles(
        fileNames.map((name) => ({
          buffer: Buffer.from(`sku,quantity\n${name},1\n`, "utf8"),
          mimeType: "text/csv",
          name,
        })),
      );
      await attachmentDialog.getByRole("button", { name: "上传附件" }).click();

      await expect(
        page.locator('[data-slot="feedback-notice"][data-tone="error"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-slot="feedback-notice"][data-tone="success"]'),
      ).toHaveCount(0);
      await expect(attachmentDialog).toBeVisible();
      expect(await readAuthoritativeAttachments(admin, fileNames)).toHaveLength(0);
      await expectStorageNamesMissing(admin, fileNames, account.email);
      await expectNoDocumentHorizontalOverflow(page);
    } finally {
      await cleanupNamedAttachments(admin, fileNames, account.email);
    }
  });
});

function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对最终业务凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

async function findOrderRow(page: Page) {
  await page.getByLabel("搜索订单").fill(ORDER_NUMBER);
  await page.getByRole("button", { name: "跨日期查此单号" }).click();
  const row = page.getByTestId(`wholesale-order-row-${ORDER_ID}`);
  await expect(row).toBeVisible();
  return row;
}

async function findOrderCard(page: Page) {
  await page.getByLabel("搜索订单").fill(ORDER_NUMBER);
  await page.getByRole("button", { name: "跨日期查此单号" }).click();
  const card = page.getByTestId(`wholesale-order-card-${ORDER_ID}`);
  await expect(card).toBeVisible();
  return card;
}

async function readAuthoritativeAttachments(
  admin: SupabaseClient,
  fileNames: string[],
) {
  const { data, error } = await admin
    .from("wholesale_order_list_attachments")
    .select("id,bucket_name,storage_path,original_name")
    .eq("order_id", ORDER_ID)
    .in("original_name", fileNames)
    .order("original_name");
  if (error) throw error;
  return (data ?? []) as AttachmentReceipt[];
}

async function expectAttachmentMissing(
  admin: SupabaseClient,
  row: AttachmentReceipt,
) {
  await expect.poll(async () => {
    const { count, error } = await admin
      .from("wholesale_order_list_attachments")
      .select("id", { count: "exact", head: true })
      .eq("id", row.id);
    if (error) throw error;
    return count;
  }).toBe(0);

  await expect.poll(async () => {
    const result = await admin.storage.from(row.bucket_name).exists(row.storage_path);
    if (result.error && result.data !== false) throw result.error;
    return result.data;
  }).toBe(false);
}

async function expectStorageNamesMissing(
  admin: SupabaseClient,
  fileNames: string[],
  accountEmail: string,
) {
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("email", accountEmail)
    .single<{ user_id: string }>();
  if (profileError) throw profileError;

  await expect.poll(async () => {
    const { data, error } = await admin.storage
      .from(BUCKET_NAME)
      .list(`${ORDER_ID}/${profile.user_id}`, { limit: 100 });
    if (error) throw error;
    return (data ?? []).filter((item) =>
      fileNames.some((fileName) => item.name.endsWith(fileName)),
    ).length;
  }).toBe(0);
}

async function cleanupNamedAttachments(
  admin: SupabaseClient,
  fileNames: string[],
  accountEmail: string,
) {
  const rows = await readAuthoritativeAttachments(admin, fileNames);
  if (rows.length > 0) {
    const { error: storageError } = await admin.storage
      .from(BUCKET_NAME)
      .remove(rows.map((row) => row.storage_path));
    if (storageError) throw storageError;
    const { error: databaseError } = await admin
      .from("wholesale_order_list_attachments")
      .delete()
      .in("id", rows.map((row) => row.id));
    if (databaseError) throw databaseError;
  }

  // 登记完全失败时数据库没有路径可查，因此还要按测试账号的固定私有目录寻找孤立对象。
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("email", accountEmail)
    .single<{ user_id: string }>();
  if (profileError) throw profileError;
  const { data: objects, error: listError } = await admin.storage
    .from(BUCKET_NAME)
    .list(`${ORDER_ID}/${profile.user_id}`, { limit: 100 });
  if (listError) throw listError;
  const orphanPaths = (objects ?? [])
    .filter((item) => fileNames.some((fileName) => item.name.endsWith(fileName)))
    .map((item) => `${ORDER_ID}/${profile.user_id}/${item.name}`);
  if (orphanPaths.length > 0) {
    const { error } = await admin.storage.from(BUCKET_NAME).remove(orphanPaths);
    if (error) throw error;
  }
}

async function expectNoDocumentHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(2);
}

function buildCurrentLocalOrderNumber(index: number) {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(new Date());
  const year = dateParts.find((part) => part.type === "year")?.value ?? "";
  const month = dateParts.find((part) => part.type === "month")?.value ?? "";
  return `WH-LOCAL-${year}${month}-${String(index).padStart(3, "0")}`;
}
