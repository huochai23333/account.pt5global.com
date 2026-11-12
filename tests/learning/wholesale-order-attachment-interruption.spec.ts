import { readFile, writeFile } from "node:fs/promises";
import { test, expect } from "./fixtures";
import { loginLearningUser } from "../../scripts/learning/local-fixture-session.mjs";
import {
  createAttachmentAccessFixture,
  digest,
} from "./wholesale-attachment-access-fixture";
import {
  createAttachmentInterruptionPage,
  observeAttachmentInterruption,
  installAttachmentInterruptionFaults,
} from "./wholesale-attachment-interruption-page";

test.use({ trace: "off", video: "off", screenshot: "off" });
const scenarios = [
  { kind: "storage_response_lost", label: "上传响应丢失" },
  { kind: "registration_navigation", label: "登记待核对后跨页恢复" },
  { kind: "delete_response_lost", label: "删除提交后响应丢失" },
  { kind: "storage_confirmation_navigation", label: "上传核对中断后跨页恢复" },
  { kind: "storage_body_mismatch", label: "下载正文不符后恢复" },
  { kind: "storage_not_dispatched", label: "上传未送达后原路径重试" },
] as const;

for (const scenario of scenarios)
  for (const locale of ["zh", "en"] as const)
    for (const width of [1440, 390]) {
      test(`${scenario.label} ${locale}/${width}`, async ({
        page,
        learningUser,
      }, testInfo) => {
        test.setTimeout(180000);
        // 第二张订单是未操作的对照，防止恢复或清理误改其他订单。
        const fixture = createAttachmentAccessFixture(
          learningUser,
          learningUser,
          false,
        );
        const [orderId, controlId] = fixture.orders;
        const filename = fixture.filenames[0],
          bytes = fixture.contents[0];
        const selectedFiles = [
          { name: filename, mimeType: "text/csv", buffer: bytes },
        ];
        if (scenario.kind === "storage_not_dispatched")
          selectedFiles.push({
            name: `second-${orderId}.csv`,
            mimeType: "text/csv",
            buffer: fixture.contents[1],
          });
        const { copy, ui, detail, manager, openDetails, openManager } =
          createAttachmentInterruptionPage(page, orderId, locale, width);
        const before = fixture.capture();
        const {
          errors,
          consoleMessages,
          requests,
          missingReads,
          settleResponses,
        } = observeAttachmentInterruption(page, orderId);
        const fault = {
          injected: false,
          readFaulted: false,
          blockReadFault: true,
          uploadCalls: 0,
          claimedSuccess: false,
        };
        try {
          await page
            .context()
            .addCookies([
              { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
            ]);
          await loginLearningUser(page, learningUser);
          await page.context().addCookies([
            {
              name: "bs-locale",
              value: locale,
              url: "http://localhost:3000",
            },
          ]);
          await page.setViewportSize({ width, height: 1000 });
          await page.goto("/admin/wholesale/orders");
          await openDetails();
          await openManager();
          await expect(
            manager.getByText(ui.orderList.noneUploaded, { exact: true }),
          ).toBeVisible();

          const journalKey = `pt5:wholesale-order-list-upload:${learningUser.id}:${orderId}`;
          await installAttachmentInterruptionFaults(
            page,
            scenario.kind,
            orderId,
            fixture.capture,
            fault,
          );
          await manager
            .locator('input[type="file"]')
            .setInputFiles(selectedFiles);
          const upload = manager.getByRole("button", {
            name: ui.orderList.upload,
            exact: true,
          });
          // 同一帧双击仍只允许发送本次上传；不会用两个不同文件规避重复提交检查。
          await upload.evaluate((button: HTMLButtonElement) => {
            button.click();
            button.click();
          });
          // 冷启动的真实Storage请求可能超过默认五秒；先等故障转发完成，再判断业务终态。
          if (scenario.kind !== "delete_response_lost")
            await expect
              .poll(() => fault.injected, { timeout: 30000 })
              .toBe(true);
          await expect
            .poll(() => fixture.capture().objects.length, { timeout: 30000 })
            .toBe(1);
          await expect
            .poll(
              async () =>
                (await manager.isHidden()) || (await upload.isEnabled()),
            )
            .toBe(true);
          if (
            [
              "registration_navigation",
              "storage_confirmation_navigation",
              "storage_body_mismatch",
              "storage_not_dispatched",
            ].includes(scenario.kind)
          ) {
            await expect(manager.getByRole("status")).toHaveText(
              ui.orderList.uploadUnconfirmed,
            );
            if (
              scenario.kind === "storage_confirmation_navigation" ||
              scenario.kind === "storage_body_mismatch"
            )
              expect(fault.readFaulted).toBe(true);
            fault.blockReadFault = false;
            const interrupted = fixture.capture();
            expect(interrupted.attachments).toHaveLength(
              scenario.kind === "registration_navigation" ? 1 : 0,
            );
            const journal = await page.evaluate(
              (key) => JSON.parse(sessionStorage.getItem(key)!),
              journalKey,
            );
            expect(journal.stage).toBe(
              scenario.kind === "registration_navigation"
                ? "registering"
                : "uploading",
            );
            expect(journal.files[0]).toMatchObject({
              storage_path:
                interrupted.objects[0]?.path ?? requests.uploadPaths[0],
              sha256: digest(bytes),
            });
            await page.goto("/admin/home");
            await page.goto("/admin/wholesale/orders");
            await openDetails();
            await openManager();
            await manager
              .locator('input[type="file"]')
              .setInputFiles([...selectedFiles].reverse());
            await upload.click();
            await expect(manager).toBeHidden({ timeout: 30000 });
            if (scenario.kind === "storage_not_dispatched") {
              const resumed = fixture.capture();
              expect(
                resumed.objects
                  .map((object: { path: string }) => object.path)
                  .sort(),
              ).toEqual(
                journal.files
                  .map((file: { storage_path: string }) => file.storage_path)
                  .sort(),
              );
              expect(
                resumed.objects.find(
                  (object: { path: string }) =>
                    object.path === interrupted.objects[0].path,
                ),
              ).toEqual(interrupted.objects[0]);
            } else
              expect(fixture.capture().objects).toEqual(interrupted.objects);
          } else {
            expect(
              fixture.capture().attachments,
              "真实对象已写入后必须能恢复同一附件登记，不能留下孤立文件",
            ).toHaveLength(1);
            await expect(manager).toBeHidden();
          }
          expect(
            await page.evaluate(
              (key) => sessionStorage.getItem(key),
              journalKey,
            ),
          ).toBeNull();
          const uploaded = fixture.capture();
          const registration = uploaded.attachments.find(
            (row: { original_name: string }) => row.original_name === filename,
          );
          expect(uploaded.attachments).toHaveLength(selectedFiles.length);
          expect(uploaded.objects).toHaveLength(selectedFiles.length);
          expect(registration.original_name).toBe(filename);
          expect(registration.file_size_bytes).toBe(bytes.length);
          expect(
            uploaded.orders.find((row: { id: string }) => row.id === controlId),
          ).toEqual(
            before.orders.find((row: { id: string }) => row.id === controlId),
          );
          for (const selected of selectedFiles) {
            const row = uploaded.attachments.find(
              (item: { original_name: string }) =>
                item.original_name === selected.name,
            );
            expect(row.file_size_bytes).toBe(selected.buffer.length);
            const independentlyDownloaded = await learningUser.client.storage
              .from("wholesale-order-lists")
              .download(row.storage_path);
            expect(independentlyDownloaded.error).toBeNull();
            expect(
              digest(
                Buffer.from(await independentlyDownloaded.data!.arrayBuffer()),
              ),
            ).toBe(digest(selected.buffer));
          }
          expect(requests.uploads).toBe(
            scenario.kind === "storage_not_dispatched" ? 3 : 1,
          );
          expect(new Set(requests.uploadPaths).size).toBe(selectedFiles.length);
          if (scenario.kind === "storage_not_dispatched")
            expect(requests.uploadPaths[1]).toBe(requests.uploadPaths[2]);
          expect(requests.registrations).toBe(1);
          await page.reload();
          await openDetails();
          const fileButton = detail.getByRole("button", {
            name: filename,
            exact: true,
          });
          const downloadStarted = page.waitForEvent("download");
          for (const selected of selectedFiles)
            await expect(
              detail.getByRole("button", { name: selected.name, exact: true }),
            ).toBeVisible();
          await fileButton.click();
          const download = await downloadStarted;
          expect(download.suggestedFilename()).toBe(filename);
          expect(digest(await readFile((await download.path())!))).toBe(
            digest(bytes),
          );
          expect(fixture.capture()).toEqual(uploaded);

          if (scenario.kind === "delete_response_lost") {
            await openManager();
            await page.route(
              /\/wholesale_order_list_attachments\?/,
              async (route) => {
                if (route.request().method() !== "DELETE" || fault.injected)
                  return route.fallback();
                const actual = await route.fetch({ maxRetries: 0 });
                expect(actual.ok()).toBe(true);
                const deleted = fixture.capture();
                expect(deleted.attachments).toEqual([]);
                expect(deleted.objects).toEqual([]);
                fault.injected = true;
                await route.abort("connectionreset");
              },
            );
            await manager
              .locator("[data-attachment-name]")
              .filter({ hasText: filename })
              .getByRole("button", { name: ui.orderList.delete, exact: true })
              .click();
            const confirm = page.getByRole("dialog", {
              name: copy.DashboardFramework.confirm.title,
            });
            await confirm
              .getByRole("button", {
                name: copy.DashboardFramework.confirm.accept,
                exact: true,
              })
              .click();
            await expect(
              page.getByText(ui.orderList.deleteIncomplete, { exact: true }),
            ).toBeVisible();
            await page.reload();
            await openDetails();
            await openManager();
            await expect(
              manager.getByText(ui.orderList.noneUploaded, { exact: true }),
            ).toBeVisible();
            await expect(fileButton).toHaveCount(0);
            expect(fixture.capture().attachments).toEqual([]);
            expect(fixture.capture().objects).toEqual([]);
            expect(requests.storageDeletes).toBe(1);
            expect(requests.registrationDeletes).toBe(1);
          }
          expect(fault.injected).toBe(true);
          if (scenario.kind === "storage_not_dispatched")
            expect(fault.claimedSuccess).toBe(true);
          await expect(
            page.locator("nextjs-dialog,[data-nextjs-dialog]"),
          ).toBeHidden();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
          ).toBe(true);
          await page.screenshot({
            path: testInfo.outputPath("terminal.png"),
            fullPage: true,
            animations: "disabled",
          });
          expect(errors).toEqual([]);
          await settleResponses();
          const expectedMissing = missingReads.filter(
            (read) =>
              scenario.kind === "storage_not_dispatched" && read.notFound,
          );
          // 注入只允许准确附件写入/核对路径的连接中断；其他控制台问题仍失败。
          expect(
            consoleMessages.filter((message) => {
              if (
                /net::ERR_(CONNECTION_RESET|FAILED)/.test(message.text) &&
                /\/(storage\/v1\/object|rest\/v1\/)/.test(message.path)
              )
                return false;
              // 未送达时的空目录已独立核对；每条缺失提示还须匹配真实GET回包及数量。
              const index = expectedMissing.findIndex(
                (read) =>
                  read.path === message.path &&
                  message.text.includes(`status of ${read.status}`),
              );
              if (index >= 0) {
                expectedMissing.splice(index, 1);
                return false;
              }
              return true;
            }),
          ).toEqual([]);
          await writeFile(
            testInfo.outputPath("interruption-receipt.json"),
            JSON.stringify(
              {
                scenario: scenario.kind,
                locale,
                width,
                actorId: learningUser.id,
                registration,
                objects: uploaded.objects,
                sha256: digest(bytes),
                requests,
                missingReads,
                fault,
                files: selectedFiles.map((file) => ({
                  name: file.name,
                  sha256: digest(file.buffer),
                  registration: uploaded.attachments.find(
                    (row: { original_name: string }) =>
                      row.original_name === file.name,
                  ),
                })),
                final: fixture.capture(),
                reloaded: true,
                passed: true,
              },
              null,
              2,
            ),
          );
        } finally {
          // 失败现场先留证；准确前缀清理还会找到未登记对象，不能只清理数据库返回的文件。
          await writeFile(
            testInfo.outputPath("before-cleanup.json"),
            JSON.stringify(
              {
                state: fixture.capture(),
                errors,
                console: consoleMessages,
                requests,
              },
              null,
              2,
            ),
          );
          await page.context().close();
          const cleanup = await fixture.cleanup();
          await writeFile(
            testInfo.outputPath("interruption-data-cleanup.json"),
            JSON.stringify(cleanup, null, 2),
          );
        }
      });
    }
