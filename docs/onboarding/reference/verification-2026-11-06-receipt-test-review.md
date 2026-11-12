# 操作凭证、金额与公开地址测试审查

## 2026-11-10原资料回执夹具恢复

本批关闭原个人资料回执测试1份待审，复核既有资料回执单元文件，无新增源码：2047总量保持，2015→2016已审、30→29待审、2受限保持。职责为专属执行准入、原页面交互/读回、条件恢复/资源错误收尾三项；单元文件保留资料/申请回执与增加恢复函数回归，均不超过400行，不继续拆模块。证据为Web `output/learning-profile-receipt-source-review-20261110`。

原清理只按用户编号更新，两次真实SQL连接的值交错会覆盖他处姓名/城市；本次在空PG17模型复现旧问题，再验证当前先读归属、UPDATE加本次字段条件、精确count=1与同用户回执、独立读回原值。原值为空可恢复；已恢复不重写，别处新值、交错后零命中或触发器零更新均拒绝，外来行完整值/xmin及同一行无关字段保留。仅恢复姓名/城市，不声称恢复MVCC版本或获得完整ABA保护。

完整原UI try正文、旧读取/溢出/管理员取得函数有AST对照。UUID取代时间尾数，新增专属DB/Kong/API/off0/0准入，原Auth/管理员import不读取/导入/执行。最后先关本次页面，再独立恢复，关闭失败仍继续；抽取实际finally验证主体/关闭/恢复三个原错误均保留。

65次真实SQL、已安装SDK和当前恢复/收尾函数共11组符合预期；SDK传输为明确REST替身，PG只有本测试最小字段模型，无生产Auth/RLS/权限/真实网关承诺。缺count、空正文、最终读回失败均返回未确认，即使实际恢复已提交也不报已完成。12项明确合成准入1正向/11拒绝，限定安全根类型与两文件eslint通过。既有单元13项保持，新增7项，共20项通过、0失败/取消/跳过；不是原页面1场景通过。

两次验证器SQL字符串缺空格先后失败，原SQL/输出/源码副本保留；修正传输适配器拼接后通过，没有为此改生产代码或迁移。三次空PG17模型均按随机owner核验回收，无网络/端口/共享数据写入，没有新增源码或开发服务。按web-change-quality-gate的Non-rendered路径，README和资料流/后端环境指引同步。原认证页面、真实API接线、在途提交/完整中断和最终完整回归/生产构建未验，整体partial_failed。

2026-11-06。逐段阅读以下 8 份已有测试、直接导入的实现及对应维护命令。定向运行 88 个用例全部通过。各文件保留现有职责，测试数据均为内存对象，未建立登录会话或发送请求。

| 测试文件 | 已核对的风险与预期 |
| --- | --- |
| `scripts/auth-operation-receipts.test.mjs` | 邮件请求只确认受理，用户回执必须有账号编号并匹配邮箱，退出必须返回明确空会话 |
| `scripts/profile-operation-receipts.test.mjs` | 零行资料更新、其他用户、旧字段及错误申请均失败。逐次只改变一个字段，验证各项独立生效 |
| `scripts/verified-action-outcome.test.mjs` | 写入失败时停止刷新，写入完成但刷新失败时返回待刷新状态，顺序正确时完成 |
| `scripts/operator-reimbursement-receipts.test.mjs` | 必须为预期周期、正整数影响行数和有限正金额，错误周期、零行、零金额和无效数值逐项被拒绝 |
| `scripts/company-exchange-rate.test.mjs` | 原始买入价只折算一次，人民币保持 1，缺报价返回空，六位精度及正负半分边界有固定期望 |
| `scripts/wholesale-order-fees.test.mjs` | 服务费、税费及手续费以约定金额核对，手续费基于已舍入费用，零成本和半分边界符合约定 |
| `scripts/wholesale-settlement-unallocated-summary.test.mjs` | 按上海时区和收款日期分月，扣减全部有效分配，忽略冲销，分币种精确合计，跨千行和异常金额有独立期望 |
| `scripts/public-site-origin.test.mjs` | 公开域名配置、转发来源、授权返回路径及日志脱敏。固定目的地对照补足使用被测辅助方法生成期望的部分 |

账号和资料回执可通过 `npm run test:operation-receipts` 维护，金额与来源分别见 `npm run test:company-exchange-rate`、`npm run test:settlement-unallocated`、`npm run test:public-site-origin`。此次运行上表的 8 个文件，88 项原始结果、退出码及日志摘要保存在 Web `output/test-runs/2026-11-06T06-17-25-381Z-7194a2b2-e031-4235-b9d2-18c63f4cdaa6/`。可在 PowerShell 复现。

```powershell
$receiptTests = @(
  'scripts/auth-operation-receipts.test.mjs'
  'scripts/profile-operation-receipts.test.mjs'
  'scripts/verified-action-outcome.test.mjs'
  'scripts/operator-reimbursement-receipts.test.mjs'
  'scripts/company-exchange-rate.test.mjs'
  'scripts/wholesale-order-fees.test.mjs'
  'scripts/wholesale-settlement-unallocated-summary.test.mjs'
  'scripts/public-site-origin.test.mjs'
)
node --experimental-strip-types --test @receiptTests
```

这些断言验证回执、计算和地址策略。页面写入、数据库最终记录、刷新及实际供应商验收继续按各模块的专门记录核对。[验证模块](../modules/verification.md)

另逐段审查学习清单的四个文件。`module-definitions.mjs` 只合并四组定义并补指南路径，`modules/platform.mjs` 保存基础设施模块的手写说明。`check-learning.test.mjs` 检查漏登记、重复归属、失效指南、越界文件、变更后的旧摘要及跨目录归属，`manual-review.test.mjs` 核对源文件改变后旧审查失效、缺少理由被拒绝及完整审查必须拒绝待审项。两份测试的临时目录都在 finally 清理。这些检查已包含于本轮通过的 31 项学习测试，日志编号为 `2026-11-06T06-23-12-418Z-cb6b47d7-f6da-4489-85e3-9d0700e88065`。
