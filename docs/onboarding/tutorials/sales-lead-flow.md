# 从领取线索理解一条完整业务链路

只使用明确归属本次练习的本地线索和测试账号。没有安全夹具或独立读回能力时，先完成源码阅读，不操作现有共享线索。

## 源码阅读

1. 从动态业务 Page 进入批发 renderer，找到 leads 分支与 `getSalesLeadPageData`。
2. 打开 `SalesLeadsClient`，观察它如何把页面状态传入结果区，并把领取回调交给列表/卡片。
3. 从 `useSalesLeadsPage` 进入 `useSalesLeadActions`。认领期间锁住操作，成功后切换“我的线索”，失败先刷新大厅并保留提示。
4. 在 `lib/sales-lead-write.ts` 找到 `claimSalesLead`、`claim_sales_lead` 和对线索编号、版本、负责人及领取周期的检查。
5. 在后端迁移历史索引查找该函数的所有定义，按迁移版本追踪；再核对本地数据库实际生效定义。

界面中的“领取”不是直接修改一个显示标签。数据库需要判断身份、业务范围、当前归属、领取额度和并发竞争，再产生实际领取周期。

## 准备独立预期

在本项目本地服务已就绪、`doctor` 确认计划任务暂停和外部请求为空后，在后端仓库运行以下命令，创建一条专属合成线索。不要恢复或重置共享账号夹具。

```powershell
$practiceId = [guid]::NewGuid().ToString()
node scripts/learning-lead-fixture.mjs create $practiceId
```

保存本次 `$practiceId`，预期初始 `lead.status` 为 `hall`、负责人为空、`assignmentCount` 为 0。登录本地管理员，在大厅搜索该编号并点击“认领给自己”。独立读回使用：

```powershell
node scripts/learning-lead-fixture.mjs inspect $practiceId
```

预期状态变为 `claimed`、负责人等于当前测试管理员编号、领取周期非空、`assignmentCount` 为 1。刷新“我的线索”仍应显示同一条资料。额度用完时保留失败结果，不能修改已有领取日期腾额度。

完成练习后，只清理该编号；预期 `lead` 为空，领取和联系计数均为 0，并刷新页面核对不再显示。脚本在锁住记录后核对本次编号、合成来源、名称、类别、国家、优先级与专属来源地址，只处理尚未转客户或转换的练习线索。若修改过这些字段，保留编号排查；不要强行覆盖变更以通过清理。

正常删除的`affected`为1，确认已不存在的重复清理为0；两者都要独立读回全部关联为零。工具职责与只验证夹具的实操见[后端维护说明](../../../../PT5-dropshipping-supabase/docs/onboarding/learning-lead-fixture.md)。

```powershell
node scripts/learning-lead-fixture.mjs cleanup $practiceId
```

为本次练习记录：线索编号、操作前状态、测试账号编号、当日已领取数量和预期负责人。预期不能来自领取接口返回后再反填。

由已准入的本地 SQL 测试或夹具准备流程创建资料，使用唯一运行标识。固定账号的额度调整只允许在可回滚事务或可重建的独立实例里进行。参考后端 `supabase/tests/sales_lead_hall.sql`，不要在共享实例直接复制其中的全局准备语句。

## 页面验收

1. 在本地页面登录测试角色，打开大厅，定位准备好的线索。
2. 从页面点击领取，等待列表进入预期状态。
3. 通过独立数据库读取核对该线索的 `status`、`current_assignee_user_id`、`current_assignment_id` 与领取周期。
4. 刷新页面，确认“我的线索”与数据库相同，原大厅不再显示可重复领取状态。
5. 在本次专用夹具上验证重复点击或另一账号竞争，确认不会创建重复领取效果。

如果需要给只读字段练习准备一个非空日期，打开同一线索的详情，选择「记录联系」，输入一条专属练习备注并保存。独立核对新增联系的记录 ID、领取周期、作者和联系时间，确认 `first_contact_at` 等于这次联系时间，联系计数为 1。清理仍使用原线索编号，回收该次领取和联系记录。

在本地数据库的只读查询中，把下列占位符换成本次线索编号：

```sql
select l.first_contact_at, n.id, n.assignment_id, n.author_user_id, n.contacted_at
from public.sales_leads l
join public.sales_lead_contact_notes n on n.lead_id = l.id
where l.id = '<本次线索 UUID>'::uuid;
```

本次从页面双击领取、记录联系及清理的证据见[线索练习复走](../reference/verification-2026-11-11-front-tutorials.md#线索领取和联系)。

## 可运行的数据库练习

需要进一步学习 SQL 断言时，按[分页规则隔离练习](backend-and-database.md#练习三在隔离实例修改并回滚分页规则)准备实例、修改生成的草稿、核对事务读回并清理。页面领取练习和分页练习各自保留结果。
