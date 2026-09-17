import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { loginAs } from "./helpers/auth";
import { getRegressionAccount } from "./helpers/accounts";
import { getLocalSupabaseAdminClient } from "./helpers/local-supabase-admin";

test("业务员从首页保存报价、刷新核对并直接下载 PDF", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const admin = getLocalSupabaseAdminClient();
  if (!admin) test.skip(true, "Local Supabase admin connection is unavailable");
  const marker = `Quote E2E ${Date.now()}`;
  let quoteId: string | null = null;
  let imagePath: string | null = null;
  await loginAs(page, "salesman");
  try {
    await page.goto("/salesman/home");
    await page.getByRole("link", { name: "进入报价表" }).click();
    await expect(page).toHaveURL(/\/salesman\/quotes$/);
    await page.getByRole("link", { name: "+ New quotation" }).click();
    await page.getByLabel("Client / store").fill(marker);
    await page.getByLabel("Quoted by").fill("Sales test");
    const product = page.locator(".q-table tbody tr").first();
    await product.getByPlaceholder("Product name / SKU").fill("Test product");
    await product.locator('input[type="number"]').first().fill("67");
    await product.getByPlaceholder("e.g. 7–10 working days").fill("7 working days");
    await page.getByRole("button", { name: "+ Add destination" }).click();
    const secondDestination = page.locator(".q-page").nth(1);
    await secondDestination.getByLabel("Destination", { exact: true }).fill("DE");
    const secondProduct = secondDestination.locator(".q-table tbody tr").first();
    await secondProduct.getByPlaceholder("Product name / SKU").fill("Second product");
    await secondProduct.locator('input[type="number"]').first().fill("134");
    await secondProduct.getByPlaceholder("e.g. 7–10 working days").fill("10 working days");
    const imageBuffer = await sharp({ create: { width: 12, height: 12, channels: 4, background: "#dc6b2c" } }).png().toBuffer();
    await product.locator('input[type="file"]').setInputFiles({
      name: "product.png", mimeType: "image/png",
      buffer: imageBuffer,
    });
    await expect(page.getByRole("status")).toContainText("Image uploaded");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Draft saved");
    await expect(page).toHaveURL(/\/salesman\/quotes\/[a-f0-9-]+$/);
    quoteId = page.url().split("/").at(-1) ?? null;
    expect(quoteId).toBeTruthy();
    const saved = await admin!.from("quotations").select("id,status,revision,content").eq("id", quoteId!).single();
    expect(saved.error).toBeNull();
    expect(saved.data?.status).toBe("draft");
    expect(saved.data?.revision).toBe(1);
    expect(saved.data?.content.client).toBe(marker);
    expect(saved.data?.content.destinations).toHaveLength(2);
    expect(saved.data?.content.destinations[1].packingCurrency).toBe("EUR");
    imagePath = saved.data?.content.destinations[0].products[0].image?.path ?? null;
    expect(imagePath).toBeTruthy();
    const imageExists = await admin!.storage.from("quotation-images").exists(imagePath!);
    expect(imageExists.error).toBeNull();
    expect(imageExists.data).toBe(true);
    const other = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } });
    const otherAccount = getRegressionAccount("administrator");
    expect((await other.auth.signInWithPassword({ email: otherAccount.email, password: otherAccount.password })).error).toBeNull();
    expect((await other.from("quotations").select("id").eq("id", quoteId!)).data).toHaveLength(0);
    expect((await other.storage.from("quotation-images").exists(imagePath!)).data).toBe(false);
    await page.reload();
    await expect(page.getByLabel("Client / store")).toHaveValue(marker);
    const missingImage = await admin!.storage.from("quotation-images").remove([imagePath!]);
    expect(missingImage.error).toBeNull();
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(page.locator(".q-status.q-error")).toBeVisible();
    const stillDraft = await admin!.from("quotations").select("status,revision").eq("id", quoteId!).single();
    expect(stillDraft.data).toMatchObject({ status: "draft", revision: 1 });
    const restoredImage = await admin!.storage.from("quotation-images").upload(imagePath!, imageBuffer, { contentType: "image/png" });
    expect(restoredImage.error).toBeNull();
    expect((await admin!.storage.from("quotation-images").exists(imagePath!)).data).toBe(true);
    await page.evaluate(() => {
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = () => { URL.createObjectURL = original; throw new Error("Generation interrupted"); };
    });
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(page.locator(".q-status.q-error")).toBeVisible();
    expect((await admin!.from("quotations").select("status,revision").eq("id", quoteId!).single()).data)
      .toMatchObject({ status: "draft", revision: 1 });
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const file = await readFile(await download.path());
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    await mkdir("output", { recursive: true });
    await writeFile("output/quotation-full-sample.pdf", file);
    const pdfInfo = execFileSync("pdfinfo", [await download.path()], { encoding: "utf8" });
    expect(Number(pdfInfo.match(/^Pages:\s+(\d+)/m)?.[1])).toBeGreaterThanOrEqual(4);
    const completed = await admin!.from("quotations").select("status,revision").eq("id", quoteId!).single();
    expect(completed.error).toBeNull();
    expect(completed.data).toMatchObject({ status: "completed", revision: 2 });
    await page.reload();
    await expect(page.getByLabel("Client / store")).toHaveValue(marker);
    const adminContext = await browser.newContext();
    try {
      const adminPage = await adminContext.newPage();
      await loginAs(adminPage, "administrator");
      await adminPage.goto(`/admin/quotes/${quoteId}`);
      await expect(adminPage.getByRole("heading", { name: "Quotation form" })).toHaveCount(0);
    } finally { await adminContext.close(); }
    await page.getByLabel("Client / store").fill(`${marker} revised`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Draft saved");
    const revised = await admin!.from("quotations").select("status,revision,content").eq("id", quoteId!).single();
    expect(revised.data).toMatchObject({ status: "draft", revision: 3 });
    expect(revised.data?.content.client).toBe(`${marker} revised`);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.goto("/salesman/quotes");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    const confirmation = page.waitForEvent("dialog");
    const deleteClick = page.locator(".q-list-item").filter({ hasText: `${marker} revised` }).getByRole("button", { name: "Delete" }).click();
    await (await confirmation).accept();
    await deleteClick;
    await expect(page.locator(".q-list-item").filter({ hasText: `${marker} revised` })).toHaveCount(0);
    const deleted = await admin!.from("quotations").select("id").eq("id", quoteId!).maybeSingle();
    expect(deleted.data).toBeNull();
    const removedImage = await admin!.storage.from("quotation-images").exists(imagePath!);
    expect(removedImage.data).toBe(false);
    await page.reload();
    await expect(page.locator(".q-list-item").filter({ hasText: `${marker} revised` })).toHaveCount(0);
  } finally {
    if (quoteId) await admin!.from("quotations").delete().eq("id", quoteId);
    if (imagePath) await admin!.storage.from("quotation-images").remove([imagePath]);
  }
});

