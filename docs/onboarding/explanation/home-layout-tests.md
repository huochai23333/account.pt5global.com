# 怎样维护首页布局测试

这是原固定账号套件的源码指南，不是本轮运行结果。先读[首页真实数据链](home-data-flow.md)：页面按身份与 scope 读取布局，预览不保存，松手或管理动作通过串行保存写入 user_home_widget_layouts。

## 从维护目标找文件

| 目标 | 源码及职责 |
| --- | --- |
| 紧凑布局、组件管理、失败重试 | [customization](../../../tests/e2e/dashboard-home-customization.spec.ts)。390/768px 紧凑视图，添加重复组件、排序/删除、一次模拟保存失败后重试及刷新。 |
| 邀请卡片尺寸与触控 | [invite-controls](../../../tests/e2e/dashboard-home-invite-controls.spec.ts)。保留管理员、业务员、客户循环和串行前提；检查 390/1440px 卡片与按钮，不点击注册或核对真实剪贴板。 |
| 编辑提示、键盘、缩放与拖动的完整调度 | [resize](../../../tests/e2e/dashboard-home-resize.spec.ts)。保持原测试入口与截图上下文，调用下面的专门辅助。 |
| 各类型的最小尺寸 | [widget-minimums](../../../tests/e2e/dashboard-home-widget-minimums.spec.ts)。独立固定期望不从生产常量复制读取，检查禁用按钮与最小尺寸内容。 |
| 页面管理弹窗 | [home-manager](../../../tests/e2e/helpers/home-manager.ts)。打开、重置、原错误检查及关闭；默认路径是 /admin/home。 |
| 卡片定位、几何与裁切 | [home-widget-assertions](../../../tests/e2e/helpers/home-widget-assertions.ts)。真实框、触控尺寸、静止位置、页面与内容溢出。 |
| 动效、方向提示与键盘调整 | [home-resize-editor](../../../tests/e2e/helpers/home-resize-editor.ts)。减少动效、进入/退出弹窗、焦点恢复及可操作高度。 |
| 一次鼠标缩放预览 | [home-resize-preview](../../../tests/e2e/helpers/home-resize-preview.ts)。最小 3×3、放大 4×3、预览期间卡片不移动、松手后尺寸更新。 |

[原持久化辅助](../../../tests/e2e/helpers/home-layout-persistence.ts)继续核对五张卡的编号、宽高、网格位置及刷新；它明确没有独立数据库凭证。[编辑几何辅助](../../../tests/e2e/helpers/home-editor-geometry.ts)检查紧凑编辑结构与工具栏/预览不重叠。这两份本批没有修改。

## 几何值如何对应实际组件

[布局配置](../../../components/dashboard/dashboard-home/dashboard-home-layout.ts)当前有五种卡片、五列网格；最小宽高为公告 2×2、时间 2×2、问候 2×1、邀请 2×2、待办 3×3。默认问候 5×1、邀请 3×2。最小尺寸用例保留自己的固定期望，生产规则变化时先确认业务意图，再同步用例。

[卡片](../../../components/dashboard/dashboard-home/dashboard-home-widget-card.tsx)输出稳定编号、类型、宽高和网格 CSS 属性，内层才执行循环摇晃。拖动滚动静止外卡片，再在标题上按真实鼠标操作；不要让自动等待持续摆动的标题停稳，也不要直接调用产品状态函数代替操作。[样式](../../../app/base.css)按 reduced motion 控制动效。

触控框允许 0.1px 浮点误差；预览期间位置/尺寸变化最多 1px；页面/内容溢出最多 2px。它们是原几何阈值，不能扩大阈值来让失败消失。截图依然在原 resize 测试上下文产生，显式名称和阈值保持。相关鼠标动作见 [Playwright 官方操作说明](https://playwright.dev/docs/input#drag-and-drop)。

## 执行前必须分清的边界

三个会重置布局的文件新增 beforeAll，要求显式 disposable 模式和本地 Web/Supabase 地址；固定账号与原 auth → accounts 链保持，原入口限制没有解除。声明不能替代实际完整隔离，不能在当前共享数据上试跑。[原套件准入记录](../../real-e2e-blockers.md)

公共重置保留原 390×844、管理按钮、重置、900ms 和无错误检查；从原两个内联版本改为公共调用会重复设置同一视口。这是明确的辅助归一，不是函数 AST 完全相同的声明。固定等待和没有错误都不是保存成功凭证。

本轮只整理源码，以下仍为原套件的未完成验收：异常后限定回滚、独立数据库编号/范围/布局回读、写入影响与终态、重复提交、完整英文及错误矩阵。页面刷新对齐只能证明页面恢复，不能替代这些要求。历史专属账号布局验证见[既有改造记录](../implementation-report.md)，不冒充原套件通过。

维护顺序为读取原前置与调用链，确认数据归属，修改专门文件，运行类型/定向 lint/学习与夹具准入检查，再在获准的隔离环境补真实页面证据。原六个声明和整个邀请角色循环做 AST 对照，参数化后八个场景数量保持；这些数字不是本轮执行数量。
