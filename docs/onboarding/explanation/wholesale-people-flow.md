# 批发目录与两种推荐关系

在批发工作台中，客户档案、人员目录和客户推荐树是三个页面。管理员的入口依次是 `/admin/wholesale/customers`、`/admin/wholesale/people` 和 `/admin/wholesale/referrals`。其他岗位按工作台业务配置和数据库授权进入相应页面。

| 需求 | 代码与数据 |
| --- | --- |
| 搜索或显示客户档案 | [客户区块](../../../components/dashboard/wholesale/wholesale-customers-section.tsx) 持有筛选和弹窗状态，交给[目录筛选](../../../components/dashboard/wholesale/wholesale-people-filters.ts)查客户名、别名及联系信息。档案在 `wholesale_customers`。 |
| 查看业务员资料 | [账号资料服务](../../../lib/wholesale-profiles.ts) 按用户编号拼接 `user_profiles` 与角色关联。桌面表格和手机卡片从[人员目录](../../../components/dashboard/wholesale/wholesale-people-directory.tsx)进入同一个只读弹窗。 |
| 关联一个登录账号或开通业务 | `registered_user_id` 指向客户登录账号，`assigned_sales_user_id` 指向负责人。[账号关联表单](../../../components/dashboard/wholesale/wholesale-customer-account-link.tsx)读取尚未关联合适档案的账号。[开通业务确认框](../../../components/dashboard/client-business-add-dialog.tsx)读取未开通批发的客户，包括已有档案的客户。[客户账号操作](../../../components/dashboard/wholesale/wholesale-customer-account-actions.ts)分别提交两类操作。 |
| 查看或新增客户推荐 | [客户推荐区块](../../../components/dashboard/wholesale/wholesale-referrals-section.tsx) 按客户档案编号建立目录，并按可见客户分页。表单提交给批发写入执行器，在 `wholesale_referrals` 保存一条有方向的关系。 |
| 维护账号推荐树 | [referrals.ts](../../../lib/referrals.ts) 从数据库取得授权的用户编号与关系，[referrals-graph.ts](../../../components/dashboard/referrals/referrals-graph.ts) 组织人员索引，展示层筛选可见分支。此组件由旅游渲染器调用，目前旅游业务停用。 |

批发服务按栏目选择查询，并通过 `scopeWholesaleRows` 组织已授权的数据。搜索在当前可见集合内工作，不能扩大角色权限。界面上的「公司」根节点用于说明路径，不产生数据库推荐边。

## 原业务员协作入口测试

[wholesale-salesman-collaboration](../../../tests/e2e/wholesale-salesman-collaboration.spec.ts)保留四个原场景：第一业务员打开同事客户/订单表单及候选负责人，第二业务员找到同事订单，管理员/业务员/财务在1440/390px检查直接修改入口，手机卡片打开详情及编辑弹窗。标题沿用历史能力描述，当前正文不提交编辑、转派或合并，不提供实际写入凭证；入口可见不证明API或RLS允许写入。真正修改和刷新后的业务结果须另验。

专属夹具需客户“业务员协作客户”、订单c2000000-0000-4000-8000-000000000100/WH-PEER-LOCAL-001，以及本月WH-LOCAL-YYYYMM-001和两名业务员的正确姓名/关联；测试不创建或修复这些固定数据。第一订单用现有跨日期精确查询查找，不放宽默认30天范围。各岗位本身仍需独立开通批发业务。

登录也可能写阅读状态，所有场景先核验专属API/DB/Kong和off/0/0。手动context必须显式继承本次baseURL和viewport，newPage位于收尾保护范围；正文包括非Error值与关闭错误合并，不让关闭失败掩盖最初原因。原四Auth页面/真实数据/1440和390应用仍未执行。

