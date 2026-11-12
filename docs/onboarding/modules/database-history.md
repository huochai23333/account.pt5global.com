# 数据库迁移与回滚资料

当前范围：历史源文件。

## 业务与阅读顺序

保存按时间应用的数据库变更源文件及专用回滚资料。

数据流：按版本排序的迁移 → 本地实际数据库 → 表/函数/RLS → Web 与 Edge 调用。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

数据库函数与 RLS 是最终业务边界；历史定义不等于当前生效定义。

完成依据：迁移版本集合、实际函数与授权和事务 SQL 断言一致。

## 常见维护

不重写已发布迁移；修复通过 CLI 新建迁移，先在 Docker 验证。

验证入口：本地迁移集合核对、db lint 和受影响 SQL 测试。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：本模块未发现字面量函数调用，沿服务导入继续追踪。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。


## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Supabase

| 文件 | 阅读重点 |
| --- | --- |
| [supabase/migrations/000_reset_public.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/000_reset_public.sql) | 已审保留：清理 Auth 的业务触发器；清理早期 public 的非扩展关系和函数；移除早期枚举与域 |
| [supabase/migrations/001_tables.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/001_tables.sql) | 已审保留：建立账号档案与角色字典；建立推荐、团队和 VIP 关系；建立隐私资料及申请结构 |
| [supabase/migrations/002_rls.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/002_rls.sql) | 已审保留：为基础表启用行级权限；按操作限制账号状态；允许符合角色、本人或团队范围的访问 |
| [supabase/migrations/003_functions.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/003_functions.sql) | 已审保留：安装注册与推荐码函数；安装账号同步及隐私申请触发器；从数据库构造访问令牌字段 |
| [supabase/migrations/004_auth_hook.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/004_auth_hook.sql) | 已审保留：限制访问令牌钩子的执行角色 |
| [supabase/migrations/005_fix_function_names.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/005_fix_function_names.sql) | 已审保留：恢复标准账号和隐私触发器绑定；清理历史命名的触发器与函数；重申钩子授权 |
| [supabase/migrations/006_fix_user_profiles_own_role_gate.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/006_fix_user_profiles_own_role_gate.sql) | 已审保留：替换本人档案的插入与读取策略 |
| [supabase/migrations/20240304133500_remote_baseline.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20240304133500_remote_baseline.sql) | 已审保留：记录历史对齐版本 |
| [supabase/migrations/20260308153100_use_user_metadata_phone_on_signup.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260308153100_use_user_metadata_phone_on_signup.sql) | 已审保留：选取注册电话来源；同步 Auth 后续电话变动 |
| [supabase/migrations/20260308170500_rename_operator_user_id_to_reviewer_user_id.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260308170500_rename_operator_user_id_to_reviewer_user_id.sql) | 已审保留：按实际结构改名隐私审核人列 |
| [supabase/migrations/20260308174500_privacy_review_workflow.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260308174500_privacy_review_workflow.sql) | 已审保留：建立待审视图；处理通过与拒绝的事务；声明视图及审核函数授权 |
| [supabase/migrations/20260308180000_activate_user_on_privacy_approval.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260308180000_activate_user_on_privacy_approval.sql) | 已审保留：保留通过时激活 inactive 账号的审核函数定义 |
| [supabase/migrations/20260323103000_user_media_assets.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260323103000_user_media_assets.sql) | 已审保留：登记私有媒体与对象路径并设置行级策略；建立媒体审核状态与清理期限；登记受限的后台清理任务 |
| [supabase/migrations/20260330163000_order_management_tables_and_rls.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260330163000_order_management_tables_and_rls.sql) | 已审保留：建立早期订单总表与采购、服务子表；建立订单字典及汇率记录；定义按角色、本人和推荐范围的 RLS |
| [supabase/migrations/20260331150000_add_order_remark_to_order_overview.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260331150000_add_order_remark_to_order_overview.sql) | 已审保留：增加普通订单备注列 |
| [supabase/migrations/20260331173000_drop_order_remark_from_order_overview.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260331173000_drop_order_remark_from_order_overview.sql) | 已审保留：移除曾加入的普通订单备注列 |
| [supabase/migrations/20260401120000_relate_order_children_by_overview_id.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260401120000_relate_order_children_by_overview_id.sql) | 已审保留：回填采购和服务明细的总表 UUID；重建主键、外键及旧列；切换子表的权限关联键 |
| [supabase/migrations/20260401143000_add_order_number_generation.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260401143000_add_order_number_generation.sql) | 已审保留：创建并保护每日计数表；按上海日期分配订单号 |
| [supabase/migrations/20260401160000_add_admin_order_save_rpc.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260401160000_add_admin_order_save_rpc.sql) | 已审保留：校验订单并创建或更新总表；按业务类型替换明细；声明保存入口与内部函数授权 |
| [supabase/migrations/20260402103000_implement_order_helper_rules.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260402103000_implement_order_helper_rules.sql) | 已审保留：引入身份、团队及订单范围帮助函数；更新总表和子表的行级策略；建立范围内的订单保存删除与人员选项 |
| [supabase/migrations/20260402150000_rename_order_functions_remove_admin_prefix.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260402150000_rename_order_functions_remove_admin_prefix.sql) | 已审保留：改名保存与明细替换函数；重写引用并维持授权 |
| [supabase/migrations/20260402173000_auto_manage_order_timestamps.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260402173000_auto_manage_order_timestamps.sql) | 已审保留：移除保存入口的外部时间参数；由数据库记录创建与复核时间 |
| [supabase/migrations/20260402193000_add_referral_tree_access_and_rpc.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260402193000_add_referral_tree_access_and_rpc.sql) | 已审保留：为推荐关系两端提供查询索引；按角色和关系约束读取；返回带关系来源的推荐树边 |
| [supabase/migrations/20260402210000_add_recruiter_role_and_permissions.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260402210000_add_recruiter_role_and_permissions.sql) | 已审保留：登记招聘岗位；为招聘推荐码设置默认目标；补充本人资料与媒体权限 |
| [supabase/migrations/20260403143000_team_management_helpers_and_dashboard_rpc.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260403143000_team_management_helpers_and_dashboard_rpc.sql) | 已审保留：解析经理的团队与关联成员；更新团队资料及媒体的读取范围；实现概览、详情和经理成员操作 |
| [supabase/migrations/20260403162000_admin_team_management_controls.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260403162000_admin_team_management_controls.sql) | 已审保留：校验管理目标及成员候选；保存与删除团队；添加与移除团队成员 |
| [supabase/migrations/20260407113000_task_module_base.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260407113000_task_module_base.sql) | 已审保留：建立任务和附件的结构约束；在行锁下处理首次领取和完成；设置角色行级策略及私有对象路径 |
| [supabase/migrations/20260408111500_fix_task_helper_function_grants.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260408111500_fix_task_helper_function_grants.sql) | 已审保留：补齐登录角色使用任务策略帮助函数的执行权 |
| [supabase/migrations/20260408152000_add_internal_order_costs.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260408152000_add_internal_order_costs.sql) | 已审保留：按订单 UUID 存储内部成本；按角色与订单范围控制成本访问；在订单保存事务内设值、保留或清除成本 |
| [supabase/migrations/20260409110000_commission_center_single_vip.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260409110000_commission_center_single_vip.sql) | 已审保留：冻结完成订单的交易汇率；预览并同步订单佣金快照；从充值订单重算唯一会员档案 |
| [supabase/migrations/20260422183000_add_task_review_workflow.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260422183000_add_task_review_workflow.sql) | 已审保留：定义审核轮次和私有附件；领取人保存草稿并提交；管理员审核与任务状态同步 |
| [supabase/migrations/20260423103000_add_task_type_and_task_commissions.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260423103000_add_task_type_and_task_commissions.sql) | 已审保留：维护任务类型与建议金额；按通过的任务写入一笔佣金；审核函数触发佣金同步 |
| [supabase/migrations/20260423143000_lock_completed_tasks_from_updates.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260423143000_lock_completed_tasks_from_updates.sql) | 已审保留：拦截已完成任务更新和删除 |
| [supabase/migrations/20260423150000_use_auth_helpers_for_policies_and_review_rpcs.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260423150000_use_auth_helpers_for_policies_and_review_rpcs.sql) | 已审保留：归一策略身份判断；统一隐私和媒体审核的角色来源；迁移结束前检查残留的直接身份读取 |
| [supabase/migrations/20260423162000_restrict_completed_task_mutations_to_admin.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260423162000_restrict_completed_task_mutations_to_admin.sql) | 已审保留：给管理员保留已完成任务维护入口 |
| [supabase/migrations/20260423190000_make_commissions_pending_until_manual_settlement.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260423190000_make_commissions_pending_until_manual_settlement.sql) | 已审保留：区分历史系统自动入账和人工结算；让新订单与任务佣金以待结算生成；提供任务佣金人工结算入口 |
| [supabase/migrations/20260427120000_add_announcements.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260427120000_add_announcements.sql) | 已审保留：定义公告状态和受众；记录发布与创建元数据；控制管理员维护和读者可见范围 |
| [supabase/migrations/20260428100000_add_profile_change_requests_and_announcement_reads.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260428100000_add_profile_change_requests_and_announcement_reads.sql) | 已审保留：登记公告已读并提供公开读取；保存资料变更申请；读取待审申请及完成审核 |
| [supabase/migrations/20260428140000_add_admin_people_management.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260428140000_add_admin_people_management.sql) | 已审保留：查询管理目录与变更日志；预检角色和账号状态；更新档案、角色并写日志 |
| [supabase/migrations/20260506100000_exchange_rate_sync_and_order_lock.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260506100000_exchange_rate_sync_and_order_lock.sql) | 已审保留：记录每日汇率及同步配置；首次建单冻结数据库报价；登记历史汇率派发 |
| [supabase/migrations/20260506113000_add_workspace_feedback.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260506113000_add_workspace_feedback.sql) | 已审保留：建立反馈记录与处理状态；验证提交并记录会话信息；允许管理员处理并写入操作人 |
| [supabase/migrations/20260507110000_add_user_media_image_ai_review.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260507110000_add_user_media_image_ai_review.sql) | 已审保留：区分媒体人工和系统审核状态；回填和排队待审图片；登记计划任务和受控派发入口 |
| [supabase/migrations/20260511103000_role_targeted_tasks_and_type_management.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260511103000_role_targeted_tasks_and_type_management.sql) | 已审保留：清除旧任务、审核及附件记录；按内部角色派发任务和控制附件访问；管理任务类型及建议奖励 |
| [supabase/migrations/20260513110000_fix_admin_role_changes_and_signup_invites.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260513110000_fix_admin_role_changes_and_signup_invites.sql) | 已审保留：向注册页返回邀请码校验分类；账号角色修改时同步邀请码目标 |
| [supabase/migrations/20260513143000_task_multi_acceptance.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260513143000_task_multi_acceptance.sql) | 已审保留：为模板配置容量与岗位；以个人副本登记领取；按模板汇总已领取与已完成数 |
| [supabase/migrations/20260514100000_order_categories_and_salesman_customer_marks.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260514100000_order_categories_and_salesman_customer_marks.sql) | 已审保留：清理旧订单并区分代发分类；按分类维护订单明细与佣金；维护直属客户类型和目录 |
| [supabase/migrations/20260514110000_salesman_business_access.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260514110000_salesman_business_access.sql) | 已审保留：建立岗位业务授权和管理入口；按分类限制订单读写；按授权限制客户目录和标记 |
| [supabase/migrations/20260514113000_salesman_order_user_scope_fix.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260514113000_salesman_order_user_scope_fix.sql) | 已审保留：拒绝缺分类的业务员订单读取；用订单分类和人物关系推导下拉名单 |
| [supabase/migrations/20260514114000_salesman_business_access_conflict_fix.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260514114000_salesman_business_access_conflict_fix.sql) | 已审保留：修正业务授权的更新与去重写入 |
| [supabase/migrations/20260515102000_admin_customer_type_marks.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260515102000_admin_customer_type_marks.sql) | 已审保留：回填真实标记人；允许业务员和管理员更新客户分类；管理目录展示实际操作人 |
| [supabase/migrations/20260515113000_business_referrals_by_board.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260515113000_business_referrals_by_board.sql) | 已审保留：建立业务推荐表并导入两类旧关系；按角色提供业务板推荐目录；让订单和客户标记使用分板关系 |
| [supabase/migrations/20260515120000_move_referrals_fully_to_business_referrals.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260515120000_move_referrals_fully_to_business_referrals.sql) | 已审保留：切换注册及客户标记写入；迁移团队、佣金与关联权限读取；移除旧推荐表及函数 |
| [supabase/migrations/20260515143000_board_aware_referral_codes.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260515143000_board_aware_referral_codes.sql) | 已审保留：按持码人业务范围解释邀请码；将注册关系和邀请码用量写入同一事务；查询业务板与自助绑定 |
| [supabase/migrations/20260515165000_parse_board_from_referral_code.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260515165000_parse_board_from_referral_code.sql) | 已审保留：标准化带后缀邀请码并解析业务板；让校验及内部注册写入复用解析 |
| [supabase/migrations/20260519103000_task_review_attachment_requirement.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260519103000_task_review_attachment_requirement.sql) | 已审保留：保留旧任务的附件要求；维护并复制模板的附件配置；按配置验证提交证据 |
| [supabase/migrations/20260519114500_fix_plpgsql_lint_warnings.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260519114500_fix_plpgsql_lint_warnings.sql) | 已审保留：整理邀请码生成及校验；维持团队与任务角色条件；维持订单保存合同 |
| [supabase/migrations/20260519152000_use_latest_exchange_rate_for_orders.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260519152000_use_latest_exchange_rate_for_orders.sql) | 已审保留：优先读取上海当天报价并按时间降序选取 |
| [supabase/migrations/20260519170000_order_service_fee_settings.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260519170000_order_service_fee_settings.sql) | 已审保留：回填并维护订单服务费档；按服务费快照计算订单佣金；费用变动触发订单佣金同步 |
| [supabase/migrations/20260519173000_auto_order_rmb_amount.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260519173000_auto_order_rmb_amount.sql) | 已审保留：从数据库报价计算新单人民币金额；使用既有锁汇计算更新金额；保持明细、成本及派生记录的保存 |
| [supabase/migrations/20260519190000_refactor_task_acceptances.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260519190000_refactor_task_acceptances.sql) | 已审保留：把个人任务迁为独立领取并改挂关联；调整领取、草稿、审核和佣金函数；重建任务可见范围和待审核视图 |
| [supabase/migrations/20260520113000_service_fee_tier_settings.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260520113000_service_fee_tier_settings.sql) | 已审保留：把比例档改为有业务板和唯一编码的目录；保留手工档并补标准档与约束 |
| [supabase/migrations/20260520143000_auto_match_order_service_fees.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260520143000_auto_match_order_service_fees.sql) | 已审保留：根据订单、会员和近月金额决定费用档；为新旧总单和服务明细写入匹配档；按费用变动同步订单佣金 |
| [supabase/migrations/20260520152000_preview_order_service_fee_type.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260520152000_preview_order_service_fee_type.sql) | 已审保留：计算订单提交前的预期费用档 |
| [supabase/migrations/20260520165000_rename_service_fee_tiers.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260520165000_rename_service_fee_tiers.sql) | 已审保留：按费用编码归一展示名称和说明 |
| [supabase/migrations/20260521110000_split_vip_recharge_memberships.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260521110000_split_vip_recharge_memberships.sql) | 已审保留：拆分会员、充值请求和服务价格档；按业务范围完成充值及佣金和会员期限；同步费用与人员目录的读取入口 |
| [supabase/migrations/20260521123000_secure_internal_job_request_secrets.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260521123000_secure_internal_job_request_secrets.sql) | 已审保留：收紧后台请求配置表的读取和写入权限 |
| [supabase/migrations/20260522100000_commission_rule_settings.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260522100000_commission_rule_settings.sql) | 已审保留：配置结构与初始规则；配置角色权限；佣金公式与快照 |
| [supabase/migrations/20260522103000_service_order_price_costs.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260522103000_service_order_price_costs.sql) | 已审保留：服务价格档成本列和回填 |
| [supabase/migrations/20260522104000_clamp_digital_survival_commission.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260522104000_clamp_digital_survival_commission.sql) | 已审保留：亏损时佣金保底为零 |
| [supabase/migrations/20260522105000_admin_people_account_city.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260522105000_admin_people_account_city.sql) | 已审保留：账号变更预览；加锁提交与审计；历史查询 |
| [supabase/migrations/20260526110000_user_todo_items.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260526110000_user_todo_items.sql) | 已审保留：待办结构与本人行级策略；创建、更新与删除；完成时间维护 |
| [supabase/migrations/20260603120000_user_home_widget_layouts.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260603120000_user_home_widget_layouts.sql) | 已审保留：用户范围内的布局结构；保存及同范围覆盖 |
| [supabase/migrations/20260603143000_hide_unverified_admin_people.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260603143000_hide_unverified_admin_people.sql) | 已审保留：管理员人员目录聚合与过滤 |
| [supabase/migrations/20260610110000_person_private_notes.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260610110000_person_private_notes.sql) | 已审保留：备注表与本人行级权限；可见目标校验及保存；目录拼接本人备注 |
| [supabase/migrations/20260610120000_add_promoter_role.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260610120000_add_promoter_role.sql) | 已审保留：推广员角色与岗位策略；业务入口的销售岗位范围；团队成员与令牌角色同步 |
| [supabase/migrations/20260610123000_convert_salesmen_to_promoters.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260610123000_convert_salesmen_to_promoters.sql) | 已审保留：收集待转换账号；同步权威角色及 Auth 元数据；销售范围和推荐码目标对齐 |
| [supabase/migrations/20260611120000_remove_legacy_wholesale_business.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260611120000_remove_legacy_wholesale_business.sql) | 已审保留：旧批发业务数据清理；旅游模型映射与入口归一；后续写入的业务约束 |
| [supabase/migrations/20260611143000_workspace_business_access.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260611143000_workspace_business_access.sql) | 已审保留：工作台授权表与初始开通；管理员替换范围和读取入口；人员目录和行级权限 |
| [supabase/migrations/20260611162000_harden_workspace_business_access_rpc.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260611162000_harden_workspace_business_access_rpc.sql) | 已审保留：跨账号入口列表校验；跨账号单项权限判断 |
| [supabase/migrations/20260612110000_create_wholesale_business.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260612110000_create_wholesale_business.sql) | 已审保留：批发准入与业务表结构；订单金额和提成同步；采购认领、保护及行级策略 |
| [supabase/migrations/20260612153000_create_wholesale_order_rpc.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260612153000_create_wholesale_order_rpc.sql) | 已审保留：校验并创建批发订单 |
| [supabase/migrations/20260612154000_restrict_wholesale_order_direct_insert.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260612154000_restrict_wholesale_order_direct_insert.sql) | 已审保留：收紧订单直接插入权限 |
| [supabase/migrations/20260612161000_wholesale_order_settlement_status.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260612161000_wholesale_order_settlement_status.sql) | 已审保留：旧状态和时间回填；状态触发器与提成同步；订单创建及加锁结汇入口 |
| [supabase/migrations/20260613140000_role_default_workspace_business_access.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260613140000_role_default_workspace_business_access.sql) | 已审保留：岗位默认入口规则；显式配置与默认值读取；既有岗位配置回填 |
| [supabase/migrations/20260613143000_align_sales_staff_tourism_board_access.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260613143000_align_sales_staff_tourism_board_access.sql) | 已审保留：旅游销售范围与工作台入口对齐 |
| [supabase/migrations/20260613150000_link_wholesale_customer_registered_user.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260613150000_link_wholesale_customer_registered_user.sql) | 已审保留：客户关联和业务开通；可关联客户候选查询 |
| [supabase/migrations/20260614100000_add_wholesale_salesman_business_board.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260614100000_add_wholesale_salesman_business_board.sql) | 已审保留：批发销售范围枚举扩展 |
| [supabase/migrations/20260614101000_lock_salesman_promoter_business_scope.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260614101000_lock_salesman_promoter_business_scope.sql) | 已审保留：岗位固定范围与授权读取；管理员开通归一和历史回填；推荐业务范围及执行权限 |
| [supabase/migrations/20260614113000_harden_wholesale_write_scope.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260614113000_harden_wholesale_write_scope.sql) | 已审保留：客户、订单及关联范围守卫；保护关键归属字段；写入策略和函数执行权限 |
| [supabase/migrations/20260614114000_harden_wholesale_order_and_claim_rpcs.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260614114000_harden_wholesale_order_and_claim_rpcs.sql) | 已审保留：创建订单的目标权限；采购认领的客户与订单权限 |
| [supabase/migrations/20260614115000_harden_wholesale_customer_linking.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260614115000_harden_wholesale_customer_linking.sql) | 已审保留：客户账号关联入口；同范围候选列表 |
| [supabase/migrations/20260615110000_wholesale_1688_assisted_classification.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260615110000_wholesale_1688_assisted_classification.sql) | 已审保留：名称与别名匹配；按来源准备辅助与正式归属；保护来源字段 |
| [supabase/migrations/20260615123000_harden_admin_workspace_access.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260615123000_harden_admin_workspace_access.sql) | 已审保留：数据库优先角色和状态；当前用户访问上下文 |
| [supabase/migrations/20260615134000_signup_referral_business_access.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260615134000_signup_referral_business_access.sql) | 已审保留：推荐码规范与业务解析；建立推荐和业务授权；历史回填及执行权限 |
| [supabase/migrations/20260615143000_restrict_wholesale_workspace_access.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260615143000_restrict_wholesale_workspace_access.sql) | 已审保留：限制有效业务的读写权限；按岗位调整默认推荐目标；校正已有业务和推荐数据 |
| [supabase/migrations/20260616143000_business_vip_management.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260616143000_business_vip_management.sql) | 已审保留：建立分业务 VIP 记录与读取策略；办理会员审批和资格调整；提供 VIP 管理及人员目录投影 |
| [supabase/migrations/20260617170000_direct_wholesale_vip_management.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260617170000_direct_wholesale_vip_management.sql) | 已审保留：替换旧批发申请结构；直接开通续期与资格调整；聚合批发会员和历史 |
| [supabase/migrations/20260618143000_lock_wholesale_vip_fee_no_commission.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260618143000_lock_wholesale_vip_fee_no_commission.sql) | 已审保留：纠正并约束 VIP 年费；重申直接开通续期收费规则 |
| [supabase/migrations/20260618152000_wholesale_referral_monthly_commission_settings.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260618152000_wholesale_referral_monthly_commission_settings.sql) | 已审保留：校验批发推荐配置；登记比例与运单档位默认值 |
| [supabase/migrations/20260622153000_harden_public_function_execute_privileges.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260622153000_harden_public_function_execute_privileges.sql) | 已审保留：撤销既有内部函数匿名授权；声明登录与公开函数入口；设置未来函数默认授权 |
| [supabase/migrations/20260622160000_harden_anon_table_privileges.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260622160000_harden_anon_table_privileges.sql) | 已审保留：撤销现有匿名表与序列授权；撤销未来匿名表与序列默认授权 |
| [supabase/migrations/20260623164000_restore_authenticated_table_privileges.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260623164000_restore_authenticated_table_privileges.sql) | 已审保留：恢复登录表与序列标准授权；保留内部表及建单入口限制 |
| [supabase/migrations/20260623180000_wholesale_order_edit_workflow.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260623180000_wholesale_order_edit_workflow.sql) | 已审保留：建立编辑设置申请及审计结构；校验并应用订单编辑；调度申请审批拒绝与执行授权 |
| [supabase/migrations/20260624110000_wholesale_order_commission_rule_settings.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260624110000_wholesale_order_commission_rule_settings.sql) | 已审保留：建立批发提成配置及金额档位计算；保存订单提成比例；配置变更同步未结算订单 |
| [supabase/migrations/20260624113000_remove_purchase_commission_rule_settings.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260624113000_remove_purchase_commission_rule_settings.sql) | 已审保留：移除两项采购佣金配置；收紧配置校验器 |
| [supabase/migrations/20260629165000_finance_dual_business_access.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260629165000_finance_dual_business_access.sql) | 已审保留：固定财务双业务默认值；读取权威岗位与状态；回填既有业务授权 |
| [supabase/migrations/20260630110000_wholesale_settlement_exchange_rate_flow.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260630110000_wholesale_settlement_exchange_rate_flow.sql) | 已审保留：建立结汇时取汇率的金额状态；创建与编辑保留原始付款；确认结汇及带审计的改价 |
| [supabase/migrations/20260630162000_company_expenses_and_finance_wholesale_access.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260630162000_company_expenses_and_finance_wholesale_access.sql) | 已审保留：公司费用结构与字段元数据；财务和管理员费用权限；财务工作人员与业务范围收拢 |
| [supabase/migrations/20260702120000_wholesale_logistics_status_sync.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260702120000_wholesale_logistics_status_sync.sql) | 已审保留：物流状态镜像与索引；工作人员和客户行权限；内部派发与每日任务 |
| [supabase/migrations/20260702143000_auto_import_wholesale_logistics_statuses.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260702143000_auto_import_wholesale_logistics_statuses.sql) | 已审保留：空主库仍发现新物流；保留内部派发鉴权与授权 |
| [supabase/migrations/20260702152000_index_wholesale_logistics_status_list.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260702152000_index_wholesale_logistics_status_list.sql) | 已审保留：物流列表排序索引 |
| [supabase/migrations/20260706130000_wholesale_order_partial_settlements.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260706130000_wholesale_order_partial_settlements.sql) | 已审保留：结汇明细与历史回填；金额状态汇总触发器；受控新增及权限 |
| [supabase/migrations/20260706160000_wholesale_customer_edit_delete.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260706160000_wholesale_customer_edit_delete.sql) | 已审保留：客户可编辑范围；别名和字段归一；受控更新删除与授权 |
| [supabase/migrations/20260706173000_operator_reimbursements.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260706173000_operator_reimbursements.sql) | 已审保留：报销结构与周期；新增元数据与本人策略；当前周期确认及授权 |
| [supabase/migrations/20260708032448_wholesale_settlement_releases.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260708032448_wholesale_settlement_releases.sql) | 已审保留：发布结构与双向明细关联；发布撤销认领事务；角色及行权限 |
| [supabase/migrations/20260710074957_harden_pending_task_reviews.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260710074957_harden_pending_task_reviews.sql) | 已审保留：待审核安全视图；视图授权 |
| [supabase/migrations/20260710075000_api_request_quotas.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260710075000_api_request_quotas.sql) | 已审保留：私有事件与租约；原子额度申请；归属限定释放及授权 |
| [supabase/migrations/20260710081312_paginate_wholesale_orders.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260710081312_paginate_wholesale_orders.sql) | 已审保留：过滤与调用者范围；游标分页；全量汇总与返回合同 |
| [supabase/migrations/20260710084728_add_missing_foreign_key_indexes.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260710084728_add_missing_foreign_key_indexes.sql) | 已审保留：外键覆盖发现；受版本前提约束的索引创建 |
| [supabase/migrations/20260710084730_optimize_rls_initplans.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260710084730_optimize_rls_initplans.sql) | 已审保留：66条策略上下文提升；条件及检查保持 |
| [supabase/migrations/20260710084733_merge_permissive_policies.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260710084733_merge_permissive_policies.sql) | 已审保留：FOR ALL按动作展开；同角色操作OR合并；原分组数量守卫 |
| [supabase/migrations/20260710084736_harden_function_search_paths.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260710084736_harden_function_search_paths.sql) | 已审保留：24函数路径固定；客户更新函数整理 |
| [supabase/migrations/20260710110348_signup_business_wizard.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260710110348_signup_business_wizard.sql) | 已审保留：一次性注册输入与权威账号落库；既有客户业务准入及建档；推荐板读取与缺失档案回填 |
| [supabase/migrations/20260711033241_wholesale_order_list_attachments_and_client_scope.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260711033241_wholesale_order_list_attachments_and_client_scope.sql) | 已审保留：订单附件约束与登记；私有Storage目录与授权；客户订单范围及返回字段裁剪 |
| [supabase/migrations/20260713112555_salesman_wholesale_collaboration.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260713112555_salesman_wholesale_collaboration.sql) | 已审保留：人员资料可见与关联候选；已注册客户绑定；同事订单/批次/物流读取策略 |
| [supabase/migrations/20260713120157_salesman_wholesale_collaboration_helpers.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260713120157_salesman_wholesale_collaboration_helpers.sql) | 已审保留：协作范围与指派守卫；审计及采购源字段保护；采购认领处理 |
| [supabase/migrations/20260714025547_user_workspace_navigation_preferences.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260714025547_user_workspace_navigation_preferences.sql) | 已审保留：本人导航偏好及RLS；保存输入规范化与授权 |
| [supabase/migrations/20260714034654_wholesale_logistics_links_and_pages.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260714034654_wholesale_logistics_links_and_pages.sql) | 已审保留：订单关联与客户一致性；状态列表筛选分页；费用列表筛选分页 |
| [supabase/migrations/20260714095022_rebuild_wholesale_logistics_archive.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260714095022_rebuild_wholesale_logistics_archive.sql) | 已审保留：归档模型、读取及旧模型切换；店铺归属区间命令；归档写入、同步租约与派发 |
| [supabase/migrations/20260715082830_bulk_claim_wholesale_1688_orders.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260715082830_bulk_claim_wholesale_1688_orders.sql) | 已审保留：批量认领输入及权限；排序锁定与原子归属更新 |
| [supabase/migrations/20260715090626_wholesale_1688_claim_groups.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260715090626_wholesale_1688_claim_groups.sql) | 已审保留：分组模型、RLS及来源保护；组命令与软删除关系清理；订单查询经组关联采购 |
| [supabase/migrations/20260716033257_add_required_order_date_pages.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260716033257_add_required_order_date_pages.sql) | 已审保留：批发日期查询及既选候选回显；物流日期与精确查询；认领看板日期及客户投影 |
| [supabase/migrations/20260716081107_add_logistics_assignment_audit_indexes.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260716081107_add_logistics_assignment_audit_indexes.sql) | 已审保留：归属审计外键索引 |
| [supabase/migrations/20260722034630_add_historical_exchange_rate_backfill.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260722034630_add_historical_exchange_rate_backfill.sql) | 已审保留：历史补缺规范化及写入；并发唯一索引及服务端授权 |
| [supabase/migrations/20260722080345_ai_assistant_settlement_release.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260722080345_ai_assistant_settlement_release.sql) | 已审保留：发布请求幂等及内容一致；客户名匹配与权限 |
| [supabase/migrations/20260722094547_multi_order_settlement_release_allocations.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260722094547_multi_order_settlement_release_allocations.sql) | 已审保留：旧认领转换、分配模型与RLS；按版本替换方案及结汇凭证；清空撤销历史与授权 |
| [supabase/migrations/20260727041526_customer_inventory_orders_and_credit.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260727041526_customer_inventory_orders_and_credit.sql) | 已审保留：订单与金额终态；信贷生命周期；附件、审计及授权 |
| [supabase/migrations/20260728035431_add_inventory_order_items_and_reusable_credit.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260728035431_add_inventory_order_items_and_reusable_credit.sql) | 已审保留：商品归一化与原子维护；信贷来源和后台启用；审计及读取/执行授权 |
| [supabase/migrations/20260731041311_unify_finance_wholesale_permissions.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260731041311_unify_finance_wholesale_permissions.sql) | 已审保留：集中财务批发协作条件；按既有签名替换岗位门槛；补齐采购订单和人员读取 |
| [supabase/migrations/20260731041316_add_missing_foreign_key_indexes.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260731041316_add_missing_foreign_key_indexes.sql) | 已审保留：补齐外键引用侧普通索引 |
| [supabase/migrations/20260826034712_expand_exchange_rate_visibility_to_internal_staff.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260826034712_expand_exchange_rate_visibility_to_internal_staff.sql) | 已审保留：重建已激活岗位汇率SELECT策略 |
| [supabase/migrations/20260827081415_disable_legacy_tourism_business.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260827081415_disable_legacy_tourism_business.sql) | 已审保留：发布状态和默认入口；共享函数及导航守卫；表/Storage策略与函数授权切换 |
| [supabase/migrations/20260828093321_allow_configured_workspace_access_for_flexible_roles.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260828093321_allow_configured_workspace_access_for_flexible_roles.sql) | 已审保留：按岗位配置读取有效业务；管理员原子替换账号业务；重申函数调用授权 |
| [supabase/migrations/20260901035233_remove_wholesale_order_edit_approval.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260901035233_remove_wholesale_order_edit_approval.sql) | 已审保留：保留日志并移除审批依赖；受控直接订单修改；更新待结算并冻结已结算佣金 |
| [supabase/migrations/20260901044207_wholesale_order_creation_idempotency.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260901044207_wholesale_order_creation_idempotency.sql) | 已审保留：规范化创建输入；创建人和请求号防重；受控插入及接口授权 |
| [supabase/migrations/20260903070513_sales_lead_hall.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260903070513_sales_lead_hall.sql) | 已审保留：线索/来源模型及权限；领取周期与可见历史；后台导入及租约 |
| [supabase/migrations/20260904092545_refine_sales_lead_directory_identity.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260904092545_refine_sales_lead_directory_identity.sql) | 已审保留：目录网站身份归一化；已确认误并来源拆分；目录旧键更新 |
| [supabase/migrations/20260904102420_allow_admin_sales_lead_claim.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260904102420_allow_admin_sales_lead_claim.sql) | 已审保留：自领角色校验；行锁后的领取调度 |
| [supabase/migrations/20260907064823_sales_lead_customer_profile.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260907064823_sales_lead_customer_profile.sql) | 已审保留：公开画像字段；导入校验及写入 |
| [supabase/migrations/20260907073058_operator_reimbursement_sharing_and_periods.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260907073058_operator_reimbursement_sharing_and_periods.sql) | 已审保留：共享读取和完整汇总；按本人周期确认报销；公开包装及执行授权 |
| [supabase/migrations/20260914093538_add_verified_operation_runs.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260914093538_add_verified_operation_runs.sql) | 已审保留：运行模型及状态机；授权读取与告警；业务派发及历史报价协议 |
| [supabase/migrations/20260914120500_fix_sales_lead_claim_conflict_retry.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260914120500_fix_sales_lead_claim_conflict_retry.sql) | 已审保留：认领权限与行锁；确定冲突错误分类 |
| [supabase/migrations/20260915100000_allow_verified_attachment_cleanup.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260915100000_allow_verified_attachment_cleanup.sql) | 已审保留：批发附件孤立对象可见范围；库存附件孤立对象可见范围 |
| [supabase/migrations/20260915110000_fix_settlement_rate_repair_dispatch.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260915110000_fix_settlement_rate_repair_dispatch.sql) | 已审保留：真实收款及岗位约束；指定币种日期补齐调度 |
| [supabase/migrations/20260915120000_secure_private_rpc_wrappers.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260915120000_secure_private_rpc_wrappers.sql) | 已审保留：公开包装器进入私有实现；浏览器私有访问撤销 |
| [supabase/migrations/20260915130000_claim_user_media_image_review_attempt.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260915130000_claim_user_media_image_review_attempt.sql) | 已审保留：待审图片原子认领；尝试计数及旧结果清理 |
| [supabase/migrations/20260916044655_prevent_duplicate_operation_workers.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260916044655_prevent_duplicate_operation_workers.sql) | 已审保留：queued到running的领取；重复Worker拒绝 |
| [supabase/migrations/20260916045341_bind_operation_worker_attempt_number.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260916045341_bind_operation_worker_attempt_number.sql) | 已审保留：带代次开始及锁行；带代次心跳/完成；执行授权切换 |
| [supabase/migrations/20260917051713_monthly_settlement_allocated_usd.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260917051713_monthly_settlement_allocated_usd.sql) | 已审保留：岗位/RLS可见汇总；上海自然月归属；精确日期折美元及缺口 |
| [supabase/migrations/20260917063732_private_quotations.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260917063732_private_quotations.sql) | 已审保留：本人报价读取/写入；修订与完成状态；本人图片路径策略 |
| [supabase/migrations/20260917072606_quotation_idempotency.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260917072606_quotation_idempotency.sql) | 已审保留：客户端编号首版重放；显式空值及修订拒绝 |
| [supabase/migrations/20260919044030_replace_quotations_with_company_templates.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260919044030_replace_quotations_with_company_templates.sql) | 已审保留：旧对象替代及模板模型权限；受控发布与当前指针；首版HTML/交互/指南快照 |
| [supabase/migrations/20260919100444_wholesale_business_parameter_versions.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260919100444_wholesale_business_parameter_versions.sql) | 已审保留：参数版本发布/预约/解析；订单及提成固定版本；推荐佣金版本汇总 |
| [supabase/migrations/20260921034705_limit_daily_sales_lead_assignments.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260921034705_limit_daily_sales_lead_assignments.sql) | 已审保留：上海日界额度；负责人串行检查；领取周期与当前归属写入 |
| [supabase/migrations/20260921070119_integrated_mail_workspace.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260921070119_integrated_mail_workspace.sql) | 已审保留：邮件领域表与索引；后台事务及指标；后台专用授权 |
| [supabase/migrations/20260922045905_mail_intake_quarantine_and_generated_identities.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260922045905_mail_intake_quarantine_and_generated_identities.sql) | 已审保留：隔离约束与身份回填；隔离恢复事务；正常会话与统计守卫 |
| [supabase/migrations/20260922061943_mail_intake_rule_audit_rpcs.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260922061943_mail_intake_rule_audit_rpcs.sql) | 已审保留：规则版本写入；无正文审计；命中计数 |
| [supabase/migrations/20260923033304_mail_recipient_allowlist.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923033304_mail_recipient_allowlist.sql) | 已审保留：成功收件人盲索引；陌生来信防重回执；后台访问约束 |
| [supabase/migrations/20260923043043_add_wholesale_order_month_filter.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923043043_add_wholesale_order_month_filter.sql) | 已审保留：月份和日期校验；筛选游标及完整汇总；客户字段与探测保护 |
| [supabase/migrations/20260923060310_prevent_duplicate_outbound_mail.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923060310_prevent_duplicate_outbound_mail.sql) | 已审保留：稳定发送标识；过期领取恢复；后台函数授权 |
| [supabase/migrations/20260923060626_restrict_direct_account_writes.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923060626_restrict_direct_account_writes.sql) | 已审保留：普通资料列权；角色表写权撤销；实时状态限制 |
| [supabase/migrations/20260923060745_commit_inbound_mail_atomically.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923060745_commit_inbound_mail_atomically.sql) | 已审保留：消息会话原子写；附件通知批量核对；防重与规则命中 |
| [supabase/migrations/20260923061033_isolate_unsupported_inbound_mail.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923061033_isolate_unsupported_inbound_mail.sql) | 已审保留：拒绝原因白名单；无正文防重审计；后台只读插入边界 |
| [supabase/migrations/20260923061228_protect_wholesale_internal_columns.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923061228_protect_wholesale_internal_columns.sql) | 已审保留：受控订单行范围；客户内部列裁剪；安全采购关联投影 |
| [supabase/migrations/20260923061844_preserve_client_wholesale_related_reads.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923061844_preserve_client_wholesale_related_reads.sql) | 已审保留：只返回真假归属；附件读取恢复；历史结算读取恢复 |
| [supabase/migrations/20260923062011_paginate_mail_threads_consistently.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923062011_paginate_mail_threads_consistently.sql) | 已审保留：未读及范围筛选；稳定游标分页；后台调用校验 |
| [supabase/migrations/20260923062230_aggregate_mail_report_metrics.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923062230_aggregate_mail_report_metrics.sql) | 已审保留：全期邮件计数；人员分布；后台读取权限 |
| [supabase/migrations/20260923062711_bundle_admin_person_account_change.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923062711_bundle_admin_person_account_change.sql) | 已审保留：完整快照冲突；账号范围审计事务；Auth补偿目标 |
| [supabase/migrations/20260923063510_hide_client_wholesale_settlements.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923063510_hide_client_wholesale_settlements.sql) | 已审保留：客户结算读取收回 |
| [supabase/migrations/20260923122441_wholesale_order_client_contacts.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923122441_wholesale_order_client_contacts.sql) | 已审保留：本人订单负责人投影；输入数量边界 |
| [supabase/migrations/20260923125344_cover_remaining_foreign_keys.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260923125344_cover_remaining_foreign_keys.sql) | 已审保留：业务外键索引；复合引用前导列 |
| [supabase/migrations/20260924044219_secure_wholesale_client_contacts.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260924044219_secure_wholesale_client_contacts.sql) | 已审保留：实时客户身份；业务入口和状态；最小联系人投影 |
| [supabase/migrations/20260924044224_reconcile_auth_metadata_and_fk_indexes.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260924044224_reconcile_auth_metadata_and_fk_indexes.sql) | 已审保留：实际元数据偏差恢复；待同步集合；八项外键索引 |
| [supabase/migrations/20260925121200_materialize_monthly_settlement_visible_releases.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260925121200_materialize_monthly_settlement_visible_releases.sql) | 已审保留：可见收款语句内固定；已分配月界换算汇总 |
| [supabase/migrations/20260925123751_materialize_claim_page_visible_customers.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260925123751_materialize_claim_page_visible_customers.sql) | 已审保留：调用者可见集合；大厅/认领组分页；分岗位返回投影 |
| [supabase/migrations/20260929033515_optimize_logistics_archive_reads.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260929033515_optimize_logistics_archive_reads.sql) | 已审保留：店铺覆盖索引；下单日期索引 |
| [supabase/migrations/20260929052545_boc_spot_buy_exchange_rates.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260929052545_boc_spot_buy_exchange_rates.sql) | 已审保留：参考价退出与银行约束；原始/公司价及人工分支；后台时序保存 |
| [supabase/migrations/20260929052547_boc_order_transaction_rates.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260929052547_boc_order_transaction_rates.sql) | 已审保留：业务日期与报价引用；买入/成交快照；动态调用方迁移 |
| [supabase/migrations/20260929052549_exchange_rate_recalculation.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260929052549_exchange_rate_recalculation.sql) | 已审保留：核验及完整锁快照；原参数计算与预览回滚；带令牌执行终态 |
| [supabase/migrations/20260929080458_drop_old_exchange_rate_archive.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260929080458_drop_old_exchange_rate_archive.sql) | 已审保留：过渡旧参考价归档删除 |
| [supabase/migrations/20260929092315_sales_lead_customer_conversion.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260929092315_sales_lead_customer_conversion.sql) | 已审保留：旧状态保护与固定期限迁移；线索读取和客户维护边界；原子转换及长期客户凭证 |
| [supabase/migrations/20260930095048_remove_wholesale_1688_claims.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260930095048_remove_wholesale_1688_claims.sql) | 已审保留：保留订单查询重建；旧采购与认领模型退出；AI额度保留及旧种类收紧 |
| [supabase/migrations/20260930185202_dashboard_numbered_pages.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20260930185202_dashboard_numbered_pages.sql) | 已审保留：订单和物流编号查询；服务端邮件编号查询；完整人员审计目录 |
| [supabase/migrations/20261001060218_optimize_logistics_writes_and_resume.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261001060218_optimize_logistics_writes_and_resume.sql) | 已审保留：观测分桶与权限；内容去重写入；完整处理回执 |
| [supabase/migrations/20261001060435_logistics_page_freshness.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261001060435_logistics_page_freshness.sql) | 已审保留：筛选及岗位可见范围；归档与观测组合；编号页和全范围统计 |
| [supabase/migrations/20261001060439_logistics_page_checkpoints.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261001060439_logistics_page_checkpoints.sql) | 已审保留：分模式断点及租约；整页原子提交与释放；物流重试决策 |
| [supabase/migrations/20261001072039_logistics_continuation_budget.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261001072039_logistics_continuation_budget.sql) | 已审保留：历史失败计数回填；正常片段和真实失败分流；超时派发与原子告警 |
| [supabase/migrations/20261002053000_optimize_logistics_date_range.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261002053000_optimize_logistics_date_range.sql) | 已审保留：无日期部分索引；互斥日期候选分支；原查询与权限保留 |
| [supabase/migrations/20261008015350_document_library.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261008015350_document_library.sql) | 已审保留：档案目录及账号合并；实时目录和操作授权；文件登记完成与清理协议 |
| [supabase/migrations/20261008040305_restrict_document_table_writes.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261008040305_restrict_document_table_writes.sql) | 已审保留：资料表角色授权收紧 |
| [supabase/migrations/20261008064137_personal_template_documents.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261008064137_personal_template_documents.sql) | 已审保留：个人状态与固定版本读取；修订写入及去重凭证 |
| [supabase/migrations/20261008064328_quotation_document_protocol.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261008064328_quotation_document_protocol.sql) | 已审保留：内置模板新版本发布；填写快照导入导出适配 |
| [supabase/migrations/20261008093757_wholesale_customer_commission_and_order_fees.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261008093757_wholesale_customer_commission_and_order_fees.sql) | 已审保留：原子历史审计及客户分类切换；参数版本退休与固定规则；派生费用和提成读写协议 |
| [supabase/migrations/20261008133725_invoice_personal_document_protocol.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261008133725_invoice_personal_document_protocol.sql) | 已审保留：源版本和工厂保护；发票快照恢复协议；不可变版本追加及凭证 |
| [supabase/migrations/20261008165803_company_template_usage_capability.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261008165803_company_template_usage_capability.sql) | 已审保留：不可伪造的生成能力标识；当期新建文档能力守卫 |
| [supabase/migrations/20261009020109_generic_html_document_saving.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261009020109_generic_html_document_saving.sql) | 已审保留：普通HTML的个人文档创建；能力声明审计语义调整 |
| [supabase/migrations/20261009035105_template_documents_in_folders.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261009035105_template_documents_in_folders.sql) | 已审保留：非空归档及位置模型迁移；实时目录与操作授权；模板与上传资料生命周期 |
| [supabase/migrations/20261009091636_document_explorer.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261009091636_document_explorer.sql) | 已审保留：目录确认、浏览及整树移动；可恢复批次与当前权限；统一结构锁及写入守卫 |
| [supabase/migrations/20261012090000_personal_document_folders.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261012090000_personal_document_folders.sql) | 已审保留：未完成操作迁移保护；非空个人目录迁移；初始化与授权重定义 |
| [supabase/migrations/20261012090100_document_copy_batches.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261012090100_document_copy_batches.sql) | 已审保留：复制清单与目标校验；权威父目录映射与条目执行；文件成功凭证核对 |
| [supabase/migrations/20261012090101_unified_document_folder.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261012090101_unified_document_folder.sql) | 已审保留：未完成操作拒绝与统一根迁移；个人/客户目录权限及合并；精确改写旧入口及重新授权 |
| [supabase/migrations/20261012094032_template_document_drafts.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261012094032_template_document_drafts.sql) | 已审保留：本人草稿与固定版本权限；四项草稿命令及原子转正；正式副本名称和来源修订校验 |
| [supabase/migrations/20261015065258_document_windows_explorer.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261015065258_document_windows_explorer.sql) | 已审保留：公共单例与目录实时权限；分类/档案/目录读取；默认名称和受控写入授权 |
| [supabase/migrations/20261102084526_learning_foreign_key_indexes.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261102084526_learning_foreign_key_indexes.sql) | 已审保留：外键引用端的26索引；锁/执行时限和事务回滚 |
| [supabase/migrations/20261102085313_learning_template_read_policy.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261102085313_learning_template_read_policy.sql) | 已审保留：原三条策略集合准入；保留谓词的OR合并与事务 |
| [supabase/migrations/20261105075226_wholesale_settlement_request_id.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105075226_wholesale_settlement_request_id.sql) | 已审拆分：结汇请求身份与唯一约束；原直接登记函数替换；保持执行授权 |
| [supabase/migrations/20261105090018_append_wholesale_customer_other_names.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105090018_append_wholesale_customer_other_names.sql) | 已审保留：使用现有权限锁定客户行；复用别名标准化并返回回执；限制函数执行角色 |
| [supabase/migrations/20261105093426_guard_wholesale_customer_edit_revision.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105093426_guard_wholesale_customer_edit_revision.sql) | 已审保留：保存并推进客户编辑版本；在条件更新中校验旧表单版本；维持客户写入函数授权 |
| [supabase/migrations/20261105095537_verify_wholesale_customer_link_retry.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105095537_verify_wholesale_customer_link_retry.sql) | 已审保留：核对合并操作者与目标资格；确认已完成的关联与启用授权；同一事务提交关联与业务权限 |
| [supabase/migrations/20261105102219_verify_wholesale_customer_delete_affected_row.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105102219_verify_wholesale_customer_delete_affected_row.sql) | 已审保留：校验客户删除权限和业务依赖；执行删除并拒绝零影响结果 |
| [supabase/migrations/20261105104454_preserve_client_business_grant_on_retry.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105104454_preserve_client_business_grant_on_retry.sql) | 已审保留：校验管理员及目标注册客户资格；启用权限并确认档案 |
| [supabase/migrations/20261105105857_serialize_customer_archive_delete_guard.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105105857_serialize_customer_archive_delete_guard.sql) | 已审保留：用同一目录锁序列化客户归档保护；保留有文件的归档并清理允许删除的归档关联 |
| [supabase/migrations/20261105114127_verify_document_batch_move_storage.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105114127_verify_document_batch_move_storage.sql) | 已审保留：在原批次步骤事务中核对移动对象登记；保留成功凭证并允许失败条目重试 |
| [supabase/migrations/20261105163811_track_mail_read_arrivals.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105163811_track_mail_read_arrivals.sql) | 已审拆分：邮件入库顺序与索引；已读位置单向提交；统一未读查询 |
| [supabase/migrations/20261105181717_settle_mail_inbound_event_atomically.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105181717_settle_mail_inbound_event_atomically.sql) | 已审拆分：核对事件领取次数并处理重放；在同一事务提交单向游标、回补审计及事件终态；按当前领取保护失败状态与邮箱健康 |
| [supabase/migrations/20261105213359_bind_task_review_to_submission_round.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105213359_bind_task_review_to_submission_round.sql) | 已审拆分：更换两条审核函数签名；锁内核对轮次并写入；维持执行授权 |
| [supabase/migrations/20261105222432_guard_retained_commission_pending_settlement.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105222432_guard_retained_commission_pending_settlement.sql) | 已审拆分：在历史结算行锁内核对默认目标仍待结算 |
| [supabase/migrations/20261105230016_guard_submission_review_boundaries.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105230016_guard_submission_review_boundaries.sql) | 已审拆分：阻止普通账号新增审核终态；约束正式隐私资料的直接新增 |
| [supabase/migrations/20261105232522_restrict_order_number_allocation_to_order_flows.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261105232522_restrict_order_number_allocation_to_order_flows.sql) | 已审拆分：撤回登录会话对内部编号函数的直接执行权 |
| [supabase/migrations/20261106002000_restrict_signup_referral_helpers.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261106002000_restrict_signup_referral_helpers.sql) | 已审拆分：撤销普通角色的旧注册辅助写入权限 |
| [supabase/migrations/20261106060000_restrict_retail_vip_sync.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261106060000_restrict_retail_vip_sync.sql) | 已审拆分：撤销普通角色对旧会员重算的直接执行权 |
| [supabase/migrations/20261106063000_restrict_order_commission_read_helpers.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261106063000_restrict_order_commission_read_helpers.sql) | 已审拆分：内部佣金函数的执行权限 |
| [supabase/migrations/20261106080447_private_new_function_defaults.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261106080447_private_new_function_defaults.sql) | 已审拆分：修正迁移角色的全局函数默认授权；要求公开业务函数显式声明调用者 |
| [supabase/migrations/20261109183522_fix_sales_lead_shanghai_daily_quota_dst.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261109183522_fix_sales_lead_shanghai_daily_quota_dst.sql) | 已审拆分：负责人每日额度窗口修复 |
| [supabase/migrations/20261111120138_document_cleanup_retry_targets.sql](../../../../PT5-dropshipping-supabase/supabase/migrations/20261111120138_document_cleanup_retry_targets.sql) | 已审保留：定义内部固定清单与服务端访问边界；首次领取与同一运行重试；核对已完成与未完成目标凭证 |
| [supabase/rollbacks/logistics-page-date-range.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/logistics-page-date-range.sql) | 已审保留：规范化筛选并按当前权限读取；计算完整范围汇总及稳定编号分页；移除日期优化专属索引 |
| [supabase/rollbacks/logistics-sync.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/logistics-sync.sql) | 已审保留：维护窗口停工检查及事务锁；回写观测并停止旧接口不能续办的队列；按包含文件恢复函数及显式授权 |
| [supabase/rollbacks/logistics-sync/claim_wholesale_logistics_sync.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/logistics-sync/claim_wholesale_logistics_sync.sql) | 已审保留：检查旧同步模式；原子领取或接管15分钟租约；返回令牌及三路游标 |
| [supabase/rollbacks/logistics-sync/dispatch_due_operation_runs.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/logistics-sync/dispatch_due_operation_runs.sql) | 已审保留：终结超时尝试并安排重试或告警；锁定并派发符合条件的到期运行；清理90天前已结束记录 |
| [supabase/rollbacks/logistics-sync/finish_operation_attempt_checked.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/logistics-sync/finish_operation_attempt_checked.sql) | 已审保留：核对当前运行及尝试编号；委派原账本完成逻辑 |
| [supabase/rollbacks/logistics-sync/finish_wholesale_logistics_sync.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/logistics-sync/finish_wholesale_logistics_sync.sql) | 已审保留：校验模式及三路游标；匹配令牌后单调推进成功进度；释放租约并记录数量或失败原因 |
| [supabase/rollbacks/logistics-sync/get_wholesale_logistics_page.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/logistics-sync/get_wholesale_logistics_page.sql) | 已审保留：校验模式/日期/筛选并落实可见权限；建立完整筛选集与统计；固定20条稳定分页及旧字段投影 |
| [supabase/rollbacks/logistics-sync/renew_wholesale_logistics_sync.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/logistics-sync/renew_wholesale_logistics_sync.sql) | 已审保留：按当前令牌续租并返回实际命中 |
| [supabase/rollbacks/logistics-sync/upsert_wholesale_logistics_archive_rows.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/logistics-sync/upsert_wholesale_logistics_archive_rows.sql) | 已审保留：校验并规范化来源行；按来源及包裹去重并条件合并字段；返回实际受影响整数 |
| [supabase/rollbacks/mail-inbound-event-settlement.sql](../../../../PT5-dropshipping-supabase/supabase/rollbacks/mail-inbound-event-settlement.sql) | 已审拆分：移除收件结算入口以支持 Web 回退 |
