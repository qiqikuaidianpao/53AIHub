import { useState, useCallback, useRef } from "react";
import type { Message, Skill, MessageFile, SpecifiedFile, ProcessRecord } from "../types";
import { parseJson } from "./useChatStream";
import { useRagStats } from "./useRagStats";

interface FileInfo {
  id: string;
  file_name: string;
  url: string;
}

function processRecordsToOutputFiles(records: ProcessRecord[]): FileInfo[] {
  const outputFiles: FileInfo[] = [];

  for (const record of records) {
    if (record.step_code === "output_files" && record.status === "completed" && record.data) {
      const data = typeof record.data === "string" ? parseJson<{ files?: FileInfo[] }>(record.data as string) : record.data;
      const files = data?.files;
      if (Array.isArray(files) && files.length > 0) {
        outputFiles.push(
          ...files.map((file: any) => ({
            id: file.id,
            file_name: file.file_name,
            url: file.url,
          }))
        );
      }
    }
  }

  return outputFiles;
}

interface UseChatMessagesOptions {
  limit?: number;
  supportSpecifiedContent?: boolean;
  skillList?: any[];
  mySkillList?: any[];
}

interface MessageState {
  messageList: Message[];
  isLoadingMore: boolean;
  hasMore: boolean;
  offset: number;
}

