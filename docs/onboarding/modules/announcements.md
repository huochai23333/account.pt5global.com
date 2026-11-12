# 公告

当前范围：共享。

## 业务与阅读顺序

管理员在 `/admin/announcements` 维护公告。工作台首页与铃铛提供登录后阅读，登录页展示最新的全体公告。

数据流：管理表单写入公告，数据库生成发布状态和时间。工作台按登录角色读取，确认后逐项保存已读。登录页通过匿名函数读取最新一条。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

数据库行级策略允许管理员管理。已启用的内部账号读内部及全体公告，已启用的客户读客户及全体公告。匿名函数只选已发布且受众为全体的公告。

完成依据：发布核对同一公告编号、状态和时间。已读核对同一公告与当前账号的阅读记录，刷新后不再重复弹出。

## 常见维护

修改发布行为先看 `lib/announcement-mutations.ts`，修改未读行为先看 `lib/workspace-announcements.ts` 和铃铛 Hook。管理筛选中的所有范围和公告受众全体用户使用独立值。

验证入口：npm run test:learning:browser -- announcement-admin announcement-read；npm run check:operation-contracts。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`get_latest_public_announcement`、`mark_announcement_read`。

源码中直接引用的数据表/存储桶：`announcements`、`user_announcement_reads`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/learning/announcement-admin.spec.ts](../../../tests/learning/announcement-admin.spec.ts)
- [web: tests/learning/announcement-read.spec.ts](../../../tests/learning/announcement-read.spec.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(workspace)/[workspace]/announcements/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/announcements/page.tsx) | 已审保留：导出公告管理页和路由元数据 |
| [components/dashboard/announcements/announcement-form-dialog.tsx](../../../components/dashboard/announcements/announcement-form-dialog.tsx) | 已审保留：组装草稿和编辑共用表单；连接标题、受众与正文字段 |
| [components/dashboard/announcements/announcements-client.tsx](../../../components/dashboard/announcements/announcements-client.tsx) | 已审拆分：组装管理页、访问状态与表单；从双语命名空间读取页面文案 |
| [components/dashboard/announcements/announcements-display.ts](../../../components/dashboard/announcements/announcements-display.ts) | 已审拆分：组织受众和状态选项、表单初始值；按上海时区格式化时间；将内部异常映射为双语日常提示 |
| [components/dashboard/announcements/announcements-sections.tsx](../../../components/dashboard/announcements/announcements-sections.tsx) | 已审拆分：呈现管理入口；呈现状态和受众筛选；渲染分页列表与行动按钮 |
| [components/dashboard/announcements/use-announcement-row-actions.ts](../../../components/dashboard/announcements/use-announcement-row-actions.ts) | 已审拆分：集中处理发布、下线和删除；管理同步锁、确认和动作反馈 |
| [components/dashboard/announcements/use-announcements-view-model.ts](../../../components/dashboard/announcements/use-announcements-view-model.ts) | 已审拆分：同步管理页查询结果；管理分页前的筛选；管理草稿/编辑表单与提交 |
| [components/dashboard/use-workspace-header-announcements.ts](../../../components/dashboard/use-workspace-header-announcements.ts) | 已审拆分：管理铃铛列表和读取竞态；管理自动与手动弹窗；按已确认编号推进已读状态 |
| [lib/announcement-mutations.ts](../../../lib/announcement-mutations.ts) | 已审拆分：构造草稿和编辑数据；执行公告的表写入并核对回执 |
| [lib/announcements.ts](../../../lib/announcements.ts) | 已审拆分：定义公告及表单的领域结构；读取工作台或管理员公告列表 |
| [lib/public-announcements.ts](../../../lib/public-announcements.ts) | 已审保留：获取匿名可读的最新公告；以固定周期缓存公共结果 |
| [lib/workspace-announcements.ts](../../../lib/workspace-announcements.ts) | 已审拆分：组合可见列表与当前用户已读编号；逐项写入并读回缺失回执 |
