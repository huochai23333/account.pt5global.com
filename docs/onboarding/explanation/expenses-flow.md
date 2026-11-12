# 公司费用与运营报销

公司费用登记对外支出，活跃的管理员或财务可访问 `/[workspace]/company-expenses`。运营通过 `/operator/reimbursements` 登记自己的费用和确认周期报销。两个页面的记录、权限和日期含义分别维护。

| 维护任务 | 阅读入口 |
| --- | --- |
| 修改公司费用的月份、金额或币种 | [费用表单](../../../components/dashboard/company-expenses/company-expense-form-dialog.tsx)、[字段转换](../../../components/dashboard/company-expenses/company-expenses-form.ts)及[数据库服务](../../../lib/company-expenses.ts) |
| 追踪费用保存后断线 | [费用编辑 Hook](../../../components/dashboard/company-expenses/use-company-expense-editor.ts)保留同页草稿编号。按编号及数据库填写的创建人读回，核对月份、日期、分类、金额、币种和内容。 |
| 找到费用列表或合计 | [公司费用页面](../../../components/dashboard/company-expenses/company-expenses-client.tsx)组装区块，[费用视图模型](../../../components/dashboard/company-expenses/use-company-expenses-view-model.ts)管理读取、筛选与删除。汇总按当前筛选结果分币种计算。 |
| 排查运营报销 | [报销查询](../../../lib/operator-reimbursements-queries.ts)从数据库取得授权后的列表和完整周期汇总。[新增表单](../../../components/dashboard/operator-reimbursements/use-operator-reimbursement-form.ts)保留未确认草稿，[写入服务](../../../lib/operator-reimbursements-mutations.ts)核对新增及周期凭证，[确认弹窗](../../../components/dashboard/operator-reimbursements/operator-reimbursement-confirm-dialog.tsx)显示本人待报销周期。 |

新增费用先生成记录编号，数据库按当前账号记录创建人。网络响应丢失时尝试独立读回；仍待确认时，同页重开会恢复原表单和编号。修改表单内容时先处理待确认的原记录，避免提交成另一笔。同一份草稿已入库时，重试不会改写原行。刷新页面可用原名称核对记录。草稿保留范围是当前已打开的页面。

公司费用金额按原币种保存，运营报销金额以人民币保存，两者支持两位小数。运营可查授权范围内的列表，写入仍限本人。新增报销会按草稿编号和本人记录读回日期、金额和内容，关闭再打开同页表单可恢复待确认草稿。

周期确认只处理本人在所选周期仍待报销的记录。报销批次必须有同一周期、正数影响行数和金额。已报销记录受删除保护。响应丢失时页面提示刷新核对；重复请求返回零行时仍提示核对原状态。

权限演进和完整汇总的阅读入口见[共享报销与公开包装器](../../../../PT5-dropshipping-supabase/docs/onboarding/operation-reimbursement-history.md)。有效运营之间可共同查看，确认和删除仍限本人；历史重放会保留 private 收紧时的真实拒绝，再验证后续包装器恢复。

维护当前SQL按[九身份报销实操](../../../../PT5-dropshipping-supabase/docs/onboarding/reimbursement-sharing-sql.md)准备可丢弃副本。原SQL先确认真实岗位存在，再查11页205个编号、周期完整回执和真实费用行；重复确认必须为零行/零金额且原记录不重写。SQL的零行是防重复凭证，页面仍应提示核对，不能再次显示报销成功。数据库角色测试不代替真实登录、页面刷新或双连接竞争。

- `npm run test:learning:browser -- company-expense-recovery` 使用专属管理员和财务从页面写入、独立核对并刷新，业务员测试检查权限入口。
- `npm run test:learning:browser -- operator-reimbursement-recovery` 使用专属运营验证新增断线去重、周期确认、零行拒绝和刷新状态。
- `npm run test:operation-receipts` 覆盖报销零行、金额和无效回执；后端[报销权限与周期测试](../../../../PT5-dropshipping-supabase/supabase/tests/operator_reimbursement_sharing.sql)在隔离实例运行。

原operator-reimbursements四页面场景的[夹具维护](operator-reimbursement-tests.md)要求单worker、周期非空就拒绝及本次UUID精确回收；独立比较报销编号、本人、金额和新版本，刷新后保持。原Auth/页面仍未执行，12项专项与原生SQL另行记录。
