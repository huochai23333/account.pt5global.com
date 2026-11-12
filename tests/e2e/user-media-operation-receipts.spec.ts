import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { cleanupFixtureResources } from "../test-support/fixture-cleanup-sequence";
import {
  createOwnedUserMediaCase,
  type MediaReceipt,
} from "../test-support/user-media-owned-case";
import {
  createUserMediaOwnedStore,
  readOperatorMediaOwner,
} from "./helpers/user-media-owned-store";
import { expectUserMediaDeleteOperation } from "./helpers/user-media-operation-verifier";

import { getRegressionAccount } from "./helpers/accounts";
import { loginAs } from "./helpers/auth";
import {
  getLocalSupabaseAdminClient,
  readLocalEnvValue,
} from "./helpers/local-supabase-admin";

test.describe("个人媒体最终业务凭证", () => {
  test("上传失败保留文件、提供重试，并把网络和大小错误说清楚", async ({
    page,
  }) => {
    await loginAs(page, "operator");
    await page.goto("/operator/my");
    await page.getByRole("button", { name: /个人照片/ }).click();
    const dialog = page.getByRole("dialog", { name: "个人照片" });
    const uploadKeys: string[] = [];
    await page.route("**/functions/v1/user-media-mutate", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
          },
          body: "",
        });
        return;
      }
      const body = route.request().postData() ?? "";
      uploadKeys.push(body.match(/upload:[0-9a-f-]{36}/)?.[0] ?? "");
      if (uploadKeys.length === 1) {
        await route.abort("failed");
      } else {
        await route.fulfill({
          status: 413,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
          },
          contentType: "application/json",
          body: JSON.stringify({
            message: "图片超过大小限制，请选择更小的文件。",
          }),
        });
      }
    });
    const fileName = "retry-photo.png";
    await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
      buffer: buildTinyPng(),
      mimeType: "image/png",
      name: fileName,
    });
    await expect(
      dialog.getByText("照片或视频暂时无法上传，请检查网络后重试。"),
    ).toBeVisible();
    await expect(dialog.getByText(fileName)).toBeVisible();
    await dialog.getByRole("button", { name: "重试上传" }).click();
    await expect(
      dialog.getByText("图片超过大小限制，请选择更小的文件。"),
    ).toBeVisible();
    await expect(dialog.getByText(fileName)).toBeVisible();
    expect(uploadKeys).toHaveLength(2);
    expect(uploadKeys[0]).toBeTruthy();
    expect(uploadKeys[1]).toBe(uploadKeys[0]);
    await expect(
      dialog.getByText("个人照片已上传，当前状态为待审核。"),
    ).toHaveCount(0);
  });

  test("页面拒绝伪造成功，并在真实删除后核对数据库和 Storage", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const admin = requireLocalAdminClient();
    const runKey = randomUUID();
    const fileName = `user-media-receipt-${runKey}.png`;
    let receipt: MediaReceipt | null = null;
    let mediaCase: ReturnType<typeof createOwnedUserMediaCase> | undefined;
    let bodyFailure: { error: unknown } | undefined;

    try {
      await page.setViewportSize({ height: 900, width: 1440 });
      const account = await loginAs(page, "operator");
      const userId = readOperatorMediaOwner(account.email);
      mediaCase = createOwnedUserMediaCase(
        createUserMediaOwnedStore(
          admin,
          { userId, fileName },
          process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        ),
        userId,
        fileName,
        buildTinyPng(),
      );
      await page.goto(`${account.workspacePath}/my`);
      await page.getByRole("button", { name: /个人照片/ }).click();

      const dialog = page.getByRole("dialog", { name: "个人照片" });
      await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
        buffer: buildTinyPng(),
        mimeType: "image/png",
        name: fileName,
      });
      await expect(
        dialog.getByText("个人照片已上传，当前状态为待审核。"),
      ).toBeVisible();

      // 页面提示不能作为成功凭证；使用服务角色从另一条连接确认数据库记录和真实对象。
      receipt = await waitForUploadedMedia(mediaCase);
      expect(receipt.bucket_name).toBe("user-media");
      await page.reload();
      await page.getByRole("button", { name: /个人照片/ }).click();
      const refreshedDialog = page.getByRole("dialog", { name: "个人照片" });
      const mediaCard = refreshedDialog.locator("article", {
        hasText: fileName,
      });
      await expect(mediaCard).toBeVisible();

      // 故意让删除请求得到 HTTP 200，但省略 Storage 删除后的确认凭证。
      // 页面必须显示错误，数据库和对象都应保持不变，否则这条测试就是无效的。
      await page.route("**/functions/v1/user-media-mutate", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const body = route.request().postDataJSON() as {
          action?: unknown;
          assetIds?: unknown;
        };
        if (body?.action !== "delete") {
          await route.continue();
          return;
        }
        // 只允许本次拥有的一张图片进入删除负例；错误编号不能转发去删除别人的资料。
        if (
          !Array.isArray(body.assetIds) ||
          body.assetIds.length !== 1 ||
          body.assetIds[0] !== receipt!.id
        ) {
          await route.abort("failed");
          throw new Error("media_case_delete_request_outside_scope");
        }
        await route.fulfill({
          body: JSON.stringify({
            deletedCount: 1,
            operationId: crypto.randomUUID(),
            status: "succeeded",
            storageDeletionVerified: false,
          }),
          contentType: "application/json",
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
          },
          status: 200,
        });
      });
      await mediaCard.getByRole("button", { name: "删除" }).click();
      await expect(
        refreshedDialog.locator(
          '[data-slot="feedback-notice"][data-tone="error"]',
        ),
      ).toBeVisible();
      await expect(
        refreshedDialog.locator(
          '[data-slot="feedback-notice"][data-tone="success"]',
        ),
      ).toHaveCount(0);
      await mediaCase.unchanged();

      await page.unroute("**/functions/v1/user-media-mutate");
      const deleteResponsePromise = page.waitForResponse((response) => {
        if (!response.url().includes("/functions/v1/user-media-mutate"))
          return false;
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
      await mediaCase.missing();
      await expectSucceededOperationRun(deleteResult.operationId, receipt.id);

      // 整页刷新后再次打开弹窗，证明页面不是只移除了内存中的卡片。
      await page.reload();
      await page.getByRole("button", { name: /个人照片/ }).click();
      await expect(
        page.getByRole("dialog", { name: "个人照片" }).getByText(fileName),
      ).toHaveCount(0);

      // 移动端复查同一弹窗，防止操作按钮、文件名或反馈区被压出屏幕。
      await page.setViewportSize({ height: 844, width: 390 });
      await expectNoDocumentHorizontalOverflow(page);
    } catch (error) {
      bodyFailure = { error };
    } finally {
      await finalizeOwnedMediaCase(page, mediaCase, bodyFailure, (body) =>
        test
          .info()
          .attach("user-media-owned-case", {
            body,
            contentType: "application/json",
          }),
      );
    }
  });
});

