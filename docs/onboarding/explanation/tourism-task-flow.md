# 旅游任务数据流

旅游任务原用于发布任务、领取、提交材料和审核。当前业务清单会在旅游栏目加载之前返回停用说明。维护时从旅游栏目追到源码，页面验证先确认停用边界。

## 找到看板和筛选规则

1. `tourism-section-page.tsx` 根据工作台角色选择管理或执行看板。执行看板读取 `salesman-tasks.ts`，先检查当前会话、账号状态和任务适用角色。
2. `salesman-task-data.ts` 读取任务主表 `task_main`、任务附件 `task_sub`、目标角色和类型目录。`salesman-tasks.ts` 把同一个任务与本人领取记录 `task_acceptances` 对齐，并补齐基础列表之外的已领取任务。可领取行使用任务编号，已领取行使用领取记录编号，并通过 `parent_task_id` 保留原任务编号。
3. `salesman-task-route.ts` 负责刷新前后的筛选、栏目和页码。`salesman-task-list-filters.ts` 只筛选服务端已加载的数据，处理中、审核中、退回和已完成栏目按当前人员的领取记录过滤。查找过滤和空列表原因时先区分数据库可见范围与当前栏目。

管理员的地址解析和生成在 `admin-task-route.ts`，列表字段筛选在 `admin-task-list-filters.ts`。清空搜索和目标角色会合并成同一份草稿，并回到第一页，保留当前历史状态。地址变化会丢弃旧草稿，审核和媒体库标签等其他参数继续保留。判断审核中或退回时，检查该任务的领取记录。

## 领取、提交与凭证

`salesman-task-actions.ts` 以任务编号调用 `accept_task`。领取成功应独立核对 `task_acceptances` 的任务编号、领取人、状态和记录数，并刷新看板查看同一条领取记录。读取附件签名链接时使用当前登录会话的 Storage 权限。

`use-salesman-task-review-dialog.ts` 以领取记录编号创建草稿，`task-review-assets.ts` 上传并登记材料。`task-review-submission-flow.ts` 提交后用提交编号、领取编号、提交者、状态和提交时间读回同一份记录。若提交结果未知，只有在数据库取消该草稿并确认它已消失后才清理附件。若已提交，取消函数会拒绝，此时重新读回原编号。仍无法确认时，页面提示先核对任务进度。

关键写入验收还需独立核对领取状态、`task_review_submissions`、`task_review_submission_assets` 和 Storage 对象。管理看板审核后的最终状态与佣金关系需另行验证。

## 发布与目标角色改派

新建和编辑使用 `admin-tasks-utils.ts` 的表单规则。切换任务类型时，空白金额或旧类型的默认金额跟随新类型，手填金额保留。发布附件由 `admin-task-attachments.ts` 上传并核对登记路径。编辑页展示历史附件。

管理员改派前先读取 `task_target_roles`。角色已经是当前选择时，页面提示无需更新。实际改派调用 `set_task_target_roles`，然后按任务编号独立读回完整角色集合。集合不同、无记录或查询失败时，界面保留失败结果。数据库只允许在无人领取时改派。

类型目录由 `admin-task-type-management.ts` 维护。创建使用数据库生成的编码，编辑与停用要核对原编码。回执通过后独立读取该编码，创建和编辑核对名称、说明、默认佣金与启用状态，停用核对明确的停用状态。保存和停用共用一次写入占用，避免连击产生多个请求。

## 删除与附件清理

`admin-task-deletion.ts` 先保存清理清单，再删除任务。任务和附件登记由数据库级联处理。独立读回确认任务已经消失后，`task-storage-cleanup.ts` 分别清理任务附件和提审附件，并核对对象是否消失。某组清理未确认时返回 `partial_failed`，页面仍会刷新任务列表。删除响应中断、并发新增附件以及 Storage 文件终态需在隔离环境核对。

## 管理审核与附件预览

`admin-task-reviews.ts` 先核对管理员会话，`task-reviews.ts` 从 `pending_task_reviews` 读取待审轮次并按提交编号加载附件。草稿和提审写入在 `task-review-draft-mutations.ts`，管理员通过和退回在 `task-review-decisions.ts`。通过会更新提交和领取记录并同步佣金。验收时独立核对三个对象的编号、状态、审核人和时间。

审核列表和已通过媒体库使用 `use-admin-task-file-preview.ts`。同时请求多个签名地址时，只能由最后一次选择更新预览。关闭后，进行中的读回也会被丢弃。

通过和退回请求同时携带领取编号与管理员看到的提交编号。数据库锁定领取记录后比较当前轮次，过期卡片会收到刷新提示。请求成功后再单独读取同一轮，核对状态、审核人、时间及退回说明。页面只移除已经确认的轮次。

用 `npm run test:contracts -- tourism-collaboration-retained admin-task-route admin-task-type-management admin-task-assignment admin-task-deletion task-review-submission-flow task-file-preview task-review-decisions` 验证任务地址、筛选、类型保存、改派、删除、提审恢复、预览顺序和审核读回，用 `npm run test:learning:browser -- workspace-notice` 验证真实本地登录下的停用入口。后端仓库的 `node scripts/test-task-review-decision-round.mjs` 用无网络隔离库验证错轮次、通过、退回、重复请求及佣金凭证。

## 历史佣金怎么结算

旅游栏目的 `commission` 分支保留管理看板和员工个人记录。管理员看板的订单佣金来自 `commission_record`，任务佣金来自 `task_commission_record`。员工分支只读取本人记录。当前旅游入口显示停用说明，两条结算函数都只授权给服务端角色。

历史页面把待结算记录交给 `use-managed-commission-settlement.ts`。同一看板一次只处理一个确认。写入由 `commission-settlement.ts` 按订单或任务调用对应函数，取得目标编号后查询原表。编号、已结算状态、有效结算时间和结算说明一致时，页面才刷新看板并提示完成。若写入已确认而列表刷新失败，页面会提示刷新核对。结算标记是数据库状态，流程里没有向支付服务发出请求。

数据库在行锁内检查默认请求的目标仍然待结算。第二次请求、过期看板和已取消或冲销的默认请求都会被拒绝。带明确结算时间或说明的维护调用沿用原规则，函数签名与执行权限见[数据库索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database.md#旅游团队停用权限)。

用 `npm run test:contracts -- retained-commission-settlement` 核对 Web 回执和独立读回的判断，在后端运行 `node scripts/test-retained-commission-settlement.mjs`，用隔离数据库复核订单和任务结算。当前可从浏览器验收的是停用边界，完整结算页面的端到端验收单独记录。

## 修改历史看板的字段、筛选或团队标签

- 新增只读订单佣金字段时，先在 `lib/admin-commission.ts` 找查询字段，再在 `lib/admin-commission-normalizers.ts` 对齐记录和展示行。金额来自订单快照，数据层保留原金额、状态和编号，页面按当前语言生成标签。
- 改管理员筛选时，`use-admin-commission-filters.ts` 管理输入和选项，`admin-commission-view-model.ts` 负责匹配与受益人汇总。筛选只作用于权限范围内已加载的记录，订单明细在筛选后分页。受益人下钻从汇总区发出，只更新筛选条件。
- 改团队显示时，两种任务佣金表使用 `tasks-display.ts` 的同一范围标签。仅团队任务且有名称时追加团队名。任务创建、编辑和改派的输入校验在 `task-form-validation.ts`，切到不限人数时忽略表单里上次填写的限额。
