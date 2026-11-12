import type { RegressionRole } from "./helpers/auth";
import { test } from "@playwright/test";
import { withDocumentProtocol } from "./helpers/company-template-payloads";
import { registerCompanyTemplateAccessCases } from "./helpers/company-template-access-cases";
import { registerCompanyTemplatePreviewCases } from "./helpers/company-template-preview-cases";
import { registerCompanyTemplatePublicationCases } from "./helpers/company-template-publication-cases";
import { registerCompanyTemplateSecurityCases } from "./helpers/company-template-security-cases";

const SEEDED_TEMPLATE_ID = "a3200000-0000-4000-8000-000000000001";

const SEEDED_VERSION_ID = "a3200000-0000-4000-8000-000000000003";

const INTERNAL_ROLES: RegressionRole[] = [
  "administrator",
  "manager",
  "operator",
  "recruiter",
  "salesman",
  "promoter",
  "finance",
];

const SIMPLE_HTML = (heading: string) =>
  withDocumentProtocol(
    `<!doctype html><html><head><meta charset="utf-8"><title>${heading}</title></head><body><h1>${heading}</h1><button onclick="document.body.dataset.clicked='yes'">Use</button></body></html>`,
  );

// 主入口只声明共同夹具和注册顺序；页面、载荷/凭证、故障恢复在各自模块维护。
test.describe("公司模板", () => {
  registerCompanyTemplateAccessCases(INTERNAL_ROLES, SIMPLE_HTML);
  registerCompanyTemplatePreviewCases(SEEDED_TEMPLATE_ID, SEEDED_VERSION_ID);
  registerCompanyTemplatePublicationCases("lifecycle", SIMPLE_HTML);
  registerCompanyTemplateSecurityCases(
    "input",
    SEEDED_TEMPLATE_ID,
    SEEDED_VERSION_ID,
    SIMPLE_HTML,
  );
  registerCompanyTemplatePublicationCases("retry", SIMPLE_HTML);
  registerCompanyTemplateSecurityCases(
    "hash",
    SEEDED_TEMPLATE_ID,
    SEEDED_VERSION_ID,
    SIMPLE_HTML,
  );
});
