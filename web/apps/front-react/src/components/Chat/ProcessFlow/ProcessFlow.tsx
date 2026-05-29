import React, { useState, useMemo, useEffect } from "react";
import { message } from "antd";
import { SvgIcon } from "@km/shared-components-react";
import { formatFileInfo } from "@/api/modules/files/transform";
import { safeParseJson, formatLlmContent } from "./utils";
import { copyToClip } from "@km/shared-utils";
import type { ProcessFlowHeaderProps, ProcessRecord, StepStatus } from "./types";
import "./styles.css";

// ============ 类型定义 ============

interface ToolCall {
  id: string;
  name: string;
  arguments?: string;
  status: StepStatus;
  result?: string;
}

interface LlmBlock {
  id: string;
  type: "llm";
  content: string;
  status: StepStatus;
}

interface ToolBlock {
  id: string;
  type: "tool";
  toolCall: ToolCall;
}

type ExecutionItem = LlmBlock | ToolBlock;

interface StepData {
  id: string;
  type: string;
  status: StepStatus;
  title: string;
  icon: string;
  message?: string;
  data?: unknown;
}

// ============ 步骤显示配置 ============

const STEP_CONFIG: Record<string, { running: { title: string; icon: string }; completed: { title: string; icon: string } }> = {
  intent_classification: { running: { title: "意图理解中...", icon: "loading" }, completed: { title: "意图理解完成", icon: "tips" } },
  knowledge_search: { running: { title: "智能检索中...", icon: "loading" }, completed: { title: "智能检索完成", icon: "ai-search-2" } },
  knowledge_extraction: { running: { title: "提取知识中...", icon: "loading" }, completed: { title: "提取知识完成", icon: "outbound" } },
  skill_load: { running: { title: "技能加载中...", icon: "loading" }, completed: { title: "技能加载完成", icon: "terminal" } },
  llm_delta: { running: { title: "思考中...", icon: "loading" }, completed: { title: "思考完成", icon: "brain" } },
  tool_execution: { running: { title: "技能执行中...", icon: "loading" }, completed: { title: "技能执行完成", icon: "skill" } },
};

const SKIP_STEPS = ["scope_narrowing", "ref_analysis", "dcs", "output_files", 'answer_generation'];

// ============ 解析函数 ============

