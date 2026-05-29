import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Collapse, message, Tooltip } from "antd";
import {
  EditOutlined,
  CopyOutlined,
  SyncOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { useAgentFormStore } from "./store";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import PreviewPanel from "./Preview";
import EditBasicInfo from "../components/EditBasicInfo";
import Guide from "./Guide";
import agentsApi from "@/api/modules/agents";
import { api_host } from "@/utils/config";
import { copyToClip, getSimpleDateFormatString } from "@km/shared-utils";
import { t } from "@/locales";
import { getPublicPath } from "@/utils/config";
import Header from "@/components/Layout/Header";
import "./index.css";

export function AgentCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const agentFormStore = useAgentFormStore();
  const isSoftStyle = useIsSoftStyle();
  const isWebsite = !isSoftStyle;

  const [latestTime, setLatestTime] = useState("");
  const [basicInfoDialogVisible, setBasicInfoDialogVisible] = useState(false);
  const [activeCollapse, setActiveCollapse] = useState([
    "config",
    "process",
    "usage",
  ]);

  const [formInfo, setFormInfo] = useState({
    name: "",
    description: "",
    logo: "",
    platform: "openclaw",
  });

  const [botConfig, setBotConfig] = useState({
    botId: "",
    secret: "",
    wsUrl: `ws://${api_host.replace("https://", "").replace("http://", "")}/api/v1/openclaw/ws/connect`,
  });

  const platformLabel = useMemo(() => {
    const map: Record<string, string> = {
      openclaw: "Openclaw",
    };
    return map[formInfo.platform] || formInfo.platform;
  }, [formInfo.platform]);

  const configText = useMemo(
    () =>
      `Bot ID：${botConfig.botId}\nSecret：${botConfig.secret}\nWS Url：${botConfig.wsUrl}`,
    [botConfig],
  );

  const editFormData = useMemo(
    () => ({
      name: formInfo.name,
      description: formInfo.description,
      logo: formInfo.logo,
    }),
    [formInfo],
  );

  const handleCustomBack = () => {
    navigate({ pathname: "/agent", search: "?from=my" });
  };

  const handleEditName = () => {
    setBasicInfoDialogVisible(true);
  };

  const handleBasicInfoSave = (data: {
    name: string;
    description: string;
    logo: string;
  }) => {
    setFormInfo((prev) => ({
      ...prev,
      name: data.name,
      description: data.description,
      logo: data.logo,
    }));
  };

  const resetSecret = async () => {
    try {
      const data = await agentsApi.my.resetSecret(agentFormStore.agent_id);
      setBotConfig((prev) => ({ ...prev, secret: data.secret }));
    } catch (error) {
      // Ignore
    }
  };

  const handleCopy = async (text: string) => {
    const success = await copyToClip(text);
    if (success) {
      message.success(t("action.copy_success"));
    }
  };

  const handleSave = async () => {
    const agentId = agentFormStore.agent_id;
    if (!agentId) {
      message.error(t("agent.id_not_exist"));
      return;
    }

    try {
      const data = await agentsApi.my.update(agentId, {
        name: formInfo.name,
        description: formInfo.description,
        logo: formInfo.logo,
        use_cases: JSON.stringify(agentFormStore.form_data.use_cases),
        custom_config: JSON.stringify({
          openclaw_app_secret: botConfig.secret,
        }),
      });
      setLatestTime(
        getSimpleDateFormatString({
          date: data.updated_time,
          format: "YYYY-MM-DD hh:mm",
        }),
      );
      message.success(t("agent.save_success"));
    } catch (error: any) {
      console.error("Save failed:", error);
    }
  };

  const handleEditInit = async () => {
    const agentId = searchParams.get("agent_id") || searchParams.get("id") || "";
    if (agentId) {
      agentFormStore.setAgentId(agentId);
      try {
        const res = await agentsApi.my.detail(agentId);
        const data = res.data || res;
        if (data) {
          setFormInfo({
            name: data.name || "",
            description: data.description || "",
            logo: data.logo || "",
            platform: "openclaw",
          });

          setLatestTime(
            getSimpleDateFormatString({
              date: data.updated_time,
              format: "YYYY-MM-DD hh:mm",
            }),
          );

          setBotConfig((prev) => ({
            ...prev,
            botId: data.bot_id || "",
          }));

          if (data.custom_config) {
            try {
              const customConfig =
                typeof data.custom_config === "string"
                  ? JSON.parse(data.custom_config)
                  : data.custom_config;
              if (customConfig.openclaw_app_secret) {
                setBotConfig((prev) => ({
                  ...prev,
                  secret: customConfig.openclaw_app_secret,
                }));
              }
            } catch (e) {
              console.error("Parse custom_config failed:", e);
            }
          }

          if (data.use_cases) {
            try {
              const useCases =
                typeof data.use_cases === "string"
                  ? JSON.parse(data.use_cases)
                  : data.use_cases;
              agentFormStore.setFormData({ use_cases: useCases });
            } catch (e) {
              console.error("Parse use_cases failed:", e);
            }
          }
        }
      } catch (error: any) {
        console.error("Fetch agent detail failed:", error);
        const status = error?.response?.status || error?.status;
        if (status === 404) {
          message.error(t("agent.not_found"));
        } else if (status === 403) {
          message.error(t("agent.not_owner"));
        } else {
          message.error(t("agent.fetch_failed"));
        }
      }
    }
  };

  useEffect(() => {
    handleEditInit();
  }, []);

  return (
    <div
      className={`h-full flex flex-col overflow-hidden ${isWebsite ? "w-11/12 lg:w-4/5 mx-auto flex-1" : "bg-[#F7F7FA]"}`}
    >
      <Header
        className="h-[88px] !bg-[#F7F7FA]"
        back
        titlePrefix={
          formInfo.logo ? (
            <img
              src={formInfo.logo}
              className="size-9 rounded-lg object-cover mr-2"
              alt="logo"
              onError={(e) => {
                (e.target as HTMLImageElement).src = getPublicPath(
                  "/images/default-logo.png",
                );
              }}
            />
          ) : undefined
        }
        titleSuffix={
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="">{formInfo.name}</span>
              <EditOutlined
                className="cursor-pointer text-[#999] hover:text-[#666]"
                style={{ fontSize: 14 }}
                onClick={handleEditName}
              />
            </div>
            <div className="flex items-center gap-2 text-sm max-w-[200px]">
              <span className="text-xs text-[#999] truncate">
                {formInfo.description || t("agent.no_desc")}
              </span>
              <span className="px-2 py-0.5 bg-white rounded text-[#666] text-xs">
                {platformLabel}
              </span>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#999]">
              {t("agent.recently_saved")}：{latestTime}
            </span>
            <Button type="primary" onClick={handleSave}>
              {t("agent.publish")}
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-2"></div>
      </Header>

      <div className="flex overflow-hidden flex-1">
        {/* Config panel */}
        <div className="flex-1 w-1/2 flex flex-col overflow-auto">
          <div className="px-[18px] py-4">{t("agent.app_config")}</div>
          <Collapse
            activeKey={activeCollapse}
            ghost
            onChange={(keys) => setActiveCollapse(keys as string[])}
            expandIconPosition="start"
            className={isWebsite ? "" : "agent-collapse"}
            items={[
              {
                key: "config",
                label: t("agent.access_config"),
                children: (
                  <div className="space-y-4 px-2">
                    {/* Bot ID */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-20 shrink-0">
                        <span className="text-sm text-[#333]">Bot ID</span>
                        <Tooltip title={t("agent.bot_id_tooltip")}>
                          <QuestionCircleOutlined
                            className="text-[#999] cursor-pointer"
                            style={{ fontSize: 14 }}
                          />
                        </Tooltip>
                      </div>
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-[#E9EBF2] rounded">
                        <span className="text-sm text-[#333] flex-1">
                          {botConfig.botId}
                        </span>
                        <Tooltip title={t("action.copy")}>
                          <CopyOutlined
                            className="cursor-pointer text-[#999] hover:text-[#666]"
                            style={{ fontSize: 16 }}
                            onClick={() => handleCopy(botConfig.botId)}
                          />
                        </Tooltip>
                      </div>
                    </div>
                    {/* Secret */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-20 shrink-0">
                        <span className="text-sm text-[#333]">Secret</span>
                        <Tooltip title={t("agent.secret_tooltip")}>
                          <QuestionCircleOutlined
                            className="text-[#999] cursor-pointer"
                            style={{ fontSize: 14 }}
                          />
                        </Tooltip>
                      </div>
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-[#E9EBF2] rounded">
                        <span className="text-sm text-[#333] flex-1 font-mono">
                          {botConfig.secret}
                        </span>
                        <Tooltip title={t("action.reset")}>
                          <SyncOutlined
                            className="cursor-pointer text-[#999] hover:text-[#666]"
                            style={{ fontSize: 16 }}
                            onClick={resetSecret}
                          />
                        </Tooltip>
                        <Tooltip title={t("action.copy")}>
                          <CopyOutlined
                            className="cursor-pointer text-[#999] hover:text-[#666]"
                            style={{ fontSize: 16 }}
                            onClick={() => handleCopy(botConfig.secret)}
                          />
                        </Tooltip>
                      </div>
                    </div>
                    {/* WS Url */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 w-20 shrink-0">
                        <span className="text-sm text-[#333]">WS Url</span>
                        <Tooltip title={t("agent.ws_url_tooltip")}>
                          <QuestionCircleOutlined
                            className="text-[#999] cursor-pointer"
                            style={{ fontSize: 14 }}
                          />
                        </Tooltip>
                      </div>
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-[#E9EBF2] rounded">
                        <span className="text-sm text-[#333] flex-1">
                          {botConfig.wsUrl}
                        </span>
                        <Tooltip title={t("action.copy")}>
                          <CopyOutlined
                            className="cursor-pointer text-[#999] hover:text-[#666]"
                            style={{ fontSize: 16 }}
                            onClick={() => handleCopy(botConfig.wsUrl)}
                          />
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "process",
                label: t("agent.access_process"),
                children: (
                  <div className="space-y-6 px-2">
                    {/* Step 1 */}
                    <div>
                      <p className="text-sm text-[#9CA3AF] mb-2">
                        {t("agent.step1_install_plugin")}
                      </p>
                      <div className="flex items-center gap-2 rounded px-3 py-2 bg-[#F5F5F7]">
                        <code className="flex-1 text-sm text-[#333] font-mono">
                          npm install @53ai/53ai-openclaw
                        </code>
                        <Tooltip title={t("action.copy")}>
                          <CopyOutlined
                            className="cursor-pointer text-[#999] hover:text-[#666]"
                            onClick={() =>
                              handleCopy("npm install @53ai/53ai-openclaw")
                            }
                          />
                        </Tooltip>
                      </div>
                    </div>
                    {/* Step 2 */}
                    <div>
                      <p className="text-sm text-[#9CA3AF] mb-2">
                        {t("agent.step2_config_secret")}
                      </p>
                      <div className="flex gap-2 px-3 py-2 bg-[#F5F5F7]">
                        <div className="flex-1 rounded space-y-3">
                          <div className="text-sm text-[#333]">
                            Bot ID：{botConfig.botId}
                          </div>
                          <div className="text-sm text-[#333]">
                            Secret：{botConfig.secret}
                          </div>
                          <div className="text-sm text-[#333]">
                            WS Url：{botConfig.wsUrl}
                          </div>
                        </div>
                        <div className="flex justify-end mt-2">
                          <Tooltip title={t("action.copy")}>
                            <CopyOutlined
                              className="cursor-pointer text-[#999] hover:text-[#666]"
                              onClick={() => handleCopy(configText)}
                            />
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                    {/* Step 3 */}
                    <div>
                      <p className="text-sm text-[#9CA3AF] mb-2">
                        {t("agent.step3_restart_service")}
                      </p>
                      <div className="flex items-center gap-2 rounded px-3 py-2 bg-[#F5F5F7]">
                        <code className="flex-1 text-sm text-[#333]">
                          openclaw gateway restart
                        </code>
                        <Tooltip title={t("action.copy")}>
                          <CopyOutlined
                            className="cursor-pointer text-[#999] hover:text-[#666]"
                            onClick={() =>
                              handleCopy("openclaw gateway restart")
                            }
                          />
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                key: "usage",
                label: t("agent.usage_guide_title"),
                children: (
                  <div className="space-y-3 px-2">
                    <Guide
                      use_cases={agentFormStore.form_data.use_cases}
                      onChange={(useCases) =>
                        agentFormStore.setFormData({ use_cases: useCases })
                      }
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* Preview panel */}
        <div className="flex-1 w-1/2 overflow-hidden">
          <PreviewPanel />
        </div>
      </div>

      {/* Edit basic info dialog */}
      <EditBasicInfo
        visible={basicInfoDialogVisible}
        data={editFormData}
        onClose={() => setBasicInfoDialogVisible(false)}
        onSave={handleBasicInfoSave}
      />
    </div>
  );
}

export default AgentCreate;
