import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  Input,
  InputNumber,
  Collapse,
  Switch,
  Modal,
  message,
  Spin,
  Form,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import { t } from "@/locales";
import GroupSelect from "@/components/GroupSelect";
import { skillApi } from "@/api/modules/skill";
import { groupApi } from "@/api/modules/group";
import { GROUP_TYPE } from "@/constants/group";
import { useEnterpriseStore } from "@/stores";
import {
  PublishStatus_TYPE,
  AdminStatus_TYPE,
} from "@/api/modules/skill/types";
import { getSimpleDateFormatString } from "@km/shared-utils";
import { PageHeader } from "@/components/PageLayout";
import { useSkillEditStore } from "@/stores/modules/skillEdit";
import SkillFileTree from "./SkillFileTree";
import SkillFileEditor from "./SkillFileEditor";
import { validateUsageGuide, type UsageItem, type QualityScore } from "../utils/usageValidation";

export type { UsageItem, QualityScore };

interface SkillData {
  id: string;
  name: string;
  display_name: string;
  description: string;
  groups: number[];
  admin_status: string;
  publish_status: string;
  type: "repo" | "upload";
  subscription_group_ids: number[];
  user_group_ids: number[];
  github_url: string;
  version: string;
  sort: number;
}

interface UsageSwitches {
  quality_scores: boolean;
  capabilities: boolean;
  usage_example: boolean;
  best_practice: boolean;
  faq: boolean;
}

interface UsageItems {
  quality_scores: QualityScore[];
  capabilities: UsageItem[];
  usage_example: UsageItem[];
  bestPracticesPositive: UsageItem[];
  bestPracticesNegative: UsageItem[];
  faq: UsageItem[];
}

const usageOptions = [
  {
    key: "quality_scores" as const,
    title: "质量评分",
    svgIcon: "lightning_v2",
    iconBg: "bg-[#EE770219]",
    description: "围绕功能完整、安全可靠、代码规范、文档完备，综合评估技能质量",
  },
  {
    key: "capabilities" as const,
    title: "能做什么",
    svgIcon: "smile",
    iconBg: "bg-[#F9545419]",
    description: "清晰说明此技能的核心功能与适用场景，快速了解其价值",
  },
  {
    key: "usage_example" as const,
    title: "使用示例",
    svgIcon: "three-lines",
    iconBg: "bg-[#3B82F619]",
    description: "提供具体的使用场景与操作范例，直观掌握使用方法",
  },
  {
    key: "best_practice" as const,
    title: "最佳实践",
    svgIcon: "bulb",
    iconBg: "bg-[#4F46E519]",
    description: "分享高效使用此技能的技巧与推荐流程",
  },
  {
    key: "faq" as const,
    title: "常见问题",
    svgIcon: "question",
    svgColor: "#00BAAD",
    iconBg: "bg-[#14B8A619]",
    description: "汇总高频问题与对应解决方案，快速排查并解决问题",
  },
];