test("伪造 HTTP 200 但数据库未写入时页面拒绝成功", async ({ page }) => {
  test.setTimeout(120_000);
  const admin = getLocalSupabaseAdminClient();
  if (!admin) test.skip(true, "Local Supabase admin connection is unavailable");
  await loginAs(page, "salesman");
  await page.goto("/salesman/quotes/new");
  const marker = `False receipt ${Date.now()}`;
  await page.getByLabel("Client / store").fill(marker);
  await page.route("**/rest/v1/rpc/save_quotation", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      id: crypto.randomUUID(), owner_id: crypto.randomUUID(), status: "draft", revision: 1,
    }) });
  });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.locator(".q-status.q-error")).toContainText("could not be confirmed as saved");
  await expect(page.getByRole("status")).toHaveCount(0);
  const { data } = await admin!.from("quotations").select("id").contains("content", { client: marker });
  expect(data).toHaveLength(0);
});

test("客户不能进入报价模块", async ({ page }) => {
  await loginAs(page, "client");
  await page.goto("/client/home");
  await expect(page.getByRole("link", { name: "进入报价表" })).toHaveCount(0);
  await page.goto("/client/quotes");
  await expect(page.getByRole("heading", { name: "My quotations" })).toHaveCount(0);
});

test("没有启用业务的经理仍可从登录落点进入报价表", async ({ page }) => {
  await loginAs(page, "manager");
  await page.getByRole("link", { name: "报价规范表" }).click();
  await expect(page).toHaveURL(/\/manager\/quotes$/);
  await expect(page.getByRole("heading", { name: "My quotations" })).toBeVisible();
  const notice = page.getByRole("button", { name: "我知道了" });
  if (await notice.isVisible().catch(() => false)) await notice.click();
  await page.getByRole("link", { name: "+ New quotation" }).click();
  await expect(page.getByRole("heading", { name: "Quotation form" })).toBeVisible();
});

