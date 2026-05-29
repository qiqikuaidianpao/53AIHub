import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Checkbox, Tooltip, message } from "antd";
import { Dropdown } from "@km/shared-components-react";
import type { MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import { useConversationStore } from "./conversation";
import { useUserStore } from "@/stores/modules/user";
import { useNavigationStore } from "@/stores/modules/navigation";
import { useLibraryStore } from "@/stores/modules/library";
import { useSpaceStore } from "@/stores/modules/space";
import { useChatFeedback } from "@/composables/useChatFeedback";
import { useChatMessages } from "@/composables/useChatMessages";
import { useChatSend } from "@/composables/useChatSend";
import { useChatShare } from "@/composables/useChatShare";
import { t } from "@/locales";
import { cacheManager as cache, CacheMode, eventBus } from "@km/shared-utils";
import { checkPermission } from "@/utils/permission";
import Header from "@/components/Layout/Header";
import { Sender } from "@/components/Chat/Sender";
import { BubbleList, BubbleUser, BubbleAssistant } from "@km/hub-ui-x-react";
import { FeedbackPanel } from "@/components/Chat/FeedbackPanel";
import { ShareHeader } from "@/components/Chat/ShareHeader";
import { ThinkKnowledge } from "@/components/Chat/ThinkKnowledge";
import { Quotation } from "@/components/Chat/Quotation";
import { Chunk } from "@/components/Chat/Chunk";
import { Graph } from "@/components/Chat/Graph";
import { MessageMenu } from "@/components/Chat/MessageMenu";
import { ProcessFlowHeader } from "@/components/Chat/ProcessFlow";
import { SpecifiedFiles } from "@/components/Chat/SpecifiedFiles";
import { ModelView } from "@/components/Model/view";
import { KnowledgeSourceSelector } from "@/components/KnowledgeSource";
import type { KnowledgeSourceState } from "@/components/KnowledgeSource";
import AddAnswerAsMd from "@/components/Chat/AddAnswerAsMd";
import agentsApi from "@/api/modules/agents/index";
import { transformAgentInfo } from "@/api/modules/agents/transform";
import { AGENT_USAGES } from "@/constants/agent";
import { EVENT_NAMES } from "@/constants/events";
import ChatHistory from "./history";
import { GroupList } from "./components";
import "./chat.css";

interface AgentInfo {
  agent_id: string;
  name: string;
  logo: string;
  description?: string;
  settings?: {
    opening_statement?: string;
    suggested_questions?: { id: string; content: string }[];
    web_search_setting?: { enable: boolean };
    graph_search_setting?: { enable: boolean; default_enable: boolean };
    answer_remarks_config?: { enable: boolean; content: string };
    deep_thinking_config?: {
      channel_id: number;
      channel_type: number;
      model_name: string;
      temperature: number;
    };
    fast_reasoning_config?: { channel_id: number; temperature: number };
  };
  configs?: {
    completion_params?: any;
  };
}

interface ModelItem {
  id: number;
  name: string;
  value: string;
  channel_id: number;
  channel_type: number;
  model: string;
  temperature: number;
  icon: string;
  type: string;
}

export function KnowledgeChatView() {
  const location = useLocation();
  const { space_id } = useParams<{ space_id: string }>();
  const senderRef = useRef<any>(null);
  const chunkRef = useRef<any>(null);
  const thinkKnowledgeRef = useRef<any>(null);
  const chunkSourceRef = useRef<any>(null);
  const graphRef = useRef<any>(null);
  const graphSourceRef = useRef<any>(null);
  const addAnswerAsMdRef = useRef<any>(null);

  const convStore = useConversationStore();
  const userStore = useUserStore();
  const navigationStore = useNavigationStore();
  const libraryStore = useLibraryStore();
  const spaceStore = useSpaceStore();

  const [showHistory, setShowHistory] = useState(false);
  const [showThinkKnowledge, setShowThinkKnowledge] = useState(false);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [agentModels, setAgentModels] = useState<ModelItem[]>([]);
  const [model, setModel] = useState("");
  const [library, setLibrary] = useState({
    name: t("library.all_libraries"),
    value: ["all"],
    isSpace: false,
  });
  const [knowledgeSource, setKnowledgeSource] = useState<KnowledgeSourceState>({
    mode: 'all',
    allKnowledge: true,
    knowledgeGraph: false,
    networkSearch: false,
    selectedFiles: []
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [senderIsSimpleMode, setSenderIsSimpleMode] = useState(true);
  const [isFocusInput, setIsFocusInput] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasConversationId, setHasConversationId] = useState(false);
  const currentGraphMessage = useRef<any>(null);

  const isInLibrary = location.pathname.includes("/library/");

  // 使用自定义 hooks
  const {
    loadFeedbackConfig,
    handleClickFeedbackBtn: handleClickFeedbackBtnBase,
    handleToggleFeedbackBtn,
    handleCloseFeedback,
    handleSubmitFeedback,
    resetFeedbackSuccessState,
  } = useChatFeedback();

  const {
    state: messageState,
    handleLoadListMore: handleLoadListMoreBase,
    loadMessageList: loadMessageListBase,
    handleRegenerate: handleRegenerateBase,
    renderSource,
    handleSourceReferenceHover: handleSourceReferenceHoverBase,
    handleOpenKnow: handleOpenKnowBase,
    clearMessageList,
    updateMessageList,
  } = useChatMessages({ limit: 10 });

  const { sendMessage: sendMessageBase, handleStop: handleStopBase } =
    useChatSend();

  const {
    state: shareState,
    isShareMode,
    handleSelectAll: handleSelectAllBase,
    handleOpenShare: handleOpenShareBase,
    handleSelectMessage: handleSelectMessageBase,
    handleCreateShare: handleCreateShareBase,
  } = useChatShare();

  // 当前对话
  const currentConv = useMemo(
    () => convStore.currentConversation(),
    [convStore.conversations, convStore.current_conversationid],
  );

  // 当前模型
  const currentModel = useMemo(() => {
    return agentModels.find((item) => item.value === model);
  }, [agentModels, model]);

  // 消息列表
  const messageList = useMemo(
    () => messageState.messageList,
    [messageState.messageList],
  );

  // 辅助函数：按 ID 更新消息
  const updateMessageById = useCallback(
    (id: string, updater: (msg: any) => any) => {
      updateMessageList((list) =>
        list.map((item) => (item.id === id ? updater(item) : item)),
      );
    },
    [updateMessageList],
  );

  // 辅助函数：批量更新多个消息（用于关闭其他消息的反馈面板）
  const updateMessages = useCallback(
    (updater: (list: any[]) => any[]) => {
      updateMessageList(updater);
    },
    [updateMessageList],
  );

  // 加载更多消息
  const handleLoadListMore = useCallback(
    async (done: () => void): Promise<void> => {
      const { id } = currentConv;
      if (!id) return done();
      return handleLoadListMoreBase(done, id);
    },
    [currentConv, handleLoadListMoreBase],
  );

  // 加载消息列表
  const loadMessageList = useCallback(
    async (conversationId?: string | number) => {
      const id = conversationId || currentConv.id;
      if (!id) return;
      await loadMessageListBase(id);
    },
    [currentConv, loadMessageListBase],
  );

  const handleChangeLibrary = useCallback(
    (item: any) => {
      setLibrary(item);
      cache.set(
        "library_" + userStore.info.eid,
        item,
        60 * 24 * 7,
        CacheMode.LOCAL_STORAGE,
      );
    },
    [userStore.info.eid],
  );

  // 创建会话
  const createConversation = useCallback(
    async (agent_id: string, question: string) => {
      const currentConversation = currentConv;
      if (currentConversation.id) return currentConversation.id;
      const conversation = await convStore.createConversation(
        agent_id,
        undefined,
        question,
      );

      convStore.addConversation({
        ...conversation,
        id: conversation.conversation_id,
        virtual_id: currentConversation.virtual_id,
      } as any);
      convStore.setCurrentState(String(conversation.conversation_id), true);
      return conversation.conversation_id;
    },
    [currentConv, convStore],
  );

  // 发送消息
  const sendMessage = useCallback(
    async (question: string, links: any[] = []) => {
      if (isStreaming) return;
      setShowHistory(false);
      setShowThinkKnowledge(false);
      setSenderIsSimpleMode(false);
      setIsFocusInput(true);

      setIsStreaming(true);

      const agent_id = agentInfo?.agent_id;
      // 创建会话并获取 conversation_id
      let conversation_id = currentConv.id;
      if (!conversation_id) {
        conversation_id = await createConversation(agent_id || 0, question);
        setHasConversationId(true); // 新创建会话后标记有会话ID
      }

      const completion_params = agentInfo?.configs?.completion_params;
      const modelId = currentModel?.id || "";

      try {
        await sendMessageBase({
          question,
          agent_id: agent_id || 0,
          conversation_id: conversation_id || 0,
          modelId,
          completion_params: {
            ...completion_params,
            temperature: currentModel?.temperature,
          },
          messageList: messageState.messageList,
          // 优先使用传入的 links（来自 @ 符号选择），否则使用 knowledgeSource
          links: links.length > 0 ? links : (knowledgeSource.mode === 'files' ? knowledgeSource.selectedFiles : []),
          networkSearch: knowledgeSource.networkSearch,
          knowledgeGraph: knowledgeSource.knowledgeGraph,
          library: isInLibrary
            ? library
            : (knowledgeSource.mode === 'all' && knowledgeSource.allKnowledge
              ? library
              : { name: '', value: [], isSpace: false }),
          agentInfo,
          onMessageListChange: updateMessageList,
        });
      } catch (err: any) {
        console.log(err);
      } finally {
        setIsStreaming(false);
      }
    },
    [
      isStreaming,
      createConversation,
      agentInfo,
      currentConv,
      currentModel,
      sendMessageBase,
      messageState.messageList,
      knowledgeSource,
      library,
      updateMessageList,
    ],
  );

  // 发送消息入口
  const handleSend = useCallback(
    (data: any) => {
      const { textContent, atList } = data;
      checkPermission({
        checkInternal: true,
        onClick: () => {
          if (!textContent.trim()) return;
          if (!agentInfo || !agentInfo.agent_id) {
            message.warning(t("index.ai_search_setup_tip"));
          } else {
            sendMessage(textContent, atList || []);
          }
        },
      });
    },
    [agentInfo, sendMessage],
  );

  // 停止生成
  const handleStop = useCallback(() => {
    handleStopBase();
    setIsStreaming(false);
  }, [handleStopBase]);

  // 聊天框展开
  const handleChatExpand = useCallback(
    (bool: boolean) => {
      if (!senderIsSimpleMode) return;
      setIsFocusInput(bool);
    },
    [senderIsSimpleMode],
  );

  // 重新生成回答
  const handleRegenerate = useCallback(
    (msg: any) => {
      if (isStreaming) return;
      handleRegenerateBase(msg, handleSend);
    },
    [isStreaming, handleRegenerateBase, handleSend],
  );

  const handleShowErrorDetails = useCallback((msg: any) => {
    if (!msg.showErrorDetails) {
      msg.showErrorDetails = true;
    }
  }, []);

  // 点赞/点踩
  const handleClickFeedbackBtn = useCallback(
    async (msg: any, type: "satisfied" | "unsatisfied") => {
      // 先关闭其他消息的反馈面板
      updateMessages((list) =>
        list.map((item) =>
          item.id !== msg.id ? { ...item, feedbackVisible: false } : item,
        ),
      );
      // 然后更新当前消息
      const updatedMsg = await handleClickFeedbackBtnBase(msg, type);
      updateMessageById(updatedMsg.id, () => updatedMsg);
    },
    [handleClickFeedbackBtnBase, updateMessages, updateMessageById],
  );

  const handleSourceReferenceHover = useCallback(
    (data: any, msg: any) => {
      handleSourceReferenceHoverBase(
        data,
        msg,
        chunkRef,
        chunkSourceRef,
        graphRef,
        graphSourceRef,
      );
      // 保存当前 graph 对应的 message 引用，用于 @view 事件
      const chunks = msg.rag_stats?.chunks || [];
      const key = `[Source:${data.sourceType}-${data.sourceNumber}]`;
      const chunk = chunks.find(
        (item: any) => item.source_key === key || item.source === key,
      );
      if (chunk?.chunk_type === "graph_result") {
        currentGraphMessage.current = msg;
      }
    },
    [handleSourceReferenceHoverBase],
  );

  const handleOpenKnow = useCallback(
    (msg: any) => {
      handleOpenKnowBase(msg, thinkKnowledgeRef, setShowThinkKnowledge);
    },
    [handleOpenKnowBase],
  );

  // 处理 Source 点击事件，打开 think-knowledge 并选中对应项
  const handleSourceClick = useCallback(
    (msg: any) => (source: any) => {
      setShowThinkKnowledge(true);
      setTimeout(() => {
        thinkKnowledgeRef.current?.updateResults(
          msg.rag_stats?.files_search || [],
          msg.rag_stats?.type,
        );
        setTimeout(() => {
          thinkKnowledgeRef.current?.selectItem(source);
        }, 0);
      }, 0);
    },
    [],
  );

  // 处理 Graph 的 view 事件，打开 think-knowledge 并选中对应项
  const handleGraphView = useCallback((libraryInfo: any) => {
    const message = currentGraphMessage.current;
    if (!message) return;
    setShowThinkKnowledge(true);
    setTimeout(() => {
      thinkKnowledgeRef.current?.updateResults(
        message.rag_stats?.files_search,
        message.rag_stats?.type,
      );
      setTimeout(() => {
        thinkKnowledgeRef.current?.selectItem(libraryInfo);
      }, 0);
    }, 0);
  }, []);

  const handleNewChat = useCallback(() => {
    convStore.setCurrentState("", true);
    setShowHistory(false);
    setShowThinkKnowledge(false);
    clearMessageList();
    setHasConversationId(false); // 重置会话ID状态
    if (isInLibrary) return;
    setIsFocusInput(false);
    setSenderIsSimpleMode(true);
  }, [convStore, clearMessageList, isInLibrary]);

  const onSelectConversation = useCallback(
    (conversation_id: string) => {
      convStore.setCurrentState(conversation_id);
      setShowHistory(false);
      setShowThinkKnowledge(false);
      setHasConversationId(true); // 设置有会话ID
      setIsFocusInput(true);
      setSenderIsSimpleMode(false);
      loadMessageList(conversation_id);
    },
    [convStore, loadMessageList],
  );

  const handleChangeModel = useCallback((modelValue: string) => {
    setModel(modelValue);
  }, []);

  // 加载模型列表
  const loadModels = useCallback(async (agent: any) => {
    const res = await agentsApi.models.list(agent.agent_id);
    const deepConfig = agent.settings?.deep_thinking_config || { temperature: 0.5 };
    const fastConfig = agent.settings?.fast_reasoning_config || { temperature: 0.5 };
    const deepValue = `${deepConfig.channel_id}_${deepConfig.channel_type}_${deepConfig.model_name}`;

    const models = res.agent_models
      .map((item: any) => {
        const value = `${item.channel_id}_${item.channel_type}_${item.model}`;
        const isDeepThinking = value === deepValue;
        return {
          ...item,
          type: isDeepThinking ? "deep_reasoning" : "fast_reasoning",
          icon: isDeepThinking ? "star-link" : "lightning",
          name: isDeepThinking ? t("chat.deep_thinking") : t("chat.fast_response"),
          temperature: isDeepThinking ? deepConfig.temperature : fastConfig.temperature,
          value,
        };
      })
      .filter((item: any, index: number, self: any[]) =>
        index === self.findIndex((t: any) => t.type === item.type)
      );

    if (models.length) setModel((models[0] as any).value);
    setAgentModels(models);
  }, []);

  // 加载智能体
  const loadAgent = useCallback(async () => {
    const res = await agentsApi.list({
      agent_usages: String(AGENT_USAGES.KM_AI_SEARCH),
    });
    const agent = res.agents[0] ? transformAgentInfo(res.agents[0]) : null;
    setAgentInfo(agent);
    if (agent) {
      loadModels(agent);
      convStore.setAgentId(agent.agent_id);
      // 更新知识图谱默认状态
      const graphDefaultEnable = agent.settings?.graph_search_setting?.default_enable ?? false;
      setKnowledgeSource(prev => ({
        ...prev,
        knowledgeGraph: graphDefaultEnable
      }));
    }
    return agent;
  }, [loadModels, convStore]);

  const handleSelectAll = useCallback(() => {
    handleSelectAllBase(messageList);
  }, [handleSelectAllBase, messageList]);

  const handleCreateShare = useCallback(() => {
    handleCreateShareBase(
      convStore.current_conversationid as string,
      "index",
      currentConv?.title,
    );
  }, [handleCreateShareBase, convStore.current_conversationid, currentConv]);

  const handleAddAsMd = useCallback((msg: any) => {
    addAnswerAsMdRef.current?.open({
      answer: msg.answer,
      question: msg.original_question || msg.question,
    });
  }, []);

  // 初始化
  const initChat = useCallback(async () => {
    setIsInitializing(true);

    // 解析 URL 参数
    const conversation_id = new URLSearchParams(location.search).get("conversation_id") as string;
    const hasConvId = !!conversation_id;
    setHasConversationId(hasConvId);

    // 非知识库模式：有 conversation_id 时立即设置输入框状态
    if (!isInLibrary && hasConvId) {
      setIsFocusInput(true);
      setSenderIsSimpleMode(false);
    }

    // 并行加载：agent 和 feedback 配置
    loadFeedbackConfig(); // 非阻塞
    const agentPromise = loadAgent(); // 不等待

    convStore.setBasePath(location.pathname);

    // 知识库模式设置
    if (isInLibrary) {
      setLibrary({
        name: libraryStore.library?.name || t("library.this_library_content"),
        value: [libraryStore.library?.id as string],
        isSpace: false,
      });
      setKnowledgeSource(prev => ({ ...prev, allKnowledge: false }));
      spaceStore.loadSpaceList(); // 非阻塞
      setIsFocusInput(true);
      setSenderIsSimpleMode(false);
    } else {
      // 缓存读取不阻塞
      cache.get<{ name: string; value: string[] }>(
        "library_" + userStore.info.eid,
        CacheMode.LOCAL_STORAGE
      ).then(cachedLibrary => {
        if (cachedLibrary) setLibrary(cachedLibrary);
      });
    }

    // 等待 agent 加载完成
    const agent = await agentPromise;

    if (agent?.agent_id) {
      // 并行：加载模型列表和会话列表
      await Promise.all([
        loadModels(agent),
        convStore.loadConversations()
      ]);

      if (conversation_id) {
        convStore.setCurrentState(conversation_id, false);
      }
      // 加载消息列表（非阻塞，让用户先看到界面）
      loadMessageList(conversation_id);
    }

    setIsInitializing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]); // 只在 URL 参数变化时重新初始化，其他依赖通过闭包访问

  useEffect(() => {
    convStore.clearCurrentState();
    initChat();

    const query = new URLSearchParams(location.search).get("query");
    if (query) {
      setTimeout(() => senderRef.current?.insertText(query), 100);
    }

    eventBus.on(EVENT_NAMES.LOGIN_SUCCESS, initChat);

    return () => {
      eventBus.off(EVENT_NAMES.LOGIN_SUCCESS, initChat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅在组件挂载时初始化，导航切换会话由 onSelectConversation 处理

  // 监听路由重置事件
  useEffect(() => {
    const handleResetRouteState = () => {
      if (convStore.current_conversationid) {
        convStore.setCurrentState("", true);
        setShowHistory(false);
        setShowThinkKnowledge(false);
        clearMessageList();
        setHasConversationId(false);
        if (!isInLibrary) {
          setIsFocusInput(false);
          setSenderIsSimpleMode(true);
        }
      }
    };

    window.addEventListener("reset-route-state", handleResetRouteState);
    return () => {
      window.removeEventListener("reset-route-state", handleResetRouteState);
    };
  }, [convStore, clearMessageList, isInLibrary]);

  // 同步 knowledgeSource.selectedFiles 到 Sender 的 links 显示
  useEffect(() => {
    if (knowledgeSource.mode === 'files' && knowledgeSource.selectedFiles.length > 0) {
      const links = knowledgeSource.selectedFiles.map((file) => ({
        id: file.id,
        name: file.name,
        icon: file.icon,
        ui: { active: true },
        upload_file_id: file.upload_file_id,
        file_size: file.file_size,
        file_mime: file.file_mime,
        library_id: file.library_id,
        isfolder: file.isfolder,
      }));
      senderRef.current?.setLinks(links);
    } else {
      // 当切换到其他模式或没有选中文件时，清除 links
      senderRef.current?.clearLinks();
    }
  }, [knowledgeSource.mode, knowledgeSource.selectedFiles]);

  // 模型选择下拉菜单
  const modelMenuItems: MenuProps["items"] = useMemo(() => {
    return agentModels.map((item) => ({
      key: item.value,
      label: (
        <div
          className={`w-full h-9 flex items-center gap-2 ${item.value === model ? "text-[#2563EB]" : "text-[#1D1E1F]"}`}
        >
          <SvgIcon name={item.icon} />
          <span className="text-sm whitespace-nowrap">{item.name}</span>
          <ModelView
            showIcon={false}
            channelId={item.channel_id}
            model={item.model}
          />
          {item.value === model && <SvgIcon name="check" />}
        </div>
      ),
    }));
  }, [agentModels, model]);

  // Placeholder（直接计算，无需 useMemo）
  const placeholder = isFocusInput
    ? knowledgeSource.networkSearch
      ? t("index.chat_placeholder")
      : t("index.chat_placeholder_library", { name: library.name })
    : t("index.search_in_space");

  // 是否为空状态（无消息且非流式输出）
  const isEmpty = !messageList.length && !isStreaming;

  return (
    <div className="w-full h-full overflow-hidden flex">
      {/* History 侧边栏 */}
      {showHistory && (
        <div className="w-60">
          <ChatHistory
            onCollapse={() => setShowHistory(false)}
            onNewChat={handleNewChat}
            onConversation={onSelectConversation}
          />
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 分享模式头部 */}
        {isShareMode ? (
          <ShareHeader
            selectAll={shareState.selectAll}
            selectMessageIds={shareState.selectMessageIds}
            onSelectAll={handleSelectAll}
            onCreateShare={handleCreateShare}
            onOpenShare={handleOpenShareBase}
          />
        ) : (
          <Header
            back={false}
            title={currentConv?.title || ""}
            border={false}
            beforePrefix={
              <>
                {!libraryStore.siderVisible && (
                  <>
                    <Tooltip title={t("action.expand")}>
                      <div
                        className="size-5 flex-center cursor-pointer"
                        onClick={() => libraryStore.toggleSider?.()}
                      >
                        <SvgIcon name="double-right" />
                      </div>
                    </Tooltip>
                    <div className="h-4 border-l mx-2" />
                  </>
                )}
              </>
            }
            titlePrefix={
              !showHistory ? (
                <>
                  <div className="flex-none flex items-center gap-3">
                    <div
                      className="size-7 cursor-pointer rounded flex items-center justify-center hover:bg-[#F5F5F7]"
                      onClick={() => setShowHistory(true)}
                    >
                      <SvgIcon name="history" />
                    </div>
                    <div
                      className="size-7 cursor-pointer rounded flex items-center justify-center hover:bg-[#F5F5F7]"
                      onClick={handleNewChat}
                    >
                      <SvgIcon name="add-chat" />
                    </div>
                  </div>
                  {currentConv?.title && <div className="border-r h-4" />}
                </>
              ) : undefined
            }
          />
        )}

        {/* 消息区域 */}
        <div className={`flex-1 py-5 flex flex-col ${
          messageList.length && isFocusInput
            ? 'overflow-hidden'
            : isInLibrary
              ? 'items-center justify-center'
              : 'overflow-y-auto'
        }`}>
          {messageList.length > 0 && isFocusInput ? (
            <BubbleList
              autoScroll={true}
              className="flex-1"
              mainClass="w-11/12 lg:w-4/5 max-w-[1200px] mx-auto"
              enablePullUp={true}
              onPullUp={handleLoadListMore}
              messages={messageList}
            >
              {messageList.map((msg: any) => (
                <div key={msg.id}>
                  {/* 用户消息气泡 */}
                  <div
                    className={`flex items-center gap-5 rounded-xl ${isShareMode ? "mb-4 px-3 py-4 bg-[#F5F5F5]" : ""}`}
                    onClick={() => handleSelectMessageBase(msg)}
                  >
                    {isShareMode && (
                      <Checkbox
                        checked={shareState.selectMessageIds.includes(msg.id)}
                      />
                    )}
                    <div className="flex-1 overflow-hidden">
                      <BubbleUser
                        content={msg.original_question || msg.question}
                        files={msg.user_files}
                        className={isShareMode ? "!mb-0" : ""}
                        style={{
                          "--hubx-color-bg-message": "#EBF1FF",
                        }}
                        header={
                          <SpecifiedFiles
                            files={msg.specified_files}
                            type="no_jump"
                          />
                        }
                        menu={
                          !isShareMode ? (
                            <MessageMenu
                              type="user"
                              content={msg.original_question || msg.question}
                            />
                          ) : null
                        }
                      />
                    </div>
                  </div>

                  {/* AI助手消息气泡 */}
                  <div
                    className={`flex items-center gap-5 rounded-xl ${isShareMode ? "mb-4 px-3 py-4 bg-[#F5F5F5]" : ""}`}
                    onClick={() => handleSelectMessageBase(msg)}
                  >
                    {isShareMode && (
                      <Checkbox
                        checked={shareState.selectMessageIds.includes(msg.id)}
                      />
                    )}
                    <div className="flex-1 overflow-hidden">
                      <BubbleAssistant
                        content={msg.answer || msg.content}
                        reasoning={msg.reasoning_content}
                        reasoningExpanded={msg.reasoning_expanded}
                        streaming={msg.loading}
                        alwaysShowMenu={
                          msg.id === messageList[messageList.length - 1]?.id ||
                          msg.feedbackVisible
                        }
                        className={isShareMode ? "!mb-0" : ""}
                        renderSource={(type: string, number: number) =>
                          renderSource(type, number, msg)
                        }
                        sourceEnabled
                        showError={msg.error}
                        onSourceReferenceClick={(data: any) =>
                          handleSourceReferenceHover(data, msg)
                        }
                        style={{
                          "--hubx-color-bg-message": "transparent",
                        }}
                        header={
                          <ProcessFlowHeader
                            processRecords={msg.process_records}
                            streaming={msg.loading}
                            hasContent={!!(msg.answer || msg.content)}
                            onOpenKnow={() => handleOpenKnow(msg)}
                            onSourceClick={handleSourceClick(msg)}
                          />
                        }
                        footer={
                          <>
                            {!msg.loading &&
                              agentInfo?.settings?.answer_remarks_config
                                ?.enable && (
                                <div className="text-sm text-[#999999] break-words my-2">
                                  {
                                    agentInfo.settings.answer_remarks_config
                                      .content
                                  }
                                </div>
                              )}
                            {msg.rag_stats?.file_quotations?.length > 0 && (
                              <Quotation
                                type={msg.rag_stats.type}
                                files={msg.rag_stats.file_quotations}
                              />
                            )}
                          </>
                        }
                        menu={
                          (!msg.loading ||
                            msg.feedbackVisible ||
                            msg.feedbackSuccessful) &&
                          !isShareMode ? (
                            <MessageMenu
                              type="assistant"
                              content={msg.answer || msg.content}
                              feedbackType={msg.feedback_type}
                              showShare={true}
                              onRegenerate={() => handleRegenerate(msg)}
                              onFeedback={(type) =>
                                handleClickFeedbackBtn(msg, type)
                              }
                              onShare={handleOpenShareBase}
                              onAddAsMd={() => handleAddAsMd(msg)}
                            />
                          ) : null
                        }
                        error={
                          msg.error ? (
                            <div className="text-[#262626]">
                              {t("agent.error_tip")}
                              <span
                                className="text-blue-500 cursor-pointer underline"
                                onClick={() => handleShowErrorDetails(msg)}
                              >
                                {t("agent.error_details")}
                              </span>
                              {msg.showErrorDetails && (
                                <div className="mt-2 whitespace-pre-wrap">
                                  {msg.answer || msg.content}
                                </div>
                              )}
                            </div>
                          ) : null
                        }
                      />
                    </div>
                  </div>

                  {/* 反馈面板 */}
                  <FeedbackPanel
                    visible={!!(msg.feedbackVisible && !isShareMode)}
                    feedbackType={msg.feedback_type || ""}
                    feedbackTypeOptions={msg.feedbackTypeOptions || null}
                    submitBtnDisabled={msg.submitBtnDisabled !== false}
                    feedbackSuccessful={msg.feedbackSuccessful || false}
                    description={msg.description}
                    onClose={() => {
                      const updatedMsg = handleCloseFeedback(msg);
                      updateMessageById(updatedMsg.id, () => updatedMsg);
                    }}
                    onToggle={(key: string) => {
                      const updatedMsg = handleToggleFeedbackBtn(msg, key);
                      updateMessageById(updatedMsg.id, () => updatedMsg);
                    }}
                    onSubmit={async () => {
                      const updatedMessage = await handleSubmitFeedback(msg);
                      updateMessageById(updatedMessage.id, () => updatedMessage);
                      // 2秒后重置成功状态
                      setTimeout(() => {
                        const resetMsg = resetFeedbackSuccessState(updatedMessage);
                        updateMessageById(resetMsg.id, () => resetMsg);
                      }, 2000);
                    }}
                    onDescriptionChange={(value: string) => {
                      updateMessageById(msg.id, (item) => ({ ...item, description: value }));
                    }}
                  />
                </div>
              ))}
            </BubbleList>
          ) : null}

          {/* 输入区域 */}
          {!isShareMode && (
            <div className="flex-none w-4/5 max-w-[1200px] mx-auto">
              {isEmpty && (
                <h2 className="text-2xl font-medium text-center">
                  {t("index.knowledge_search")}
                </h2>
              )}
              {isEmpty &&
                isFocusInput &&
                agentInfo?.settings?.opening_statement && (
                  <h3 className="text-base text-[#666666] text-center mt-3 whitespace-pre-wrap max-h-52 overflow-y-auto">
                    {agentInfo.settings.opening_statement}
                  </h3>
                )}

              <Sender
                className="mt-9"
                ref={senderRef}
                simpleMode={senderIsSimpleMode}
                showAt={
                  userStore.is_login &&
                  navigationStore.hasKnowledge &&
                  userStore.info.is_internal
                }
                disabledAt={knowledgeSource.networkSearch}
                placeholder={placeholder}
                loading={isStreaming}
                library={isInLibrary ? libraryStore.library : undefined}
                onSend={handleSend}
                onStop={handleStop}
                onExpand={handleChatExpand}
                onRemoveLink={(link) => {
                  setKnowledgeSource(prev => {
                    const newFiles = prev.selectedFiles.filter(f => f.id !== link.id);
                    // 删除最后一个文件时重置为全部知识模式
                    if (newFiles.length === 0) {
                      return {
                        ...prev,
                        mode: 'all',
                        allKnowledge: true,
                        selectedFiles: []
                      };
                    }
                    return {
                      ...prev,
                      selectedFiles: newFiles
                    };
                  });
                }}
                inputBefore={
                  <img
                    className={`size-5 ${isFocusInput ? "mt-0" : "mt-4 opacity-50"}`}
                    src="/images/library/star.png"
                    alt=""
                  />
                }
                extras={
                  <div className="flex items-center gap-2 mt-3">
                    {/* 模型选择 */}
                    <Dropdown
                      menu={{
                        items: modelMenuItems,
                        onClick: ({ key }) => handleChangeModel(key),
                      }}
                      trigger={["click"]}
                      placement="bottom"
                    >
                      <div className="h-8 px-4 flex items-center gap-1 rounded-full border border-[#E3EEFF] bg-[#F3F8FF] cursor-pointer text-[#2563EB]">
                        {currentModel ? (
                          <>
                            <SvgIcon name={currentModel.icon} />
                            <span className="text-sm whitespace-nowrap">
                              {currentModel.name}
                            </span>
                          </>
                        ) : (
                          <span>{t("chat.select_model")}</span>
                        )}
                        <div className="size-4 flex items-center justify-center">
                          <DownOutlined style={{ fontSize: "14px" }} />
                        </div>
                      </div>
                    </Dropdown>

                    {/* 知识源选择器 */}
                    {userStore.is_login && navigationStore.hasKnowledge && (
                      <KnowledgeSourceSelector
                        value={knowledgeSource}
                        onChange={setKnowledgeSource}
                        library={library}
                        disabled={!userStore.info.is_internal}
                        agentInfo={agentInfo}
                      />
                    )}
                  </div>
                }
              />

              {/* AI 生成提示 */}
              {isFocusInput && (
                <div className="text-xs text-[#999999] text-center mt-5">
                  {t("common.ai_generated")}
                </div>
              )}

              {/* 推荐问题 */}
              {isFocusInput &&
                isEmpty &&
                agentInfo?.settings?.suggested_questions && (
                  <div className="grid grid-cols-2 gap-4 mt-10">
                    {agentInfo.settings.suggested_questions.map((item) => (
                      <Tooltip key={item.id} title={item.content}>
                        <div
                          className="h-11 px-4 border rounded-xl flex items-center cursor-pointer hover:shadow"
                          onClick={() =>
                            handleSend({ textContent: item.content })
                          }
                        >
                          <span className="text-sm text-[#1D1E1F] truncate">
                            {item.content}
                          </span>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* 空间列表（非知识库模式，无会话ID时才显示） */}
          {!messageList.length && !isInLibrary && !hasConversationId && (
            <div className="w-11/12 lg:w-4/5 max-w-[1200px] mx-auto mt-16">
              <h3 className="text-2xl text-[#1D1E1F] mb-2">
                {t("module.space")}
              </h3>
              {isInitializing ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB]"></div>
                </div>
              ) : (
                <GroupList stickyOffset={-20} spaceId={space_id} />
              )}
            </div>
          )}

          {/* Chunk 弹窗 */}
          <Chunk ref={chunkRef} virtualRef={chunkSourceRef} />
          {/* Graph 弹窗 */}
          <Graph
            ref={graphRef}
            virtualRef={graphSourceRef}
            onView={handleGraphView}
          />
        </div>
      </div>

      {/* 思考知识库侧边栏 */}
      {showThinkKnowledge && (
        <div className="h-full w-[418px] border-l">
          <ThinkKnowledge
            ref={thinkKnowledgeRef}
            onClose={() => setShowThinkKnowledge(false)}
          />
        </div>
      )}

      {/* 添加回答为MD */}
      <AddAnswerAsMd ref={addAnswerAsMdRef} />
    </div>
  );
}

export default KnowledgeChatView;
