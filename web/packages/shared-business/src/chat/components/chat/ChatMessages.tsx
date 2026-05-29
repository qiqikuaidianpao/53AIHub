import { memo, useEffect, useRef, useCallback } from "react";
import { Checkbox } from "antd";
import { BubbleList, BubbleAssistant, BubbleUser, type BubbleListRef } from "@km/hub-ui-x-react";
import Welcome from "../Welcome";
import RelatedScene from "../related-scene/RelatedScene";
import { useTranslation } from "../../i18n";
import type { IAgentInfo } from "../../adapters/types";
import type { Message, SkillRunItem } from "../../types";

const DEFAULT_IMG = "/images/default_agent.png";

function handleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const target = e.target as HTMLImageElement;
  if (target.src.endsWith(DEFAULT_IMG)) return;
  target.src = DEFAULT_IMG;
}

export interface ChatMessagesProps {
  messageList: Message[];
  agentInfo: IAgentInfo;
  isStreaming: boolean;
  onSuggestionClick?: (content: string) => void;
  /** 分享模式 */
  isShareMode?: boolean;
  /** 选中的消息 ID 列表 */
  selectedMessageIds?: (string | number)[];
  /** 全选状态 */
  selectAll?: boolean;
  /** 消息选择回调 */
  onMessageSelect?: (msg: Message) => void;
  /** 全选回调 */
  onSelectAll?: () => void;
  /** 消息菜单渲染函数 */
  renderMessageMenu?: (type: "user" | "assistant", msg: Message) => React.ReactNode;
  /** 技能运行项渲染函数 */
  renderSkillRunItems?: (items: SkillRunItem[]) => React.ReactNode;
  /** 欢迎页 AuthTags 渲染函数 */
  renderAuthTags?: (userGroupIds: number[]) => React.ReactNode;
  /** 是否显示推荐面板 */
  showRecommend?: boolean;
  /** 推荐智能体列表 */
  recommendAgents?: IAgentInfo[];
  /** 推荐智能体选择回调 */
  onRecommendAgentSelect?: (agent: IAgentInfo) => void;
  /** 下一个智能体回调 - 用于 RelatedScene */
  onNextAgent?: (item: any, parameters: Record<string, string>) => void;
  /** 重新初始化当前智能体回调 - 当跳转到同一智能体时触发 */
  onInitAgent?: () => void;
  /** Openclaw 模式 */
  openclaw?: boolean;
  /** 显示相关场景 */
  showRelatedScene?: boolean;
}

