import {
  Modal,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Switch,
  Button,
  Checkbox,
  message,
  Spin,
  Tooltip,
} from "antd";
import { useEffect, useState, useMemo, useCallback } from "react";
import { t } from "@/locales";
import {
  channelApi,
  ModelOption
} from "@/api/modules/channel";
import { MODEL_USE_TYPE } from "@/constants/platform/config";
import { useEnterpriseStore } from "@/stores";
import { useVersion } from "@/hooks";
import { VERSION_MODULE } from "@/constants/enterprise";
import { getFormConfig, FormConfig } from "@/constants/platform/model";
import { useDebounceFn } from "@/hooks";
import { SvgIcon } from "@km/shared-components-react";
import { clearModelCache } from "@/components/Model";

interface ModelSaveDialogProps {
  open: boolean;
  modelList?: ModelOption[];
  data?: any;
  onClose: () => void;
  onSuccess: () => void;
}

interface ExtendedModel {
  icon: string;
  model_id: string;
  model_name: string;
  deep_thinking?: boolean;
  dimensions?: number;
  max_tokens?: number;
  vision?: boolean;
  is_system?: boolean;
  value?: string;
  label?: string;
  model_type?: number;
}

interface ExtendedModelCategory {
  icon: string;
  model_type: number;
  model_type_name: string;
  model_count: number;
  models: ExtendedModel[];
}

interface FormData {
  channel_id?: number;
  type: number;
  priority: number;
  weight: number;
  key: string;
  name: string;
  other: string;
  base_url: string;
  models: string[];
  model_type: number;
  model_mapping: string;
  custom_config: {
    models: any[];
    alias_map: Record<string, string>;
    [key: string]: any;
  };
  config: Record<string, any>;
}

const DEFAULT_FORM: FormData = {
  type: 0,
  priority: 0,
  weight: 0,
  key: "",
  name: "",
  other: "",
  base_url: "",
  models: [],
  model_type: MODEL_USE_TYPE.REASONING,
  model_mapping: "",
  custom_config: {
    models: [],
    alias_map: {},
  },
  config: {},
};

// Normalize custom_config with validation
const normalizeCustomConfig = (custom_config: any) => {
  const next = {
    models: [] as any[],
    alias_map: {} as Record<string, string>,
    ...(custom_config || {}),
  };
  if (!Array.isArray(next.models)) next.models = [];
  if (
    !next.alias_map ||
    typeof next.alias_map !== "object" ||
    Array.isArray(next.alias_map)
  ) {
    next.alias_map = {};
  }
  return next;
};

