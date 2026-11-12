import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  registerFeeParameterRequest,
  bindFeeParameterPublication,
  type FeeParameterFixture,
} from "./wholesale-fee-parameter-fixture";
import { runWholesaleFeeSql, feeSqlValue } from "./wholesale-fee-database";
import { withFeePageRoute } from "./wholesale-fee-page-route";
/** 三种回执故障都从真实确认弹窗发起；每一阶段等路由处理器结束再进入下一阶段。 */
export async function verifyFeeParameterPage(
  page: Page,
  state: FeeParameterFixture,
  prefix: string,
  outputPath: (name: string) => string,
) {
  const revision = Number(state.before.definition.current_revision);
  await page.goto("/admin/wholesale/settings");
  const row = page.getByTestId(
    "business-parameter-row-wholesale_salesman_customer_commission",
  );
  await row.getByRole("button", { name: "修改" }).click();
  const dialog = page.getByRole("dialog", { name: /修改批发订单业务员佣金/ });
  await expect(
    dialog.getByTestId("business-parameter-input-existing_customer_rate"),
  ).toBeVisible();
  await expect(
    dialog.getByTestId(
      "business-parameter-input-new_customer_service_fee_rate",
    ),
  ).toBeVisible();
  await expect(
    dialog.getByTestId("business-parameter-input-tier_1_limit_rmb"),
  ).toHaveCount(0);
  await page.screenshot({
    path: outputPath("wholesale-fees-settings.png"),
    fullPage: true,
  });
  await dialog
    .getByTestId("business-parameter-change-reason")
    .fill(prefix + "-参数发布");
  const endpoint = "**/rest/v1/rpc/publish_business_parameter_version";
  await withFeePageRoute(
    page,
    endpoint,
    async (route) => {
      const body = route.request().postDataJSON();
      registerFeeParameterRequest(state, body);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          version_id: randomUUID(),
          parameter_code: body.p_parameter_code,
          version_number: revision + 1,
          config: body.p_config,
          effective_from: new Date().toISOString(),
          published_at: new Date().toISOString(),
          published_by: "11111111-1111-4111-8111-111111111111",
          change_reason: body.p_change_reason,
          current_revision: revision + 1,
        }),
      });
    },
    async () => {
      await confirmParameterPublish(page, dialog);
      await expect(page.getByText(/最终核对没有通过/)).toBeVisible();
      await expect(page.getByText(/已发布第/)).toHaveCount(0);
      expect(
        Number(
          runWholesaleFeeSql(
            `select count(*) from public.business_parameter_versions where change_reason=${feeSqlValue(prefix + "-参数发布")};`,
          ),
        ),
      ).toBe(0);
    },
  );
  await withFeePageRoute(
    page,
    endpoint,
    async (route) => {
      registerFeeParameterRequest(state, route.request().postDataJSON());
      await new Promise((resolve) => setTimeout(resolve, 35_000));
      await route.abort("timedout");
    },
    async () => {
      await confirmParameterPublish(page, dialog);
      await expect(page.getByText(/等待结果超时/)).toBeVisible({
        timeout: 40_000,
      });
      await expect(dialog).toBeVisible();
      expect(
        Number(
          runWholesaleFeeSql(
            `select count(*) from public.business_parameter_versions where change_reason=${feeSqlValue(prefix + "-参数发布")};`,
          ),
        ),
      ).toBe(0);
    },
  );
  const committedId = await withFeePageRoute(
    page,
    endpoint,
    async (route) => {
      registerFeeParameterRequest(state, route.request().postDataJSON());
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort("timedout");
    },
    async () => {
      await confirmParameterPublish(page, dialog);
      await expect(
        page.getByText("这次修改没有完成，请稍后再试。", { exact: true }),
      ).toBeVisible();
      const committedId = runWholesaleFeeSql(
        `select id from public.business_parameter_versions where change_reason=${feeSqlValue(prefix + "-参数发布")};`,
      );
      expect(committedId).toMatch(/^[0-9a-f-]{36}$/);
      expect(bindFeeParameterPublication(state).id).toBe(committedId);
      return committedId;
    },
  );
  await confirmParameterPublish(page, dialog);
  await expect(dialog).not.toBeVisible();
  const versions = JSON.parse(
    runWholesaleFeeSql(`select coalesce(jsonb_agg(v),'[]'::jsonb) from public.business_parameter_versions v
    where change_reason=${feeSqlValue(prefix + "-参数发布")};`),
  );
  expect(versions).toHaveLength(1);
  expect(versions[0].id).toBe(committedId);
  expect(versions[0].config).toEqual({
    existing_customer_rate: 0.12,
    new_customer_service_fee_rate: 0.1,
  });
  expect(versions[0].version_number).toBe(revision + 1);
  await expect(
    page.getByText(new RegExp(`版本凭证：${versions[0].id}`)),
  ).toBeVisible();
  await page.reload();
  await expect(row).toContainText(`第 ${versions[0].version_number} 版`);
  expect(
    Number(
      runWholesaleFeeSql(
        `select count(*) from public.business_parameter_versions where change_reason=${feeSqlValue(prefix + "-参数发布")};`,
      ),
    ),
  ).toBe(1);
  console.log(
    "[费用与提成版本凭证]",
    JSON.stringify({
      versionId: versions[0].id,
      versionNumber: versions[0].version_number,
      affectedRows: 1,
    }),
  );
}
async function confirmParameterPublish(
  page: Page,
  dialog: ReturnType<Page["getByRole"]>,
) {
  await dialog.getByTestId("business-parameter-review-publish").click();
  await page
    .getByRole("dialog", { name: "确认发布这次修改？" })
    .getByRole("button", { name: "确认发布", exact: true })
    .click();
}
