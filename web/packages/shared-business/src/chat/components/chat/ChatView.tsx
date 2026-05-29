import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { Modal, message } from "antd";
import { usePluginAdapters, usePluginConfig } from "../../ChatProvider";
import { useConversationStore } from "../../stores";
import { useChatMessages, useChatSend, useChatTimeout, useEmbedMode } from "../../engine";
import { useTranslation, type Lang } from "../../i18n";
import { ChatHistory, type ChatHistoryRef, UsageGuide, LoadingState, CompletionView, MessageMenu, ShareHeader } from "../index";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatInput, { type SendData } from "./ChatInput";
import type { IAgentInfo } from "../../adapters/types";
import type { Message } from "../../types";
import { setConversationApi } from "../../stores/conversation";
import { copyToClip } from "@km/shared-utils";

export interface ChatViewFeatures {
  history?: boolean;
  newConversation?: boolean;
  languageSwitcher?: boolean;
  fileUpload?: boolean;
  timeout?: number;
  guide?: boolean;
  /** 分享功能 - ShareHeader、消息选择、创建分享链接 */
  share?: boolean;
  /** 智能体切换下拉菜单 */
  agentTooltip?: boolean;
  /** Openclaw 模式 - 隐藏底部操作、使用 FORMAL 会话类型 */
  openclaw?: boolean;
  /** 消息操作菜单 - 复制、重新生成、分享 */
  messageMenu?: boolean;
  /** 跳过初始会话加载 - 进入时显示欢迎页而非自动加载最后一条 */
  skipInitialLoad?: boolean;
  /** 右侧推荐面板 */
  showRecommend?: boolean;
  /** 拖拽上传 */
  enableDragUpload?: boolean;
  /** 多文件选择 */
  allowMultiple?: boolean;
  /** 仅文件发送 */
  allowSendWithFiles?: boolean;
  /** 粘贴上传 */
  enablePasteUpload?: boolean;
  /** 显示相关场景 */
  showRelatedScene?: boolean;
}

export interface ChatViewProps {
  agentId: string;
  initialConversationId?: string | number;
  features?: ChatViewFeatures;
  syncToUrl?: boolean; // 是否同步 agent_id/conversation_id 到 URL
  agentInfo?: IAgentInfo; // 直接传入 agent 信息，跳过 API 加载
  /** 分享 API 回调 */
  onShare?: (messageIds: (string | number)[], conversationId: string | number, selectAll: boolean) => Promise<string>;
  /** 自定义 Header - 替换默认 ChatHeader */
  renderHeader?: (props: { agentInfo: IAgentInfo; lang: Lang; setLang: (lang: Lang) => void }) => React.ReactNode;
  /** 输入框前的智能体选择器 */
  renderAgentSelector?: (props: { agentInfo: IAgentInfo; onSelect: (agent: IAgentInfo) => void }) => React.ReactNode;
  /** 欢迎页 AuthTags 渲染函数 */
  renderAuthTags?: (userGroupIds: number[]) => React.ReactNode;

  /** 权限检查回调 - 返回 true 表示有权限，false 表示无权限 */
  checkPermission?: (userGroupIds?: number[]) => boolean | Promise<boolean>;
  /** 版权信息 slot */
  renderCopyright?: () => React.ReactNode;
  /** 推荐智能体列表 */
  recommendAgents?: IAgentInfo[];
  /** 推荐智能体选择回调 */
  onRecommendAgentSelect?: (agent: IAgentInfo) => void;
  /** 下一个智能体回调 - 用于 RelatedScene */
  onNextAgent?: (item: any, parameters: Record<string, string>) => void;
  /** 重新初始化当前智能体回调 - 当跳转到同一智能体时触发 */
  onInitAgent?: () => void;
  /** 自定义上传函数 */
  uploadRequest?: (file: File) => Promise<any>;
  /** 接受的文件类型 */
  acceptTypes?: string;
  /** 最大文件大小（字节） */
  maxFileSize?: number;
}

export interface ChatViewRef {
  reload: () => void;
  newConversation: () => void;
  showShare: () => void;
  sendMessage: (content: string) => void;
  setPrompt: (content: string) => void;
}

const DEFAULT_FEATURES: ChatViewFeatures = {
  history: true,
  newConversation: true,
  languageSwitcher: true,
  fileUpload: false,
  timeout: 0,
  guide: true,
  share: false,
  agentTooltip: false,
  openclaw: false,
  messageMenu: true,
  skipInitialLoad: false,
  showRecommend: false,
  enableDragUpload: false,
  allowMultiple: true,
  allowSendWithFiles: false,
  enablePasteUpload: false,
  showRelatedScene: false,
};

