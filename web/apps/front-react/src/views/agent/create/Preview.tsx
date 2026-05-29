import {
  useState,
  useRef,
  useMemo,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { message } from "antd";
import { CopyOutlined } from "@ant-design/icons";
import { useAgentFormStore } from "./store";
import { ConversationType } from "@/api/modules/conversation";
import uploadApi from "@/api/modules/upload";
import chatApi from "@/api/modules/chat";
import { copyToClip } from "@km/shared-utils";
import { API_HOST } from "@/api/host";
import { t } from "@/locales";
import { getPublicPath } from "@/utils/config";
import {
  BubbleList,
  BubbleUser,
  BubbleAssistant,
  BubbleListRef,
} from "@km/hub-ui-x-react";
import { Sender, SenderRef } from "@/components/Chat/Sender";

interface ChatMessage {
  question: {
    role: string;
    content: string;
    user_files: any[];
  };
  answer: {
    loading: boolean;
    role: string;
    content: string;
    reasoning_expanded: boolean;
    reasoning_content: string;
  };
}

export interface PreviewRef {
  restart: () => void;
  getIsConfigChanged: () => boolean;
}

interface PreviewProps {
  className?: string;
}

export const Preview = forwardRef<PreviewRef, PreviewProps>(
  ({ className = "" }, ref) => {
    const agentFormStore = useAgentFormStore();
    const [chatList, setChatList] = useState<ChatMessage[]>([]);
    const [conversationCreating, setConversationCreating] = useState(false);
    const [isConfigChanged, setIsConfigChanged] = useState(false);

    const conversationIdRef = useRef(0);
    const activeChatIndexRef = useRef(-1);
    const abortControllerRef = useRef<AbortController | null>(null);
    const bubbleListRef = useRef<BubbleListRef>(null);
    const senderRef = useRef<SenderRef>(null);

    const chatLoading = useMemo(() => {
      return (
        conversationCreating || chatList.some((item) => item.answer.loading)
      );
    }, [conversationCreating, chatList]);

    const enableUpload = useMemo(() => {
      return Boolean(
        agentFormStore.form_data.settings?.file_parse?.enable ||
        agentFormStore.form_data.settings?.image_parse?.enable,
      );
    }, [agentFormStore.form_data.settings]);

    const uploadAccept = useMemo(() => {
      let accept = "";
      if (agentFormStore.form_data.settings?.file_parse?.enable)
        accept +=
          ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.html,.json,.xml,.md";
      if (agentFormStore.form_data.settings?.image_parse?.enable)
        accept += ",image/*";
      return accept;
    }, [agentFormStore.form_data.settings]);

    const allowSendWithFiles = useMemo(() => {
      return false;
    }, []);

    const httpRequest = async (dataFile: File) => {
      try {
        const res = await uploadApi.upload(dataFile);
        return {
          id: res.data.id,
          url: `${API_HOST}/api/preview/${res.data.preview_key || ""}`,
          size: res.data.size,
          name: res.data.file_name,
          mime_type: res.data.mime_type,
        };
      } catch (error) {
        return {};
      }
    };

    const onSendConfirm = async (
      question: string,
      userFiles?: any[],
      type = "",
    ): Promise<void> => {
      if (chatLoading) return;
      setConversationCreating(true);
      userFiles = userFiles || [];

      console.log('agentFormStore.agent_id',agentFormStore.agent_id)

      if (!agentFormStore.agent_id) {
        message.warning(t("agent_not_found"));
        return;
      }

      if (!conversationIdRef.current) {
        try {
          const res = await (
            await import("@/api/modules/conversation")
          ).conversationApi.create({
            agent_id: agentFormStore.agent_id,
            title: question,
            conversation_type: ConversationType.TEST,
          });
          conversationIdRef.current = res.data.conversation_id;
        } catch (error) {
          // Ignore
        }
      }

      if (type !== "regenerate") {
        userFiles =
          userFiles?.map((item) => ({
            type: "image",
            content: `file_id:${item.id}`,
            filename: item.name,
            size: item.size,
            mime_type: item.mime_type,
            url: item.url,
          })) || [];
      }

      const newMessage: ChatMessage = {
        question: {
          role: "user",
          content: question,
          user_files: userFiles,
        },
        answer: {
          loading: true,
          role: "assistant",
          content: "",
          reasoning_expanded: true,
          reasoning_content: "",
        },
      };
      setChatList((prev) => {
        const newList = [...prev, newMessage];
        activeChatIndexRef.current = newList.length - 1;
        return newList;
      });

      let messages: any[] = [{ role: "user", content: question }];
      if (userFiles.length) {
        messages = [
          {
            role: "user",
            content: JSON.stringify([
              { type: "text", content: question },
              ...userFiles,
            ]),
          },
        ];
      }

      const configs = JSON.parse(agentFormStore.agent_data.configs || "{}");
      const completionParams = configs.completion_params || {
        temperature: 0.2,
        top_p: 0.75,
        presence_penalty: 0.5,
        frequency_penalty: 0.5,
      };

      abortControllerRef.current = new AbortController();

      const requestPayload = {
        conversation_id: String(conversationIdRef.current),
        model: `agent-${agentFormStore.agent_id}`,
        messages,
        frequency_penalty: completionParams.frequency_penalty || 0,
        presence_penalty: completionParams.presence_penalty || 0,
        stream: true,
        temperature: completionParams.temperature || 0,
        top_p: completionParams.top_p || 0,
      };

      try {
        await chatApi.completions(requestPayload, {
          responseType: "stream",
          isStream: true,
          onDownloadProgress: async ({
            chunks = [],
            intact_content,
            intact_reasoning_content,
          } = {}) => {
            setChatList((prev) => {
              const newList = [...prev];
              const activeChat = newList[activeChatIndexRef.current];
              if (activeChat) {
                activeChat.answer.content =
                  intact_content || activeChat.answer.content || "";
                activeChat.answer.reasoning_content =
                  intact_reasoning_content ||
                  activeChat.answer.reasoning_content ||
                  "";
                if (chunks[0] && chunks[0].role)
                  activeChat.answer.role =
                    chunks[0].role || activeChat.answer.role || "";
              }
              return newList;
            });
          },
          signal: abortControllerRef.current.signal,
        });
      } catch (err: any) {
        if (err?.message !== "canceled") {
          setChatList((prev) => {
            const newList = [...prev];
            const activeChat = newList[activeChatIndexRef.current];
            if (activeChat) {
              activeChat.answer.content = t("agent.failed_tip");
            }
            return newList;
          });
          message.warning(t("agent.failed_tip"));
        }
      } finally {
        setChatList((prev) => {
          const newList = [...prev];
          const activeChat = newList[activeChatIndexRef.current];
          if (activeChat) {
            const lastContent = activeChat.answer.content;
            if (
              lastContent?.startsWith("Upstream Error") ||
              lastContent?.startsWith("Error: 当前应用模型余额不足") ||
              !lastContent
            ) {
              activeChat.answer.content = t("agent.failed_tip");
              message.warning(t("agent.failed_tip"));
            }
            if (activeChat.answer.loading) {
              activeChat.answer.loading = false;
            }
          }
          return newList;
        });
        abortControllerRef.current = null;
        setConversationCreating(false);
      }

      setTimeout(() => {
        bubbleListRef.current?.scrollToBottom();
      }, 0);
    };

    const onStopGeneration = () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setChatList((prev) => {
        const newList = [...prev];
        const activeChat = newList[activeChatIndexRef.current];
        if (activeChat) {
          activeChat.answer.loading = false;
        }
        return newList;
      });
      setConversationCreating(false);
    };

    const onRestartGeneration = (data: ChatMessage) => {
      onSendConfirm(
        data.question.content,
        data.question.user_files,
        "regenerate",
      );
    };

    const onRestart = () => {
      conversationIdRef.current = 0;
      setChatList([]);
      setIsConfigChanged(false);
    };

    const onCopy = async (text = "") => {
      await copyToClip(text);
      message.success(t("action.copy_success"));
    };

    useEffect(() => {
      if (conversationIdRef.current) {
        setIsConfigChanged(true);
      }
    }, [agentFormStore.form_data.custom_config]);

    useImperativeHandle(ref, () => ({
      restart: onRestart,
      getIsConfigChanged: () => isConfigChanged,
    }));

    return (
      <div className={`h-full flex flex-col bg-white rounded-lg ${className}`}>
        {/* Title */}
        <div className="px-6 py-[14px]">
          <span className="text-base font-medium text-[#333]">
            {t("agent.preview_debug")}
          </span>
        </div>

        {/* Config change overlay */}
        {isConfigChanged && (
          <div className="absolute top-0 left-0 w-full h-full bg-black/70 z-10">
            <div className="flex flex-col items-center justify-center gap-6 w-full h-full box-border">
              <div className="text-base text-[#fff] text-center mx-8">
                {t("debugger_config_change_confirm")}
              </div>
              <button
                className="px-4 py-2 bg-[#2563EB] text-white rounded hover:bg-[#1d4ed8]"
                onClick={onRestart}
              >
                {t("save_and_restart")}
              </button>
            </div>
          </div>
        )}

        {/* Chat area */}
        {chatList.length > 0 ? (
          <div className="flex-1 overflow-hidden relative">
            <BubbleList
              ref={bubbleListRef}
              className="h-full px-6 py-4"
              mainClass="mx-5"
            >
              {chatList.map((msg, index) => (
                <div key={index} className="mb-4">
                  <BubbleUser
                    content={msg.question.content}
                    files={msg.question.user_files}
                  >
                    {!msg.answer.loading && (
                      <CopyOutlined
                        className="cursor-pointer text-[#999] hover:text-[#666]"
                        style={{ fontSize: 16 }}
                        onClick={() => onCopy(msg.question.content)}
                      />
                    )}
                  </BubbleUser>
                  <BubbleAssistant
                    content={msg.answer.content}
                    reasoning={msg.answer.reasoning_content}
                    reasoningExpanded={msg.answer.reasoning_expanded}
                    streaming={msg.answer.loading}
                    alwaysShowMenu={index === chatList.length - 1}
                    onCopy={() => onCopy(msg.answer.content)}
                    onRegenerate={() => onRestartGeneration(msg)}
                  />
                </div>
              ))}
            </BubbleList>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <img
              src={getPublicPath("/images/openClaw.webp")}
              className="w-16 h-16 mb-4"
              alt="mascot"
            />
            <span className="text-base text-[#333]">{t("agent.my_agent")}</span>
          </div>
        )}

        {/* Input area */}
        <div className="px-6 py-4">
          <Sender
            ref={senderRef}
            showAt={false}
            enableUpload={enableUpload}
            acceptTypes={uploadAccept}
            httpRequest={httpRequest}
            loading={conversationCreating}
            allowMultiple
            enableDragUpload
            allowSendWithFiles={allowSendWithFiles}
            onSend={(data) => {
              onSendConfirm(data.textContent, data.files);
            }}
            onStop={onStopGeneration}
          />
          {/* AI generated tip */}
          <div className="text-center mt-2">
            <span className="text-xs text-[#999]">
              {t("agent.ai_generated_tip")}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

Preview.displayName = "Preview";

export default Preview;
