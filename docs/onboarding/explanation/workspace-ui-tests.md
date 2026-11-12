# 怎样阅读工作台界面测试

视觉截图、认证布局、控件语义和筛选层级的分工另见[视觉与控件测试](design-system-tests.md)。这部分同样保留原认证入口，源码整理不等于页面验收。

尺寸、字段合同及待办异常清理见[表单治理用例](design-system-governance-tests.md)，包括专属数据边界与独立故障检查的适用范围。

首页组件管理、邀请卡片、缩放和最小尺寸另见[首页测试维护](home-layout-tests.md)。三个布局重置文件新增专属实例准入，原套件独立数据库凭证仍未完成。

这些是原端到端套件的源码，不是本轮已运行的页面验收。原 auth 辅助会进入受限账号入口；分页还依赖受限管理员和固定种子。本轮没有读取或执行受限入口，也没有为公开页用例绕开原导入链。

## 跨页面入口与信息层级

[workspace-entrypoints](../../../tests/e2e/workspace-entrypoints.spec.ts)的职责是岗位入口矩阵、入口中的局部交互合同，以及本文件的日期/剪贴板/几何辅助。管理员、业务员、财务的路径逐项对应[独立页面合同](../../../tests/e2e/helpers/workspace-page-contracts.ts)，不可仅凭有外壳或未显示禁止访问就算到达业务页面。复制场景记录的是浏览器替身收到的邀请码，不是系统剪贴板凭证；订单评估的“两笔订单”与流式正文是明确API替身，只证明显示。日期期望独立按上海日界计算，含今天向前29天；没有保存修改订单或新增客户，也不能把打开弹窗当写入成功。

[information-hierarchy](../../../tests/e2e/information-hierarchy.spec.ts)核对页头/命名区域、摘要信息分层，以及390/768/1280/1440px的可见内容几何。区域的无障碍名称可以保留，单主内容区不重复显示同名标题；同屏多个区域仍需标题。`expectSummaryContentFits`和`expectNoRepeatedRegionHeading`先等待至少一个可见目标，防止异步内容未出现时空数组恰好通过。溢出使用真实clientWidth/scrollWidth，摘要数量仍由上层场景核对，不能用通用几何助手替代业务数据断言。

