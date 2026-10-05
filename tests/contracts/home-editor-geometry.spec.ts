import assert from "node:assert/strict";
import { expect, test } from "@playwright/test";
import { expectEditorGeometry } from "../e2e/helpers/home-editor-geometry";
// Isolated TSX loader renders the actual first-party React component. It imports no Auth helpers.
import { renderHomeEditor } from "./helpers/render-home-editor";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => route.abort("blockedbyclient"));
  await page.setContent(renderHomeEditor());
});

test("actual card markup has one compact editor and four full editors", async ({ page }) => {
  await expectEditorGeometry(page);
  await expect(page.locator('[data-home-widget-type="greeting"] [data-testid="home-widget-editor-compact"]')).toHaveCount(1);
});

for (const id of ["home-widget-editor-toolbar", "home-widget-editor-preview", "home-widget-editor-compact"]) {
  test(`missing ${id} is rejected`, async ({ page }) => {
    await page.getByTestId(id).first().evaluate((element) => element.remove());
    await assert.rejects(expectEditorGeometry(page));
  });
}

for (const id of ["home-widget-editor-label", "home-widget-adjust-button", "home-widget-remove-button"]) {
  test(`compact editor missing ${id} is rejected`, async ({ page }) => {
    await page.getByTestId("home-widget-editor-compact").getByTestId(id).evaluate((element) => element.remove());
    await assert.rejects(expectEditorGeometry(page), /missing or duplicate/);
  });
}

test("counts alone cannot hide a toolbar moved into the compact card", async ({ page }) => {
  await page.evaluate(() => {
    const toolbar = document.querySelector('[data-testid="home-widget-editor-toolbar"]')!;
    document.querySelector('[data-testid="home-widget-editor-compact"]')!.append(toolbar);
  });
  await assert.rejects(expectEditorGeometry(page), /invalid compact editor/);
});

test("toolbar and preview overlap is rejected", async ({ page }) => {
  await page.getByTestId("home-widget-editor-preview").first().evaluate((element) => {
    Object.assign((element as HTMLElement).style, { position: "absolute", top: "0px", height: "40px", width: "100px" });
  });
  await assert.rejects(expectEditorGeometry(page), /toolbar overlaps preview/);
});
