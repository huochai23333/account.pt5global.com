import fs from "node:fs";
import path from "node:path";

export type RegressionRole =
  | "administrator"
  | "salesman"
  | "promoter"
  | "operator"
  | "client"
  | "finance"
  | "manager"
  | "recruiter";

export type RegressionAccount = {
  email: string;
  password: string;
  role: RegressionRole;
  workspacePath: string;
};

const ROLE_ENV_PREFIX: Record<RegressionRole, string> = {
  administrator: "E2E_ADMIN",
  client: "E2E_CLIENT",
  finance: "E2E_FINANCE",
  manager: "E2E_MANAGER",
  operator: "E2E_OPERATOR",
  promoter: "E2E_PROMOTER",
  recruiter: "E2E_RECRUITER",
  salesman: "E2E_SALESMAN",
};

const ROLE_WORKSPACE_PATH: Record<RegressionRole, string> = {
  administrator: "/admin",
  client: "/client",
  finance: "/finance",
  manager: "/manager",
  operator: "/operator",
  promoter: "/promoter",
  recruiter: "/recruiter",
  salesman: "/salesman",
};

const LOCAL_ROLE_EMAIL_PREFIX: Record<RegressionRole, string> = {
  administrator: "local.admin@",
  client: "local.client@",
  finance: "local.finance@",
  manager: "local.manager@",
  operator: "local.operator@",
  promoter: "local.promoter@",
  recruiter: "local.recruiter@",
  salesman: "local.salesman@",
};

