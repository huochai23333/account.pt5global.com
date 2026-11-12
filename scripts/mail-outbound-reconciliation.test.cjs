// VM 边界需要按路径装入真实源码，因此这里使用 CommonJS 并局部关闭脚本文件的导入风格规则。
/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
// 隔离 Gmail 与数据库边界，验证“已发送但回执写入失败”后只能对账一次，不能重复投递。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));

function loadWorker(dependencies, sourceName = 'mail-outbound-worker.ts') {
  const filename = path.join(root, 'lib/mail', sourceName);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports,fetch){' + output + '\n})', { filename })((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    // 拆分后的真实内容与归档模块继续使用同一组隔离外部边界，不能用空实现替代业务逻辑。
    if (['./mail-outbound-content', './mail-outbound-persistence', './mail-google-outbound', './mail-google-api'].includes(name)) {
      return loadWorker(dependencies, name.slice(2) + '.ts');
    }
    throw new Error('未隔离的依赖：' + name);
  }, module, module.exports, fakeGmailFetch);
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
let sentChecks = 0;
let failProviderReceipt = true;
let savedMessage = null;
const job = {
  id: 'job-id', mailbox_id: 'mailbox', actor_user_id: 'actor', thread_id: 'thread',
  payload_enc: JSON.stringify({ to: ['customer@example.test'], cc: [], bcc: [], textBody: 'Hello', htmlBody: '', subject: 'Quote', attachmentIds: [] }),
  status: 'pending', attempt_count: 0, provider_message_id: null, provider_thread_id: null,
  dispatch_started_at: null, rfc_message_id: null, created_at: '2026-09-23T00:00:00Z',
};

// 只模拟供应商的 HTTP 边界。真实 Gmail 适配模块仍需构造请求并验证 SENT 回执。
async function fakeGmailFetch(address, init) {
  const url = new URL(address);
  assert.equal(init.headers.authorization, 'Bearer isolated-token');
  if (url.pathname.endsWith('/messages/send') && init.method === 'POST') {
    const body = JSON.parse(init.body);
    assert.match(Buffer.from(body.raw, 'base64url').toString(), /Message-ID: <pt5-job-id@pt5china.com>/i);
    return Response.json({ id: 'provider-' + ++sends, threadId: 'provider-thread' });
  }
  if (url.pathname.endsWith('/messages')) {
    lookups += 1;
    assert.equal(url.searchParams.get('q'), 'in:sent rfc822msgid:<pt5-job-id@pt5china.com>');
    return Response.json({ messages: sends ? [{ id: 'provider-1', threadId: 'provider-thread' }] : [] });
  }
  if (url.pathname.endsWith('/messages/provider-1')) {
    sentChecks += 1;
    assert.equal(url.searchParams.get('format'), 'minimal');
    return Response.json({ id: 'provider-1', threadId: 'provider-thread', labelIds: ['SENT'] });
  }
  throw new Error('不在测试范围的 Gmail 请求');
}
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
  'server-only': {},
  './mail-google-credentials': {
    getSharedAccessToken: async () => 'isolated-token',
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
  assert.equal(sentChecks, 1);
  console.log(JSON.stringify({ sends, lookups, sentChecks, finalStatus: job.status }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
