"use client";

import Link, { useLinkStatus } from "next/link";
import { FileCode2, LoaderCircle } from "lucide-react";

/** 链接尚未切换页面时就显示等待状态，避免服务端读取模板期间按钮看起来没有反应。 */
export function CompanyTemplateOpenLink({ href, label, loading }: {
  href: string;
  label: string;
  loading: string;
}) {
  return <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white" href={href}>
    <OpenLinkContent label={label} loading={loading} />
  </Link>;
}

function OpenLinkContent({ label, loading }: { label: string; loading: string }) {
  const { pending } = useLinkStatus();
  return <span className="inline-flex items-center gap-2" role={pending ? "status" : undefined}>
    {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <FileCode2 aria-hidden="true" className="size-4" />}
    {pending ? loading : label}
  </span>;
}
