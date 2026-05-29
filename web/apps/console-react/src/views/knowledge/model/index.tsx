import { useEffect, useState, useCallback } from "react";
import { Form, Button, message, Spin } from "antd";
import { t } from "@/locales";
import { ModelSelect } from "@/components/Model/select";
import {
  chunkSettingApi,
  type ModelSetting,
} from "@/api/modules/chunk-setting";
import { MODEL_USE_TYPE, REASONING_MODE } from "@/constants/platform/config";
import { debounce } from "@/directive/debounce";

// Default setting template
const defaultSetting: ModelSetting = {
  created_time: 1672502400,
  eid: 1,
  file_id: 1,
  id: 1,
  library_id: 1,
  model_config: {
    version: "string",
    logic_reasoning: {
      channel_id: 0,
      model_name: "",
    },
    vector_embedding: {
      channel_id: 0,
      model_name: "",
    },
    fast_reasoning: {
      channel_id: 0,
      model_name: "",
    },
    search_config: {
      vector: true,
      fulltext: false,
      hybrid: false,
      rerank_model: "reranking_model",
      rerank_channel_id: 0,
      rerank_model_name: "",
      reranking_enable: false,
      top_k: 0,
      score_threshold: 0,
      score_threshold_enabled: false,
      weights: {
        keyword_setting: {
          keyword_weight: 1,
        },
        vector_setting: {
          vector_weight: 0,
        },
      },
    },
  },
  updated_time: 1672502400,
};

// Helper: encode channel_id and model_name to value
const encodeModelValue = (
  channel_id: number | null,
  model_name: string | null,
): string => {
  return channel_id && model_name ? `${channel_id}_53aikm_${model_name}` : "";
};

// Helper: decode value to channel_id and model_name
const decodeModelValue = (
  value: string,
): { channel_id: number; model_name: string } => {
  if (!value) {
    return { channel_id: 0, model_name: "" };
  }
  const [channel_id, model_name] = value.split("_53aikm_");
  return {
    channel_id: Number(channel_id),
    model_name: model_name || "",
  };
};

export function KnowledgeModel() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [setting, setSetting] = useState<ModelSetting>(() => ({
    ...defaultSetting,
    model_config: { ...defaultSetting.model_config },
  }));

  // Computed values for model selects
  const logicValue = encodeModelValue(
    setting.model_config.logic_reasoning.channel_id,
    setting.model_config.logic_reasoning.model_name,
  );

  const fastReasoningValue = encodeModelValue(
    setting.model_config.fast_reasoning.channel_id,
    setting.model_config.fast_reasoning.model_name,
  );

  const vectorValue = encodeModelValue(
    setting.model_config.vector_embedding.channel_id,
    setting.model_config.vector_embedding.model_name,
  );

  // Handlers
  const handleLogicChange = useCallback((value: string) => {
    const { channel_id, model_name } = decodeModelValue(value);
    setSetting((prev) => ({
      ...prev,
      model_config: {
        ...prev.model_config,
        logic_reasoning: { channel_id, model_name },
      },
    }));
  }, []);

  const handleFastReasoningChange = useCallback((value: string) => {
    const { channel_id, model_name } = decodeModelValue(value);
    setSetting((prev) => ({
      ...prev,
      model_config: {
        ...prev.model_config,
        fast_reasoning: { channel_id, model_name },
      },
    }));
  }, []);

  const handleVectorChange = useCallback((value: string) => {
    const { channel_id, model_name } = decodeModelValue(value);
    setSetting((prev) => ({
      ...prev,
      model_config: {
        ...prev.model_config,
        vector_embedding: { channel_id, model_name },
      },
    }));
  }, []);

  // Load config
  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await chunkSettingApi.modelConfig.get();
      const { search_config } = data.model_config;

      // Set default rerank_model if empty
      if (search_config.rerank_model === "") {
        search_config.rerank_model = "reranking_model";
      }

      setSetting(data);
    } catch (error) {
      console.error("Failed to load model config:", error);
    } finally {
      setLoading(false);
    }
  };

  // Save config with validation
  const handleSave = async () => {
    // Validation
    if (!logicValue) {
      message.error(t("model.select_model") + t("model.reasoning"));
      return;
    }
    if (!vectorValue) {
      message.error(t("model.select_model") + t("model.embedding"));
      return;
    }
    if (!fastReasoningValue) {
      message.error(t("model.select_model") + t("model.intent_recognition"));
      return;
    }

    setSaving(true);
    try {
      await chunkSettingApi.modelConfig.update({
        model_config: setting.model_config,
      });
      message.success(t("message_status.save_success"));
    } catch (error) {
      console.error("Failed to save model config:", error);
    } finally {
      setSaving(false);
    }
  };

  // Debounced save handler
  const debouncedSave = debounce(handleSave, 1000, true);

  useEffect(() => {
    loadConfig();
  }, []);

  return (
    <div className="h-full  bg-white py-5 px-2 overflow-auto">
      <Spin spinning={loading}>
        <div className="max-w-[600px]">
          <Form layout="vertical">
            <Form.Item label={t("model.reasoning")}>
              <ModelSelect
                value={logicValue}
                onChange={handleLogicChange}
                type={MODEL_USE_TYPE.REASONING}
                placeholder={t("model.select_model")}
              />
            </Form.Item>

            <Form.Item label={t("model.intent_recognition")}>
              <ModelSelect
                value={fastReasoningValue}
                onChange={handleFastReasoningChange}
                type={MODEL_USE_TYPE.REASONING}
                mode={REASONING_MODE.FAST}
                placeholder={t("model.select_model")}
              />
            </Form.Item>

            <Form.Item label={t("model.embedding")}>
              <ModelSelect
                value={vectorValue}
                onChange={handleVectorChange}
                type={MODEL_USE_TYPE.EMBEDDING}
                placeholder={t("model.select_model")}
              />
            </Form.Item>
          </Form>

          <Button
            type="primary"
            className="mt-6"
            loading={saving}
            onClick={debouncedSave}
          >
            {t("action_save")}
          </Button>
        </div>
      </Spin>
    </div>
  );
}

export default KnowledgeModel;
