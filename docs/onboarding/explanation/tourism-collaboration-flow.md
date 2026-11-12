# 旅游团队与人员目录

旅游的团队、客户、推广人员和任务栏目仍保留源码。当前启用清单在 `tourism-section-page.tsx` 接管前拦截旅游地址，页面显示服务说明。本地数据库也撤销了普通登录角色直接执行旅游团队查询函数的权限。批发团队或客户功能应沿批发自己的入口定位。

## 维护团队读取和切换

1. `team-management-queries.ts` 读取当前会话可见的团队概览，优先选择请求指定且可见的团队，再读取详情和当前角色允许查看的候选人。`team-management-normalizers.ts` 将数据库返回整理为组件类型。
2. `use-team-management-view-model.ts` 按服务端快照建立本地状态，并负责筛选和编辑草稿。选中团队是可变的显示状态，不能作为本地读回的来源标识。旧服务端快照的请求完成时，结果不得覆盖新快照。
3. `use-team-management-refresh.ts` 提供团队选择、手动刷新和工作台同步入口，`use-team-management-actions.ts` 处理团队与成员写入及会话更新。实际保存调用在 `team-management-mutations.ts`，写入终态需另核对团队编号和成员关系。

团队概览、成员卡片、候选人和客户卡片只渲染传入数据。修改检索时，从 `team-management-utils.ts` 核对现有字段和双语状态标签，再追视图模型的使用位置。

## 维护人员与客户筛选

推广人员页按推广角色过滤，客户页按客户身份和旅游业务权限过滤。两者再用 `tourism-people-display.ts` 的同一个函数搜索名称、联系资料、推荐人和团队，并按状态缩小范围。`tourism-people-table.tsx` 和 `tourism-person-details.tsx` 共享显示合同；客户开通业务保留在原状态 Hook 和后端函数中。

本地执行 `npm run test:contracts -- tourism-collaboration-retained` 验证快照读回、迟到结果和目录过滤。`npm run test:learning:browser -- workspace-notice` 使用真实本地登录，核对旅游深链接仍显示停用说明和实际数据库权限。团队页面正常启用时的读写、同一快照内的并发请求与最终业务凭证需另在隔离环境验证。