test("必填校验、重复提交和记录已消失时均不误报成功", async ({ page }) => {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) test.skip(true, "Local Supabase admin connection is unavailable");
  const marker = `Quote validation ${Date.now()}`;
  let quoteId: string | null = null;
  await loginAs(page, "salesman");
  try {
    await page.goto("/salesman/quotes/new");
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(page.locator(".q-status.q-error")).toContainText("Fill in the client");
    await page.getByLabel("Client / store").fill(marker);
    await page.getByLabel("Quoted by").fill("Sales test");
    const product = page.locator(".q-table tbody tr").first();
    await product.getByPlaceholder("Product name / SKU").fill("Validation product");
    await product.locator('input[type="number"]').first().fill("67");
    await product.getByPlaceholder("e.g. 7–10 working days").fill("7 days");
    await page.getByLabel("FX US$1 = CNY").fill("0");
    await page.getByRole("button", { name: "Export PDF" }).click();
    await expect(page.locator(".q-status.q-error")).toContainText("valid exchange rates");
    expect((await admin!.from("quotations").select("id").contains("content", { client: marker })).data).toHaveLength(0);
    await page.getByLabel("FX US$1 = CNY").fill("6.7");
    // 同一个浏览器任务里连点两次，必须只有一条记录和一次修订。
    await page.evaluate(() => { const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Save draft")); button?.click(); button?.click(); });
    await expect(page.getByRole("status")).toContainText("Draft saved");
    const rows = await admin!.from("quotations").select("id,revision,status").contains("content", { client: marker });
    expect(rows.error).toBeNull();
    expect(rows.data).toHaveLength(1);
    expect(rows.data?.[0]).toMatchObject({ revision: 1, status: "draft" });
    quoteId = rows.data![0].id;
    await expect(page).toHaveURL(new RegExp(`/salesman/quotes/${quoteId}$`));
    await expect(page.getByLabel("Client / store")).toHaveValue(marker);
    expect((await admin!.from("quotations").delete().eq("id", quoteId)).error).toBeNull();
    await page.getByLabel("Client / store").fill(`${marker} changed`);
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.locator(".q-status.q-error")).toContainText("changed or was removed");
    await expect(page.getByRole("status")).toHaveCount(0);
    expect((await admin!.from("quotations").select("id").eq("id", quoteId)).data).toHaveLength(0);
  } finally {
    if (quoteId) await admin!.from("quotations").delete().eq("id", quoteId);
  }
});

test("提交已落库但响应断线后重试仍是同一条报价", async ({ page }) => {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) test.skip(true, "Local Supabase admin connection is unavailable");
  const marker = `Quote disconnected ${Date.now()}`;
  let quoteId: string | null = null;
  await loginAs(page, "salesman");
  try {
    await page.goto("/salesman/quotes/new");
    await page.getByLabel("Client / store").fill(marker);
    let interrupted = false;
    await page.route("**/rest/v1/rpc/save_quotation", async (route) => {
      if (interrupted) { await route.continue(); return; }
      interrupted = true;
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort("failed");
    });
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.locator(".q-status.q-error")).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    const committed = await admin!.from("quotations").select("id,revision,status").contains("content", { client: marker });
    expect(committed.data).toHaveLength(1);
    quoteId = committed.data![0].id;
    expect(committed.data![0]).toMatchObject({ revision: 1, status: "draft" });
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Draft saved");
    await expect(page).toHaveURL(new RegExp(`/salesman/quotes/${quoteId}$`));
    const rows = await admin!.from("quotations").select("id,revision").contains("content", { client: marker });
    expect(rows.data).toHaveLength(1);
    expect(rows.data![0]).toMatchObject({ id: quoteId, revision: 1 });
    await page.reload();
    await expect(page.getByLabel("Client / store")).toHaveValue(marker);
  } finally {
    if (quoteId) await admin!.from("quotations").delete().eq("id", quoteId);
  }
});