function ChatMessagesInner({
  messageList,
  agentInfo,
  isStreaming,
  onSuggestionClick,
  isShareMode = false,
  selectedMessageIds = [],
  selectAll = false,
  onMessageSelect,
  onSelectAll,
  renderMessageMenu,
  renderSkillRunItems,
  renderAuthTags,
  showRecommend = false,
  recommendAgents,
  onRecommendAgentSelect,
  onNextAgent,
  onInitAgent,
  openclaw = false,
  showRelatedScene = false,
}: ChatMessagesProps) {
  const { t } = useTranslation();
  const bubbleListRef = useRef<BubbleListRef>(null);
  const showWelcome = messageList.length === 0;
  const lastMessageId = messageList.length > 0 ? messageList[messageList.length - 1]?.id : undefined;

  useEffect(() => {
    bubbleListRef.current?.scrollToBottom();
  }, [messageList.length]);

  const handleMessageClick = useCallback((msg: Message) => {
    if (isShareMode && onMessageSelect) {
      onMessageSelect(msg);
    }
  }, [isShareMode, onMessageSelect]);

  return (
    <main className="flex-1 py-4 overflow-hidden flex relative">
      <BubbleList
        ref={bubbleListRef}
        messages={messageList}
        autoScroll
        className="flex-1"
        mainClass={showRecommend ? "w-[95%]" : "w-11/12 md:w-4/5 max-w-[800px] mx-auto"}
      >
        {showWelcome && (
          <Welcome
            agentInfo={agentInfo}
            onSuggestion={onSuggestionClick}
            renderAuthTags={renderAuthTags}
          />
        )}
        {openclaw && messageList.length === 0 && (
          <div className="max-w-[520px] mt-5 mb-3 px-4 py-2 bg-[#F4F5F7] rounded-xl">
            {t("chat.openclaw_welcome_hint")}
          </div>
        )}

        {messageList.map((msg, index) => (
          <div key={msg.id}>
            {/* User Message */}
            <div
              className={`flex items-center gap-5 rounded-lg ${isShareMode ? "mb-4 px-3 py-4 bg-[#F5F5F5]" : ""}`}
              onClick={() => handleMessageClick(msg)}
            >
              {isShareMode && (
                <Checkbox checked={selectedMessageIds.includes(msg.id)} />
              )}
              <div className="flex-1 flex justify-end">
                <BubbleUser
                  content={msg.question || ""}
                  files={msg.uploaded_files || msg.specified_files}
                  menu={
                    !isShareMode && renderMessageMenu
                      ? renderMessageMenu("user", msg)
                      : undefined
                  }
                />
              </div>
            </div>

            {/* Skill Run Items */}
            {msg.skillRunItems && msg.skillRunItems.length > 0 && renderSkillRunItems && (
              <div className="mb-4">
                {renderSkillRunItems(msg.skillRunItems)}
              </div>
            )}

            {/* Assistant Message */}
            <div
              className={`flex items-center gap-5 rounded-lg ${isShareMode ? "mb-4 px-3 py-4 bg-[#F5F5F5]" : ""}`}
              onClick={() => handleMessageClick(msg)}
            >
              {isShareMode && (
                <Checkbox checked={selectedMessageIds.includes(msg.id)} />
              )}
              <div className="flex-1">
                <BubbleAssistant
                  content={msg.answer || ""}
                  streaming={msg.loading || (isStreaming && msg.id === lastMessageId)}
                  reasoning={msg.reasoning_content}
                  reasoningExpanded={msg.reasoning_expanded}
                  avatar={agentInfo?.logo}
                  name={agentInfo?.name}
                  alwaysShowMenu={index === messageList.length - 1}
                  menu={
                    !msg.loading && !isShareMode && renderMessageMenu
                      ? renderMessageMenu("assistant", msg)
                      : undefined
                  }
                />
              </div>
            </div>

            {/* Related Scene - 只在最后一条消息后显示 */}
            {index === messageList.length - 1 &&
              !msg.loading &&
              !isStreaming &&
              !isShareMode &&
              showRelatedScene && (
                <RelatedScene
                  output={msg.answer || ""}
                  relateAgents={agentInfo?.settings_obj?.relate_agents}
                  currentAgentId={agentInfo?.agent_id}
                  onNextAgent={onNextAgent}
                  onInitAgent={onInitAgent}
                />
              )}

          </div>
        ))}
      </BubbleList>

      {/* Recommend Panel */}
      {showRecommend && recommendAgents && recommendAgents.length > 0 && (
        <div className={`flex-none w-2/6 flex flex-col gap-4 pb-5 ${isShareMode ? "-mt-[70px]" : ""}`}>
          <h2 className="flex-none text-base font-semibold text-regular">
            {t("common.related_agent") || "相关智能体"}
          </h2>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5">
            {recommendAgents.map((agent) => (
              <div
                key={agent.agent_id}
                className="flex-none h-24 border rounded p-4 cursor-pointer hover:bg-[#F1F2F3]"
                onClick={() => onRecommendAgentSelect?.(agent)}
              >
                <div className="flex items-center gap-2">
                  <img
                    className="size-6 rounded-full"
                    src={agent.logo || DEFAULT_IMG}
                    alt={agent.name}
                    onError={handleImageError}
                  />
                  <span className="text-sm text-primary">{agent.name}</span>
                </div>
                <div
                  className="text-sm text-regular line-clamp-2 mt-1.5"
                  title={agent.description || ""}
                >
                  {agent.description || t("chat.no_description") || "暂无描述"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

const ChatMessages = memo(ChatMessagesInner);
ChatMessages.displayName = "ChatMessages";

export default ChatMessages;
