/** 保存接口是模板自带的可选能力；普通 HTML 可以原样使用，不因此被拒绝上传。 */
export function declaresTemplateSaveProtocol(content: string) {
  return content.includes("PT5Template") && ["exportState", "importState", "subscribe"].every((key) => content.includes(key));
}
