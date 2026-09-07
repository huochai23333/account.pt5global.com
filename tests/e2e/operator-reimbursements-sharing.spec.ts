import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { loginAs, loginWithAccount } from "./helpers/auth";
import { getRegressionAccount } from "./helpers/accounts";
import { chooseSelectOption } from "./helpers/select-control";

const ownerId = "33333333-3333-4333-8333-333333333333";
const peerId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const marker = `协作报销回归-${Date.now()}`;

/** 仅向这个本地 Docker 写入测试记录，命令参数与 SQL 输入分开，不经过 shell 拼接。 */
function sql(statement: string) {
  if (
    !/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    )
  ) {
    throw new Error(
      "This test requires the local Docker Supabase on port 54321.",
    );
  }
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_pt5-dropshipping",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    {
      input: statement,
      encoding: "utf8",
    },
  ).trim();
}

async function waitForRecords(page: Page) {
  await expect(page.getByText("正在读取报销记录…")).toHaveCount(0);
  await expect(
    page.getByText("报销记录暂时无法读取，请重新加载。"),
  ).toHaveCount(0);
}

test.describe("operator reimbursement sharing and historical periods", () => {
  test.beforeAll(() => {
    // 205 条记录确保浏览器确实翻到原先读取上限以外；同事在同周期另有一笔费用。
    sql(`insert into public.operator_reimbursements(operator_user_id,spent_at,content,amount)
      select '${ownerId}', '2024-07-25', '${marker} 历史费用 ' || n, 1 from generate_series(1,205) n;
      insert into public.operator_reimbursements(operator_user_id,spent_at,content,amount) values
      ('${peerId}','2024-07-25','${marker} 同事费用',99),
      ('${ownerId}','2024-08-25','${marker} 其他周期',7);`);
  });
  test.afterAll(() => {
    sql(
      `delete from public.operator_reimbursements where content like '${marker}%';`,
    );
  });

  test("operators read both ways, paginate and reimburse only their own selected period", async ({
    page,
    browser,
  }) => {
    test.setTimeout(150_000);
    await loginAs(page, "operator");
    await page.goto("/operator/reimbursements");
    await page.getByRole("searchbox").fill(`${marker} 历史费用`);
    await waitForRecords(page);
    await expect(page.locator("article")).toHaveCount(20);
    // 搜索不应压缩确认范围；翻页后依旧按完整周期报销 205 条。
    for (let i = 0; i < 10; i++) {
      await page.getByRole("button", { name: "下一页", exact: true }).click();
      await waitForRecords(page);
    }
    await expect(page.locator("article")).toHaveCount(5);
    await expect(
      page.getByRole("button", { name: "下一页", exact: true }),
    ).toBeDisabled();

    await chooseSelectOption(
      page.getByRole("combobox", { name: "运营", exact: true }),
      { value: peerId },
    );
    await page.getByRole("searchbox").fill(marker);
    await waitForRecords(page);
    await expect(
      page.getByText(`${marker} 同事费用`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "确认报销", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "新增报销", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "删除", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "本地协作运营的费用汇总" }),
    ).toContainText("¥99.00");

    await chooseSelectOption(
      page.getByRole("combobox", { name: "运营", exact: true }),
      { value: "all" },
    );
    await waitForRecords(page);
    await expect(
      page.getByRole("button", { name: "删除", exact: true }),
    ).toHaveCount(0);
    await chooseSelectOption(
      page.getByRole("combobox", { name: "运营", exact: true }),
      { value: "mine" },
    );
    await page.getByRole("searchbox").fill(`${marker} 历史费用 1`);
    await waitForRecords(page);
    await page.getByRole("button", { name: "确认报销", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "确认报销", exact: true });
    await chooseSelectOption(
      dialog.getByRole("combobox", { name: "待报销周期", exact: true }),
      { value: "2024-07-25" },
    );
    await expect(dialog.getByText("共 205 条待报销记录")).toBeVisible();
    await expect(dialog.getByText("¥205.00")).toBeVisible();
    await dialog.getByRole("button", { name: "确认报销", exact: true }).click();
    await expect(page.getByText("已将 205 条记录标记为已报销。")).toBeVisible();
    expect(
      sql(
        `select status from public.operator_reimbursements where content='${marker} 同事费用';`,
      ),
    ).toBe("unreimbursed");
    expect(
      sql(
        `select status from public.operator_reimbursements where content='${marker} 其他周期';`,
      ),
    ).toBe("unreimbursed");

    // 第二个独立浏览器上下文登录乙，验证乙可以查看甲刚刚报销完成的记录。
    const context = await browser.newContext();
    try {
      const peer = await context.newPage();
      await loginWithAccount(peer, {
        ...getRegressionAccount("operator"),
        email: "local.peer-operator@bs.test",
      });
      await peer.goto("/operator/reimbursements");
      await chooseSelectOption(
        peer.getByRole("combobox", { name: "运营", exact: true }),
        { value: ownerId },
      );
      await peer.getByRole("searchbox").fill(`${marker} 历史费用`);
      await chooseSelectOption(
        peer.getByRole("combobox", { name: "报销状态", exact: true }),
        { value: "reimbursed" },
      );
      await waitForRecords(peer);
      await expect(peer.locator("article")).toHaveCount(20);
      await expect(peer.locator("article").first()).toContainText("本地运营");
      await expect(
        peer.getByRole("button", { name: "删除", exact: true }),
      ).toHaveCount(0);
      await expect(
        peer.getByRole("button", { name: "确认报销", exact: true }),
      ).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  for (const width of [1440, 390, 320]) {
    test(`history dialog and shared records fit ${width}px`, async ({
      page,
    }, testInfo) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.setViewportSize({ width, height: 900 });
      await loginWithAccount(page, {
        ...getRegressionAccount("operator"),
        email: "local.peer-operator@bs.test",
      });
      await page.goto("/operator/reimbursements");
      await waitForRecords(page);
      await expect(
        page.getByText(`${marker} 同事费用`, { exact: true }),
      ).toBeVisible();
      if (width < 640) {
        await page
          .getByRole("button", { name: "更多筛选条件", exact: true })
          .click();
        await expect(
          page.getByRole("combobox", { name: "运营", exact: true }),
        ).toBeVisible();
      }
      await expectNoOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`records-${width}.png`),
      });
      await page.getByRole("button", { name: "确认报销", exact: true }).click();
      const dialog = page.getByRole("dialog", {
        name: "确认报销",
        exact: true,
      });
      // 本期没有欠款时自动选中历史周期，入口不能因为已跨月而禁用。
      await expect(dialog.getByRole("combobox")).toContainText("2024");
      await expect(dialog.getByText("¥99.00")).toBeVisible();
      await expect(dialog.getByRole("combobox")).toContainText(
        "2024/07/25 - 2024/08/24",
      );
      await expectNoOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`confirm-${width}.png`),
      });
      expect(pageErrors).toEqual([]);
    });
  }

  test("failed query can be reloaded without showing stale amounts", async ({
    page,
  }) => {
    await loginAs(page, "operator");
    await page.goto("/operator/reimbursements");
    await waitForRecords(page);
    await page.route(
      "**/rest/v1/rpc/get_operator_reimbursements_page",
      (route) => route.abort(),
    );
    await page.getByRole("searchbox").fill("failed-query");
    await expect(
      page.getByText("报销记录暂时无法读取，请重新加载。"),
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(0);
    await page.unroute("**/rest/v1/rpc/get_operator_reimbursements_page");
    await page.getByRole("button", { name: "重新加载", exact: true }).click();
    await expect(page.getByText("暂无报销记录")).toBeVisible();
  });
});

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(2);
  // 检查每个可见按钮的文字没有挤出自身容器。
  const overflow = await page
    .locator("main, [role=dialog]")
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons
        .filter(
          (button) =>
            button.getBoundingClientRect().width > 0 &&
            Boolean(button.textContent?.trim()) &&
            button.scrollWidth > button.clientWidth + 2,
        )
        .map((button) => button.textContent),
    );
  expect(overflow).toEqual([]);
}
