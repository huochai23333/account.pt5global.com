# 库存订单与专属信贷

当前范围：启用。

## 业务与阅读顺序

为已关联账号的客户维护库存订单、商品、附件与专属信贷，记录审核、延期和还款。

数据流：工作台批发 inventory-orders → wholesale-section-page → getCustomerInventoryPageData → CustomerInventoryClient → 专用弹窗与数据库规则。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

管理员、业务员和财务可维护。客户只能读取与自己账号关联的订单和附件，并可通过专用入口申请信贷或延期。数据库按会话和客户归属重新授权。

完成依据：订单编号和 revision、余额及审核或还款记录共同证明写入。附件要核对同一订单和路径的登记及 Storage 对象。

## 常见维护

见[库存订单数据流](../explanation/customer-inventory-flow.md)。调整筛选从两个 Hook 进入；修改资格、利率或金额规则先核对现行数据库函数和 SQL 回归。

验证入口：npm run test:learning:browser -- customer-inventory-attachment-recovery；后端 customer_inventory_orders_and_credit.sql 在隔离实例执行；原 customer-inventory-orders 用例按测试准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`cancel_customer_inventory_order`、`create_customer_inventory_order`、`delete_customer_inventory_order_list_attachment`、`get_customer_inventory_usd_to_currency_rate`、`manage_customer_inventory_order_credit`、`mark_customer_inventory_order_paid_in_full`、`record_customer_inventory_credit_repayment`、`register_customer_inventory_order_list_attachments`、`replace_customer_inventory_order_items`、`review_customer_inventory_credit_batch`、`review_customer_inventory_credit_extension`、`submit_customer_inventory_credit_applications`、`submit_customer_inventory_credit_extension`、`update_customer_inventory_order`、`update_customer_inventory_order_notes`。