test("保存超时后不显示成功也不留下记录", async ({ page }) => {
  test.setTimeout(90_000);
  const admin = getLocalSupabaseAdminClient();
  if (!admin) test.skip(true, "Local Supabase admin connection is unavailable");
  const marker = `Quote timeout ${Date.now()}`;
  await loginAs(page, "salesman");
  await page.goto("/salesman/quotes/new");
  await page.getByLabel("Client / store").fill(marker);
  await page.route("**/rest/v1/rpc/save_quotation", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 35_000));
    await route.abort("timedout").catch(() => undefined);
  });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.locator(".q-status.q-error")).toContainText("taking too long", { timeout: 40_000 });
  await expect(page.getByRole("status")).toHaveCount(0);
  expect((await admin!.from("quotations").select("id").contains("content", { client: marker })).data).toHaveLength(0);
});

test("图片删除只返回成功响应时报告部分完成", async ({ page }) => {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) test.skip(true, "Local Supabase admin connection is unavailable");
  const marker = `Quote partial ${Date.now()}`;
  let quoteId: string | null = null;
  let imagePath: string | null = null;
  await loginAs(page, "salesman");
  try {
    await page.goto("/salesman/quotes/new");
    await page.getByLabel("Client / store").fill(marker);
    const imageBuffer = await sharp({ create: { width: 12, height: 12, channels: 4, background: "#dc6b2c" } }).png().toBuffer();
    await page.locator('.q-table tbody tr input[type="file"]').first().setInputFiles({ name: "partial.png", mimeType: "image/png", buffer: imageBuffer });
    await expect(page.getByRole("status")).toContainText("Image uploaded");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("status")).toContainText("Draft saved");
    await expect(page).toHaveURL(/\/salesman\/quotes\/[a-f0-9-]+$/);
    quoteId = page.url().split("/").at(-1)!;
    const row = await admin!.from("quotations").select("content").eq("id", quoteId).single();
    imagePath = row.data?.content.destinations[0].products[0].image.path ?? null;
    expect(imagePath).toBeTruthy();
    await page.goto("/salesman/quotes");
    let intercepted = false;
    await page.route(/\/storage\/v1\/object\/quotation-images(?:\?|$)/, async (route) => {
      if (route.request().method() !== "DELETE") { await route.continue(); return; }
      intercepted = true;
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    const confirmation = page.waitForEvent("dialog");
    const click = page.locator(".q-list-item").filter({ hasText: marker }).getByRole("button", { name: "Delete" }).click();
    await (await confirmation).accept();
    await click;
    await expect(page.locator(".q-status.q-error")).toContainText("some product images could not be removed");
    expect(intercepted).toBe(true);
    expect((await admin!.from("quotations").select("id").eq("id", quoteId)).data).toHaveLength(0);
    expect((await admin!.storage.from("quotation-images").exists(imagePath!)).data).toBe(true);
    await page.reload();
    await expect(page.locator(".q-list-item").filter({ hasText: marker })).toHaveCount(0);
  } finally {
    if (quoteId) await admin!.from("quotations").delete().eq("id", quoteId);
    if (imagePath) await admin!.storage.from("quotation-images").remove([imagePath]);
  }
});