function parseProcessSteps(records: ProcessRecord[] | undefined, shouldComplete: boolean): StepData[] {
  if (!records || records.length === 0) return [];

  const steps: StepData[] = [];
  const toolCallMap = new Map<string, ToolCall>();
  let llmDeltaCounter = 0;
  let toolExecutionCounter = 0;
  let toolCallIdCounter = 0;
  let currentLlmDelta: StepData | null = null;
  // 跟踪当前 skill 的 tool_execution 步骤，避免重复创建
  const skillExecutionMap = new Map<string, StepData>();
  // 当前活跃的 skill 名称
  let currentActiveSkillName: string | null = null;
  // 当前正在累积的 llm block（在技能执行内）
  let currentLlmBlock: LlmBlock | null = null;

  // 完成当前 llm block（只标记状态，block 已在创建时添加到 items）
  const finalizeCurrentLlmBlock = () => {
    if (currentLlmBlock) {
      currentLlmBlock.status = "completed";
      currentLlmBlock = null;
    }
  };

  for (const record of records) {
    const stepCode = record.step_code;
    if (!stepCode || SKIP_STEPS.includes(stepCode)) continue;

    const data = safeParseJson(record.data);
    const isCompleted = record.status === "completed";

    // 1. llm_delta: 流式思考内容
    if (stepCode === "llm_delta") {
      const content = (data as any)?.content || "";
      // 如果有活跃的技能执行，将思考内容追加到当前的 llm block 中
      if (currentActiveSkillName && skillExecutionMap.has(currentActiveSkillName)) {
        if (currentLlmBlock) {
          // 追加内容
          currentLlmBlock.content += content;
        } else {
          // 创建新的 llm block 并立即添加到 items 中
          currentLlmBlock = {
            id: `llm_${llmDeltaCounter++}`,
            type: "llm",
            content: content,
            status: "running",
          };
          const executionStep = skillExecutionMap.get(currentActiveSkillName)!;
          const items = (executionStep.data as any)?.items as ExecutionItem[];
          if (items) {
            items.push(currentLlmBlock);
          }
        }
      } else if (currentLlmDelta) {
        // 追加内容，保持 running 状态
        currentLlmDelta.data = (currentLlmDelta.data as string) + content;
      } else {
        // 创建新的 llm_delta 步骤
        currentLlmDelta = {
          id: `llm_delta_${llmDeltaCounter++}`,
          type: "llm_delta",
          status: "running",
          title: "思考中...",
          icon: "loading",
          data: content,
        };
        steps.push(currentLlmDelta);
      }
      continue;
    }

    // 遇到非 llm_delta 步骤，先完成独立的 llm_delta
    if (currentLlmDelta) {
      currentLlmDelta.status = "completed";
      currentLlmDelta.title = "思考完成";
      currentLlmDelta.icon = "brain";
      currentLlmDelta = null;
    }
    // 也完成技能执行内的 llm block
    finalizeCurrentLlmBlock();

    // 2. intent_classification: 意图理解
    if (stepCode === "intent_classification") {
      const config = STEP_CONFIG.intent_classification;
      const existingIdx = steps.findIndex(s => s.type === "intent_classification");
      const displayMessage = (data as any)?.intent?.reasoning || record.message || "";
      if (existingIdx !== -1) {
        const existing = steps[existingIdx];
        existing.status = isCompleted ? "completed" : "running";
        existing.title = isCompleted ? config.completed.title : config.running.title;
        existing.icon = isCompleted ? config.completed.icon : config.running.icon;
        existing.message = displayMessage;
        if (data) existing.data = data;
      } else {
        steps.push({
          id: "intent_classification",
          type: "intent_classification",
          status: isCompleted ? "completed" : "running",
          title: isCompleted ? config.completed.title : config.running.title,
          icon: isCompleted ? config.completed.icon : config.running.icon,
          message: displayMessage,
          data: data,
        });
      }
      continue;
    }

    // 3. knowledge_search: 知识检索
    if (stepCode === "knowledge_search") {
      const config = STEP_CONFIG.knowledge_search;
      const existingIdx = steps.findIndex(s => s.type === "knowledge_search");
      if (existingIdx !== -1) {
        const existing = steps[existingIdx];
        existing.status = isCompleted ? "completed" : "running";
        existing.title = isCompleted ? config.completed.title : config.running.title;
        existing.icon = isCompleted ? config.completed.icon : config.running.icon;
        if (data) existing.data = data;
      } else {
        steps.push({
          id: "knowledge_search",
          type: "knowledge_search",
          status: isCompleted ? "completed" : "running",
          title: isCompleted ? config.completed.title : config.running.title,
          icon: isCompleted ? config.completed.icon : config.running.icon,
          data: data,
        });
      }
      continue;
    }

    // 4. skill_routing: 技能加载
    if (stepCode === "skill_routing") {
      const config = STEP_CONFIG.skill_load;
      const skillName = (data as any)?.skill_name || "";
      const existingIdx = steps.findIndex(s => s.type === "skill_load");
      if (existingIdx !== -1) {
        const existing = steps[existingIdx];
        existing.status = isCompleted ? "completed" : "running";
        existing.title = isCompleted ? config.completed.title : config.running.title;
        existing.icon = isCompleted ? config.completed.icon : config.running.icon;
        if (skillName) existing.data = { skillName };
      } else {
        steps.push({
          id: "skill_load",
          type: "skill_load",
          status: isCompleted ? "completed" : "running",
          title: isCompleted ? config.completed.title : config.running.title,
          icon: isCompleted ? config.completed.icon : config.running.icon,
          data: { skillName },
        });
      }
      continue;
    }

    // 5. tool_call: 历史数据工具调用
    if (stepCode === "tool_call") {
      const skillName = (data as any)?.skill_name || "";
      const toolCallId = (data as any)?.tool_call_id || `tool-${toolCallIdCounter++}`;
      const toolName = (data as any)?.tool_name || (data as any)?.function_name || "unknown";
      const args = (data as any)?.arguments || "";

      // 如果遇到不同的 skill，标记前一个 skill 完成
      if (currentActiveSkillName && currentActiveSkillName !== skillName) {
        const prevExecutionStep = skillExecutionMap.get(currentActiveSkillName);
        if (prevExecutionStep && prevExecutionStep.status === "running") {
          // 先完成当前的 llm block
          finalizeCurrentLlmBlock();
          prevExecutionStep.status = "completed";
          prevExecutionStep.title = "技能执行完成";
          prevExecutionStep.icon = "skill";
          const prevItems = (prevExecutionStep.data as any)?.items as ExecutionItem[] | undefined;
          if (prevItems) {
            prevItems.forEach(item => {
              if (item.type === "llm") item.status = "completed";
              else if (item.type === "tool" && item.toolCall.status === "running") item.toolCall.status = "completed";
            });
          }
        }
      }

      // 先完成当前的 llm block（在更新 skill 之前）
      finalizeCurrentLlmBlock();

      // 更新当前活跃 skill
      currentActiveSkillName = skillName;

      const tc: ToolCall = {
        id: toolCallId,
        name: toolName,
        arguments: args,
        status: "running",
        result: "",
      };
      toolCallMap.set(toolCallId, tc);

      // 查找或创建当前 skill 的 tool_execution 步骤
      let executionStep = skillExecutionMap.get(skillName);
      if (!executionStep) {
        executionStep = {
          id: `tool_execution_${toolExecutionCounter++}`,
          type: "tool_execution",
          status: "running",
          title: "技能执行中...",
          icon: "loading",
          data: { skillName, items: [] },
        };
        steps.push(executionStep);
        skillExecutionMap.set(skillName, executionStep);
      }
      // 将工具调用作为 ToolBlock 添加到 items 中
      const items = (executionStep.data as any)?.items as ExecutionItem[];
      if (items) {
        items.push({ id: toolCallId, type: "tool", toolCall: tc });
      }
      continue;
    }

    // 6. tool_execution: 工具执行
    if (stepCode === "tool_execution") {
      const skillName = (data as any)?.skill_name || "";

      if (record.status === "start") {
        // 如果遇到不同的 skill，标记前一个 skill 完成
        if (currentActiveSkillName && currentActiveSkillName !== skillName) {
          const prevExecutionStep = skillExecutionMap.get(currentActiveSkillName);
          if (prevExecutionStep && prevExecutionStep.status === "running") {
            finalizeCurrentLlmBlock();
            prevExecutionStep.status = "completed";
            prevExecutionStep.title = "技能执行完成";
            prevExecutionStep.icon = "skill";
            const prevItems = (prevExecutionStep.data as any)?.items as ExecutionItem[] | undefined;
            if (prevItems) {
              prevItems.forEach(item => {
                if (item.type === "llm") item.status = "completed";
                else if (item.type === "tool" && item.toolCall.status === "running") item.toolCall.status = "completed";
              });
            }
          }
        }

        // 先完成当前的 llm block（在更新 skill 之前）
        finalizeCurrentLlmBlock();

        // 更新当前活跃 skill
        currentActiveSkillName = skillName;

        const toolCalls: ToolCall[] = ((data as any)?.tool_calls || []).map((call: any) => {
          const toolCallId = call?.id || `tool-${toolCallIdCounter++}`;
          const func = call?.function || {};
          const tc: ToolCall = {
            id: toolCallId,
            name: func?.name || "unknown",
            arguments: func?.arguments || "",
            status: "running",
            result: "",
          };
          toolCallMap.set(toolCallId, tc);
          return tc;
        });

        // 查找或创建当前 skill 的 tool_execution 步骤
        let executionStep = skillExecutionMap.get(skillName);
        if (!executionStep) {
          executionStep = {
            id: `tool_execution_${toolExecutionCounter++}`,
            type: "tool_execution",
            status: "running",
            title: "技能执行中...",
            icon: "loading",
            data: { skillName, items: [] },
          };
          steps.push(executionStep);
          skillExecutionMap.set(skillName, executionStep);
        }
        // 将工具调用作为 ToolBlock 添加到 items 中
        const items = (executionStep.data as any)?.items as ExecutionItem[];
        if (items) {
          toolCalls.forEach(tc => {
            items.push({ id: tc.id, type: "tool", toolCall: tc });
          });
        }
      } else if (record.status === "completed") {
        // tool_execution completed: 只保存当前的 llm block，不标记整个 skill 完成
        // 同一个 skill 的多个 tool_execution 会合并在一个步骤中
        finalizeCurrentLlmBlock();
      }
      continue;
    }

    // 7. tool_result: 工具执行结果
    if (stepCode === "tool_result") {
      const toolCallId = (data as any)?.tool_call_id;
      if (toolCallId && toolCallMap.has(toolCallId)) {
        const tc = toolCallMap.get(toolCallId)!;
        tc.result = (data as any)?.result || "";
        tc.status = "completed";
      }
      continue;
    }

    // 8. tool_completed: 单个工具完成
    if (stepCode === "tool_completed") {
      const toolCallId = (data as any)?.tool_call_id;
      if (toolCallId && toolCallMap.has(toolCallId)) {
        toolCallMap.get(toolCallId)!.status = "completed";
      }
      continue;
    }
  }

  // 当流结束或有内容输出时，完成最后一个 llm_delta
  if (currentLlmDelta && shouldComplete) {
    currentLlmDelta.status = "completed";
    currentLlmDelta.title = "思考完成";
    currentLlmDelta.icon = "brain";
  }

  // 当流结束或有内容输出时，完成当前活跃的技能执行
  if (shouldComplete && currentActiveSkillName && skillExecutionMap.has(currentActiveSkillName)) {
    // 先完成当前的 llm block
    finalizeCurrentLlmBlock();
    const executionStep = skillExecutionMap.get(currentActiveSkillName)!;
    if (executionStep.status === "running") {
      executionStep.status = "completed";
      executionStep.title = "技能执行完成";
      executionStep.icon = "skill";
      const items = (executionStep.data as any)?.items as ExecutionItem[] | undefined;
      if (items) {
        items.forEach(item => {
          if (item.type === "llm") item.status = "completed";
          else if (item.type === "tool" && item.toolCall.status === "running") item.toolCall.status = "completed";
        });
      }
    }
  }

  // 自动添加 knowledge_extraction（当 knowledge_search 完成且无错误时）
  const knowledgeIdx = steps.findIndex(s => s.type === "knowledge_search");
  if (knowledgeIdx !== -1) {
    const knowledgeStep = steps[knowledgeIdx];
    const knowledgeData = knowledgeStep.data as any;
    const hasError = knowledgeData?.error_count > 0;
    if (knowledgeStep.status === "completed" && !hasError && !steps.some(s => s.type === "knowledge_extraction")) {
      steps.splice(knowledgeIdx + 1, 0, {
        id: "knowledge_extraction",
        type: "knowledge_extraction",
        status: "completed",
        title: "提取知识完成",
        icon: "outbound",
        data: knowledgeStep.data,
      });
    }
  }

  return steps;
}