async function finalizeOwnedMediaCase(
  page: import("@playwright/test").Page,
  mediaCase: ReturnType<typeof createOwnedUserMediaCase> | undefined,
  bodyFailure: { error: unknown } | undefined,
  attach: (body: Buffer) => Promise<void>,
) {
  let pageClosed = false;
  let cleanupReceipt: unknown;
  // 正文、关闭和附件错误一同保留；页面未安全关闭时，不能与未知在途写入竞争删除。
  await cleanupFixtureResources(
    async () => {
      if (bodyFailure) throw bodyFailure.error;
    },
    async () => {
      if (!page.isClosed()) {
        await page.unrouteAll({ behavior: "wait" });
        await page.close();
      }
      pageClosed = true;
    },
    async () => {
      if (pageClosed && mediaCase) cleanupReceipt = await mediaCase.cleanup();
    },
    async () => {
      await attach(
        Buffer.from(
          JSON.stringify(
            { ...mediaCase?.evidence(), cleanupReceipt, pageClosed },
            null,
            2,
          ),
        ),
      );
    },
  );
}

function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对最终业务凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

async function waitForUploadedMedia(
  mediaCase: ReturnType<typeof createOwnedUserMediaCase>,
) {
  let receipt: MediaReceipt | undefined;
  // 上传对象已存在还不足以稳定回收；等待本地评估终态，超时保留未完成而不伪造成功。
  await expect
    .poll(
      async () => {
        try {
          receipt = await mediaCase.uploaded();
          return true;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "media_case_review_not_terminal"
          )
            return false;
          throw error;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  if (!receipt) throw new Error("media_case_upload_not_confirmed");
  return receipt;
}

async function expectSucceededOperationRun(
  operationId: unknown,
  deletedAssetId: string,
) {
  await expectUserMediaDeleteOperation(operationId, deletedAssetId, {
    readLocalEnvValue,
    getRegressionAccount,
  });
}

async function expectNoDocumentHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
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
