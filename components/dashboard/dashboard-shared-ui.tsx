/**
 * 共享导出入口只负责稳定导入路径，具体实现按反馈、媒体和个人资料卡分开。
 * 这里不再持有组件状态、领域类型判断或视觉样式实现。
 */
export {
  FeedbackNotice,
  type FeedbackTone,
} from "@/components/ui/feedback-notice";
export { EmptyState, LoadingState } from "./dashboard-feedback";
export {
  IdPreview,
  PassportPreview,
  VideoPreview,
} from "./dashboard-media-placeholders";
export {
  InputCard,
  StatusChip,
  StatusNotice,
  ValueCard,
} from "./dashboard-profile-cards";
export {
  createDashboardSharedCopy,
  type DashboardSharedCopy,
} from "./dashboard-shared-copy";
// 展示层统一导入，值规范化、日期与大小格式、状态映射各自独立维护。
export { normalizeOptionalString, normalizeSearchText } from "@/lib/value-normalizers";
export { formatDateTime, formatFileSize } from "./dashboard-shared-formatters";
export {
  getMediaStatus,
  getReviewStatusTone,
  getStatusLabel,
  mapUserStatus,
  type MediaAssetKey,
  type ReviewStatus,
} from "./dashboard-shared-display";
export { getRawErrorMessage, toErrorMessage } from "./dashboard-shared-errors";
