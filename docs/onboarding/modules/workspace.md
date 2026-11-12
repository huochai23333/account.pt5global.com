# 工作台路由与导航

当前范围：共享。

## 业务与阅读顺序

把角色、业务与栏目组合成可访问的工作台。

数据流：proxy.ts → layout/requireWorkspaceAccess 核验身份与岗位 → workspace-config + 已启用业务注册 → 动态 Page 的业务准入 → 领域 renderer/全局栏目协调 → Client → 领域服务与数据库权限。

先阅读本模块的入口或服务导出，再沿 import 追到状态、读取、写入和展示。动态工作台的角色/业务/栏目不是三套重复页面。

## 权限与完成凭证

当前数据库账号状态、角色和启用业务共同决定入口；导航隐藏不是授权。

完成依据：目标页面正文和实际控件可见，刷新后仍能访问；越权进入访问范围提示。

## 常见维护

先读 explanation/workspace-access.md 的完整链路。新增栏目修改业务注册与岗位能力，再接 renderer；导航仅筛选已授权菜单，不能替代服务端与数据库授权。不要复制整套角色页面。

验证入口：npm run check:dashboard-ui；npm run test:learning:browser 验证独立账号与服务说明页；原 workspace-entrypoints、workspace-navigation-search 用例按各自准入执行。具体测试路径见下方源码表或[测试手册](../how-to/verification.md)。

## 数据库调用与关联测试

源码中直接调用的数据库函数：`get_current_workspace_business_access`。

源码中直接引用的数据表/存储桶：本模块未发现字面量 from 调用。

这些引用由源码字面量提取，动态调用与授权仍需沿完整链路核对；历史定义见[后端索引](../../../../PT5-dropshipping-supabase/docs/onboarding/database-index.json)。

- [web: tests/contracts/workspace-page-contracts.spec.ts](../../../tests/contracts/workspace-page-contracts.spec.ts)
- [web: tests/e2e/helpers/workspace-page-contracts.ts](../../../tests/e2e/helpers/workspace-page-contracts.ts)
- [web: tests/e2e/workspace-entrypoints.spec.ts](../../../tests/e2e/workspace-entrypoints.spec.ts)
- [web: tests/e2e/workspace-navigation-search.spec.ts](../../../tests/e2e/workspace-navigation-search.spec.ts)
- [web: tests/e2e/workspace-navigation-visible.spec.ts](../../../tests/e2e/workspace-navigation-visible.spec.ts)
- [web: tests/learning/workspace-notice.spec.ts](../../../tests/learning/workspace-notice.spec.ts)
- [supabase: supabase/tests/workspace_navigation_preferences.sql](../../../../PT5-dropshipping-supabase/supabase/tests/workspace_navigation_preferences.sql)

## 源码定位

已审职责来自当前有效台账；待审候选只是文件类型提示，不代表已完成职责判断。完整理由、调用链及限制见[审查台账](../manual-review.json)。

### Web

