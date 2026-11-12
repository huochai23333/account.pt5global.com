import { randomUUID } from "node:crypto";
import { executeLearningSql } from "../../scripts/learning/local-fixture-session.mjs";

function asAdministrator(actorId: string, statement: string) {
  // 准备用的写入仍经过管理员的真实数据库入口，独立读回再用本机 Docker 会话。
  return executeLearningSql(`begin;
    set local role authenticated;
    set local "request.jwt.claim.role" = 'authenticated';
    set local "request.jwt.claim.sub" = '${actorId}';
    ${statement}
    commit;`);
}

export function convertedCustomerFixture(actorId: string, fixtureId: string) {
  const source = `PT5-LEARNING-${fixtureId}`;
  const name = `Learning lead customer ${fixtureId}`;
  const customer = `(select id from public.wholesale_customers
    where unique_name='${name}' and created_by_user_id='${actorId}')`;
  return {
    name,
    create() {
      executeLearningSql(`insert into public.sales_leads
        (id,primary_source_lead_id,latest_source_date,name,category,country,priority,source_url)
        values ('${fixtureId}','${source}',current_date,'${name}','学习夹具','CN','A','https://example.invalid/${fixtureId}');`);
      asAdministrator(actorId, `do $$declare lead public.sales_leads%rowtype; begin
        select * into strict lead from public.claim_sales_lead('${fixtureId}');
        perform public.convert_sales_lead_to_customer(lead.id,lead.current_assignment_id,'${name}','lead@example.test');
      end $$;`);
    },
    read() {
      return JSON.parse(executeLearningSql(`select json_build_object(
        'customer',(select json_build_object('id',id,'version',xmin::text) from public.wholesale_customers where id=${customer}),
        'lead',(select json_build_object('id',id,'status',status,'customerId',customer_id,'version',xmin::text)
          from public.sales_leads where id='${fixtureId}' and primary_source_lead_id='${source}'),
        'assignmentCount',(select count(*) from public.sales_lead_assignments where lead_id='${fixtureId}'));`));
    },
    cleanup() {
      // 先校验归属，再解除夹具线索与客户、认领周期的互相引用。
      executeLearningSql(`begin;
        do $$begin
          if exists(select 1 from public.sales_leads where id='${fixtureId}' and
            (primary_source_lead_id is distinct from '${source}' or name is distinct from '${name}'
              or (customer_id is not null and customer_id is distinct from ${customer}))) then
            raise exception '线索夹具归属不一致';
          end if;
        end $$;
        update public.sales_leads set status='hall',current_assignee_user_id=null,current_assignment_id=null,
          customer_id=null,converted_at=null,converted_by_user_id=null where id='${fixtureId}';
        delete from public.sales_lead_assignments where lead_id='${fixtureId}' and assignee_user_id='${actorId}';
        delete from public.sales_leads where id='${fixtureId}' and primary_source_lead_id='${source}';
        delete from public.wholesale_customers where id=${customer};
        commit;`);
    },
  };
}

export function customerDocumentFixture(actorId: string, customerId: string, documentId: string) {
  const name = `Learning document customer ${customerId}`;
  const createOperationId = randomUUID();
  const deleteOperationId = randomUUID();
  return {
    name,
    create() {
      executeLearningSql(`insert into public.wholesale_customers(id,unique_name,created_by_user_id)
        values ('${customerId}','${name}','${actorId}');`);
      // 复用仓库内已发布的测试模板，创建的文档只属于这一次用例。
      asAdministrator(actorId, `do $$declare folder uuid; begin
        select f.id into strict folder from public.document_folders f join public.document_archives a on a.id=f.archive_id
          where a.customer_id='${customerId}' and f.system_key='personal';
        perform public.mutate_company_template_document(jsonb_build_object('action','create','documentId','${documentId}',
          'operationId','${createOperationId}','folderId',folder,'templateId','a3200000-0000-4000-8000-000000000001','name','${name}'));
      end $$;`);
    },
    read() {
      return JSON.parse(executeLearningSql(`select json_build_object(
        'customer',(select json_build_object('id',id,'version',xmin::text) from public.wholesale_customers where id='${customerId}'),
        'document',(select json_build_object('id',d.id,'revision',d.revision,'folderId',d.folder_id,'archiveCustomerId',a.customer_id)
          from public.company_template_documents d join public.document_folders f on f.id=d.folder_id
          join public.document_archives a on a.id=f.archive_id where d.id='${documentId}'),
        'archiveCount',(select count(*) from public.document_archives where customer_id='${customerId}'),
        'operationCount',(select count(*) from public.company_template_document_operations
          where owner_id='${actorId}' and operation_id in ('${createOperationId}','${deleteOperationId}')));`));
    },
    removeDocument() {
      const revision = executeLearningSql(`select d.revision from public.company_template_documents d
        join public.document_folders f on f.id=d.folder_id join public.document_archives a on a.id=f.archive_id
        where d.id='${documentId}' and a.customer_id='${customerId}';`);
      if (revision) asAdministrator(actorId, `select public.mutate_company_template_document(jsonb_build_object('action','delete',
        'documentId','${documentId}','operationId','${deleteOperationId}','expectedRevision',${Number(revision)}));`);
    },
    cleanup() {
      executeLearningSql(`begin;
        delete from public.company_template_document_operations where owner_id='${actorId}'
          and operation_id in ('${createOperationId}','${deleteOperationId}');
        delete from public.wholesale_customers where id='${customerId}' and created_by_user_id='${actorId}' and unique_name='${name}';
        commit;`);
    },
  };
}
