/** 草稿只有创建者和固定模板版本，没有正式文件夹；预选位置只是另存为的提示。 */
export type TemplateDraft = {
 id:string;owner_id:string;template_id:string;template_version_id:string;template_name:string;name:string;
 preferred_folder_id:string|null;state:Record<string,unknown>;state_sha256:string;revision:number;updated_at:string;
};
export type DraftSummary=Omit<TemplateDraft,"state"|"state_sha256">;
export type DraftMutation={action:"create"|"save"|"delete"|"promote";draftId:string;operationId:string;templateId?:string;preferredFolderId?:string;name?:string;expectedRevision?:number;folderId?:string;state?:Record<string,unknown>};
export type DraftReceipt={action:DraftMutation["action"];draft_id:string;document_id:string|null;folder_id:string|null;revision:number;state_sha256:string;affected_rows:number;deleted:boolean};