| 文件 | 阅读重点 |
| --- | --- |
| [app/(account-tools)/layout.tsx](../../../app/%28account-tools%29/layout.tsx) | 已审保留：独立账号工具布局 |
| [app/(workspace)/[workspace]/[business]/[section]/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/%5Bbusiness%5D/%5Bsection%5D/page.tsx) | 已审保留：动态业务路由校验与领域调度 |
| [app/(workspace)/[workspace]/[business]/[section]/section-helpers.ts](../../../app/%28workspace%29/%5Bworkspace%5D/%5Bbusiness%5D/%5Bsection%5D/section-helpers.ts) | 已审保留：栏目能力检查；页面文案命名空间选择 |
| [app/(workspace)/[workspace]/[business]/[section]/section-metadata.ts](../../../app/%28workspace%29/%5Bworkspace%5D/%5Bbusiness%5D/%5Bsection%5D/section-metadata.ts) | 已审保留：业务栏目标题生成 |
| [app/(workspace)/[workspace]/[business]/[section]/tourism-section-page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/%5Bbusiness%5D/%5Bsection%5D/tourism-section-page.tsx) | 已审保留：旅游栏目调度；服务端初值装配 |
| [app/(workspace)/[workspace]/[business]/[section]/types.ts](../../../app/%28workspace%29/%5Bworkspace%5D/%5Bbusiness%5D/%5Bsection%5D/types.ts) | 已审保留：定义 SectionPageProps 等1项同模块类型合同 |
| [app/(workspace)/[workspace]/[business]/[section]/workspace-section-renderer.ts](../../../app/%28workspace%29/%5Bworkspace%5D/%5Bbusiness%5D/%5Bsection%5D/workspace-section-renderer.ts) | 已审保留：定义 WorkspaceSectionRenderContext、WorkspaceSectionRenderer 等2项同模块类型合同 |
| [app/(workspace)/[workspace]/[business]/[section]/workspace-section-renderers.ts](../../../app/%28workspace%29/%5Bworkspace%5D/%5Bbusiness%5D/%5Bsection%5D/workspace-section-renderers.ts) | 已审保留：业务渲染器注册 |
| [app/(workspace)/[workspace]/layout.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/layout.tsx) | 已审保留：工作台布局及准入调度 |
| [app/(workspace)/[workspace]/loading.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/loading.tsx) | 已审保留：工作台加载壳组装 |
| [app/(workspace)/[workspace]/page.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/page.tsx) | 已审保留：工作台根入口定位 |
| [app/(workspace)/[workspace]/template.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/template.tsx) | 已审保留：工作台页面动效边界 |
| [app/(workspace)/[workspace]/workspace-global-pages.tsx](../../../app/%28workspace%29/%5Bworkspace%5D/workspace-global-pages.tsx) | 已审保留：全局栏目标题生成；全局栏目页面调度 |
| [app/access-limited/page.tsx](../../../app/access-limited/page.tsx) | 已审保留：访问范围提示页调度与展示 |
| [app/business-unavailable/page.tsx](../../../app/business-unavailable/page.tsx) | 已审保留：停用业务与无业务提示；已确认岗位的可用入口展示 |
| [app/error.tsx](../../../app/error.tsx) | 已审保留：页面异常提示与重开；异常界面的本地语言选择 |
| [app/global-error.tsx](../../../app/global-error.tsx) | 已审保留：根级错误页与恢复入口；独立语言选择 |
| [app/layout.tsx](../../../app/layout.tsx) | 已审保留：根布局与站点元信息 |
| [app/not-found.tsx](../../../app/not-found.tsx) | 已审保留：未找到页面展示 |
| [components/dashboard/admin-shell-client.tsx](../../../components/dashboard/admin-shell-client.tsx) | 已审保留：退出按钮调度 |
| [components/dashboard/admin-shell-desktop-nav.tsx](../../../components/dashboard/admin-shell-desktop-nav.tsx) | 已审保留：桌面导航组装 |
| [components/dashboard/admin-shell-mobile-nav.tsx](../../../components/dashboard/admin-shell-mobile-nav.tsx) | 已审保留：手机菜单展开状态；手机导航展示与分组排序 |
| [components/dashboard/admin-shell-nav-links.tsx](../../../components/dashboard/admin-shell-nav-links.tsx) | 已审保留：导航图标映射；桌面与手机链接展示 |
| [components/dashboard/admin-shell-nav-search.tsx](../../../components/dashboard/admin-shell-nav-search.tsx) | 已审保留：导航搜索框与清空交互 |
| [components/dashboard/admin-shell-nav-types.ts](../../../components/dashboard/admin-shell-nav-types.ts) | 已审保留：定义 AdminShellNavLink、AdminShellNavGroup 等2项同模块类型合同 |
| [components/dashboard/admin-shell-nav.tsx](../../../components/dashboard/admin-shell-nav.tsx) | 已审保留：导航视图选择 |
| [components/dashboard/admin-shell.tsx](../../../components/dashboard/admin-shell.tsx) | 已审保留：工作台容器组装；岗位业务导航展示模型；公告首屏初值读取 |
| [components/dashboard/use-admin-shell-nav-search.ts](../../../components/dashboard/use-admin-shell-nav-search.ts) | 已审保留：已授权导航筛选状态 |
| [components/dashboard/use-admin-shell-navigation.ts](../../../components/dashboard/use-admin-shell-navigation.ts) | 已审保留：当前入口与等待导航状态；预载与闲置恢复调度 |
| [components/dashboard/use-workspace-account-switch.ts](../../../components/dashboard/use-workspace-account-switch.ts) | 已审保留：备用账号切换的交互调度 |
| [components/dashboard/workspace-account-menu.tsx](../../../components/dashboard/workspace-account-menu.tsx) | 已审保留：账号浮层展示；本人页锚点导航；注销与切换按钮调度 |
| [components/dashboard/workspace-announcement-action.tsx](../../../components/dashboard/workspace-announcement-action.tsx) | 已审保留：公告铃铛与阅读弹窗展示 |
| [components/dashboard/workspace-customization-sidebar.tsx](../../../components/dashboard/workspace-customization-sidebar.tsx) | 已审保留：临时侧栏内容共享；桌面侧栏展示切换 |
| [components/dashboard/workspace-header-actions.tsx](../../../components/dashboard/workspace-header-actions.tsx) | 已审保留：顶栏入口排列 |
| [components/dashboard/workspace-loading-shell.tsx](../../../components/dashboard/workspace-loading-shell.tsx) | 已审保留：共享加载骨架展示 |
| [components/dashboard/workspace-session-provider.tsx](../../../components/dashboard/workspace-session-provider.tsx) | 已审保留：会话变化的工作区跳转协调；恢复事件转刷新版本；业务订阅的生命周期约束 |
| [lib/company-config.ts](../../../lib/company-config.ts) | 已审保留：公司展示配置与启用业务声明 |
| [lib/verified-workspace-business.ts](../../../lib/verified-workspace-business.ts) | 已审保留：已核验业务读取 |
| [lib/workspace-business-access.ts](../../../lib/workspace-business-access.ts) | 已审保留：业务权限集合规范化；当前业务查询与既有读取失败分支 |
| [lib/workspace-business-availability.ts](../../../lib/workspace-business-availability.ts) | 已审保留：已登录入口选择；业务参数与停用错误规范化 |
| [lib/workspace-business-modules.ts](../../../lib/workspace-business-modules.ts) | 已审保留：业务声明类型；已启用注册表及其查询 |
| [lib/workspace-config.ts](../../../lib/workspace-config.ts) | 已审保留：岗位工作区配置组装；栏目类型判断；工作台 URL 生成 |
| [lib/workspace-route-segments.ts](../../../lib/workspace-route-segments.ts) | 已审保留：工作台路由段合同 |
| [lib/workspace-sections.ts](../../../lib/workspace-sections.ts) | 已审保留：栏目键规范化 |
| [lib/workspace-tourism-module.ts](../../../lib/workspace-tourism-module.ts) | 已审保留：旅游业务岗位菜单与能力声明 |
| [lib/workspace-wholesale-module.ts](../../../lib/workspace-wholesale-module.ts) | 已审保留：批发岗位菜单与能力声明 |
| [proxy.ts](../../../proxy.ts) | 已审保留：代理入口委托会话刷新 |
