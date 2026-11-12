import type { ChildProcessWithoutNullStreams } from "node:child_process";

type LockOptions = {
  draftId?: string;
  startProcess: () => ChildProcessWithoutNullStreams;
  readyTimeoutMs?: number;
  stopTimeoutMs?: number;
};

/** 管理原文档测试的锁进程，调用者负责本地环境准入和实际进程创建。 */
export async function holdPostgresDocumentLock({
  draftId, startProcess, readyTimeoutMs = 10000, stopTimeoutMs = 2000,
}: LockOptions) {
  // 验证必须早于 startProcess；非法编号不能先留下一个等待输入的 psql。
  if (draftId !== undefined && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(draftId)) {
    throw new Error("invalid_local_fixture");
  }
  const lock = draftId
    ? `begin;do $lock$ begin
        perform id from public.company_template_document_drafts where id='${draftId}'::uuid for update;
        if not found then raise exception 'local_document_fixture_missing'; end if;
      end $lock$;`
    : "select pg_advisory_lock(hashtextextended('document-explorer-tree',0));";
  const process = startProcess();
  let closed = process.exitCode !== null || process.signalCode !== null;
  let releasing = false;
  let failure: Error | undefined;
  let rejectReady: (error: Error) => void = () => {};

  // 创建进程后立即订阅关闭，释放时不再依赖一次可能早已发生的 close 事件。
  const closedPromise = closed ? Promise.resolve() : new Promise<void>((resolve) => {
    process.once("close", () => {
      closed = true;
      if (!releasing) {
        failure ??= new Error("local_lock_process_exited");
        rejectReady(failure);
      }
      resolve();
    });
  });
  const onError = (error: Error) => {
    failure ??= error;
    rejectReady(error);
  };
  process.on("error", onError);
  for (const stream of [process.stdin, process.stdout, process.stderr]) {
    stream.on("error", onError);
  }
  // psql 的错误输出也要持续读取，避免未消费的管道把退出流程堵住；具体错误由关闭状态报告。
  process.stderr.resume();

  async function waitUntilClosed() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        closedPromise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("local_lock_stop_timeout")), stopTimeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function stop() {
    releasing = true;
    if (closed) return;
    process.stdin.end();
    try {
      await waitUntilClosed();
    } catch {
      // EOF 仍不能结束进程时有界终止；终止后也必须等到关闭，不能假定 kill 已完成。
      process.kill();
      await waitUntilClosed();
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let output = "";
  let onData: (chunk: Buffer) => void = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      rejectReady = reject;
      if (closed) return reject(new Error("local_lock_process_exited"));
      timer = setTimeout(() => reject(new Error("local_lock_timeout")), readyTimeoutMs);
      onData = (chunk) => {
        // stdout 的一次 data 事件不保证包含完整消息，保留一个有界尾部拼接就绪标记。
        output = (output + String(chunk)).slice(-4096);
        if (output.includes("document-test-ready")) resolve();
      };
      process.stdout.on("data", onData);
      process.stdin.write(`set lock_timeout='8s';set statement_timeout='9s';${lock}select 'document-test-ready';\n`);
    });
  } catch (error) {
    try { await stop(); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], "local_lock_acquire_and_cleanup_failed"); }
    throw error;
  } finally {
    clearTimeout(timer);
    process.stdout.off("data", onData);
  }

  let release: Promise<void> | undefined;
  return () => release ??= stop().then(() => {
    if (failure) throw failure;
  });
}
