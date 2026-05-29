import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Empty, Button, message } from "antd";
import { useUserStore } from "@/stores/modules/user";
import { usePromptStore } from "@/stores/modules/prompt";
import { t } from "@/locales";
import promptApi from "@/api/modules/prompt";
import { copyToClip } from "@km/shared-utils";
import { getPublicPath } from "@/utils/config";
import { SvgIcon } from "@km/shared-components-react";

interface PromptItem {
  prompt_id: string;
  name: string;
  content: string;
  description: string;
  group_ids?: string[];
  group_names?: string[];
  is_liked?: boolean;
  likes?: number;
  views?: number;
}

interface PromptListProps {
  list: PromptItem[];
  keyword?: string;
  className?: string;
}

export default function PromptList({
  list,
  keyword = "",
  className = "",
}: PromptListProps) {
  const navigate = useNavigate();
  const userGroupIds = useUserStore((state) => state.info.group_ids || []);
  const updatePromptLike = usePromptStore((state) => state.updatePromptLike);

  const highlightedName = useCallback(
    (name: string) => {
      if (!keyword) return name;
      const regex = new RegExp(`(${keyword})`, "gi");
      return name.replace(regex, `<span class='text-theme'>$1</span>`);
    },
    [keyword],
  );

  const handleCopy = async (e: React.MouseEvent, item: PromptItem) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await copyToClip(item.content);
    if (success) {
      message.success(t("common.copied"));
    }
  };

  const handleApprove = async (e: React.MouseEvent, item: PromptItem) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const newIsLiked = !item.is_liked;
      await promptApi.approve(item.prompt_id);
      updatePromptLike(item.prompt_id, newIsLiked);
      message.success(
        t(newIsLiked ? "status.approve_success" : "status.approve_cancel"),
      );
    } catch {
      // Error handling
    }
  };

  const canCopy = (item: PromptItem) => {
    return (item.group_ids || []).some((id) =>
      userGroupIds.includes(id as any),
    );
  };

  if (list.length === 0) {
    return (
      <div className={`py-10 ${className}`}>
        <div
          className={`col-span-full flex flex-col items-center justify-center`}
        >
          <Empty
            styles={{ image: { height: 140 } }}
            description={t("common.no_data")}
            image={getPublicPath("/images/chat/completion_empty.png")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {list.map((item) => (
        <div
          key={item.prompt_id}
          className="group flex items-start p-5 min-h-[150px] box-border rounded overflow-hidden bg-cover cursor-pointer border-[#EFF1F3] hover:shadow-md transition-all duration-300"
          style={{
            backgroundImage: `url(${getPublicPath("/images/index/card_bg_v4.png")})`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
          }}
          onClick={() => navigate(`/prompt/${item.prompt_id}`)}
        >
          <div className="flex-1 overflow-hidden">
            <div className="w-full flex items-center justify-between gap-4">
              <h3
                className="text-base font-medium line-clamp-1 text-primary"
                title={item.name}
                dangerouslySetInnerHTML={{
                  __html: highlightedName(item.name),
                }}
              />
              {canCopy(item) && (
                <Button
                  size="small"
                  className="invisible group-hover:visible !px-2"
                  onClick={(e) => handleCopy(e, item)}
                >
                  {t("action.copy")}
                </Button>
              )}
            </div>
            <p
              className="text-sm line-clamp-2 text-placeholder mt-2 min-h-[40px]"
              title={item.description}
            >
              {item.description}
            </p>
            <div className="flex items-center justify-between">
              {item.group_names && item.group_names.length > 0 && (
                <div
                  className="w-full text-sm text-opacity-60 text-regular mt-3 truncate"
                  title={item.group_names.join(" ")}
                >
                  {item.group_names.map((groupName) => (
                    <span
                      key={groupName}
                      className="px-2 py-1 box-border text-xs text-theme bg-[#ECF1FF] rounded-sm mr-2"
                    >
                      {groupName}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex items-center justify-end gap-3 text-xs text-regular">
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => handleApprove(e, item)}
                >
                  <SvgIcon
                    className="size-[18px]"
                    name={item.is_liked ? "approve-filled" : "approve"}
                    color={item.is_liked ? "#F3AB00" : "#999999"}
                  />
                  <span>{item.likes || 0}</span>
                </div>
                <div className="flex items-center gap-1">
                  <SvgIcon className="size-[16px]" name="view" />
                  <span>{item.views || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