这两份套件的`beforeEach`在登录前核验专属DB/Kong/API、端口/网络及`off|0|0`。登录可能保存公告阅读，线索读取会释放过期认领；进入物流页面的[Hook](../../../components/dashboard/wholesale/use-wholesale-logistics-page.ts)还会直接调用来源同步函数。因此本套件用`page.route`明确返回物流来源暂不可用，不转发真实请求或伪造同步成功；已有档案的页面读取保留，后台恢复另验。这个边界按[Playwright模拟原文](https://playwright.dev/docs/mock)在导航前安装，并属于每个测试的页面夹具，不写共享数据库来阻断来源。

两份原文件保留14个测试声明（岗位矩阵展开后16个场景），本轮没有运行原认证页面。24项明确合成准入和实际Chrome受控DOM/路由14项分别证明前置拒绝、空目标漏判修复及503来源不转发；1440/390px探针不等于真实应用布局验收，内存Auth类型声明也不证明原Auth导入正确。源代码对照、两张摘要图及执行限制见[本批记录](../reference/verification-2026-11-06-workspace-test-review.md#2026-11-10入口矩阵与信息层级原源码)。

## 从要修改的现象找文件

| 现象 | 测试入口与范围 |
| --- | --- |
| 页面外壳、错误表单、手机溢出 | [dashboard-framework](../../../tests/e2e/dashboard-framework.spec.ts)：四岗位外壳、公告缺正文保留输入、当前启用页面的手机宽度。 |
| 搜索文字被图标遮挡 | [dashboard-search-input](../../../tests/e2e/dashboard-search-input.spec.ts)：1440/768/390px，输入左边缘加起始 padding 与图标右边缘至少相隔 8px。只验证输入及几何，不验证搜索结果内容。 |
| 桌面分隔线与手机卡片 | [dashboard-table-divider](../../../tests/e2e/dashboard-table-divider.spec.ts)：读取单元格实际边框色，与低强调令牌探针对照；窄屏检查卡片和溢出。 |
| 首页岗位快捷入口 | [dashboard-home-role-tasks](../../../tests/e2e/dashboard-home-role-tasks.spec.ts)：管理员、财务、业务员、客户、运营，从首页点击到目标页，再刷新并排除运行时错误。 |
| 等待状态 | [loading-feedback](../../../tests/e2e/loading-feedback.spec.ts)：延迟真实邮件只读请求、替换浏览器剪贴板等待。后者只核对当前按钮 busy 和恢复，不验证真实剪贴板内容或其他按钮状态。 |
| 桌面导航对齐和手机菜单 | [workspace-navigation-visible](../../../tests/e2e/workspace-navigation-visible.spec.ts)：直接列出的业务链接、几何对齐、跳转刷新及 320/360/390px 顶部菜单。 |
| 导航搜索与键盘操作 | [workspace-navigation-search](../../../tests/e2e/workspace-navigation-search.spec.ts)：五岗位，管理员另测英文，匹配/清空/焦点/空结果、跳转刷新、短屏与窄屏。 |
| 闲置后的导航恢复 | [stale-navigation-recovery](../../../tests/e2e/stale-navigation-recovery.spec.ts)：正常客户端切换、桌面/390px闲置后的整页文档请求；仅推进当前页面时钟，不证明真实锁屏或BFCache。详见[恢复测试边界](auth-read-paths.md#怎样阅读原找回与闲置恢复测试)。 |
| 审核中心全局入口 | [review-center-entrypoint](../../../tests/e2e/review-center-entrypoint.spec.ts)：管理员桌面单层导航、375px手机菜单分组、实际跳转及横向溢出。只核对导航和页面入口，不证明其他角色的数据库审核权限。 |
| 批发导航顺序 | [wholesale-navigation-order](../../../tests/e2e/wholesale-navigation-order.spec.ts)：管理员/业务员、中英文、1440/375px，独立预期“线索→客户→订单”和完整链接顺序；另核对被移除页面/接口的404合同，404不能单独证明数据库没有写入。 |
| 移除管理板块后的其他入口 | [removed-admin-panels](../../../tests/e2e/removed-admin-panels.spec.ts)：管理员双语及财务中文，1440/390/320px；保留汇率和助手开关、无旧菜单/读取、原地址不存在。助手只打开关闭，不发送内容。 |
| 共用Select键盘和弹窗焦点 | [select-control](../../../tests/e2e/select-control.spec.ts)：费用页类别键盘选择、Escape分层关闭及焦点恢复、首字母USD、390px触控/溢出；不提交费用记录。筛选币种来自已加载费用，手机分支按是否有USD处理，不声称必有USD夹具。 |
| 日期显示与业务值 | [date-picker](../../../tests/e2e/date-picker.spec.ts)：中文及英文输入、闰年错误恢复、日历、焦点和筛选范围，未保存费用记录。 |
| 超过二百条的数据和全部页码入口 | [dashboard-numbered-pages](../../../tests/e2e/dashboard-numbered-pages.spec.ts)：专属 205 条费用、独立总数、筛选/末页/刷新；另检查十三类页面的页码和信贷子列表。 |
| 认证页动效 | [auth-motion](../../../tests/e2e/auth-motion.spec.ts)：首屏令牌和 reduced motion。 |
| 工作台动效 | [motion](../../../tests/e2e/motion.spec.ts)：菜单层叠/关闭、待办动画和手机宽度。待办为空时不会验证条目动画，不可据此算所有列表状态通过。 |

动效原文件五个场景按两类入口分开，组名、步骤和断言保持；其他文件只展开密集表达和配置。没有为了复用两三行几何断言新建大量小模块。

## 断言如何对应当前实现

[页面外壳](../../../components/dashboard/dashboard-page-shell.tsx)输出唯一标记，[共享搜索框](../../../components/dashboard/dashboard-section-panel.tsx)输出输入及图标标记。批发[单元格](../../../components/dashboard/wholesale/wholesale-ui.tsx)使用低强调边界；测试读单元格，不能改读没有实际分隔线的行。

[桌面导航](../../../components/dashboard/admin-shell-desktop-nav.tsx)把有权限的入口排成一列，搜索位于滚动区之外；[筛选 Hook](../../../components/dashboard/use-admin-shell-nav-search.ts)只搜索已有权限清单，去空白、忽略大小写，路径变化后复位。[链接组件](../../../components/dashboard/admin-shell-nav-links.tsx)使选中项只换颜色、不改横向位置。[手机菜单](../../../components/dashboard/admin-shell-mobile-nav.tsx)由 activeLabel 命名。

管理员全局审核入口来自[工作台配置](../../../lib/workspace-config.ts)，管理员/业务员的批发顺序来自[批发模块](../../../lib/workspace-wholesale-module.ts)。测试保留独立的预期数组，不直接复用生成菜单的数组，否则实现顺序错了也可能一起通过。手机菜单仍显示分组标题，桌面直接排列全部链接，两者断言不能混用。

[费用筛选](../../../components/dashboard/company-expenses/company-expenses-filters.tsx)调用[共用Select](../../../components/ui/select.tsx)，选项Portal位于页面末尾。测试先等role=option挂载，再执行Escape或外部点击；嵌套弹窗第一次Escape只关菜单，第二次关表单。[辅助函数](../../../tests/e2e/helpers/select-control.ts)同时查看触发器文案和隐藏input值；它没有提交费用或核对费用数据库。

## 截图怎样保留每轮证据

上述导航顺序和移除板块测试的四个截图表达式改用testInfo.outputPath，让截图归属当前测试和重试。整轮仍必须用新的--output目录；Playwright会清理本轮目标目录，单独改变文件名或使用outputPath都不能保护被再次指定的旧目录。原套件准入尚未满足时不执行命令，也不改换认证入口冒充原套件通过。

独立受控DOM探针执行源码抽取的四个路径表达式：旧固定路径第二次写入实际覆盖四份图；两个新输出目录共八份图互不覆盖，第二轮后第一轮SHA仍一致。探针只验证真实Chrome截图的文件归属，不证明这些原页面场景运行成功。原七个测试声明/展开十场景、定位器、角色、宽度、菜单顺序和断言主体保持，只有截图参数、元数据参数及解释性注释改变；完整证据见[职责收尾记录](../reference/verification-2026-11-06-workspace-test-review.md#2026-11-10导航与select原源码审查)。

邮件列表读取使用 POST /api/mail/threads，但它是查询；[查询 Hook](../../../components/dashboard/mail/use-mail-workspace.ts)将 busy 设为 threads，[标题组件](../../../components/dashboard/mail/mail-thread-list.tsx)据此显示等待图标。首页复制由[邀请卡片](../../../components/dashboard/dashboard-home/dashboard-home-invite-section.tsx)的 pendingCopyId 控制，模拟等待不是实际剪贴板写入凭证。

日期辅助 [date-control](../../../tests/e2e/helpers/date-control.ts)读取的是 data-value 公开业务字符串，显示文本会随语言改变；它没有直接核对最终 FormData。真实表单提交需另看写入流程。原误导性的注释已校准，函数行为保持。

## 分页夹具为何必须隔离

文件会插入固定月份的 205 条费用，并可能准备当天汇率，后者会影响关联金额。新 beforeAll 要求显式 disposable 模式、Web 和 Supabase 本地地址；声明仍不能证明实际完整隔离，原入口限制也没有解除。

当前费用视图的 monthFilter 初始为 all，因此固定一月记录不会被默认当前月份排除。清理只按本批 UUID 删除，核对返回的 205 个编号后，再用独立 PostgreSQL 查询确认本批唯一标记残留零条。原汇率辅助仅删除本次建立的报价，既有报价不覆盖；本轮未运行这段准备或清理。

## 怎样验证修改

先读 import，再沿“登录/专属准备 → 页面动作 → 可见结果 → 独立数据 → finally 清理”追踪。本轮原步骤对照、类型、lint、学习及准入检查不替代原页面运行。公开页动效用例也仍保留原 auth 导入链。

执行原套件前，需解决[既有访问与环境准入](../../real-e2e-blockers.md)，并提供实际可重建的完整隔离实例。页面验收应记录语言、宽度、加载/空/错/权限状态，以及刷新、控制台和适用写入凭证。原用例没有覆盖的状态不能因源码读过而算通过。

参考 [Playwright 用户可见行为与隔离原则](https://playwright.dev/docs/best-practices)、[定位器](https://playwright.dev/docs/locators)和[可重试断言](https://playwright.dev/docs/test-assertions)。几何 evaluate 的值是一次采样，不能把静态断言当作实际响应式结果。
