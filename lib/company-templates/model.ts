/** 版本记录只保存发布后的文件信息；正文由内容接口按需读取，列表页不会把整份 HTML 送到浏览器。 */
export type CompanyTemplateVersion = {
  guide_sha256: string | null;
  guide_source_filename: string | null;
  html_sha256: string;
  id: string;
  published_at: string;
  published_by: string | null;
  source_filename: string;
  template_id: string;
  version_number: number;
};

/** 列表页把模板主记录、当前版本和管理员可见的历史版本整理为一个只读模型。 */
export type CompanyTemplateSummary = {
  currentVersion: CompanyTemplateVersion;
  description: string;
  id: string;
  name: string;
  revision: number;
  slug: string;
  status: "active" | "inactive";
  updated_at: string;
  versions: CompanyTemplateVersion[];
};

/** 发布回执中的编号、修订号和哈希会在服务端二次读库核对，核对失败时页面不能显示成功。 */
export type CompanyTemplatePublishReceipt = {
  guide_sha256: string | null;
  html_sha256: string;
  revision: number;
  status: "active" | "inactive";
  template_id: string;
  version_id: string;
  version_number: number;
};

/** 回退和启停共用状态回执，version_number 只在回退版本时返回。 */
export type CompanyTemplateStateReceipt = {
  revision: number;
  status: "active" | "inactive";
  template_id: string;
  version_id: string;
  version_number?: number;
};
