/** 只有数据库建任务之前就能确定拒绝的输入错误，才允许页面释放发送标识。 */
export class MailConfirmedRejection extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailConfirmedRejection";
  }
}
