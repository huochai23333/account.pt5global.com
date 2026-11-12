import { randomUUID, createHash } from "node:crypto";
import type { Browser, Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import {
  createLearningUser,
  executeLearningSql,
  loginLearningUser,
} from "../../scripts/learning/local-fixture-session.mjs";
import zh from "../../messages/zh.json" with { type: "json" };

type Actor = Awaited<ReturnType<typeof createLearningUser>>;
export const attachmentBucket = "wholesale-order-lists";
export const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

/** 数据只属于本次随机订单；上传仍走页面，服务客户端仅用于独立读回及限定清理。 */
export function createAttachmentAccessFixture(
  actor: Actor,
  staff: Actor,
  client: boolean,
) {
  for (const id of [actor.id, staff.id]) expect(id).toMatch(/^[a-f0-9-]{36}$/);
  const orders = [randomUUID(), randomUUID()];
  const customers = [
    client
      ? executeLearningSql(
          `select id from public.wholesale_customers where registered_user_id='${actor.id}';`,
        )
      : randomUUID(),
    randomUUID(),
  ];
  for (const id of customers) expect(id).toMatch(/^[a-f0-9-]{36}$/);
  const filenames = orders.map((id) => `learning-${id}.csv`);
  const contents = orders.map((id, index) =>
    Buffer.from(`name,quantity\n${index ? "foreign" : "own"}-${id},2\n`),
  );
  executeLearningSql(`begin;
    ${customers.map((id, index) => (client && index === 0 ? "" : `insert into public.wholesale_customers(id,unique_name,created_by_user_id,salesman_commission_cohort)values('${id}','Learning-${id}','${staff.id}','new');`)).join("\n")}
    insert into public.wholesale_orders(id,order_number,customer_id,created_by_user_id,sales_user_id,product_purchase_amount,order_month)values
    ${orders.map((id, index) => `('${id}','Learning-${id}','${customers[index]}','${staff.id}','${staff.id}',${index ? 456 : 123},date_trunc('month',now())::date)`).join(",")};
    commit;`);
  const ids = orders.map((id) => `'${id}'`).join(",");
  const capture = () =>
    JSON.parse(
      executeLearningSql(`select jsonb_build_object(
    'orders',(select jsonb_agg(jsonb_build_object('id',id,'version',xmin::text)order by id)from public.wholesale_orders where id in(${ids})),
    'attachments',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('rowVersion',a.xmin::text)order by order_id),'[]')from public.wholesale_order_list_attachments a where order_id in(${ids})),
    'objects',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'path',name,'version',version,'metadata',metadata)order by name),'[]')from storage.objects where bucket_id='${attachmentBucket}'and split_part(name,'/',1)in(${ids})));`),
    );
  const asActor = (statement: string) =>
    JSON.parse(
      executeLearningSql(`begin;
    set local role authenticated;set local request.jwt.claim.role='authenticated';set local request.jwt.claim.sub='${actor.id}';
    ${statement} rollback;`),
    );
  return {
    orders,
    customers,
    filenames,
    contents,
    capture,
    asActor,
    async upload(browser: Browser) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      try {
        await page
          .context()
          .addCookies([
            { name: "bs-locale", value: "zh", url: "http://localhost:3000" },
          ]);
        await loginLearningUser(page, staff);
        await page.goto("http://localhost:3000/salesman/wholesale/orders");
        const copy = zh.WholesaleBusiness.ordersUi;
        for (let index = 0; index < orders.length; index++) {
          const id = orders[index];
          const search = page.getByPlaceholder(
            zh.UiText.components_dashboard_wholesale_wholesale_order_filters
              .attribute002,
          );
          await search.fill(`Learning-${id}`);
          await search.press("Enter");
          await page
            .getByTestId(`wholesale-order-row-${id}`)
            .getByRole("button", {
              name: copy.compactColumns.details,
              exact: true,
            })
            .click();
          const detail = page.getByRole("dialog", {
            // 标题按生产字典中的占位符生成，避免把不存在的文案分组当作契约。
            name: copy.detailFields.title.replace("{number}", `Learning-${id}`),
          });
          await detail
            .getByRole("button", { name: copy.orderList.manage, exact: true })
            .click();
          const manager = page.getByRole("dialog", {
            name: `${copy.orderList.title} · Learning-${id}`,
          });
          await manager.locator('input[type="file"]').setInputFiles({
            name: filenames[index],
            mimeType: "text/csv",
            buffer: contents[index],
          });
          await manager
            .getByRole("button", { name: copy.orderList.upload, exact: true })
            .click();
          await expect(manager).toBeHidden();
          await page.keyboard.press("Escape");
          await expect(detail).toBeHidden();
        }
      } finally {
        await page.close();
      }
      const result = capture();
      expect(result.attachments).toHaveLength(2);
      expect(result.objects).toHaveLength(2);
      for (let index = 0; index < orders.length; index++) {
        const attachment = result.attachments.find(
          (row: { order_id: string }) => row.order_id === orders[index],
        );
        expect(attachment.file_size_bytes).toBe(contents[index].length);
        const object = await staff.client.storage
          .from(attachmentBucket)
          .download(attachment.storage_path);
        expect(object.error).toBeNull();
        expect(digest(Buffer.from(await object.data!.arrayBuffer()))).toBe(
          digest(contents[index]),
        );
      }
      return result;
    },
    async cleanup() {
      const state = capture(),
        paths: string[] = state.objects.map(
          (object: { path: string }) => object.path,
        );
      if (paths.length) {
        // 两个随机订单的完整前缀包含未登记对象；不会按日期或全局文件名前缀清理。
        expect(
          paths.every((value) =>
            orders.some((id) => value.startsWith(id + "/")),
          ),
        ).toBe(true);
        const removed = await staff.client.storage
          .from(attachmentBucket)
          .remove(paths);
        expect(removed.error).toBeNull();
      }
      expect(capture().objects).toEqual([]);
      executeLearningSql(`begin;delete from public.wholesale_orders where id in(${ids})and created_by_user_id='${staff.id}';
        delete from public.wholesale_customers where id in(${customers
          .filter((_, index) => !client || index !== 0)
          .map((id) => `'${id}'`)
          .join(",")})and created_by_user_id='${staff.id}';commit;`);
      const after = capture();
      expect(after.orders).toBeNull();
      expect(after.attachments).toEqual([]);
      return { orders: 0, attachments: 0, objects: 0 };
    },
  };
}

