# 路由、菜单与权限怎样配合

以 `/admin/wholesale/leads` 为例，`admin` 选岗位工作台，`wholesale` 选业务，`leads` 选栏目。括号路由分组只影响布局，不进入网址。

## 按实际调用顺序阅读

1. `proxy.ts` 处理请求层的会话同步和初步访问前提。
2. `app/(workspace)/[workspace]/layout.tsx` 调用 `requireWorkspaceAccess`。`server-auth.ts` 通过已验证会话核对当前岗位、账号状态和业务访问范围；布局本身不能保护独立调用的数据接口。
3. `lib/workspace-config.ts` 组装岗位的全局栏目、业务菜单与页面能力。`workspace-business-modules.ts` 将公司启用业务与注册模块相交，再读取批发或旅游模块的岗位声明。已注册的旅游源码目前仍保留，当前发布范围没有启用旅游。
4. 动态 `page.tsx` 区分未知业务、已停用业务、无权业务，再通过 `workspace-section-renderers.ts` 选择领域 renderer。
5. renderer 协调领域读取服务、页面命名空间及 Client。它不负责实现每个业务的数据库算法。全局的账号、公告、费用、报销和汇率页由 `workspace-global-pages.tsx` 协调，没有业务路径前缀。
6. 领域服务、Web 接口及数据库函数/RLS 继续验证当前用户和目标记录。仅看到菜单、客户端角色或页面配置，都不能据此发放读写权限。

`getCurrentWorkspaceBusinessAccess` 成功返回空集合时保留空集合；读取失败时已有角色默认值分支会与启用业务相交。这里记录当前实现，不能把它当成所有安全接口都可以使用的默认授权方式。严格工作台准入还要沿 `server-auth.ts → verified-workspace-business.ts` 阅读。

## 外壳与页面各负责什么

`AdminShell` 读取公告初值、生成可见菜单并组装容器。公告初次读取失败时使用空初值，不阻断整个工作台，也不生成已读记录。铃铛的读取/确认在 `use-workspace-header-announcements.ts`，展示在 `workspace-announcement-action.tsx`。

桌面导航的搜索只筛选已经有权限的菜单。`use-admin-shell-navigation.ts` 管理待跳转地址和闲置后整页恢复；链接组件负责图标、等待反馈及手机关闭菜单。搜索不能从完整注册表补出额外业务。

`WorkspaceSessionProvider` 把会话变化、重新连接和页面恢复转成共享刷新版本。订阅的业务 Hook 自行读取对应数据，并在卸载后丢弃旧结果。这个版本不是数据库记录版本，也不代表写操作已经保存。

首页编辑器可临时把桌面侧栏换成组件设置。`workspace-customization-sidebar.tsx` 只保存临时内容；编辑器退出或卸载时负责清空。它不保存首页布局。

## 三种提示页

| 页面 | 含义 | 维护时核对 |
| --- | --- | --- |
| `/access-limited` | 活跃账号访问了本人范围外页面 | 保留会话；返回入口使用已验证岗位与已启用业务 |
| `/business-unavailable` | 访问停用业务，或账号没有可进入的业务 | 保留会话；员工的资料库可独立于业务进入，客户不能获得资料库入口 |
| `app/error.tsx` | 当前页面发生异常 | 显示日常语言并整页重开；不要把原异常内容呈现给用户 |

资料库实际准入在 `lib/document-library/access.ts`，客户被明确拒绝；说明页必须与该边界一致。模板与资料库的桌面显示断点不同，修改按钮排列时需同时检查中英文及 1440/390px，不能只检查整页横向溢出，还要检查按钮是否被挤成逐字换行。

## 修改和验证

导航偏好按[原SQL维护](../../../../PT5-dropshipping-supabase/docs/onboarding/navigation-template-sql.md)核对真实本人行、停用客户、匿名拒绝与原数据恢复。它只保存折叠数组；数组包含某业务不代表获准进入该业务，页面和业务写入仍走各自权限链路。SQL声明模拟身份，不替代Auth登录或页面刷新。

新增栏目先改业务声明或岗位配置，再接 renderer；权限或金额规则仍在领域服务和数据库修改。不要复制一整套岗位页面，也不要通过隐藏按钮修复数据库授权问题。

运行 `npm run check:dashboard-ui`、`npm run check:i18n`、`npm run typecheck` 和适用合同检查。`npm run test:learning:browser` 使用专属账号验证首页布局以及服务说明页的客户/员工入口、双语、桌面/手机、刷新与清理。原受限套件保留自身的执行状态。

这些边界与 [Next.js 的服务端/客户端组合说明](https://nextjs.org/docs/app/getting-started/server-and-client-components)、[授权与布局检查说明](https://nextjs.org/docs/app/guides/authentication)一致；框架 API 以本项目安装的 `node_modules/next/dist/docs/` 为准。Hook 拆分参考 [React 官方说明](https://react.dev/learn/reusing-logic-with-custom-hooks)，不为每个小函数创建文件。
