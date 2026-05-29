import {
  useState,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useParams, Link } from "react-router-dom";
import {
  Breadcrumb,
  Button,
  Tooltip,
  Empty,
  Spin,
  Modal,
  Divider,
  message,
} from "antd";
import { CloseOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { usePromptStore } from "@/stores/modules/prompt";
import { useUserStore } from "@/stores/modules/user";
import {
  useEnterpriseStore,
  useIsSoftStyle,
} from "@/stores/modules/enterprise";
import { useNavigationStore } from "@/stores/modules/navigation";
import promptApi from "@/api/modules/prompt";
import { copyToClip } from "@km/shared-utils";
import { getPublicPath } from "@/utils/config";
import { t } from "@/locales";
import { SvgIcon } from "@km/shared-components-react";
import { MdRenderer } from "@km/hub-ui-x-react";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import PromptInput from "@/components/PromptInput";
import AuthTagGroup from "@/components/AuthTagGroup";
import "./detail.css";

interface PromptDetail {
  prompt_id: string;
  name: string;
  description: string;
  content: string;
  group_ids: number[];
  custom_config: {
    use_cases?: Array<{
      type: "case" | "scene";
      input_text: string;
      output_text: string;
      scene?: string;
      desc?: string;
      image?: string;
    }>;
  };
  ai_links_data?: Array<{
    name: string;
    url: string;
    logo: string;
  }>;
}

interface PromptDetailViewProps {
  hideMenuHeader?: boolean;
  hideFooter?: boolean;
  showRecommend?: boolean;
  hideContentTitle?: boolean;
  showBack?: boolean;
  useCaseFixed?: boolean;
  mainClass?: string;
  guideClass?: string;
}

export interface PromptDetailViewRef {
  detailData: PromptDetail | null;
  isUseCase: boolean;
  showUseCase: () => void;
  hideUseCase: () => void;
}

const virtualPrompt = `我是一个虚拟助手，我可以回答用户的问题，也可以生成用户需要的内容。

## 我的能力范围
- 📝 文本创作：撰写文章、报告、邮件、创意文案等
- 🔍 信息分析：数据解读、趋势分析、问题诊断
- 💡 创意思维：头脑风暴、方案设计、创新建议
- 🎯 专业咨询：技术指导、业务建议、学习辅导
- 🌐 多语言支持：中英文翻译、多语言内容创作
- 🤖 代码助手：编程指导、代码审查、技术解答

## 交互方式
请直接告诉我您的需求，我会：
1. 仔细理解您的问题
2. 提供详细且实用的解答
3. 根据需要提供示例或步骤
4. 确保回答的准确性和相关性

## 注意事项
- 我会尽力提供准确信息，但建议您验证重要决策
- 对于专业领域问题，建议咨询相关专家
- 我的知识有时效性，最新信息请以官方渠道为准

## 交互方式
请直接告诉我您的需求，我会：
1. 仔细理解您的问题
2. 提供详细且实用的解答
3. 根据需要提供示例或步骤
4. 确保回答的准确性和相关性

## 注意事项
- 我会尽力提供准确信息，但建议您验证重要决策
- 对于专业领域问题，建议咨询相关专家
- 我的知识有时效性，最新信息请以官方渠道为准

现在，请告诉我您需要什么帮助？
`;

export const PromptDetailView = forwardRef<
  PromptDetailViewRef,
  PromptDetailViewProps
>(
  (
    {
      hideMenuHeader = false,
      hideFooter = false,
      showRecommend = false,
      hideContentTitle = false,
      showBack = false,
      useCaseFixed = false,
      mainClass = "",
      guideClass = "",
    },
    ref,
  ) => {
    const { prompt_id } = useParams();
    const promptStore = usePromptStore();
    const userStore = useUserStore();
    const isSoftStyle = useIsSoftStyle();
    const enterpriseStore = useEnterpriseStore();
    const navigationStore = useNavigationStore();

    const [loading, setLoading] = useState(true);
    const [detailData, setDetailData] = useState<PromptDetail | null>(null);
    const [isUseCase, setIsUseCase] = useState(false);

    const locationHref = window.location.href;

    useImperativeHandle(ref, () => ({
      detailData,
      isUseCase,
      showUseCase: () => setIsUseCase(true),
      hideUseCase: () => setIsUseCase(false),
    }));

    useEffect(() => {
      promptStore.loadCategorys();
      promptStore.loadPromptList();
      fetchPromptDetail();
    }, [prompt_id]);

    const fetchPromptDetail = async () => {
      if (!prompt_id) return;
      setLoading(true);
      try {
        const data = await promptApi.get(prompt_id);
        try {
          data.custom_config = JSON.parse(data.custom_config || "{}");
        } catch {
          data.custom_config = {};
        }
        setDetailData(data as unknown as PromptDetail);
      } catch (error) {
        console.error("Failed to fetch prompt detail:", error);
      } finally {
        setLoading(false);
      }
    };

    const hasAccess = useMemo(() => {
      if (!detailData) return false;
      const userGroupIds = userStore.info?.group_ids || [];
      return (detailData.group_ids || []).some((id) =>
        userGroupIds.includes(id),
      );
    }, [detailData, userStore.info]);

    const useCaseList = useMemo(() => {
      const useCases = detailData?.custom_config?.use_cases || [];
      return useCases.filter((item) => item.type === "case");
    }, [detailData]);

    const useSceneList = useMemo(() => {
      const useCases = detailData?.custom_config?.use_cases || [];
      return useCases.filter((item) => item.type === "scene");
    }, [detailData]);

    const relatedPromptList = useMemo(() => {
      return promptStore.promptList
        .filter((item: any) => item.prompt_id !== detailData?.prompt_id)
        .slice(0, 4);
    }, [promptStore.promptList, detailData]);

    const handleCopy = async (text: string) => {
      const success = await copyToClip(text);
      if (success) {
        message.success(t("action.copy_success"));
      }
    };

    const handleShare = async () => {
      const success = await copyToClip(window.location.href);
      if (success) {
        message.success(t("status.copy_link"));
      }
    };

    const handleClickAiLink = (item: { name: string; url: string }) => {
      Modal.confirm({
        title: t("common.allow_to", { name: item.name }),
        okText: t("action.allow", { name: item.name }),
        cancelText: t("action.cancel"),
        centered: true,
        onOk: () => {
          window.open(item.url, "_blank");
        },
      });
    };

    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <Spin size="large" />
        </div>
      );
    }

    if (!detailData) {
      return (
        <div className="h-full flex items-center justify-center">
          <Empty description={t("prompt.not_found")} />
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        <section
          className={
            !isSoftStyle
              ? "w-11/12 lg:w-4/5 py-6 px-4 mx-auto box-border"
              : "h-full"
          }
        >
          {/* Breadcrumb */}
          {!isSoftStyle && (
            <div className="relative w-full flex items-center gap-4 box-border">
              <Breadcrumb
                className="flex-1 w-0"
                separator={<ArrowRightOutlined />}
                items={[
                  {
                    title: navigationStore.homeNavigation?.menu_path ? (
                      <Link to={navigationStore.homeNavigation.menu_path}>
                        <span className="text-regular font-normal hover-text-theme">
                          {t("module.index")}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-regular font-normal">
                        {t("module.index")}
                      </span>
                    ),
                  },
                  {
                    title: navigationStore.promptNavigation?.menu_path ? (
                      <Link to={navigationStore.promptNavigation.menu_path}>
                        <span className="text-regular font-normal hover-text-theme">
                          {t("module.prompt")}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-regular font-normal">
                        {t("module.prompt")}
                      </span>
                    ),
                  },
                  {
                    title: (
                      <span
                        className="text-primary inline-block truncate max-w-[10em] md:max-w-[30rem]"
                        title={detailData.name}
                      >
                        {detailData.name}
                      </span>
                    ),
                  },
                ]}
              />
              <Button type="link" onClick={() => setIsUseCase(true)}>
                <SvgIcon className="mr-1.5" name="layout-split" size={18} />
                {t("chat.usage_guide")}
              </Button>
            </div>
          )}

          <div
            className={`bg-white flex flex-col relative h-full ${!isSoftStyle && isUseCase ? "fixed top-0 left-0 right-0 z-[9999]" : ""}`}
          >
            {!isUseCase ? (
              <>
                {isSoftStyle && (
                  <Header
                    title={detailData.name || t("module.prompt")}
                    right={
                      <Tooltip title={t("chat.usage_guide")}>
                        <div
                          className="h-[26px] px-2 rounded-full items-center justify-center gap-1.5 text-sm text-primary cursor-pointer hover:bg-[#E1E2E3] hidden md:flex"
                          onClick={() => setIsUseCase(true)}
                        >
                          <div className="size-4">
                            <SvgIcon name="layout-split" size={18} />
                          </div>
                        </div>
                      </Tooltip>
                    }
                  />
                )}

                <div className="flex-1 flex gap-8">
                  <section
                    className={`w-full min-w-0 max-w-[1280px] pt-6 px-3 md:px-8 lg:px-10 mx-auto box-border ${
                      !isSoftStyle ? "!px-0 !max-w-none" : ""
                    }`}
                  >
                    <h1 className="text-2xl md:text-3xl font-semibold text-primary w-full flex items-center justify-between md:justify-start">
                      <span>{detailData.name}</span>
                      <Tooltip title={t("chat.usage_guide")}>
                        <div
                          className="h-[26px] px-2 rounded-full flex items-center justify-center gap-1.5 text-sm text-primary cursor-pointer hover:bg-[#E1E2E3] md:hidden"
                          onClick={() => setIsUseCase(true)}
                        >
                          <div className="size-4">
                            <SvgIcon name="layout-split" size={18} />
                          </div>
                        </div>
                      </Tooltip>
                    </h1>

                    <p className="text-placeholder my-4 text-wrap break-words whitespace-pre-wrap">
                      {detailData.description}
                    </p>

                    <AuthTagGroup value={detailData.group_ids} />

                    {isSoftStyle && (
                      <h2 className="text-base md:text-xl font-semibold text-primary mt-8 w-full flex items-center justify-between md:justify-start">
                        <span>{t("prompt.content")}</span>
                        <div className="md:hidden">
                          {hasAccess && (
                            <Button
                              className="h-[36px]"
                              type="primary"
                              onClick={() => handleCopy(detailData.content)}
                            >
                              {t("action.copy")}
                            </Button>
                          )}
                          <Button
                            className="!bg-[#F9FAFB] h-[36px] !ml-2"
                            onClick={handleShare}
                          >
                            {t("action.share")}
                          </Button>
                        </div>
                      </h2>
                    )}

                    <section className="w-full mt-4 flex gap-8">
                      <div className="flex-1 w-0 max-h-max relative overflow-hidden group">
                        <div className="rounded-md bg-[#F9FAFB]">
                          {hasAccess ? (
                            <>
                              <div className="absolute top-4 right-4 z-[2] invisible md:group-hover:visible flex gap-2">
                                <Button
                                  className="!bg-[#F9FAFB]"
                                  onClick={() => handleCopy(detailData.content)}
                                >
                                  {t("action.copy")}
                                </Button>
                                <Button
                                  className="!bg-[#F9FAFB] !ml-2"
                                  onClick={handleShare}
                                >
                                  {t("action.share")}
                                </Button>
                              </div>
                              <PromptInput
                                value={detailData.content}
                                disabled
                                showLine
                                style={{ minHeight: "max-content" }}
                              />
                            </>
                          ) : (
                            <div className="relative border rounded">
                              <div className="blur-md">
                                <PromptInput
                                  value={virtualPrompt}
                                  disabled
                                  showLine
                                  style={{ minHeight: "max-content" }}
                                />
                              </div>
                              <div className="absolute inset-0" />
                              <div className="w-48 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-10 px-5 bg-[#6F7275] rounded-full flex items-center gap-1">
                                <SvgIcon name="lock" color="#fff" />
                                <span className="text-sm text-white">
                                  {t("prompt.auth_tip")}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </section>

                    {/* AI Links */}
                    {hasAccess &&
                      detailData.ai_links_data &&
                      detailData.ai_links_data.length > 0 && (
                        <div className="sticky bottom-0 bg-white">
                          <Divider>
                            <span className="text-sm text-regular">
                              {t("prompt.let_use_prompt")}
                            </span>
                          </Divider>
                          <div className="flex items-center justify-center gap-4 flex-wrap">
                            {detailData.ai_links_data.map((item) => (
                              <a
                                key={item.url}
                                className="w-20 h-16 flex flex-col items-center justify-center gap-2 cursor-pointer"
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleCopy(detailData.content);
                                  handleClickAiLink(item);
                                }}
                              >
                                <div className="size-8 rounded-full border overflow-hidden flex items-center justify-center">
                                  <img
                                    src={item.logo}
                                    className="size-6 rounded-full"
                                    alt={item.name}
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src =
                                        getPublicPath(
                                          "/images/default_logo.png",
                                        );
                                    }}
                                  />
                                </div>
                                <p className="text-primary text-sm whitespace-nowrap">
                                  {item.name}
                                </p>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                  </section>

                  {/* Related Prompts */}
                  {!isSoftStyle && (
                    <div className="flex-none w-2/6 box-border relative flex flex-col gap-4 mt-8">
                      <h2 className="flex-none text-base font-semibold text-regular">
                        {t("common.related_prompt")}
                      </h2>
                      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5">
                        {relatedPromptList.map((item: any) => (
                          <Link
                            key={item.prompt_id}
                            className="flex-none h-24 rounded p-4 cursor-pointer group hover:shadow-md transition-all duration-300 bg-cover"
                            style={{
                              backgroundImage: `url(${getPublicPath("/images/index/card_bg_v4.png")})`,
                              backgroundSize: "100% 100%",
                              backgroundPosition: "center center",
                              backgroundRepeat: "no-repeat",
                            }}
                            to={`/prompt/${item.prompt_id}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-primary">
                                {item.name}
                              </span>
                              {(item.group_ids || []).some((id: number) =>
                                (userStore.info?.group_ids || []).includes(id),
                              ) && (
                                <Button
                                  size="small"
                                  className="invisible group-hover:visible !px-2"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleCopy(item.content);
                                  }}
                                >
                                  {t("action.copy")}
                                </Button>
                              )}
                            </div>
                            <div
                              className="text-sm text-regular line-clamp-2 mt-1.5"
                              title={item.description}
                            >
                              {item.description || "--"}
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Use Case View */
              <div
                className={`bg-white overflow-y-auto ${!isSoftStyle && isUseCase ? "" : "absolute h-screen top-0 left-0 right-0 bottom-0 z-[9]"}`}
              >
                <Header
                  sticky
                  back={showBack}
                  title={t("chat.usage_guide")}
                  right={
                    <CloseOutlined
                      className="text-regular cursor-pointer font-semibold"
                      style={{ fontSize: 18 }}
                      onClick={() => setIsUseCase(false)}
                    />
                  }
                />
                <section
                  className={`w-full max-w-[1280px] py-6 px-3 md:px-8 lg:px-10 mx-auto box-border ${!isSoftStyle ? "!max-w-none" : ""}`}
                >
                  <h1 className="text-primary">{t("chat.usage_case")}</h1>
                  <div className="columns-2 gap-5 space-y-5 mt-5 max-md:columns-1">
                    {useCaseList.map((item, index) => (
                      <div
                        key={index}
                        className="p-5 bg-[#F7F9FC] rounded relative group cursor-pointer break-inside-avoid"
                      >
                        <div className="bg-white rounded p-5 relative">
                          <div className="text-sm text-secondary">
                            {t("chat.input")}
                          </div>
                          <div className="text-sm text-primary break-words mt-4">
                            <MdRenderer content={item.input_text} />
                          </div>
                          <div className="absolute right-8 -bottom-9">
                            <SvgIcon
                              size={50}
                              name="arrow-down"
                              color="white"
                            />
                          </div>
                        </div>
                        <div className="bg-[#E6EEFF] rounded p-5 mt-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-secondary">
                              {t("chat.output")}
                            </div>
                            <Tooltip title={t("action.copy")}>
                              <div onClick={() => handleCopy(item.output_text)}>
                                <SvgIcon
                                  name="copy"
                                  color="#4F5052"
                                  className="cursor-pointer"
                                />
                              </div>
                            </Tooltip>
                          </div>
                          <div className="text-sm text-primary break-words whitespace-pre-wrap mt-4">
                            <MdRenderer content={item.output_text} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {useCaseList.length === 0 && (
                    <div className="flex-center">
                      <Empty
                        description={t("common.no_data")}
                        image={getPublicPath(
                          "/images/chat/completion_empty.png",
                        )}
                      />
                    </div>
                  )}

                  <h1 className="text-primary mt-8">{t("chat.usage_scene")}</h1>
                  <div className="flex gap-6 py-6 max-md:flex-col max-md:gap-2">
                    {useSceneList.map((item, index) => (
                      <div
                        key={index}
                        className="flex-1 px-4 text-center pt-3 pb-10 relative cursor-pointer group"
                      >
                        {item.image && (
                          <img
                            className="mx-auto max-w-[200px]"
                            src={item.image}
                            alt={item.scene}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                            }}
                          />
                        )}
                        <h6 className="text-base text-primary mt-5 break-words">
                          {item.scene}
                        </h6>
                        <p className="text-xs text-secondary mt-4 break-words">
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                  {useSceneList.length === 0 && (
                    <div className="flex-center">
                      <Empty
                        description={t("common.no_data")}
                        image={getPublicPath(
                          "/images/chat/completion_empty.png",
                        )}
                      />
                    </div>
                  )}
                </section>
              </div>
            )}
            {isSoftStyle && <Footer />}
          </div>
        </section>
      </div>
    );
  },
);

export default PromptDetailView;