/** 控件范围包含每一行文字，避免手机上“没有整页溢出”却仍有按钮内部裁剪。 */
export async function requireAttachmentTextFits(button: Locator) {
  expect(
    await button.evaluate((node) => {
      const bounds = node.getBoundingClientRect(),
        range = document.createRange();
      range.selectNodeContents(node);
      return Array.from(range.getClientRects()).every(
        (rect) =>
          rect.top >= bounds.top - 1 &&
          rect.bottom <= bounds.bottom + 1 &&
          rect.left >= bounds.left - 1 &&
          rect.right <= bounds.right + 1,
      );
    }),
  ).toBe(true);
}

/** 从已登录页面发起真实Storage请求；签名和认证值只留在内存，附件仅保存状态和内容摘要。 */
export async function requestAttachmentFromPage(
  page: Page,
  connection: { origin: string; key: string; token: string },
  storagePath: string,
) {
  try {
    return await page.evaluate(
      async ({ connection, storagePath, bucket }) => {
        const response = await fetch(
          connection.origin +
            "/storage/v1/object/sign/" +
            bucket +
            "/" +
            storagePath,
          {
            method: "POST",
            headers: {
              authorization: "Bearer " + connection.token,
              apikey: connection.key,
              "content-type": "application/json",
            },
            body: JSON.stringify({ expiresIn: 60 }),
          },
        );
        const body = await response.json();
        const issued =
          response.ok &&
          typeof body.signedURL === "string" &&
          body.signedURL.length > 0;
        if (!issued)
          return {
            status: response.status,
            issued: false,
            downloadStatus: null,
            sha256: null,
          };
        const url = new URL(connection.origin + "/storage/v1" + body.signedURL);
        if (url.origin !== connection.origin) throw Error("unexpected_origin");
        const download = await fetch(url.href);
        const bytes = await download.arrayBuffer();
        const sha256 = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (byte) => byte.toString(16).padStart(2, "0"),
        ).join("");
        return {
          status: response.status,
          issued: true,
          downloadStatus: download.status,
          sha256,
        };
      },
      { connection, storagePath, bucket: attachmentBucket },
    );
  } catch (error) {
    // 只公开固定诊断类别；原异常可能含请求参数，不能直接输出认证值或签名。
    const message = error instanceof Error ? error.message : "";
    const reason = /Execution context was destroyed|navigation/i.test(message)
      ? "页面跳转未完成"
      : /closed/i.test(message)
        ? "页面已关闭"
        : /fetch|network/i.test(message)
          ? "页面连接未完成"
          : "页面读取或内容解析未完成";
    throw new Error(
      `本次附件读取未完成：${reason}。认证值与下载签名不写入日志。`,
    );
  }
}
