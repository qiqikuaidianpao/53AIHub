import { Button, Drawer, Form, Input, Modal, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { t } from "@/locales";
import { usePromptFormDataStore } from "./store";
import { ImageUpload } from "@/components/Upload";
import { generateRandomId } from "@/utils";
import { MarkdownEditorField } from "@/components/Markdown/editor-field";

interface UseCase {
  id?: string;
  type?: "case" | "scene";
  scene?: string;
  image?: string;
  desc?: string;
  input_text?: string;
  output_text?: string;
}

export function GuideView() {
  const [caseVisible, setCaseVisible] = useState(false);
  const [sceneVisible, setSceneVisible] = useState(false);
  const [caseForm] = Form.useForm();
  const [sceneForm] = Form.useForm();
  const [useCaseList, setUseCaseList] = useState<UseCase[]>([]);
  const [useSceneList, setUseSceneList] = useState<UseCase[]>([]);
  const [editingCase, setEditingCase] = useState<UseCase | null>(null);
  const [editingScene, setEditingScene] = useState<UseCase | null>(null);
  const [editingSceneIndex, setEditingSceneIndex] = useState<number>(-1);

  const formData = usePromptFormDataStore((state) => state.formData);
  const setFormData = usePromptFormDataStore((state) => state.set);

  // Use refs to track current values for updateCustomConfig
  const useCaseListRef = useRef<UseCase[]>([]);
  const useSceneListRef = useRef<UseCase[]>([]);

  // Keep refs in sync
  useEffect(() => {
    useCaseListRef.current = useCaseList;
  }, [useCaseList]);

  useEffect(() => {
    useSceneListRef.current = useSceneList;
  }, [useSceneList]);

  // Update custom_config when lists change
  const updateCustomConfig = useCallback(() => {
    const useCases = [
      ...useCaseListRef.current,
      ...useSceneListRef.current,
    ].filter((item) => item.id);
    setFormData({
      custom_config: {
        use_cases: useCases as any,
      },
    });
  }, [setFormData]);

  // Initialize data from formData
  useEffect(() => {
    const config = formData.custom_config || { use_cases: [] };
    const cases = config.use_cases || [];

    const caseList = cases.filter((item: UseCase) => item.type === "case");
    setUseCaseList(caseList);
    useCaseListRef.current = caseList;

    const scenes = cases.filter((item: UseCase) => item.type === "scene");
    const newScenes: UseCase[] = [];

    setUseSceneList(newScenes);
    useSceneListRef.current = newScenes;
  }, [formData.custom_config]);

  // Case handlers
  const onCaseOpen = (params: { data?: UseCase } = {}) => {
    const data = params?.data || {};
    setEditingCase(data.id ? data : null);
    caseForm.setFieldsValue({
      input_text: data.input_text || "",
      output_text: data.output_text || "",
    });
    setCaseVisible(true);
  };

  const onCaseDelete = (index: number) => {
    const newList = [...useCaseList];
    newList.splice(index, 1);
    setUseCaseList(newList);
    setTimeout(updateCustomConfig, 0);
  };

  const onCaseConfirm = async () => {
    try {
      const values = await caseForm.validateFields();
      const id = editingCase?.id || generateRandomId(8);
      const existingData = useCaseList.find((item) => item.id === id);

      if (existingData) {
        setUseCaseList((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  input_text: values.input_text,
                  output_text: values.output_text,
                }
              : item,
          ),
        );
      } else {
        setUseCaseList((prev) => [
          ...prev,
          {
            type: "case",
            id,
            input_text: values.input_text || "",
            output_text: values.output_text || "",
          },
        ]);
      }
      setCaseVisible(false);
      setTimeout(updateCustomConfig, 0);
    } catch (error) {
      console.error("Validation error:", error);
    }
  };

  // Scene handlers
  const onSceneOpen = (params: { data?: UseCase; index?: number } = {}) => {
    const data = params?.data || {};
    const index = params?.index ?? -1;
    setEditingScene(data.id ? data : null);
    setEditingSceneIndex(index);
    sceneForm.setFieldsValue({
      image: data.image || "",
      scene: data.scene || "",
      desc: data.desc || "",
    });
    setSceneVisible(true);
  };

  const onSceneDelete = (index: number) => {
    const newList = [...useSceneList];
    newList.splice(index, 1);
    newList.push({
      id: "",
      image: "",
      scene: "",
      desc: "",
    });
    setUseSceneList(newList);
    setTimeout(updateCustomConfig, 0);
  };

  const onSceneConfirm = async () => {
    try {
      const values = await sceneForm.validateFields();
      const id = editingScene?.id || generateRandomId(8);

      if (editingScene) {
        setUseSceneList((prev) =>
          prev.map((item, idx) =>
            idx === editingSceneIndex
              ? {
                  ...item,
                  image: values.image,
                  scene: values.scene,
                  desc: values.desc,
                }
              : item,
          ),
        );
      } else {
        const emptyIndex = useSceneList.findIndex((item) => !item.id);
        if (emptyIndex >= 0) {
          const newList = [...useSceneList];
          newList[emptyIndex] = {
            type: "scene",
            id,
            image: values.image || "",
            scene: values.scene || "",
            desc: values.desc || "",
          };
          setUseSceneList(newList);
        }
      }
      setSceneVisible(false);
      setTimeout(updateCustomConfig, 0);
    } catch (error) {
      console.error("Validation error:", error);
    }
  };

  return (
    <div>
      {/* Usage Scene */}
      <div className="p-5 bg-[#F7F8FA] rounded">
        <div className="flex items-center justify-between">
          <h4 className="text-sm text-[#4F5052]">{t("usage_scene")}</h4>
          <Button
            type="link"
            className="!px-0"
            icon={<PlusOutlined />}
            onClick={() => onSceneOpen()}
          >
            {t("action_add")}
          </Button>
        </div>
        <div className="flex flex-wrap justify-between">
          {useSceneList.map((item, index) => (
            <div
              key={index}
              className="w-full flex justify-between items-center py-[10px] px-3 mt-2 bg-white rounded"
            >
              {item.id ? (
                <>
                  <h6
                    className="text-sm text-[#1D1E1F] max-w-[10em] truncate"
                    title={item.scene || ""}
                  >
                    {item.scene || ""}
                  </h6>
                  <div className="flex gap-2">
                    <Button
                      type="link"
                      icon={<SvgIcon name="edit" />}
                      onClick={() => onSceneOpen({ data: item, index })}
                    />
                    <Button
                      type="link"
                      icon={<SvgIcon name="delete" />}
                      onClick={() => onSceneDelete(index)}
                    />
                  </div>
                </>
              ) : (
                <span className="text-[#999] text-sm">--</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Usage Case */}
      <div className="p-5 bg-[#F7F8FA] rounded mt-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm text-[#4F5052]">{t("usage_case")}</h4>
          <Button
            type="link"
            icon={<PlusOutlined />}
            className="!px-0"
            onClick={() => onCaseOpen()}
          >
            {t("action_add")}
          </Button>
        </div>
        <div className="flex flex-wrap">
          {useCaseList.map((item, index) => (
            <div
              key={index}
              className="w-full flex justify-between items-center py-[10px] px-3 mt-2 bg-white rounded break-inside-avoid"
            >
              <div className="text-sm text-[#1D1E1F] break-words flex-1">
                {item.input_text || "--"}
              </div>
              <div className="flex gap-2">
                <Button
                  type="link"
                  icon={<SvgIcon name="edit" />}
                  onClick={() => onCaseOpen({ data: item })}
                />
                <Button
                  type="link"
                  icon={<SvgIcon name="delete" />}
                  onClick={() => onCaseDelete(index)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Case Drawer */}
      <Drawer
        open={caseVisible}
        title={editingCase ? t("action_edit") : t("action_add")}
        onClose={() => setCaseVisible(false)}
        destroyOnHidden
        styles={{ wrapper: { width: 600 } }}
      >
        <Form form={caseForm} layout="vertical">
          <Form.Item
            label={t("input")}
            name="input_text"
            rules={[
              { required: true, message: t("form_input_placeholder") },
              {
                max: 200,
                message: t("form_input_placeholder_max_length", { max: 200 }),
              },
            ]}
          >
            <MarkdownEditorField
              type="simple"
              height="150px"
              maxlength={200}
              showWordLimit
            />
          </Form.Item>
          <Form.Item
            label={t("output")}
            name="output_text"
            rules={[
              { required: true, message: t("form_input_placeholder") },
              {
                max: 1000,
                message: t("form_input_placeholder_max_length", { max: 1000 }),
              },
            ]}
          >
            <MarkdownEditorField
              type="simple"
              height="300px"
              maxlength={1000}
              showWordLimit
            />
          </Form.Item>
        </Form>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setCaseVisible(false)}>
            {t("action_cancel")}
          </Button>
          <Button type="primary" onClick={onCaseConfirm}>
            {t("action_confirm")}
          </Button>
        </div>
      </Drawer>

      {/* Scene Modal */}
      <Modal
        open={sceneVisible}
        title={editingScene ? t("action_edit") : t("action_add")}
        onCancel={() => setSceneVisible(false)}
        onOk={onSceneConfirm}
        destroyOnHidden
        width={600}
      >
        <Form form={sceneForm}>
          <Form.Item
            label={t("pictorial_image")}
            name="image"
            rules={[{ required: true, message: t("form_upload_placeholder") }]}
          >
            <div style={{ width: 120, height: 112 }}>
              <ImageUpload className="!w-[120px] !h-[112px]" />
            </div>
          </Form.Item>
          <Form.Item
            label={t("scene")}
            name="scene"
            rules={[
              { required: true, message: t("form_input_placeholder") },
              {
                max: 20,
                message: t("form_input_placeholder_max_length", { max: 20 }),
              },
            ]}
          >
            <Input maxLength={20} showCount />
          </Form.Item>
          <Form.Item
            label={t("description")}
            name="desc"
            rules={[
              { required: true, message: t("form_input_placeholder") },
              {
                max: 50,
                message: t("form_input_placeholder_max_length", { max: 50 }),
              },
            ]}
          >
            <Input.TextArea
              rows={5}
              maxLength={50}
              showCount
              style={{ resize: "none" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default GuideView;
