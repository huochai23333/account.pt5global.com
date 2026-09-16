import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getRegressionAccount } from "./helpers/accounts";
import { loginAs } from "./helpers/auth";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

const BUCKET_NAME = "user-media";

type MediaReceipt = {
  bucket_name: string;
  id: string;
  original_name: string;
  storage_path: string;
  user_id: string;
};

test.describe("个人媒体最终业务凭证", () => {
  test("页面拒绝伪造成功，并在真实删除后核对数据库和 Storage", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const admin = requireLocalAdminClient();
    const runKey = Date.now();
    const fileName = `user-media-receipt-${runKey}.png`;
    let receipt: MediaReceipt | null = null;

    try {
      await page.setViewportSize({ height: 900, width: 1440 });
      const account = await loginAs(page, "operator");
      await page.goto(`${account.workspacePath}/my`);
      await page.getByRole("button", { name: /个人照片/ }).click();

      const dialog = page.getByRole("dialog", { name: "个人照片" });
      await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
        buffer: buildTinyPng(),
        mimeType: "image/png",
        name: fileName,
      });
      await expect(dialog.getByText("个人照片已上传，当前状态为待审核。")).toBeVisible();

      // 页面提示不能作为成功凭证；使用服务角色从另一条连接确认数据库记录和真实对象。
      receipt = await readMediaReceipt(admin, fileName);
      expect(receipt.bucket_name).toBe(BUCKET_NAME);
      await expectStorageExists(admin, receipt, true);
      await page.reload();
      await page.getByRole("button", { name: /个人照片/ }).click();
      const refreshedDialog = page.getByRole("dialog", { name: "个人照片" });
      const mediaCard = refreshedDialog.locator("article", { hasText: fileName });
      await expect(mediaCard).toBeVisible();

      // 故意让删除请求得到 HTTP 200，但省略 Storage 删除后的确认凭证。
      // 页面必须显示错误，数据库和对象都应保持不变，否则这条测试就是无效的。
      await page.route("**/functions/v1/user-media-mutate", async (route) => {
        const body = route.request().postDataJSON() as { action?: unknown };
        if (body?.action !== "delete") {
          await route.continue();
          return;
        }
        await route.fulfill({
          body: JSON.stringify({
            deletedCount: 1,
            operationId: crypto.randomUUID(),
            status: "succeeded",
            storageDeletionVerified: false,
          }),
          contentType: "application/json",
          status: 200,
        });
      });
      await mediaCard.getByRole("button", { name: "删除" }).click();
      await expect(
        refreshedDialog.locator('[data-slot="feedback-notice"][data-tone="error"]'),
      ).toBeVisible();
      await expect(
        refreshedDialog.locator('[data-slot="feedback-notice"][data-tone="success"]'),
      ).toHaveCount(0);
      expect((await readMediaReceipt(admin, fileName)).id).toBe(receipt.id);
      await expectStorageExists(admin, receipt, true);

      await page.unroute("**/functions/v1/user-media-mutate");
      const deleteResponsePromise = page.waitForResponse((response) => {
        if (!response.url().includes("/functions/v1/user-media-mutate")) return false;
        try {
          return response.request().postDataJSON()?.action === "delete";
        } catch {
          return false;
        }
      });
      await mediaCard.getByRole("button", { name: "删除" }).click();
      const deleteResponse = await deleteResponsePromise;
      const deleteResult = (await deleteResponse.json()) as {
        operationId?: unknown;
      };
      await expect(refreshedDialog.getByText("所选照片已删除。")).toBeVisible();
      await expectMediaReceiptMissing(admin, receipt);
      await expectSucceededOperationRun(deleteResult.operationId, receipt.id);

      // 整页刷新后再次打开弹窗，证明页面不是只移除了内存中的卡片。
      await page.reload();
      await page.getByRole("button", { name: /个人照片/ }).click();
      await expect(page.getByRole("dialog", { name: "个人照片" }).getByText(fileName)).toHaveCount(0);

      // 移动端复查同一弹窗，防止操作按钮、文件名或反馈区被压出屏幕。
      await page.setViewportSize({ height: 844, width: 390 });
      await expectNoDocumentHorizontalOverflow(page);
    } finally {
      if (receipt) await cleanupMediaReceipt(admin, receipt);
    }
  });
});

function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对最终业务凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

async function readMediaReceipt(admin: SupabaseClient, fileName: string) {
  const { data, error } = await admin
    .from("user_media_assets")
    .select("id,user_id,bucket_name,storage_path,original_name")
    .eq("original_name", fileName)
    .single<MediaReceipt>();
  if (error) throw error;
  return data;
}

async function expectMediaReceiptMissing(
  admin: SupabaseClient,
  receipt: MediaReceipt,
) {
  await expect.poll(async () => {
    const { count, error } = await admin
      .from("user_media_assets")
      .select("id", { count: "exact", head: true })
      .eq("id", receipt.id);
    if (error) throw error;
    return count;
  }).toBe(0);
  await expectStorageExists(admin, receipt, false);
}

async function expectSucceededOperationRun(
  operationId: unknown,
  deletedAssetId: string,
) {
  expect(operationId).toEqual(expect.any(String));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !publishableKey) {
    throw new Error("local_supabase_public_credentials_required");
  }

  // 使用独立的运营账号连接读取公开 RPC，不复用页面响应或服务角色查询结果。
  const verifier = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const account = getRegressionAccount("operator");
  const { error: signInError } = await verifier.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  if (signInError) throw signInError;

  const { data, error } = await verifier.rpc("get_operation_run", {
    p_operation_id: operationId,
  });
  if (error) throw error;
  expect(data).toMatchObject({
    completedAt: expect.any(String),
    failedCount: 0,
    operationId,
    operationKey: "user-media-delete",
    resultProof: {
      deletedAssetIds: [deletedAssetId],
      deletedCount: 1,
      storageDeletionVerified: true,
    },
    status: "succeeded",
    succeededCount: 1,
  });
  // 这里不能调用 signOut：Supabase 会撤销这个账号的其它刷新令牌，导致正在验收的
  // 浏览器会话也被登出。测试客户端不持久化会话，进程结束后会自然释放。
}

async function expectStorageExists(
  admin: SupabaseClient,
  receipt: MediaReceipt,
  expected: boolean,
) {
  await expect.poll(async () => {
    const result = await admin.storage
      .from(receipt.bucket_name)
      .exists(receipt.storage_path);
    if (result.error && result.data !== false) throw result.error;
    return result.data;
  }).toBe(expected);
}

async function cleanupMediaReceipt(
  admin: SupabaseClient,
  receipt: MediaReceipt,
) {
  await admin.storage.from(receipt.bucket_name).remove([receipt.storage_path]);
  await admin.from("user_media_assets").delete().eq("id", receipt.id);
}

async function expectNoDocumentHorizontalOverflow(page: import("@playwright/test").Page) {
  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth + 1);
}

function buildTinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
}
