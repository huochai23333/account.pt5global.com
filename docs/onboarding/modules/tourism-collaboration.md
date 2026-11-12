# 任务、团队与旅游协作资产

当前范围：按当前业务清单限制。

## 业务与阅读顺序

维护停用旅游栏目保留的团队、推广人员、客户、任务和历史佣金等资产。

数据流：旅游地址先经过启用清单。保留的团队栏目读取选中团队及成员；任务栏目读取任务主表、本人领取记录、附件和审核资料。。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

保留当前启用清单，普通登录角色没有旅游团队专属函数的直接执行权限。

完成依据：任务/成员/审核及佣金关联记录一致，停用业务仍不可直达。

## 常见维护

沿[旅游团队与人员目录](../explanation/tourism-collaboration-flow.md)维护选择、刷新及人员筛选。任务地址、列表、领取与提审见[旅游任务数据流](../explanation/tourism-task-flow.md)。

验证入口：npm run test:contracts -- tourism-collaboration-retained admin-task-route admin-task-type-management admin-task-assignment admin-task-deletion task-review-submission-flow task-file-preview task-review-decisions retained-commission-settlement；npm run test:learning:browser -- workspace-notice；后端运行 node scripts/test-task-review-decision-round.mjs 和 node scripts/test-retained-commission-settlement.mjs。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`accept_task`、`approve_task_review`、`cancel_task_review_submission`、`complete_task`、`create_role_targeted_task`、`create_task_review_submission`、`create_task_type`、`deactivate_task_type`、`get_task_acceptance_summaries`、`get_team_detail`、`get_team_manager_candidates`、`get_team_salesman_candidates`、`get_visible_team_overview`、`reject_task_review`、`save_team_profile`、`set_task_target_roles`、`submit_task_review`、`update_commission_settlement`、`update_role_targeted_task`、`update_task_commission_settlement`、`update_task_type`。

