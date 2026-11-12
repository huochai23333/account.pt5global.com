/** 帮助与公开内容：集中实现本模块的一项服务或规则；修改时沿导出追踪调用方，并核对权限与结果边界。 */
import type { Locale } from "./locale";
import type { LegalPageKey, LegalSection } from "./legal-content";

export type FormalLegalPageContent = {
  description: string;
  draftNotice: string;
  lastUpdated: string;
  metadataTitle: string;
  sections: LegalSection[];
  title: string;
};

export const FORMAL_LEGAL_CONTENT: Record<Locale, Record<LegalPageKey, FormalLegalPageContent>> = {
  zh: {
    privacy: {
      metadataTitle: "隐私政策",
      title: "隐私政策",
      description:
        "本政策说明{productName}在账号注册、身份认证、角色权限、业务协作、审核处理和系统安全维护过程中，如何收集、使用、保存、共享和保护个人信息及相关业务数据。",
      lastUpdated: "2026-04-27",
      draftNotice:
        "本文件构成{productName}对用户公开展示的隐私政策。用户访问或使用本系统，即表示已阅读并理解本政策所述个人信息处理规则；如用户另与运营方签署书面协议，且该协议与本政策不一致的，以双方书面约定及强制适用法律规定为准。",
      sections: [
        {
          title: "一、适用范围与信息处理主体",
          items: [
            "本政策适用于用户访问、注册、登录和使用{productName}及其相关工作台、表单、审核、订单、任务、推荐、团队、佣金和通知功能时产生的信息处理活动。",
            "本系统由相应业务运营方负责管理。除非另有书面说明，运营方将作为个人信息处理者，依照适用法律法规、本政策及业务管理规则处理用户个人信息。",
            "本政策不适用于第三方网站、服务或外部系统的个人信息处理活动。用户通过本系统跳转至第三方服务时，应另行阅读并遵守该第三方的隐私政策和服务规则。",
          ],
        },
        {
          title: "二、我们收集的信息类型",
          items: [
            "账号与身份信息：包括姓名、昵称、手机号码、电子邮箱、登录认证状态、密码重置记录、邀请码、账号状态、角色、城市、推荐关系、团队关系以及与账号创建和管理有关的必要信息。",
            "实名与敏感个人信息：包括身份证号、护照号、个人照片、个人视频、实名认证状态、审核意见及审核记录。上述信息可能属于敏感个人信息，我们仅在实现身份核验、资料审核、合规管理或必要业务流程时处理，并将在必要范围内采取更严格的保护措施。",
            "业务与工作台信息：包括订单、任务、任务附件、任务成果、推荐树、团队管理、汇率、佣金、公告、审核记录、操作状态、提交时间、处理人员及与相应业务流程有关的记录。",
            "系统与安全信息：包括登录时间、会话状态、设备或浏览器相关信息、访问日志、错误日志、权限校验结果、安全事件记录以及为维护系统稳定和防止未授权访问所需的技术信息。",
          ],
        },
        {
          title: "三、信息使用目的",
          items: [
            "我们处理个人信息是为了创建、验证和维护用户账号，分配或校验角色权限，保持登录会话，找回访问权限，并防止越权访问、冒用身份或其他危害系统安全的行为。",
            "我们处理实名、媒体和审核信息，是为了完成身份核验、资料审核、任务成果审核、业务记录留痕、争议核查和必要的合规管理。",
            "我们处理业务信息，是为了展示用户在其授权范围内可见的订单、任务、推荐、团队、佣金、汇率、公告和审核数据，并支持业务流转、统计、追踪和管理。",
            "我们可能基于法律法规、监管要求、合同履行、用户同意、保护用户或运营方合法权益以及维护系统安全稳定的必要性处理相关信息。",
          ],
        },
        {
          title: "四、信息共享、委托处理与披露",
          items: [
            "我们不会出售个人信息。除非取得用户授权、为履行本系统功能所必需、法律法规另有规定或保护合法权益所必需，我们不会向无关第三方提供个人信息。",
            "为实现身份认证、数据库存储、文件存储、应用交付、安全防护、日志分析和技术维护，本系统可能委托云服务商、基础设施服务商或技术服务商处理必要数据。我们将要求受托方按照约定目的、范围和安全要求处理信息。",
            "在依法配合司法机关、行政机关、监管机构调查，处理安全事件，保护用户、运营方或公众合法权益，或解决争议时，我们可能在必要范围内披露相关信息。",
          ],
        },
        {
          title: "五、信息保存与安全措施",
          items: [
            "我们将在实现本政策所述目的所需的最短期间内保存个人信息，但法律法规、监管要求、审计、争议处理、安全管理或业务留痕另有要求的除外。",
            "我们会采用合理的技术和管理措施保护信息安全，包括但不限于账号认证、会话校验、角色权限控制、服务端访问校验、最小必要访问、存储权限控制和安全日志记录。",
            "互联网环境并不存在绝对安全。若发生或可能发生个人信息安全事件，我们将根据适用法律法规采取补救措施，并在必要时通过合理方式通知受影响用户或主管机关。",
          ],
        },
        {
          title: "六、用户权利",
          items: [
            "在适用法律允许的范围内，用户可以请求查询、复制、更正、补充、删除其个人信息，或请求解释本系统的个人信息处理规则。",
            "用户可以在系统内更新部分可编辑资料、修改密码或切换界面语言。对于无法直接编辑的实名、媒体、审核、订单、任务、佣金或账号记录，用户可通过业务支持渠道联系系统管理员申请处理。",
            "用户请求删除、撤回同意或注销账号时，我们将根据法律要求和业务规则处理；因审计、订单追踪、争议解决、安全管理或合规义务必须保留的信息，可能无法立即删除。",
          ],
        },
        {
          title: "七、未成年人信息",
          items: [
            "本系统面向具备相应业务身份和授权的客户、员工、合作人员或管理人员，不以未成年人为主要服务对象。",
            "如用户未达到适用法律规定的完全民事行为能力年龄，应在监护人同意和指导下使用本系统，并避免提交与业务无关的个人信息。",
          ],
        },
        {
          title: "八、政策更新与联系",
          items: [
            "当系统功能、业务流程、数据处理目的、第三方服务、法律法规或监管要求发生变化时，我们可能更新本政策。更新后的政策将在本页面展示，并自发布或载明的生效日期起生效。",
            "如用户对本政策、个人信息处理活动或权利行使有任何疑问、投诉或请求，请通过常规业务支持渠道联系系统管理员或运营方指定联系人。",
          ],
        },
      ],
    },
    terms: {
      metadataTitle: "服务条款",
      title: "服务条款",
      description:
        "本条款规定用户访问和使用{productName}时应遵守的账号、权限、数据提交、业务协作、安全管理、责任限制和争议处理规则。",
      lastUpdated: "2026-04-27",
      draftNotice:
        "本文件构成{productName}对用户公开展示的服务条款。用户访问、注册、登录或以任何方式使用本系统，即表示已阅读、理解并同意受本条款约束。",
      sections: [
        {
          title: "一、条款接受与适用范围",
          items: [
            "用户访问、注册、登录或以任何方式使用{productName}，即视为已阅读、理解并同意受本条款约束。不同意本条款的，用户应立即停止访问和使用本系统。",
            "本系统为面向授权客户、员工、合作人员和管理人员的业务管理平台，提供账号管理、角色工作台、订单、任务、推荐、团队、佣金、汇率、公告、审核及相关协作功能。",
            "用户可能同时受其与运营方、雇主、合作方或客户之间另行签署的协议、业务规则、操作规范和保密义务约束。",
          ],
        },
        {
          title: "二、账号注册与访问权限",
          items: [
            "用户应按照系统要求提供真实、准确、完整且及时更新的账号资料。使用邀请码、角色分配或管理员开通功能时，用户应确保其具备相应授权。",
            "账号、密码、验证码、会话凭证和其他认证信息仅限用户本人或经授权人员使用。因保管不善、共享账号或授权不当造成的后果，由相关责任方依法承担。",
            "用户只能访问其角色、团队、业务关系和账号状态允许访问的页面和数据。任何绕过权限控制、冒用身份、越权查看或导出数据的行为均被禁止。",
          ],
        },
        {
          title: "三、用户行为规范",
          items: [
            "用户应将本系统用于合法、正当、必要的业务目的，并遵守适用法律法规、运营方管理规则、业务流程和本条款约定。",
            "用户不得上传、提交、发布或传播虚假、违法、侵权、欺诈、误导、有害、恶意代码、与业务无关或未经授权的内容，包括但不限于身份证明、照片、视频、任务附件、订单信息和审核材料。",
            "用户不得干扰、破坏、规避、逆向工程、扫描、批量抓取、攻击或以其他方式影响本系统、安全措施、云服务、数据库、存储对象或其他用户的正常使用。",
          ],
        },
        {
          title: "四、资料提交、审核与业务记录",
          items: [
            "用户通过系统提交的实名信息、媒体文件、订单资料、任务成果、附件、审核说明和其他业务资料，应保证来源合法、内容真实、授权充分，并符合对应业务目的。",
            "运营方或其授权人员有权根据业务规则对提交资料进行审核、退回、拒绝、要求更正、限制展示或记录处理结果。审核通过不代表运营方对资料的真实性、完整性、合法性作出最终保证。",
            "为保障业务追踪、审计、争议处理和系统安全，系统可能保存用户提交、修改、审核、领取、完成、删除或结算相关记录。",
          ],
        },
        {
          title: "五、知识产权与数据权利",
          items: [
            "本系统的软件、页面设计、界面组件、程序代码、数据库结构、商标、标识、文档及相关技术成果，除另有说明外，归运营方或相应权利人所有。",
            "用户保留其依法享有权利的提交内容，但授予运营方在提供、维护、审核、展示、备份、合规管理和争议处理所必需范围内使用、复制、存储、展示和处理该等内容的权利。",
            "未经运营方书面许可，用户不得复制、转让、出租、出售、再许可、公开披露或以其他方式商业化利用本系统及其非公开数据。",
          ],
        },
        {
          title: "六、服务变更、中断与维护",
          items: [
            "运营方可根据业务、技术、安全、合规或管理需要，对系统功能、页面、权限、字段、流程、存储策略、审核规则和服务范围进行新增、调整、暂停或终止。",
            "因系统维护、网络故障、云服务异常、安全事件、不可抗力、第三方服务变更或法律监管要求导致的服务中断、延迟、数据同步异常或功能限制，运营方将在合理范围内采取恢复措施。",
            "运营方不保证系统在任何时间均不间断、无错误或完全满足用户的所有个别需求，但将依据合理商业努力维护系统稳定和安全。",
          ],
        },
        {
          title: "七、账号限制、暂停与终止",
          items: [
            "如用户违反本条款、法律法规、业务规则、保密义务或安全要求，或其账号存在异常、风险、越权、误用、授权终止等情形，运营方有权限制、暂停、冻结或终止其访问权限。",
            "账号访问被限制、暂停或终止后，运营方仍可在法律法规、审计、争议处理、安全管理、合同履行或业务留痕所需范围内保留相关记录。",
            "用户停止使用系统或不再具备对应业务身份时，应及时联系管理员处理账号和权限。",
          ],
        },
        {
          title: "八、责任限制",
          items: [
            "用户理解并同意，因用户提交资料不真实、不合法、未经授权、违反保密义务、误操作、共享账号、越权使用或违反本条款造成的损失，由相关责任方依法承担。",
            "在法律允许的最大范围内，运营方不对因不可抗力、第三方服务、网络通信、用户设备、用户操作、非授权访问或超出合理控制范围的事件造成的间接损失、利润损失、业务中断或数据损失承担责任。",
            "本条款中的任何内容均不排除或限制法律法规不得排除或限制的责任。",
          ],
        },
        {
          title: "九、适用法律与争议解决",
          items: [
            "本条款的订立、生效、履行、解释和争议解决，适用运营方所在地或双方书面约定的适用法律；强制适用法律另有规定的，从其规定。",
            "因本条款或本系统使用产生争议的，各方应首先通过友好协商解决；协商不成的，可按照双方书面协议或适用法律确定的争议解决方式处理。",
          ],
        },
        {
          title: "十、条款更新与联系",
          items: [
            "运营方可根据业务、技术、法律或监管变化更新本条款。更新后的条款将在本页面展示，并自发布或载明的生效日期起生效。",
            "用户对本条款、账号状态、权限、提交资料或系统使用有任何疑问，应通过常规业务支持渠道联系系统管理员或运营方指定联系人。",
          ],
        },
      ],
    },
  },
  en: {
    privacy: {
      metadataTitle: "Privacy Policy",
      title: "Privacy Policy",
      description:
        "This policy explains how {productName} collects, uses, stores, shares and protects personal information and operational data during account registration, identity verification, role-based access, business collaboration, review workflows and system security maintenance.",
      lastUpdated: "2026-04-27",
      draftNotice:
        "This document is the Privacy Policy publicly displayed for {productName}. By accessing or using the system, you acknowledge that you have read and understood the personal information processing rules described in this policy.",
      sections: [
        {
          title: "1. Scope and Data Controller",
          items: [
            "This policy applies when users access, register for, sign in to or use {productName}, including related workspaces, forms, reviews, orders, tasks, referrals, teams, commissions and notice functions.",
            "The relevant business operator manages the system. Unless separately stated in writing, the operator acts as the personal information processor or controller and processes user information in accordance with applicable laws, this policy and business management rules.",
            "This policy does not apply to personal information processing by third-party websites, services or external systems. If you access a third-party service through the system, you should review and follow that third party's privacy policy and service rules.",
          ],
        },
        {
          title: "2. Information We Collect",
          items: [
            "Account and identity information: name, nickname, phone number, email address, authentication status, password reset records, invitation code, account status, role, city, referral relationship, team relationship and other information needed to create and manage an account.",
            "Identity verification and sensitive personal information: ID card number, passport number, personal photos, personal videos, verification status, review comments and review records. This information may be sensitive personal information, and we process it only when necessary for identity verification, profile review, compliance management or required business workflows.",
            "Business and workspace information: orders, tasks, task attachments, task deliverables, referral trees, team management records, exchange rates, commissions, announcements, review records, operation status, submission time, processing personnel and records related to corresponding business workflows.",
            "System and security information: sign-in time, session status, device or browser information, access logs, error logs, permission-check results, security incident records and technical information needed to maintain system stability and prevent unauthorized access.",
          ],
        },
        {
          title: "3. Purposes of Processing",
          items: [
            "We process personal information to create, verify and maintain user accounts, assign or verify role permissions, maintain sessions, recover access and prevent unauthorized access, impersonation or other conduct that may harm system security.",
            "We process identity, media and review information to complete identity verification, profile review, task deliverable review, business traceability, dispute review and necessary compliance management.",
            "We process business information to display orders, tasks, referrals, teams, commissions, exchange rates, announcements and review data within the user's authorized scope, and to support business workflow, statistics, tracking and management.",
            "We may process information based on applicable law, regulatory requirements, contract performance, user consent, protection of legitimate rights and interests, and the necessity of maintaining system security and stability.",
          ],
        },
        {
          title: "4. Sharing, Entrusted Processing and Disclosure",
          items: [
            "We do not sell personal information. We do not provide personal information to unrelated third parties unless authorized by the user, necessary to provide system functions, required by law or necessary to protect legitimate rights and interests.",
            "To support authentication, database storage, file storage, application delivery, security protection, log analysis and technical maintenance, the system may entrust cloud service providers, infrastructure providers or technical service providers to process necessary data. We require entrusted parties to process information only for agreed purposes, within agreed scope and under appropriate security requirements.",
            "We may disclose relevant information within the necessary scope to comply with lawful requests by judicial, administrative or regulatory authorities, handle security incidents, protect users, the operator or the public, or resolve disputes.",
          ],
        },
        {
          title: "5. Retention and Security",
          items: [
            "We retain personal information for the shortest period necessary to achieve the purposes described in this policy, unless a longer period is required for laws, regulations, regulatory requirements, audit, dispute handling, security management or business traceability.",
            "We use reasonable technical and organizational measures to protect information security, including account authentication, session checks, role-based permission controls, server-side access checks, least-necessary access, storage permission controls and security logging.",
            "No internet environment is absolutely secure. If a personal information security incident occurs or may occur, we will take remedial measures under applicable law and, when necessary, notify affected users or competent authorities through reasonable methods.",
          ],
        },
        {
          title: "6. User Rights",
          items: [
            "To the extent permitted by applicable law, users may request access to, copies of, correction of, supplementation of or deletion of their personal information, or request an explanation of the system's personal information processing rules.",
            "Users may update certain editable profile fields in the system, change passwords or switch interface language. For identity, media, review, order, task, commission or account records that cannot be edited directly, users may contact the system administrator through the business support channel.",
            "When a user requests deletion, withdrawal of consent or account cancellation, we will process the request under legal requirements and business rules. Information required for audit, order tracking, dispute resolution, security management or compliance obligations may not be deleted immediately.",
          ],
        },
        {
          title: "7. Minors",
          items: [
            "The system is intended for customers, employees, collaborators or administrators with appropriate business identity and authorization, and is not primarily directed to minors.",
            "If a user has not reached the age of full civil capacity under applicable law, the user should use the system only with guardian consent and guidance, and should avoid submitting personal information unrelated to business purposes.",
          ],
        },
        {
          title: "8. Updates and Contact",
          items: [
            "We may update this policy when system functions, business workflows, processing purposes, third-party services, laws, regulations or regulatory requirements change. The updated policy will be displayed on this page and will take effect upon publication or on the stated effective date.",
            "Questions, complaints or requests about this policy, personal information processing or rights exercise should be directed to the system administrator or the operator's designated contact through the normal business support channel.",
          ],
        },
      ],
    },
    terms: {
      metadataTitle: "Terms of Service",
      title: "Terms of Service",
      description:
        "These terms set out the rules governing account access, permissions, data submissions, business collaboration, security management, liability limitations and dispute handling when using {productName}.",
      lastUpdated: "2026-04-27",
      draftNotice:
        "This document is the Terms of Service publicly displayed for {productName}. By accessing, registering for, signing in to or otherwise using the system, you agree to be bound by these terms.",
      sections: [
        {
          title: "1. Acceptance and Scope",
          items: [
            "By accessing, registering for, signing in to or otherwise using {productName}, you are deemed to have read, understood and agreed to these terms. If you do not agree, you must stop accessing and using the system immediately.",
            "The system is a business management platform for authorized customers, employees, collaborators and administrators. It provides account management, role workspaces, orders, tasks, referrals, teams, commissions, exchange rates, announcements, reviews and related collaboration functions.",
            "You may also be subject to separate agreements, business rules, operating procedures and confidentiality obligations with the operator, employer, collaborator or customer.",
          ],
        },
        {
          title: "2. Accounts and Access Permissions",
          items: [
            "You must provide true, accurate, complete and up-to-date account information as required by the system. When using invitation codes, role assignments or administrator-enabled functions, you must ensure that you have the relevant authorization.",
            "Accounts, passwords, verification codes, session credentials and other authentication information may be used only by the account holder or authorized personnel. Consequences caused by poor custody, account sharing or improper authorization are borne by the responsible party under applicable law.",
            "You may access only the pages and data permitted by your role, team, business relationship and account status. Bypassing permission controls, impersonating others, viewing data beyond authorization or exporting data without authorization is prohibited.",
          ],
        },
        {
          title: "3. User Conduct",
          items: [
            "You must use the system only for lawful, legitimate and necessary business purposes, and comply with applicable laws, the operator's management rules, business workflows and these terms.",
            "You must not upload, submit, publish or transmit false, unlawful, infringing, fraudulent, misleading, harmful, malicious, irrelevant or unauthorized content, including identity documents, photos, videos, task attachments, order information and review materials.",
            "You must not interfere with, damage, bypass, reverse engineer, scan, scrape, attack or otherwise affect the system, security measures, cloud services, databases, storage objects or other users' normal use.",
          ],
        },
        {
          title: "4. Submissions, Reviews and Business Records",
          items: [
            "Identity information, media files, order materials, task deliverables, attachments, review notes and other business materials submitted through the system must be lawful in source, accurate in content, properly authorized and suitable for the relevant business purpose.",
            "The operator or authorized personnel may review, return, reject, request correction of, restrict display of or record processing results for submitted materials under business rules. Approval of a review does not constitute a final guarantee by the operator as to the authenticity, completeness or legality of the submitted material.",
            "To support business tracking, audit, dispute handling and system security, the system may retain records related to user submissions, modifications, reviews, acceptance, completion, deletion or settlement.",
          ],
        },
        {
          title: "5. Intellectual Property and Data Rights",
          items: [
            "The system software, page designs, interface components, program code, database structure, trademarks, logos, documentation and related technical results belong to the operator or corresponding rights holders unless otherwise stated.",
            "Users retain rights they lawfully hold in submitted content, but grant the operator the right to use, copy, store, display and process such content within the scope necessary to provide, maintain, review, display, back up, manage compliance and handle disputes.",
            "Without written permission from the operator, users may not copy, transfer, lease, sell, sublicense, publicly disclose or otherwise commercially exploit the system or its non-public data.",
          ],
        },
        {
          title: "6. Service Changes, Interruptions and Maintenance",
          items: [
            "The operator may add, adjust, suspend or terminate system functions, pages, permissions, fields, workflows, storage policies, review rules and service scope for business, technical, security, compliance or management needs.",
            "Service interruptions, delays, data synchronization issues or functional limitations may result from maintenance, network failures, cloud service incidents, security events, force majeure, third-party service changes or legal and regulatory requirements. The operator will take recovery measures within a reasonable scope.",
            "The operator does not guarantee that the system will be uninterrupted, error-free or meet every individual user requirement at all times, but will use reasonable commercial efforts to maintain system stability and security.",
          ],
        },
        {
          title: "7. Account Restriction, Suspension and Termination",
          items: [
            "If a user violates these terms, laws, business rules, confidentiality obligations or security requirements, or if an account presents abnormal, risky, unauthorized, misused or terminated authorization status, the operator may restrict, suspend, freeze or terminate access.",
            "After account access is restricted, suspended or terminated, the operator may retain relevant records as required for laws, audit, dispute handling, security management, contract performance or business traceability.",
            "If a user stops using the system or no longer has the corresponding business identity, the user should promptly contact an administrator to handle the account and permissions.",
          ],
        },
        {
          title: "8. Limitation of Liability",
          items: [
            "Users understand and agree that losses caused by inaccurate, unlawful or unauthorized submissions, breach of confidentiality, operational error, account sharing, unauthorized use or violation of these terms are borne by the responsible party under applicable law.",
            "To the maximum extent permitted by law, the operator is not liable for indirect losses, lost profits, business interruption or data loss caused by force majeure, third-party services, network communications, user devices, user operations, unauthorized access or events beyond reasonable control.",
            "Nothing in these terms excludes or limits liability that cannot be excluded or limited under applicable law.",
          ],
        },
        {
          title: "9. Governing Law and Dispute Resolution",
          items: [
            "The formation, effectiveness, performance, interpretation and dispute resolution of these terms are governed by the law of the operator's location or the law otherwise agreed in writing by the parties, except where mandatory applicable law provides otherwise.",
            "Disputes arising from these terms or use of the system should first be resolved through friendly consultation. If consultation fails, disputes may be handled according to the parties' written agreement or the dispute resolution method determined by applicable law.",
          ],
        },
        {
          title: "10. Updates and Contact",
          items: [
            "The operator may update these terms due to business, technical, legal or regulatory changes. Updated terms will be displayed on this page and will take effect upon publication or on the stated effective date.",
            "Questions about these terms, account status, permissions, submitted materials or system use should be directed to the system administrator or the operator's designated contact through the normal business support channel.",
          ],
        },
      ],
    },
  },
};