function syncConversationIdToUrl(agentId: string | number, conversationId: string | number) {
  const url = new URL(window.location.href);
  url.searchParams.set("agent_id", String(agentId));
  if (conversationId && conversationId !== 0) {
    url.searchParams.set("conversation_id", String(conversationId));
  } else {
    url.searchParams.delete("conversation_id");
  }
  window.history.replaceState(null, "", url.toString());
}

export const ChatView = forwardRef<ChatViewRef, ChatViewProps>(
  ({
    agentId,
    initialConversationId,
    features: userFeatures,
    syncToUrl = true,
    agentInfo: agentInfoProp,
    onShare,
    renderHeader,
    renderAgentSelector,
    renderAuthTags,
    checkPermission,
    renderCopyright,
    recommendAgents,
    onRecommendAgentSelect,
    onNextAgent,
    onInitAgent,
    uploadRequest,
    acceptTypes,
    maxFileSize,
  }, ref) => {
    const features = { ...DEFAULT_FEATURES, ...userFeatures };
    const adapters = usePluginAdapters();
    const pluginConfig = usePluginConfig();
    const { t, lang, setLang } = useTranslation();
    const embedMode = useEmbedMode();

    const [agentInfo, setAgentInfo] = useState<IAgentInfo | null>(agentInfoProp || null);
    const [agentLoading, setAgentLoading] = useState(!agentInfoProp);

    const currentConversationId = useConversationStore((state) => state.current_conversationid);
    const loadConversations = useConversationStore((state) => state.loadConversations);
    const createConversation = useConversationStore((state) => state.createConversation);
    const addConversation = useConversationStore((state) => state.addConversation);
    const setCurrentState = useConversationStore((state) => state.setCurrentState);

    const {
      state: { messageList },
      loadMessageList,
      updateMessageList,
      clearMessageList,
    } = useChatMessages({ limit: 20 });

    const { sendMessage, handleStop, isStreaming } = useChatSend(adapters.conversationApi);

    const [inputValue, setInputValue] = useState("");
    const [showGuide, setShowGuide] = useState(false);
    const historyRef = useRef<ChatHistoryRef>(null);
    const loadedConversationRef = useRef<string | number | null>(null);
    const skipNextLoadRef = useRef(false);
    // 标记是否是初始加载（刷新进入），用于 timeout 计算
    const isInitialLoadRef = useRef(true);

    // Share mode state
    const [shareMode, setShareMode] = useState(false);
    const [selectMessageIds, setSelectMessageIds] = useState<(string | number)[]>([]);
    const [selectAll, setSelectAll] = useState(false);
    const [shareLoading, setShareLoading] = useState(false);

    // Handle new conversation - define before useChatTimeout
    const handleNewConversation = useCallback(() => {
      setCurrentState(agentId, 0);
      clearMessageList();
      loadedConversationRef.current = null;
      if (syncToUrl) syncConversationIdToUrl(agentId, 0);
    }, [setCurrentState, agentId, clearMessageList, syncToUrl]);

    // Openclaw 模式禁用 timeout（没有新建会话和历史功能）
    const timeoutEnabled = features.timeout ? features.timeout > 0 && !features.openclaw : false;

    const { setLastMessageTime, resetTimer } = useChatTimeout({
      timeout: features.timeout || 0,
      enabled: timeoutEnabled,
      onTimeout: () => {
        Modal.warning({
          title: t("chat.timeout_title"),
          content: t("chat.timeout_message"),
          okText: t("chat.timeout_ok"),
          onOk: handleNewConversation,
        });
      },
    });

    // Initialize conversation API
    useEffect(() => {
      setConversationApi(adapters.conversationApi);
    }, [adapters.conversationApi]);

    // Cleanup store on unmount
    useEffect(() => {
      return () => {
        // 清空会话状态
        useConversationStore.setState({
          conversations: [],
          current_agentid: 0,
          current_conversationid: 0,
          currentVirtualId: "",
        });
      };
    }, []);

    // Notify parent when ready (embed mode) - use embedMode.notifyReady()
    useEffect(() => {
      embedMode.notifyReady();
    }, [embedMode]);

    // Load agent info
    useEffect(() => {
      // If agentInfo is provided via prop, use it directly
      if (agentInfoProp) {
        setAgentInfo(agentInfoProp);
        setAgentLoading(false);
        return;
      }

      if (!agentId) {
        setAgentLoading(false);
        return;
      }

      setAgentLoading(true);
      adapters.agentApi
        .detail(agentId)
        .then((agent: IAgentInfo) => {
          setAgentInfo(agent);
        })
        .catch((err) => {
          console.error("Failed to load agent:", err);
          setAgentInfo(null);
        })
        .finally(() => {
          setAgentLoading(false);
        });
    }, [agentId, agentInfoProp, adapters.agentApi]);

    // Initialize conversation when agent loaded
    useEffect(() => {
      if (!agentId || agentLoading) return;

      const initConversation = async () => {
        // 先清空旧状态（包括 current_conversationid，防止触发旧会话的消息加载）
        useConversationStore.setState({ conversations: [], current_conversationid: 0 });
        clearMessageList()
        loadedConversationRef.current = null;

        if (initialConversationId) {
          setCurrentState(agentId, initialConversationId);
          loadConversations(agentId);
        } else if (features.skipInitialLoad) {
          // skipInitialLoad: 直接设置为空会话，显示欢迎页
          setCurrentState(agentId, 0);
          if (syncToUrl) syncConversationIdToUrl(agentId, 0);
          // 但仍然加载会话列表，用于历史面板
          loadConversations(agentId);
        } else {
          try {
            const conversations = await loadConversations(agentId);
            if (conversations.length > 0) {
              const latestConversationId = conversations[0].conversation_id;
              setCurrentState(agentId, latestConversationId);
              if (syncToUrl) syncConversationIdToUrl(agentId, latestConversationId);
            } else {
              setCurrentState(agentId, 0);
            }
          } catch (err) {
            console.error("Failed to load conversations:", err);
            setCurrentState(agentId, 0);
          }
        }
      };

      initConversation();
    }, [agentId, agentLoading, initialConversationId, setCurrentState, loadConversations, features.skipInitialLoad, syncToUrl]);

    // Load messages when conversation changes
    useEffect(() => {
      // 直接从 store 获取最新值，避免闭包问题
      const latestConversationId = useConversationStore.getState().current_conversationid;

      if (!latestConversationId || latestConversationId === 0) {
        loadedConversationRef.current = null;
        if (syncToUrl) syncConversationIdToUrl(agentId, 0);
        return;
      }

      if (skipNextLoadRef.current) {
        skipNextLoadRef.current = false;
        return;
      }

      if (isStreaming) return;

      if (loadedConversationRef.current === latestConversationId) return;
      loadedConversationRef.current = latestConversationId;

      if (syncToUrl) syncConversationIdToUrl(agentId, latestConversationId);

      loadMessageList(String(latestConversationId), (id, params) =>
        adapters.conversationApi.messages(id, params)
      ).then((list: any[]) => {
        // 初始加载（刷新进入）：用历史消息最后一条时间检查是否超时
        // 切换历史会话：不计时
        if (isInitialLoadRef.current && list && list.length > 0) {
          const lastMessage = list[list.length - 1];
          setLastMessageTime(lastMessage.updated_time);
        }
        // 标记已完成初始加载
        isInitialLoadRef.current = false;
      });
    }, [currentConversationId, loadMessageList, adapters.conversationApi, agentId, setLastMessageTime, isStreaming, syncToUrl]);

    // Reset timer on new conversation
    useEffect(() => {
      resetTimer();
    }, [currentConversationId, resetTimer]);

    // Format files for API
    const formatFiles = useCallback(
      (files: any[]) =>
        files?.map((item) => ({
          type: "image" as const,
          content: `file_id:${item.id}`,
          filename: item.name,
          size: item.size,
          mime_type: item.mime_type,
          url: item.url,
        })) || [],
      []
    );

    // Handle send message
    const handleSend = useCallback(
      async (data: SendData | string, userFiles: any[] = []) => {
        const question = typeof data === "string" ? data : data.textContent || data.pureTextContent || "";
        const files = typeof data === "string" ? userFiles : data.files || userFiles;

        if (!question.trim() || isStreaming || !agentId) return;

        // 权限检查
        if (checkPermission) {
          const hasPermission = await checkPermission(agentInfo?.user_group_ids);
          if (!hasPermission) {
            return;
          }
        }

        setInputValue("");

        let conversationId = currentConversationId;
        // 安全解析 configs
        let configs: Record<string, any> = {};
        try {
          const configsRaw = agentInfo?.configs || "{}";
          configs = typeof configsRaw === "string" ? JSON.parse(configsRaw) : configsRaw;
        } catch {
          console.warn("Failed to parse agent configs");
        }
        const completionParams = configs.completion_params || {};

        if (!conversationId || conversationId === 0) {
          try {
            const conversation = await createConversation(agentId, question);
            addConversation({
              ...conversation,
              virtual_id: Date.now().toString(),
            });
            skipNextLoadRef.current = true;
            setCurrentState(agentId, conversation.conversation_id);
            conversationId = conversation.conversation_id;
          } catch (err) {
            console.error("Failed to create conversation:", err);
            return;
          }
        }

        await sendMessage({
          question,
          agent_id: agentId,
          conversation_id: conversationId || 0,
          messageList: [],
          completion_params: completionParams,
          files: formatFiles(files),
          agentInfo,
          minimalParams: true,
          type: "agent",
          onMessageListChange: (updater) => {
            updateMessageList(updater);
          },
        });

        setLastMessageTime(Date.now());
      },
      [
        sendMessage,
        isStreaming,
        agentId,
        currentConversationId,
        agentInfo,
        updateMessageList,
        createConversation,
        addConversation,
        setCurrentState,
        formatFiles,
        setLastMessageTime,
        checkPermission,
      ]
    );

    // Handle suggestion click
    const handleSuggestion = useCallback(
      (content: string) => {
        handleSend(content);
      },
      [handleSend]
    );

    // Handle regenerate message
    const handleRegenerate = useCallback(
      (msg: Message) => {
        const question = msg.question || "";
        handleSend(question);
      },
      [handleSend]
    );

    // Handle history open
    const handleHistoryOpen = useCallback(() => {
      historyRef.current?.open();
    }, []);

    // Handle embed close - use embedMode.requestClose()
    const handleEmbedClose = useCallback(() => {
      embedMode.requestClose();
    }, [embedMode]);

    // Share mode handlers
    const handleOpenShare = useCallback(() => {
      setShareMode(true);
      setSelectAll(false);
      setSelectMessageIds([]);
    }, []);

    const handleCancelShare = useCallback(() => {
      setShareMode(false);
      setSelectAll(false);
      setSelectMessageIds([]);
    }, []);

    const handleSelectAll = useCallback(() => {
      if (selectAll) {
        setSelectMessageIds([]);
        setSelectAll(false);
      } else {
        setSelectMessageIds(messageList.map((item: Message) => item.id));
        setSelectAll(true);
      }
    }, [selectAll, messageList]);

    const handleSelectMessage = useCallback(
      (msgId: string | number) => {
        if (selectMessageIds.includes(msgId)) {
          setSelectMessageIds((prev) => prev.filter((id) => id !== msgId));
          setSelectAll(false);
        } else {
          setSelectMessageIds((prev) => [...prev, msgId]);
        }
      },
      [selectMessageIds]
    );

    const handleCreateShare = useCallback(async () => {
      if (!onShare || !currentConversationId) return;
      setShareLoading(true);
      try {
        const link = await onShare(selectMessageIds, currentConversationId, selectAll);
        await copyToClip(link);
        message.success(t("share.create_success") || "分享链接已复制");
        setShareMode(false);
        setSelectAll(false);
        setSelectMessageIds([]);
      } catch (err) {
        console.error("Failed to create share:", err);
      } finally {
        setShareLoading(false);
      }
    }, [onShare, selectMessageIds, currentConversationId, selectAll, t]);

    useImperativeHandle(ref, () => ({
      reload: () => {
        if (agentInfoProp) {
          setAgentInfo(agentInfoProp);
          setAgentLoading(false);
          return;
        }
        setAgentLoading(true);
        adapters.agentApi.detail(agentId).then(setAgentInfo).finally(() => setAgentLoading(false));
      },
      newConversation: handleNewConversation,
      showShare: handleOpenShare,
      sendMessage: (content: string) => {
        if (content?.trim()) {
          handleSend(content);
        }
      },
      setPrompt: (content: string) => {
        setInputValue(content);
      },
    }));

    if (agentLoading) {
      return <LoadingState message={t("agent.loading")} />;
    }

    if (!agentId) {
      return <LoadingState message={t("agent.missing_id")} />;
    }

    if (!agentInfo) {
      return <LoadingState message={t("agent.not_found")} />;
    }

    // If agent is completion mode, render CompletionView instead
    const agentMode = agentInfo.custom_config_obj?.agent_mode;
    if (agentMode === "completion") {
      return <CompletionView agentInfo={agentInfo} checkPermission={checkPermission} features={features} />;
    }

    return (
      <div className="flex flex-col h-screen bg-white">
        {/* Share Header */}
        {shareMode && features.share && (
          <ShareHeader
            selectedCount={selectMessageIds.length}
            selectAll={selectAll}
            onSelectAll={handleSelectAll}
            onCreateShare={handleCreateShare}
            onCancel={handleCancelShare}
          />
        )}

        {/* Header - 支持 slot 或默认，分享模式下隐藏 */}
        {!shareMode && (renderHeader ? (
          renderHeader({ agentInfo, lang, setLang })
        ) : (
          <ChatHeader
            agentInfo={agentInfo}
            lang={lang}
            setLang={setLang}
            showGuide={showGuide}
            onGuideChange={setShowGuide}
            isEmbedMode={embedMode.isEmbedMode}
            onClose={handleEmbedClose}
            messageCount={messageList.length}
            onShare={handleOpenShare}
            features={{
              languageSwitcher: features.languageSwitcher,
              guide: features.guide,
              share: features.share,
            }}
          />
        ))}

        <ChatMessages
          messageList={messageList as Message[]}
          agentInfo={agentInfo}
          isStreaming={isStreaming}
          onSuggestionClick={handleSuggestion}
          renderAuthTags={renderAuthTags}
          isShareMode={shareMode}
          selectedMessageIds={selectMessageIds}
          selectAll={selectAll}
          onMessageSelect={(msg) => handleSelectMessage(msg.id)}
          showRecommend={features.showRecommend}
          recommendAgents={recommendAgents}
          onRecommendAgentSelect={onRecommendAgentSelect}
          onNextAgent={onNextAgent}
          onInitAgent={onInitAgent}
          openclaw={features.openclaw}
          showRelatedScene={features.showRelatedScene}
          renderMessageMenu={
            !shareMode && features.messageMenu
              ? (type, msg) => (
                  <MessageMenu
                    type={type}
                    content={type === "user" ? (msg.question || "") : (msg.answer || "")}
                    features={{ share: features.share }}
                    onRegenerate={() => handleRegenerate(msg)}
                    onShare={features.share ? handleOpenShare : undefined}
                  />
                )
              : undefined
          }
        />

        {/* 输入区域 - 分享模式下隐藏 */}
        {!shareMode && <ChatInput
          inputValue={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onStop={handleStop}
          isStreaming={isStreaming}
          enableUpload={features.fileUpload && pluginConfig.features?.showFileUpload}
          placeholder={t("chat.input_placeholder")}
          features={{
            history: features.history,
            newConversation: features.newConversation,
          }}
          onNewConversation={handleNewConversation}
          onHistoryOpen={handleHistoryOpen}
          renderLeftButtons={() =>
            renderAgentSelector && features.agentTooltip
              ? renderAgentSelector({
                  agentInfo,
                  onSelect: (agent) => {
                    if (syncToUrl) {
                      const url = new URL(window.location.href);
                      url.searchParams.set("agent_id", String(agent.agent_id));
                      url.searchParams.delete("conversation_id");
                      window.location.href = url.toString();
                    }
                  },
                })
              : null
          }
          enableDragUpload={features.enableDragUpload}
          allowMultiple={features.allowMultiple}
          allowSendWithFiles={features.allowSendWithFiles}
          enablePasteUpload={features.enablePasteUpload}
          acceptTypes={acceptTypes}
          maxFileSize={maxFileSize}
          httpRequest={uploadRequest}
          showRecommend={features.showRecommend}
        />}

        {/* Copyright */}
        {!shareMode && renderCopyright?.()}

        <ChatHistory ref={historyRef} onNew={handleNewConversation} />

        {showGuide && features.guide && (
          <div className="fixed inset-0 z-20 bg-white overflow-hidden">
            <div className="h-[70px] flex items-center justify-center border-b relative">
              <h4 className="text-lg text-[#1F2123]">{t("chat.usage_guide")}</h4>
              <div
                className="flex items-center justify-center size-6 absolute right-2 top-1/2 -translate-y-1/2 rounded cursor-pointer hover:bg-[#ECEDEE]"
                onClick={() => setShowGuide(false)}
              >
                <CloseOutlined />
              </div>
            </div>
            <UsageGuide useCases={agentInfo?.use_cases} />
          </div>
        )}
      </div>
    );
  }
);

ChatView.displayName = "ChatView";

export default ChatView;