import { test } from "./helpers/template-draft-fixture";
import { registerDraftLifecycleCases } from "./helpers/template-draft-lifecycle-cases";
import { registerDraftNavigationCase } from "./helpers/template-draft-navigation-case";
import { registerDraftPromotionCases } from "./helpers/template-draft-promotion-cases";
import { registerDraftRecoveryCases } from "./helpers/template-draft-recovery-cases";
// 单一入口保留原七个场景的顺序；认证仍由原documentLogin负责。
test.use({ video: "off" });
registerDraftLifecycleCases();
registerDraftNavigationCase();
registerDraftPromotionCases();
registerDraftRecoveryCases();
