# 从线索大厅到联系记录

从管理员或业务员的批发工作台进入「线索大厅」。用一条练习线索走认领和刷新，可跟随[线索操作教程](../tutorials/sales-lead-flow.md)。

追踪后台来源时看后端`scripts/test-sales-lead-sync-local.mjs`及同层`sales-lead-sync-fixture.mjs`：入口核对专属环境、提供本地来源、调用并核对同一任务三次尝试；夹具负责随机归属、私有备份和原子回收。来源缺失不能当成功，补齐后须独立核对100条线索/300条来源/3次尝试及任务终态，清理后本次主键为零。准备、失败恢复与本地混合集成限制见[后端环境说明](../../../../PT5-dropshipping-supabase/docs/onboarding/environment.md#线索同步cli的来源与回收)。

自动执行与原CLI主动重试分开验证。[真实调度链](../reference/verification-2026-11-11-auto-dispatch.md)已核对原小时任务、分钟派发、pg_net传输、实际Edge和数据库终态；暂停超过到期后仍沿用原编号继续。60／300秒是最早重试间隔，分钟调度可能稍晚处理；维护时不要为了立即看到结果而改业务到期时间或打开共享实例的任务。

数据库阅读从[线索大厅历史指南](../../../../PT5-dropshipping-supabase/docs/onboarding/sales-lead-hall-history.md)开始：当前线索、领取周期、联系和公开来源分别保存。早期 used 状态与当前 converted 状态属于不同版本；维护当前转换时应看实际客户记录及领取周期，不能套用旧版“已使用”的成功条件。

| 想修改什么 | 从哪里开始 |
| --- | --- |
| 看板、搜索、分页 | [use-sales-leads-list.ts](../../../components/dashboard/sales-leads/use-sales-leads-list.ts) 负责 300 毫秒搜索延迟及读取编号，调用 [sales-leads.ts](../../../lib/sales-leads.ts) 的 `get_sales_lead_page`。表格与卡片共用查询结果。 |
| 认领、联系、退回、分配 | [use-sales-lead-actions.ts](../../../components/dashboard/sales-leads/use-sales-lead-actions.ts) 管理详情和单次操作锁。[sales-lead-write.ts](../../../lib/sales-lead-write.ts) 核对写入返回的编号、版本与预期状态，确认后才切换看板或关闭表单。 |
| 展示规则、渠道和字段 | `SalesLeadListRow`、`SalesLeadCards`、`SalesLeadDetailDialog` 分别负责列表、卡片与详情。公开联系链接只接受可识别的协议，联系历史只展示授权详情已返回的记录。 |
| 转化为客户 | [sales-lead-customer.ts](../../../lib/sales-lead-customer.ts) 绑定当前领取周期，核对已结束的周期、客户编号、负责人和建档人。草稿预填在 [sales-lead-customer-draft.ts](../../../components/dashboard/sales-leads/sales-lead-customer-draft.ts)。 |
| 更新每天的来源文件 | 管理员发起请求后，页面按操作编号等待终态。后端先核验身份并领取租约，逐日校验和导入，按文件记录结果并续租，见[后端函数指南](../../../../PT5-dropshipping-supabase/docs/onboarding/functions.md)。 |

列表切换后，较早请求可以完成，但只允许最后一次读取更新显示。列表刷新和联系表单各自管理进度，避免一次搜索把写入按钮提前解锁。若保存提示待确认，先查看该线索历史，避免在结果不明时再次填写同一条联系。

## 怎样维护原大厅业务测试

[原大厅测试](../../../tests/e2e/sales-leads.spec.ts)保留竞争留痕、管理员分配及财务/客户拒绝三个场景。它创建本次UUID线索，搜索精确名称与ID；不再挑第一条导入线索，也不修改既有认领日期来腾额度。页面操作后另连接查负责人、周期、联系、客户与版本，刷新再次核对；上下文先关闭，转换和线索各自限定回收，任一步失败继续收尾并保留原错误。维护步骤和33项可执行专项见[转换与大厅测试夹具](sales-lead-conversion-tests.md)。这属于原测试源码整改，原Auth页面仍未执行。

## 怎样维护每日认领上限测试

[原每日上限测试](../../../tests/e2e/sales-lead-daily-limit.spec.ts)使用实际登录返回邮箱独立查活动身份，并要求上海当天零认领；已有记录就明确失败，不删除联系、认领周期或转换关联，也不调整claimed_at。六条随机线索在创建前逐个登记，前四次通过真实数据库认领规则准备，第五次和后续拒绝仍须从原页面发起。

独立SQL核对第5条负责人、唯一当前周期、全天计数5，以及第6条仍在大厅且没有周期/联系。第6次拒绝和刷新后，对比两条完整内容与行版本；375/390px英文重复提交仍保持相同结果。页面当前规则只介绍30天期限，不能再断言已移除的每日5条规则段落；每日限制通过真实拒绝提示和数据库证明。连接时区不会改变上海自然日的上下界。

结束先关闭页面，再逆序按本次六ID调用已审的父子原子清理；单条来源/归属变化就保留该条，仍尝试其余五条，正文及收尾错误一起报告。

```powershell
node --test scripts/e2e-fixture-policy.test.mjs
```

预期36项通过：原28项准入/读写执行器、4项每日生命周期和4项协作资源回归；SQL/页面端口明确模拟，原Auth未加载。真正的第五次页面操作、中英1440/375/390及完整客户端接线仍未验，不能把SQL模型通过写成原页面通过。[后端每日SQL](../../../../PT5-dropshipping-supabase/docs/onboarding/sales-lead-sql-tests.md#每日页面测试的专属前提)区分原SQL和页面前提。

## 怎样维护原详情与双视图测试

[详情测试](../../../tests/e2e/sales-lead-details.spec.ts)按本次页面请求响应逐字段核对卡片/详情，并在保留真实请求的前提下替换长联系方式、空值和危险地址的显示内容。[双视图测试](../../../tests/e2e/sales-lead-views.spec.ts)检查列表/卡片切换、筛选与页码保持、公开资料展开、语言和存储不可用。二者分别保留同一业务的局部辅助，不再拆新文件。原七个展开后的页面场景仍依赖受限认证入口，保持未执行，不能用源码审查或离线DOM检查代替页面通过。

从 [结果区块](../../../components/dashboard/sales-leads/sales-leads-results-section.tsx)看，两种布局共用 `sales-lead-list` 外层、同一查询结果和分页；列表行展开只读取已经返回的公开字段，查看详情才调用 `get_sales_lead_detail`。`use-sales-leads-display`把布局偏好保存到`pt5-sales-leads-view`，写存储失败只在当前页面保留选择，刷新退回列表。测试只阻断这个键，不应顺便破坏认证存储。测试中替换响应里的同步错误只核对用户可读说明，不证明后台真的失败或恢复。

特别注意：`get_sales_lead_page`和`get_sales_lead_detail`在查询前都会调用`private.release_expired_sales_leads`，可能释放过期认领；登录还可能保存公告阅读记录。因此固定账号的展示测试也必须进入可重建专属实例，不能在共享数据上当成无副作用浏览。两份源码现于`beforeEach`复用`readDisposablePostgresTarget`，先核对显式本地API、专属项目/容器标签和端口网络、暂停调度与空外部队列，再进入页面。声明目标通过不代表受限Auth助手实际连接正确，访问限制仍有效。

截图使用`testInfo.outputPath`分开测试和重试；整轮运行还须传入唯一`--output`目录，防止下一轮清空旧证据。视口增加390px并保留375px，新增视口在原页面套件实际运行前不算已验。详情逐字段比较的是同一次HTTP响应，不是独立数据库读回；图片、溢出采样和正向展示也不证明RLS、联系写入、认领额度或完整中断矩阵。[本批源码与离线诊断记录](../reference/verification-2026-11-09-sales-lead-history.md#2026-11-10详情与双视图原源码)

认领后独立查看 `sales_leads.current_assignment_id` 和 `sales_lead_assignments`。联系需在同一周期出现唯一的 `sales_lead_contact_notes` 记录，退回需清空当前负责人、保留带结束原因的历史。页面的按钮和列表只帮助用户操作，真正的岗位、归属、额度和锁由数据库执行。

在 Web 仓库执行 `npm run test:learning:browser -- sales-lead-receipts`。该用例使用专属本地账号和线索，模拟一次空联系凭证，再从页面真实提交，独立查询数据库并刷新。最后按编号清理线索、联系和领取周期。

线索夹具显式依赖账号夹具，结束时先清理线索再删除负责人；正文超时也遵循相同顺序。独立Docker读回在本机有进程启动开销，正文使用120秒预算，准备和清理各自单独计时。不要去掉独立查询来压缩时间，也不要把超时后的残留当作正常清理。

数据库的每日额度、邮件身份/隔离、规则和回执历史，见[线索额度与邮件数据库](../../../../PT5-dropshipping-supabase/docs/onboarding/lead-mail-history.md)。

原SQL维护见[认领、画像、目录与每日额度指南](../../../../PT5-dropshipping-supabase/docs/onboarding/sales-lead-sql-tests.md)：八个专属身份分别覆盖允许与拒绝，管理员实际切数据库角色，画像重在导入一致性；目录原迁移通过真实相对路径加载。大厅补完整导入/租约终态，每日额度包含上海自然日与春秋夏令时。每套核对真实记录及回滚后的完整行/函数权限，SQL通过与页面/真实Auth/并发验收分别记录。
