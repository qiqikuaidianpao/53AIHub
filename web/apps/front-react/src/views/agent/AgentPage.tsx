import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { useAgentStore } from "@/stores/modules/agent";
import { useConversationStore } from "@/stores/modules/conversation";
import { SvgIcon } from "@km/shared-components-react";
import { Tooltip, Button } from "antd";
import { t } from "@/locales";
import ExploreAgent from "./components/ExploreAgent";
import MyAgent from "./components/MyAgent";
import AgentHistory from "./components/history";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";

export function AgentPage() {
  const navigate = useNavigate();
  const isSoftStyle = useIsSoftStyle();
  const agentStore = useAgentStore();
  const convStore = useConversationStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showHistory, setShowHistory] = useState(false);
  const [siderVisible, setSiderVisible] = useState(true);
  const [activeType, setActiveType] = useState("explore");

  const toggleSider = () => {
    setSiderVisible(!siderVisible);
  };

  const handleNewChat = () => {
    navigate('/chat');
  };

  const handleSetActiveType = (type: string) => {
    setActiveType(type)
    setSearchParams({ from: type})
  } 

  // 首次加载
  useEffect(() => {
    // Preload both lists
    agentStore.loadCategorys();
    agentStore.loadAgentList();
    agentStore.loadMyAgentList();
    // Load conversation history
    convStore.loadConversations();
  }, []);

  // 响应 URL 参数变化切换 tab
  useEffect(() => {
    if (searchParams.get("from") === "my") {
      setActiveType("my");
    }
  }, [searchParams]);

  return (
    <div className="size-full flex">
      {showHistory && (
        <AgentHistory
          className="w-60"
          onCollapse={() => setShowHistory(false)}
          onNewChat={handleNewChat}
        />
      )}
      <div
        className={`w-full flex-1 flex flex-col ${isSoftStyle ? "overflow-y-auto" : ""}`}
      >
        {isSoftStyle && (
          <Header
            back={false}
            title={""}
            border={false}
            beforePrefix={
              !siderVisible && (
                <>
                  <Tooltip title={t("action.expand")}>
                    <div
                      className="size-5 flex-center cursor-pointer"
                      onClick={toggleSider}
                    >
                      <SvgIcon name="double-right" />
                    </div>
                  </Tooltip>
                  <div className="h-4 border-l mx-2" />
                </>
              )
            }
            titlePrefix={
              !showHistory && (
                <>
                  <div className="flex-none flex items-center gap-3">
                    <div
                      className="size-7 cursor-pointer rounded flex items-center justify-center hover:bg-[#F5F5F7]"
                      onClick={() => {
                        setShowHistory(true)
                        // 刷新会话列表
                        convStore.loadConversations()
                      }}
                    >
                      <SvgIcon name="history" />
                    </div>
                  </div>
                </>
              )
            }
          />
        )}
        <div className="w-11/12 lg:w-4/5 max-w-[1200px] mx-auto">
          <div
            className={`sticky z-[100] bg-white w-full flex gap-3 ${isSoftStyle ? "h-9 top-16 items-center" : "h-[66px] top-0 items-end"}`}
          >
            <Button
              type="link"
              className={`text-xl py-4 px-0 ${activeType === "explore" ? "font-bold" : "text-[#999999]"}`}
              onClick={() => handleSetActiveType("explore")}
            >
              {t("agent.explore")}
              {activeType === "explore" && (
                <SvgIcon
                  name="explore"
                  size="20"
                  color="var(--el-color-primary, #2563eb)"
                  className="relative left-1 -top-1"
                />
              )}
            </Button>
            <Button
              type="link"
              className={`text-xl py-4 px-0 ${activeType === "my" ? "font-bold" : "text-[#999999]"}`}
              onClick={() => handleSetActiveType("my")}
            >
              {t("module.mine")}
              {activeType === "my" && (
                <SvgIcon
                  name="explore"
                  size="20"
                  color="var(--el-color-primary, #2563eb)"
                  className="relative left-1 -top-1"
                />
              )}
            </Button>
          </div>
          {activeType === "explore" && <ExploreAgent />}
          {activeType === "my" && <MyAgent />}
        </div>
        <Footer />
      </div>
    </div>
  );
}

export default AgentPage;
