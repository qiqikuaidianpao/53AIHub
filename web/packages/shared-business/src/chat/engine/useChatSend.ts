import { useRef, useCallback, useState } from "react";
import type { IConversationApi, ChatCompletionParams } from "../adapters/types";
import type { Message, SendMessageOptions, Skill, MessageFile, SpecifiedFile } from "../types";
import { useChatStream } from "./useChatStream";
import { useRagStats } from "./useRagStats";

/**
 * 格式化问题：添加技能前缀
 */
function formatQuestionWithSkill(question: string, skill?: Skill): string {
  return skill?.skill_name && skill?.display_name
    ? `/${skill.skill_name} ${question}`
    : question;
}

/**
 * 构建文件内容项（用于 user 消息中的文件）
 */
function buildFileContent(file: any, useUploadId: boolean = false): any | null {
  const fileId = useUploadId ? file.upload_file_id : file.id;
  if (!fileId) return null;
  return {
    type: "file",
    content: `file_id:${fileId}`,
    filename: file.name,
    size: file.file_size ?? file.size,
    mime_type: file.file_mime ?? file.mime_type,
    preview_key: file.preview_key,
  };
}

/**
 * 构建 specified_files（用于 info 消息）
 */
function buildSpecifiedFilesInfo(links: SpecifiedFile[]): { content: string; role: string } {
  return {
    content: JSON.stringify({
      type: "specified_files",
      list: links.map((item) => ({
        id: item.id,
        name: item.name,
        library_id: item.library_id,
        ...(item.isfolder !== undefined && { isfolder: item.isfolder }),
      })),
    }),
    role: "info",
  };
}

/**
 * 构建 specified_content（用于 info 消息）
 */
function buildSpecifiedContentInfo(text: string): { content: string; role: string } {
  return {
    content: JSON.stringify({ type: "specified_content", content: text }),
    role: "info",
  };
}

/**
 * Chat Message Sending Hook
 * Uses injected conversation API adapter for actual API calls
 *
 * 支持请求锁机制：防止并发请求覆盖 currentMessageRef
 */
