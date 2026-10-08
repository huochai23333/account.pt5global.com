# 可保存的公司互动模板

公司模板发布为 UTF-8 单文件 HTML（最多 5 MB）。互动模板必须提供同步的 `window.PT5Template` 接口；指南文件无需提供接口。

```js
window.PT5Template = {
  version: 1,
  exportState() { return { customer: document.querySelector('#customer').value }; },
  importState(state) { document.querySelector('#customer').value = state.customer; },
  subscribe(notify) {
    document.addEventListener('input', notify);
    return () => document.removeEventListener('input', notify);
  }
};
```

`exportState` 必须返回可直接编码为 JSON 的对象。`importState` 必须同步恢复所有数据、动态行、图片与手动修改标记，然后重新计算展示结果。恢复完成后再次导出必须得到相同数据。数字必须有限，不允许循环引用、函数、临时 `blob:` 图片地址或直接保存用户 HTML。文件和粘贴图片应转为图片 data URL，填写数据与图片合计最多 10 MiB。表单未完成也必须能导出与恢复；打印前可以另做必填检查。

所有影响填写内容的操作都必须调用订阅者：输入、选择、加行、删行、图片读取完成、自定义信息与打印设置变化。只通知实际数据变化；不要监听计算结果 DOM 并反复触发通知。恢复数据期间不要发送变更通知，防止保存循环。

模板在隔离窗口运行，不能读取系统 Cookie、登录信息、localStorage 或调用系统接口。模板不自行保存到服务器，只向系统提供填写数据。公司模板发布弹窗先在相同隔离条件下进行真实的导出→恢复→再导出检查，失败或超过 15 秒会阻止发布。服务端继续校验文件、安全限制和接口声明。正式文档每次打开还会验证恢复往返，失败时保持遮罩并提供重新打开入口。

新文档绑定创建时的模板版本；修改模板接口或字段结构时发布新版本，已有文档仍执行原版。不要改写已经发布的版本。当前报价单的接口源文件位于相邻 Supabase 仓库 `templates/quotation-document-adapter.js`，发布它的迁移内包含相同代码。后续修改同时更新制作源并创建新的版本迁移。

## 制作自检

1. 从空白状态导出、恢复、再导出，数据相同。
2. 填写完整和部分内容，分别重复检查；不能只检查初始空白。
3. 新增、删除动态内容，粘贴和选择图片后检查恢复。
4. 手动编号、日期、打印勾选、汇率及计算结果恢复正确。
5. 通过系统保存，返回“我的文档”再打开，继续增删与修改仍有效。

可从 [最小可保存模板](../examples/company-template-personal-document.html) 开始制作。
