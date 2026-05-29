import { useState, useMemo, useCallback } from "react";
import { SearchOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { Search as SearchInput, Tabs } from "@km/shared-components-react";
import { useSkillsStore } from "@/stores/modules/skills";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { isLoggedIn } from "@/utils/permission";
import SkillList from "../SkillList";
import { t } from "@/locales";

interface ExploreSkillsProps {
  onAdd?: (id: string) => void;
}

const ExploreSkills: React.FC<ExploreSkillsProps> = ({ onAdd }) => {
  const skillsStore = useSkillsStore();
  const isSoftStyle = useIsSoftStyle();
  const [keyword, setKeyword] = useState("");
  const [groupId, setGroupId] = useState(0);
  const [loading, setLoading] = useState(false);

  const showAgentList = useMemo(() => {
    return skillsStore.skillList;
  }, [skillsStore.skillList]);

  const tabItems = useMemo(() => {
    return skillsStore.categorys.map((cat) => ({
      key: String(cat.group_id),
      label: cat.group_name,
    }));
  }, [skillsStore.categorys]);

  const handleTabChange = useCallback(
    async (key: string) => {
      try {
        const group_id = Number(key);
        setGroupId(group_id);
        if (!isLoggedIn()) return;
        setLoading(true);
        await skillsStore.loadSkillList({
          group_id: group_id || undefined,
          isRefresh: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [skillsStore],
  );

  return (
    <div>
      <div
        className="sticky z-[100] bg-white"
        style={{ top: isSoftStyle ? "90px" : "30px" }}
      >
        <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-2">
          <Tabs
            items={tabItems}
            activeKey={String(groupId)}
            onChange={handleTabChange}
            className="flex-1 index-tabs overflow-hidden"
          />
          <div className="w-full md:w-auto">
            <SearchInput
              value={keyword}
              onChange={setKeyword}
              className="hidden md:flex"
              placeholder={t("action.search") + t("module.skill")}
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              size="large"
              className="w-full md:hidden el-input--main"
              placeholder={t("action.search") + t("module.skill")}
              prefix={<SearchOutlined />}
            />
          </div>
        </div>
      </div>
      <SkillList
        loading={loading}
        keyword={keyword}
        list={showAgentList}
        type="explore"
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${isSoftStyle ? "mt-4 mb-16" : "my-3"}`}
        onAdd={onAdd}
      />
    </div>
  );
};

export default ExploreSkills;
