import { useState, useEffect } from "react";
import { Drawer, Input, Button, message, Spin } from "antd";
import CodeMirror from "@uiw/react-codemirror";
import { t } from "@/locales";
import { graphTemplatesApi } from "@/api";
import { getRealPath } from "@/utils/config";

interface CreateDrawerProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onNext: (data: { type: string; data: any }) => void;
}

const tabs = [
  {
    id: "auto",
    title: t("graph_template.auto_generate"),
    desc: t("graph_template.auto_generate_desc"),
  },
  {
    id: "import",
    title: t("graph_template.template_import"),
    desc: t("graph_template.template_import_desc"),
  },
  {
    id: "manual",
    title: t("graph_template.manual_create"),
    desc: t("graph_template.manual_create_desc"),
  },
];

export function CreateDrawer({
  open,
  loading,
  onClose,
  onNext,
}: CreateDrawerProps) {
  const [activeTab, setActiveTab] = useState("auto");
  const [formData, setFormData] = useState({
    sceneDesc: "",
    jsonTemplate: "{\n  \n}",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab("auto");
      setFormData({
        sceneDesc: "",
        jsonTemplate: "{\n  \n}",
      });
    }
  }, [open]);

  const handleTabClick = (tabId: string) => {
    if (tabId === "manual") {
      onNext({ type: "manual", data: null });
      return;
    }
    setActiveTab(tabId);
  };

  const handleNext = async () => {
    let currentJsonTemplate = formData.jsonTemplate;

    if (activeTab === "auto") {
      if (!formData.sceneDesc.trim()) {
        message.warning(t("graph_template.scene_desc_placeholder"));
        return;
      }
      const len = formData.sceneDesc.trim().length;
      if (len < 40 || len > 8000) {
        message.warning(t("graph_template.scene_desc_length_invalid"));
        return;
      }
    } else if (activeTab === "import") {
      if (!formData.jsonTemplate.trim()) {
        message.warning(t("graph_template.json_template_placeholder"));
        return;
      }
      try {
        // 预处理JSON字符串：移除markdown代码块标记、清理首尾空白
        let jsonStr = formData.jsonTemplate.trim();
        jsonStr = jsonStr
          .replace(/^```(?:json)?\s*\n?/i, "")
          .replace(/\n?```\s*$/i, "");
        jsonStr = jsonStr.trim();

        const parsed = JSON.parse(jsonStr);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Invalid JSON Object");
        }
        if (Object.keys(parsed).length === 0) {
          message.warning(t("graph_template.json_template_empty"));
          return;
        }
        // 更新处理后的JSON
        currentJsonTemplate = jsonStr;
        setFormData((prev) => ({ ...prev, jsonTemplate: jsonStr }));
      } catch (e) {
        message.error(t("graph_template.invalid_json"));
        return;
      }
    }

    let finalJsonTemplate = currentJsonTemplate;

    if (activeTab === "auto" || activeTab === "import") {
      const content =
        activeTab === "auto" ? formData.sceneDesc : currentJsonTemplate;

      setIsLoading(true);
      try {
        const res = await graphTemplatesApi.suggestTemplateParams({ content });
        if (res) {
          const resObj = typeof res === "string" ? JSON.parse(res) : res;

          const transformedData = {
            ontology_name: resObj.name || "",
            description: resObj.description || "",
            entities: (resObj.entities || []).map((e: any) => ({
              name: e.name,
              properties: e.properties || [],
              description: e.description || "",
            })),
            relationships: (resObj.relations || []).map((r: any) => ({
              source: r.source,
              relation: r.predicate,
              target: r.target,
              description: r.description || "",
            })),
          };

          finalJsonTemplate = JSON.stringify(transformedData, null, 2);
        }
      } catch (error) {
        console.error(t("graph_template.analyze_failed"), error);
        message.error(t("graph_template.analyze_failed"));
        return;
      } finally {
        setIsLoading(false);
      }
    }

    onNext({
      type: "import",
      data: {
        sceneDesc: formData.sceneDesc,
        jsonTemplate: finalJsonTemplate,
      },
    });
  };

  return (
    <Drawer
      open={open}
      title={t("action.create")}
      onClose={onClose}
      className="create-drawer"
      styles={{
        wrapper: { width: 912 },
        header: {
          marginBottom: 0,
          padding: "16px 24px",
          borderBottom: "1px solid #f3f4f6",
          color: "#111827",
          fontWeight: 600,
        },
        body: { padding: 24, overflow: "hidden" },
      }}
    >
      <Spin
        spinning={isLoading}
        classNames={{
          root: "h-full",
          container: "h-full",
        }}
      >
        <div className="flex flex-col h-full bg-white">
          <div className="grid grid-cols-3 gap-4 mb-6">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex items-center p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-[#F5F8FE] border-[#2563EB]"
                    : "bg-white"
                }`}
                onClick={() => handleTabClick(tab.id)}
              >
                <div className="size-10 rounded flex items-center justify-center mr-3 shrink-0">
                  <img
                    src={getRealPath(`/images/graph/${tab.id}.png`)}
                    alt=""
                  />
                </div>
                <div className="flex flex-col">
                  <span
                    className={`font-medium text-sm mb-1 ${
                      activeTab === tab.id ? "text-[#2563EB]" : "text-[#1D1E1F]"
                    }`}
                  >
                    {tab.title}
                  </span>
                  <span className="text-xs text-gray-400 line-clamp-2 leading-snug">
                    {tab.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto pr-1 pb-4 min-h-0">
            {activeTab === "auto" && (
              <div className="flex flex-col h-full">
                <div className="mb-3 text-sm text-[#1D1E1F]">
                  {t("graph_template.scene_desc_label")}
                  <span className="text-[#E02020] ml-1">*</span>
                </div>
                <Input.TextArea
                  value={formData.sceneDesc}
                  onChange={(e) =>
                    setFormData({ ...formData, sceneDesc: e.target.value })
                  }
                  rows={20}
                  disabled={isLoading}
                  placeholder={t("graph_template.scene_desc_placeholder")}
                  className="flex-1 text-sm"
                  minLength={40}
                  maxLength={8000}
                  showCount
                  style={{ minHeight: 400, resize: "none" }}
                />
              </div>
            )}

            {activeTab === "import" && (
              <div className="flex flex-col h-full">
                <div className="mb-3 text-sm text-[#1D1E1F]">
                  {t("graph_template.json_template_label")}
                  <span className="text-[#E02020] ml-1">*</span>
                </div>
                <div className="flex-1 border border-[#E6E8EB] rounded overflow-hidden bg-[#FAFBFC] relative">
                  <CodeMirror
                    value={formData.jsonTemplate}
                    onChange={(value) =>
                      setFormData({ ...formData, jsonTemplate: value })
                    }
                    autoFocus
                    indentWithTab
                    tabSize={2}
                    disabled={isLoading}
                    height="600px"
                    className="h-[600px] w-full text-sm [&_.cm-editor]:h-full"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end mt-auto bg-white z-10">
            <Button
              type="primary"
              onClick={handleNext}
              loading={loading || isLoading}
              className="w-24"
            >
              {t("action_next_step")}
            </Button>
          </div>
        </div>
      </Spin>
    </Drawer>
  );
}

export default CreateDrawer;
