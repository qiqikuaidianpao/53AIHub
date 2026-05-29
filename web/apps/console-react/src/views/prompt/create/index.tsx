import { Button, Form, message } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState } from "react";
import { t } from "@/locales";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLayoutContent } from "@/components/PageLayout";
import { useEnterpriseStore } from "@/stores";
import { GROUP_TYPE } from "@/constants/group";
import { GroupSelect } from "@/components/GroupSelect";
import CreateDrawer, { CreateDrawerRef } from "../components/CreateDrawer";
import LinksDialog, { LinksDialogRef } from "../components/LinksDialog";
import StoreDialog, {
  StoreDialogRef,
} from "@/views/toolbox-refactored/components/StoreDialog";
import GuideView from "./Guide";
import { SvgIcon } from "@km/shared-components-react";
import { usePromptFormDataStore } from "./store";
import { PromptInputField } from "@/components/Prompt/input-field";
import { eventBus } from "@km/shared-utils";

export function PromptCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const enterpriseStore = useEnterpriseStore();
  const [form] = Form.useForm();

  const createRef = useRef<CreateDrawerRef>(null);
  const linksDialogRef = useRef<LinksDialogRef>(null);
  const storeDialogRef = useRef<StoreDialogRef>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [title, setTitle] = useState("");

  const formData = usePromptFormDataStore((state) => state.formData);
  const detailData = usePromptFormDataStore((state) => state.detailData);
  const loading = usePromptFormDataStore((state) => state.loading);
  const submitting = usePromptFormDataStore((state) => state.submitting);
  const setFormData = usePromptFormDataStore((state) => state.set);
  const fetchDetail = usePromptFormDataStore((state) => state.fetchDetail);
  const reset = usePromptFormDataStore((state) => state.reset);
  const clear = usePromptFormDataStore((state) => state.clear);
  const save = usePromptFormDataStore((state) => state.save);
  const loadDefaultLinks = usePromptFormDataStore(
    (state) => state.loadDefaultLinks,
  );

  const promptId = searchParams.get("prompt_id");
  const isEdit = !!promptId;

  // Handle open dialogs
  const handleOpenLinksDialog = () => {
    linksDialogRef.current?.open();
  };

  const handleOpenStoreDialog = () => {
    storeDialogRef.current?.open();
  };

  // Handle add scene
  const handleAddScene = (data: { data: any }) => {
    setFormData({
      ai_links: [
        ...(formData.ai_links || []),
        {
          ai_link: { ...data.data },
          delete: false,
        },
      ],
    });
  };

  // Handle delete link
  const handleDeleteLink = (item: any) => {
    item.delete = true;
    setFormData({ ai_links: [...formData.ai_links] });
  };

  // Handle edit/create
  const handleEdit = async () => {
    await fetchDetail({ prompt_id: promptId! });
    setDrawerOpen(true);
  };

  const handleCreate = () => {
    setDrawerOpen(true);
  };

  // Handle save
  const handleSave = async () => {
    try {
      const infoValid = await createRef.current?.validate();
      const valid = await form.validateFields();
      if (!infoValid || !valid) return;

      // Get form values to include in save
      const formValues = form.getFieldsValue();

      if (!promptId) {
        const isAILinksChanged = formData.ai_links?.some(
          (item: any) => item.delete,
        );
        const data = await save({ hideToast: isAILinksChanged, formValues });
        if (isAILinksChanged) {
          await save({ prompt_id: data.prompt_id });
        }
        message.success(t("action_save_success"));
        // Notify list page to refresh
        eventBus.emit("prompt-create");
        navigate(
          {
            pathname: "/prompt/create",
            search: `prompt_id=${data.prompt_id}`,
          },
          { replace: true },
        );
        setTitle(data.name);
      } else {
        await save({ formValues });
        message.success(t("action_save_success"));
        // Notify list page to refresh
        eventBus.emit("prompt-update");
        fetchDetail({ prompt_id: promptId });
      }
    } catch (error) {
      console.error("Save prompt error:", error);
      message.error(t("action_save_failed"));
    }
  };

  // Handle back
  const handleBack = () => {
    navigate("/prompt");
  };

  // Track if form values have been synced from formData
  const syncedRef = useRef(false);

  useEffect(() => {
    // Reset form and synced state when promptId changes
    syncedRef.current = false;
    form.resetFields();

    if (promptId) {
      fetchDetail({ prompt_id: promptId }).then(() => {
        setDrawerOpen(true);
      });
    } else {
      setTitle(t("action_add"));
      reset().then(() => {
        loadDefaultLinks();
        setDrawerOpen(true);
      });
    }

    return () => {
      // Synchronously clear store data on unmount
      clear();
    };
  }, [promptId]);

  // Sync form values from formData only when data is loaded
  useEffect(() => {
    // Only sync once when data is ready
    // - Edit mode: formData.prompt_id matches current promptId
    // - New mode: formData.prompt_id is 0 and drawerOpen is true
    const isEditModeReady = promptId && String(formData.prompt_id) === promptId;
    const isNewModeReady = !promptId && formData.prompt_id === 0 && drawerOpen;

    if (!syncedRef.current && (isEditModeReady || isNewModeReady)) {
      syncedRef.current = true;
      form.setFieldsValue({
        content: formData.content || "",
        subscription_group_ids: formData.subscription_group_ids || [],
        user_group_ids: formData.user_group_ids || [],
      });
    }
  }, [
    promptId,
    formData.prompt_id,
    formData.content,
    formData.subscription_group_ids,
    formData.user_group_ids,
    drawerOpen,
    form,
  ]);

  return (
    <PageLayoutContent
      header={{
        title: detailData.name || title,
        back: true,
        onBack: handleBack,
      }}
      contentClassName="flex-1 flex overflow-hidden"
      scrollable={false}
      footer={
        <Button
          type="primary"
          loading={loading || submitting}
          onClick={handleSave}
        >
          {t("action_save")}
        </Button>
      }
    >
      <div className="h-full flex overflow-hidden">
        {/* Left panel - Basic info */}
        <div className="w-1/2 h-full p-6 border-r overflow-y-auto">
          <div className="font-bold mb-3">{t("basic_info")}</div>
          <div className="p-5 bg-[#F7F8FA] rounded">
            <CreateDrawer ref={createRef} />

            {/* AI Links */}
            <div className="flex-none py-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm text-[#1D1E1F]">{t("usage_scene")}</h3>
                <Button
                  type="link"
                  className="!px-0"
                  onClick={handleOpenLinksDialog}
                >
                  <SvgIcon name="cate-manage" width="14px" />
                  {t("default_links.default_setting")}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.ai_links
                  ?.filter((item: any) => !item.delete)
                  .map((item: any, index: number) => (
                    <div
                      key={index}
                      className="h-8 flex items-center gap-2 px-2 border rounded hover:shadow-md bg-white"
                    >
                      <img
                        className="w-5 h-5 rounded-full"
                        src={item.ai_link?.logo}
                        alt=""
                      />
                      <p className="text-sm text-[#1D1E1F]">
                        {item.ai_link?.name}
                      </p>
                      <CloseOutlined
                        className="cursor-pointer hover:opacity-50 text-xs"
                        onClick={() => handleDeleteLink(item)}
                      />
                    </div>
                  ))}
                <Button
                  variant="dashed"
                  color="primary"
                  onClick={handleOpenStoreDialog}
                >
                  +{t("action_add")}
                </Button>
              </div>
            </div>
          </div>

          <div className="font-bold mt-6 mb-3">{t("usage_guide_desc")}</div>
          <GuideView />
        </div>

        {/* Right panel - Config */}
        <div className="w-1/2 p-6 overflow-y-auto">
          <div className="font-bold mb-3">{t("prompt_config")}</div>
          <Form form={form} layout="vertical" className="p-5 bg-[#F7F8FA]">
            {/* Subscription groups */}
            <Form.Item
              label={t("register_user.title")}
              name="subscription_group_ids"
              hidden={
                !(
                  enterpriseStore.info.is_independent ||
                  enterpriseStore.info.is_industry
                )
              }
            >
              <GroupSelect
                groupType={GROUP_TYPE.USER}
                type="checkbox"
                defaultAll={formData.prompt_id === 0}
              />
            </Form.Item>

            {/* User groups */}
            <Form.Item
              label={t("internal_user.title")}
              name="user_group_ids"
              hidden={
                !(
                  enterpriseStore.info.is_enterprise ||
                  enterpriseStore.info.is_industry
                )
              }
            >
              <GroupSelect groupType={GROUP_TYPE.INTERNAL_USER} type="picker" />
            </Form.Item>

            {/* Content */}
            <Form.Item
              label={t("prompt.content")}
              name="content"
              rules={[{ required: true, message: t("form_input_placeholder") }]}
            >
              <PromptInputField
                showLine
                showToken
                style={{ minHeight: "60vh", height: "max-content" }}
              />
            </Form.Item>
          </Form>
        </div>
      </div>
      {/* Dialogs */}
      <StoreDialog
        ref={storeDialogRef}
        showAddManual={false}
        onAdd={handleAddScene}
      />
      <LinksDialog ref={linksDialogRef} />
    </PageLayoutContent>
  );
}

export default PromptCreatePage;