源码中直接引用的数据表/存储桶：`customer_inventory_credit_applications`、`customer_inventory_credit_extension_requests`、`customer_inventory_credit_repayments`、`customer_inventory_order_audit_logs`、`customer_inventory_order_items`、`customer_inventory_order_list_attachments`、`customer_inventory_orders`、`wholesale_customers`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/e2e/customer-inventory-orders.spec.ts](../../../tests/e2e/customer-inventory-orders.spec.ts)
- [web: tests/learning/customer-inventory-attachment-recovery.spec.ts](../../../tests/learning/customer-inventory-attachment-recovery.spec.ts)
- [supabase: supabase/tests/customer_inventory_orders_and_credit.sql](../../../../PT5-dropshipping-supabase/supabase/tests/customer_inventory_orders_and_credit.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/customer-inventory/customer-inventory-attachments-dialog.tsx](../../../components/dashboard/customer-inventory/customer-inventory-attachments-dialog.tsx) | 已审拆分：渲染附件、文件选择与待核对提示；转发下载和删除操作 |
| [components/dashboard/customer-inventory/customer-inventory-client.tsx](../../../components/dashboard/customer-inventory/customer-inventory-client.tsx) | 已审保留：组装库存与信贷标签页；按当前订单或信贷条目调度弹窗 |
| [components/dashboard/customer-inventory/customer-inventory-credit-application-dialog.tsx](../../../components/dashboard/customer-inventory/customer-inventory-credit-application-dialog.tsx) | 已审保留：推导可申请档位及展示预估；组装申请表单并提交档位 |
| [components/dashboard/customer-inventory/customer-inventory-credit-card.tsx](../../../components/dashboard/customer-inventory/customer-inventory-credit-card.tsx) | 已审保留：呈现单笔信贷和关联到期、还款信息；提供延期或登记还款入口 |
| [components/dashboard/customer-inventory/customer-inventory-credit-dialog-types.ts](../../../components/dashboard/customer-inventory/customer-inventory-credit-dialog-types.ts) | 已审保留：定义 InventoryCreditDialogState、CreditDecision 等3项同模块类型合同 |
| [components/dashboard/customer-inventory/customer-inventory-credit-dialogs.tsx](../../../components/dashboard/customer-inventory/customer-inventory-credit-dialogs.tsx) | 已审保留：按信贷动作调度独立弹窗 |
| [components/dashboard/customer-inventory/customer-inventory-credit-filters.tsx](../../../components/dashboard/customer-inventory/customer-inventory-credit-filters.tsx) | 已审保留：展示并转发信贷筛选条件 |
| [components/dashboard/customer-inventory/customer-inventory-credit-lifecycle-dialogs.tsx](../../../components/dashboard/customer-inventory/customer-inventory-credit-lifecycle-dialogs.tsx) | 已审保留：按动作展示延期、审核或还款表单；将表单提交到对应写入函数 |
| [components/dashboard/customer-inventory/customer-inventory-credit-manage-dialog.tsx](../../../components/dashboard/customer-inventory/customer-inventory-credit-manage-dialog.tsx) | 已审保留：维护每档信贷的启用或审核决定；展示抵消及建议实付；按原订单修订号提交整批决定 |
| [components/dashboard/customer-inventory/customer-inventory-credit-review-card.tsx](../../../components/dashboard/customer-inventory/customer-inventory-credit-review-card.tsx) | 已审保留：初始化审核档位输入；展示和更新单档决定 |
| [components/dashboard/customer-inventory/customer-inventory-credit-review-dialog.tsx](../../../components/dashboard/customer-inventory/customer-inventory-credit-review-dialog.tsx) | 已审保留：组装待审档位决定和建议实付；提交整笔订单的审核结果 |
| [components/dashboard/customer-inventory/customer-inventory-credit-section.tsx](../../../components/dashboard/customer-inventory/customer-inventory-credit-section.tsx) | 已审保留：组装信贷统计和待审任务区；呈现经过筛选和分页的信贷卡片 |
| [components/dashboard/customer-inventory/customer-inventory-dialog-utils.ts](../../../components/dashboard/customer-inventory/customer-inventory-dialog-utils.ts) | 已审保留：转换共享表单值；拒绝空数据库操作回执 |
| [components/dashboard/customer-inventory/customer-inventory-display.ts](../../../components/dashboard/customer-inventory/customer-inventory-display.ts) | 已审保留：格式化金额、日期、名称和付款色调；推导可用动作的展示条件 |
| [components/dashboard/customer-inventory/customer-inventory-filter-empty-state.tsx](../../../components/dashboard/customer-inventory/customer-inventory-filter-empty-state.tsx) | 已审保留：渲染筛选无结果提示 |
| [components/dashboard/customer-inventory/customer-inventory-items-dialog.tsx](../../../components/dashboard/customer-inventory/customer-inventory-items-dialog.tsx) | 已审保留：按维护能力组装商品列表或编辑表单；调度按修订号提交整组商品 |
| [components/dashboard/customer-inventory/customer-inventory-order-card-parts.tsx](../../../components/dashboard/customer-inventory/customer-inventory-order-card-parts.tsx) | 已审保留：复用订单金额、字段和商品入口展示；按已确认条件调度订单动作 |
| [components/dashboard/customer-inventory/customer-inventory-order-dialogs.tsx](../../../components/dashboard/customer-inventory/customer-inventory-order-dialogs.tsx) | 已审保留：组装新建、编辑、备注和付款确认表单；按动作提交字段、商品和订单版本 |
| [components/dashboard/customer-inventory/customer-inventory-order-filters.tsx](../../../components/dashboard/customer-inventory/customer-inventory-order-filters.tsx) | 已审保留：渲染订单筛选条件和日期快捷入口 |
| [components/dashboard/customer-inventory/customer-inventory-order-item-editor.tsx](../../../components/dashboard/customer-inventory/customer-inventory-order-item-editor.tsx) | 已审保留：维护商品行输入与稳定标识；序列化整组商品 |
| [components/dashboard/customer-inventory/customer-inventory-orders-section.tsx](../../../components/dashboard/customer-inventory/customer-inventory-orders-section.tsx) | 已审保留：组装订单筛选、分页和空状态；呈现桌面表格和手机卡片 |
| [components/dashboard/customer-inventory/use-customer-inventory-actions.ts](../../../components/dashboard/customer-inventory/use-customer-inventory-actions.ts) | 已审保留：调度浏览器写入并维护提交状态；转换失败提示并刷新页面数据 |
| [components/dashboard/customer-inventory/use-customer-inventory-credit-filters.ts](../../../components/dashboard/customer-inventory/use-customer-inventory-credit-filters.ts) | 已审保留：维护信贷筛选条件；在已授权记录中派生匹配条目 |
| [components/dashboard/customer-inventory/use-customer-inventory-order-filters.ts](../../../components/dashboard/customer-inventory/use-customer-inventory-order-filters.ts) | 已审保留：维护订单筛选与日期快捷范围；构造商品检索并派生匹配订单 |
| [components/dashboard/customer-inventory/use-inventory-attachment-upload.ts](../../../components/dashboard/customer-inventory/use-inventory-attachment-upload.ts) | 已审保留：维护订单关联的选中文件与待核对路径；提交上传或核对原批 |
| [lib/customer-inventory-attachment-registration.ts](../../../lib/customer-inventory-attachment-registration.ts) | 已审保留：区分数据库明确拒绝与回执不确定；按订单及路径独立核对登记和对象 |
| [lib/customer-inventory-attachments.ts](../../../lib/customer-inventory-attachments.ts) | 已审拆分：校验并上传表格对象；处理登记失败的安全补偿；生成私有下载链接并验证删除 |
| [lib/customer-inventory-types.ts](../../../lib/customer-inventory-types.ts) | 已审保留：定义订单、商品、附件及信贷记录形状；推导页面到期和利息展示 |
| [lib/customer-inventory.ts](../../../lib/customer-inventory.ts) | 已审保留：按当前会话装载库存页数据；组织币种与待支付订单的汇率条件 |
