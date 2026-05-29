import { useRef, useCallback } from "react";
import type {
  SkillRunItem,
  SkillRunSkillItem,
  ProcessStep,
  IntentData,
  Message,
  AgentRunReplayEvent,
} from "../types";

// ============ 工具函数 ============

export function parseJson<T>(json: string, defaultValue: T | null = null): T | null {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

export function formatBash(code: string, language: string): string {
  const trimmed = (code || "").trim();
  return trimmed ? (language === "bash" || !language ? `$ ${trimmed}` : trimmed) : "";
}

export function getIntentData(raw: unknown): IntentData | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  return {
    intent: r.intent != null ? String(r.intent) : undefined,
    skill_name: r.skill_name != null ? String(r.skill_name) : undefined,
    confidence: typeof r.confidence === "number" ? r.confidence : undefined,
    reasoning: r.reasoning != null ? String(r.reasoning) : undefined,
    keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : undefined,
    answer: r.answer != null ? String(r.answer) : undefined,
    expanded_queries: r.expanded_queries,
  };
}

// ============ 列表更新辅助函数 ============

export function updateSkillItem(
  items: SkillRunItem[],
  predicate: (item: SkillRunItem) => boolean,
  updater: (item: SkillRunSkillItem) => Partial<SkillRunSkillItem>
): SkillRunItem[] {
  const idx = items.findIndex(predicate);
  if (idx === -1) return items;
  const item = items[idx] as SkillRunSkillItem;
  return [
    ...items.slice(0, idx),
    { ...item, ...updater(item) },
    ...items.slice(idx + 1),
  ];
}

// ============ 流程步骤处理函数 ============

function handleIntentClassification(
  step: ProcessStep,
  skillRunItems: SkillRunItem[]
): SkillRunItem[] {
  if (step.status === "start") {
    return [
      ...skillRunItems,
      { type: "skill", title: step.message || "正在识别意图...", status: "running" },
    ];
  }
  if (step.status === "completed") {
    const data = step.data as { intent?: unknown } | undefined;
    const intentData = getIntentData(data?.intent);
    return updateSkillItem(
      skillRunItems,
      (item) => item.type === "skill",
      () => ({
        title: step.message,
        status: "completed",
        skillName: intentData?.skill_name,
        intentData,
      })
    );
  }
  return skillRunItems;
}

function handleSkillRouting(step: ProcessStep, skillRunItems: SkillRunItem[]): SkillRunItem[] {
  if (step.status === "completed") {
    return updateSkillItem(
      skillRunItems,
      (item) => item.type === "skill",
      (item) => ({
        title: item.skillName ? `技能加载完成` : step.message,
        status: "completed",
      })
    );
  }
  return skillRunItems;
}

function handleToolExecutionStart(step: ProcessStep, skillRunItems: SkillRunItem[]): SkillRunItem[] {
  if (step.status !== "start" || !step.data) return skillRunItems;

  const data = step.data as {
    skill_name?: string;
    tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
  };
  const calls = data?.tool_calls ?? [];
  if (calls.length === 0) return skillRunItems;

  const firstSkill = skillRunItems.find(
    (item) => item.type === "skill"
  ) as SkillRunSkillItem | undefined;
  const firstCall = calls[0];
  const args =
    parseJson<{ code?: string; language?: string }>(
      firstCall.function?.arguments ?? "{}"
    ) ?? {};
  const bash = formatBash(args.code ?? "", args.language ?? "bash");
  const toolCallId = (firstCall.id ?? "") + "_running";

  const exists = skillRunItems.some(
    (item) => item.type === "skill" && (item as SkillRunSkillItem)._toolCallId === toolCallId
  );
  if (exists) return skillRunItems;

  return [
    ...skillRunItems,
    {
      type: "skill",
      title: "正在使用技能...",
      status: "running",
      skillName: data?.skill_name,
      intentData: firstSkill?.intentData,
      _bash: bash,
      _toolCallId: toolCallId,
    },
  ];
}

function handleToolResult(step: ProcessStep, skillRunItems: SkillRunItem[]): SkillRunItem[] {
  if (step.status !== "completed" || !step.data) return skillRunItems;

  const data = step.data as { tool_call_id?: string; result?: string; skill_name?: string };
  const toolCallId = (data?.tool_call_id ?? "") + "_running";
  const result = typeof data?.result === "string" ? data.result : "";

  let bash = "";
  let newItems = [...skillRunItems];
  const idx = newItems.findIndex(
    (item) => item.type === "skill" && (item as SkillRunSkillItem)._toolCallId === toolCallId
  );
  if (idx !== -1) {
    const item = newItems[idx] as SkillRunSkillItem;
    bash = item._bash ?? "";
    newItems = [
      ...newItems.slice(0, idx),
      { ...item, status: "completed" },
      ...newItems.slice(idx + 1),
    ];
  }

  return [
    ...newItems,
    {
      type: "script",
      title: data?.skill_name ? `技能 ${data.skill_name} 执行完成` : "技能执行完成",
      bash,
      output: result,
      status: "completed",
    },
  ];
}

