/**
 * ChatView - 使用 shared-business 组件
 *
 * 功能：
 * - 路由参数解析（agent_id, conversation_id, from, type）
 * - 智能体加载（探索列表 + 我的列表）
 * - 面包屑导航
 * - 分享按钮
 * - 使用指引按钮
 *
 * 核心组件：
 * - ChatContainer（来自 shared-business）
 */
import {
  useEffect,
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import { useSearchParams, useNavigate, Outlet } from "react-router-dom";
import { Breadcrumb, Button, Tooltip } from "antd";
import { ArrowRightOutlined, LeftOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import { useAgentStore, useCurrentAgent } from "@/stores/modules/agent";
import { useConversationStore } from "@/stores/modules/conversation";
import { useShortcutsStore } from "@/stores/modules/shortcuts";
import {
  useEnterpriseStore,
  useIsSoftStyle,
} from "@/stores/modules/enterprise";
import { useNavigationStore } from "@/stores/modules/navigation";
import { useUserStore } from "@/stores/modules/user";
import { AGENT_TYPES } from "@/constants/platform/config";
import agentsApi from "@/api/modules/agents";
import { eventBus } from "@km/shared-utils";
import { EVENT_NAMES } from "@/constants/events";
import { t } from "@/locales";
import ChatContainer, { ChatContainerRef } from "./ChatContainer";
import { ExpandSidebarButton } from "@/components/Layout/ExpandSidebarButton";
import MoreDropdown from "@/components/MoreDropdown";
import {
  CompletionView,
  ChatProvider,
  ChatI18nProvider,
} from "@km/shared-business";
import { conversationApiAdapter, agentApiAdapter } from "@/adapters/chat";
import chatApi from "@/api/modules/chat";
import "./index.css";

export interface ChatViewRef {
  showUseCase: () => void;
  hideUseCase: () => void;
  showShare: () => void;
}

const ChatView = forwardRef<ChatViewRef, {}>((props, ref) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const chatRef = useRef<ChatContainerRef>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [hideBottomActions, setHideBottomActions] = useState(true);

  const agentStore = useAgentStore();
  const convStore = useConversationStore();
  const enterpriseStore = useEnterpriseStore();
  const navigationStore = useNavigationStore();
  const userStore = useUserStore();
  const shortcutsStore = useShortcutsStore();

  const currentAgent = useCurrentAgent();

  const isSoftStyle = useIsSoftStyle();
  const isWebsite = !isSoftStyle;

  // 当前智能体 ID（支持 string 类型如 "U5KLWZ"）
  const agentId = useMemo(() => {
    return searchParams.get("agent_id") || "";
  }, [searchParams]);

  // 当前会话 ID
  const conversationId = useMemo(() => {
    return searchParams.get("conversation_id") || undefined;
  }, [searchParams]);

  const detailData = useMemo(() => {
    return currentAgent || { name: "" };
  }, [currentAgent]);

  const isCompletion = useMemo(() => {
    return currentAgent?.custom_config_obj?.agent_mode === "completion";
  }, [currentAgent]);

  // 是否为快捷方式
  const isShortcut = useMemo(() => {
    if (!currentAgent?.agent_id) return false;
    return shortcutsStore.isShortcut("agent", currentAgent.agent_id);
  }, [currentAgent?.agent_id, shortcutsStore]);

  // 更多操作
  const handleMore = useCallback(
    async (command: string) => {
      if (command === "add-shortcut") {
        await shortcutsStore.addShortcut("agent", String(currentAgent?.agent_id));
      } else if (command === "remove-shortcut") {
        await shortcutsStore.removeShortcut("agent", String(currentAgent?.agent_id));
      }
    },
    [shortcutsStore, currentAgent]
  );

  // Completion 模式需要的 adapters
  const completionAdapters = useMemo(
    () => ({
      conversationApi: conversationApiAdapter,
      agentApi: agentApiAdapter,
      uploadApi: {
        upload: async (file: File) => {
          // TODO: 实现 upload API
          throw new Error("Not implemented");
        },
      },
      workflowApi: {
        run: async (data: any, options?: { signal?: AbortSignal }) => {
          return chatApi.workflow.run(data, {
            signal: options?.signal,
          });
        },
      },
    }),
    []
  );

  // Completion 模式的 Header 渲染
  const renderCompletionHeader = useCallback(
    ({
      agentInfo,
      showGuide,
      onGuideChange,
    }: {
      agentInfo: any;
      lang: string;
      setLang: (lang: string) => void;
      showGuide: boolean;
      onGuideChange: (show: boolean) => void;
    }) => {
      if (isWebsite) return null;

      return (
        <header className="flex-none h-[70px] border-b sticky top-0 z-10 bg-white">
          <div className="mx-auto px-4 flex items-center justify-between h-full">
            <div className="flex-1 flex items-center gap-2 overflow-hidden">
              <ExpandSidebarButton />
              <Tooltip title={t("action.back")}>
                <div
                  className="flex-none size-7 rounded-md flex-center cursor-pointer max-md:hidden hover:bg-[#ECEDEE]"
                  onClick={() => navigate("/agent")}
                >
                  <LeftOutlined className="text-regular cursor-pointer" />
                </div>
              </Tooltip>
              <div
                className="text-base text-primary line-clamp-1 max-md:flex-1 max-md:text-center"
                title={agentInfo?.name || ""}
              >
                {agentInfo?.name || ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile back button */}
              <span
                className="flex items-center gap-1 text-sm cursor-pointer md:hidden"
                onClick={() => navigate(-1)}
              >
                <SvgIcon name="return" size={18} stroke />
              </span>
              <Tooltip title={t("chat.usage_guide")}>
                <div
                  className="h-6 px-2 rounded-full flex-center gap-1 text-sm text-primary cursor-pointer hover:bg-[#E1E2E3]"
                  onClick={() => onGuideChange(true)}
                >
                  <SvgIcon name="layout-split" size={18} />
                </div>
              </Tooltip>
              <MoreDropdown
                items={[
                  !isShortcut
                    ? {
                        key: "add-shortcut",
                        icon: "add-mode",
                        label: t("shortcut.add"),
                      }
                    : {
                        key: "remove-shortcut",
                        icon: "delete-mode",
                        label: t("shortcut.remove"),
                      },
                ].filter(Boolean)}
                onCommand={handleMore}
              />
            </div>
          </div>
        </header>
      );
    },
    [isWebsite, navigate, isShortcut, handleMore]
  );

  // 监听路由参数变化 - 加载智能体和会话
  useEffect(() => {
    const loadRouteData = async () => {
      const agent_id = searchParams.get("agent_id") || "";
      const conversation_id = searchParams.get("conversation_id") || "";
      const from = searchParams.get("from") || "";

      let agent: Agent.State | undefined;
      let isMyAgent = false;

      if (from === "my" && agent_id) {
        try {
          const res = await agentsApi.my.detail(agent_id);
          if (res?.data) {
            agent = {
              ...res.data,
              custom_config_obj: res.data.custom_config
                ? JSON.parse(res.data.custom_config)
                : {},
              settings_obj: res.data.settings
                ? JSON.parse(res.data.settings)
                : {},
            } as Agent.State;
            isMyAgent = true;
          }
        } catch (err) {
          console.error("获取我的智能体详情失败:", err);
        }
      } else {
        // 获取探索列表
        const exploreList = await agentStore.loadAgentList();
        // 未登录时跳过我的智能体列表加载
        let myList: Agent.State[] = [];
        if (userStore.is_login) {
          try {
            myList = await agentStore.loadMyAgentList();
          } catch (err) {
            console.error("获取我的智能体列表失败:", err);
          }
        }

        // 先在我的列表查找，再在探索列表查找
        agent = myList.find((item) => item.agent_id === agent_id);
        if (agent) {
          isMyAgent = true;
        } else {
          agent = exploreList.find((item) => item.agent_id === agent_id);
          if (!agent) {
            agent = exploreList?.[0];
          }
        }
      }

      // 检查智能体是否为 Openclaw 类型（URL 参数或智能体属性）
      const isOpenclaw =
        searchParams.get("type") === "openclaw" ||
        agent?.custom_config_obj?.agent_type === AGENT_TYPES.OPENCLAW;

      // 更新 store - Openclaw 智能体和"我的智能体"一样隐藏底部操作
      if (isMyAgent || isOpenclaw) {
        setHideBottomActions(true);
      } else {
        setHideBottomActions(false);
      }

      // 设置 front-react 的 conversation store，让 useCurrentAgent 能找到 agent
      const actualAgentId = agent?.agent_id || agent_id;
      convStore.setCurrentState(actualAgentId, conversation_id);
    };

    loadRouteData();
  }, [searchParams]);

  // 监听 boxHeight 变化
  useEffect(() => {
    if (agentStore.boxHeight && boxRef.current) {
      boxRef.current.scrollTop = agentStore.boxHeight;
    }
  }, [agentStore.boxHeight]);

  const showUseCase = () => {
    chatRef.current?.showUseCase();
  };

  const hideUseCase = () => {
    chatRef.current?.hideUseCase();
  };

  const showShare = () => {
    chatRef.current?.showShare();
  };

  useImperativeHandle(
    ref,
    () => ({
      showUseCase,
      hideUseCase,
      showShare,
    }),
    [],
  );

  useEffect(() => {
    agentStore.loadCategorys();

    const handleLoginSuccess = () => {
      convStore.loadConversations();
    };

    eventBus.on(EVENT_NAMES.LOGIN_SUCCESS, handleLoginSuccess);

    return () => {
      convStore.clearCurrentState();
      eventBus.off(EVENT_NAMES.LOGIN_SUCCESS, handleLoginSuccess);
    };
  }, []);

  return (
    <section
      className={`h-full flex flex-col ${isWebsite ? "overflow-hidden pt-6" : ""}`}
    >
      {isWebsite && (
        <div className="relative flex-none flex items-center gap-4 px-4 w-11/12 mx-auto lg:w-4/5 mb-5">
          <Breadcrumb
            separator={<ArrowRightOutlined />}
            className="flex-1 w-0"
            items={[
              ...(navigationStore.homeNavigation?.menu_path
                ? [
                    {
                      title: (
                        <span
                          className="text-regular leading-6 font-normal hover-text-theme cursor-pointer"
                          onClick={() =>
                            navigate(navigationStore.homeNavigation.menu_path)
                          }
                        >
                          {t("module.index")}
                        </span>
                      ),
                    },
                  ]
                : []),
              ...(navigationStore.agentNavigation?.menu_path
                ? [
                    {
                      title: (
                        <span
                          className="text-regular leading-6 font-normal hover-text-theme cursor-pointer"
                          onClick={() =>
                            navigate(navigationStore.agentNavigation.menu_path)
                          }
                        >
                          {t("module.agent")}
                        </span>
                      ),
                    },
                  ]
                : []),
              {
                title: (
                  <span
                    className="text-primary leading-6 inline-block truncate max-w-[10em] md:max-w-[30rem]"
                    title={detailData.name}
                  >
                    {detailData.name}
                  </span>
                ),
              },
            ]}
          />
          {!isCompletion && (
            <Button type="link" onClick={showShare}>
              <SvgIcon name="share-two" size={18} color="#4F5052" stroke />
              {t("action.share")}
            </Button>
          )}
          <Button type="link" onClick={showUseCase}>
            <SvgIcon name="layout-split" size={18} />
            {t("chat.usage_guide")}
          </Button>
        </div>
      )}
      <div
        ref={boxRef}
        className={
          isWebsite ? "flex-1 px-4 overflow-y-auto" : "flex-1 overflow-y-auto"
        }
      >
        <div
          className={
            isWebsite ? "w-11/12 lg:w-4/5 mx-auto flex-1 h-full" : "h-full"
          }
        >
          {!isCompletion && (
            <ChatContainer
              ref={chatRef}
              agentId={agentId}
              conversationId={conversationId}
              hideBottomActions={hideBottomActions}
              useCaseFixed={isWebsite}
              showRecommend={isWebsite}
              hideMenuHeader={isWebsite}
              className="flex-1"
            />
          )}
          {/* Completion 模式 */}
          {isCompletion && (
            <ChatI18nProvider lang="zh-cn">
              <ChatProvider
                config={{
                  type: "agent",
                  title: currentAgent?.name || "Completion",
                  logo: currentAgent?.logo || "/images/default_agent.png",
                  features: { showRagStats: false },
                }}
                adapters={completionAdapters}
              >
                <CompletionView
                  agentId={agentId}
                  agentInfo={currentAgent}
                  features={{ languageSwitcher: isWebsite, guide: true, showRelatedScene: true }}
                  renderHeader={renderCompletionHeader}
                  onNextAgent={(item, parameters) => {
                    // 设置下一个智能体的准备参数
                    convStore.setNextAgentPrepare({
                      agent_id: item.agent_id,
                      execution_rule: item.execution_rule,
                      is_workflow: typeof item.is_workflow === 'boolean' ? item.is_workflow : true,
                      parameters,
                    });
                    // 切换到新智能体
                    convStore.setCurrentState(item.agent_id, '');
                    // 导航到新智能体
                    navigate({
                      pathname: "/chat",
                      search: `?agent_id=${item.agent_id}`,
                    });
                  }}
                  onInitAgent={() => {
                    // 同一个 agent 重新初始化，刷新页面
                    window.location.reload();
                  }}
                />
              </ChatProvider>
            </ChatI18nProvider>
          )}
        </div>
      </div>
    </section>
  );
});

ChatView.displayName = "ChatView";

export default ChatView;

export function ChatLayout() {
  return <Outlet />;
}