维护后执行`node --test scripts/e2e-fixture-policy.test.mjs`，当前36项含4项协作资源回归；SQL/页面端口明确模拟。真实Chrome受控HTML只核对当前辅助的桌面/手机入口分支及资源故障，旧代码漏关已复现，不能当真实岗位/应用验收。[本批证据](../reference/verification-2026-11-05-wholesale-people.md#2026-11-10原协作入口与手动上下文)

## 原客户管理测试

[wholesale-customer-management](../../../tests/e2e/wholesale-customer-management.spec.ts)保留键盘打开/返回焦点、管理员创建编辑删除、业务员创建编辑删除、390px编辑弹窗和有订单客户拒绝删除五个场景。前置检查显式专属DB/Kong/API、端口/网络和`off|0|0`；原Auth/管理员辅助仍受限，本轮不加载或运行这些原页面场景。

两个创建场景复用[客户别名夹具](customer-alias-tests.md)，先分配UUID名称和备注，所有业务写入仍从页面发起。创建后先绑定真实客户ID、核对修订1和原别名，再用独立Docker只读连接核对联系信息、来源与备注。编辑后应是同一ID、修订2、完整别名集合和新字段；刷新再读完整行/版本仍一致。删除后独立按ID、唯一名称分别核对零记录，再刷新搜索。Toast和列表消失不能单独证明保存或删除完成。

固定的Wholesale Alpha必须预先具备订单。拒绝删除前保存完整客户行/版本与订单数量，拒绝后再查它们不变并刷新重新打开；空订单夹具不能误充“有订单保护”通过。夹具显式依赖本次page，退出先关页面，再核验目标并按归属/修订回收；关闭失败也清理，主体、关闭、数据库错误同时保留。在途服务器提交尚未确认时仍需保留专属实例核对，不声称覆盖全部中断场景。

实际完整结构副本中，以管理员/业务员SQL身份核对创建→修订更新→旧修订拒绝→删除→重复删除拒绝，当前SQL读回/零残留函数与实际SDK参与；保护客户及订单完整行/xmin保持。45次SQL和17项夹具回归证明各自边界，不替代原Auth/完整PostgREST/真实页面的中英文/响应式验收。[本批范围与凭证](../reference/verification-2026-11-05-wholesale-people.md#2026-11-10原客户管理与完整凭证)

原 [公司分支展示测试](../../../tests/e2e/referral-tree-company-branch.spec.ts) 访问的是客户推荐目录，不是停用旅游业务的账号推荐树。实际链路是动态批发栏目 → `getWholesalePageData` 查询 `wholesale_customers` 和 `wholesale_referrals` → `scopeWholesaleRows` → `WholesaleReferralsSection` → [目录构造](../../../components/dashboard/wholesale/wholesale-referrals-display.ts)。构造时有公司根节点，分页时只保留客户记录；祖先名称在记录前显示为「公司 → 客户名」路径。因此页面测试应在「客户推荐树」区域检查路径和「公司子类」，不应要求一张独立公司卡片或「主分支」徽标。

这两例依赖非空种子客户和至少一名公司直属客户；空集合应按空数据场景另验。它们只检查中文显示和页面宽度，没有证明完整推荐关系、佣金算法、数据库权限或写入成功。登录助手还可能确认公告并保存阅读记录，不能把整个运行过程当成无副作用的只读检查。原认证入口仍受限，且本轮按用户要求跳过注册/推荐重复业务验证；两例保持 `not_run`。[源码核对与限定验证记录](../reference/verification-2026-11-06-classification-access-e2e-review.md#2026-11-10推荐目录与注册向导原源码)

| 岗位 | 当前客户档案入口与操作 |
| --- | --- |
| 管理员、业务员 | 可进入客户目录，建档、编辑、删除无关联限制的档案，并可关联合格注册账号。 |
| 财务 | 可进入客户目录、查看档案及关联合格注册账号。建档、编辑和删除由数据库权限限制。 |
| 经理、运营、招聘、客户 | 即使专属账号被开通批发业务，当前客户档案栏目也会转到访问受限页。 |
| 推广 | 当前岗位没有已启用业务，登录及直接访问客户目录均会进入业务暂不可用页。 |

[岗位能力](../../../lib/wholesale-role-permissions.ts)分别提供档案写入和账号关联能力。[批发栏目配置](../../../lib/workspace-wholesale-module.ts)控制各岗位可以进入的栏目。数据库的有效业务权限、表策略和写入函数负责最后校验。维护时可用 `npm run test:learning:browser -- wholesale-customer-role-matrix` 复跑八岗位入口、财务关联和管理员、业务员删除。

改客户资料时，从[客户弹窗编排](../../../components/dashboard/wholesale/wholesale-customer-dialogs.tsx)进入，沿[客户操作](../../../components/dashboard/wholesale/wholesale-customer-actions.ts)和[数据库写入](../../../components/dashboard/wholesale/wholesale-customer-mutations.ts)追踪。创建需核对客户编号，编辑需读回同一编号及新值，关联需核对 `registered_user_id`。删除需用独立查询确认档案已移除，并验证已有订单、线索来源或资料文件的档案被拒绝。

维护资料字段可从[详情展示](../../../components/dashboard/wholesale/wholesale-customer-details.tsx)和[客户表单](../../../components/dashboard/wholesale/wholesale-customer-form.tsx)定位。关联不会重建客户档案。数据库用原档案编号保存 `registered_user_id` 和 `customer_kind`，同时在 `user_workspace_business_access` 启用该注册账号的批发入口。合并后刷新应显示已关联账号，且此前的资料字段仍可读。

合并请求断线时，表单保留所选账号并提示刷新核对。若原档案已经关联同一账号且该账号的批发入口已启用，重试会返回原档案作为确认凭证，档案版本、授权人和授权时间不变。另一账号仍需通过数据库的关联检查。

管理员可在客户目录点「添加客户」单独开通批发业务。候选由 `admin_list_client_business_candidates` 按业务授权筛选，和合并档案候选分别读取。`admin_add_client_to_business` 开通批发入口，同时保留原档案或补建一份。页面再按所选账号确认档案编号和授权。断线或回执异常时，确认框保留搜索内容，提示刷新核对。复跑用 `npm run test:learning:browser -- wholesale-client-business-add`。

详情页的新增名称调用 `append_wholesale_customer_other_names`。它按现有行权限锁定客户，读取最新别名，复用数据库的去重规则，再返回该客户编号、最终名称和是否写入的凭证。两个会话都能追加自己的新名称。已有名称重试时保留行版本，页面提示用户核对已有名称。连接中断后先刷新核对，页面会保留原输入。

整表编辑会带上打开时的 `edit_revision`。别名追加、关联账号或其他客户写入都会更新档案版本。保存只接受与数据库一致的版本。遇到冲突时，先保留表单输入，刷新页面，再重新打开档案核对最新资料。保存回执丢失时，刷新后可直接核对修改是否已经生效。

修改推荐表单时，核对关系方向。保存成功应取得同一父、子客户对应的唯一数据库记录。重复提交失败后，当前表单应保留输入，刷新后仍只有原来的边。查看人员详情是只读操作，退出弹窗应回到打开它的按钮。

本地检查命令为 `npm run test:learning:browser -- wholesale-people-directory wholesale-customer-referrals`。测试使用专属账号和两条无订单的客户档案，写入后通过 Docker 独立核对关系编号、方向、创建人、刷新结果和清理数量。

别名回归用 `npm run test:learning:browser -- wholesale-customer-alias-concurrency`。需要本地数据库已应用对应迁移。用例从两个浏览器会话发起保存，独立核对别名数组与行版本，覆盖重复提交、回执丢失、客户拒绝和夹具清理。

档案回归用 `npm run test:learning:browser -- wholesale-customer-record`。中文桌面和英文手机各用一名专属管理员和一名合并候选。测试先建档，再编辑、合并、尝试删除有订单的档案，最后移除专属订单并从页面删除档案。每步通过 Docker 核对编号、版本和实际结果。

并发编辑回归用 `npm run test:learning:browser -- wholesale-customer-edit-conflict`。两个会话分别提交整表编辑与别名。独立检查旧版本拒绝、输入保留、新版保存，以及提交后断开响应时刷新能读回最终资料。

合并断线回归用 `npm run test:learning:browser -- wholesale-customer-link-recovery`。测试分别在请求提交前和数据库提交后断开，核对档案及授权的终态、原表单重试、刷新和客户角色拒绝。

删除保护回归用 `npm run test:learning:browser -- wholesale-customer-delete-protection`。由线索转换的档案可继续编辑，详情解释保留原因。有资料的档案在确认框内显示阻止删除的原因。用例通过 Docker 核对线索关联、客户与资料版本、移除专属资料后删除及刷新结果。它使用仓库的本地模板种子创建专属文档，清理只针对本次编号。

删除断线与并发回归用 `npm run test:learning:browser -- wholesale-customer-delete-recovery`。提交前断线时，刷新仍可看到原档案。数据库提交后丢失响应时，确认框提示刷新核对，刷新应看到档案已移除。并发请求实际影响零行时，数据库返回失败，由同一个确认框提示核对。独立查询同时确认原客户编号和档案归档计数。

客户资料与档案删除的并发回归用 `npm run test:learning:browser -- wholesale-customer-document-upload-race`。上传先在客户归档中登记文件，再写入 Storage 并核对内容指纹。上传登记先完成时，删除确认框显示仍有资料，档案与文件都保留。删除先完成时，原目录的上传请求被拒绝，数据库与 Storage 均无该文件。用例从客户目录和资料页分别发起请求，两页刷新后核对结果。
