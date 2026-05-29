import { useState, useEffect, useRef, useCallback } from "react";
import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  message,
  Modal,
  Spin,
  Image,
} from "antd";
import CodeMirror from "@uiw/react-codemirror";
import { t } from "@/locales";
import { SvgIcon } from "@km/shared-components-react";
import { graphTemplatesApi, uploadApi } from "@/api";
import type {
  GraphTemplateEntity,
  GraphTemplateRelation,
  GraphTemplateDetail,
} from "@/api/modules/graph-templates/types";
import { api_host } from "@/utils/config";
import IconPopover from "@/components/Icon/popover";
import { createIconFileFromStatic } from "@km/shared-utils";

interface CreateDrawerFormProps {
  open: boolean;
  templateId?: string | null;
  initialData?: {
    type: string;
    data: { sceneDesc?: string; jsonTemplate?: string } | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

interface EntityWithId extends GraphTemplateEntity {
  _id: string;
}

interface RelationWithId {
  sourceId: string;
  predicate: string;
  targetId: string;
}

const generateId = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

const DEFAULT_GRAPH_LOGO = `${api_host}/api/images/library/graph-icon.png`;

const preprocessJsonString = (str: string): string => {
  let jsonStr = str.trim();
  jsonStr = jsonStr
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");
  return jsonStr.trim();
};

export function CreateDrawerForm({
  open,
  templateId,
  initialData,
  onClose,
  onSaved,
}: CreateDrawerFormProps) {
  const [form] = Form.useForm();
  const [viewMode, setViewMode] = useState<"form" | "json">("form");
  const [jsonContent, setJsonContent] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [entities, setEntities] = useState<EntityWithId[]>([]);
  const [relations, setRelations] = useState<RelationWithId[]>([]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [logo, setLogo] = useState(DEFAULT_GRAPH_LOGO);
  const [originalFormData, setOriginalFormData] = useState("");

  const addingPropertyEntityIndex = useRef<number | null>(null);
  const newPropertyName = useRef("");
  const editingProperty = useRef<{ entityIndex: number; index: number } | null>(
    null,
  );
  const editingPropertyName = useRef("");
  const addPropertyInputRef = useRef<HTMLInputElement | null>(null);
  const editPropertyInputRef = useRef<HTMLInputElement | null>(null);

  const isEdit = !!templateId;

  const drawerTitle = isEdit ? t("action.edit") : t("action.create");

  // 用于记录初始状态，配合 useEffect 在 state 更新后执行
  const shouldRecordInitialData = useRef(false);

  const resetForm = useCallback(() => {
    form.resetFields();
    setViewMode("form");
    setJsonContent("");
    setAiGenerating(false);
    setIconFile(null);
    setLogo(DEFAULT_GRAPH_LOGO);
    setEntities([
      { _id: generateId(), name: "", properties: [], order_num: 1 },
    ]);
    setRelations([]);
    addingPropertyEntityIndex.current = null;
    newPropertyName.current = "";
    editingProperty.current = null;
    editingPropertyName.current = "";
    setOriginalFormData("");
  }, [form]);

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail: GraphTemplateDetail = await graphTemplatesApi.get(id);
      form.setFieldsValue({
        name: detail.name,
        description: detail.description || "",
      });
      setLogo(detail.logo || (detail as any).icon || DEFAULT_GRAPH_LOGO);

      const safeParseArray = <T,>(value: unknown): T[] => {
        if (Array.isArray(value)) return value as T[];
        if (typeof value === "string") {
          const raw = value.trim();
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as T[]) : [];
          } catch {
            return [];
          }
        }
        return [];
      };

      const parsedEntities = safeParseArray<GraphTemplateEntity>(
        detail.entities,
      );
      const newEntities = parsedEntities.length
        ? parsedEntities.map((e, i) => ({ ...e, _id: generateId() }))
        : [{ _id: generateId(), name: "", properties: [], order_num: 1 }];
      setEntities(newEntities);

      const parsedRelations = safeParseArray<GraphTemplateRelation>(
        detail.relations,
      );
      const newRelations = parsedRelations.map((r) => {
        const sourceEntity = newEntities.find(
          (e) => e.name.trim() === (r.source || "").trim(),
        );
        const targetEntity = newEntities.find(
          (e) => e.name.trim() === (r.target || "").trim(),
        );
        return {
          sourceId: sourceEntity?._id || "",
          predicate: r.predicate || "",
          targetId: targetEntity?._id || "",
        };
      });
      setRelations(newRelations);
      // 数据加载完成后记录初始状态
      shouldRecordInitialData.current = true;
    } catch (error) {
      console.error(t("graph_template.fetch_detail_failed"), error);
    } finally {
      setDetailLoading(false);
    }
  };

  // 在 entities/relations 更新后记录初始状态
  useEffect(() => {
    if (shouldRecordInitialData.current && open) {
      shouldRecordInitialData.current = false;
      setTimeout(() => {
        setOriginalFormData(
          JSON.stringify({
            form: form.getFieldsValue(),
            entities,
            relations,
          }),
        );
      }, 0);
    }
  }, [entities, relations, open, form]);

  // 抽屉关闭时清理状态（处理外部设置 open=false 的情况）
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) {
      resetForm();
    }
    wasOpen.current = open;
  }, [open, resetForm]);

  // 监听 open 和 initialData
  useEffect(() => {
    if (!open) return;

    if (templateId) {
      loadDetail(templateId);
    } else if (initialData) {
      if (initialData.type === "import" && initialData.data?.jsonTemplate) {
        setViewMode("form");
        setJsonContent(initialData.data.jsonTemplate);
        try {
          const parsed = JSON.parse(
            preprocessJsonString(initialData.data.jsonTemplate),
          );
          form.setFieldsValue({
            name: parsed.ontology_name || parsed.name || "",
            description: parsed.description || "",
          });
          setLogo(parsed.logo || parsed.icon || DEFAULT_GRAPH_LOGO);

          let newEntities: EntityWithId[] = [];
          if (Array.isArray(parsed.entities)) {
            newEntities = parsed.entities.map((e: any, index: number) => ({
              _id: generateId(),
              name: e.name || "",
              properties: Array.isArray(e.properties) ? e.properties : [],
              order_num: index + 1,
            }));
          }
          setEntities(newEntities);

          const relationships = parsed.relationships || parsed.relations;
          if (Array.isArray(relationships)) {
            setRelations(
              relationships.map((r: any) => {
                const sourceEntity = newEntities.find(
                  (e) => e.name.trim() === (r.source || "").trim(),
                );
                const targetEntity = newEntities.find(
                  (e) => e.name.trim() === (r.target || "").trim(),
                );
                return {
                  sourceId: sourceEntity?._id || "",
                  predicate: r.predicate || r.relation || "",
                  targetId: targetEntity?._id || "",
                };
              }),
            );
          }
        } catch (e) {
          console.error("JSON parsing error on init:", e);
        }
      } else if (initialData.type === "auto" && initialData.data?.sceneDesc) {
        form.setFieldsValue({ description: initialData.data.sceneDesc });
        setViewMode("form");
      } else if (initialData.type === "manual") {
        form.resetFields();
        setViewMode("form");
        setEntities([
          { _id: generateId(), name: "", properties: [], order_num: 1 },
        ]);
        setRelations([]);
      }
    } else {
      resetForm();
    }
    // 创建模式下数据初始化完成后，标记需要记录初始状态
    if (!templateId) {
      shouldRecordInitialData.current = true;
    }
  }, [open, templateId, initialData]);

  // 监听 templateId 变化（抽屉已打开时切换编辑对象）
  useEffect(() => {
    if (!open) return;
    if (templateId) {
      loadDetail(templateId);
    } else {
      // 由编辑切换为创建
      resetForm();
    }
  }, [templateId]);

  const handleViewModeClick = (mode: "form" | "json") => {
    if (viewMode === mode) return;
    setViewMode(mode);
    handleViewModeChange(mode);
  };

  const handleViewModeChange = (newVal: string) => {
    if (newVal === "json") {
      const nameRelations = relations.map((r) => {
        const sourceEntity = entities.find((e) => e._id === r.sourceId);
        const targetEntity = entities.find((e) => e._id === r.targetId);
        return {
          source: sourceEntity?.name || "",
          predicate: r.predicate,
          target: targetEntity?.name || "",
        };
      });
      const data = {
        ontology_name: form.getFieldValue("name"),
        description: form.getFieldValue("description"),
        logo,
        entities: entities.map((e) => ({
          name: e.name,
          properties: e.properties,
        })),
        relationships: nameRelations,
      };
      setJsonContent(JSON.stringify(data, null, 2));
    } else if (newVal === "form") {
      try {
        const parsed = JSON.parse(preprocessJsonString(jsonContent));
        form.setFieldsValue({
          name: parsed.ontology_name || parsed.name || "",
          description: parsed.description || "",
        });
        setLogo(parsed.logo || parsed.icon || "");

        let newEntities: EntityWithId[] = [];
        if (Array.isArray(parsed.entities)) {
          newEntities = parsed.entities.map((e: any, index: number) => ({
            _id: generateId(),
            name: e.name || "",
            properties: Array.isArray(e.properties) ? e.properties : [],
            order_num: index + 1,
          }));
        }
        setEntities(newEntities);

        const relationships = parsed.relationships || parsed.relations;
        if (Array.isArray(relationships)) {
          setRelations(
            relationships.map((r: any) => {
              const sourceEntity = newEntities.find(
                (e) => e.name.trim() === (r.source || "").trim(),
              );
              const targetEntity = newEntities.find(
                (e) => e.name.trim() === (r.target || "").trim(),
              );
              return {
                sourceId: sourceEntity?._id || "",
                predicate: r.predicate || r.relation || "",
                targetId: targetEntity?._id || "",
              };
            }),
          );
        } else {
          setRelations([]);
        }

        // 切换到表单模式时验证字段长度
        const parsedName = (form.getFieldValue("name") || "").trim();
        if (parsedName.length > 50) {
          message.warning(t("graph_template.name_length_error"));
          setViewMode("json");
          return;
        }
        const desc = form.getFieldValue("description") || "";
        if (desc.length > 200) {
          message.warning(t("graph_template.desc_length_error"));
          setViewMode("json");
          return;
        }
        for (const entity of newEntities) {
          const entityName = (entity.name || "").trim();
          if (entityName && entityName.length > 50) {
            message.warning(t("graph_template.entity_name_length_error"));
            setViewMode("json");
            return;
          }
          if (Array.isArray(entity.properties)) {
            for (const prop of entity.properties) {
              if (typeof prop === "string" && prop.length > 200) {
                message.warning(t("graph_template.property_length_error"));
                setViewMode("json");
                return;
              }
            }
          }
        }
        for (const rel of relationships || []) {
          const predicate = (rel.predicate || "").trim();
          if (predicate && predicate.length > 50) {
            message.warning(t("graph_template.predicate_length_error"));
            setViewMode("json");
            return;
          }
        }
      } catch (e) {
        message.warning(t("graph_template.json_format_invalid"));
        setViewMode("json");
      }
    }
  };

  const handleBeforeClose = () => {
    const currentData = JSON.stringify({
      form: form.getFieldsValue(),
      entities,
      relations,
    });
    if (currentData !== originalFormData) {
      Modal.confirm({
        title: t("tip"),
        content: t("cleaning_policy.unsaved_confirm_message"),
        okText: t("action_confirm"),
        cancelText: t("action_cancel"),
        onOk: () => {
          onClose();
          resetForm();
        },
      });
    } else {
      onClose();
      resetForm();
    }
  };

  const onIconParams = async (params: {
    icon: string;
    bgLight: string;
    bgDark: string;
  }) => {
    if (params.icon && params.bgLight && params.bgDark) {
      const file = await createIconFileFromStatic(
        params.icon,
        params.bgLight,
        params.bgDark,
        {
          size: 100,
          iconPadding: 24,
          radius: 10,
        },
      );
      setIconFile(file as File);
      setLogo(URL.createObjectURL(file));
    } else {
      setIconFile(null);
    }
  };

  const addEntity = () => {
    const order = entities.length + 1;
    setEntities([
      ...entities,
      { _id: generateId(), name: "", properties: [], order_num: order },
    ]);
  };

  const removeEntity = (index: number) => {
    const removed = entities[index];
    const newEntities = entities.filter((_, i) => i !== index);
    setEntities(newEntities.map((item, i) => ({ ...item, order_num: i + 1 })));

    const removedId = removed?._id;
    if (removedId) {
      setRelations(
        relations.filter(
          (rel) => rel.sourceId !== removedId && rel.targetId !== removedId,
        ),
      );
    }
  };

  const updateEntityName = (index: number, name: string) => {
    const newEntities = [...entities];
    newEntities[index] = { ...newEntities[index], name };
    setEntities(newEntities);
  };

  const removeProperty = (entityIndex: number, index: number) => {
    const newEntities = [...entities];
    newEntities[entityIndex].properties = [
      ...newEntities[entityIndex].properties,
    ];
    newEntities[entityIndex].properties.splice(index, 1);
    setEntities(newEntities);
  };

  const startAddProperty = (entityIndex: number) => {
    addingPropertyEntityIndex.current = entityIndex;
    newPropertyName.current = "";
    setEntities([...entities]); // trigger re-render to show input
    setTimeout(() => {
      addPropertyInputRef.current?.focus();
    }, 0);
  };

  const confirmAddProperty = () => {
    if (addingPropertyEntityIndex.current === null) return;
    const name = newPropertyName.current.trim();
    if (name) {
      const newEntities = [...entities];
      newEntities[addingPropertyEntityIndex.current] = {
        ...newEntities[addingPropertyEntityIndex.current],
        properties: [
          ...newEntities[addingPropertyEntityIndex.current].properties,
          name,
        ],
      };
      setEntities(newEntities);
    }
    addingPropertyEntityIndex.current = null;
    newPropertyName.current = "";
  };

  const isEditingProperty = (entityIndex: number, index: number) => {
    return (
      editingProperty.current?.entityIndex === entityIndex &&
      editingProperty.current?.index === index
    );
  };

  const startEditProperty = (
    entityIndex: number,
    index: number,
    value: string,
  ) => {
    editingProperty.current = { entityIndex, index };
    editingPropertyName.current = value;
    setTimeout(() => {
      editPropertyInputRef.current?.focus();
    }, 0);
  };

  const confirmEditProperty = () => {
    if (!editingProperty.current) return;
    const name = editingPropertyName.current.trim();
    if (name) {
      const { entityIndex, index } = editingProperty.current;
      const newEntities = [...entities];
      const newProps = [...newEntities[entityIndex].properties];
      newProps[index] = name;
      newEntities[entityIndex] = {
        ...newEntities[entityIndex],
        properties: newProps,
      };
      setEntities(newEntities);
    }
    editingProperty.current = null;
    editingPropertyName.current = "";
    setTimeout(() => {
      editPropertyInputRef.current?.blur();
    }, 0);
  };

  const addRelation = () => {
    if (!entities.length) {
      message.warning(t("graph_template.add_entity_first"));
      return;
    }

    const firstEntityWithName = entities.find(
      (entity) => !!entity.name && entity.name.trim().length > 0,
    );
    if (!firstEntityWithName) {
      message.warning(t("graph_template.fill_entity_name"));
      return;
    }

    setRelations([{ sourceId: "", predicate: "", targetId: "" }, ...relations]);
  };

  const removeRelation = (index: number) => {
    setRelations(relations.filter((_, i) => i !== index));
  };

  const updateRelation = (
    index: number,
    field: keyof RelationWithId,
    value: string,
  ) => {
    const newRelations = [...relations];
    newRelations[index] = { ...newRelations[index], [field]: value };
    setRelations(newRelations);
  };

  const handleAiGenerate = async () => {
    if (entities.length < 2) {
      message.warning(t("graph_template.config_two_entities"));
      return;
    }
    if (entities.every((e) => !e.name && e.properties.length === 0)) {
      message.warning(t("graph_template.complete_entity_info"));
      return;
    }

    setAiGenerating(true);
    try {
      const res = await graphTemplatesApi.suggestRelations({
        entities: entities.map((item, index) => ({
          name: item.name || t("graph_template.entity_type") + (index + 1),
          properties: item.properties,
          order_num: item.order_num ?? index + 1,
        })),
        context: form.getFieldValue("description"),
      });
      const aiRelations = res.relations || [];
      setRelations(
        aiRelations.map((r: any) => {
          const sourceEntity = entities.find(
            (e) => e.name.trim() === (r.source || "").trim(),
          );
          const targetEntity = entities.find(
            (e) => e.name.trim() === (r.target || "").trim(),
          );
          return {
            sourceId: sourceEntity?._id || "",
            predicate: r.predicate || "",
            targetId: targetEntity?._id || "",
          };
        }),
      );
      message.success(t("graph_template.ai_generate_success"));
    } catch (error) {
      console.error(t("graph_template.ai_generate_failed"), error);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (viewMode === "json") {
      try {
        const parsed = JSON.parse(preprocessJsonString(jsonContent));
        form.setFieldsValue({
          name: parsed.ontology_name || parsed.name || "",
          description: parsed.description || "",
        });
        setLogo(parsed.logo || parsed.icon || "");

        let newEntities: EntityWithId[] = [];
        if (Array.isArray(parsed.entities)) {
          newEntities = parsed.entities.map((e: any, index: number) => ({
            _id: generateId(),
            name: e.name || "",
            properties: Array.isArray(e.properties) ? e.properties : [],
            order_num: index + 1,
          }));
        }
        setEntities(newEntities);

        const relationships = parsed.relationships || parsed.relations;
        if (Array.isArray(relationships)) {
          const validEntityNames = new Set(
            (parsed.entities || [])
              .map((e: any) => (e.name || "").trim())
              .filter((n: string) => n.length > 0),
          );
          const invalidRelations = relationships.filter((r: any) => {
            const source = (r.source || "").trim();
            const target = (r.target || "").trim();
            return (
              (source && !validEntityNames.has(source)) ||
              (target && !validEntityNames.has(target))
            );
          });
          if (invalidRelations.length > 0) {
            message.warning(t("graph_template.relation_entity_not_found"));
            return;
          }
          setRelations(
            relationships.map((r: any) => {
              const sourceEntity = newEntities.find(
                (e) => e.name.trim() === (r.source || "").trim(),
              );
              const targetEntity = newEntities.find(
                (e) => e.name.trim() === (r.target || "").trim(),
              );
              return {
                sourceId: sourceEntity?._id || "",
                predicate: r.predicate || r.relation || "",
                targetId: targetEntity?._id || "",
              };
            }),
          );
        } else {
          setRelations([]);
        }

        // JSON 模式下字段长度验证
        const name = (form.getFieldValue("name") || "").trim();
        if (!name) {
          message.warning(t("graph_template.name_placeholder"));
          return;
        }
        if (name.length < 2 || name.length > 50) {
          message.warning(t("graph_template.name_length_error"));
          return;
        }
        const desc = form.getFieldValue("description") || "";
        if (desc.length > 200) {
          message.warning(t("graph_template.desc_length_error"));
          return;
        }
        for (const entity of newEntities) {
          const entityName = (entity.name || "").trim();
          if (entityName && entityName.length > 50) {
            message.warning(t("graph_template.entity_name_length_error"));
            return;
          }
          if (Array.isArray(entity.properties)) {
            for (const prop of entity.properties) {
              if (typeof prop === "string" && prop.length > 200) {
                message.warning(t("graph_template.property_length_error"));
                return;
              }
            }
          }
        }
        for (const rel of relationships || []) {
          const predicate = (rel.predicate || "").trim();
          if (predicate && predicate.length > 50) {
            message.warning(t("graph_template.predicate_length_error"));
            return;
          }
        }
      } catch (e) {
        message.warning(t("graph_template.json_format_error"));
        return;
      }
    }

    if (viewMode === "form") {
      try {
        await form.validateFields();
      } catch {
        return;
      }
    }

    const hasValidEntity = entities.some((entity) => {
      const nameValid = !!entity.name && entity.name.trim().length > 0;
      const hasProperties =
        Array.isArray(entity.properties) && entity.properties.length > 0;
      return nameValid && hasProperties;
    });

    if (!hasValidEntity) {
      message.warning(t("graph_template.config_one_entity"));
      return;
    }

    const entityNames = entities
      .map((entity) => (entity.name || "").trim())
      .filter((name) => name.length > 0);

    const hasDuplicateEntityName =
      new Set(entityNames).size !== entityNames.length;
    if (hasDuplicateEntityName) {
      message.warning(t("graph_template.entity_name_duplicate"));
      return;
    }

    if (!relations.length) {
      message.warning(t("graph_template.config_one_relation"));
      return;
    }

    const entitySet = new Set<string>();
    for (const entity of entities) {
      const trimmedName = entity.name.trim();
      if (entitySet.has(trimmedName)) {
        message.warning(
          t("graph_template.duplicate_entity_name", { name: trimmedName }),
        );
        return;
      }
      entitySet.add(trimmedName);
    }

    const hasInvalidRelation = relations.some((rel) => {
      const sourceId = (rel.sourceId || "").trim();
      const predicate =
        typeof rel.predicate === "string" ? rel.predicate.trim() : "";
      const targetId = (rel.targetId || "").trim();
      return sourceId === "" || predicate === "" || targetId === "";
    });

    if (hasInvalidRelation) {
      message.warning(t("graph_template.incomplete_relation"));
      return;
    }

    const relationSet = new Set<string>();
    for (const rel of relations) {
      const key = `${rel.sourceId}-${rel.predicate.trim()}-${rel.targetId}`;
      if (relationSet.has(key)) {
        const sourceEntity = entities.find((e) => e._id === rel.sourceId);
        const targetEntity = entities.find((e) => e._id === rel.targetId);
        message.warning(
          t("graph_template.duplicate_relation", {
            source: sourceEntity?.name || "",
            predicate: rel.predicate,
            target: targetEntity?.name || "",
          }),
        );
        return;
      }
      relationSet.add(key);
    }

    const validEntityIds = new Set(entities.map((e) => e._id));
    for (const rel of relations) {
      if (
        !validEntityIds.has(rel.sourceId) ||
        !validEntityIds.has(rel.targetId)
      ) {
        message.warning(t("graph_template.relation_entity_not_found"));
        return;
      }
    }

    const cleanedEntities = entities.map((entity) => {
      const name = (entity.name || "").trim();
      if (!name)
        return { name: "", properties: [], order_num: entity.order_num };
      const props = Array.isArray(entity.properties)
        ? [
            ...new Set(
              entity.properties
                .filter((p) => typeof p === "string")
                .map((p) => (p as string).trim())
                .filter((p) => p.length > 0),
            ),
          ]
        : [];
      return { name, properties: props, order_num: entity.order_num };
    });

    // 将关系从 ID 引用转换为名称引用
    const cleanedRelations = relations.map((rel) => {
      const sourceEntity = entities.find((e) => e._id === rel.sourceId);
      const targetEntity = entities.find((e) => e._id === rel.targetId);
      return {
        source: sourceEntity?.name || "",
        predicate: rel.predicate.trim(),
        target: targetEntity?.name || "",
      };
    });

    const basePayload = {
      name: form.getFieldValue("name"),
      description: form.getFieldValue("description"),
      logo,
      entities: cleanedEntities,
      relations: cleanedRelations,
    };

    // 检查名称是否已存在
    try {
      const existingList = await graphTemplatesApi.list({
        keyword: form.getFieldValue("name")?.trim(),
        limit: 100,
      });
      const duplicateItem = (existingList.items || []).find(
        (item: any) =>
          item.name.trim() === form.getFieldValue("name")?.trim() &&
          item.id !== templateId,
      );
      if (duplicateItem) {
        message.warning(t("graph_template.name_duplicate"));
        return;
      }
    } catch (error) {
      console.error("Failed to check name uniqueness:", error);
    }

    if (iconFile) {
      try {
        const res = await uploadApi.upload(iconFile);
        basePayload.logo = `${api_host}/api/preview/${res.data?.preview_key || ""}`;
      } catch (error) {
        console.error("Upload icon failed:", error);
      }
    }

    try {
      if (isEdit && templateId) {
        await graphTemplatesApi.update(templateId, basePayload);
        message.success(t("action_update_success"));
      } else {
        await graphTemplatesApi.create(basePayload);
        message.success(t("message_status.create_success"));
      }
      onSaved();
      onClose();
      resetForm();
    } catch (error) {
      console.error(t("action_save_failed"), error);
    }
  };

  return (
    <Drawer
      open={open}
      title={drawerTitle}
      onClose={handleBeforeClose}
      styles={{ wrapper: { width: 912 }, body: { padding: 24, overflow: "hidden" } }}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={handleBeforeClose}>{t("action_cancel")}</Button>
          <Button
            type="primary"
            onClick={handleCreate}
            disabled={detailLoading}
          >
            {t("action_save")}
          </Button>
        </div>
      }
    >
      <Spin
        spinning={detailLoading}
        classNames={{
          root: "h-full",
          container: "h-full",
        }}
      >
        <div className="h-full overflow-hidden flex flex-col">
          <div className="flex-none flex items-center mb-4">
            <div className="flex p-0.5 gap-0.5 bg-[#F5F6F8] rounded-lg">
              <div
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${
                  viewMode === "form"
                    ? "bg-white text-[#2563EB] shadow-sm"
                    : "text-[#939499] hover:text-[#4F5052]"
                }`}
                onClick={() => handleViewModeClick("form")}
              >
                <SvgIcon name="view-list" size="16" />
                <span>{t("graph_template.form")}</span>
              </div>
              <div
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${
                  viewMode === "json"
                    ? "bg-white text-[#2563EB] shadow-sm"
                    : "text-[#939499] hover:text-[#4F5052]"
                }`}
                onClick={() => handleViewModeClick("json")}
              >
                <SvgIcon name="terminal" size="16" />
                <span>JSON</span>
              </div>
            </div>
          </div>

          {viewMode === "form" && (
            <div className="flex-1 px-1 overflow-y-auto">
              <Form form={form} layout="vertical" labelCol={{ span: 24 }}>
                <div className="flex items-start gap-4 mb-4">
                  <IconPopover value={logo} showBg onIconParams={onIconParams}>
                    <div className="size-[60px] border border-gray-200 rounded flex items-center justify-center shadow-sm cursor-pointer transition-all hover:shadow-md overflow-hidden">
                      {logo && (
                        <Image
                          src={logo}
                          width={60}
                          height={60}
                          style={{ objectFit: "contain" }}
                          preview={false}
                          fallback="/images/default_agent.png"
                        />
                      )}
                    </div>
                  </IconPopover>
                  <Form.Item
                    name="name"
                    label={t("graph_template.name_label")}
                    rules={[
                      {
                        required: true,
                        message: t("graph_template.name_placeholder"),
                      },
                      {
                        min: 2,
                        max: 50,
                        message: t("graph_template.name_length_error"),
                      },
                    ]}
                    className="flex-1 mb-0"
                  >
                    <Input
                      placeholder={t("graph_template.name_placeholder")}
                      maxLength={50}
                      showCount
                    />
                  </Form.Item>
                </div>
                <Form.Item
                  name="description"
                  label={t("graph_template.desc_label")}
                  rules={[
                    {
                      max: 200,
                      message: t("graph_template.desc_length_error"),
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={3}
                    maxLength={200}
                    showCount
                    style={{ resize: "none" }}
                    placeholder={t("graph_template.desc_placeholder")}
                  />
                </Form.Item>

                <Form.Item label="" className="custom-form-item">
                  <div className="w-full flex items-center justify-between gap-2">
                    <span>{t("graph_template.core_entity")}</span>
                    <Button type="primary" size="small" onClick={addEntity}>
                      <SvgIcon name="plus" size="14" />
                      {t("graph_template.add")}
                    </Button>
                  </div>
                  <div className="w-full flex flex-col gap-2 mt-2">
                    {entities.map((entity, entityIndex) => (
                      <div
                        key={entity._id}
                        className="border rounded-md p-4 flex items-start gap-3 group"
                      >
                        <div className="flex-1">
                          <div className="h-8 flex items-center text-base text-[#1D1E1F] border-b">
                            <input
                              type="text"
                              value={entity.name}
                              onChange={(e) =>
                                updateEntityName(entityIndex, e.target.value)
                              }
                              className="w-full outline-none"
                              placeholder={t("graph_template.name_placeholder")}
                              maxLength={50}
                            />
                          </div>
                          <div className="flex flex-wrap mt-2 gap-2">
                            {entity.properties.map((prop, index) => (
                              <div
                                key={`${prop}-${index}`}
                                className="flex items-center px-2 gap-1 bg-[#f7f7f8] rounded-md min-h-[22px] py-0.5 border border-[#E6E8EB]"
                              >
                                {isEditingProperty(entityIndex, index) ? (
                                  <input
                                    ref={editPropertyInputRef}
                                    defaultValue={prop}
                                    onChange={(e) =>
                                      (editingPropertyName.current =
                                        e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                      e.key === "Enter" && confirmEditProperty()
                                    }
                                    onBlur={confirmEditProperty}
                                    className="text-xs text-[#1d1e1f] bg-transparent outline-none w-[90px]"
                                    maxLength={200}
                                  />
                                ) : (
                                  <>
                                    <span
                                      className="text-xs text-[#1d1e1f] cursor-pointer break-all"
                                      onClick={() =>
                                        startEditProperty(
                                          entityIndex,
                                          index,
                                          prop,
                                        )
                                      }
                                    >
                                      {prop}
                                    </span>
                                    <SvgIcon
                                      name="close"
                                      size="10"
                                      color="#1D1E1F"
                                      className="cursor-pointer"
                                      onClick={() =>
                                        removeProperty(entityIndex, index)
                                      }
                                    />
                                  </>
                                )}
                              </div>
                            ))}
                            {addingPropertyEntityIndex.current ===
                            entityIndex ? (
                              <div className="h-[26px] flex items-center">
                                <input
                                  ref={addPropertyInputRef}
                                  placeholder={t(
                                    "graph_template.property_placeholder",
                                  )}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") confirmAddProperty();
                                  }}
                                  onBlur={confirmAddProperty}
                                  onChange={(e) =>
                                    (newPropertyName.current = e.target.value)
                                  }
                                  className="text-xs text-[#1d1e1f] bg-transparent outline-none border border-[#E6E8EB] rounded-md px-2 h-[26px] w-[140px]"
                                  maxLength={200}
                                />
                              </div>
                            ) : (
                              <div
                                className="flex flex-col justify-center items-center bg-[#fafbfc] rounded w-[26px] h-[26px] border border-dotted border-[#e6e8eb] cursor-pointer"
                                onClick={() => startAddProperty(entityIndex)}
                              >
                                <span className="text-sm leading-[7px] text-[#dedede]">
                                  +
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        {entities.length > 1 && (
                          <Button
                            type="link"
                            className="opacity-0 group-hover:opacity-100"
                            onClick={() => removeEntity(entityIndex)}
                          >
                            <SvgIcon name="delete" size="16" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Form.Item>

                <Form.Item label="" className="custom-form-item">
                  <div className="w-full flex items-center justify-between gap-2">
                    <span>{t("data_pipeline.graph_relation_type")}</span>
                    <div className="flex items-center gap-2">
                      <Button type="primary" size="small" onClick={addRelation}>
                        <SvgIcon name="plus" size="14" />
                        {t("graph_template.add")}
                      </Button>
                      <Button
                        size="small"
                        style={{
                          backgroundColor: "#8063E3",
                          color: "#fff",
                          borderColor: "#8063E3",
                        }}
                        loading={aiGenerating}
                        onClick={handleAiGenerate}
                      >
                        <SvgIcon name="star-four" size="14" />
                        {t("graph_template.ai_generate")}
                      </Button>
                    </div>
                  </div>
                  <div className="w-full p-4 flex flex-col gap-2 border rounded-md bg-[#F9FAFC] mt-2">
                    {relations.length === 0 && (
                      <div className="text-xs text-[#999999]">
                        {t("graph_template.no_relation_hint")}
                      </div>
                    )}
                    {relations.map((rel, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-[#4F5052] group"
                      >
                        <Select
                          value={rel.sourceId || undefined}
                          className="flex-1"
                          onChange={(val) =>
                            updateRelation(index, "sourceId", val)
                          }
                          placeholder={t(
                            "graph_template.source_entity_placeholder",
                          )}
                          style={{ width: 120 }}
                          options={entities
                            .filter((e) => e.name.trim())
                            .map((e) => ({
                              label: e.name,
                              value: e._id,
                            }))}
                        />
                        <Input
                          value={rel.predicate}
                          className="flex-1"
                          onChange={(e) =>
                            updateRelation(index, "predicate", e.target.value)
                          }
                          placeholder={t(
                            "graph_template.relation_type_placeholder",
                          )}
                          maxLength={50}
                          style={{ width: 120 }}
                        />
                        <Select
                          value={rel.targetId || undefined}
                          className="flex-1"
                          onChange={(val) =>
                            updateRelation(index, "targetId", val)
                          }
                          placeholder={t(
                            "graph_template.target_entity_placeholder",
                          )}
                          style={{ width: 120 }}
                          options={entities
                            .filter((e) => e.name.trim())
                            .map((e) => ({
                              label: e.name,
                              value: e._id,
                            }))}
                        />
                        <SvgIcon
                          name="delete"
                          size="16"
                          className="flex-none cursor-pointer opacity-0 group-hover:opacity-100"
                          onClick={() => removeRelation(index)}
                        />
                      </div>
                    ))}
                  </div>
                </Form.Item>
              </Form>
            </div>
          )}

          {viewMode === "json" && (
            <div className="flex-1 border border-[#E6E8EB] rounded-md overflow-hidden bg-[#FAFBFC]">
              <CodeMirror
                value={jsonContent}
                onChange={(value) => setJsonContent(value)}
                autoFocus
                indentWithTab
                tabSize={2}
                height="500px"
                className="h-full w-full text-sm [&_.cm-editor]:h-full"
              />
            </div>
          )}
        </div>
      </Spin>
    </Drawer>
  );
}

export default CreateDrawerForm;
