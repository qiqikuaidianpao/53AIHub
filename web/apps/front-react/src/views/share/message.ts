export interface SharedUserFile {
  id?: string | number;
  file_id?: string | number;
  filename?: string;
  name?: string;
  file_name?: string;
  url?: string;
  file_url?: string;
  file_path?: string;
  size?: number | string;
  file_size?: number | string;
  mime_type?: string;
  file_mime?: string;
  mime?: string;
  type?: string;
  content?: unknown;
}

interface SharedUserContent {
  question: string;
  files: SharedUserFile[];
}

function parseJSON(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";

  const content = value as Record<string, unknown>;
  const text =
    content.text ?? content.content ?? content.textContent ?? content.pureTextContent;
  return typeof text === "string" ? text : "";
}

function isSharedUserFile(value: unknown): value is SharedUserFile {
  if (!value || typeof value !== "object") return false;

  const item = value as SharedUserFile;
  if (item.type === "text") return false;

  return Boolean(
    item.filename ??
      item.name ??
      item.file_name ??
      item.url ??
      item.file_url ??
      item.file_path,
  );
}

export function parseSharedUserContent(rawMessage: unknown): SharedUserContent {
  const messages = parseJSON(rawMessage);
  if (!Array.isArray(messages)) {
    return { question: getText(messages), files: [] };
  }

  const userMessage = messages.find(
    (message) =>
      message && typeof message === "object" && message.role === "user",
  ) as Record<string, unknown> | undefined;
  if (!userMessage) return { question: "", files: [] };

  const content = parseJSON(userMessage.content);
  if (!Array.isArray(content)) {
    return { question: getText(content), files: [] };
  }

  const textItem = content.find(
    (item) => item && typeof item === "object" && item.type === "text",
  );

  return {
    question: getText((textItem as Record<string, unknown> | undefined)?.content),
    files: content.filter(isSharedUserFile),
  };
}