function handleLlmDelta(step: ProcessStep, skillRunItems: SkillRunItem[]): SkillRunItem[] {
  if (step.status !== "streaming" || !step.data) return skillRunItems;

  const data = step.data as { content?: string };
  const content = data?.content || "";

  const existingIdx = skillRunItems.findIndex(
    (item) => item.type === "llm" && item.status === "running"
  );

  if (existingIdx !== -1) {
    const existing = skillRunItems[existingIdx] as { type: "llm"; title: string; content: string; status: "running" | "completed" };
    return [
      ...skillRunItems.slice(0, existingIdx),
      { ...existing, content: existing.content + content },
      ...skillRunItems.slice(existingIdx + 1),
    ];
  }

  return [
    ...skillRunItems,
    {
      type: "llm",
      title: "思考中...",
      content,
      status: "running",
    },
  ];
}

function finishLlmDelta(skillRunItems: SkillRunItem[]): SkillRunItem[] {
  const llmIdx = skillRunItems.findIndex(
    (item) => item.type === "llm" && item.status === "running"
  );
  if (llmIdx === -1) return skillRunItems;

  const llmItem = skillRunItems[llmIdx] as { type: "llm"; title: string; content: string; status: "running" | "completed" };
  return [
    ...skillRunItems.slice(0, llmIdx),
    { ...llmItem, status: "completed", title: "思考完成" },
    ...skillRunItems.slice(llmIdx + 1),
  ];
}

export function applyProcessStep(step: ProcessStep, items: SkillRunItem[]): { items: SkillRunItem[]; hasUpdate: boolean } {
  let newItems = [...items];

  if (step.step_code !== "llm_delta") {
    newItems = finishLlmDelta(newItems);
  }

  switch (step.step_code) {
    case "intent_classification":
      newItems = handleIntentClassification(step, newItems);
      break;
    case "skill_routing":
      newItems = handleSkillRouting(step, newItems);
      break;
    case "tool_execution":
      newItems = handleToolExecutionStart(step, newItems);
      break;
    case "tool_result":
      newItems = handleToolResult(step, newItems);
      break;
    case "llm_delta":
      newItems = handleLlmDelta(step, newItems);
      break;
    default:
      return { items: newItems, hasUpdate: newItems !== items };
  }

  return { items: newItems, hasUpdate: newItems !== items };
}

// ============ Replay 事件转换 ============

export function convertReplayEventToSSE(
  event: AgentRunReplayEvent,
  actualMessageId?: string | number
): any | null {
  const event_type = event.event_type || (event as any).type;
  const { payload, message_id } = event;
  const effectiveMessageId = actualMessageId || message_id || undefined;

  switch (event_type) {
    case "run.created":
      return effectiveMessageId ? { message_id: effectiveMessageId } : null;
    case "run.status_changed":
      return effectiveMessageId ? { message_id: effectiveMessageId } : null;
    case "process.step":
      return { ...payload, message_id: effectiveMessageId };
    case "message.delta":
      return { message_id: effectiveMessageId, ...payload };
    case "run.completed":
      return effectiveMessageId ? { message_id: effectiveMessageId } : null;
    case "run.failed":
      return {
        message_id: effectiveMessageId,
        error: true,
        error_message: payload.error_message || "运行失败",
      };
    case "run.cancelled":
      return effectiveMessageId ? { message_id: effectiveMessageId } : null;
    default:
      return null;
  }
}

// ============ 流数据处理 ============

