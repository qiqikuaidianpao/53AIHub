import { useMemo, forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChatProvider,
  ChatI18nProvider,
  ChatView,
  UsageGuide,
  type ChatViewRef,
  type ChatViewFeatures,
} from "@km/shared-business/chat";
import { useAgentStore, useCurrentAgent } from "@/stores/modules/agent";
import { useConversationStore } from "@/stores/modules/conversation";
import { useEnterpriseStore, useIsSoftStyle } from "@/stores/modules/enterprise";
import { useShortcutsStore } from "@/stores/modules/shortcuts";
import { conversationApiAdapter, agentApiAdapter } from "@/adapters/chat";
import { sharesApi } from "@/api/modules/shares";
import { t } from "@/locales";
import { buildUrl } from "@/utils/router";
import { Tooltip } from "antd";
import { LeftOutlined, CloseOutlined, DownOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import { AGENT_TYPES } from "@/constants/platform/config";
import AuthTagGroup from "@/components/AuthTagGroup";
import MoreDropdown from "@/components/MoreDropdown";
import AgentTooltip from "./chat/components/agent-tooltip";
import { ExpandSidebarButton } from "@/components/Layout/ExpandSidebarButton";
import { checkPermission as checkUserPermission } from "@/utils/permission";
import { getPublicPath } from "@/utils/config";
import uploadApi from "@/api/modules/upload";
import { API_HOST } from "@/api/host";

interface ChatContainerProps {
  agentId: string | number;  // 支持 string 类型（如 "U5KLWZ"）
  conversationId?: string | number;
  useCaseFixed?: boolean;
  showRecommend?: boolean;
  hideMenuHeader?: boolean;
  className?: string;
}

export interface ChatContainerRef {
  showUseCase: () => void;
  hideUseCase: () => void;
  showShare: () => void;
}

const DEFAULT_IMG = "/images/default_agent.png";

const ChatContainer = forwardRef<ChatContainerRef, ChatContainerProps>(
  (
    {
      agentId,
      conversationId,
      useCaseFixed = false,
      showRecommend = false,
      hideMenuHeader = false,
      className,
    },
    ref
  ) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const chatViewRef = useRef<ChatViewRef>(null);
    const agentStore = useAgentStore();
    const currentAgent = useCurrentAgent();
    const convStore = useConversationStore();
    const shortcutsStore = useShortcutsStore();
    const enterpriseStore = useEnterpriseStore();
    const isSoftStyle = useIsSoftStyle();

    const [showGuide, setShowGuide] = useState(false);

    // 当前会话
    const currentConversationId = useConversationStore((state) => state.current_conversationid);
    const conversations = useConversationStore((state) => state.conversations);

    const currentConv = useMemo(() => {
      const targetId = String(currentConversationId);
      return conversations.find((item) => String(item.conversation_id) === targetId);
    }, [conversations, currentConversationId]);

    // 是否为快捷方式
    const isShortcut = useMemo(() => {
      if (!currentAgent?.agent_id) return false;
      return shortcutsStore.isShortcut("agent", currentAgent.agent_id);
    }, [currentAgent?.agent_id, shortcutsStore]);

    // 判断是否为 Openclaw 智能体
    const isOpenclaw = useMemo(() => {
      // URL 参数优先
      if (searchParams.get("type") === "openclaw") return true;
      // 只有当 currentAgent 匹配当前 agentId 时才判断类型
      if (currentAgent?.agent_id === agentId && (currentAgent?.custom_config_obj?.agent_type === AGENT_TYPES.OPENCLAW || currentAgent?.model === "openclaw-ws")) {
        return true;
      }
      return false;
    }, [searchParams, currentAgent, agentId]);

    // 返回处理
    const handleBack = useCallback(() => {
      const from = searchParams.get("from");
      if (from === "my") {
        navigate({ pathname: "/agent", search: "?from=my" });
      } else {
        navigate("/agent");
      }
    }, [navigate, searchParams]);

    // 处理下一个智能体准备参数 - 用于 RelatedScene 的 field_mapping
    const handleNextAgent = useCallback((item: any, parameters: Record<string, string>) => {
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
      const isAgentOpenclaw = item.agent_type === AGENT_TYPES.OPENCLAW;
      if (isAgentOpenclaw) {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${item.agent_id}&hide_bottom_actions=true&type=openclaw`,
        });
      } else {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${item.agent_id}`,
        });
      }
    }, [convStore, navigate]);

    // 当跳转到同一个智能体时，重新初始化
    const handleInitAgent = useCallback(() => {
      // 重新加载当前智能体，清空消息列表
      chatViewRef.current?.reload();
    }, []);

    // 处理 next_agent_prepare - 自动填充输入或自动发送
    const nextAgentPrepare = useConversationStore((state) => state.next_agent_prepare);
    useEffect(() => {
      const prepare = nextAgentPrepare;
      if (prepare.agent_id) {
        const inputText = prepare.parameters?.input || "";
        if (inputText) {
          // 填充输入框
          chatViewRef.current?.setPrompt(inputText);
        }
        // 如果 execution_rule 是 auto，自动发送消息
        if (prepare.execution_rule === "auto" && inputText) {
          // 清空输入框后发送
          chatViewRef.current?.setPrompt("");
          chatViewRef.current?.sendMessage(inputText);
        }
        // 清空准备参数
        convStore.setNextAgentPrepare({});
      }
    }, [nextAgentPrepare, convStore]);

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

    // 图片错误处理
    const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
      const target = e.target as HTMLImageElement;
      const fallback = getPublicPath(DEFAULT_IMG);
      if (target.src.endsWith(fallback)) return;
      target.src = fallback;
    }, []);

    // 配置 features
    const features: ChatViewFeatures = useMemo(
      () => ({
        history: !isOpenclaw,
        newConversation: !isOpenclaw,
        languageSwitcher: false,
        fileUpload: currentAgent?.settings_obj?.file_parse?.enable || currentAgent?.settings_obj?.image_parse?.enable,
        guide: true,
        share: !isOpenclaw,
        agentTooltip: true,
        messageMenu: true,
        skipInitialLoad: !isOpenclaw,
        showRecommend: showRecommend,
        enableDragUpload: true,
        allowMultiple: true,
        openclaw: isOpenclaw,
        showRelatedScene: true,
        allowSendWithFiles: ["53ai_agent", "fastgpt_agent"].includes(currentAgent?.custom_config_obj?.agent_type),
        enablePasteUpload: true,
      }),
      [currentAgent, isSoftStyle, isOpenclaw, showRecommend]
    );

    // 推荐智能体列表（用于 Recommend Panel）
    const recommendAgents = useMemo(() => {
      return agentStore.agentList
        .filter((item) => item.agent_id !== currentAgent?.agent_id)
        .slice(0, 4);
    }, [agentStore.agentList, currentAgent]);

    // 推荐智能体选择回调
    const handleRecommendAgentSelect = useCallback((agent: any) => {
      const isAgentOpenclaw = agent.custom_config_obj?.agent_type === AGENT_TYPES.OPENCLAW;
      if (isAgentOpenclaw) {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${agent.agent_id}&hide_bottom_actions=true&type=openclaw`,
        });
      } else {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${agent.agent_id}`,
        });
      }
    }, [navigate]);

    // 文件上传函数
    const uploadRequest = useCallback(async (file: File) => {
      const res = await uploadApi.upload(file, "my_uploads");
      return {
        id: res.data.id,
        url: `${API_HOST}/api/preview/${res.data.preview_key || ""}`,
        name: res.data.file_name,
        size: res.data.size,
        mime_type: res.data.mime_type,
        preview_key: res.data.preview_key,
      };
    }, []);

    // 文件类型过滤
    const acceptTypes = useMemo(() => {
      let accept = "";
      const settingsObj = currentAgent?.settings_obj || {};
      if (settingsObj.file_parse?.enable) {
        accept += ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.html,.json,.xml,.md";
      }
      if (settingsObj.image_parse?.enable) {
        accept += ",image/*";
      }
      return accept || "*/*";
    }, [currentAgent]);

    // 分享回调
    const handleShare = async (
      messageIds: (string | number)[],
      convId: string | number,
      selectAll: boolean
    ): Promise<string> => {
      const res = await sharesApi.create({
        message_ids: messageIds,
        conversation_id: convId,
        select_all: selectAll,
      });
      const link = buildUrl(`/share/chat?share_id=${res.share_id}&from=agent`);
      return link;
    };

    // 智能体选择回调
    const handleAgentSelect = (agent: any) => {
      const isAgentOpenclaw = agent.custom_config_obj?.agent_type === AGENT_TYPES.OPENCLAW;
      if (isAgentOpenclaw) {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${agent.agent_id}&hide_bottom_actions=true&type=openclaw`,
        });
      } else {
        navigate({
          pathname: "/chat",
          search: `?agent_id=${agent.agent_id}`,
        });
      }
    };

    // 权限检查回调
    const handleCheckPermission = (userGroupIds?: number[]): boolean => {
      return checkUserPermission({
        groupIds: userGroupIds || [],
      });
    };

    useImperativeHandle(ref, () => ({
      showUseCase: () => chatViewRef.current?.reload(),
      hideUseCase: () => {},
      showShare: () => {},
    }));

    // Plugin 配置
    const pluginConfig = useMemo(
      () => ({
        type: "agent" as const,
        title: currentAgent?.name || "Chat",
        logo: currentAgent?.logo || DEFAULT_IMG,
        features: {
          showRagStats: true,
          showFileUpload: features.fileUpload,
          showConversationList: features.history,
        },
      }),
      [currentAgent, features]
    );

    // Adapters 配置
    const adapters = useMemo(
      () => ({
        conversationApi: conversationApiAdapter,
        agentApi: agentApiAdapter,
        uploadApi: {
          upload: async (file: File) => {
            const res = await uploadApi.upload(file);
            return {
              id: res.data.id,
              url: `${API_HOST}/api/preview/${res.data.preview_key || ""}`,
              name: res.data.file_name,
              size: res.data.size,
              mime_type: res.data.mime_type,
              preview_key: res.data.preview_key,
            };
          },
        },
        workflowApi: {
          run: async () => {
            throw new Error("Not implemented");
          },
        },
      }),
      []
    );

    // 自定义 Header - 使用原来的样式
    const renderHeader = useCallback(
      ({ agentInfo }: { agentInfo: any; lang: string; setLang: (lang: string) => void }) => {
        if (hideMenuHeader) return null;

        return (
          <header className="flex-none h-[70px] border-b sticky top-0 z-10 bg-white">
            <div className="mx-auto px-4 flex items-center justify-between h-full">
              <div className="flex-1 flex items-center gap-2 overflow-hidden">
                <ExpandSidebarButton />
                {isSoftStyle && (
                  <div
                    className="flex-none size-7 rounded-md flex-center cursor-pointer max-md:hidden hover:bg-[#ECEDEE]"
                    onClick={handleBack}
                  >
                    <LeftOutlined className="text-regular cursor-pointer" />
                  </div>
                )}
                <div
                  className="text-base text-primary line-clamp-1 max-md:flex-1 max-md:text-center"
                  title={currentConv?.title || agentInfo?.name || ""}
                >
                  {currentConv?.title || agentInfo?.name || ""}
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
                    className="h-6 px-1 rounded flex-center gap-1 cursor-pointer hover:bg-[#E1E2E3]"
                    onClick={() => setShowGuide(true)}
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
      [hideMenuHeader, isSoftStyle, handleBack, currentConv, navigate, showGuide, isShortcut, handleMore]
    );

    return (
      <ChatI18nProvider lang="zh-cn">
        <ChatProvider config={pluginConfig} adapters={adapters}>
          <div className={`flex h-full ${showGuide && currentAgent ? "gap-0" : ""}`}>
            {/* 聊天区域 */}
            <div className={`flex-1 flex flex-col overflow-hidden ${showGuide && currentAgent ? "border-r" : ""}`}>
              <ChatView
                ref={chatViewRef}
                agentId={agentId}
                initialConversationId={conversationId}
                features={features}
                agentInfo={currentAgent ? {
                  agent_id: currentAgent.agent_id,
                  name: currentAgent.name,
                  logo: currentAgent.logo,
                  description: currentAgent.description,
                  custom_config_obj: currentAgent.custom_config_obj,
                  settings_obj: currentAgent.settings_obj,
                  use_cases: currentAgent.use_cases,
                  user_group_ids: currentAgent.user_group_ids,
                } : undefined}
                onShare={handleShare}
                renderHeader={renderHeader}
                renderAgentSelector={features.agentTooltip ? ({ agentInfo }) => (
                  <AgentTooltip onSelect={handleAgentSelect}>
                    <div className="h-8 px-2 rounded-full flex items-center gap-1.5 bg-[#F1F2F3] cursor-pointer hover:bg-[#E1E2E3]">
                      <img
                        className="w-4 h-4 rounded-full"
                        src={agentInfo.logo || DEFAULT_IMG}
                        alt={agentInfo.name}
                      />
                      <span className="text-sm text-[#1F2123] line-clamp-1 max-w-[120px]">
                        {agentInfo.name}
                      </span>
                      <DownOutlined style={{ color: "#333333", fontSize: "12px" }} />
                    </div>
                  </AgentTooltip>
                ) : undefined}
                renderAuthTags={(userGroupIds) => (
                  <AuthTagGroup value={userGroupIds} />
                )}
                checkPermission={handleCheckPermission}
                recommendAgents={recommendAgents}
                onRecommendAgentSelect={handleRecommendAgentSelect}
                onNextAgent={handleNextAgent}
                onInitAgent={handleInitAgent}
                uploadRequest={uploadRequest}
                acceptTypes={acceptTypes}
                renderCopyright={() => (
                  enterpriseStore.copyright?.toLowerCase() !== "true" ? (
                    <div className="flex justify-center items-center my-2" />
                  ) : null
                )}
              />
            </div>
            {/* 使用指引右侧面板 */}
            {showGuide && currentAgent && (
              <div className="flex-none w-[450px] flex flex-col bg-white overflow-hidden">
                <div className="min-h-[70px] flex items-center justify-between px-5 border-b">
                  <h4 className="text-lg text-primary">{t("chat.usage_guide")}</h4>
                  <div
                    className="flex-center size-6 rounded cursor-pointer hover:bg-[#ECEDEE]"
                    onClick={() => setShowGuide(false)}
                  >
                    <CloseOutlined />
                  </div>
                </div>
                <UsageGuide useCases={currentAgent.use_cases} showChannel={isOpenclaw} />
              </div>
            )}
          </div>
        </ChatProvider>
      </ChatI18nProvider>
    );
  }
);

ChatContainer.displayName = "ChatContainer";

export default ChatContainer;