// ============ 组件 ============

const ProcessFlow: React.FC<ProcessFlowHeaderProps> = ({
  processRecords,
  streaming,
  hasContent,
  onOpenKnow,
  onSourceClick,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [manuallyToggled, setManuallyToggled] = useState<Record<string, boolean>>({});

  // streaming 时默认展开，否则看用户手动设置
  const isStepExpanded = (stepId: string) => {
    if (manuallyToggled[stepId] !== undefined) {
      return manuallyToggled[stepId];
    }
    return streaming;
  };

  // 切换步骤展开状态
  const toggleStep = (stepId: string) => {
    const newExpanded = !isStepExpanded(stepId);
    setManuallyToggled(prev => ({ ...prev, [stepId]: newExpanded }));
  };

  // 切换父步骤时同时切换子步骤
  const toggleStepWithChildren = (step: StepData) => {
    const newExpanded = !isStepExpanded(step.id);
    const updates: Record<string, boolean> = { [step.id]: newExpanded };
    if (step.type === "tool_execution" && (step.data as any)?.items) {
      (step.data as any).items.forEach((item: ExecutionItem) => {
        updates[item.id] = newExpanded;
        if (item.type === "tool") {
          updates[item.toolCall.id] = newExpanded;
        }
      });
    }
    setManuallyToggled(prev => ({ ...prev, ...updates }));
  };

  // 面板展开/收起
  useEffect(() => {
    if (streaming && !hasContent) setExpanded(true);
    else {
      setExpanded(false);
      setManuallyToggled({});
    }
  }, [streaming, hasContent]);

  const steps = useMemo(() => {
    const shouldComplete = !streaming || hasContent;
    const parsed = parseProcessSteps(processRecords, shouldComplete);
    // 流结束时修正所有 running 状态
    if (shouldComplete) {
      return parsed.map(step => {
        if (step.status !== "running") return step;
        const config = STEP_CONFIG[step.type];
        if (!config) return step;
        return {
          ...step,
          status: "completed",
          title: config.completed.title,
          icon: config.completed.icon,
        };
      });
    }
    return parsed;
  }, [processRecords, streaming, hasContent]);

  // 新增 running 步骤时自动展开（用户操作过的不会覆盖）
  useEffect(() => {
    if (streaming && !hasContent && steps.length > 0) {
      setManuallyToggled(prev => {
        const newMap = { ...prev };
        let changed = false;
        steps.forEach(step => {
          // 只处理 running 且未设置过的步骤
          if (step.status === 'running' && prev[step.id] === undefined) {
            newMap[step.id] = true;
            changed = true;
            // tool_execution 内部子步骤
            if (step.type === 'tool_execution') {
              const items = (step.data as any)?.items as ExecutionItem[] | undefined;
              if (items) {
                items.forEach(item => {
                  const itemId = item.type === 'tool' ? item.toolCall.id : item.id;
                  if (prev[itemId] === undefined) {
                    newMap[itemId] = true;
                    changed = true;
                  }
                });
              }
            }
          }
        });
        return changed ? newMap : prev;
      });
    }
  }, [steps, streaming, hasContent]);

  if (steps.length === 0) return null;

  const renderStepBody = (step: StepData) => {
    const isExpanded = isStepExpanded(step.id);

    // llm_delta 思考内容
    if (step.type === "llm_delta") {
      const content = step.data as string;
      if (!content) return null;
      return isExpanded ? (
        <div className="x-task-step-body">
          {formatLlmContent(content)}
        </div>
      ) : null;
    }

    // 意图理解
    if (step.type === "intent_classification") {
      if (!step.message) return null;
      return isExpanded ? (
        <div className="x-task-step-body">
          {step.message}
        </div>
      ) : null;
    }

    // 知识检索
    if (step.type === "knowledge_search") {
      const data = step.data as any;
      const allSources = Array.isArray(data?.sources) ? data.sources : [];
      const graphResults = allSources.filter((s: any) => s.chunk_type === "graph_result");
      const sources = allSources.filter((s: any) => s.chunk_type !== "graph_result");
      const webResults = Array.isArray(data?.web_results) ? data.web_results : [];

      return isExpanded ? (
        <div className="x-task-step-body">
          {/* 错误信息 */}
          {data?.error_count > 0 && Array.isArray(data?.search_errors) && data.search_errors.length > 0 && (
            <div className="x-task-error-list">
              {data.search_errors.map((err: string, idx: number) => (
                <div key={idx} className="x-task-error-item">{err}</div>
              ))}
            </div>
          )}

          {/* 无错误时显示正常数据 */}
          {(!data?.error_count || data.error_count === 0) && (
            <>
              {/* 知识图谱检索结果 */}
              {graphResults.length > 0 && (
                <>
                  <div className="x-task-tag" onClick={onOpenKnow}>
                    <div className="x-task-tag-icon"><SvgIcon name="search" size={16} /></div>
                    从知识图谱中检索到实体关系 {graphResults.reduce((sum: number, item: any) => sum + (item.graph?.relations?.length || 0), 0)} 个
                    <div className="x-task-tag-icon"><SvgIcon name="arrow-right" size={16} /></div>
                  </div>
                  <div className="x-task-relation-list">
                    {graphResults.map((item: any, idx: number) => {
                      const entities = item.graph?.entities || [];
                      const relations = item.graph?.relations || [];
                      const entityMap = new Map<string, string>();
                      entities.forEach((e: any) => { entityMap.set(e.id, e.name || e.description || ""); });
                      return relations.map((r: any, rIdx: number) => {
                        const sourceName = entityMap.get(r.source_entity_id) || r.source_entity_id;
                        const targetName = entityMap.get(r.target_entity_id) || r.target_entity_id;
                        return (
                          <span key={`${idx}-${rIdx}`} className="x-task-relation-item">
                            {sourceName} {r.predicate} {targetName}
                          </span>
                        );
                      });
                    })}
                  </div>
                </>
              )}

              {/* 知识库检索结果 */}
              {sources.length > 0 && (
                <div style={{ marginTop: graphResults.length > 0 ? "16px" : 0 }}>
                  {(() => {
                    const uniqueFiles = new Map<string, any>();
                    const uniqueLibraries = new Map<string, { name: string; count: number }>();
                    for (const source of sources) {
                      const fileId = source.file_id;
                      const libId = source.library_id || source.knowledge_base_id;
                      const libName = source.library_name || source.knowledge_base_name;
                      if (fileId && !uniqueFiles.has(fileId)) uniqueFiles.set(fileId, source);
                      if (libId && libName && !uniqueLibraries.has(libId)) uniqueLibraries.set(libId, { name: libName, count: 1 });
                    }
                    const dedupedSources = Array.from(uniqueFiles.values());
                    return (
                      <>
                        <div className="x-task-tag" onClick={onOpenKnow}>
                          <div className="x-task-tag-icon"><SvgIcon name="search" size={16} /></div>
                          从知识库中检索到 {uniqueLibraries.size} 个知识库、{dedupedSources.length} 篇知识文档
                          <div className="x-task-tag-icon"><SvgIcon name="arrow-right" size={16} /></div>
                        </div>
                        <div className="x-task-relation-list">
                          {dedupedSources.map((source: any) => {
                            const filePath = source.file_path || source.file_name || "";
                            const { fname, icon } = formatFileInfo(filePath);
                            return (
                              <span
                                key={source.file_id || source.chunk_id}
                                className="x-task-relation-item"
                                style={{ cursor: onSourceClick ? "pointer" : "default" }}
                                onClick={() => onSourceClick?.(source)}
                              >
                                <span className="x-task-relation-icon"><img src={icon} alt="" style={{ width: 16, height: 16 }} /></span>
                                <span className="x-task-relation-name">{fname || source.library_name || filePath.split("/").pop()}</span>
                              </span>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 联网搜索结果 */}
              {webResults.length > 0 && (
                <div style={{ marginTop: graphResults.length > 0 || sources.length > 0 ? "16px" : 0 }}>
                  <div className="x-task-tag" onClick={onOpenKnow}>
                    <div className="x-task-tag-icon"><SvgIcon name="search" size={16} /></div>
                    从联网搜索中检索到 {webResults.length} 个相关网页
                    <div className="x-task-tag-icon"><SvgIcon name="arrow-right" size={16} /></div>
                  </div>
                  <div className="x-task-relation-list">
                    {webResults.map((item: any, idx: number) => (
                      <span key={idx} className="x-task-relation-item">
                        <span className="x-task-relation-icon">🔗</span>
                        <span className="x-task-relation-name">{item.title || item.name || item.url}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 无数据时显示消息 */}
              {graphResults.length === 0 && sources.length === 0 && webResults.length === 0 &&
                (!data?.error_count || data.error_count === 0) && step.message && <div>{step.message}</div>}
            </>
          )}
        </div>
      ) : null;
    }

    // 知识提取
    if (step.type === "knowledge_extraction") {
      const knowledgeData = step.data as any;
      const outputText = JSON.stringify(knowledgeData?.sources?.slice(0, 2) || [], null, 2);

      return isExpanded ? (
        <div className="x-task-step-body">
          {knowledgeData?.sources?.length > 0 && (
            <div className="x-task-code-block">
              <div className="x-task-code-header">
                <span>Output</span>
                <div className="x-task-code-copy" onClick={() => copyToClip(outputText).then(() => message.success("已复制"))}>
                  <SvgIcon name="copy" size={14} />
                </div>
              </div>
              <pre className="x-task-code-content">{outputText}</pre>
            </div>
          )}
        </div>
      ) : null;
    }

    return null;
  };

  if (steps.length === 0) return null;

  return (
    <div className="x-task-process-flow">
      <div className="x-task-process-header" onClick={() => setExpanded(prev => !prev)}>
        <div className="x-task-process-title">
          <SvgIcon name={expanded ? "up" : "down"} size={16} className="x-task-process-icon" />
          {expanded ? "隐藏任务执行过程" : "显示任务执行过程"}
        </div>
      </div>

      {expanded && (
        <div className="x-task-process-content">
          {steps.map((step, index) => {
            const hasBody = ["llm_delta", "knowledge_search", "knowledge_extraction", "intent_classification", "tool_execution"].includes(step.type);
            const stepExpanded = isStepExpanded(step.id);
            const isRunning = step.status === "running";

            // tool_execution 使用 SkillProcessFlow 的样式
            if (step.type === "tool_execution") {
              const { skillName, items } = (step.data as any) || {};
              return (
                <div key={step.id} className="x-skill-step">
                  <div className="x-skill-step-connector" />
                  <div
                    className="x-skill-step-header"
                    style={{ justifyContent: "space-between", cursor: "pointer" }}
                    onClick={() => toggleStepWithChildren(step)}
                  >
                    <div className={`x-skill-step-icon ${isRunning ? "x-skill-step-icon--running" : ""}`}>
                      <SvgIcon name={isRunning ? "loading" : "skill"} size={16} />
                    </div>
                    <div className={`x-skill-step-title ${isRunning ? "x-skill-step-title--running" : ""}`}>
                      技能执行{isRunning ? "中..." : "完成"}
                    </div>
                    <div className="x-skill-step-action">
                      {skillName}
                      <SvgIcon name={stepExpanded ? "up" : "down"} size={14} style={{ marginLeft: "4px" }} />
                    </div>
                  </div>
                  {stepExpanded && items && items.length > 0 && (
                    <div className="x-skill-step-body x-skill-step-body-plain">
                      {items.map((item: ExecutionItem, idx: number) => {
                        // 思考内容块
                        if (item.type === "llm") {
                          const isLlmExpanded = isStepExpanded(item.id);
                          const isLlmRunning = item.status === "running";
                          return (
                            <div key={item.id} className="x-skill-nested-step">
                              {idx < items.length - 1 && <div className="x-skill-nested-connector" />}
                              <div
                                className="x-skill-nested-header"
                                onClick={() => toggleStep(item.id)}
                              >
                                <div className="x-skill-nested-title">
                                  <div className={`x-skill-nested-icon ${isLlmRunning ? "x-skill-step-icon--running" : "x-skill-step-icon--completed"}`}>
                                    <SvgIcon name={isLlmRunning ? "loading" : "brain"} size={16} />
                                  </div>
                                  思考{isLlmRunning ? "中..." : "完成"}
                                </div>
                                <SvgIcon name={isLlmExpanded ? "up" : "down"} size={14} style={{ color: "#9ca3af" }} />
                              </div>
                              {isLlmExpanded && item.content && (
                                <div className="x-skill-nested-body">
                                  {formatLlmContent(item.content)}
                                </div>
                              )}
                            </div>
                          );
                        }
                        // 工具调用块
                        if (item.type === "tool") {
                          const tool = item.toolCall;
                          const isNestedExpanded = isStepExpanded(tool.id);
                          const argsText = (() => {
                            try {
                              const parsed = JSON.parse(tool.arguments || "{}");
                              if (parsed.path && parsed.content) return `write_file(${parsed.path})`;
                              if (parsed.command) return `$ ${parsed.command}`;
                              return JSON.stringify(parsed, null, 2);
                            } catch {
                              return tool.arguments || "";
                            }
                          })();
                          const resultText = tool.result || "";

                          return (
                            <div key={tool.id} className="x-skill-nested-step">
                              {idx < items.length - 1 && <div className="x-skill-nested-connector" />}
                              <div
                                className="x-skill-nested-header"
                                onClick={() => toggleStep(tool.id)}
                              >
                                <div className="x-skill-nested-title">
                                  <div className={`x-skill-nested-icon ${tool.status === "completed" ? "x-skill-step-icon--completed" : "x-skill-step-icon--running"}`}>
                                    <SvgIcon name={tool.status === "completed" ? "terminal" : "loading"} size={16} />
                                  </div>
                                  {tool.name} 执行{tool.status === "completed" ? "完成" : "中..."}
                                </div>
                                <SvgIcon name={isNestedExpanded ? "up" : "down"} size={14} style={{ color: "#9ca3af" }} />
                              </div>

                              {isNestedExpanded && (
                                <div className="x-skill-nested-body">
                                  {tool.arguments && (
                                    <div className="x-skill-code-block">
                                      <div className="x-skill-code-header">
                                        <span>Bash</span>
                                        <div className="x-skill-code-copy" onClick={() => copyToClip(argsText).then(() => message.success("已复制"))}>
                                          <SvgIcon name="copy" size={14} />
                                        </div>
                                      </div>
                                      <pre className="x-skill-code-content">{argsText}</pre>
                                    </div>
                                  )}
                                  {tool.result && (
                                    <div className="x-skill-code-block" style={{ marginTop: tool.arguments ? 8 : 0 }}>
                                      <div className="x-skill-code-header">
                                        <span>Output</span>
                                        <div className="x-skill-code-copy" onClick={() => copyToClip(resultText).then(() => message.success("已复制"))}>
                                          <SvgIcon name="copy" size={14} />
                                        </div>
                                      </div>
                                      <pre className="x-skill-code-content">{resultText.length > 300 ? resultText.substring(0, 300) + "..." : resultText}</pre>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // skill_load 使用 SkillProcessFlow 的样式
            if (step.type === "skill_load") {
              return (
                <div key={step.id} className="x-skill-step">
                  <div className="x-skill-step-connector" />
                  <div className="x-skill-step-header">
                    <div className={`x-skill-step-icon ${isRunning ? "x-skill-step-icon--running" : ""}`}>
                      <SvgIcon name={isRunning ? "loading" : "terminal"} size={16} />
                    </div>
                    <div className={`x-skill-step-title ${isRunning ? "x-skill-step-title--running" : ""}`}>
                      技能加载{isRunning ? "中..." : "完成"}
                    </div>
                  </div>
                </div>
              );
            }

            // llm 思考（skill 场景）
            if (step.type === "llm_delta") {
              return (
                <div key={step.id} className="x-skill-step">
                  <div className="x-skill-step-connector" />
                  <div
                    className="x-skill-step-header"
                    style={{ justifyContent: "space-between" }}
                    onClick={() => toggleStep(step.id)}
                  >
                    <div className={`x-skill-step-icon ${isRunning ? "x-skill-step-icon--running" : ""}`}>
                      <SvgIcon name={isRunning ? "loading" : "brain"} size={16} />
                    </div>
                    <div className={`x-skill-step-title ${isRunning ? "x-skill-step-title--running" : ""}`}>
                      {isRunning ? "思考中..." : "思考完成"}
                    </div>
                    <SvgIcon name={stepExpanded ? "up" : "down"} size={14} style={{ color: "#9ca3af" }} />
                  </div>
                  {stepExpanded && step.data && (
                    <div className="x-skill-step-body">
                      {formatLlmContent(step.data as string)}
                    </div>
                  )}
                </div>
              );
            }

            // 其他步骤使用 TaskProcessFlow 的样式
            return (
              <div key={step.id} className="x-task-step">
                {index < steps.length - 1 && <div className="x-task-step-connector" />}
                <div
                  className="x-task-step-header"
                  onClick={() => hasBody && toggleStep(step.id)}
                >
                  <div className={`x-task-step-icon ${step.status === "running" ? "x-task-step-icon--running" : ""}`}>
                    <SvgIcon name={step.icon} size={16} />
                  </div>
                  <div className={`x-task-step-title ${step.status === "running" ? "x-task-step-title--running" : ""}`}>
                    {step.title}
                  </div>
                  {hasBody && (
                    <div className="x-task-step-icon">
                      <SvgIcon name={stepExpanded ? "up" : "down"} size={16} />
                    </div>
                  )}
                </div>
                {renderStepBody(step)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProcessFlow;
