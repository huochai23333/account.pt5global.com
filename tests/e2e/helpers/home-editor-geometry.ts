import { expect, type Page } from "@playwright/test";

export async function expectEditorGeometry(page: Page) {
  // The reset fixture has five cards: one compact greeting and four full editors.
  await expect(page.getByTestId("home-widget-card")).toHaveCount(5);
  await expect(page.getByTestId("home-widget-editor-compact")).toHaveCount(1);
  await expect(page.getByTestId("home-widget-editor-toolbar")).toHaveCount(4);
  await expect(page.getByTestId("home-widget-editor-preview")).toHaveCount(4);
  const collisions = await page.getByTestId("home-widget-card").evaluateAll((cards) =>
    cards.flatMap((card) => {
      const type = card.getAttribute("data-home-widget-type");
      const toolbar = card.querySelector('[data-testid="home-widget-editor-toolbar"]');
      const preview = card.querySelector('[data-testid="home-widget-editor-preview"]');
      const compact = card.querySelector('[data-testid="home-widget-editor-compact"]');
      const compactSize = card.getAttribute("data-home-widget-height") === "1" || card.getAttribute("data-home-widget-width") === "1";
      if (compactSize) {
        if (!compact || toolbar || preview) return [`${type}: invalid compact editor`];
        for (const id of ["home-widget-editor-label", "home-widget-adjust-button", "home-widget-remove-button"]) {
          const elements = compact.querySelectorAll(`[data-testid="${id}"]`);
          if (elements.length !== 1) return [`${type}: missing or duplicate ${id}`];
          const rect = elements[0].getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return [`${type}: hidden ${id}`];
        }
        return [];
      }
      if (compact || !toolbar || !preview) return [`${type}: missing full editor elements`];
      const toolbarBox = toolbar.getBoundingClientRect();
      const previewBox = preview.getBoundingClientRect();
      if (toolbarBox.height <= 0 || previewBox.height <= 0 || previewBox.width <= 0) return [`${type}: hidden full editor elements`];
      return toolbarBox.bottom > previewBox.top + 1 ? [`${type}: toolbar overlaps preview`] : [];
    }),
  );
  expect(collisions).toEqual([]);
}