test("粘贴产品图片并下载不带附页的竖版 PDF", async ({ page }) => {
  const admin = getLocalSupabaseAdminClient();
  if (!admin) test.skip(true, "Local Supabase admin connection is unavailable");
  const marker = `Quote portrait ${Date.now()}`;
  let quoteId: string | null = null;
  let imagePath: string | null = null;
  await loginAs(page, "salesman");
  try {
    await page.goto("/salesman/quotes/new");
    await page.getByLabel("Client / store").fill(marker);
    await page.getByLabel("Quoted by").fill("Sales test");
    const product = page.locator(".q-table tbody tr").first();
    await product.getByPlaceholder("Product name / SKU").fill("Pasted product");
    await product.locator('input[type="number"]').first().fill("80");
    await product.getByPlaceholder("e.g. 7–10 working days").fill("8 days");
    const imageBuffer = await sharp({ create: { width: 12, height: 12, channels: 4, background: "#d67b30" } }).png().toBuffer();
    await product.locator(".q-image-box").evaluate((target, bytes: number[]) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], "pasted.png", { type: "image/png" }));
      target.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer }));
    }, [...imageBuffer]);
    await expect(page.getByRole("status")).toContainText("Image uploaded");
    await page.getByRole("combobox", { name: "PDF layout" }).click();
    await page.getByRole("option", { name: "A4 portrait" }).click();
    await page.getByRole("checkbox", { name: "Terms page" }).uncheck();
    await page.getByRole("checkbox", { name: "Payment page" }).uncheck();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    const download = await downloadPromise;
    const file = await readFile(await download.path());
    expect(file.subarray(0, 5).toString()).toBe("%PDF-");
    const info = execFileSync("pdfinfo", [await download.path()], { encoding: "utf8" });
    expect(Number(info.match(/^Pages:\s+(\d+)/m)?.[1])).toBe(1);
    expect(info).toMatch(/Page size:\s+595(?:\.\d+)? x 841/);
    await expect(page).toHaveURL(/\/salesman\/quotes\/[a-f0-9-]+$/);
    quoteId = page.url().split("/").at(-1)!;
    const row = await admin!.from("quotations").select("status,revision,content").eq("id", quoteId).single();
    expect(row.data).toMatchObject({ status: "completed", revision: 1 });
    expect(row.data?.content).toMatchObject({ layout: "portrait", includeTerms: false, includePayment: false });
    imagePath = row.data?.content.destinations[0].products[0].image.path ?? null;
    expect(imagePath).toBeTruthy();
    expect((await admin!.storage.from("quotation-images").exists(imagePath!)).data).toBe(true);
    await page.reload();
    await expect(page.getByLabel("Client / store")).toHaveValue(marker);
  } finally {
    if (quoteId) await admin!.from("quotations").delete().eq("id", quoteId);
    if (imagePath) await admin!.storage.from("quotation-images").remove([imagePath]);
  }
});

test("产品明细过长时 PDF 自动续页并保留全部产品", async ({ page }) => {
  test.setTimeout(120_000);
  const admin = getLocalSupabaseAdminClient();
  if (!admin) test.skip(true, "Local Supabase admin connection is unavailable");
  const marker = `Quote pagination ${Date.now()}`;
  let quoteId: string | null = null;
  await loginAs(page, "salesman");
  try {
    await page.goto("/salesman/quotes/new");
    await page.getByLabel("Client / store").fill(marker);
    await page.getByLabel("Quoted by").fill("Sales test");
    await page.getByRole("checkbox", { name: "Terms page" }).uncheck();
    await page.getByRole("checkbox", { name: "Payment page" }).uncheck();
    for (let index = 0; index < 25; index++) {
      if (index) await page.getByRole("button", { name: "+ Add product" }).click();
      const row = page.locator(".q-table tbody tr").nth(index);
      await row.getByPlaceholder("Product name / SKU").fill(`Line item ${String(index + 1).padStart(2, "0")}`);
      await row.locator('input[type="number"]').first().fill("67");
      await row.getByPlaceholder("e.g. 7–10 working days").fill("7 days");
    }
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PDF" }).click();
    const download = await downloadPromise;
    const filePath = await download.path();
    const info = execFileSync("pdfinfo", [filePath], { encoding: "utf8" });
    expect(Number(info.match(/^Pages:\s+(\d+)/m)?.[1])).toBeGreaterThanOrEqual(2);
    await mkdir("output", { recursive: true });
    await writeFile("output/quotation-pagination-test.pdf", await readFile(filePath));
    await expect(page).toHaveURL(/\/salesman\/quotes\/[a-f0-9-]+$/);
    quoteId = page.url().split("/").at(-1)!;
    const row = await admin!.from("quotations").select("status,revision,content").eq("id", quoteId).single();
    expect(row.data).toMatchObject({ status: "completed", revision: 1 });
    expect(row.data?.content.destinations[0].products).toHaveLength(25);
  } finally {
    if (quoteId) await admin!.from("quotations").delete().eq("id", quoteId);
  }
});