export function useChatSend(conversationApi: IConversationApi) {
  const { processStreamData, clearBuffer } = useChatStream();
  const { formatRagStats } = useRagStats();

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentMessageRef = useRef<Message | null>(null);
  /** 请求锁：防止并发请求覆盖 currentMessageRef */
  const requestIdRef = useRef(0);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(
    async (options: SendMessageOptions) => {
      const {
        question,
        agent_id,
        conversation_id,
        modelId = "",
        completion_params = {},
        links = [],
        networkSearch = false,
        knowledgeGraph = false,
        library,
        agentInfo,
        files = [],
        fileInfo,
        options: sendOptions = {},
        minimalParams = false,
        skill,
        type = "",
        onMessageListChange,
      } = options;

      // ========== 清理上一次请求状态 ==========
      clearBuffer();
      const requestId = ++requestIdRef.current;

      // ========== 场景标识 ==========
      const isFromWorkAI = type === "work-ai";
      const isAgentType = type === "agent";
      const hasFiles = files.length > 0;
      const hasLinks = links.length > 0;

      // ========== 1. 构建用户消息内容 ==========
      const formattedQuestion = formatQuestionWithSkill(question, skill);
      const userMessageContent: any[] = [{ type: "text", content: formattedQuestion }];
      const uploadedFiles: MessageFile[] = [];
      const specifiedFiles: SpecifiedFile[] = [];

      if (isAgentType && hasFiles) {
        // agent 场景：文件直接序列化
        userMessageContent.push(...files);
        uploadedFiles.push(...(files as MessageFile[]));
      } else if (hasFiles || hasLinks) {
        // 其他场景：文件转为 file_id 格式
        files.forEach((file) => {
          const item = buildFileContent(file);
          if (item) userMessageContent.push(item);
        });
        uploadedFiles.push(...(files as MessageFile[]));

        // work-ai 场景：links 也用 upload_file_id 加入 user 消息
        links.forEach((file) => {
          const item = buildFileContent(file, isFromWorkAI);
          if (item) userMessageContent.push(item);
        });
      }

      // UI 展示用的 specified_files
      if (hasLinks) {
        specifiedFiles.push(
          ...links.map((item) => ({
            id: item.id,
            name: item.name,
            icon: item.icon,
            library_id: item.library_id,
            ...(item.file_size && { file_size: item.file_size }),
            ...(item.file_mime && { file_mime: item.file_mime }),
          }))
        );
      }

      // ========== 2. 构建 API messages ==========
      const messages: any[] = [];

      // system prompt
      if (sendOptions.prompt) {
        messages.push({ content: sendOptions.prompt, role: "system" });
      }

      // specified_content
      if (sendOptions.text) {
        messages.push(buildSpecifiedContentInfo(sendOptions.text));
      }

      // specified_files（非 work-ai 场景）
      if (!isFromWorkAI && hasLinks) {
        messages.push(buildSpecifiedFilesInfo(links as SpecifiedFile[]));
      }

      // user 消息
      const userContent = hasFiles || hasLinks ? JSON.stringify(userMessageContent) : formattedQuestion;
      messages.push({ role: "user", content: userContent });

      // ========== 3. 创建 UI 消息对象 ==========
      const newMessage: Message = {
        id: Date.now().toString(),
        question,
        answer: "",
        loading: true,
        agent_id: String(agent_id),
        conversation_id: String(conversation_id ?? ""),
        reasoning_content: "",
        reasoning_expanded: true,
        specified_files: specifiedFiles,
        uploaded_files: uploadedFiles,
        specified_content: sendOptions.text || "",
        skill: skill || { skill_name: "", display_name: "" },
        process_records: [],
        rag_stats: null,
        rag_search_text: "",
        rag_temp: { type: "rag_search" },
        knowledge_graph: knowledgeGraph,
      };

      currentMessageRef.current = newMessage;

      // 添加消息到列表
      onMessageListChange?.((list) => [...list, newMessage], newMessage);

      // ========== 4. 构建请求参数 ==========
      const model = `agent-${agent_id}${modelId ? `-${modelId}` : ""}`;
      const rerankConfig = agentInfo?.settings?.rerank_config || {};
      const webSearchConfig = agentInfo?.settings?.web_search_setting || {};

      const completionsPayload: ChatCompletionParams = minimalParams
        ? {
            conversation_id,
            model,
            messages,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream: true,
            temperature: 0,
            top_p: 0,
            ...completion_params,
          }
        : {
            conversation_id,
            model,
            messages,
            enable_process_steps: true,
            frequency_penalty: 0,
            temperature: 0.5,
            top_p: 1,
            presence_penalty: 0,
            stream: true,
            knowledge_base_ids:
              networkSearch || hasLinks ? [] : library?.value || (fileInfo ? [] : [-1]),
            file_ids: hasLinks ? links.map((item) => item.id) : [],
            message_file_id: fileInfo?.id,
            solo_file_mode: !!fileInfo,
            search_config: {
              ...rerankConfig,
              top_k: networkSearch ? webSearchConfig.top_k || rerankConfig.top_k : rerankConfig.top_k,
            },
            web_search_config: networkSearch ? webSearchConfig : {},
            enable_graph_search: knowledgeGraph,
            ...completion_params,
          };

      // ========== 5. 发送请求 ==========
      abortControllerRef.current = new AbortController();
      setIsStreaming(true);
      let processedLength = 0;
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 100;

      try {
        await conversationApi.completions(completionsPayload, {
          responseType: "stream",
          onDownloadProgress: (e: any) => {
            // 检查请求是否已被新请求覆盖
            if (requestId !== requestIdRef.current) return;
            if (!currentMessageRef.current) return;

            processedLength = processStreamData(
              e,
              processedLength,
              currentMessageRef.current,
              networkSearch,
              formatRagStats
            );

            // 节流触发 React 重渲染
            const now = Date.now();
            if (now - lastUpdateTime >= UPDATE_INTERVAL && onMessageListChange) {
              lastUpdateTime = now;
              onMessageListChange((list) => [...list], newMessage);
            }
          },
          signal: abortControllerRef.current.signal,
        });
      } catch (err: any) {
        // 旧请求被覆盖时静默忽略错误
        if (requestId !== requestIdRef.current) return;

        if (err.message !== "canceled") {
          const currentMessage = currentMessageRef.current;
          if (currentMessage && !currentMessage.answer) {
            currentMessage.answer = err.response?.data || "网络错误";
            currentMessage.error = true;
          }
        }
        throw err;
      } finally {
        // 只有当前请求才更新状态
        if (requestId === requestIdRef.current) {
          const currentMessage = currentMessageRef.current;
          if (currentMessage) currentMessage.loading = false;
          abortControllerRef.current = null;
          clearBuffer();
          setIsStreaming(false);
          if (onMessageListChange) onMessageListChange((list) => [...list], newMessage);
        }
      }
    },
    [conversationApi, processStreamData, clearBuffer, formatRagStats]
  );

  /** 停止生成 */
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearBuffer();
    setIsStreaming(false);
  }, [clearBuffer]);

  /** 获取当前 AbortController */
  const getAbortController = useCallback(() => abortControllerRef.current, []);

  return {
    sendMessage,
    handleStop,
    isStreaming,
    getAbortController,
  };
}

export default useChatSend;