import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  PlusOutlined,
  CopyOutlined,
  CheckOutlined,
  QuestionCircleOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import { Button, Tag, Collapse, Spin, message } from "antd";
import { SvgIcon } from "@km/shared-components-react";
import { copyToClip } from "@km/shared-utils";
import { StarRating } from "@/components/StarRating";
import { useSkillsStore } from "@/stores/modules/skills";
import { useNavigationStore } from "@/stores/modules/navigation";
import { skillApi } from "@/api/modules/skill";
import type { Skill } from "@/api/modules/skill/types";

const getStarClipRight = (starIndex: number, value: number): number => {
  if (starIndex <= Math.floor(value)) {
    return 0;
  } else if (starIndex === Math.ceil(value)) {
    const decimal = value - Math.floor(value);
    return (1 - decimal) * 100;
  } else {
    return 100;
  }
};

const getQualityIcon = (key: string) => {
  const iconMap: Record<string, string> = {
    completeness: "check_v3",
    practicality: "tool",
    security: "protect",
    code_quality: "folder_v2",
    documentation: "edit-one",
  };
  return iconMap[key] || "check_v3";
};

const SkillDetail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const skillsStore = useSkillsStore();
  const navigationStore = useNavigationStore();

  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeFaq, setActiveFaq] = useState("0");

  const type = (searchParams.get("type") as "explore" | "my") || "explore";
  const id = searchParams.get("id");

  const usageGuide = useMemo(() => {
    if (!skill?.usage_guide) return null;
    try {
      return JSON.parse(skill.usage_guide);
    } catch {
      return null;
    }
  }, [skill]);

  const qualityItems = useMemo(() => {
    if (!usageGuide?.quality_scores) return null;
    return usageGuide.quality_scores.map((item: any) => ({
      label: item.label,
      value: Math.round(item.value * 10) / 10, // 保留一位小数
      icon: getQualityIcon(item.key),
    }));
  }, [usageGuide]);

  const capabilities = useMemo(() => {
    if (!usageGuide?.capabilities) return [];
    return usageGuide.capabilities.map((item: any) => ({
      title: item.title,
      desc: item.description || "",
    }));
  }, [usageGuide]);

  const usageExamples = useMemo(() => {
    if (!usageGuide?.usage_example) return [];
    return usageGuide.usage_example.map((item: any) => ({
      title: item.title,
      desc: item.description || "",
    }));
  }, [usageGuide]);

  const positiveCases = useMemo(() => {
    if (!usageGuide?.best_practice?.positive) return [];
    return usageGuide.best_practice.positive.map(
      (item: any) => item.title || item,
    );
  }, [usageGuide]);

  const negativeCases = useMemo(() => {
    if (!usageGuide?.best_practice?.negative) return [];
    return usageGuide.best_practice.negative.map(
      (item: any) => item.title || item,
    );
  }, [usageGuide]);

  const faqs = useMemo(() => {
    if (!usageGuide?.faq) return [];
    return usageGuide.faq.map((item: any) => ({
      q: item.title,
      a: item.description || "",
    }));
  }, [usageGuide]);

  const fetchSkillDetail = async () => {
    if (!id) {
      message.error("技能ID不能为空");
      navigate("/skills");
      return;
    }

    setLoading(true);
    try {
      const data = await skillApi.getDetail(id);
      setSkill(data);
    } catch (error) {
      message.error("获取技能详情失败");
      console.error("获取技能详情失败:", error);
      navigate("/skills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkillDetail();
  }, [id]);

  const handleBack = () => {
    navigate({
      pathname: "/skills",
      search: type === "my" ? "?from=my" : "",
    });
  };

  const handleUse = () => {
    if (!skill) return;
    if (!navigationStore.hasWorkBench) {
      message.warning("工作台功能未开启，无法使用此技能");
      return;
    }
    if (skill.binding_status !== "enabled") {
      message.warning("请先启用技能再使用");
      return;
    }
    navigate({
      pathname: "/index",
      search: `?skill_id=${skill.id}&type=${type}`,
    });
  };

  const handleAdd = async () => {
    if (!skill || skill.added) return;
    try {
      await skillApi.addToMy(skill.id);
      fetchSkillDetail();
      await skillsStore.loadSkillList({ isRefresh: true });
      await skillsStore.loadMySkillList(true);
      message.success("技能添加成功");
    } catch (error) {
      message.error("添加失败");
    }
  };

  const handleDownload = async () => {
    if (!skill?.id) return;

    try {
      const blob = await skillApi.downloadSkillPackage(skill.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${skill.display_name}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      message.success("下载成功");
    } catch (error) {
      message.error("下载失败，请重试");
      console.error("下载技能包失败:", error);
    }
  };

  const handleCopy = async (text: string) => {
    await copyToClip(text);
    message.success("已复制");
  };

  if (!skill) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-white overflow-y-auto flex items-center justify-center">
        {loading && <Spin />}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white overflow-y-auto">
      <div className="h-16 flex items-center gap-1 pl-4 shrink-0">
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={handleBack}
          className="flex items-center justify-center"
        />
        {skill.display_name}
      </div>
      <div className="w-11/12 lg:w-4/5 max-w-[1200px] mx-auto py-6">

        <div className="mb-10">
          <div className="flex items-start gap-6">
            <div className="size-14 bg-[#F0F2F5] rounded-xl flex items-center justify-center shrink-0">
              <SvgIcon name="skill" size={28} color="#2563EB" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold text-gray-900">
                  {skill.display_name}
                </h1>
                <Tag className="text-xs rounded-3xl truncate max-w-[80px]" title={skill.version}>{skill.version}</Tag>
              </div>
              <p className="text-sm text-gray-400 mb-4">{skill.skill_name}</p>
            </div>
          </div>
          <p className="text-[#939499] mb-6 w-full">{skill.description}</p>
          <div className="flex items-center gap-3">
            {skill.added ? (
              <Button type="primary" onClick={handleUse}>
                工作台使用
              </Button>
            ) : (
              <Button type="primary" onClick={handleAdd}>
                <PlusOutlined className="mr-1" />
                添加技能
              </Button>
            )}
            <Button onClick={handleDownload}>
              <SvgIcon name="download-2" size={16} className="mr-1" />
              下载
            </Button>
          </div>
        </div>

        {qualityItems && qualityItems.length > 0 && (
          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-4">质量评分</h2>
            <div className="grid grid-cols-5 gap-4 border border-[#E6E8EB] p-5 rounded-xl">
              {qualityItems.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#F4F6F9] rounded-xl p-6 flex flex-col items-center justify-center gap-2"
                >
                  <div className="size-8 bg-[#e8edf8] rounded-full flex items-center justify-center">
                    <SvgIcon name={item.icon} size={16} color="#2563EB" />
                  </div>
                  <p className="text-sm mb-2">{item.label}</p>
                  <div className="flex items-center justify-center gap-1">
                    <StarRating value={item.value} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {capabilities.length > 0 && (
          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-4">能做什么</h2>
            <div className="grid grid-cols-3 gap-6">
              {capabilities.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#F4F6F9] rounded-xl p-6 border border-[#E6E8EB]"
                >
                  <h3 className="mb-3">{item.title}</h3>
                  <p className="text-sm text-[#888994] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {usageExamples.length > 0 && (
          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-4">使用示例</h2>
            <div className="space-y-4">
              {usageExamples.map((item, idx) => (
                <div
                  key={idx}
                  className="border border-gray-100 rounded-xl overflow-hidden"
                >
                  <div className="flex items-center justify-between p-4 bg-[#f8faff]">
                    <h3 className="text-sm">{item.title}</h3>
                    <div
                      onClick={() => handleCopy(item.desc)}
                      className="h-6 rounded flex items-center justify-center cursor-pointer bg-[#eaeef8] hover:bg-[#E1E2E3] text-sm text-[#2563EB] !py-[5px] !px-2"
                    >
                      <CopyOutlined
                        style={{ color: "#2563EB" }}
                        className="mr-1"
                      />
                      复制
                    </div>
                  </div>
                  <div className="border-t border-dashed border-gray-200 mx-6" />
                  <div className="p-4">
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!!(positiveCases.length || negativeCases.length) && (
          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-4">最佳实践</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-green-50/50 rounded-xl p-6 border border-[#E6E8EB]">
                <div className="flex items-center gap-2 mb-4">
                  <CheckOutlined
                    className="text-green-500"
                    style={{ fontSize: 20 }}
                  />
                  <span>正面案例</span>
                </div>
                <ul className="space-y-3">
                  {positiveCases.map((text, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <div className="size-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-orange-50/50 rounded-xl p-6 border border-[#E6E8EB]">
                <div className="flex items-center gap-2 mb-4">
                  <SvgIcon name="warning_v2" size="20px" />
                  <span>反面案例</span>
                </div>
                <ul className="space-y-3">
                  {negativeCases.map((text, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-600"
                    >
                      <div className="size-2 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {faqs.length > 0 && (
          <section className="mb-7">
            <h2 className="text-lg font-bold text-gray-900 mb-4">常见问题</h2>
            <div className="border border-[#E6E8EB] rounded-xl overflow-hidden p-5">
              <Collapse
                className="faq-collapse"
                activeKey={activeFaq}
                onChange={(key) => setActiveFaq(key as string)}
                accordion
                items={faqs.map((faq, idx) => ({
                  key: String(idx),
                  label: (
                    <div className="flex items-center gap-3 flex-1 bg-[#f8faff] h-5 text-base">
                      <QuestionCircleOutlined
                        style={{ fontSize: 20, color: "#2563EB" }}
                      />
                      <span className="font-medium text-gray-900">{faq.q}</span>
                    </div>
                  ),
                  children: (
                    <div className="p-4 text-sm text-gray-500 leading-relaxed bg-gray-50/50">
                      {faq.a}
                    </div>
                  ),
                }))}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default SkillDetail;
