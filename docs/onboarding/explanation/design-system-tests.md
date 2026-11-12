# 怎样维护视觉与控件测试

这里说明原端到端测试的职责与断言，不代表本轮已运行页面。原认证及固定账号入口限制仍有效；当前注册／推荐安全重复验证按用户要求跳过。

## 原响应式综合场景

[dashboard-responsive-ui](../../../tests/e2e/dashboard-responsive-ui.spec.ts)保留首页1280px边界、五岗位超窄屏顶栏、触控/账号锚点，以及公司费用筛选/弹窗首屏四组声明，岗位循环展开后8个场景。文件只组织这些共同的响应式规则、局部测量和专属执行前置，不再拆出零散工具；费用弹窗打开后关闭，没有保存费用。首页自动排列检查假定专属夹具具备默认五类组件，不能清空现有用户布局来满足它。

原头像对比度测量把CSS颜色前三个数字当成RGB，遇到`oklch()`或`color(srgb ...)`会错算。现在让浏览器通过1px sRGB Canvas转换计算样式，核对实色后按[W3C相对亮度公式](https://www.w3.org/TR/WCAG21/relative-luminance.html)计算，使用0.04045线性化阈值；[Canvas读取颜色空间](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getImageData)负责转换。透明色或不能测量时明确失败，不假定底色；这是本头像指定实色的对照，不是整站/所有叠层的无障碍审核，也不校验真实剪贴板。

`expectNoClippedHomeWidgets`先等待可见卡片，再比较scrollHeight/clientHeight；空加载页面不能以空数组通过。`beforeEach`在原固定角色登录前核验专属DB/Kong/API、网络与`off|0|0`，但实际Auth辅助绑定仍须另外确认。本轮只对当前测量回调与前置做受控验证，原Auth套件、真实首页布局/拖动/缩放没有重复运行。1440/390px的20项Chrome探针、12项合成前置及限定类型/lint见[本批记录](../reference/verification-2026-11-06-design-visual-review.md#2026-11-10原响应式综合场景)。

## 从现象找入口

| 要检查的现象 | 维护位置 |
| --- | --- |
| 登录、公开页面、权限提示及工作台截图 | [视觉场景](../../../tests/e2e/design-system-visual.spec.ts)。1440／390px 主截图，768px 页面与日期浮层边界，首页另查 1280px。 |
| 认证大号控件与费用弹窗普通控件是否同源 | [控件一致性场景](../../../tests/e2e/design-system-controls.spec.ts)。保留原两个宽度、组名和步骤，打开弹窗但不保存费用。 |
| 截图准备、命名和视口溢出 | [截图辅助](../../../tests/e2e/helpers/design-system-visual.ts)。减少动效、导航后重新注入样式、原 1.5% 像素差异阈值；整页允许 2px，浮层边缘允许 1px 的几何误差。 |
| 认证页区域、标签、可操作高度与退出 | [认证辅助](../../../tests/e2e/helpers/design-system-auth.ts)。第一项输入的 label/id、可见控件高度；退出通过页面按钮完成。 |
| 对比度、颜色、边框和焦点 | [控件辅助](../../../tests/e2e/helpers/design-system-controls.ts)。从浏览器读取选定令牌和实际计算样式。 |
| 筛选区静止与聚焦层级 | [筛选辅助](../../../tests/e2e/helpers/design-system-filters.ts)。展开条件、检查至少五个控件和预设按钮，通过后恢复原折叠态。 |

截图辅助还供批发提成合并用例使用，原导出名称保持。其他职责直接从对应文件导入，没有额外转发层。

## 断言对应什么实现

认证 [AuthShell](../../../components/auth/auth-shell.tsx)组装两栏；[照片说明区](../../../components/auth/auth-hero-panel.tsx)在 lg 断点显示，[补充说明](../../../components/auth/auth-supplemental-note.tsx)在小屏显示。测试读取 data-auth-region 与计算位置，没有提交注册或登录表单的业务凭证。

[AuthField](../../../components/auth/auth-field.tsx)使用共享 Field/Input，显式采用 large。[表单控件](../../../components/ui/form-controls.tsx)和 [Select](../../../components/ui/select.tsx)读取相同密度上下文；普通表单用明确边界，筛选用浅边界。[主题令牌](../../../app/theme.css)的大号输入和按钮高度均为 3.25rem，原场景在默认 16px 根字号下断言 52px。

[日期预设](../../../components/dashboard/dashboard-order-filter-section.tsx)根据完整范围计算 aria-pressed，并选择 primary／outline 按钮。[批发筛选](../../../components/dashboard/wholesale/wholesale-order-filters.tsx)启用桌面折叠；辅助需先展开才读取各类输入的最终边框。[日期浮层](../../../components/ui/date-picker-popup.tsx)使用视口碰撞处理，测试针对最后一个仍打开的浮层采样。

## 怎样修改和判读结果

先区分颜色语义、几何尺寸、数据内容与业务写入。跨尺寸只比较共享语义颜色和边框，字号与高度可有意不同。截图失败时先核对浏览器、系统、字体、数据和基线环境，再审查差异；不能直接更新截图消除失败。[Playwright 官方说明](https://playwright.dev/docs/test-snapshots)特别提醒基线需在一致环境生成。

文字与状态令牌按 4.5:1，选定边界与焦点令牌按 3:1，均不先四舍五入。这里的换算器只支持当前十六进制颜色令牌；主题若改为其他颜色格式，需要同步调整换算与验证。它没有遍历所有真实文字、背景、控件及主题，不是完整 WCAG 验收。[文字对比度](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)与[非文字对比度](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)的适用条件应分别核对。

原场景主要设为中文，没有因读取中英文菜单选项就完成英文页面验收；代表订单截图还要求至少一条可见订单。本批没有生成业务夹具、读取凭据文件或执行原套件，也没有更新截图。原固定种子与隔离前提见[原套件阻塞记录](../../real-e2e-blockers.md)。

源码整理先运行类型、定向 lint、学习检查，并核对场景/函数 AST 与摘要。生产控件改动仍须从真实页面验证中英文、桌面/手机、加载/空/错/权限及刷新；保存动作另需独立最终凭证。静态对照不替代这些验收。
