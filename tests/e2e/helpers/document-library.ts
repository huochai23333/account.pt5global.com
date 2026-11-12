/** 按职责导出测试能力；页面、认证、权威凭证和清理各有独立维护入口。 */
export {
  documentAdmin,
  documentLogin,
  documentUser,
  documentReader,
} from "./document-access";
export {
  readLibrary,
  chooseDocumentFolder,
  uploadDocumentFiles,
  checkDocumentViewport,
} from "./document-library-page";
export {
  authoritativeFiles,
  confirmFileObjects,
  documentPdf,
} from "./document-file-receipts";
export { cleanupDocuments } from "./document-fixture-cleanup";
