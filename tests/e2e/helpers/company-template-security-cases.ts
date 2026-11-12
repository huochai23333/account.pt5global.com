import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { loginAs } from "./auth";
import {
  htmlFile,
  publishMultipart,
  requireLocalAdminClient,
  readVersion,
  countTemplates,
} from "./company-template-actions";
import { runLocalSupabaseSql } from "./local-supabase";
import { createCompanyTemplateHashFault } from "../../test-support/company-template-hash-fault";
import { finalizeCompanyTemplateCase } from "./company-template-case-lifecycle";

/** 按原入口注册输入拒绝和哈希故障场景；原账号/认证保持，实际页面执行仍需原准入。 */
export function registerCompanyTemplateSecurityCases(
  scenario: "input" | "hash",
  SEEDED_TEMPLATE_ID: string,
  SEEDED_VERSION_ID: string,
  SIMPLE_HTML: (heading: string) => string,
) {
  if (scenario === "input") {
    test("上传拒绝缺失、错误类型、超限和不安全 HTML，并保证指南失败时整笔回滚", async ({
      page,
    }) => {
      test.setTimeout(120_000);
      const admin = requireLocalAdminClient();
      await loginAs(page, "administrator");

      const cases: Array<{
        expected: string;
        file?: { buffer: Buffer; mimeType: string; name: string };
      }> = [
        { expected: "company_template_file_required" },
        {
          expected: "company_template_file_type",
          file: htmlFile("template.txt", SIMPLE_HTML("wrong extension")),
        },
        {
          expected: "company_template_file_too_large",
          file: htmlFile("large.html", Buffer.alloc(5 * 1024 * 1024 + 1, 97)),
        },
        {
          expected: "company_template_file_document",
          file: htmlFile("fragment.html", "<div>fragment</div>"),
        },
        {
          expected: "company_template_file_unsafe",
          file: htmlFile(
            "script.html",
            "<!doctype html><html><body><script src='https://example.com/app.js'></script></body></html>",
          ),
        },
        {
          expected: "company_template_file_unsafe",
          file: htmlFile(
            "frame.html",
            "<!doctype html><html><body><iframe src='https://example.com'></iframe></body></html>",
          ),
        },
        {
          expected: "company_template_file_unsafe",
          file: htmlFile(
            "form.html",
            "<!doctype html><html><body><form action=https://example.com></form></body></html>",
          ),
        },
      ];

      for (const item of cases) {
        const response = await page.request.post(
          "/api/company-templates/publish",
          {
            multipart: publishMultipart({
              htmlFileValue: item.file,
              slug: `invalid-${randomUUID()}`,
              templateId: randomUUID(),
              versionId: randomUUID(),
            }),
          },
        );
        expect(response.status()).toBe(400);
        expect(await response.json()).toMatchObject({
          error: item.expected,
          ok: false,
        });
      }

      const rollbackId = randomUUID();
      const rollbackResponse = await page.request.post(
        "/api/company-templates/publish",
        {
          multipart: publishMultipart({
            guideFileValue: htmlFile(
              "bad-guide.html",
              "<!doctype html><html><body><object data='bad'></object></body></html>",
            ),
            html: SIMPLE_HTML("valid template"),
            slug: `rollback-${Date.now()}`,
            templateId: rollbackId,
            versionId: randomUUID(),
          }),
        },
      );
      expect(rollbackResponse.status()).toBe(400);
      expect(await countTemplates(admin, rollbackId)).toBe(0);

      const staleResponse = await page.request.post(
        "/api/company-templates/publish",
        {
          multipart: publishMultipart({
            expectedRevision: "999",
            html: SIMPLE_HTML("stale"),
            slug: "pt5-ds-cost-list",
            templateId: SEEDED_TEMPLATE_ID,
            versionId: randomUUID(),
          }),
        },
      );
      expect(staleResponse.status()).toBe(409);
      expect(await staleResponse.json()).toMatchObject({
        error: "company_template_revision_conflict",
        ok: false,
      });
    });
  }

  if (scenario === "hash") {
    test("故意篡改当前版本哈希后内容接口拒绝返回 HTML", async ({
      page,
    }, testInfo) => {
      const admin = requireLocalAdminClient();
      await loginAs(page, "salesman");
      const originalHash = (await readVersion(admin, SEEDED_VERSION_ID))
        .html_sha256;
      const sdkOrigin = Reflect.get(admin, "supabaseUrl");
      if (typeof sdkOrigin !== "string")
        throw new Error("template_hash_fault_sdk_origin_missing");
      const fault = createCompanyTemplateHashFault(runLocalSupabaseSql, {
        templateId: SEEDED_TEMPLATE_ID,
        versionId: SEEDED_VERSION_ID,
        originalHash,
        apiOrigin: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        sdkOrigin,
      });
      let bodyFailure: { error: unknown } | undefined;
      try {
        fault.arm();
        const response = await page.request.get(
          `/api/company-templates/${SEEDED_TEMPLATE_ID}/content`,
        );
        expect(response.status()).toBe(409);
        expect(await response.text()).toBe("Template verification failed");
        fault.verify();
      } catch (error) {
        bodyFailure = { error };
      } finally {
        await finalizeCompanyTemplateCase(
          page,
          testInfo,
          async () => fault.restore(),
          bodyFailure,
          () => fault.evidence(),
        );
      }
    });
  }
}
