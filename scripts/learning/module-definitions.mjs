import { platformModules } from "./modules/platform.mjs";
import { businessModules } from "./modules/business.mjs";
import { collaborationModules } from "./modules/collaboration.mjs";
import { maintenanceModules } from "./modules/maintenance.mjs";

/** 业务说明分组维护，统一补上可定位的指南路径。目录扫描不推测权限或业务规则。 */
export const moduleDefinitions = [
  ...platformModules,
  ...businessModules,
  ...collaborationModules,
  ...maintenanceModules,
].map((entry) => ({ ...entry, guide: `docs/onboarding/modules/${entry.id}.md` }));
