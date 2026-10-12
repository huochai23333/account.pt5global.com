"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useTranslations} from "next-intl";
import {FilePlus2} from "lucide-react";
import {buttonVariants} from "@/components/ui/button-variants";
/** 资料库直接发起模板文档；位置只是预选提示，最终目录仍由保存接口核对权限。 */
export function ExplorerNewDocumentLink({folderId,busy}:{folderId:string|null;busy:boolean}){
 const {workspace}=useParams<{workspace:string}>();const t=useTranslations("CompanyTemplates.documents");
 return <Link aria-disabled={busy||undefined} tabIndex={busy?-1:0} onClick={event=>{if(busy)event.preventDefault();}} className={`${buttonVariants({variant:"outline"})} hidden lg:inline-flex`} href={`/${workspace}/company-templates${folderId?`?folder=${encodeURIComponent(folderId)}`:""}`}><FilePlus2 aria-hidden className="size-4"/>{t("create")}</Link>;
}
