import { test, expect } from "./fixtures";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";
import zh from "../../messages/zh.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };
import { createMediaObjectCollision } from "./media-object-collision";
import { observeMediaConsole } from "./media-browser-diagnostics";

// learning 是 ESM 包，test-support 属于当前项目的 CommonJS 范围；用 Node 的明确边界读取同一辅助。
const { cleanupFixtureResources } = createRequire(import.meta.url)(
  "../test-support/fixture-cleanup-sequence.ts",
) as typeof import("../test-support/fixture-cleanup-sequence");

// 后台真实运行，图片供应商明确使用 disabled 本地边界；不代表真实供应商验收。
test.beforeAll(() => {
  // 必须在创建夹具和上传前确认，避免测试误触真实图片供应商。
  const provider = execFileSync(
    "docker",
    [
      "exec",
      "supabase_edge_runtime_pt5-dropshipping",
      "printenv",
      "USER_MEDIA_IMAGE_REVIEW_PROVIDER",
    ],
    { encoding: "utf8", timeout: 8_000 },
  );
  expect(
    provider.trim(),
    "媒体学习测试需要本地 Edge 的图片供应商为 disabled",
  ).toBe("disabled");
});
for (const language of ["zh", "en"] as const) {
  test(`媒体中断重试、审核与删除终态：${language}`, async ({
    page,
    context,
    learningUser,
  }, testInfo) => {
    test.setTimeout(120_000);
    const messages = language === "zh" ? zh : en;
    const copy = messages.DashboardMyState;
    const errors: string[] = [];
    const diagnostics = observeMediaConsole(page);
    let collision: ReturnType<typeof createMediaObjectCollision> | undefined;
    page.on("pageerror", (error) => errors.push(error.message));
    const readAssets = () =>
      JSON.parse(
        executeLearningSql(`select coalesce(json_agg(t),'[]') from (
      select id,status,storage_path,bucket_name,original_name,file_size_bytes,reviewer_user_id
      from public.user_media_assets where user_id='${learningUser.id}') t;`),
      );
    const openPhotos = () =>
      page
        .locator("#account-verification")
        .getByRole("button")
        .filter({ hasText: copy.photosTitle })
        .click();
    try {
      await context.addCookies([
        { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
      ]);
      await loginLearningUser(page, learningUser);
      await context.addCookies([
        { name: "bs-locale", value: language, url: "http://localhost:3000" },
      ]);
      await page.goto("/admin/my");
      await expect(page.locator("nextjs-portal [data-nextjs-dialog], nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
      await openPhotos();
      const bytes = await readFile("public/images/pt5-logo.png");
      const name = `learning-${learningUser.runId}.png`;
      let lostReceipt: { operationId: string } | undefined;
      let loseResponse = true;
      // 后台实际完成上传后丢掉一次响应，验证页面重试复用同一意图，不能再写第二份媒体。
      await page.route("**/functions/v1/user-media-mutate", async (route) => {
        if (route.request().method() !== "POST" || !loseResponse)
          return route.continue();
        const response = await route.fetch();
        lostReceipt = await response.json();
        loseResponse = false;
        await route.abort("connectionreset");
      });
      await page
        .locator('input[type=file][accept="image/*"]')
        .setInputFiles({ name, mimeType: "image/png", buffer: bytes });
      await expect.poll(() => readAssets().length, { timeout: 25_000 }).toBe(1);
      const retry = page
        .getByRole("dialog")
        .getByRole("button", { name: copy.retryUpload, exact: true });
      await expect(retry).toBeVisible();
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/functions/v1/user-media-mutate") &&
          response.request().method() === "POST",
      );
      await retry.click();
      const receipt = await (await responsePromise).json();
      expect(receipt.operationId).toBe(lostReceipt?.operationId);
      expect(receipt.status).toBe("succeeded");
      expect(readAssets()).toHaveLength(1);
      const asset = readAssets()[0];
      expect(asset.original_name).toBe(name);
      expect(asset.file_size_bytes).toBe(bytes.length);
      const download = await learningUser.client.storage
        .from(asset.bucket_name)
        .download(asset.storage_path);
      expect(download.error).toBeNull();
      const digest = (value: Buffer) =>
        createHash("sha256").update(value).digest("hex");
      const sha256 = digest(Buffer.from(await download.data!.arrayBuffer()));
      expect(sha256).toBe(digest(bytes));
      const readReview = () =>
        JSON.parse(
          executeLearningSql(`select row_to_json(t) from (
        select status,decision,provider from public.user_media_image_ai_reviews where asset_id='${asset.id}') t;`),
        );
      await expect
        .poll(() => readReview()?.status, { timeout: 45_000 })
        .toBe("completed");
      expect(readReview()).toMatchObject({
        provider: "disabled",
        decision: "manual_review",
      });
      const review = readReview();
      const operation = JSON.parse(
        executeLearningSql(`select row_to_json(t) from (
        select id,status,succeeded_count,failed_count from private.operation_runs where id='${receipt.reviewOperationId}') t;`),
      );
      expect(operation).toMatchObject({
        status: "succeeded",
        succeeded_count: 1,
        failed_count: 0,
      });
      await page.goto("/admin/reviews");
      await page
        .getByRole("button", { name: new RegExp(messages.Reviews.tabs.media) })
        .click();
      const row = page
        .getByRole("article")
        .filter({ hasText: learningUser.runId });
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
      await expect.poll(() => readAssets()[0]?.status).toBe("pass");
      expect(readAssets()[0].reviewer_user_id).toBe(learningUser.id);
      await page.reload();
      await expect(
        page.getByRole("article").filter({ hasText: learningUser.runId }),
      ).toHaveCount(0);
      let signingUnavailable = true;
      // 只模拟一次预览签名故障；审核、对象及恢复后的实际文件读取继续使用真实服务。
      await page.route("**/storage/v1/object/sign/user-media/**", (route) =>
        signingUnavailable
          ? route.fulfill({
              status: 503,
              contentType: "application/json",
              body: '{"message":"synthetic-preview-unavailable"}',
            })
          : route.continue(),
      );
      await page.goto("/admin/my");
      await openPhotos();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByText(messages.DashboardMy.previewUnavailable, {
          exact: true,
        }),
      ).toBeVisible();
      signingUnavailable = false;
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await openPhotos();
      const preview = dialog.getByRole("img", { name, exact: true });
      await expect(preview).toBeVisible();
      await expect
        .poll(() =>
          preview.evaluate(
            (element) => (element as HTMLImageElement).naturalWidth,
          ),
        )
        .toBeGreaterThan(0);
      await expect(page.getByRole("dialog")).toContainText(name);
      await expect(page.getByRole("dialog")).toContainText(
        messages.DashboardShared.assetStatus.pass,
      );
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(`media-${language}-${width}.png`),
          fullPage: true,
        });
      }
      // 真实同名目录和文件同时存在，后台必须按对象身份判断，而不是只取首个同名条目。
      collision = createMediaObjectCollision(learningUser, asset);
      const collisionBeforeDelete = await collision.prepare(bytes);
      const deleteResponse = page.waitForResponse(response =>
        response.url().endsWith("/functions/v1/user-media-mutate") &&
        response.request().method() === "POST",
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: copy.deletePhotos, exact: true })
        .click();
      const deleted = await (await deleteResponse).json();
      expect(deleted).toMatchObject({ status: "succeeded", deletedCount: 1, storageDeletionVerified: true });
      expect(deleted.operationId).toMatch(/^[a-f0-9-]{36}$/);
      const deletionOperation = JSON.parse(executeLearningSql(`select row_to_json(t) from (
        select id,status,expected_count,succeeded_count,failed_count from private.operation_runs
        where id='${deleted.operationId}') t;`));
      expect(deletionOperation).toMatchObject({ status: "succeeded", expected_count: 1, succeeded_count: 1, failed_count: 0 });
      await expect.poll(() => readAssets().length).toBe(0);
      expect(
        executeLearningSql(
          `select count(*) from storage.objects where bucket_id='${asset.bucket_name}' and name='${asset.storage_path}';`,
        ),
      ).toBe("0");
      const prefix = asset.storage_path.slice(
        0,
        asset.storage_path.lastIndexOf("/"),
      );
      const listing = await learningUser.client.storage
        .from(asset.bucket_name)
        .list(prefix);
      expect(listing.error).toBeNull();
      expect(
        listing.data!.filter(
          (entry: { name: string; id: string | null }) =>
            entry.name === asset.storage_path.split("/").at(-1) && typeof entry.id === "string" && entry.id.length > 0,
        ),
      ).toHaveLength(0);
      expect(listing.data!.some(entry => entry.name === asset.storage_path.split("/").at(-1) && entry.id === null)).toBe(true);
      // 刷新先等待此页资源就绪，避免点击还没绑定交互的服务端按钮。
      await page.reload({ waitUntil: "networkidle" });
      await openPhotos();
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(messages.DashboardMy.photoEmptyTitle, { exact: true }),
      ).toBeVisible();
      await expect(dialog).not.toContainText(name);
      expect(errors).toEqual([]);
      expect(diagnostics.unexpected()).toEqual([]);
      await expect(page.locator("nextjs-portal [data-nextjs-dialog], nextjs-portal [data-nextjs-dialog-overlay]")).toHaveCount(0);
      await writeFile(
        testInfo.outputPath("media-business-receipts.json"),
        JSON.stringify(
          {
            assetId: asset.id,
            operation,
            uploadOperationId: receipt.operationId,
            sha256,
            sameIntentReplayed: true,
            previewRecoveredAfterReopen: true,
            review,
            collision: { childPath: collision.childPath, before: collisionBeforeDelete, after: listing.data!.map(entry => ({ name: entry.name, id: entry.id })) },
            deletionOperation,
            browserConsole: diagnostics.issues,
            deletionReadback: {
              databaseRows: 0,
              storageRows: 0,
              exactListedObjects: 0,
              reloadAbsent: true,
            },
          },
          null,
          2,
        ),
      );
    } finally {
      await cleanupFixtureResources(async () => {
        if (collision) {
          const cleanup = await collision.cleanup();
          await writeFile(testInfo.outputPath("media-collision-cleanup.json"), JSON.stringify(cleanup));
        }
      }, async () => {
        // 失败也只清理本次账号的对象；先验证归属，再删对象及资料，不触碰共享记录。
        for (const asset of readAssets()) {
          expect(asset.storage_path.startsWith(`${learningUser.id}/`)).toBe(true);
          const cleanup = await learningUser.client.storage
            .from(asset.bucket_name)
            .remove([asset.storage_path]);
          expect(cleanup.error).toBeNull();
          const prefix = asset.storage_path.slice(
            0,
            asset.storage_path.lastIndexOf("/"),
          );
          const listing = await learningUser.client.storage
            .from(asset.bucket_name)
            .list(prefix);
          expect(listing.error).toBeNull();
          expect(
            listing.data!.some(
              (entry: { name: string }) =>
                entry.name === asset.storage_path.split("/").at(-1),
            ),
          ).toBe(false);
        }
        executeLearningSql(
          `delete from public.user_media_assets where user_id='${learningUser.id}';`,
        );
        expect(readAssets()).toHaveLength(0);
      });
    }
  });
}
