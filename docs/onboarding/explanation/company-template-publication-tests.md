# 怎样维护公司模板发布与预览测试

[原入口](../../../tests/e2e/company-templates.spec.ts)保留固定模板/版本、七个内部岗位、合成HTML和注册顺序。先按场景找代码，再看既有[页面/载荷/记录辅助](document-test-fixtures.md#公司模板正文和操作回执)。本轮未执行原Auth或18个产品场景。

| 入口 | 解决的问题 | 怎样核对 |
| --- | --- | --- |
| [访问](../../../tests/e2e/helpers/company-template-access-cases.ts) | 内部岗位、客户及手机工作栏入口。 | 原登录、页面按钮、403后数据库无模板；公告关闭辅助在调用模块。 |
| [预览](../../../tests/e2e/helpers/company-template-preview-cases.ts) | 超时重试、GET/HEAD、报价交互/图片/打印、脚本中HTML字符串。 | iframe实际内容、遮罩、刷新、手机说明；打印标记只证明调用。 |
| [发布](../../../tests/e2e/helpers/company-template-publication-cases.ts) | 新建、上传、指南沿用、回退、停用、重复发布、业务失败和断线。 | 页面发起原关键操作，独立查修订及hash；修订1→2→3→4，重送只生成1版本。 |
| [拒绝与故障](../../../tests/e2e/helpers/company-template-security-cases.ts) | 缺失/错误/超限/不安全文件、指南失败、旧修订冲突和哈希不符。 | 原请求与错误保持；故障注入/恢复额外核对完整行和实际影响数。 |

publication/security分阶段注册，保持原11处声明展开后的18个标题和顺序。入口只提供共同输入和调度，场景只负责页面流程；选择器、载荷和数据库读取继续复用原辅助。没有生产路由、权限、格式兼容或金额算法变化。

## 本次创建的模板归谁

脚本片段和发布生命周期使用UUID标记。清理意图在上传前就存在，即使提交成功而编号读回失败，也可按完整UUID名称精确找回。重试场景在请求前生成模板/版本UUID，仍重送同一组编号。旧公共名称和时间戳前缀不能用于批量删除。

[限定记录帮助](../../../tests/e2e/helpers/company-template-records.ts)核对已知编号或完整UUID名称、绑定文档、实际影响编号及模板/版本的独立零行计数。它的22项检查本轮与9项新哈希/收尾检查一起运行，共31项通过；不代表原页面发布成功。若仍有额外引用而删除失败，必须保留失败与专属实例证据，不放宽外键或吞掉错误。

[统一收尾](../../../tests/e2e/helpers/company-template-case-lifecycle.ts)先排空路由、关闭页面，再限定清理或恢复。关闭失败时跳过数据修改，仍尝试附件；正文、清理/恢复、附件错误一起报告。附件包含关闭状态、明确回收凭证和故障证据，未知结果不算已确认。

## 固定版本哈希故障怎样恢复

[数据核心](../../../tests/test-support/company-template-hash-fault.ts)只接收原管理员客户端来源、声明的本地API、编号、原SHA及显式SQL能力，不发现账号或读取密钥。SDK与声明API须同一本机HTTP来源；原local-supabase还核验专属DB/Kong/网络/API/off/0/0。传入SQL能力不代表有权在共享实例运行。

注入前读取完整父模板/版本及xmin，核对当前版本关系和原HTML真实摘要。锁内再次比较整图，实际UPDATE必须1行；父模板不变、版本只改hash并产生新xmin，独立查询必须相同。原页面内容接口随后验证409和原失败正文，再核对故障仍生效。

恢复只接纳先前注入凭证，锁内比较后实际修改1行，恢复原版本整行逻辑内容并独立读回。恢复产生新xmin，不能伪装成原事务。其他写入产生同值新版本，或注入/恢复提交回包丢失时，拒绝盲写；不能把当前图采为新期望。

## 可以运行哪些验证

```powershell
node --experimental-strip-types --test scripts/learning/company-template-hash-fault.test.mjs scripts/learning/company-template-records.test.mjs
```

31项使用明确内存端口检查缺失/未知响应、归属和多错误收尾。实际锁/CAS/UPDATE/触发器另在无网络、无端口的PG副本验证。真实Chrome核对当前收尾模块和既有生产正文路由的sandbox响应；后者访问/仓储边界明确模拟，不是原登录或真实发布全栈。

AST核对保留11处声明、18个注册场景、认证/管理员和页面调用，7个未改场景体相同。场景局部类型用两个仅在内存存在的声明边界检查绑定，没有生成运行时登录，也不是受限Auth的完整类型检查。原18场景、1440/390中英文/状态矩阵、完整回归和构建仍需原入口获准后执行。[本轮证据](../reference/verification-2026-11-11-company-templates.md)