export function ModelSaveDialog({
  open,
  modelList = [],
  data,
  onClose,
  onSuccess,
}: ModelSaveDialogProps) {
  const enterpriseStore = useEnterpriseStore();
  const { canUse: canUseKnowledgeBase } = useVersion({
    module: VERSION_MODULE.KNOWLEDGE_BASE,
  });
  const [form] = Form.useForm();
  const [modelAddForm] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [modelAddVisible, setModelAddVisible] = useState(false);
  const [modelSchemas, setModelSchemas] = useState<FormConfig[]>([]);
  const [modelOptions, setModelOptions] = useState<ExtendedModelCategory[]>([]);
  const [platformName, setPlatformName] = useState("");
  const [isSingleModel, setIsSingleModel] = useState(false);
  const [formData, setFormData] = useState<FormData>({ ...DEFAULT_FORM });
  const [modelAddData, setModelAddData] = useState({
    model_id: "",
    model_name: "",
    model_type: MODEL_USE_TYPE.REASONING,
    vision: false,
    deep_thinking: false,
    text_generation: false,
    vector_dimension: 4096,
    max_tokens: 4096,
  });

  // Filter visible schemas
  const visibleSchemas = useMemo(() => {
    const features = enterpriseStore.version?.features;
    let schemas = modelSchemas.filter(
      (config) => !config.showWhen || config.showWhen(formData),
    );

    if (!canUseKnowledgeBase && features) {
      schemas = schemas.map((config) => {
        if (config.prop === "model_type") {
          return {
            ...config,
            options: config.options?.filter(
              (option) => option.value === MODEL_USE_TYPE.REASONING,
            ),
          };
        }
        return config;
      });
    }
    return schemas;
  }, [modelSchemas, formData]);

  // Has model type field
  const hasModelType = useMemo(() => {
    return modelSchemas.some((item) => item.prop === "model_type");
  }, [modelSchemas]);

  // Single model options
  const singleModelOptions = useMemo(() => {
    if (hasModelType) {
      const option = modelOptions.find(
        (item) => Number(item.model_type) === Number(formData.model_type),
      );
      return option?.models || [];
    }
    return modelOptions.flatMap((item) => item.models);
  }, [hasModelType, modelOptions, formData.model_type]);

  // Multiple model options
  const multipleModelOptions = useMemo(() => {
    const customModels = (formData.custom_config?.models || [])
      .filter((item: any) => !item.is_system)
      .map((item: any) => ({
        ...item,
        value: `${item.model_type}_53aikm_${item.model_id}`,
        label: item.model_name,
        icon: item.icon,
      }));

    return modelOptions.map((item) => ({
      ...item,
      models: item.models.concat(
        customModels.filter(
          (model: any) => model.model_type === item.model_type,
        ),
      ),
    }));
  }, [modelOptions, formData.custom_config]);

  // Initialize form - 返回 schemas 供后续使用
  const initForm = (channelData: any = {}): FormConfig[] => {
    const type = channelData.channel_type || 0;
    const schemas = getFormConfig(type);
    setModelSchemas(schemas);

    const newFormData: FormData = { ...DEFAULT_FORM, type };

    schemas.forEach((schema) => {
      if (schema.prop === "model_type") {
        newFormData.model_type = MODEL_USE_TYPE.REASONING;
      } else if (schema.prop === "models") {
        newFormData.models = (channelData.models || "")
          .toString()
          .split(",")
          .filter(Boolean);
        setIsSingleModel(!schema.multiple);
      } else if ("default" in schema) {
        const [parent, child] = schema.prop.split(".");
        if (child && parent === "config") {
          newFormData.config[child] = schema.default;
        } else {
          (newFormData as any)[schema.prop] = schema.default;
        }
      }
    });

    newFormData.custom_config = normalizeCustomConfig(
      channelData.custom_config,
    );

    setFormData(newFormData);
    form.setFieldsValue(newFormData);
    return schemas;
  };

  // Assign form data - 接收 schemas 参数避免依赖异步状态
  const assignForm = (channelData: any = {}, schemas: FormConfig[] = []) => {
    if (!channelData.channel_id) return;

    // 直接从传入的 schemas 计算 isSingleModel
    const modelsSchema = schemas.find((s) => s.prop === "models");
    const isSingleModelNow = modelsSchema ? !modelsSchema.multiple : false;

    const customConfigKeys = Object.keys(
      channelData.custom_config || {},
    ).filter(
      (key) =>
        !["deep_thinking", "vision", "alias_map", "models"].includes(key),
    );
    const models = customConfigKeys.map(
      (item) => `${channelData.custom_config[item]}_53aikm_${item}`,
    );

    // 从 schemas 中获取 config 字段的默认值，避免依赖异步的 formData.config
    const defaultConfig: Record<string, any> = {};
    schemas.forEach((schema) => {
      if ("default" in schema) {
        const [parent, child] = schema.prop.split(".");
        if (child && parent === "config") {
          defaultConfig[child] = schema.default;
        }
      }
    });

    // 合并默认值和后端数据
    const mergedConfig = { ...defaultConfig, ...channelData.config };

    // 单选模型时，直接使用第一个模型ID
    const modelValue = isSingleModelNow
      ? Array.isArray(channelData.models)
        ? channelData.models[0] || ""
        : channelData.models || ""
      : models;

    // 检查是否有 model_type 字段
    const hasModelTypeNow = schemas.some((item) => item.prop === "model_type");

    const newFormData: FormData = {
      channel_id: channelData.channel_id,
      type: channelData.channel_type,
      base_url: channelData.base_url || "",
      key: channelData.key || "",
      name: channelData.name || "",
      other: channelData.other || "",
      models: Array.isArray(modelValue)
        ? modelValue
        : [modelValue].filter(Boolean),
      weight: channelData.weight || 0,
      priority: channelData.priority || 0,
      model_type:
        hasModelTypeNow && isSingleModelNow && customConfigKeys.length > 0
          ? channelData.custom_config[customConfigKeys[0]]
          : MODEL_USE_TYPE.REASONING,
      config: mergedConfig,
      custom_config: normalizeCustomConfig(channelData.custom_config),
      model_mapping: channelData.model_mapping || "",
    };

    setFormData(newFormData);
    form.setFieldsValue(newFormData);
  };

  // Load model list
  const loadModelList = useCallback(
    (channelType: number) => {
      if (!Array.isArray(modelList)) return;
      const models = modelList.find(
        (item: any) => item.channel_type === channelType,
      );
      if (!models) return;

      const options = JSON.parse(JSON.stringify(models.categories)).map(
        (item: any) => ({
          ...item,
          models: item.models.map((model: any) => ({
            ...model,
            is_system: true,
            value: `${item.model_type}_53aikm_${model.model_id}`,
            label: model.model_name,
          })),
        }),
      );

      setModelOptions(options);
    },
    [modelList],
  );

  // Handle open
  useEffect(() => {
    if (open && data) {
      const channelType = data.channel_type || 0;
      setPlatformName(data.platform_name || "");
      setModelOptions([]); // 先清空旧数据
      const schemas = initForm(data);
      setTimeout(() => {
        assignForm(data, schemas);
        loadModelList(channelType);
      }, 0);
    }
  }, [open, data]);

  // Handle model change
  const handleModelChange = (value: string) => {
    const models = [...formData.models];
    const index = models.indexOf(value);
    if (index > -1) {
      models.splice(index, 1);
    } else {
      models.push(value);
    }
    setFormData((prev) => ({ ...prev, models }));
  };

  // Handle model add
  const handleModelAdd = (opt: ExtendedModelCategory) => {
    setModelAddData({
      model_id: "",
      model_name: "",
      model_type: String(opt.model_type) as any,
      vision: false,
      deep_thinking: false,
      text_generation: false,
      vector_dimension: 4096,
      max_tokens: 4096,
    });
    modelAddForm.setFieldsValue({
      model_id: "",
      model_name: "",
      vision: false,
      deep_thinking: false,
      text_generation: false,
      vector_dimension: 4096,
      max_tokens: 4096,
    });
    setModelAddVisible(true);
  };

  // Handle model add save
  const handleModelAddSave = async () => {
    try {
      const values = await modelAddForm.validateFields();
      const newModel = {
        model_id: values.model_id,
        model_name: values.model_name || values.model_id,
        model_type: Number(modelAddData.model_type),
        vision: modelAddData.vision,
        deep_thinking: modelAddData.deep_thinking,
        text_generation: modelAddData.text_generation,
        vector_dimension: values.vector_dimension
          ? Number(values.vector_dimension)
          : undefined,
        max_tokens: values.max_tokens ? Number(values.max_tokens) : undefined,
        is_system: false,
      };

      setFormData((prev) => ({
        ...prev,
        custom_config: {
          ...prev.custom_config,
          models: [...(prev.custom_config.models || []), newModel],
        },
      }));
      setModelAddVisible(false);
    } catch (error) {
      console.error("Validation error:", error);
    }
  };

  // Handle model delete
  const handleModelDelete = (model: ExtendedModel) => {
    setFormData((prev) => ({
      ...prev,
      models: prev.models.filter((item) => item !== model.value),
      custom_config: {
        ...prev.custom_config,
        models: (prev.custom_config.models || []).filter(
          (item: any) => item.model_id !== model.model_id,
        ),
        alias_map: Object.fromEntries(
          Object.entries(prev.custom_config.alias_map || {}).filter(
            ([key]) => key !== model.model_id,
          ),
        ),
      },
    }));
  };

  // Get model by value
  const getModel = (
    value: string,
    channelType: number,
  ): ExtendedModel | undefined => {
    // From system models
    if (Array.isArray(modelList)) {
      for (const item of modelList) {
        for (const category of item.categories) {
          const model = category.models.find(
            (m) => m.model_id === value && item.channel_type === channelType,
          );
          if (model) return model as ExtendedModel;
        }
      }
    }
    // From custom models
    return formData.custom_config?.models?.find(
      (m: any) => m.model_id === value,
    );
  };

  // Filter models by property
  const filterModelsByProperty = (
    models: string[],
    property: "deep_thinking" | "vision",
    channelType: number,
  ): string[] => {
    return models.reduce((acc, modelId) => {
      const config = getModel(modelId, channelType);
      if (config?.[property]) acc.push(config.model_id);
      return acc;
    }, [] as string[]);
  };

  // Build custom config
  const buildCustomConfig = (data: FormData, models: string[]) => {
    const custom_config: {
      alias_map: Record<string, string>;
      deep_thinking: string[];
      vision: string[];
      models?: any[];
      [key: string]: any;
    } = {
      alias_map: {},
      deep_thinking: [],
      vision: [],
    };

    if (isSingleModel) {
      const modelId = Array.isArray(data.models) ? data.models[0] : data.models;
      custom_config[modelId] = data.model_type;
      if (data.config?.vision) custom_config.vision.push(modelId);
      if (data.config?.deep_thinking) custom_config.deep_thinking.push(modelId);
      if (data.other && modelId) {
        custom_config.alias_map[modelId] = data.other;
      }
    } else {
      custom_config.deep_thinking = filterModelsByProperty(
        models,
        "deep_thinking",
        data.type,
      );
      custom_config.vision = filterModelsByProperty(
        models,
        "vision",
        data.type,
      );

      const aliasMap = models.reduce(
        (acc, modelId) => {
          const config = getModel(modelId, data.type);
          if (config?.model_id) {
            acc[config.model_id] = config.model_name;
          }
          return acc;
        },
        {} as Record<string, string>,
      );

      custom_config.alias_map = {
        ...aliasMap,
        ...(data.custom_config.alias_map || {}),
      };
    }

    if (
      data.custom_config?.models &&
      Array.isArray(data.custom_config.models)
    ) {
      custom_config.models = data.custom_config.models;
    }

    // Add type mapping
    models.forEach((modelId) => {
      const config = getModel(modelId, data.type);
      if (config?.model_type !== undefined) {
        custom_config[modelId] = config.model_type;
      }
    });

    return custom_config;
  };

  // Process models
  const processModels = (data: FormData) => {
    const models: string[] = [];
    const typeMapping: Record<string, string> = {};

    if (isSingleModel) {
      const modelId = Array.isArray(data.models) ? data.models[0] : data.models;
      if (modelId) {
        models.push(modelId);
        typeMapping[modelId] = String(data.model_type);
      }
    } else {
      data.models.forEach((model: string) => {
        const [model_type, model_id] = model.split("_53aikm_");
        if (model_id) {
          models.push(model_id);
          typeMapping[model_id] = model_type;
        }
      });
    }

    return { models, typeMapping };
  };

  // Handle save
  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      // 保留 formData.models，因为列表视图不通过表单控件更新
      // 深度合并 config，避免浅合并覆盖
      const saveData = {
        ...formData,
        ...values,
        models: formData.models,
        config: { ...formData.config, ...values.config },
      };

      // 手动验证 models 是否为空
      const modelsSchema = modelSchemas.find((s) => s.prop === "models");
      if (modelsSchema?.required) {
        const modelId = Array.isArray(saveData.models)
          ? saveData.models[0]
          : saveData.models;
        if (!modelId) {
          message.error(t("form_input_placeholder"));
          setLoading(false);
          return;
        }
      }

      const { models, typeMapping } = processModels(saveData);
      const custom_config = buildCustomConfig(saveData, models);

      // Merge type mapping into custom_config
      Object.assign(custom_config, typeMapping);

      const payload = {
        channel_id: saveData.channel_id,
        type: saveData.type,
        priority: saveData.priority,
        weight: saveData.weight,
        key: saveData.key,
        name: saveData.name,
        other: saveData.other,
        base_url: saveData.base_url,
        models: models.join(","),
        model_mapping: saveData.model_mapping,
        config: JSON.stringify(saveData.config),
        custom_config: JSON.stringify(custom_config),
      };

      if (saveData.channel_id) {
        await channelApi.update(saveData.channel_id, payload);
      } else {
        await channelApi.create(payload);
      }

      message.success(t("action_save_success"));
      clearModelCache();
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced save handler
  const debouncedSave = useDebounceFn(handleSave, 300);

  // Handle number input change with min/default logic
  const handleNumberChange = (prop: string, value: any, config: FormConfig) => {
    let finalValue = value;

    if (value === null || value === undefined || value === "") {
      finalValue = config.default ?? config.min ?? 1;
    } else if (config.min !== undefined && value < config.min) {
      finalValue = config.default ?? config.min;
    }

    setFormData((prev) => {
      const [parent, child] = prop.split(".");
      if (child && parent === "config") {
        return {
          ...prev,
          config: { ...prev.config, [child]: finalValue },
        };
      }
      return { ...prev, [prop]: finalValue };
    });
  };

  // Handle single model select - set vision config
  const setModelValue = (prop: string, value: any) => {
    const model = singleModelOptions.find((item) => item.model_id === value);
    setFormData((prev) => ({
      ...prev,
      models: [value],
      config: { ...prev.config, vision: model?.vision || false },
    }));
    form.setFieldValue("models", value);
  };

  // Handle input blur - trim whitespace
  const handleInputBlur = (prop: string, value: string) => {
    const trimmedValue = value.trim();
    setFormData((prev) => {
      const [parent, child] = prop.split(".");
      if (child && parent === "config") {
        return { ...prev, config: { ...prev.config, [child]: trimmedValue } };
      }
      return { ...prev, [prop]: trimmedValue };
    });
  };

  // Handle vector dimension change
  const handleVectorDimensionChange = (value: number | null) => {
    if (value !== null && value < 1) {
      modelAddForm.setFieldValue("vector_dimension", 1);
    }
  };

  // Handle max tokens change
  const handleMaxTokensChange = (value: number | null) => {
    if (value !== null && value < 1) {
      modelAddForm.setFieldValue("max_tokens", 1);
    }
  };

  // Render form item by type
  const renderFormItem = (config: FormConfig) => {
    switch (config.type) {
      case "input":
        return (
          <Input
            placeholder={config.placeholder || ""}
            onBlur={(e) => handleInputBlur(config.prop, e.target.value)}
          />
        );

      case "input_number":
        return (
          <InputNumber
            className="w-full"
            placeholder={config.placeholder || ""}
            min={config.min}
            controls={false}
            onChange={(value) => handleNumberChange(config.prop, value, config)}
          />
        );

      case "radio":
        return (
          <Radio.Group>
            {config.options?.map((opt) => (
              <Radio key={opt.value} value={opt.value}>
                {opt.label}
              </Radio>
            ))}
          </Radio.Group>
        );

      case "url":
        return (
          <Input
            placeholder={config.placeholder || ""}
            onBlur={(e) => handleInputBlur(config.prop, e.target.value)}
          />
        );

      case "select":
        // 模型选择字段特殊处理：根据 prop === 'models' 判断
        if (config.prop === "models") {
          if (!config.multiple) {
            // 单选模型支持自定义输入（如 Azure OpenAI）
            const currentModelId = formData.models?.[0] || undefined;
            const isCustomModel = currentModelId && !singleModelOptions.some((opt) => opt.model_id === currentModelId);

            return (
              <Select
                placeholder={config.placeholder || ""}
                showSearch={config.allowCreate}
                allowClear={config.allowCreate}
                filterOption={(input, option) => {
                  const label = String(option?.children || option?.value || "");
                  return label.toLowerCase().includes(input.toLowerCase());
                }}
                onSearch={
                  config.allowCreate
                    ? (searchValue) => {
                        // 用户输入自定义模型ID时，实时更新
                        if (searchValue) {
                          setFormData((prev) => ({
                            ...prev,
                            models: [searchValue],
                          }));
                          form.setFieldValue("models", searchValue);
                        }
                      }
                    : undefined
                }
                onChange={(value) => {
                  if (value !== undefined) {
                    setModelValue(config.prop, value);
                  }
                }}
                value={currentModelId}
              >
                {/* 如果当前值是自定义模型，显示它 */}
                {isCustomModel && (
                  <Select.Option value={currentModelId}>
                    {currentModelId}
                  </Select.Option>
                )}
                {singleModelOptions.map((opt) => (
                  <Select.Option key={opt.model_id} value={opt.model_id}>
                    {opt.model_name}
                  </Select.Option>
                ))}
              </Select>
            );
          }

          return (
            <Spin spinning={loading}>
              <div className="w-full max-h-[400px] overflow-y-auto pr-1">
                {!multipleModelOptions.length && (
                  <div className="text-gray-400 w-full text-center py-4">
                    {t("module.platform_model_models_empty")}
                  </div>
                )}
                {multipleModelOptions.map((opt) => (
                  <div
                    key={opt.model_type}
                    className="mb-4 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between h-9">
                      <span className="text-sm text-gray-500">
                        {opt.model_type_name}
                      </span>
                      <Button
                        type="link"
                        className="px-0"
                        onClick={() => handleModelAdd(opt)}
                      >
                        + {t("action_add")}
                      </Button>
                    </div>
                    {opt.models.map((item) => (
                      <div
                        key={item.value}
                        className="h-8 flex items-center gap-1.5"
                      >
                        {item.icon && (
                          <img
                            src={item.icon}
                            className="w-5 h-5 object-contain flex-none"
                            alt=""
                          />
                        )}
                        <div className="flex-1 flex items-center gap-1 overflow-hidden">
                          <span className="text-sm truncate">
                            {item.model_name}
                          </span>
                          {item.model_name !== item.model_id && (
                            <>
                              <span className="text-xs text-gray-400">|</span>
                              <span className="text-xs text-gray-400 truncate">
                                {item.model_id}
                              </span>
                            </>
                          )}
                          {item.deep_thinking && (
                            <Tooltip title={t("model.deep_thinking")}>
                              <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-50 text-blue-500 cursor-pointer">
                                <SvgIcon name="smart-optimization" width={12} />
                              </div>
                            </Tooltip>
                          )}
                          {item.vision && (
                            <Tooltip title={t("platform_model.vision")}>
                              <div className="w-5 h-5 rounded flex items-center justify-center bg-yellow-50 text-yellow-500 cursor-pointer">
                                <SvgIcon name="view" width={12} />
                              </div>
                            </Tooltip>
                          )}
                        </div>
                        {!item.is_system && (
                          <SvgIcon
                            name="delete"
                            width={14}
                            className="cursor-pointer mr-1 text-gray-400 hover:text-red-500"
                            onClick={() => handleModelDelete(item)}
                          />
                        )}
                        <Switch
                          size="small"
                          checked={formData.models.includes(item.value || "")}
                          onChange={() => handleModelChange(item.value || "")}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Spin>
          );
        }

        // 普通下拉选择
        return (
          <Select
            placeholder={config.placeholder || ""}
            allowClear={config.allowCreate}
            showSearch={config.allowCreate}
          >
            {config.options?.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        );

      default:
        return <Input placeholder={config.placeholder || ""} />;
    }
  };

  return (
    <>
      <Modal
        open={open}
        title={t("action_setting") + platformName}
        onCancel={onClose}
        width={600}
        centered
        destroyOnHidden
        getContainer={false}
        maskClosable={false}
        styles={{
          body: {
            maxHeight: "60vh",
            overflowY: "auto",
          },
        }}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t("action_cancel")}
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={loading}
            onClick={debouncedSave}
          >
            {t("action_save")}
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          {visibleSchemas.map((config) => {
            // models 列表视图不通过表单控件，需要特殊处理
            const isModelsList = config.prop === "models" && config.multiple;
            // 处理嵌套字段名（如 config.vision）
            const [parent, child] = config.prop.split(".");
            const fieldName = child ? [parent, child] : config.prop;
            return (
              <Form.Item
                key={config.prop}
                label={config.label}
                name={isModelsList ? undefined : fieldName}
                rules={
                  isModelsList
                    ? []
                    : config.required
                      ? [
                          {
                            required: true,
                            message: t("form_input_placeholder"),
                          },
                        ]
                      : []
                }
              >
                {renderFormItem(config)}
              </Form.Item>
            );
          })}
        </Form>
      </Modal>

      {/* Model Add Dialog */}
      <Modal
        open={modelAddVisible}
        title={t("action_add")}
        onCancel={() => setModelAddVisible(false)}
        width={600}
        centered
        destroyOnHidden
        getContainer={false}
        maskClosable={false}
        footer={[
          <Button key="cancel" onClick={() => setModelAddVisible(false)}>
            {t("action_cancel")}
          </Button>,
          <Button key="save" type="primary" onClick={handleModelAddSave}>
            {t("action_save")}
          </Button>,
        ]}
      >
        <Form form={modelAddForm} layout="vertical">
          <Form.Item
            label={t("module.platform_model_models_id")}
            name="model_id"
            rules={[{ required: true, message: t("form_input_placeholder") }]}
          >
            <Input placeholder={t("form_input_placeholder")} />
          </Form.Item>
          <Form.Item
            label={t("module.platform_model_models_name")}
            name="model_name"
          >
            <Input placeholder={t("form_input_placeholder")} />
          </Form.Item>
          {modelAddData.model_type === MODEL_USE_TYPE.REASONING && (
            <Form.Item label={t("module.platform_model_models_type")}>
              <Checkbox
                checked={modelAddData.text_generation}
                onChange={(e) =>
                  setModelAddData((prev) => ({
                    ...prev,
                    text_generation: e.target.checked,
                  }))
                }
              >
                {t("platform_model.text_generation")}
              </Checkbox>
              <Checkbox
                checked={modelAddData.deep_thinking}
                onChange={(e) =>
                  setModelAddData((prev) => ({
                    ...prev,
                    deep_thinking: e.target.checked,
                  }))
                }
              >
                {t("model.deep_thinking")}
              </Checkbox>
              <Checkbox
                checked={modelAddData.vision}
                onChange={(e) =>
                  setModelAddData((prev) => ({
                    ...prev,
                    vision: e.target.checked,
                  }))
                }
              >
                {t("platform_model.vision")}
              </Checkbox>
            </Form.Item>
          )}
          {modelAddData.model_type === MODEL_USE_TYPE.EMBEDDING && (
            <>
              <Form.Item
                label={t("module.platform_model_vector_dimension")}
                name="vector_dimension"
              >
                <InputNumber
                  className="w-full"
                  min={1}
                  controls={false}
                  onChange={handleVectorDimensionChange}
                />
              </Form.Item>
              <Form.Item
                label={t("module.platform_model_max_tokens")}
                name="max_tokens"
              >
                <InputNumber
                  className="w-full"
                  min={1}
                  controls={false}
                  onChange={handleMaxTokensChange}
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </>
  );
}

export default ModelSaveDialog;
