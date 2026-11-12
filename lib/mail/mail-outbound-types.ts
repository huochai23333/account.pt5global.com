/** 发件任务、发件上下文和已验证附件的内部合同；不包含运行逻辑或服务配置。 */

export type JobRow = {
  id: string;
  mailbox_id: string;
  actor_user_id: string;
  thread_id: string | null;
  payload_enc: string;
  attempt_count: number;
  provider_message_id: string | null;
  provider_thread_id: string | null;
  dispatch_started_at: string | null;
  rfc_message_id: string | null;
  created_at: string;
};

export type Context = {
  mailboxEmail: string;
  senderDisplayName: string;
  aliasLocalPart: string;
  refPrefix: string;
  signatureHtml: string;
  providerThreadId: string | null;
  threadSubject: string | null;
  refCode: string | null;
};

export type LoadedAttachment = {
  id: string;
  storagePath: string;
  filename: string;
  contentType: string;
  byteSize: number;
  content: Buffer;
  filenameEnc: string;
  contentTypeEnc: string;
  cipherSha256: string;
  scanStatus: string;
};
