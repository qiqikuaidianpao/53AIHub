import { useState, useEffect } from "react";
import { PlusOutlined } from "@ant-design/icons";
import { message, Modal, Skeleton, Button } from "antd";
import { t } from "@/locales";
import { SvgIcon } from "@km/shared-components-react";
import { graphTemplatesApi } from "@/api";
import type { GraphTemplateListItem } from "@/api/modules/graph-templates/types";
import { api_host } from "@/utils/config";
import CreateDrawer from "./components/CreateDrawer";
import CreateDrawerForm from "./components/CreateDrawerForm";

const DEFAULT_GRAPH_LOGO = `${api_host}/api/images/library/graph-icon.png`;

const splitPreview = (
  value: unknown,
  maxShown = 3,
  field?: "name" | "predicate",
): { shown: string[]; more: number } => {
  if (typeof value !== "string") return { shown: [], more: 0 };
  const raw = value.trim();
  if (!raw) return { shown: [], more: 0 };

  try {
    const parts = JSON.parse(raw);
    const list = field
      ? parts
          .map((item: Record<string, unknown>) => item[field])
          .filter(Boolean)
      : parts;
    const shown = list.slice(0, maxShown);
    const more = Math.max(0, list.length - shown.length);
    return { shown, more };
  } catch {
    return { shown: [], more: 0 };
  }
};

export function GraphTemplateList() {
  const [templates, setTemplates] = useState<GraphTemplateListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(
    null,
  );
  const [isCreateDrawerVisible, setIsCreateDrawerVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isActualCreateDrawerVisible, setIsActualCreateDrawerVisible] =
    useState(false);
  const [actualCreateData, setActualCreateData] = useState<{
    type: string;
    data: { sceneDesc?: string; jsonTemplate?: string } | null;
  } | null>(null);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await graphTemplatesApi.list({ offset: 0, limit: 100 });
      setTemplates(
        res.items.map((item) => ({
          ...item,
          logo: item.logo || DEFAULT_GRAPH_LOGO,
        })),
      );
    } catch (error) {
      message.error(t("graph_template.fetch_failed"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateDrawer = () => {
    setCurrentTemplateId(null);
    setIsCreateDrawerVisible(true);
  };

  const handleCreateNext = async (data: { type: string; data: any }) => {
    setIsCreating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setActualCreateData(data);
      setIsCreateDrawerVisible(false);
      setIsActualCreateDrawerVisible(true);
    } catch (error) {
      message.error(t("graph_template.prepare_failed"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (item: GraphTemplateListItem) => {
    setCurrentTemplateId(item.id);
    setActualCreateData(null);
    setIsActualCreateDrawerVisible(true);
  };

  const handleDelete = async (item: GraphTemplateListItem) => {
    Modal.confirm({
      title: t("tip"),
      content: t("graph_template.delete_confirm", { name: item.name }),
      okText: t("action.delete"),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await graphTemplatesApi.remove(item.id);
          message.success(t("action_delete_success"));
          await fetchTemplates();
        } catch (error) {
          console.error(t("graph_template.delete_failed"), error);
        }
      },
    });
  };

  const onActualCreateSaved = () => {
    fetchTemplates();
  };

  return (
    <div className="px-2 py-5 h-full overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          className="flex flex-col items-center justify-center min-h-[160px] bg-[#F7FAFF] border border-[#E8EEFA] rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors group"
          onClick={openCreateDrawer}
        >
          <div className="flex items-center gap-3 text-base text-[#2563EB] font-medium">
            <div className="size-10 rounded flex bg-[#E6EEFF] items-center justify-center text-primary">
              <PlusOutlined style={{ fontSize: 16, color: "#2563EB" }} />
            </div>
            {t("data_pipeline.graph_ontology_template")}
          </div>
        </div>

        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="flex flex-col bg-white border border-slate-200 rounded-lg p-5"
            >
              <div className="flex items-center mb-3">
                <Skeleton.Avatar active size={32} className="mr-3" />
                <Skeleton.Input active size="small" style={{ width: 120 }} />
              </div>
              <div className="space-y-2 mb-6 flex-grow">
                <Skeleton.Input active size="small" block />
                <Skeleton.Input active size="small" style={{ width: "80%" }} />
              </div>
              <div className="flex items-center mt-auto pt-4 border-t border-slate-100">
                <Skeleton.Input
                  active
                  size="small"
                  style={{ width: 60 }}
                  className="mr-3"
                />
                <div className="flex space-x-2">
                  <Skeleton.Input active size="small" style={{ width: 40 }} />
                  <Skeleton.Input active size="small" style={{ width: 40 }} />
                </div>
              </div>
            </div>
          ))}

        {!isLoading &&
          templates.map((item) => (
            <div
              key={item.id}
              className="flex flex-col bg-white border border-[#E8EEFA] rounded-xl p-4 hover:shadow-md transition-shadow group cursor-pointer"
              onClick={() => handleEdit(item)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="size-7 rounded-lg bg-[#EBF1FF] overflow-hidden flex items-center justify-center">
                  <img
                    src={item.logo}
                    className="size-full object-cover"
                    alt=""
                  />
                </div>
                <h3
                  className="flex-1 text-base font-medium text-[#1D1E1F] truncate"
                  title={item.name}
                >
                  {item.name || t("graph_template.unnamed")}
                </h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button type="link" size="small" title={t("action.edit")}>
                    <SvgIcon name="edit" size="16" />
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item);
                    }}
                    title={t("action.delete")}
                  >
                    <SvgIcon name="delete" size="16" />
                  </Button>
                </div>
              </div>

              <p
                className="text-sm text-[#999999] mb-4 flex-grow line-clamp-2"
                title={item.description}
              >
                {item.description || t("graph_template.no_description")}
              </p>

              <div className="flex items-center mt-auto pt-4 border-t border-slate-100">
                <div className="flex items-center text-[#999999] mr-3 gap-1 shrink-0">
                  <SvgIcon name="application-two" size={16} />
                  <span className="text-xs">
                    {t("graph_template.entity_type")}
                  </span>
                </div>

                {splitPreview(item.entities, 2, "name").shown.length > 0 ? (
                  <div className="flex items-center space-x-2 overflow-hidden flex-1">
                    {splitPreview(item.entities, 2, "name").shown.map(
                      (name, idx) => (
                        <span
                          key={`${item.id}-entity-${name}-${idx}`}
                          className="px-2 py-1 bg-[#F7F7F8] text-[#4F5052] text-xs rounded whitespace-nowrap max-w-[60px] truncate"
                        >
                          {name}
                        </span>
                      ),
                    )}
                    {splitPreview(item.entities, 2, "name").more > 0 && (
                      <span className="px-2 py-1 bg-[#F7F7F8] text-[#2563EB] text-xs rounded shrink-0">
                        +{splitPreview(item.entities, 2, "name").more}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[#999999]">
                    {t("graph_template.no_tags")}
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      <CreateDrawer
        open={isCreateDrawerVisible}
        loading={isCreating}
        onClose={() => setIsCreateDrawerVisible(false)}
        onNext={handleCreateNext}
      />

      <CreateDrawerForm
        open={isActualCreateDrawerVisible}
        templateId={currentTemplateId}
        initialData={actualCreateData}
        onClose={() => setIsActualCreateDrawerVisible(false)}
        onSaved={onActualCreateSaved}
      />
    </div>
  );
}

export default GraphTemplateList;
