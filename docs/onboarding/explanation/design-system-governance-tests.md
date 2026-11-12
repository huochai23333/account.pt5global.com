# 怎样维护尺寸与表单治理用例

本页介绍原套件源码及独立故障检查，不表示原浏览器用例已通过。原固定账号认证入口继续受限；专属环境声明也不能证明数据库实际隔离。

## 文件与职责

| 修改目标 | 文件与边界 |
| --- | --- |
| 高度、分页与 VIP 宽表断点 | [尺寸用例](../../../tests/e2e/design-system-governance.spec.ts)。三类几何职责，390/768/1440px。桌面高度只读取可见控件，不代表收起的全部条件已测。 |
| 指标与助手避让、字段及失败输入 | [表单用例](../../../tests/e2e/design-system-forms.spec.ts)。费用指标、订单指标、公告/费用/汇率/反馈及运营报销，原六个非待办场景中三个在此。 |
| 待办表单错误与专属记录 | [待办用例](../../../tests/e2e/design-system-todo-form.spec.ts)。始终从页面创建自己的记录，不编辑已有第一条待办。 |
| 高度、字段关联、焦点及溢出断言 | [共享断言](../../../tests/e2e/helpers/design-system-governance.ts)。原三个函数只移动，函数体与参数保持。 |
| 独立数据库凭证与限定回收 | [待办数据库适配](../../../tests/e2e/helpers/governance-todo-database.ts)。仅本项目本地容器与 54321 端口；每次调用核对显式专属环境。 |
| 异常后的生命周期收尾 | [专属待办生命周期](../../../tests/test-support/owned-governance-todo.mjs)。接收读、页面创建、精确删除适配，不导入认证入口或数据库连接。 |

六个非待办场景的步骤和断言 AST 保持；新增表单 beforeAll 要求显式 PT5_E2E_FIXTURE_MODE=disposable、PLAYWRIGHT_BASE_URL 与 NEXT_PUBLIC_SUPABASE_URL。费用和全局汇率表单即使预期缺项失败，也必须在实际可重建完整实例执行。

## 字段如何关联

[Field](../../../components/ui/form-controls.tsx)生成控制编号和描述编号，[字段上下文](../../../components/ui/form-field-context.tsx)将 id、aria-describedby、aria-required 传给输入、选择和日期控件。[FormDialog](../../../components/dashboard/dashboard-form-dialog.tsx)显示错误反馈并调用业务提交，不能从弹窗存在或按钮点击判断保存成功。

标准断言检查每个字段的标签、必填与描述元素，再把焦点移到首控件。待办编辑使用[同一个弹窗合同](../../../components/dashboard/dashboard-home/dashboard-home-todo-dialog.tsx)，[上层 Hook](../../../components/dashboard/dashboard-home/use-dashboard-home-todos.ts)负责校验、调用服务和等待状态，[待办服务](../../../lib/user-todos.ts)访问实际 user_todo_items 与数据库函数。样式断言不代替这些写入结果。

## 待办为何需要限定清理

旧代码只在列表为空时创建临时记录，并将删除放在所有断言之后。静态审查发现断言失败会跳过删除，正常路径也只看页面隐藏。旧原套件未运行，不能声称已在原环境复现。

新流程先核对随机完整标题不存在，从页面创建，再独立读取唯一 id/user_id/title，刷新后再编辑。空标题失败时核对真实记录原样保留。正常删除从页面完成，独立查询为零，再刷新确认消失。

页面等待或断言失败后，生命周期仍按完整标题查回。只允许单条有效记录，删除同时限定 id、user_id、title，核对实际返回数组并再次查询零残留。多条、所有者变化、零影响或残留均失败；清理和原流程都失败时保留两个错误。进程被终止等无法执行收尾的场景仍需在专属实例检查，不能算已验证。

[八项内存故障检查](../../../scripts/learning/owned-governance-todo.test.mjs)随 npm run test:learning 执行，验证归属、异常回收和失败判定。它们没有连接浏览器或数据库，不证明 SQL、UI、重复提交和实际终态已经通过。原套件还需解决[准入限制](../../real-e2e-blockers.md)，保留原认证链后在完整隔离实例运行。

夹具准备、正文和回收应有共同生命周期；参考 [Playwright 夹具机制](https://playwright.dev/docs/test-fixtures)。本批将限定回收做成可独立注入故障的域辅助，没有为执行原测试另换账号入口。
