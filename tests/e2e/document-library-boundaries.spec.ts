import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { authoritativeFiles, chooseDocumentFolder, cleanupDocuments, documentAdmin, documentLogin, documentUser, readLibrary, uploadDocumentFiles } from "./helpers/document-library";

test("个人资料和管理员人员详情入口打开对应档案，其他员工档案拒绝访问", async ({ page }) => {
  const operator = await documentUser("operator"), salesman = await documentUser("salesman");
  await documentLogin(page, "operator"); await page.goto("/operator/my"); await page.getByRole("link", { name: "查看资料", exact: true }).click(); await expect(page).toHaveURL(/\/operator\/documents$/);
  expect((await readLibrary(page)).archives.filter((item) => item.kind === "employee").map((item) => item.user_id)).toEqual([operator]);
  expect((await page.request.get(`/api/document-library?user=${salesman}&query=内部`)).status()).toBe(403);
  await documentLogin(page, "administrator"); await page.goto("/admin/accounts"); await page.getByRole("button", { name: "查看 本地业务员 的账号详情" }).click(); await page.getByRole("dialog").getByRole("link", { name: "查看资料", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`user=${salesman}`)); const library = await readLibrary(page); expect(library.archives.find((item) => item.id === library.archiveId)?.user_id).toBe(salesman);
});

test("空目录可从页面删除，非空目录、跨档案移动和并发旧版本拒绝", async ({ page }) => {
  test.setTimeout(120_000); const prefix = `docs-boundary-${Date.now()}-`;
  try {
    await documentLogin(page, "administrator"); await page.goto("/admin/documents");
    await page.getByRole("button", { name: "新建子文件夹", exact: true }).click(); let dialog = page.getByRole("dialog"); await dialog.getByRole("textbox", { name: "名称" }).fill(`${prefix}子目录`); await dialog.getByRole("button", { name: "确认", exact: true }).click(); await expect(dialog).toHaveCount(0);
    const folder = (await readLibrary(page)).folders.find((item) => item.name === `${prefix}子目录`)!; expect(folder.zone).toBe("personal");
    await chooseDocumentFolder(page, folder.name); await uploadDocumentFiles(page, [`${prefix}并发.txt`]);
    await page.getByRole("button", { name: "删除文件夹", exact: true }).click(); dialog = page.getByRole("dialog"); await dialog.getByRole("button", { name: "确认", exact: true }).click(); await expect(dialog.getByRole("alert")).toContainText("请先移走或删除文件及子文件夹。"); await dialog.getByRole("button", { name: "取消", exact: true }).click();
    const file = (await authoritativeFiles([`${prefix}并发.txt`]))[0];
    // 两个并发修改携带相同旧版本，只能有一个影响一行；重试同一操作仍返回原凭证。
    const bodies = [1, 2].map((number) => ({ operationId: randomUUID(), action: "rename_file", payload: { fileId: file.id, version: file.version, name: `${prefix}并发${number}.txt` } }));
    const responses = await Promise.all(bodies.map((body) => page.request.post("/api/document-library", { data: body }))); expect(responses.map((result) => result.status()).sort()).toEqual([200, 400]);
    const winner = responses.findIndex((result) => result.status() === 200), receipt = await responses[winner].json(); const repeats = await Promise.all([1, 2].map(() => page.request.post("/api/document-library", { data: bodies[winner] }))); for (const response of repeats) expect(await response.json()).toEqual(receipt);
    const authoritative = await documentAdmin().from("document_files").select("*").eq("id", file.id).single(); expect(authoritative.data!.version).toBe(file.version + 1);
    const employee = await documentUser("operator"); const other = await page.request.get(`/api/document-library?user=${employee}`); const otherLibrary = await other.json();
    expect((await page.request.post("/api/document-library", { data: { operationId: randomUUID(), action: "move_file", payload: { fileId: file.id, version: authoritative.data!.version, destinationId: otherLibrary.folderId } } })).status()).toBe(403);
    await page.reload(); await page.locator(`[data-document-file="${file.id}"]`).getByRole("button", { name: "删除文件", exact: true }).click(); dialog = page.getByRole("dialog"); await dialog.getByRole("button", { name: "确认", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "删除文件夹", exact: true }).click(); dialog = page.getByRole("dialog"); await dialog.getByRole("button", { name: "确认", exact: true }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole("heading", { name: "本人资料", exact: true })).toBeVisible();
    expect((await documentAdmin().from("document_folders").select("id").eq("id", folder.id)).data).toHaveLength(0); await page.reload(); await expect(page.getByText(folder.name, { exact: true })).toHaveCount(0);
  } finally { await cleanupDocuments(prefix); }
});
