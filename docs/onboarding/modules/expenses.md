# 公司费用与运营报销

当前范围：共享。

## 业务与阅读顺序

记录公司费用及运营自己的报销申请和处理结果。

数据流：费用/报销页面 → 独立表单状态 → queries/mutations → 费用或报销凭证。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

公司费用与运营个人报销沿用不同岗位范围，不能因共享控件扩大授权。

完成依据：费用/报销编号、版本、金额和实际影响行数与刷新后列表一致。

## 常见维护

见[公司费用与运营报销链路](../explanation/expenses-flow.md)。公司费用按实际币种登记，运营报销按本人周期核对。

验证入口：npm run test:learning:browser -- company-expense-recovery operator-reimbursement-recovery；npm run test:operation-receipts；原费用与报销用例按准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`get_operator_reimbursements_page`、`mark_operator_reimbursements_reimbursed`。

源码中直接引用的数据表/存储桶：`company_expenses`、`operator_reimbursements`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: scripts/learning/operator-reimbursement-fixture.test.mjs](../../../scripts/learning/operator-reimbursement-fixture.test.mjs)
- [web: scripts/operator-reimbursement-receipts.test.mjs](../../../scripts/operator-reimbursement-receipts.test.mjs)
- [web: tests/e2e/company-expenses.spec.ts](../../../tests/e2e/company-expenses.spec.ts)
- [web: tests/e2e/helpers/operator-reimbursement-fixture.ts](../../../tests/e2e/helpers/operator-reimbursement-fixture.ts)
- [web: tests/e2e/operator-reimbursements-sharing.spec.ts](../../../tests/e2e/operator-reimbursements-sharing.spec.ts)
- [web: tests/e2e/operator-reimbursements.spec.ts](../../../tests/e2e/operator-reimbursements.spec.ts)
- [web: tests/learning/operator-reimbursement-recovery.spec.ts](../../../tests/learning/operator-reimbursement-recovery.spec.ts)
- [web: tests/test-support/operator-reimbursement-fixture.ts](../../../tests/test-support/operator-reimbursement-fixture.ts)
- [supabase: supabase/tests/operator_reimbursement_sharing.sql](../../../../PT5-dropshipping-supabase/supabase/tests/operator_reimbursement_sharing.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(workspace)/[workspace]/company-expenses/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/company-expenses/page.tsx) | 已审保留：导出共享页面入口与标题信息 |
| [app/(workspace)/[workspace]/reimbursements/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/reimbursements/page.tsx) | 已审保留：导出运营报销入口及页面标题 |
| [components/dashboard/company-expenses/company-expense-form-dialog.tsx](../../../components/dashboard/company-expenses/company-expense-form-dialog.tsx) | 已审拆分：显示新增和编辑费用字段；发出表单修改和提交回调 |
| [components/dashboard/company-expenses/company-expenses-client.tsx](../../../components/dashboard/company-expenses/company-expenses-client.tsx) | 已审拆分：组装权限状态、页头、筛选、汇总、列表与弹窗 |
| [components/dashboard/company-expenses/company-expenses-copy.ts](../../../components/dashboard/company-expenses/company-expenses-copy.ts) | 已审拆分：将本模块的双语字典映射到区块属性 |
| [components/dashboard/company-expenses/company-expenses-display.ts](../../../components/dashboard/company-expenses/company-expenses-display.ts) | 已审拆分：格式化原币金额和上海月份或日期；汇总已筛选费用的币种与计数 |
| [components/dashboard/company-expenses/company-expenses-filters.tsx](../../../components/dashboard/company-expenses/company-expenses-filters.tsx) | 已审保留：呈现搜索和月份、分类及币种筛选 |
| [components/dashboard/company-expenses/company-expenses-form.ts](../../../components/dashboard/company-expenses/company-expenses-form.ts) | 已审拆分：构造新增或编辑费用表单；验证和转换表单输入；将已知错误映射为用户反馈 |
| [components/dashboard/company-expenses/company-expenses-header.tsx](../../../components/dashboard/company-expenses/company-expenses-header.tsx) | 已审保留：展示费用标题及新增入口 |
| [components/dashboard/company-expenses/company-expenses-list.tsx](../../../components/dashboard/company-expenses/company-expenses-list.tsx) | 已审保留：分页和渲染费用卡片；按行调度编辑和删除意图 |
| [components/dashboard/company-expenses/company-expenses-sections.tsx](../../../components/dashboard/company-expenses/company-expenses-sections.tsx) | 已审保留：统一导出费用展示区块 |
| [components/dashboard/company-expenses/company-expenses-summary.tsx](../../../components/dashboard/company-expenses/company-expenses-summary.tsx) | 已审保留：渲染当前筛选的币种合计及空态 |
| [components/dashboard/company-expenses/use-company-expense-editor.ts](../../../components/dashboard/company-expenses/use-company-expense-editor.ts) | 已审拆分：维护新增及修改弹窗草稿；锁定提交及恢复原新增编号；通知上层保存结果或给出错误反馈 |
| [components/dashboard/company-expenses/use-company-expenses-view-model.ts](../../../components/dashboard/company-expenses/use-company-expenses-view-model.ts) | 已审拆分：维护服务端初值与页面重读；维护列表过滤与可用月份币种；调度删除及列表反馈 |
| [components/dashboard/operator-reimbursements/operator-reimbursement-confirm-dialog.tsx](../../../components/dashboard/operator-reimbursements/operator-reimbursement-confirm-dialog.tsx) | 已审保留：显示本人待报销周期；呈现该周期金额和确认按钮 |
| [components/dashboard/operator-reimbursements/operator-reimbursement-form-dialog.tsx](../../../components/dashboard/operator-reimbursements/operator-reimbursement-form-dialog.tsx) | 已审拆分：呈现报销输入与字段错误 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-client.tsx](../../../components/dashboard/operator-reimbursements/operator-reimbursements-client.tsx) | 已审保留：组装页面、筛选、结果及弹窗 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-copy.ts](../../../components/dashboard/operator-reimbursements/operator-reimbursements-copy.ts) | 已审拆分：把报销双语词条转换为组件属性 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-display.ts](../../../components/dashboard/operator-reimbursements/operator-reimbursements-display.ts) | 已审拆分：格式化人民币金额、上海日期及周期 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-filters.tsx](../../../components/dashboard/operator-reimbursements/operator-reimbursements-filters.tsx) | 已审保留：渲染归属、周期、状态和文本筛选 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-form.ts](../../../components/dashboard/operator-reimbursements/operator-reimbursements-form.ts) | 已审拆分：准备上海日期的初始表单；校验日期、内容和金额精度；映射已知业务错误及本地化后备信息 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-header.tsx](../../../components/dashboard/operator-reimbursements/operator-reimbursements-header.tsx) | 已审保留：显示当前周期和本人操作入口 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-list.tsx](../../../components/dashboard/operator-reimbursements/operator-reimbursements-list.tsx) | 已审保留：渲染报销记录卡片与空态；按本人及状态显示删除入口 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-results.tsx](../../../components/dashboard/operator-reimbursements/operator-reimbursements-results.tsx) | 已审保留：显示加载、失败及授权结果；协调汇总、分页和卡片 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-sections.tsx](../../../components/dashboard/operator-reimbursements/operator-reimbursements-sections.tsx) | 已审保留：统一导出报销展示区块 |
| [components/dashboard/operator-reimbursements/operator-reimbursements-summary.tsx](../../../components/dashboard/operator-reimbursements/operator-reimbursements-summary.tsx) | 已审保留：展示当前、历史及已报销合计 |
| [components/dashboard/operator-reimbursements/use-operator-reimbursement-actions.ts](../../../components/dashboard/operator-reimbursements/use-operator-reimbursement-actions.ts) | 已审拆分：维护周期确认与删除状态；执行删除和周期报销并触发重读 |
| [components/dashboard/operator-reimbursements/use-operator-reimbursement-form.ts](../../../components/dashboard/operator-reimbursements/use-operator-reimbursement-form.ts) | 已审拆分：维护新增表单、字段反馈及开关；为同页未确认草稿保留编号和原输入；调度写入及完成后列表重读 |
| [components/dashboard/operator-reimbursements/use-operator-reimbursements-query.ts](../../../components/dashboard/operator-reimbursements/use-operator-reimbursements-query.ts) | 已审保留：管理筛选和搜索防抖；读取分页并拒绝过期响应；提供重试和加载状态 |
| [components/dashboard/operator-reimbursements/use-operator-reimbursements-view-model.ts](../../../components/dashboard/operator-reimbursements/use-operator-reimbursements-view-model.ts) | 已审保留：组装查询和写入 Hook；处理写入后的刷新及本人视图 |
| [lib/company-expenses.ts](../../../lib/company-expenses.ts) | 已审拆分：授权读取和分批查询费用；执行新增、修改与删除并核对回执；规范化数据库字段与费用载荷 |
| [lib/operator-reimbursement-receipts.ts](../../../lib/operator-reimbursement-receipts.ts) | 已审保留：验证周期回执、影响行数及金额 |
| [lib/operator-reimbursements-mutations.ts](../../../lib/operator-reimbursements-mutations.ts) | 已审拆分：执行本人新增并独立核对；删除本人未报销记录；提交周期确认及检查有效回执 |
| [lib/operator-reimbursements-queries.ts](../../../lib/operator-reimbursements-queries.ts) | 已审保留：按筛选读取报销页和完整汇总 |
| [lib/operator-reimbursements-types.ts](../../../lib/operator-reimbursements-types.ts) | 已审保留：声明报销行、周期、过滤及凭证类型 |
| [lib/operator-reimbursements.ts](../../../lib/operator-reimbursements.ts) | 已审保留：导出报销类型、读取和写入入口 |