源码中直接引用的数据表/存储桶：`commission_record`、`order_overview`、`pending_task_reviews`、`task_acceptances`、`task_commission_record`、`task_main`、`task_review_submission_assets`、`task_review_submissions`、`task_sub`、`task_target_roles`、`task_type_catalog`、`team_profiles`、`user_profiles`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/contracts/admin-task-assignment.spec.ts](../../../tests/contracts/admin-task-assignment.spec.ts)
- [web: tests/contracts/admin-task-deletion.spec.ts](../../../tests/contracts/admin-task-deletion.spec.ts)
- [web: tests/contracts/admin-task-route.spec.ts](../../../tests/contracts/admin-task-route.spec.ts)
- [web: tests/contracts/admin-task-type-management.spec.ts](../../../tests/contracts/admin-task-type-management.spec.ts)
- [web: tests/contracts/task-file-preview.spec.ts](../../../tests/contracts/task-file-preview.spec.ts)
- [web: tests/contracts/task-review-decisions.spec.ts](../../../tests/contracts/task-review-decisions.spec.ts)
- [web: tests/contracts/task-review-submission-flow.spec.ts](../../../tests/contracts/task-review-submission-flow.spec.ts)
- [web: tests/e2e/home-role-task-counts.spec.ts](../../../tests/e2e/home-role-task-counts.spec.ts)
- [supabase: supabase/tests/pending_task_reviews_security.sql](../../../../PT5-dropshipping-supabase/supabase/tests/pending_task_reviews_security.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [components/dashboard/admin-tasks/admin-task-attachment-fields.tsx](../../../components/dashboard/admin-tasks/admin-task-attachment-fields.tsx) | 已审保留：发布文件选择；编辑时附件展示 |
| [components/dashboard/admin-tasks/admin-task-detail-dialog.tsx](../../../components/dashboard/admin-tasks/admin-task-detail-dialog.tsx) | 已审保留：任务详情与状态；领取历史；附件与已审核媒体展示 |
| [components/dashboard/admin-tasks/admin-task-file-preview-dialog.tsx](../../../components/dashboard/admin-tasks/admin-task-file-preview-dialog.tsx) | 已审保留：媒体预览；附件信息和下载入口 |
| [components/dashboard/admin-tasks/admin-task-form-dialog.tsx](../../../components/dashboard/admin-tasks/admin-task-form-dialog.tsx) | 已审保留：新建和编辑弹窗装配；状态与校验提示；表单和附件接线 |
| [components/dashboard/admin-tasks/admin-task-form-sections.tsx](../../../components/dashboard/admin-tasks/admin-task-form-sections.tsx) | 已审保留：表单字段展示；任务摘要；目标角色选择 |
| [components/dashboard/admin-tasks/admin-task-list-board.tsx](../../../components/dashboard/admin-tasks/admin-task-list-board.tsx) | 已审保留：任务列表看板组装；任务弹窗接线 |
| [components/dashboard/admin-tasks/admin-task-list-filters.ts](../../../components/dashboard/admin-tasks/admin-task-list-filters.ts) | 已审拆分：列表角色和业务状态筛选；任务文本检索 |
| [components/dashboard/admin-tasks/admin-task-media-board.tsx](../../../components/dashboard/admin-tasks/admin-task-media-board.tsx) | 已审保留：媒体区块及预览弹窗组装 |
| [components/dashboard/admin-tasks/admin-task-media-library-section.tsx](../../../components/dashboard/admin-tasks/admin-task-media-library-section.tsx) | 已审保留：媒体筛选控件；权限与空状态；媒体卡片 |
| [components/dashboard/admin-tasks/admin-task-review-board.tsx](../../../components/dashboard/admin-tasks/admin-task-review-board.tsx) | 已审保留：审核看板组装 |
| [components/dashboard/admin-tasks/admin-task-review-list.tsx](../../../components/dashboard/admin-tasks/admin-task-review-list.tsx) | 已审保留：待审记录展示；附件和审核按钮接线 |
| [components/dashboard/admin-tasks/admin-task-review-section.tsx](../../../components/dashboard/admin-tasks/admin-task-review-section.tsx) | 已审保留：审核权限说明；审核列表区块组装 |
| [components/dashboard/admin-tasks/admin-task-review-types.ts](../../../components/dashboard/admin-tasks/admin-task-review-types.ts) | 已审保留：定义 AdminTaskReviewAction 等1项同模块类型合同 |
| [components/dashboard/admin-tasks/admin-task-submission-media.tsx](../../../components/dashboard/admin-tasks/admin-task-submission-media.tsx) | 已审保留：已审核媒体列表；媒体预览弹窗 |
| [components/dashboard/admin-tasks/admin-task-type-management-dialog.tsx](../../../components/dashboard/admin-tasks/admin-task-type-management-dialog.tsx) | 已审保留：任务类型列表；创建编辑表单；操作与反馈展示 |
| [components/dashboard/admin-tasks/admin-tasks-board-tabs.tsx](../../../components/dashboard/admin-tasks/admin-tasks-board-tabs.tsx) | 已审保留：任务页面板选项展示 |
| [components/dashboard/admin-tasks/admin-tasks-client.tsx](../../../components/dashboard/admin-tasks/admin-tasks-client.tsx) | 已审保留：面板与 URL 同步；组装三类面板；页面反馈选择 |
| [components/dashboard/admin-tasks/admin-tasks-dialogs.tsx](../../../components/dashboard/admin-tasks/admin-tasks-dialogs.tsx) | 已审保留：改派确认弹窗；目标角色控件接线 |
| [components/dashboard/admin-tasks/admin-tasks-sections.tsx](../../../components/dashboard/admin-tasks/admin-tasks-sections.tsx) | 已审保留：看板页首与准入说明；筛选控件；列表详情组装 |
| [components/dashboard/admin-tasks/admin-tasks-ui.tsx](../../../components/dashboard/admin-tasks/admin-tasks-ui.tsx) | 已审保留：任务卡片展示与操作接线；表单字段容器 |
| [components/dashboard/admin-tasks/admin-tasks-utils.ts](../../../components/dashboard/admin-tasks/admin-tasks-utils.ts) | 已审拆分：表单初始值与金额格式；表单字段变更；按钮显示条件 |
| [components/dashboard/admin-tasks/admin-tasks-view-model-shared.ts](../../../components/dashboard/admin-tasks/admin-tasks-view-model-shared.ts) | 已审保留：任务模型状态类型；表单样式；筛选相等判断 |
| [components/dashboard/admin-tasks/use-admin-task-assignment-dialog.ts](../../../components/dashboard/admin-tasks/use-admin-task-assignment-dialog.ts) | 已审拆分：改派弹窗状态；角色选择；保存与反馈调度 |
| [components/dashboard/admin-tasks/use-admin-task-create-dialog.ts](../../../components/dashboard/admin-tasks/use-admin-task-create-dialog.ts) | 已审拆分：新建草稿及校验；附件选择；创建与补偿调度 |
| [components/dashboard/admin-tasks/use-admin-task-delete-action.ts](../../../components/dashboard/admin-tasks/use-admin-task-delete-action.ts) | 已审拆分：删除确认及防重复；状态与结果反馈 |
| [components/dashboard/admin-tasks/use-admin-task-edit-dialog.ts](../../../components/dashboard/admin-tasks/use-admin-task-edit-dialog.ts) | 已审拆分：编辑草稿状态及校验；任务切换；保存反馈 |
| [components/dashboard/admin-tasks/use-admin-task-file-preview.ts](../../../components/dashboard/admin-tasks/use-admin-task-file-preview.ts) | 已审拆分：签名链接异步顺序；预览状态；浏览器临时下载 |
| [components/dashboard/admin-tasks/use-admin-task-media-library.ts](../../../components/dashboard/admin-tasks/use-admin-task-media-library.ts) | 已审拆分：媒体读取及刷新；类型与文本筛选；文件预览及下载接线 |
| [components/dashboard/admin-tasks/use-admin-task-review-board.ts](../../../components/dashboard/admin-tasks/use-admin-task-review-board.ts) | 已审拆分：待审列表与刷新；审核调度与反馈；附件接线 |
| [components/dashboard/admin-tasks/use-admin-task-submission-media.ts](../../../components/dashboard/admin-tasks/use-admin-task-submission-media.ts) | 已审保留：已通过附件批量读取；预览状态；下载及失败反馈 |
| [components/dashboard/admin-tasks/use-admin-task-type-management-dialog.ts](../../../components/dashboard/admin-tasks/use-admin-task-type-management-dialog.ts) | 已审拆分：类型草稿与校验；目录列表状态；保存停用与反馈 |
| [components/dashboard/admin-tasks/use-admin-tasks-route-state.ts](../../../components/dashboard/admin-tasks/use-admin-tasks-route-state.ts) | 已审拆分：筛选草稿及地址同步；列表分页；工作台刷新 |
| [components/dashboard/admin-tasks/use-admin-tasks-view-model.ts](../../../components/dashboard/admin-tasks/use-admin-tasks-view-model.ts) | 已审保留：任务路由和弹窗调度；页面刷新与反馈 |
| [components/dashboard/commission/admin-commission-client.tsx](../../../components/dashboard/commission/admin-commission-client.tsx) | 已审保留：组装管理看板；呈现无权限状态 |
| [components/dashboard/commission/admin-commission-filters-section.tsx](../../../components/dashboard/commission/admin-commission-filters-section.tsx) | 已审保留：渲染关键词和高级条件；展示当前条件与清除入口 |
| [components/dashboard/commission/admin-commission-header.tsx](../../../components/dashboard/commission/admin-commission-header.tsx) | 已审保留：展示管理佣金标题 |
| [components/dashboard/commission/admin-commission-record-sections.tsx](../../../components/dashboard/commission/admin-commission-record-sections.tsx) | 已审拆分：展示分页订单佣金；发出筛选与结算动作 |
| [components/dashboard/commission/admin-commission-record-utils.tsx](../../../components/dashboard/commission/admin-commission-record-utils.tsx) | 已审拆分：声明明细表与分页输入；统一详情行和状态色 |
| [components/dashboard/commission/admin-commission-sections.tsx](../../../components/dashboard/commission/admin-commission-sections.tsx) | 已审拆分：导出管理看板的三个展示区块 |
| [components/dashboard/commission/admin-commission-view-model.ts](../../../components/dashboard/commission/admin-commission-view-model.ts) | 已审拆分：声明筛选及汇总类型；筛选已加载订单佣金；按受益人汇总金额和记录 |
| [components/dashboard/commission/admin-task-commission-section.tsx](../../../components/dashboard/commission/admin-task-commission-section.tsx) | 已审拆分：展示任务佣金、受益人和审核人；发出待结算任务操作 |
| [components/dashboard/commission/commission-beneficiary-summary-section.tsx](../../../components/dashboard/commission/commission-beneficiary-summary-section.tsx) | 已审拆分：展示受益人聚合记录与金额；发出受益人下钻 |
| [components/dashboard/commission/commission-board-switch.tsx](../../../components/dashboard/commission/commission-board-switch.tsx) | 已审保留：把佣金看板选项映射为通用标签页 |
| [components/dashboard/commission/commission-display.ts](../../../components/dashboard/commission/commission-display.ts) | 已审拆分：格式化人民币；转换业务枚举与来源说明；将失败转成日常文案 |
| [components/dashboard/commission/salesman-commission-client.tsx](../../../components/dashboard/commission/salesman-commission-client.tsx) | 已审保留：组装个人佣金看板；呈现无权限状态 |
| [components/dashboard/commission/salesman-commission-records-section.tsx](../../../components/dashboard/commission/salesman-commission-records-section.tsx) | 已审拆分：展示个人订单佣金或空状态；连接分页操作 |
| [components/dashboard/commission/salesman-task-commission-section.tsx](../../../components/dashboard/commission/salesman-task-commission-section.tsx) | 已审拆分：展示个人任务佣金或空状态 |
| [components/dashboard/commission/use-admin-commission-filters.ts](../../../components/dashboard/commission/use-admin-commission-filters.ts) | 已审拆分：维护筛选与交互状态；编排筛选选项、结果和受益人汇总 |
| [components/dashboard/commission/use-admin-commission-view-model.tsx](../../../components/dashboard/commission/use-admin-commission-view-model.tsx) | 已审拆分：同步管理看板快照与错误状态；调度看板、筛选与分页；连接结算动作和保存后刷新 |
| [components/dashboard/commission/use-managed-commission-settlement.ts](../../../components/dashboard/commission/use-managed-commission-settlement.ts) | 已审拆分：编排确认、写入与看板刷新；管理进行中状态和反馈 |
| [components/dashboard/commission/use-salesman-commission-view-model.tsx](../../../components/dashboard/commission/use-salesman-commission-view-model.tsx) | 已审保留：刷新个人佣金快照与提示；生成切换选项并管理分页 |
| [components/dashboard/salesman-tasks/salesman-task-list-filters.ts](../../../components/dashboard/salesman-tasks/salesman-task-list-filters.ts) | 已审拆分：任务状态栏目筛选；任务文本检索 |
| [components/dashboard/salesman-tasks/salesman-task-submit-dialog.tsx](../../../components/dashboard/salesman-tasks/salesman-task-submit-dialog.tsx) | 已审保留：提交审核表单展示；选中文件列表展示 |
| [components/dashboard/salesman-tasks/salesman-tasks-client.tsx](../../../components/dashboard/salesman-tasks/salesman-tasks-client.tsx) | 已审拆分：任务看板组装；筛选和分页控件接线；提审弹窗接线 |
| [components/dashboard/salesman-tasks/salesman-tasks-ui.tsx](../../../components/dashboard/salesman-tasks/salesman-tasks-ui.tsx) | 已审保留：任务卡片信息；附件操作入口；领取与提审入口 |
| [components/dashboard/salesman-tasks/use-salesman-task-review-dialog.ts](../../../components/dashboard/salesman-tasks/use-salesman-task-review-dialog.ts) | 已审拆分：弹窗与重复提交控制；草稿及材料调度；结果反馈 |
| [components/dashboard/salesman-tasks/use-salesman-tasks-page.ts](../../../components/dashboard/salesman-tasks/use-salesman-tasks-page.ts) | 已审拆分：列表路由状态与分页；任务及附件交互；审核弹窗调度 |
| [components/dashboard/tasks/task-form-validation.ts](../../../components/dashboard/tasks/task-form-validation.ts) | 已审拆分：解析佣金和人数输入；校验创建、编辑与改派草稿 |
| [components/dashboard/tasks/task-ui.tsx](../../../components/dashboard/tasks/task-ui.tsx) | 已审保留：任务搜索和筛选控件；状态与范围标签；任务统计展示 |
| [components/dashboard/tasks/tasks-display.ts](../../../components/dashboard/tasks/tasks-display.ts) | 已审拆分：映射任务状态、范围、角色和人员标签；展示进度、附件与审核要求；格式化任务奖励 |
| [components/dashboard/tasks/tasks-error-messages.ts](../../../components/dashboard/tasks/tasks-error-messages.ts) | 已审保留：管理员任务错误文案；执行人员任务错误文案 |
| [components/dashboard/team-management/team-management-client.tsx](../../../components/dashboard/team-management/team-management-client.tsx) | 已审保留：团队页面组装 |
| [components/dashboard/team-management/team-management-display.ts](../../../components/dashboard/team-management/team-management-display.ts) | 已审保留：人员与团队标签；错误文案映射 |
| [components/dashboard/team-management/team-management-roster-sections.tsx](../../../components/dashboard/team-management/team-management-roster-sections.tsx) | 已审保留：成员列表；候选列表；客户列表 |
| [components/dashboard/team-management/team-management-section-styles.ts](../../../components/dashboard/team-management/team-management-section-styles.ts) | 已审保留：团队区块样式 |
| [components/dashboard/team-management/team-management-sections.tsx](../../../components/dashboard/team-management/team-management-sections.tsx) | 已审保留：团队区块导出 |
| [components/dashboard/team-management/team-management-state-sections.tsx](../../../components/dashboard/team-management/team-management-state-sections.tsx) | 已审保留：顶部状态及刷新入口；团队设置表单；无权限及空状态 |
| [components/dashboard/team-management/team-management-summary-sections.tsx](../../../components/dashboard/team-management/team-management-summary-sections.tsx) | 已审保留：团队概览；详情表单；团队指标 |
| [components/dashboard/team-management/team-management-ui.tsx](../../../components/dashboard/team-management/team-management-ui.tsx) | 已审保留：名单卡片；分区标题及搜索控件；指标展示 |
| [components/dashboard/team-management/team-management-utils.ts](../../../components/dashboard/team-management/team-management-utils.ts) | 已审保留：成员候选人与客户检索 |
| [components/dashboard/team-management/team-management-view-model-shared.ts](../../../components/dashboard/team-management/team-management-view-model-shared.ts) | 已审拆分：服务端快照标识；团队初始数据及草稿；局部读回合并 |
| [components/dashboard/team-management/use-team-management-actions.ts](../../../components/dashboard/team-management/use-team-management-actions.ts) | 已审拆分：团队写入；成员关系写入；会话刷新及写后调度 |
| [components/dashboard/team-management/use-team-management-refresh.ts](../../../components/dashboard/team-management/use-team-management-refresh.ts) | 已审拆分：读取选中团队；手动与同步读取；读取失败反馈 |
| [components/dashboard/team-management/use-team-management-view-model.ts](../../../components/dashboard/team-management/use-team-management-view-model.ts) | 已审拆分：快照与草稿管理；可见列表计算；读写交互调度 |
| [components/dashboard/tourism-people/tourism-customers-client.tsx](../../../components/dashboard/tourism-people/tourism-customers-client.tsx) | 已审保留：客户目录组装；客户详情与开通弹窗接线 |
| [components/dashboard/tourism-people/tourism-people-client.tsx](../../../components/dashboard/tourism-people/tourism-people-client.tsx) | 已审保留：推广人员目录组装；详情弹窗接线 |
| [components/dashboard/tourism-people/tourism-people-display.ts](../../../components/dashboard/tourism-people/tourism-people-display.ts) | 已审拆分：旅游岗位与客户范围判定；共享目录筛选；人员显示格式 |
| [components/dashboard/tourism-people/tourism-people-table.tsx](../../../components/dashboard/tourism-people/tourism-people-table.tsx) | 已审保留：桌面表格与手机卡片；人员标签；空列表 |
| [components/dashboard/tourism-people/tourism-person-details.tsx](../../../components/dashboard/tourism-people/tourism-person-details.tsx) | 已审保留：人员详情展示 |
| [components/dashboard/tourism-people/use-tourism-customers-state.ts](../../../components/dashboard/tourism-people/use-tourism-customers-state.ts) | 已审拆分：目录筛选状态；客户弹窗状态；开通业务及反馈 |
| [components/dashboard/tourism-people/use-tourism-people-view-model.ts](../../../components/dashboard/tourism-people/use-tourism-people-view-model.ts) | 已审拆分：推广人员范围与筛选；选中详情状态 |
| [lib/admin-commission-normalizers.ts](../../../lib/admin-commission-normalizers.ts) | 已审拆分：声明原始记录与页面行；转换金额、时间和关联人员字段 |
| [lib/admin-commission.ts](../../../lib/admin-commission.ts) | 已审拆分：核对活跃管理或财务会话；查询订单佣金与关联信息；并行组装订单和任务看板 |
| [lib/admin-task-assignees.ts](../../../lib/admin-task-assignees.ts) | 已审保留：领取者列表；用户信息关联；按任务聚合排序 |
| [lib/admin-task-attachments.ts](../../../lib/admin-task-attachments.ts) | 已审拆分：任务附件读取；文件上传登记；对象清理及上传补偿 |
| [lib/admin-task-deletion.ts](../../../lib/admin-task-deletion.ts) | 已审拆分：删除凭证及独立读回；附件清理调度及结果 |
| [lib/admin-task-media-library-downloads.ts](../../../lib/admin-task-media-library-downloads.ts) | 已审保留：媒体库附件签名与下载适配 |
| [lib/admin-task-media-library-normalizers.ts](../../../lib/admin-task-media-library-normalizers.ts) | 已审保留：轮次及任务归一化；媒体项目装配；媒体类型和排序时间 |
| [lib/admin-task-media-library-types.ts](../../../lib/admin-task-media-library-types.ts) | 已审保留：定义 AdminTaskMediaLibraryKind、AdminTaskMediaLibraryItem 等7项同模块类型合同 |
| [lib/admin-task-media-library.ts](../../../lib/admin-task-media-library.ts) | 已审保留：会话准入；已通过轮次及关联资料读取；媒体列表装配 |
| [lib/admin-task-mutations.ts](../../../lib/admin-task-mutations.ts) | 已审拆分：任务创建及更新；改派凭证核对 |
| [lib/admin-task-normalizers.ts](../../../lib/admin-task-normalizers.ts) | 已审保留：任务记录及状态归一化；附件登记归一化；角色和关联目录映射 |
| [lib/admin-task-query-fields.ts](../../../lib/admin-task-query-fields.ts) | 已审保留：任务列表查询字段 |
| [lib/admin-task-reviews.ts](../../../lib/admin-task-reviews.ts) | 已审保留：管理员审核看板准入及初值 |
| [lib/admin-task-route.ts](../../../lib/admin-task-route.ts) | 已审拆分：任务 URL 解析和生成；筛选草稿合并 |
| [lib/admin-task-submission-media.ts](../../../lib/admin-task-submission-media.ts) | 已审保留：通过轮次及附件读取；媒体读模型组装；媒体签名及下载 |
| [lib/admin-task-type-management.ts](../../../lib/admin-task-type-management.ts) | 已审拆分：任务类型目录查询；类型写入与独立凭证核对 |
| [lib/admin-tasks-types.ts](../../../lib/admin-tasks-types.ts) | 已审保留：任务读写类型和角色常量 |
| [lib/admin-tasks.ts](../../../lib/admin-tasks.ts) | 已审拆分：管理员看板会话准入；任务列表读取和关系装配 |
| [lib/commission-settlement.ts](../../../lib/commission-settlement.ts) | 已审拆分：调用对应结算函数；独立核对结算记录 |
| [lib/salesman-commission.ts](../../../lib/salesman-commission.ts) | 已审保留：判断员工查看资格；加载本人订单与任务佣金 |
| [lib/salesman-task-actions.ts](../../../lib/salesman-task-actions.ts) | 已审拆分：领取和完成函数调用；任务附件签名 |
| [lib/salesman-task-data.ts](../../../lib/salesman-task-data.ts) | 已审拆分：任务主记录读取与归一化；任务附件读取 |
| [lib/salesman-task-route.ts](../../../lib/salesman-task-route.ts) | 已审拆分：URL 参数解析；URL 参数生成 |
| [lib/salesman-tasks.ts](../../../lib/salesman-tasks.ts) | 已审拆分：会话准入；执行看板数据读取；任务行与领取记录合并 |
| [lib/task-acceptance-summary.ts](../../../lib/task-acceptance-summary.ts) | 已审保留：按任务读取领取及完成统计 |
| [lib/task-acceptances.ts](../../../lib/task-acceptances.ts) | 已审保留：按任务或本人读取领取关系；领取行归一化 |
| [lib/task-attachment-policy.ts](../../../lib/task-attachment-policy.ts) | 已审保留：附件规格校验；对象路径生成；按桶核对删除 |
| [lib/task-commission-normalizers.ts](../../../lib/task-commission-normalizers.ts) | 已审保留：解码任务佣金记录；合成任务佣金展示行 |
| [lib/task-commission-related-data.ts](../../../lib/task-commission-related-data.ts) | 已审保留：查询佣金对应类型与团队名称 |
| [lib/task-commission-types.ts](../../../lib/task-commission-types.ts) | 已审保留：定义 TaskCommissionSettlementStatus、TaskCommissionActor 等4项同模块类型合同 |
| [lib/task-commissions.ts](../../../lib/task-commissions.ts) | 已审保留：读取有界任务佣金记录；编排关联数据与行转换 |
| [lib/task-review-assets.ts](../../../lib/task-review-assets.ts) | 已审保留：提审文件校验及登记；附件读取及下载；对象清理 |
| [lib/task-review-decisions.ts](../../../lib/task-review-decisions.ts) | 已审拆分：传递准确审核轮次；核对写入凭证及独立读回 |
| [lib/task-review-draft-mutations.ts](../../../lib/task-review-draft-mutations.ts) | 已审拆分：草稿创建和回执归一化；草稿取消及读回；发起提审 |
| [lib/task-review-submission-flow.ts](../../../lib/task-review-submission-flow.ts) | 已审拆分：提审请求与记录读回；取消确认与附件补偿 |
| [lib/task-reviews.ts](../../../lib/task-reviews.ts) | 已审拆分：待审记录查询及归一化；待审附件装配 |
| [lib/task-storage-cleanup.ts](../../../lib/task-storage-cleanup.ts) | 已审拆分：读取任务与提审清单；归一化去重；按分组核对对象删除 |
| [lib/task-target-roles.ts](../../../lib/task-target-roles.ts) | 已审拆分：按任务读取目标角色；角色行归一化 |
| [lib/team-management-mutations.ts](../../../lib/team-management-mutations.ts) | 已审保留：团队主记录写入；成员关联写入；函数错误及编号处理 |
| [lib/team-management-normalizers.ts](../../../lib/team-management-normalizers.ts) | 已审保留：团队概览归一化；详情名单归一化；候选人归一化 |
| [lib/team-management-queries.ts](../../../lib/team-management-queries.ts) | 已审保留：会话与入口条件；团队概览和详情读取；候选人读取 |
| [lib/team-management-types.ts](../../../lib/team-management-types.ts) | 已审保留：团队页面数据类型 |
| [lib/team-management.ts](../../../lib/team-management.ts) | 已审保留：团队领域导出 |
