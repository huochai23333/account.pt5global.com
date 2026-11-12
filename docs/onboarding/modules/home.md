# 首页与布局

当前范围：共享。

## 业务与阅读顺序

展示各岗位待办、可见业务入口和用户自己的卡片布局。

数据流：home/page → getDashboardHomePageData 聚合本人资料、公告、待办、布局和岗位业务 → RoleTasks 与 Customizer；布局走 layout/persistence → save_user_home_widget_layout；待办走 todo-list/todos → user-todos 服务 → 本人记录与刷新。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

待办与入口只取当前账号可见集合，布局归属于当前用户和工作范围。

完成依据：相同卡片编号的位置和尺寸被保存，刷新与独立布局记录一致。

## 常见维护

先读 explanation/home-data-flow.md。卡片内容与布局交互分开；待办文案、纯转换、列表读取、表单与写入各有入口。修改尺寸同时核对拖动、缩放与移动端。

验证入口：npm run test:learning:browser -- dashboard-home-layout.spec.ts dashboard-home-todo.spec.ts；原 dashboard-home-* 套件按各自准入单独执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`create_user_todo`、`delete_user_todo`、`save_user_home_widget_layout`、`update_user_todo`。

源码中直接引用的数据表/存储桶：`customer_inventory_orders`、`mail_threads`、`user_home_widget_layouts`、`user_profiles`、`user_todo_items`、`wholesale_settlement_releases`。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/e2e/dashboard-home-customization.spec.ts](../../../tests/e2e/dashboard-home-customization.spec.ts)
- [web: tests/e2e/dashboard-home-invite-controls.spec.ts](../../../tests/e2e/dashboard-home-invite-controls.spec.ts)
- [web: tests/e2e/dashboard-home-resize.spec.ts](../../../tests/e2e/dashboard-home-resize.spec.ts)
- [web: tests/e2e/dashboard-home-role-tasks.spec.ts](../../../tests/e2e/dashboard-home-role-tasks.spec.ts)
- [web: tests/e2e/dashboard-home-widget-minimums.spec.ts](../../../tests/e2e/dashboard-home-widget-minimums.spec.ts)
- [web: tests/learning/dashboard-home-layout.spec.ts](../../../tests/learning/dashboard-home-layout.spec.ts)
- [web: tests/learning/dashboard-home-todo.spec.ts](../../../tests/learning/dashboard-home-todo.spec.ts)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(workspace)/[workspace]/home/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/home/page.tsx) | 已审保留：首页服务端组装 |
| [components/dashboard/dashboard-home/dashboard-home-announcements-widget.tsx](../../../components/dashboard/dashboard-home/dashboard-home-announcements-widget.tsx) | 已审保留：首页公告卡展示 |
| [components/dashboard/dashboard-home/dashboard-home-client.tsx](../../../components/dashboard/dashboard-home/dashboard-home-client.tsx) | 已审保留：首页客户端组装；各卡片文案适配 |
| [components/dashboard/dashboard-home/dashboard-home-clock-section.tsx](../../../components/dashboard/dashboard-home/dashboard-home-clock-section.tsx) | 已审保留：共享分钟时钟订阅；上海时区格式化；各密度时钟展示 |
| [components/dashboard/dashboard-home/dashboard-home-customizer-copy.ts](../../../components/dashboard/dashboard-home/dashboard-home-customizer-copy.ts) | 已审保留：定义 HomeCustomizerCopy 等1项同模块类型合同 |
| [components/dashboard/dashboard-home/dashboard-home-customizer.tsx](../../../components/dashboard/dashboard-home/dashboard-home-customizer.tsx) | 已审保留：首页布局及待办 Hook 组装；卡片编辑和过渡意图；网格、侧栏和弹窗编排 |
| [components/dashboard/dashboard-home/dashboard-home-display.ts](../../../components/dashboard/dashboard-home/dashboard-home-display.ts) | 已审保留：首页姓名与公告日期格式化 |
| [components/dashboard/dashboard-home/dashboard-home-invite-action-button.tsx](../../../components/dashboard/dashboard-home/dashboard-home-invite-action-button.tsx) | 已审保留：邀请码/链接动作按钮展示 |
| [components/dashboard/dashboard-home/dashboard-home-invite-links.ts](../../../components/dashboard/dashboard-home/dashboard-home-invite-links.ts) | 已审保留：邀请动作与链接构造；剪贴板写入边界 |
| [components/dashboard/dashboard-home/dashboard-home-invite-section.tsx](../../../components/dashboard/dashboard-home/dashboard-home-invite-section.tsx) | 已审保留：邀请码三种密度展示；复制意图与结果反馈 |
| [components/dashboard/dashboard-home/dashboard-home-layout-save-feedback.tsx](../../../components/dashboard/dashboard-home/dashboard-home-layout-save-feedback.tsx) | 已审保留：首页布局保存状态与重试展示 |
| [components/dashboard/dashboard-home/dashboard-home-layout.ts](../../../components/dashboard/dashboard-home/dashboard-home-layout.ts) | 已审保留：布局模型、尺寸约束与避让计算 |
| [components/dashboard/dashboard-home/dashboard-home-manager-dialog.tsx](../../../components/dashboard/dashboard-home/dashboard-home-manager-dialog.tsx) | 已审保留：布局管理弹窗展示；重复组件实例标签 |
| [components/dashboard/dashboard-home/dashboard-home-role-tasks.tsx](../../../components/dashboard/dashboard-home/dashboard-home-role-tasks.tsx) | 已审保留：岗位快捷入口选择与显示 |
| [components/dashboard/dashboard-home/dashboard-home-sections.tsx](../../../components/dashboard/dashboard-home/dashboard-home-sections.tsx) | 已审保留：问候与公告区块展示 |
| [components/dashboard/dashboard-home/dashboard-home-todo-copy.ts](../../../components/dashboard/dashboard-home/dashboard-home-todo-copy.ts) | 已审拆分：待办文案合同和字典读取 |
| [components/dashboard/dashboard-home/dashboard-home-todo-dialog.tsx](../../../components/dashboard/dashboard-home/dashboard-home-todo-dialog.tsx) | 已审保留：待办编辑表单展示；删除确认展示 |
| [components/dashboard/dashboard-home/dashboard-home-todo-display.ts](../../../components/dashboard/dashboard-home/dashboard-home-todo-display.ts) | 已审拆分：待办表单转换与校验；待办筛选和计数；上海截止日期显示 |
| [components/dashboard/dashboard-home/dashboard-home-todo-list.tsx](../../../components/dashboard/dashboard-home/dashboard-home-todo-list.tsx) | 已审保留：待办行及筛选按钮展示 |
| [components/dashboard/dashboard-home/dashboard-home-todo-section.tsx](../../../components/dashboard/dashboard-home/dashboard-home-todo-section.tsx) | 已审保留：待办区组装与交互调度 |
| [components/dashboard/dashboard-home/dashboard-home-widget-adjust-dialog.tsx](../../../components/dashboard/dashboard-home/dashboard-home-widget-adjust-dialog.tsx) | 已审保留：组件位置及尺寸调节面板 |
| [components/dashboard/dashboard-home/dashboard-home-widget-card.tsx](../../../components/dashboard/dashboard-home/dashboard-home-widget-card.tsx) | 已审保留：静止定位容器与编辑内容组装 |
| [components/dashboard/dashboard-home/dashboard-home-widget-content.tsx](../../../components/dashboard/dashboard-home/dashboard-home-widget-content.tsx) | 已审保留：首页组件内容分派；组件展示密度推导 |
| [components/dashboard/dashboard-home/dashboard-home-widget-interactions.ts](../../../components/dashboard/dashboard-home/dashboard-home-widget-interactions.ts) | 已审保留：指针拖动、缩放与取消清理 |
| [components/dashboard/dashboard-home/dashboard-home-widget-meta.ts](../../../components/dashboard/dashboard-home/dashboard-home-widget-meta.ts) | 已审保留：组件图标映射 |
| [components/dashboard/dashboard-home/dashboard-home-widget-resize-handle.tsx](../../../components/dashboard/dashboard-home/dashboard-home-widget-resize-handle.tsx) | 已审保留：缩放手柄与边界引导展示 |
| [components/dashboard/dashboard-home/dashboard-home-widget-resize-preview.ts](../../../components/dashboard/dashboard-home/dashboard-home-widget-resize-preview.ts) | 已审保留：网格测量与轻量预览层 |
| [components/dashboard/dashboard-home/dashboard-home-widget-resize.ts](../../../components/dashboard/dashboard-home/dashboard-home-widget-resize.ts) | 已审保留：八方向缩放的纯几何计算 |
| [components/dashboard/dashboard-home/dashboard-home-widget-sidebar.tsx](../../../components/dashboard/dashboard-home/dashboard-home-widget-sidebar.tsx) | 已审保留：可添加组件目录与重置入口展示 |
| [components/dashboard/dashboard-home/use-dashboard-home-display-mode.ts](../../../components/dashboard/dashboard-home/use-dashboard-home-display-mode.ts) | 已审保留：视口驱动布局显示模式 |
| [components/dashboard/dashboard-home/use-dashboard-home-layout-persistence.ts](../../../components/dashboard/dashboard-home/use-dashboard-home-layout-persistence.ts) | 已审拆分：串行保存、最新布局合并及读取恢复 |
| [components/dashboard/dashboard-home/use-dashboard-home-layout.ts](../../../components/dashboard/dashboard-home/use-dashboard-home-layout.ts) | 已审拆分：本地编辑与组件增删移动 |
| [components/dashboard/dashboard-home/use-dashboard-home-todo-list.ts](../../../components/dashboard/dashboard-home/use-dashboard-home-todo-list.ts) | 已审拆分：本人待办恢复读取；筛选与计数；已确认记录合并 |
| [components/dashboard/dashboard-home/use-dashboard-home-todos.ts](../../../components/dashboard/dashboard-home/use-dashboard-home-todos.ts) | 已审拆分：待办表单与草稿；编辑/删除弹窗意图；待办写入调度 |
| [components/dashboard/dashboard-home/use-dashboard-home-widget-resize-handle.ts](../../../components/dashboard/dashboard-home/use-dashboard-home-widget-resize-handle.ts) | 已审保留：边缘命中与把手可见状态 |
| [lib/dashboard-home-layouts.ts](../../../lib/dashboard-home-layouts.ts) | 已审保留：当前用户布局读取、受控保存及返回规范化 |
| [lib/dashboard-home-role-task-counts.ts](../../../lib/dashboard-home-role-task-counts.ts) | 已审保留：岗位待处理计数读取 |
| [lib/dashboard-home.ts](../../../lib/dashboard-home.ts) | 已审保留：首页首屏资料聚合；上海问候时间段；邀请业务准入交集 |
| [lib/user-todos.ts](../../../lib/user-todos.ts) | 已审保留：本人待办查询与分页；待办写入与规范化 |