export default function SkillDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const enterpriseStore = useEnterpriseStore();
  const [basicForm] = Form.useForm();

  const skillId = searchParams.get("skill_id");
  const isNew = searchParams.get("isNew") === "true";

  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [activeCollapse, setActiveCollapse] = useState(["basic", "usage"]);
  const [lastSaved, setLastSaved] = useState("");

  const [skill, setSkill] = useState<SkillData>({
    id: "",
    name: "New Skill",
    display_name: "新技能",
    description: "",
    groups: [],
    admin_status: "",
    publish_status: "",
    type: "repo",
    subscription_group_ids: [],
    user_group_ids: [],
    github_url: "",
    version: "v1.0.0",
    sort: 0,
  });

  const [usageSwitches, setUsageSwitches] = useState<UsageSwitches>({
    quality_scores: true,
    capabilities: false,
    usage_example: false,
    best_practice: false,
    faq: false,
  });

  const [usageItems, setUsageItems] = useState<UsageItems>({
    quality_scores: [
      { key: "completeness", label: "完整性", value: 0.0 },
      { key: "practicality", label: "实用性", value: 0.0 },
      { key: "security", label: "安全性", value: 0.0 },
      { key: "code_quality", label: "代码质量", value: 0.0 },
      { key: "documentation", label: "文档质量", value: 0.0 },
    ],
    capabilities: [],
    usage_example: [],
    bestPracticesPositive: [],
    bestPracticesNegative: [],
    faq: [],
  });

  // 弹窗状态
  const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);
  const [isAddContentModalOpen, setIsAddContentModalOpen] = useState(false);
  const [currentAddingSection, setCurrentAddingSection] = useState<
    string | null
  >(null);
  const [editingItem, setEditingItem] = useState<UsageItem | null>(null);
  const [contentForm, setContentForm] = useState({
    title: "",
    description: "",
  });

  // AI 生成状态
  const [aiGeneratingSections, setAiGeneratingSections] = useState<Set<string>>(
    new Set(),
  );

  const isAiGenerating = (sectionKey: string) =>
    aiGeneratingSections.has(sectionKey);

  const setAiGenerating = (sectionKey: string, isGenerating: boolean) => {
    setAiGeneratingSections((prev) => {
      const newSet = new Set(prev);
      if (isGenerating) {
        newSet.add(sectionKey);
      } else {
        newSet.delete(sectionKey);
      }
      return newSet;
    });
  };

  const isFaqSection = currentAddingSection === "faq";

  // 原始表单数据，用于判断是否有变更
  const originalFormDataRef = useRef<string>("");

  const isUnSaved = useCallback(() => {
    if (!originalFormDataRef.current) return false;
    const currentData = JSON.stringify({ skill, usageSwitches, usageItems });
    return currentData !== originalFormDataRef.current;
  }, [skill, usageSwitches, usageItems]);

  const hasEnabledUsageSection = Object.values(usageSwitches).some((v) => v);

  // 使用 skillEditStore
  const {
    init: initSkillEdit,
    hasAnyChanges,
    isCurrentFileDirty,
    batchSaveAll,
  } = useSkillEditStore();

  // 初始化
  useEffect(() => {
    if (skillId) {
      loadSkillData();
      initSkillEdit(skillId);
    } else {
      setLoading(false);
    }
  }, [skillId]);

  // beforeunload 拦截
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAnyChanges || isCurrentFileDirty || isUnSaved()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasAnyChanges, isCurrentFileDirty, isUnSaved]);

  const loadSkillData = async () => {
    if (!skillId) return;
    setLoading(true);
    try {
      const [detail, skillsGroups, userGroups, internalUserGroups] =
        await Promise.all([
          skillApi.detail({ skill_id: skillId }),
          groupApi
            .list({ params: { group_type: GROUP_TYPE.SKILLS } })
            .catch(() => []),
          groupApi
            .list({ params: { group_type: GROUP_TYPE.USER } })
            .catch(() => []),
          groupApi
            .list({ params: { group_type: GROUP_TYPE.INTERNAL_USER } })
            .catch(() => []),
        ]);

      const skillsGroupIds = new Set(skillsGroups.map((g: any) => g.group_id));
      const userGroupIds = new Set(userGroups.map((g: any) => g.group_id));
      const internalUserGroupIds = new Set(
        internalUserGroups.map((g: any) => g.group_id),
      );

      const permissionGroupIds = detail.permission_group_ids || [];
      const groups: number[] = [];
      const subscriptionGroupIds: number[] = [];
      const userGroupIdsList: number[] = [];

      permissionGroupIds.forEach((id: number) => {
        if (skillsGroupIds.has(id)) {
          groups.push(id);
        } else if (userGroupIds.has(id)) {
          subscriptionGroupIds.push(id);
        } else if (internalUserGroupIds.has(id)) {
          userGroupIdsList.push(id);
        }
      });

      const skillData = detail.skill;
      const newSkill: SkillData = {
        id: skillData.id,
        name: skillData.skill_name,
        display_name: skillData.display_name || "",
        description: skillData.description || "",
        groups,
        subscription_group_ids: subscriptionGroupIds,
        user_group_ids: userGroupIdsList,
        admin_status: skillData.admin_status,
        publish_status: skillData.publish_status,
        type: skillData.source_type === "github" ? "repo" : "upload",
        github_url: skillData.source_type === "github" ? detail.github_url : "",
        version: skillData.version || "v1.0.0",
        sort: skillData.sort || 0,
      };
      setSkill(newSkill);

      const newQualityScores: QualityScore[] = [
        {
          key: "completeness",
          label: "完整性",
          value: Number(skillData.score_integrity ?? 0),
        },
        {
          key: "practicality",
          label: "实用性",
          value: Number(skillData.score_practicality ?? 0),
        },
        {
          key: "security",
          label: "安全性",
          value: Number(skillData.score_safety ?? 0),
        },
        {
          key: "code_quality",
          label: "代码质量",
          value: Number(skillData.score_code_quality ?? 0),
        },
        {
          key: "documentation",
          label: "文档质量",
          value: Number(skillData.score_doc_quality ?? 0),
        },
      ];

      let newUsageSwitches: UsageSwitches = {
        quality_scores: true,
        capabilities: false,
        usage_example: false,
        best_practice: false,
        faq: false,
      };
      let newUsageItems: UsageItems = {
        quality_scores: newQualityScores,
        capabilities: [],
        usage_example: [],
        bestPracticesPositive: [],
        bestPracticesNegative: [],
        faq: [],
      };

      if (skillData.usage_guide) {
        try {
          const usageGuide = JSON.parse(skillData.usage_guide);
          if (usageGuide.quality_scores) {
            newUsageSwitches.quality_scores = true;
            newUsageItems.quality_scores = usageGuide.quality_scores.map(
              (item: any) => ({
                key: item.key,
                label: item.label,
                value: Number(item.value),
              }),
            );
          }
          if (usageGuide.capabilities) {
            newUsageSwitches.capabilities = true;
            newUsageItems.capabilities = usageGuide.capabilities.map(
              (item: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                ...item,
              }),
            );
          }
          if (usageGuide.usage_example) {
            newUsageSwitches.usage_example = true;
            newUsageItems.usage_example = usageGuide.usage_example.map(
              (item: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                ...item,
              }),
            );
          }
          if (usageGuide.best_practice) {
            newUsageSwitches.best_practice = true;
            newUsageItems.bestPracticesPositive =
              usageGuide.best_practice.positive?.map((item: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                ...item,
              })) || [];
            newUsageItems.bestPracticesNegative =
              usageGuide.best_practice.negative?.map((item: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                ...item,
              })) || [];
          }
          if (usageGuide.faq) {
            newUsageSwitches.faq = true;
            newUsageItems.faq = usageGuide.faq.map((item: any) => ({
              id: Math.random().toString(36).substr(2, 9),
              ...item,
            }));
          }
        } catch {}
      }

      setUsageSwitches(newUsageSwitches);
      setUsageItems(newUsageItems);

      if (skillData.updated_time) {
        setLastSaved(
          getSimpleDateFormatString({
            date: skillData.updated_time,
            format: "YYYY-MM-DD hh:mm",
          }),
        );
      }

      originalFormDataRef.current = JSON.stringify({
        skill: newSkill,
        usageSwitches: newUsageSwitches,
        usageItems: newUsageItems,
      });

      basicForm.setFieldsValue({
        name: newSkill.name,
        display_name: newSkill.display_name,
      });
    } catch (error) {
      console.error("Failed to load skill:", error);
      message.error("加载技能数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (hasAnyChanges || isCurrentFileDirty || isUnSaved()) {
      Modal.confirm({
        title: t("tip"),
        content: t("skills.unsaved_confirm_message"),
        okText: t("action_confirm"),
        cancelText: t("action.cancel"),
        onOk: () => {
          useSkillEditStore.getState().reset();
          navigate("/skills");
        },
      });
    } else {
      navigate("/skills");
    }
  };

  const toggleUsageSwitch = (key: keyof UsageSwitches) => {
    setUsageSwitches((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAIGenerate = async (generationType: string) => {
    if (!skill.id) {
      message.warning("技能ID不能为空");
      return;
    }

    setAiGenerating(generationType, true);

    try {
      const response = await skillApi.aiGenerate(skill.id, {
        generation_type: generationType,
      });

      const content = response.data?.content;
      if (!content) {
        message.warning("AI生成内容为空");
        return;
      }

      switch (generationType) {
        case "capabilities":
          if (content.title) {
            setUsageItems((prev) => ({
              ...prev,
              capabilities: [
                ...prev.capabilities,
                {
                  id: Math.random().toString(36).substr(2, 9),
                  title: content.title,
                  description: content.description || "",
                },
              ],
            }));
          }
          break;
        case "usage_example":
          if (content.question) {
            setUsageItems((prev) => ({
              ...prev,
              usage_example: [
                ...prev.usage_example,
                {
                  id: Math.random().toString(36).substr(2, 9),
                  title: content.question,
                  description: content.answer || "",
                },
              ],
            }));
          }
          break;
        case "best_practice":
          if (content.positive_case) {
            setUsageItems((prev) => ({
              ...prev,
              bestPracticesPositive: [
                ...prev.bestPracticesPositive,
                {
                  id: Math.random().toString(36).substr(2, 9),
                  title: content.positive_case,
                  description: "",
                },
              ],
            }));
          }
          if (content.negative_case) {
            setUsageItems((prev) => ({
              ...prev,
              bestPracticesNegative: [
                ...prev.bestPracticesNegative,
                {
                  id: Math.random().toString(36).substr(2, 9),
                  title: content.negative_case,
                  description: "",
                },
              ],
            }));
          }
          break;
        case "faq":
          if (content.question) {
            setUsageItems((prev) => ({
              ...prev,
              faq: [
                ...prev.faq,
                {
                  id: Math.random().toString(36).substr(2, 9),
                  title: content.question,
                  description: content.answer || "",
                },
              ],
            }));
          }
          break;
      }

      message.success("AI 生成成功");
    } catch (error) {
      console.error("AI生成失败:", error);
      message.error("AI 生成失败");
    } finally {
      setAiGenerating(generationType, false);
    }
  };

  const handleAddContent = (sectionKey: string) => {
    setCurrentAddingSection(sectionKey);
    setEditingItem(null);
    setContentForm({ title: "", description: "" });
    setIsAddContentModalOpen(true);
  };

  const handleEditContent = (sectionKey: string, item: UsageItem) => {
    setCurrentAddingSection(sectionKey);
    setEditingItem(item);
    setContentForm({ title: item.title, description: item.description });
    setIsAddContentModalOpen(true);
  };

  const handleDeleteContent = (sectionKey: string, itemId: string) => {
    setUsageItems((prev) => {
      const key =
        sectionKey === "capabilities"
          ? "capabilities"
          : sectionKey === "usage_example"
            ? "usage_example"
            : sectionKey === "bestPracticesPositive"
              ? "bestPracticesPositive"
              : sectionKey === "bestPracticesNegative"
                ? "bestPracticesNegative"
                : "faq";
      return {
        ...prev,
        [key]: prev[key].filter((item) => item.id !== itemId),
      };
    });
  };

  const handleAddBestPractice = (
    sectionKey: "bestPracticesPositive" | "bestPracticesNegative",
  ) => {
    setUsageItems((prev) => ({
      ...prev,
      [sectionKey]: [
        ...prev[sectionKey],
        {
          id: Math.random().toString(36).substr(2, 9),
          title: "",
          description: "",
        },
      ],
    }));
  };

  const handleConfirmAddContent = () => {
    if (!currentAddingSection) return;
    if (!contentForm.title.trim() || !contentForm.description.trim()) return;

    const sectionKey = currentAddingSection as keyof UsageItems;

    if (editingItem) {
      setUsageItems((prev) => ({
        ...prev,
        [sectionKey]: prev[sectionKey].map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                title: contentForm.title,
                description: contentForm.description,
              }
            : item,
        ),
      }));
    } else {
      setUsageItems((prev) => ({
        ...prev,
        [sectionKey]: [
          ...prev[sectionKey],
          {
            id: Math.random().toString(36).substr(2, 9),
            title: contentForm.title,
            description: contentForm.description,
          },
        ],
      }));
    }
    setIsAddContentModalOpen(false);
  };

  const buildUsageGuide = () => {
    const usageGuide: any = {};

    if (usageSwitches.quality_scores) {
      usageGuide.quality_scores = usageItems.quality_scores.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.value,
      }));
    }

    if (usageSwitches.capabilities) {
      usageGuide.capabilities = usageItems.capabilities
        .filter((item) => item.title.trim())
        .map((item) => ({ title: item.title, description: item.description }));
    }

    if (usageSwitches.usage_example) {
      usageGuide.usage_example = usageItems.usage_example
        .filter((item) => item.title.trim())
        .map((item) => ({ title: item.title, description: item.description }));
    }

    if (usageSwitches.best_practice) {
      usageGuide.best_practice = {
        positive: usageItems.bestPracticesPositive
          .filter((item) => item.title.trim())
          .map((item) => ({ title: item.title })),
        negative: usageItems.bestPracticesNegative
          .filter((item) => item.title.trim())
          .map((item) => ({ title: item.title })),
      };
    }

    if (usageSwitches.faq) {
      usageGuide.faq = usageItems.faq
        .filter((item) => item.title.trim())
        .map((item) => ({ title: item.title, description: item.description }));
    }

    return JSON.stringify(usageGuide);
  };

  const handlePublish = async () => {
    try {
      await basicForm.validateFields();
    } catch (err) {
      return;
    }

    if (!skill.groups.length) {
      message.warning("请至少选择一个分组");
      return;
    }

    // 验证使用说明：启用的区块必须有有效内容
    const validation = validateUsageGuide(usageSwitches, usageItems);
    if (!validation.valid) {
      message.warning(validation.message);
      return;
    }

    // 如果当前文件有未保存的更改，弹出确认框
    if (isCurrentFileDirty) {
      useSkillEditStore.getState().showConfirmModal({
        visible: true,
        message: '有未保存的更改，是否保存？',
        confirmText: '保存',
        onConfirm: async () => {
          useSkillEditStore.getState().hideConfirmModal()
          await doPublish()
        },
        onCancel: () => {
          useSkillEditStore.getState().hideConfirmModal()
        },
      })
      return
    }

    await doPublish()
  };

  const doPublish = async () => {
    setPublishing(true);
    try {
      // 先保存当前编辑中的文件到暂存区
      const { isCurrentFileDirty, saveCurrentToPending, batchSaveAll } = useSkillEditStore.getState()
      if (isCurrentFileDirty) {
        saveCurrentToPending()
      }

      // 批量保存：更新技能信息 + 文件修改
      const success = await batchSaveAll({
        display_name: skill.display_name,
        description: skill.description,
        usage_guide: buildUsageGuide(),
        version: skill.version,
        sort: Number(skill.sort) || 0,
        admin_status:
          skill.publish_status === PublishStatus_TYPE.draft
            ? AdminStatus_TYPE.enabled
            : skill.admin_status,
        group_ids: skill.groups,
        subscription_group_ids: skill.subscription_group_ids,
        user_group_ids: skill.user_group_ids,
      }, isUnSaved());

      if (!success) {
        message.error("发布失败，请重试");
        return;
      }

      setLastSaved(
        getSimpleDateFormatString({
          date: Date.now(),
          format: "YYYY-MM-DD hh:mm",
        }),
      );

      originalFormDataRef.current = JSON.stringify({
        skill,
        usageSwitches,
        usageItems,
      });
      message.success("发布成功");
    } catch (error) {
      console.error("发布失败:", error);
      message.error("发布失败，请重试");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 !px-0 !py-0 w-full h-full flex flex-col overflow-hidden bg-[#FCFCFF]">
      <div className="flex-none px-6 py-3 border-b border-[#E9EEF7] bg-[#F7F9FC]">
        <PageHeader
          config={{
            title: skill.name,
            description: skill.description || "请输入技能描述...",
            back: true,
            onBack: handleBack,
            right: (
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400">
                  最近保存：{lastSaved}
                </span>
                <Button
                  type="primary"
                  loading={publishing}
                  className="bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                  onClick={handlePublish}
                >
                  发布
                </Button>
              </div>
            ),
          }}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧面板：表单 */}
        <div className="w-1/3 flex flex-col border-r border-[#E9EEF7]">
          <div className="px-6 py-4 bg-[#F7F9FC]">技能配置</div>
          <div className="overflow-y-auto flex-1">
            <Collapse
              ghost
              activeKey={activeCollapse}
              onChange={(keys) => setActiveCollapse(keys as string[])}
              expandIconPosition="start"
              className="[&_.ant-collapse-header]:px-8 [&_.ant-collapse-header]:font-medium [&_.ant-collapse-header]:flex [&_.ant-collapse-header]:items-center [&_.ant-collapse-header]:h-12 [&_.ant-collapse-header]:bg-[#FCFCFF] [&_.ant-collapse-content]:px-9 [&_.ant-collapse-content]:bg-[#FCFCFF] [&_.ant-collapse-item]:border-[#F0F0F0] border-b-0"
            >
              {/* 基础信息 */}
              <Collapse.Panel key="basic" header="基础信息">
                <Form
                  form={basicForm}
                  layout="vertical"
                  onValuesChange={(changedValues) => {
                    if (changedValues.display_name !== undefined) {
                      setSkill((prev) => ({
                        ...prev,
                        display_name: changedValues.display_name,
                      }));
                    }
                  }}
                  className="[&_.ant-form-item-label>label]:text-sm [&_.ant-form-item-label>label]:text-[#333] [&_.ant-form-item-label>label]:uppercase [&_.ant-form-item-label>label]:tracking-wide [&_.ant-input]:py-1 [&_.ant-input]:px-3 [&_.ant-input]:text-sm"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item label="技能" name="name">
                      <Input disabled />
                    </Form.Item>
                    <Form.Item
                      label="显示名称"
                      name="display_name"
                      rules={[{ required: true, message: "请输入显示名称" }]}
                    >
                      <Input maxLength={50} showCount />
                    </Form.Item>
                  </div>

                  <Form.Item label="描述">
                    <Input.TextArea
                      value={skill.description}
                      onChange={(e) =>
                        setSkill((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                      maxLength={500}
                      showCount
                      style={{ resize: "none" }}
                      placeholder="请输入技能描述..."
                    />
                  </Form.Item>

                  <div className="grid grid-cols-2 gap-4">
                    {skill.type === "repo" && (
                      <Form.Item label="仓库地址">
                        <Input value={skill.github_url} disabled />
                      </Form.Item>
                    )}
                    <Form.Item label="版本">
                      <Input
                        value={skill.version}
                        onChange={(e) =>
                          setSkill((prev) => ({
                            ...prev,
                            version: e.target.value,
                          }))
                        }
                        maxLength={15}
                        showCount
                      />
                    </Form.Item>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Form.Item label="分组" required>
                      <GroupSelect
                        value={skill.groups}
                        onChange={(val: number[]) =>
                          setSkill((prev) => ({ ...prev, groups: val }))
                        }
                        groupType={GROUP_TYPE.SKILLS}
                        defaultFirst
                        multiple
                      />
                    </Form.Item>
                    <Form.Item
                      label={
                        <>
                          <span className="text-sm text-[#333]">排序</span>
                          <span className="text-xs font-normal text-gray-400 ml-2">
                            数字越大，排名越靠前
                          </span>
                        </>
                      }
                    >
                      <Input
                        value={skill.sort}
                        onChange={(e) =>
                          setSkill((prev) => ({
                            ...prev,
                            sort: Number(e.target.value),
                          }))
                        }
                      />
                    </Form.Item>
                  </div>

                  {/* 权限配置 */}
                  <div className="mt-4">
                    <div className="text-sm text-[#333] mb-2">权限配置</div>
                    <div className="ml-2 space-y-3">
                      {(enterpriseStore.info.is_independent ||
                        enterpriseStore.info.is_industry) && (
                        <Form.Item label={t("register_user.title")}>
                          <GroupSelect
                            value={skill.subscription_group_ids}
                            onChange={(val: number[]) =>
                              setSkill((prev) => ({
                                ...prev,
                                subscription_group_ids: val,
                              }))
                            }
                            type="checkbox"
                            groupType={GROUP_TYPE.USER}
                            defaultAll={
                              skill.publish_status === PublishStatus_TYPE.draft
                            }
                            multiple
                          />
                        </Form.Item>
                      )}
                      {(enterpriseStore.info.is_enterprise ||
                        enterpriseStore.info.is_industry) && (
                        <Form.Item label={t("internal_user.title")}>
                          <GroupSelect
                            value={skill.user_group_ids}
                            onChange={(val: number[]) =>
                              setSkill((prev) => ({
                                ...prev,
                                user_group_ids: val,
                              }))
                            }
                            type="picker"
                            groupType={GROUP_TYPE.INTERNAL_USER}
                            defaultAll={
                              skill.publish_status === PublishStatus_TYPE.draft
                            }
                            multiple
                          />
                        </Form.Item>
                      )}
                    </div>
                  </div>
                </Form>
              </Collapse.Panel>

              {/* 使用说明 */}
              <Collapse.Panel key="usage" header="使用说明">
                {hasEnabledUsageSection ? (
                  <div className="flex flex-col gap-4">
                    {usageOptions.map(
                      (option) =>
                        usageSwitches[option.key] && (
                          <div
                            key={option.key}
                            className="bg-[#F7F8FA] rounded-xl p-4 relative group border hover:shadow border-transparent transition-all"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`size-7 rounded-md flex items-center justify-center cursor-pointer ${option.iconBg}`}
                                >
                                  <SvgIcon name={option.svgIcon} size={16} color={option.svgColor} />
                                </div>
                                <span className="text-sm font-semibold text-gray-900 cursor-pointer">
                                  {option.title}
                                </span>
                                {option.key !== "quality_scores" && (
                                  <span
                                    className="flex items-center px-2 py-0.5 bg-[#F3F0FF] hover:opacity-60 text-[#8063E3] rounded text-sm cursor-pointer"
                                    onClick={() => handleAIGenerate(option.key)}
                                  >
                                    <SvgIcon
                                      name="star-four-2"
                                      size={12}
                                      className="mr-1"
                                    />
                                    {isAiGenerating(option.key)
                                      ? "生成中"
                                      : "AI生成"}
                                  </span>
                                )}
                              </div>
                              <SvgIcon
                                name="delete"
                                className="invisible group-hover:visible text-gray-400 hover:text-red-500 cursor-pointer"
                                onClick={() => toggleUsageSwitch(option.key)}
                              />
                            </div>

                            {/* 质量评分 */}
                            {option.key === "quality_scores" && (
                              <div className="space-y-2 mt-4">
                                {usageItems.quality_scores.map((scoreItem) => (
                                  <div
                                    key={scoreItem.key}
                                    className="flex items-center border border-[#d9d9d9] rounded hover:border-[#4096ff] focus-within:border-[#4096ff]"
                                  >
                                    <span className="text-sm text-gray-600 w-[90px] text-center bg-[#f5f5f5] py-1 border-r border-[#d9d9d9]">
                                      {scoreItem.label}
                                    </span>
                                    <InputNumber
                                      value={scoreItem.value}
                                      onChange={(val) => {
                                        const newScores =
                                          usageItems.quality_scores.map((s) =>
                                            s.key === scoreItem.key
                                              ? { ...s, value: val ?? 0 }
                                              : s,
                                          );
                                        setUsageItems((prev) => ({
                                          ...prev,
                                          quality_scores: newScores,
                                        }));
                                      }}
                                      min={0}
                                      max={5}
                                      step={0.1}
                                      controls={false}
                                      variant="borderless"
                                      className="flex-1 bg-white"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* 最佳实践 */}
                            {option.key === "best_practice" && (
                              <div className="space-y-4 mt-4">
                                <div>
                                  <p className="text-sm text-gray-900 mb-3">
                                    正面案例
                                  </p>
                                  <div className="space-y-3">
                                    {usageItems.bestPracticesPositive.map(
                                      (item) => (
                                        <div
                                          key={item.id}
                                          className="flex items-center gap-3"
                                        >
                                          <Input.TextArea
                                            value={item.title}
                                            onChange={(e) => {
                                              setUsageItems((prev) => ({
                                                ...prev,
                                                bestPracticesPositive:
                                                  prev.bestPracticesPositive.map(
                                                    (i) =>
                                                      i.id === item.id
                                                        ? {
                                                            ...i,
                                                            title:
                                                              e.target.value,
                                                          }
                                                        : i,
                                                  ),
                                              }));
                                            }}
                                            rows={2}
                                            maxLength={200}
                                            showCount
                                            style={{ resize: "none" }}
                                            placeholder="请输入正面案例"
                                            className="flex-1"
                                          />
                                          <SvgIcon
                                            name="delete"
                                            className="text-gray-400 hover:text-red-500 cursor-pointer"
                                            onClick={() =>
                                              handleDeleteContent(
                                                "bestPracticesPositive",
                                                item.id,
                                              )
                                            }
                                          />
                                        </div>
                                      ),
                                    )}
                                    <Button
                                      type="link"
                                      icon={<PlusOutlined />}
                                      onClick={() =>
                                        handleAddBestPractice(
                                          "bestPracticesPositive",
                                        )
                                      }
                                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium h-8 px-2"
                                    >
                                      添加
                                    </Button>
                                  </div>
                                </div>

                                <div className="pt-4 border-t border-[#E6E8EB]">
                                  <p className="text-sm text-gray-900 mb-3">
                                    反面案例
                                  </p>
                                  <div className="space-y-3">
                                    {usageItems.bestPracticesNegative.map(
                                      (item) => (
                                        <div
                                          key={item.id}
                                          className="flex items-center gap-3"
                                        >
                                          <Input.TextArea
                                            value={item.title}
                                            onChange={(e) => {
                                              setUsageItems((prev) => ({
                                                ...prev,
                                                bestPracticesNegative:
                                                  prev.bestPracticesNegative.map(
                                                    (i) =>
                                                      i.id === item.id
                                                        ? {
                                                            ...i,
                                                            title:
                                                              e.target.value,
                                                          }
                                                        : i,
                                                  ),
                                              }));
                                            }}
                                            rows={2}
                                            maxLength={200}
                                            showCount
                                            style={{ resize: "none" }}
                                            placeholder="请输入反面案例"
                                            className="flex-1"
                                          />
                                          <SvgIcon
                                            name="delete"
                                            className="text-gray-400 hover:text-red-500 cursor-pointer"
                                            onClick={() =>
                                              handleDeleteContent(
                                                "bestPracticesNegative",
                                                item.id,
                                              )
                                            }
                                          />
                                        </div>
                                      ),
                                    )}
                                    <Button
                                      type="link"
                                      icon={<PlusOutlined />}
                                      onClick={() =>
                                        handleAddBestPractice(
                                          "bestPracticesNegative",
                                        )
                                      }
                                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium h-8 px-2"
                                    >
                                      添加
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 通用结构：能做什么、使用示例、常见问题 */}
                            {option.key !== "quality_scores" &&
                              option.key !== "best_practice" && (
                                <div className="flex flex-wrap gap-2 items-center mt-4">
                                  {usageItems[
                                    option.key === "usage_example"
                                      ? "usage_example"
                                      : option.key
                                  ]?.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center gap-2 h-[38px] px-3 bg-white rounded-lg text-sm text-gray-700"
                                    >
                                      <span>{item.title}</span>
                                      <div className="flex items-center gap-1 text-base">
                                        <SvgIcon
                                          name="edit"
                                          className="text-gray-400 hover:text-blue-500 cursor-pointer"
                                          onClick={() =>
                                            handleEditContent(option.key, item)
                                          }
                                        />
                                        <SvgIcon
                                          name="delete"
                                          className="text-gray-400 hover:text-red-500 cursor-pointer"
                                          onClick={() =>
                                            handleDeleteContent(
                                              option.key,
                                              item.id,
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                  ))}
                                  <Button
                                    type="link"
                                    icon={<PlusOutlined />}
                                    onClick={() => handleAddContent(option.key)}
                                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium h-8 px-2"
                                  >
                                    添加
                                  </Button>
                                </div>
                              )}
                          </div>
                        ),
                    )}

                    <div className="flex justify-center mb-3">
                      <Button
                        onClick={() => setIsUsageModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-50 border-none text-blue-600 rounded-3xl text-sm font-medium hover:bg-blue-100 transition-all"
                      >
                        <PlusOutlined /> 添加
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 space-y-4">
                    <p className="text-xs">你可以添加一些该技能的使用说明</p>
                    <Button
                      className="flex items-center gap-1 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors"
                      onClick={() => setIsUsageModalOpen(true)}
                    >
                      <PlusOutlined /> 添加
                    </Button>
                  </div>
                )}
              </Collapse.Panel>
            </Collapse>
          </div>
        </div>

        {/* 右侧面板：文件树 + 编辑器 */}
        <div className="w-2/3 h-full flex flex-col">
          <div className="py-4 pl-6">源文件</div>
          <div className="flex-1 flex flex-col overflow-hidden border-t border-[#E6E8EB]">
            <div className="flex-1 flex overflow-hidden">
              {/* 文件树 */}
              <div className="min-w-[240px] border-r border-[#E9EEF7] flex flex-col bg-[#FAFBFC]">
                <div className="px-4 py-3 text-sm font-medium text-[#333] border-b border-[#E9EEF7]">
                  目录
                </div>
                <div className="flex-1 overflow-y-auto">
                  <SkillFileTree />
                </div>
              </div>

              {/* 文件编辑器 */}
              <div className="flex-1 overflow-y-auto">
                <SkillFileEditor />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 使用说明弹窗 */}
      <Modal
        open={isUsageModalOpen}
        title="使用说明"
        onCancel={() => setIsUsageModalOpen(false)}
        footer={null}
        width={560}
      >
        <div className="space-y-4">
          {usageOptions.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#F7F8FA] hover:shadow group"
            >
              <div
                className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}
              >
                <SvgIcon name={item.svgIcon} size={20} color={item.svgColor} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-400 truncate">
                  {item.description}
                </p>
              </div>
              <Switch
                checked={usageSwitches[item.key]}
                onChange={() => toggleUsageSwitch(item.key)}
              />
            </div>
          ))}
        </div>
      </Modal>

      {/* 添加/编辑内容弹窗 */}
      <Modal
        open={isAddContentModalOpen}
        title={editingItem ? "编辑" : "添加"}
        onCancel={() => setIsAddContentModalOpen(false)}
        onOk={handleConfirmAddContent}
        okButtonProps={{
          disabled:
            !contentForm.title.trim() || !contentForm.description.trim(),
        }}
      >
        <div className="space-y-4">
          <Form.Item label={isFaqSection ? "问题" : "标题"}>
            <Input
              value={contentForm.title}
              onChange={(e) =>
                setContentForm((prev) => ({ ...prev, title: e.target.value }))
              }
              maxLength={20}
              showCount
              placeholder={isFaqSection ? "请输入问题" : "请填写内容标题"}
            />
          </Form.Item>
          <Form.Item label={isFaqSection ? "回答" : "描述"}>
            <Input.TextArea
              value={contentForm.description}
              onChange={(e) =>
                setContentForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={8}
              maxLength={1000}
              showCount
              style={{ resize: "none" }}
              placeholder={isFaqSection ? "请输入回答" : "请填写输出的内容"}
            />
          </Form.Item>
        </div>
      </Modal>
    </div>
  );
}
