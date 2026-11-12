import { expect, test } from "@playwright/test";
import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import { withAssistantSettlementEnvironment } from "./helpers/assistant-settlement-environment";
import {
  closeAssistant,
  confirmAssistantPublication,
  createAssistantAliasCustomer,
  deleteAssistantAliasCustomer,
  expectAssistantLayout,
  getResponseAction,
  interceptAssistantConfirmation,
  observeAssistantConfirmations,
  openAssistant,
  postAssistantCommand,
  sendAssistantMessage,
} from "./helpers/assistant-settlement-page";

test.describe("AI assistant settlement release", () => {
  test("finance confirms formal and temporary customer releases without duplicate writes", async ({
    browser,
  }, testInfo) => {
    testInfo.setTimeout(120_000);
    await withAssistantSettlementEnvironment(
      browser,
      testInfo,
      "publication",
      async (fixture, open) => {
        const { formalNote, cancelledNote, temporaryNote, temporaryCustomer } =
          fixture.data;
        const page = await open();
        const confirmationNotes = observeAssistantConfirmations(page);
        await page.setViewportSize({ height: 900, width: 1440 });
        await loginAs(page, "finance");
        await page.goto("/finance/wholesale/settlement-releases");
        await expectWorkspaceShell(page);
        await expectNotForbiddenPage(page);
        await openAssistant(page);

        await sendAssistantMessage(
          page,
          `alpha shop付款$12.34 备注 ${formalNote}`,
        );
        const formalCard = page
          .getByTestId("ai-settlement-release-card")
          .last();
        await expect(formalCard).toBeVisible();
        await expect(formalCard).toContainText("已匹配到正式客户");
        await expect(formalCard).toContainText("alpha shop");
        await expect(formalCard).toContainText("Wholesale Alpha");
        await expect(formalCard).toContainText("12.34 USD");
        await expect(formalCard).toContainText(formalNote);
        await expect(
          page.getByRole("row").filter({ hasText: formalNote }),
        ).toHaveCount(0);
        fixture.unchanged();

        const formalDelay = await interceptAssistantConfirmation(
          page,
          formalNote,
          "delay",
        );
        const formalButton = formalCard.getByRole("button", {
          name: "确认发布",
        });
        await formalButton.focus();
        await expect(formalButton).toBeFocused();
        fixture.begin("formal");
        const formal = await confirmAssistantPublication(
          page,
          formalNote,
          async () => {
            await page.keyboard.press("Enter");
            await expect(
              formalCard.locator('[data-slot="status-badge"]'),
            ).toHaveText("发布中");
            await expect(formalButton).toHaveCount(0);
          },
        );
        await expect(
          formalCard.locator('[data-slot="status-badge"]'),
        ).toHaveText("已发布");
        expect(formalDelay.requestIds).toEqual([formal.action.requestId]);
        await formalDelay.restore();
        fixture.published("formal", formal.id, formal.action);
        await closeAssistant(page);
        const search = page.getByLabel("搜索收款");
        await search.fill(formalNote);
        const formalRow = page.getByTestId(
          `wholesale-settlement-release-row-${formal.id}`,
        );
        await expect(formalRow).toContainText(formalNote);
        await page.reload();
        await search.fill(formalNote);
        await expect(formalRow).toContainText(formalNote);
        fixture.unchanged();

        await search.fill("");
        await page.setViewportSize({ height: 844, width: 390 });
        await openAssistant(page);
        await sendAssistantMessage(
          page,
          `${temporaryCustomer}付款$708.27 备注 ${cancelledNote}`,
        );
        const cancelledCard = page
          .getByTestId("ai-settlement-release-card")
          .last();
        await expect(cancelledCard).toContainText("将按临时客户发布");
        await expect(cancelledCard).toContainText(temporaryCustomer);
        await expectAssistantLayout(page, cancelledCard);
        await cancelledCard.getByRole("button", { name: "取消" }).focus();
        await page.keyboard.press("Space");
        await expect(
          cancelledCard.locator('[data-slot="status-badge"]'),
        ).toHaveText("已取消");
        await expect(
          page.getByRole("row").filter({ hasText: cancelledNote }),
        ).toHaveCount(0);
        expect(confirmationNotes).toEqual([formalNote]);
        fixture.unchanged();

        await sendAssistantMessage(
          page,
          `${temporaryCustomer}到账USD 708.27 今天 Note ${temporaryNote}`,
        );
        const temporaryCard = page
          .getByTestId("ai-settlement-release-card")
          .last();
        await expect(temporaryCard).toContainText("将按临时客户发布");
        fixture.unchanged();
        const failure = await interceptAssistantConfirmation(
          page,
          temporaryNote,
          "failure",
        );
        await temporaryCard.getByRole("button", { name: "确认发布" }).click();
        await expect(temporaryCard.getByRole("alert")).toContainText(
          "内容已保留，可以稍后重试",
        );
        const retry = temporaryCard.getByRole("button", { name: "重新发布" });
        await expect(retry).toBeVisible();
        fixture.unchanged();
        await failure.restore();
        fixture.begin("temporary");
        const temporary = await confirmAssistantPublication(
          page,
          temporaryNote,
          () => retry.click(),
        );
        await expect(
          temporaryCard.locator('[data-slot="status-badge"]'),
        ).toHaveText("已发布");
        // 重试沿用确认卡的原请求号，故障回包本身未生成收款。
        expect(failure.requestIds).toEqual([temporary.action.requestId]);
        expect(confirmationNotes).toEqual([
          formalNote,
          temporaryNote,
          temporaryNote,
        ]);
        fixture.published("temporary", temporary.id, temporary.action);
        await expectAssistantLayout(page);
        await closeAssistant(page);
        await search.fill(temporaryNote);
        const temporaryRow = page.getByTestId(
          `wholesale-settlement-release-row-${temporary.id}`,
        );
        await expect(temporaryRow).toContainText(temporaryCustomer);
        await page.reload();
        await search.fill(temporaryNote);
        await expect(temporaryRow).toContainText(temporaryCustomer);
        fixture.unchanged();
        await expectAssistantLayout(page);
      },
    );
  });

  test("fixed parser handles dates, currencies, guidance and direct permission checks", async ({
    browser,
  }, testInfo) => {
    await withAssistantSettlementEnvironment(
      browser,
      testInfo,
      "parser",
      async (fixture, open) => {
        const financePage = await open();
        await loginAs(financePage, "finance");
        const today = fixture.data.date;
        const yesterday = new Date(Date.parse(today) - 86_400_000)
          .toISOString()
          .slice(0, 10);
        const fullCommand = await postAssistantCommand(
          financePage,
          "Alpha Shop收款USD 1,234.56 昨天 Note 月度回款",
        );
        expect(fullCommand.status).toBe(200);
        expect(fullCommand.body).toMatchObject({
          action: {
            amount: 1234.56,
            currency: "USD",
            customerKind: "existing",
            customerName: "Wholesale Alpha",
            customerId: fixture.data.formalCustomerId,
            inputCustomerName: "Alpha Shop",
            note: "月度回款",
            receivedOn: yesterday,
          },
          kind: "settlementReleaseConfirmation",
        });
        const currencyCases = [
          ["Voltria到账￥88 2026年7月21日", "CNY", "2026-07-21"],
          ["Voltria结汇EUR 9", "EUR", today],
          ["Voltria付款JPY 10", "JPY", today],
          ["Voltria received AUD 11", "AUD", today],
        ] as const;
        for (const [message, currency, receivedOn] of currencyCases) {
          const response = await postAssistantCommand(financePage, message);
          expect(response.status).toBe(200);
          expect(response.body).toMatchObject({
            action: { currency, receivedOn },
            kind: "settlementReleaseConfirmation",
          });
        }
        const guidanceCases = [
          ["Voltria付款708.27", "missingCurrency"],
          ["Voltria付款$1，另收款USD 2", "multipleAmounts"],
          ["Voltria付款USD 10 2026-02-30", "invalidDate"],
        ] as const;
        for (const [message, code] of guidanceCases) {
          const response = await postAssistantCommand(financePage, message);
          expect(response.status).toBe(200);
          expect(response.body).toEqual({
            code,
            kind: "settlementReleaseGuidance",
          });
        }
        fixture.unchanged();
        const action = getResponseAction(fullCommand.body);
        await financePage.close();
        const salesmanPage = await open();
        await loginAs(salesmanPage, "salesman");
        const roleGuidance = await postAssistantCommand(
          salesmanPage,
          "Voltria付款$10",
        );
        expect(roleGuidance.body).toEqual({
          code: "notAllowed",
          kind: "settlementReleaseGuidance",
        });

        // 直接调用发布接口也须拒绝业务员，独立账本保持原样。
        const directConfirm = await salesmanPage.evaluate(async (payload) => {
          const response = await fetch("/api/assistant/settlement-release", {
            body: JSON.stringify({ action: payload }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          return { body: await response.json(), status: response.status };
        }, action);
        expect(directConfirm).toEqual({
          body: { error: "forbidden" },
          status: 403,
        });
        fixture.unchanged();
        await salesmanPage.close();
      },
    );
  });

  test("ambiguous customer alias stops before showing a confirmation card", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120_000);
    await withAssistantSettlementEnvironment(
      browser,
      testInfo,
      "aliases",
      async (fixture, open) => {
        const page = await open();
        const confirmationNotes = observeAssistantConfirmations(page);
        await loginAs(page, "administrator");
        await page.goto("/admin/wholesale/customers");
        await expectWorkspaceShell(page);
        const first = await createAssistantAliasCustomer(page, fixture, 0);
        const second = await createAssistantAliasCustomer(page, fixture, 1);

        await page.goto("/admin/wholesale/settlement-releases");
        await openAssistant(page);
        await sendAssistantMessage(page, `${fixture.data.sharedAlias}付款$20`);
        await expect(
          page.getByText(
            "这个名称匹配到多个客户，请改用客户唯一名称后重新发送。",
          ),
        ).toBeVisible();
        await expect(
          page.getByTestId("ai-settlement-release-card"),
        ).toHaveCount(0);
        expect(confirmationNotes).toEqual([]);
        fixture.unchanged();

        await closeAssistant(page);
        await page.goto("/admin/wholesale/customers");
        await deleteAssistantAliasCustomer(page, fixture, 0, first);
        await deleteAssistantAliasCustomer(page, fixture, 1, second);
        await page.reload();
        for (const name of fixture.data.customerNames) {
          await page.getByLabel("搜索客户").fill(name);
          await expect(page.getByText(name, { exact: true })).toHaveCount(0);
        }
        fixture.unchanged();
      },
    );
  });
});