function JSONParse(json: string, defaultValue: any): any {
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

export function useChatMessages(options?: UseChatMessagesOptions) {
  const { formatRagStats } = useRagStats();
  const skillList = options?.skillList || [];
  const mySkillList = options?.mySkillList || [];

  const limit = options?.limit || 10;
  const supportSpecifiedContent = options?.supportSpecifiedContent || false;

  const [state, setState] = useState<MessageState>({
    messageList: [],
    isLoadingMore: false,
    hasMore: true,
    offset: 0,
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  /** 请求版本号：用于丢弃过期请求的响应 */
  const loadRequestIdRef = useRef(0);

  const loadMessages = useCallback(
    async (
      messages: any[],
      limit: number,
      skipFeedback: boolean = true,
      options?: { skillList?: any[]; mySkillList?: any[] }
    ): Promise<{ messages: Message[]; hasMore: boolean }> => {
      const validSkillList = options?.skillList || skillList;
      const validMySkillList = options?.mySkillList || mySkillList;

      try {
        const list: Message[] = [];

        for (const item of messages) {
          const message = JSONParse(
            item.message,
            typeof item.message === "string" ? [{ role: "user", content: item.message }] : []
          );
          const userMessage = message.find((item: any) => item.role === "user") || { content: "" };
          const userInfoList = supportSpecifiedContent
            ? message.filter((item: any) => item.role === "info")
            : [message.find((item: any) => item.role === "info")].filter(Boolean);

          let specified_files: SpecifiedFile[] = [];
          let specified_content = "";
          let uploaded_files: MessageFile[] = [];
          let questionText = "";

          const userContent = JSONParse(userMessage.content, null);

          if (Array.isArray(userContent)) {
            const textItem = userContent.find((item: any) => item?.type === "text");
            questionText = textItem?.content || "";
            uploaded_files = userContent
              .filter((item: any) => item != null && (item.type === "file" || item.type === "image"))
              .map((fileItem: any, index: number) => {
                const fileId = fileItem.content?.replace("file_id:", "") || `file_${index}_${Date.now()}`;
                return {
                  id: fileId,
                  filename: fileItem.filename || `文件 ${fileId}`,
                  name: fileItem.filename || `文件 ${fileId}`,
                  size: fileItem.size,
                  mime_type: fileItem.mime_type,
                  preview_key: fileItem.preview_key,
                  url: fileItem.url,
                };
              });
          } else {
            const content = userMessage.content;
            questionText = typeof content === "string" ? content : (content?.text || content?.content || "");
          }

          let skill: Skill = { skill_name: "", display_name: "" };
          const skillMatch = questionText?.match(/^\/([^\s]+)\s+([\s\S]*)/);
          if (skillMatch) {
            const skillName = skillMatch[1];
            const targetSkill =
              validSkillList.find((s: any) => s.skill_name === skillName) ||
              validMySkillList.find((s: any) => s.skill_name === skillName);
            if (targetSkill) {
              skill.display_name = targetSkill.display_name;
              skill.skill_name = targetSkill.skill_name;
              questionText = skillMatch[2];
            } else {
              skill.display_name = skillName;
              skill.skill_name = skillName;
              questionText = skillMatch[2];
            }
          }

          let answer = "";
          let processedOutputFiles: any[] = [];
          if (item.process_records?.length > 0) {
            processedOutputFiles = processRecordsToOutputFiles(item.process_records);
          }
          answer = item.answer || "";

          userInfoList.forEach((userInfo: any) => {
            if (!userInfo) return;
            userInfo.content = JSONParse(userInfo.content, {});
            const infoType = userInfo.content?.type;

            if (infoType === "specified_files") {
              specified_files = userInfo.content.list.map((fileItem: any) => ({
                id: fileItem.id,
                name: fileItem.name,
                icon: fileItem.icon || "file",
              }));
            } else if (infoType === "specified_content" && supportSpecifiedContent) {
              specified_content = userInfo.content.content || "";
            }
          });

          const initialFeedbackParams = {
            feedbackId: null,
            feedbackVisible: false,
            feedbackTypeOptions: null,
            submitBtnDisabled: true,
            feedbackSuccessful: false,
            feedback_type: "",
            feedbackLoading: !skipFeedback,
          };

          list.push({
            ...item,
            id: item.id,
            question: questionText,
            role: "assistant",
            skill,
            answer: answer?.split("<decision>DONE</decision>").join(""),
            rag_stats: formatRagStats(item.rag_stats, item.process_records),
            specified_files,
            uploaded_files,
            specified_content: supportSpecifiedContent ? specified_content : undefined,
            outputFiles: processedOutputFiles,
            ...initialFeedbackParams,
            error: answer?.includes("Access denied") || answer?.includes("InvalidApiKey") || false,
          });
        }

        return {
          messages: list,
          hasMore: list.length === limit,
        };
      } catch (err) {
        console.error("Failed to load messages:", err);
        return { messages: [], hasMore: false };
      }
    },
    [formatRagStats, supportSpecifiedContent, skillList, mySkillList]
  );

  const handleLoadListMore = useCallback(
    async (
      done: () => void,
      conversationId: string,
      loadMessagesApi: (conversationId: string, params: { offset: number; limit: number }) => Promise<any>,
      options?: { skillList?: any[]; mySkillList?: any[] }
    ): Promise<void> => {
      const currentState = stateRef.current;
      if (currentState.isLoadingMore || !currentState.hasMore) return done();

      if (!conversationId) return done();

      setState((prev) => ({ ...prev, isLoadingMore: true }));

      const newOffset = currentState.offset + limit;

      try {
        const res = await loadMessagesApi(conversationId, { offset: newOffset, limit });
        const { messages, hasMore } = await loadMessages(res.data?.messages || res.messages || [], limit, true, options);
        setState((prev) => ({
          ...prev,
          hasMore,
          offset: newOffset,
          messageList: [...messages, ...prev.messageList],
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          offset: Math.max(0, prev.offset - limit),
        }));
      } finally {
        setState((prev) => ({ ...prev, isLoadingMore: false }));
      }
      return done();
    },
    [limit, loadMessages]
  );

  const loadMessageList = useCallback(
    async (
      conversationId: string,
      loadMessagesApi: (conversationId: string, params: { offset: number; limit: number }) => Promise<any>,
      options?: { skillList?: any[]; mySkillList?: any[]; isRunning?: boolean; runningMessageId?: string | number }
    ) => {
      const requestId = ++loadRequestIdRef.current;
      let list = []
      setState((prev) => ({ ...prev, isLoadingMore: true, offset: 0, hasMore: true }));

      try {
        const res = await loadMessagesApi(conversationId, { offset: 0, limit });

        // 丢弃过期请求的响应
        if (requestId !== loadRequestIdRef.current) {
          return [];
        }

        const { messages, hasMore } = await loadMessages(res.data?.messages || res.messages || [], limit, true, options);

        // 再次检查，因为 loadMessages 也是异步的
        if (requestId !== loadRequestIdRef.current) {
          return [];
        }

        const isActiveRun = options?.isRunning;
        const runningMessageId = options?.runningMessageId;
        if (isActiveRun && runningMessageId && messages.length > 0) {
          const targetIndex = messages.findIndex((m: any) => m.id === runningMessageId);
          if (targetIndex !== -1) {
            messages[targetIndex] = {
              ...messages[targetIndex],
              reasoning_content: "",
              answer: "",
              process_records: [],
              skillRunItems: [],
              outputFiles: [],
              rag_temp: {},
              rag_stats: undefined,
              rag_search_text: "",
              loading: true,
            };
          }
        }

        list = messages;
        setState((prev) => ({
          ...prev,
          hasMore,
          messageList: messages,
        }));
      } finally {
        // 只有当前请求才更新 loading 状态
        if (requestId === loadRequestIdRef.current) {
          setState((prev) => ({ ...prev, isLoadingMore: false }));
        }
      }
      return list;
    },
    [limit, loadMessages]
  );

  const clearMessageList = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messageList: [],
      offset: 0,
      hasMore: true,
    }));
  }, []);

  const updateMessageList = useCallback((updater: (list: Message[]) => Message[]) => {
    setState((prev) => {
      const newList = updater(prev.messageList);
      const deduped = [...new Map(newList.map((m) => [m.id, m])).values()];
      return {
        ...prev,
        messageList: deduped,
      };
    });
  }, []);

  const addMessage = useCallback((message: Message) => {
    setState((prev) => ({
      ...prev,
      messageList: [...prev.messageList, message],
    }));
  }, []);

  const updateMessage = useCallback((id: string | number, updater: (msg: Message) => Message) => {
    setState((prev) => ({
      ...prev,
      messageList: prev.messageList.map((msg) => (msg.id === id ? updater(msg) : msg)),
    }));
  }, []);

  return {
    state,
    loadMessages,
    handleLoadListMore,
    loadMessageList,
    clearMessageList,
    updateMessageList,
    addMessage,
    updateMessage,
  };
}

export default useChatMessages;
