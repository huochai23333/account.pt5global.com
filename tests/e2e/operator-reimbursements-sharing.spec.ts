import { expect, test, type Page } from "@playwright/test";
import { loginAs, loginWithAccount } from "./helpers/auth";
import { getRegressionAccount } from "./helpers/accounts";
import { runLocalSupabaseSql as sql } from "./helpers/local-supabase";
import { chooseSelectOption } from "./helpers/select-control";

const ownerId = "33333333-3333-4333-8333-333333333333";
const peerId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const marker = `协作报销回归-${Date.now()}`;

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
      ('${ownerId}','2024-08-25','${marker} 其他周期',7),
      ('${ownerId}','2024-09-02','${marker} 竞态删除',8),
      ('${peerId}','2024-09-01','${marker} 上海时间边界',1);

      -- 测试需要同时固定报销时间和更新时间。临时关闭触发器后直接写入完整时间戳，
      -- 才能稳定覆盖 UTC 前一天 16:30 对应上海次日 00:30 的跨日边界。
      set session_replication_role = replica;
      update public.operator_reimbursements
      set status = 'reimbursed',
          reimbursed_at = '2026-09-08T16:30:00Z',
          reimbursed_by_user_id = '${peerId}',
          updated_at = '2026-09-08T16:30:00Z'
      where content = '${marker} 上海时间边界';
      set session_replication_role = origin;`);
  });

  test("search waits 300ms and sends only the final query", async ({ page }) => {
    await loginAs(page, "operator");
    await page.goto("/operator/reimbursements");
    await waitForRecords(page);

    let requestCount = 0;
    await page.route(
      "**/rest/v1/rpc/get_operator_reimbursements_page",
      async (route) => {
        const payload = route.request().postDataJSON() as {
          p_search?: string | null;
        };
        // 页面挂载或工作区同步可能并行读取空搜索；这里只统计由关键词触发的 RPC。
        if (payload.p_search) requestCount += 1;
        await route.continue();
      },
    );

    // 快速连续替换三个输入值；最后一次输入后的 100ms 仍小于 300ms，期间不应查询。
    const searchbox = page.getByRole("searchbox");
    await searchbox.fill("de");
    await searchbox.fill("debou");
    await searchbox.fill("debounce");
    await page.waitForTimeout(100);
    expect(requestCount).toBe(0);
    await expect.poll(() => requestCount, { timeout: 1_500 }).toBe(1);
    await waitForRecords(page);
  });

  test("a delayed delete refreshes the latest operator scope", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const deleteGate = createGate();
    const firstPeerQueryGate = createGate();
    const deleteStarted = createSignal();
    const firstPeerQueryStarted = createSignal();
    const secondPeerQueryStarted = createSignal();
    let peerQueryCount = 0;

    await loginAs(page, "operator");
    await page.goto("/operator/reimbursements");
    await page.getByRole("searchbox").fill(marker);
    await waitForRecords(page);

    await page.route("**/rest/v1/operator_reimbursements*", async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.continue();
        return;
      }
      deleteStarted.resolve();
      await deleteGate.promise;
      await route.continue();
    });
    await page.route(
      "**/rest/v1/rpc/get_operator_reimbursements_page",
      async (route) => {
        const payload = route.request().postDataJSON() as {
          p_owner?: string | null;
        };
        if (payload.p_owner !== peerId) {
          await route.continue();
          return;
        }
        peerQueryCount += 1;
        if (peerQueryCount === 1) {
          firstPeerQueryStarted.resolve();
          await firstPeerQueryGate.promise;
        } else {
          secondPeerQueryStarted.resolve();
        }
        await route.continue();
      },
    );

    const row = page.locator("article").filter({
      hasText: `${marker} 竞态删除`,
    });
    await row.getByRole("button", { name: "删除", exact: true }).click();
    await page
      .getByRole("dialog", { name: "请确认这项操作", exact: true })
      .getByRole("button", { name: "确认操作", exact: true })
      .click();
    await deleteStarted.promise;

    await chooseSelectOption(
      page.getByRole("combobox", { name: "运营", exact: true }),
      { value: peerId },
    );
    await firstPeerQueryStarted.promise;

    // 删除完成后必须再次读取当前已选中的同事范围，不能回到删除开始时的“我的记录”。
    deleteGate.resolve();
    await secondPeerQueryStarted.promise;
    firstPeerQueryGate.resolve();
    await waitForRecords(page);
    await expect(
      page.getByText(`${marker} 同事费用`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "本地协作运营的费用汇总" }),
    ).toBeVisible();
  });

  test("timestamps use the Shanghai cross-day boundary", async ({ page }) => {
    await loginWithAccount(page, {
      ...getRegressionAccount("operator"),
      email: "local.peer-operator@bs.test",
    });
    await page.goto("/operator/reimbursements");
    await page.getByRole("searchbox").fill(`${marker} 上海时间边界`);
    await waitForRecords(page);

    const row = page.locator("article").filter({
      hasText: `${marker} 上海时间边界`,
    });
    // 同一时刻分别出现在“报销时间”和“更新时间”，两处都应跨到上海次日。
    await expect(
      row.getByText("2026年9月9日 00:30", { exact: true }),
    ).toHaveCount(2);
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

/** 创建一个由测试主动放行的异步闸门，用来稳定排列并发请求的先后顺序。 */
function createGate() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** 创建只等待事件发生、不参与阻塞的信号，避免依赖不稳定的固定等待时间。 */
function createSignal() {
  return createGate();
}