export function processStreamDataItem(
  data: any,
  message: Message,
  formatRagStats: (ragStats: any, processRecords: any[]) => any
): void {
  const { message_id } = data;

  if (data?.error) {
    message.error = true;
    message.answer = data.error_message || "请求失败";
    message.loading = false;
    return;
  }

  if (data.object === "process.step") {
    const ps = data.process_step || {};
    const process_data = ps.data || {};

    if (!message.rag_temp) message.rag_temp = {};

    if (process_data.sources) {
      message.rag_temp.document_search = { chunks: process_data.sources };
    }

    if (!Array.isArray(message.process_records)) {
      message.process_records = [];
    }
    message.process_records = [
      ...message.process_records,
      { ...ps, data: JSON.stringify(process_data) },
    ];

    if (process_data.document_search) {
      message.rag_temp.document_search = process_data.document_search;
    }
    if (process_data.document_quotations) {
      message.rag_temp.document_quotations = process_data.document_quotations;
    }
    if (process_data.file_quotations) {
      message.rag_temp.file_quotations = process_data.file_quotations;
    }
    if (message.rag_temp.document_search) {
      message.rag_stats = formatRagStats(message.rag_temp, message.process_records || []);
    }
    message.rag_search_text = ps.message;

    if (ps.step_code === "output_files" && ps.status === "completed" && ps.data) {
      const files = ps.data?.files;
      if (Array.isArray(files) && files.length > 0) {
        if (!Array.isArray(message.outputFiles)) {
          message.outputFiles = [];
        }
        message.outputFiles.push(
          ...files.map((file: any) => ({
            id: file.id,
            file_name: file.file_name,
            url: file.url,
          }))
        );
      }
    }

    if (!Array.isArray(message.skillRunItems)) message.skillRunItems = [];

    const step: ProcessStep = {
      step_code: String(ps.step_code ?? ""),
      status: ps.status as any,
      message: String(ps.message ?? ""),
      data: ps.data,
    };

    const { items: newItems } = applyProcessStep(step, message.skillRunItems);
    message.skillRunItems = newItems;
  } else if (data.choices?.[0]?.delta) {
    const content = data.choices[0].delta.content?.replaceAll("<decision>DONE</decision>", "") || "";
    const reasoning_content =
      data.choices[0].delta.reasoning_content?.replaceAll("<decision>DONE</decision>", "") || "";

    if (content) {
      const failedTip = "请求失败";
      if (content.startsWith("Upstream Error") || content.startsWith("Error: 当前应用模型余额不足")) {
        message.answer = failedTip;
      } else if (message.answer === failedTip) {
        message.answer = content;
      } else {
        message.answer += content;
      }
    }
    if (reasoning_content) {
      message.reasoning_content = (message.reasoning_content || "") + reasoning_content;
    }
    if (message.answer?.trim() && message.reasoning_content?.trim() && message.reasoning_expanded) {
      message.reasoning_expanded = false;
    }
  }

  if (message_id) {
    message.id = message_id;
  }
}

// ============ 主 Hook ============

export function useChatStream() {
  const jsonBufferRef = useRef("");

  const processStreamData = useCallback(
    (
      e: any,
      processedLength: number,
      message: Message,
      networkSearch: boolean,
      formatRagStats: (ragStats: any, processRecords: any[]) => any
    ): number => {
      if (!e.event?.target || !message) return processedLength;

      if (networkSearch && message.rag_temp) {
        message.rag_temp.type = "web_search";
      }

      const fullResponse = e.event.target.response || "";
      const newChunk = fullResponse.substring(processedLength);
      const newProcessedLength = fullResponse.length;

      try {
        const lines = newChunk
          .split("\n")
          .filter((line: string) => line.trim() !== "" && line.trim() !== "data: [DONE]");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            if (jsonBufferRef.current) {
              jsonBufferRef.current = "";
            }

            const jsonStr = line.slice(6);
            const data = parseJson<any>(jsonStr);

            if (data) {
              if (data?.error) {
                message.error = true;
                message.answer = "请求失败";
                return newProcessedLength;
              }
              processStreamDataItem(data, message, formatRagStats);
              jsonBufferRef.current = "";
            } else {
              jsonBufferRef.current = jsonStr;
            }
          } else {
            if (jsonBufferRef.current) {
              const combinedJson = jsonBufferRef.current + line;
              const data = parseJson(combinedJson);

              if (data) {
                processStreamDataItem(data, message, formatRagStats);
                jsonBufferRef.current = "";
              } else {
                jsonBufferRef.current = combinedJson;
              }
            } else {
              message.error = true;
              message.answer = line;
            }
          }
        }
      } catch (err: unknown) {
        jsonBufferRef.current = "";
        message.error = true;
        message.answer = err instanceof Error ? err.message : String(err);
      }

      return newProcessedLength;
    },
    []
  );

  const clearBuffer = useCallback(() => {
    jsonBufferRef.current = "";
  }, []);

  return {
    applyProcessStep,
    processStreamData,
    clearBuffer,
    parseJson,
    processStreamDataItem,
    convertReplayEventToSSE,
  };
}

export default useChatStream;
