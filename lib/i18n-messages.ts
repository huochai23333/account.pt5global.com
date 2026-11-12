import type { Locale } from "./locale";

type MessageValue =
  | string
  | number
  | boolean
  | null
  | MessageTree
  | MessageValue[];

type MessageTree = {
  [key: string]: MessageValue;
};

/** 只向局部 Provider 传递所声明的消息树；复制后合并，避免不同页面互相修改共享字典。 */
export async function getScopedMessages(
  locale: Locale,
  namespaces: readonly string[],
) {
  const localeMessages = await loadLocaleMessages(locale);
  const scopedMessages: MessageTree = {};

  for (const namespace of new Set(namespaces)) {
    const value = readNamespace(localeMessages, namespace);

    if (value === undefined) {
      continue;
    }

    mergeMessageTrees(
      scopedMessages,
      buildScopedMessage(namespace.split("."), value),
    );
  }

  return scopedMessages;
}

async function loadLocaleMessages(locale: Locale) {
  if (locale === "en") {
    return (await import("../messages/en.json")).default as MessageTree;
  }

  return (await import("../messages/zh.json")).default as MessageTree;
}

function readNamespace(messages: MessageTree, namespace: string) {
  let current: MessageValue | undefined = messages;

  for (const segment of namespace.split(".")) {
    if (!isMessageTree(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function buildScopedMessage(path: readonly string[], value: MessageValue): MessageTree {
  const [head, ...rest] = path;

  if (!head) {
    return {};
  }

  return {
    [head]:
      rest.length === 0
        ? cloneMessageValue(value)
        : buildScopedMessage(rest, value),
  };
}

function mergeMessageTrees(target: MessageTree, source: MessageTree) {
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target[key];

    if (isMessageTree(targetValue) && isMessageTree(sourceValue)) {
      mergeMessageTrees(targetValue, sourceValue);
      continue;
    }

    target[key] = cloneMessageValue(sourceValue);
  }
}

function cloneMessageValue(value: MessageValue): MessageValue {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneMessageValue(entry));
  }

  if (isMessageTree(value)) {
    const cloned: MessageTree = {};

    for (const [key, entry] of Object.entries(value)) {
      cloned[key] = cloneMessageValue(entry);
    }

    return cloned;
  }

  return value;
}

function isMessageTree(value: MessageValue | undefined): value is MessageTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
