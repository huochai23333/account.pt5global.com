import { expect, test } from "@playwright/test";
import {
  expectNotForbiddenPage,
  expectWorkspaceShell,
  loginAs,
} from "./helpers/auth";
import {
  chooseSelectOption,
  expectSelectValue,
  getSelectValue,
} from "./helpers/select-control";
import {
  cancelWholesaleRelease,
  expectWholesaleReleaseLayout,
  publishWholesaleRelease,
  rejectWholesaleAllocation,
  wholesaleAllocationInput,
  withWholesaleReleasePages,
} from "./helpers/wholesale-release-page";

test.describe("wholesale settlement releases", () => {
  test("一笔收款可部分分配到多笔订单并整组调整", async ({
    browser,
  }, testInfo) => {
    testInfo.setTimeout(180_000);
    await withWholesaleReleasePages(
      browser,
      testInfo,
      async (fixture, open) => {
        const financePage = await open();
        await financePage.setViewportSize({ height: 900, width: 1440 });
        await loginAs(financePage, "finance");
        await financePage.goto("/finance/wholesale/settlement-releases");
        await expectWorkspaceShell(financePage);
        await expectNotForbiddenPage(financePage);
        await expect(
          financePage.getByRole("heading", { name: "结汇发布" }),
        ).toBeVisible();

        const formalId = await publishWholesaleRelease(
          financePage,
          fixture,
          "formal",
        );
        const temporaryId = await publishWholesaleRelease(
          financePage,
          fixture,
          "temporary",
        );
        const cancelledId = await publishWholesaleRelease(
          financePage,
          fixture,
          "cancelled",
        );
        const cancelledCustomer = fixture.seed.releases.cancelled.customerName;
        await financePage.getByLabel("搜索收款").fill(cancelledCustomer);
        const cancelledRow = financePage.getByTestId(
          `wholesale-settlement-release-row-${cancelledId}`,
        );
        await cancelWholesaleRelease(financePage, fixture, cancelledId, () =>
          cancelledRow
            .getByRole("button", { name: "取消", exact: true })
            .click(),
        );
        await expect(
          financePage.getByText("这条结汇收款已取消。"),
        ).toBeVisible();
        await expect(cancelledRow).toContainText("已取消");
        await financePage.reload();
        await financePage.getByLabel("搜索收款").fill(cancelledCustomer);
        await expect(cancelledRow).toContainText("已取消");
        fixture.unchanged();
        await financePage.close();

        const salesmanPage = await open();
        await salesmanPage.setViewportSize({ height: 900, width: 1440 });
        await loginAs(salesmanPage, "salesman");
        await salesmanPage.goto("/salesman/wholesale/settlement-releases");
        await expectWorkspaceShell(salesmanPage);
        await expectNotForbiddenPage(salesmanPage);
        await expect(
          salesmanPage.getByRole("button", { name: "发布收款" }),
        ).toHaveCount(0);
        const monthlyCard = salesmanPage
          .locator('[data-slot="metric-card"]')
          .filter({ hasText: "本月已分配金额" });
        await expect(monthlyCard).toContainText("US$0.00");

        const search = salesmanPage.getByLabel("搜索收款");
        await search.fill(fixture.seed.releases.formal.note);
        const allocationRow = salesmanPage.getByTestId(
          `wholesale-settlement-release-row-${formalId}`,
        );
        await expect(allocationRow).toBeVisible();
        await allocationRow
          .getByRole("button", { name: "开始分配", exact: true })
          .click();
        const allocationDialog = salesmanPage.getByRole("dialog", {
          name: "分配收款",
        });
        await expect(allocationDialog).toBeVisible();
        const fixedCustomerSelect = allocationDialog.getByLabel("归属客户");
        await expect(fixedCustomerSelect).toBeDisabled();
        expect(await getSelectValue(fixedCustomerSelect)).toBe(
          fixture.seed.customerId,
        );

        // 额度和排序来自专属订单的独立数据库快照。
        const [first, second] = fixture.suggested();
        const firstInput = wholesaleAllocationInput(
          allocationDialog,
          first.orderNumber,
        );
        const secondInput = wholesaleAllocationInput(
          allocationDialog,
          second.orderNumber,
        );
        await expect(firstInput).toHaveValue(first.amount);
        await expect(secondInput).toHaveValue(second.amount);
        await firstInput.fill("1000");
        await secondInput.fill("500");
        await expect(allocationDialog.getByText("US$1,500.00")).toHaveCount(2);
        await expectWholesaleReleaseLayout(salesmanPage);
        await salesmanPage.setViewportSize({ height: 844, width: 390 });
        await expectWholesaleReleaseLayout(salesmanPage, allocationDialog);
        await salesmanPage.setViewportSize({ height: 900, width: 1440 });

        fixture.begin("partial");
        await allocationDialog
          .getByRole("button", { name: "保存全部分配" })
          .click();
        await expect(
          salesmanPage.getByText("结汇收款分配已保存。"),
        ).toBeVisible();
        fixture.allocated("partial");
        await expect(allocationRow).toContainText("部分分配");
        await expect(allocationRow).toContainText(first.orderNumber);
        await expect(allocationRow).toContainText(second.orderNumber);
        await expect(allocationRow).toContainText("US$1,500.00");
        await expect(monthlyCard).toContainText("US$1,500.00");
        await salesmanPage.reload();
        await search.fill(fixture.seed.releases.formal.note);
        await expect(monthlyCard).toContainText("US$1,500.00");
        fixture.unchanged();

        await allocationRow.getByRole("button", { name: "继续分配" }).click();
        const continueDialog = salesmanPage.getByRole("dialog", {
          name: "继续分配收款",
        });
        await expect(
          wholesaleAllocationInput(continueDialog, first.orderNumber),
        ).toHaveValue("1000.00");
        await expect(
          wholesaleAllocationInput(continueDialog, second.orderNumber),
        ).toHaveValue("500.00");
        await continueDialog
          .getByRole("button", { name: "按最早订单重新分配" })
          .click();
        await expect(
          wholesaleAllocationInput(continueDialog, first.orderNumber),
        ).toHaveValue(first.amount);
        await expect(
          wholesaleAllocationInput(continueDialog, second.orderNumber),
        ).toHaveValue(second.amount);
        fixture.begin("full");
        await continueDialog
          .getByRole("button", { name: "保存全部分配" })
          .click();
        await expect(
          salesmanPage.getByText("结汇收款分配已保存。"),
        ).toBeVisible();
        fixture.allocated("full");
        await expect(allocationRow).toContainText("已分配");
        await expect(monthlyCard).toContainText("US$3,000.00");
        await salesmanPage.reload();
        await search.fill(fixture.seed.releases.formal.note);
        await expect(monthlyCard).toContainText("US$3,000.00");
        fixture.unchanged();

        await allocationRow.getByRole("button", { name: "调整分配" }).click();
        const adjustDialog = salesmanPage.getByRole("dialog", {
          name: "调整收款分配",
        });
        await adjustDialog
          .getByRole("button", { name: "清空当前分配" })
          .click();
        await expect(
          adjustDialog.getByText("确认清空这笔收款的全部分配？"),
        ).toBeVisible();
        fixture.begin("clear");
        await adjustDialog.getByRole("button", { name: "确认清空" }).click();
        await expect(monthlyCard).toContainText("US$0.00");
        fixture.allocated("clear");
        await salesmanPage.reload();
        await search.fill(fixture.seed.releases.formal.note);
        await expect(
          allocationRow.getByRole("button", { name: "开始分配", exact: true }),
        ).toBeVisible();
        await expect(monthlyCard).toContainText("US$0.00");
        fixture.unchanged();

        await search.fill(fixture.seed.releases.temporary.note);
        const temporaryRow = salesmanPage.getByTestId(
          `wholesale-settlement-release-row-${temporaryId}`,
        );
        await temporaryRow
          .getByRole("button", { name: "开始分配", exact: true })
          .click();
        const temporaryDialog = salesmanPage.getByRole("dialog", {
          name: "分配收款",
        });
        const temporaryCustomerSelect = temporaryDialog.getByLabel("归属客户");
        await expect(temporaryCustomerSelect).toBeEnabled();
        await chooseSelectOption(temporaryCustomerSelect, {
          label: fixture.seed.customerName,
        });
        const temporaryFirstInput = wholesaleAllocationInput(
          temporaryDialog,
          first.orderNumber,
        );
        await expect(temporaryFirstInput).toHaveValue("500.00");
        const savedCustomer = await getSelectValue(temporaryCustomerSelect);
        const savedAmount = await temporaryFirstInput.inputValue();
        const restore = await rejectWholesaleAllocation(
          salesmanPage,
          temporaryId,
        );
        const submit = temporaryDialog.getByRole("button", {
          name: "保存全部分配",
        });
        await submit.click();
        await expect(
          salesmanPage.getByText("操作没有成功，请检查内容和权限后再试。"),
        ).toBeVisible();
        await expect(temporaryDialog).toBeVisible();
        await expectSelectValue(temporaryCustomerSelect, savedCustomer);
        await expect(temporaryFirstInput).toHaveValue(savedAmount);
        fixture.unchanged();

        await restore();
        fixture.begin("assign");
        await submit.click();
        await expect(
          salesmanPage.getByText("结汇收款分配已保存。"),
        ).toBeVisible();
        await expect(temporaryRow).toContainText("已分配");
        fixture.allocated("assign");
        await expectWholesaleReleaseLayout(salesmanPage);
        await salesmanPage.setViewportSize({ height: 844, width: 390 });
        await salesmanPage.goto("/salesman/wholesale/settlement-releases");
        await expect(
          salesmanPage.getByRole("heading", { name: "结汇发布" }),
        ).toBeVisible();
        await search.fill(fixture.seed.releases.temporary.note);
        await expect(temporaryRow).toContainText("已分配");
        await expect(monthlyCard).toContainText("US$500.00");
        fixture.unchanged();
        await expectWholesaleReleaseLayout(salesmanPage);
        await salesmanPage.setViewportSize({ height: 844, width: 320 });
        await expectWholesaleReleaseLayout(salesmanPage);
        await salesmanPage.close();
      },
    );
  });
});
