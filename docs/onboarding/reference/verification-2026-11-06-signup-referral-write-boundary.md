# 注册推荐写入权限验证

2026-11-06。普通登录账号能直接调用两个旧注册辅助函数，并把第三方账号编号当作注册目标。旧函数会为目标写入批发推荐关系和工作区授权，但不会完成正常注册的客户建档和邀请码计数。[本地修复迁移](../../../../PT5-dropshipping-supabase/supabase/migrations/20261106002000_restrict_signup_referral_helpers.sql)

| 检查点 | 独立数据库凭证 |
| --- | --- |
| 修复前的越权调用 | 一个普通客户调用两种签名，分别指定其他两个合成客户。独立查询得到 2 条推荐关系、2 条启用的批发授权、邀请码使用次数为 0 |
| 候选修复和本地应用后 | 同一调用被权限拒绝。独立查询的推荐、授权及邀请码用量均为 0。访客仍可查询邀请码上下文并得到批发业务锁定结果 |
| 正常注册回归 | 向 Auth 表插入合成注册记录，真实注册触发器完成客户档案、推荐关系和启用权限，各一条。邀请码使用次数增加 1 |
| 清理 | 探针回滚后合成 Auth 账号为 0，专属副本及临时结构快照已清理 |

注册表单先查 `get_signup_invite_context`，提交通过 Supabase Auth。当前 Auth 触发器统一处理推荐关系、客户建档和邀请码用量。修复只撤销访客及普通登录角色对两种内部写入签名的权限，服务角色保留权限。注册 URL、表单请求和公开邀请码查询合同沿用原定义。[表单校验](../../../components/auth/register-form-validation.ts) · [注册提交](../../../components/auth/use-register-wizard.ts) · [Supabase 函数权限](https://supabase.com/docs/guides/database/functions#function-privileges)

本地迁移集合由 229 增为 230，导出索引与本地库一致。旅游停用、批发启用，调度关闭，活动任务和外部请求均为零。证据在后端 `output/learning-signup-write-boundary-20261106/`。本批完成数据库触发器回归，浏览器注册、OTP 和本地收件箱仍属原注册验收范围。
