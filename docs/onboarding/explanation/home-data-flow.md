# 首页的三条数据链

原固定账号测试的文件分工、页面重置边界与尚未完成的独立凭证见[首页布局测试维护](home-layout-tests.md)。源码阅读不替代业务验收。

首页由 `app/(workspace)/[workspace]/home/page.tsx` 提供。工作台布局核对当前身份与岗位，页面读取 `lib/dashboard-home.ts#getDashboardHomePageData`，再交给 `dashboard-home-client.tsx`。先打开[首页模块表](../modules/home.md)，按问题选择下面的入口。

## 岗位入口、公告和邀请链接

首页服务按当前身份并行读取本人资料、可见公告、个人待办、保存布局、邀请业务、工作台范围和待处理数量。`dashboard-home-role-tasks.tsx` 依岗位与业务范围选择可进入的页面，有实际计数的链接优先。`lib/dashboard-home-role-task-counts.ts` 计算的是业务待处理数；读取失败时省略数字。邮件计数的服务端权限必须再按岗位和业务员归属收窄。首页的个人待办数量来自另一张表，不能用来代替业务计数。

`dashboard-home-widget-content.tsx` 按卡片类型和尺寸选择紧凑或完整展示。公告卡只消费已读的可见公告；服务端和 RLS 决定范围。邀请码卡的业务链接从服务端已允许的岗位、启用业务和当前账号权限取交集；链接构造与剪贴板放在 `dashboard-home-invite-links.ts`。业务邀请仍需实际注册入口验证，复制成功只代表写入剪贴板。

## 卡片布局：拖动只在提交后写入

`use-dashboard-home-layout.ts` 保留编辑意图，拖动/缩放的坐标规则在 `dashboard-home-widget-interactions.ts` 与 resize 模块。预览期间不改保存记录；松手后由 `use-dashboard-home-layout-persistence.ts` 合并最新意图并串行保存，最终服务调用 `save_user_home_widget_layout`。

`user_home_widget_layouts` 的当前用户和 scope 共同确定一份布局。宽度小于 `80rem` 时使用自动排列，关闭编辑状态，不能把手机排列写回桌面坐标。修改布局算法要看真实鼠标操作、独立读回和刷新，不能只检查卡片移动动画。

## 个人待办：先确认写入，再更新列表

1. `dashboard-home-todo-copy.ts` 从 `DashboardHome.todos` 取得文案；`dashboard-home-todo-display.ts` 保留纯表单转换、筛选与上海日期格式化。
2. `use-dashboard-home-todo-list.ts` 接收首屏列表，处理工作台恢复读取、筛选、数量和已确认记录合并。恢复已失效时不写回旧请求。
3. `use-dashboard-home-todos.ts` 持有快捷输入与编辑草稿、确认弹窗、提交调度。`lib/user-todos.ts` 执行本人读取及 `create_user_todo`、`update_user_todo`、`delete_user_todo`，检查返回记录。列表 Hook 不负责再次提交写入。
4. `dashboard-home-todo-section.tsx` 组装按钮、筛选、列表和弹窗。成功后应看到同一记录的编号、内容、标记与更新时间；失败时保留草稿或旧行供重试。

用专属账号从页面验证布局和待办：

```powershell
npm run test:learning:browser -- dashboard-home-layout.spec.ts dashboard-home-todo.spec.ts
```

待办用例覆盖中文桌面、英文手机、空表单、模拟零影响、真实新增/编辑/标记/完成/删除、独立读回和刷新；布局用例覆盖两种语言及两个宽度。读错、越权、快速切换和管理弹窗的全部失败矩阵仍按[验证手册](../how-to/verification.md)逐项扩充。
