import { forwardRef, useImperativeHandle, useEffect, useState } from "react";
import { Form } from "antd";
import { useAgentForm } from "../hooks";
import { useAgentCreateAdapter, ChannelOption } from "../adapters";
import {
  BaseConfig,
  ExpandConfig,
  RelateAgents,
  RoleInstruction,
} from "../components";
import { ModelSelect } from "@km/shared-components-react";

interface PromptProps {
  showChannelConfig?: boolean;
  className?: string;
}

export interface PromptRef {
  validateForm: () => Promise<boolean>;
}

export const Prompt = forwardRef<PromptRef, PromptProps>(
  ({ showChannelConfig, className }, ref) => {
    const [antdForm] = Form.useForm();
    const form = useAgentForm();
    const adapter = useAgentCreateAdapter();
    const t = adapter.t || ((key: string) => key);
    const [modelOptions, setModelOptions] = useState<ChannelOption[]>([]);
    const [modelLoading, setModelLoading] = useState(false);

    // 使用 hook 获取状态
    const model = form.formData.model;
    const name = form.formData.name;
    const logo = form.formData.logo;
    const group_id = form.formData.group_id;
    const sort = form.formData.sort;

    // 加载模型列表
    useEffect(() => {
      if (showChannelConfig && adapter.loadModels) {
        setModelLoading(true);
        adapter.loadModels()
          .then(setModelOptions)
          .finally(() => setModelLoading(false));
      }
    }, [showChannelConfig, adapter]);

    // 同步表单数据到 Ant Design Form
    useEffect(() => {
      antdForm.setFieldsValue({
        model,
        name,
        logo,
        group_id,
        sort,
      });
    }, [model, name, logo, group_id, sort, antdForm]);

    const onModelChange = (value: string, option: any) => {
      form.updateFields({
        model: value,
        settings: {
          ...form.formData.settings,
          image_parse: {
            ...form.formData.settings.image_parse,
            vision: option?.vision || false,
            enable: option?.vision ? form.formData.settings.image_parse.enable : false,
          },
        },
      });
      form.setSupportImage(option?.vision || false);
    };

    const validateForm = async () => {
      try {
        await antdForm.validateFields();
        return true;
      } catch {
        return false;
      }
    };

    useImperativeHandle(ref, () => ({
      validateForm,
    }));

    return (
      <div className={`${className || ""}`}>
        <Form
          form={antdForm}
          layout="vertical"
          initialValues={{ model, name, logo, group_id, sort }}
          classNames={{
            root: 'h-full flex flex-col'
          }}

        >
          {showChannelConfig ? (
            <>
              <Form.Item
                label={t("term.access_model")}
                name="model"
                rules={[{ required: true, message: t("form.select_placeholder") }]}
                getValueProps={() => ({ value: model })}
              >
                <ModelSelect
                  valueKey="model_value"
                  onChange={onModelChange}
                  options={modelOptions}
                  loading={modelLoading}
                  t={t}
                />
              </Form.Item>
              <RoleInstruction />
            </>
          ) : (
            <>
              <BaseConfig />
              <RelateAgents />
              <ExpandConfig />
            </>
          )}
        </Form>
      </div>
    );
  },
);

Prompt.displayName = "Prompt";

export default Prompt;
