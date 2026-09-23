// VM 边界需要按路径装入真实源码，因此这里使用 CommonJS 并局部关闭脚本文件的导入风格规则。
/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
// 隔离 Gmail 与数据库边界，验证“已发送但回执写入失败”后只能对账一次，不能重复投递。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));

function loadWorker(dependencies) {
  const filename = path.join(root, 'lib/mail/mail-outbound-worker.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + output + '\n})', { filename })((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error('未隔离的依赖：' + name);
  }, module, module.exports);
  return module.exports;
}

function clientFor(handler, rpc) {
  return { rpc, from(table) {
    const query = { table, action: 'select', fields: null, values: null };
    const builder = {};
    for (const method of ['select', 'insert', 'update', 'eq', 'in', 'is', 'order', 'limit']) {
      builder[method] = (...args) => {
        if (method === 'select') query.fields = args[0];
        if (method === 'insert' || method === 'update') { query.action = method; query.values = args[0]; }
        return builder;
      };
    }
    const execute = () => Promise.resolve().then(() => handler(query));
    builder.single = execute;
    builder.maybeSingle = execute;
    builder.then = (resolve, reject) => execute().then(resolve, reject);
    return builder;
  } };
}

const ok = (data) => ({ data, error: null });
let sends = 0;
let lookups = 0;
let failProviderReceipt = true;
let savedMessage = null;
const job = {
  id: 'job-id', mailbox_id: 'mailbox', actor_user_id: 'actor', thread_id: 'thread',
  payload_enc: JSON.stringify({ to: ['customer@example.test'], cc: [], bcc: [], textBody: 'Hello', htmlBody: '', subject: 'Quote', attachmentIds: [] }),
  status: 'pending', attempt_count: 0, provider_message_id: null, provider_thread_id: null,
  dispatch_started_at: null, rfc_message_id: null, created_at: '2026-09-23T00:00:00Z',
};
const client = clientFor((query) => {
  if (query.table === 'mail_shared_mailboxes') return ok({ email_enc: 'company@example.test', status: 'active' });
  if (query.table === 'mail_agent_profiles') return ok({ enabled: true, alias_local_part: 'sales', ref_prefix: 'SALES', sender_display_name_enc: 'Sales', signature_html_enc: '' });
  if (query.table === 'mail_threads') {
    if (query.action === 'update') return ok({ id: 'thread' });
    return ok({ id: 'thread', provider_thread_id: 'provider-thread', assigned_user_id: 'actor', version: 1, subject_enc: 'Quote', ref_code: 'REF' });
  }
  if (query.table === 'mail_messages') {
    if (query.action === 'insert') { savedMessage = { id: 'message', thread_id: 'thread', occurred_at: new Date().toISOString() }; return ok(savedMessage); }
    return ok(query.fields === 'raw_headers_enc' ? null : savedMessage);
  }
  if (query.table === 'mail_outbound_jobs' && query.action === 'update') {
    if (query.values.provider_message_id && failProviderReceipt) {
      failProviderReceipt = false;
      return { data: null, error: new Error('模拟 Gmail 成功后数据库回执失败') };
    }
    Object.assign(job, query.values);
    return ok({ ...job });
  }
  throw new Error('未预期查询：' + JSON.stringify(query));
}, async () => {
  job.attempt_count += 1;
  return ok([{ ...job }]);
});

class Composer {
  constructor(options) { this.options = options; }
  compile() { return { build: async () => Buffer.from(`Message-ID: ${this.options.messageId}\r\n\r\nHello`)}; }
}
const worker = loadWorker({
  '@/lib/supabase-admin-server': { getSupabaseServiceRoleClient: () => client },
  './mail-env': { getMailEnv: () => ({ contentKey: 'isolated-key', emailHashSecret: 'isolated-index' }) },
  './mail-security': { decryptMailValue: (value) => value, encryptMailValue: (value) => value, createBlindIndex: (value) => value },
  'sanitize-html': (value) => value,
  'nodemailer/lib/mail-composer/index.js': Composer,
  './mail-google': {
    getSharedAccessToken: async () => 'isolated-token',
    sendRawMessage: async () => ({ id: 'provider-' + ++sends, threadId: 'provider-thread' }),
    findSentMessageByRfcId: async (_token, messageId) => {
      lookups += 1;
      assert.equal(messageId, '<pt5-job-id@pt5china.com>');
      return sends ? { id: 'provider-1', threadId: 'provider-thread' } : null;
    },
    verifySentMessage: async () => ({ labelIds: ['SENT'] }),
  },
  './mail-recipient-service': { recordSuccessfulOutboundRecipients: async () => {} },
  './mail-storage': {},
});

(async () => {
  await worker.processOutboundJobBatch();
  assert.equal(job.status, 'retrying');
  assert.equal(job.dispatch_started_at !== null, true);
  assert.equal(job.provider_message_id, null);
  await worker.processOutboundJobBatch();
  assert.equal(job.status, 'sent');
  assert.equal(job.provider_message_id, 'provider-1');
  assert.equal(sends, 1);
  assert.equal(lookups, 1);
  console.log(JSON.stringify({ sends, lookups, finalStatus: job.status }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