const FALLBACK_ROLE_ORDER: readonly RegressionRole[] = [
  "administrator",
  "salesman",
  "promoter",
  "client",
  "finance",
  "operator",
  "manager",
  "recruiter",
];

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SECRET_PATTERN = /[A-Za-z0-9!#$%&*+./:<=>?@^_`{|}~-]{8,}/g;

let cachedAccounts: Partial<Record<RegressionRole, RegressionAccount>> | null =
  null;

export function getRegressionAccount(role: RegressionRole): RegressionAccount {
  const accounts = loadRegressionAccounts();
  const account = accounts[role];

  if (!account) {
    throw new Error(
      `Missing ${role} regression account. Set ${ROLE_ENV_PREFIX[role]}_EMAIL and ${ROLE_ENV_PREFIX[role]}_PASSWORD, or keep the local test account file available.`,
    );
  }

  return account;
}

export function getStaleRoleRegressionAccount(): RegressionAccount | null {
  return getSpecialLocalAccount("local.stale-role-client@", "client");
}

export function getInactiveRegressionAccount(): RegressionAccount | null {
  return getSpecialLocalAccount("local.inactive-client@", "client");
}

export function getPeerSalesmanRegressionAccount(): RegressionAccount | null {
  // 第二个业务员仅用于本地协作回归；云端测试没有该固定账号时，用例会明确跳过。
  return getSpecialLocalAccount("local.peer-salesman@", "salesman");
}

export function getPeerOperatorRegressionAccount(): RegressionAccount | null {
  // 第二个运营只存在于本地 Docker，用于需要隔离本人批量写入的报销回归。
  return getSpecialLocalAccount("local.peer-operator@", "operator");
}

function getSpecialLocalAccount(
  emailPrefix: string,
  role: RegressionRole,
): RegressionAccount | null {
  if (!shouldPreferLocalSupabaseAccounts()) {
    return null;
  }

  const localSeedPath = findLocalSeedPath();

  if (!localSeedPath) {
    return null;
  }

  const text = fs.readFileSync(localSeedPath, "utf8");
  const email = Array.from(text.matchAll(EMAIL_PATTERN), (match) => match[0]).find(
    (value) => value.toLowerCase().startsWith(emailPrefix),
  );
  const password = text.match(/crypt\('([^']+)'/)?.[1];

  if (!email || !password) {
    return null;
  }

  // 专用账号只存在于本地 Docker，生产和云端回归不会读取本地测试凭据。
  return {
    email,
    password,
    role,
    workspacePath: ROLE_WORKSPACE_PATH[role],
  };
}

function loadRegressionAccounts() {
  if (cachedAccounts) {
    return cachedAccounts;
  }

  cachedAccounts = {
    ...loadAccountsFromLocalFile(),
    ...loadAccountsFromEnv(),
  };

  return cachedAccounts;
}

function loadAccountsFromEnv(): Partial<
  Record<RegressionRole, RegressionAccount>
> {
  const accounts: Partial<Record<RegressionRole, RegressionAccount>> = {};

  for (const role of FALLBACK_ROLE_ORDER) {
    const prefix = ROLE_ENV_PREFIX[role];
    const email = process.env[`${prefix}_EMAIL`]?.trim();
    const password = process.env[`${prefix}_PASSWORD`];

    if (email && password) {
      accounts[role] = {
        email,
        password,
        role,
        workspacePath: ROLE_WORKSPACE_PATH[role],
      };
    }
  }

  return accounts;
}

function loadAccountsFromLocalFile(): Partial<
  Record<RegressionRole, RegressionAccount>
> {
  if (shouldPreferLocalSupabaseAccounts()) {
    const localAccounts = loadLocalDockerAccounts();

    if (Object.keys(localAccounts).length > 0) {
      return localAccounts;
    }
  }

  const accountFilePath =
    process.env.E2E_ACCOUNTS_FILE?.trim() ||
    path.resolve(process.cwd(), "..", "测试账号.txt");

  if (!fs.existsSync(accountFilePath)) {
    return {};
  }

  const text = fs.readFileSync(accountFilePath, "utf8");

  return loadOrderedAccounts(text);
}

function loadOrderedAccounts(
  text: string,
): Partial<Record<RegressionRole, RegressionAccount>> {
  const emails = Array.from(text.matchAll(EMAIL_PATTERN), (match) => match[0]);
  const passwords = text
    .split(/\r?\n/)
    .filter((line) => !line.match(EMAIL_PATTERN))
    .flatMap((line) =>
      Array.from(line.matchAll(SECRET_PATTERN), (match) => match[0]),
    );
  const accounts: Partial<Record<RegressionRole, RegressionAccount>> = {};

  FALLBACK_ROLE_ORDER.forEach((role, index) => {
    const email = emails[index];
    const password = passwords[index];

    if (email && password) {
      accounts[role] = {
        email,
        password,
        role,
        workspacePath: ROLE_WORKSPACE_PATH[role],
      };
    }
  });

  return accounts;
}

function loadLocalDockerAccounts(): Partial<
  Record<RegressionRole, RegressionAccount>
> {
  const localSeedPath = findLocalSeedPath();

  if (!localSeedPath) {
    return {};
  }

  const text = fs.readFileSync(localSeedPath, "utf8");
  const emails = Array.from(text.matchAll(EMAIL_PATTERN), (match) => match[0]);
  const sharedPassword = text.match(/crypt\('([^']+)'/)?.[1];
  const accounts: Partial<Record<RegressionRole, RegressionAccount>> = {};

  if (!sharedPassword) {
    return accounts;
  }

  for (const role of FALLBACK_ROLE_ORDER) {
    const prefix = LOCAL_ROLE_EMAIL_PREFIX[role];
    const email = emails.find((value) =>
      value.toLowerCase().startsWith(prefix),
    );

    if (email) {
      accounts[role] = {
        email,
        password: sharedPassword,
        role,
        workspacePath: ROLE_WORKSPACE_PATH[role],
      };
    }
  }

  return accounts;
}

function findLocalSeedPath() {
  // 本地开发仓库可能使用旧的根目录布局或新的 supabase/ 标准项目目录，测试优先读取真实存在的种子文件。
  const candidatePaths = [
    path.resolve(process.cwd(), "..", "supabase", "local-test-data.sql"),
    path.resolve(
      process.cwd(),
      "..",
      "supabase",
      "supabase",
      "local-test-data.sql",
    ),
    path.resolve(
      process.cwd(),
      "..",
      "PT5-dropshipping-supabase",
      "supabase",
      "local-test-data.sql",
    ),
  ];

  return candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
}

function shouldPreferLocalSupabaseAccounts() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL");

  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/i.test(
    supabaseUrl ?? "",
  );
}

function readLocalEnvValue(key: string) {
  const envFilePath = path.resolve(process.cwd(), ".env.local");

  if (!fs.existsSync(envFilePath)) {
    return undefined;
  }

  const line = fs
    .readFileSync(envFilePath, "utf8")
    .split(/\r?\n/)
    .find((value) => value.startsWith(`${key}=`));

  if (!line) {
    return undefined;
  }

  return line.slice(key.length + 1).trim();
}
