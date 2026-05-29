import { useMemo } from "react";
import { Empty } from "antd";
import type { Skill } from "@/api/modules/skill/types";
import SkillCard from "./Card";
import { t } from "@/locales";

interface SkillListProps {
  list: Skill[];
  loading?: boolean;
  keyword?: string;
  type: "my" | "explore";
  sort?: "created_time" | "updated_time";
  className?: string;
  onAdd?: (id: string) => void;
}

const SkillList: React.FC<SkillListProps> = ({
  list,
  loading = false,
  keyword = "",
  type,
  sort = "created_time",
  className,
  onAdd,
}) => {
  const showList = useMemo(() => {
    let result = [...list];

    // 按排序字段降序排列
    if (sort) {
      result.sort((a, b) => (b[sort] ?? 0) - (a[sort] ?? 0));
    }

    // 关键词筛选
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      result = result.filter((item) => {
        return (
          item.display_name.toLowerCase().includes(kw) ||
          item.skill_name.toLowerCase().includes(kw) ||
          item.description.toLowerCase().includes(kw)
        );
      });
    }

    return result;
  }, [list, keyword, sort]);

  if (loading) {
    return (
      <>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="flex items-start p-4 bg-[#FFF8FF] rounded-lg animate-pulse"
          >
            <div className="w-[70px] h-[70px] bg-gray-200 rounded-full mr-4" />
            <div className="flex-1">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-full mb-1" />
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
              <div className="h-4 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (showList.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center min-h-[600px]">
        <Empty
          description={t("common.no_data")}
          image={window.$getPublicPath("/images/chat/completion_empty.png")}
        />
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${className || ""}`}
    >
      {showList.map((skill) => (
        <SkillCard key={skill.id} skill={skill} type={type} onAdd={onAdd} />
      ))}
    </div>
  );
};

export default SkillList;
