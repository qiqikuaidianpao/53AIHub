import { useState, useEffect } from "react";
import { Input } from "antd";
import { Search as SearchInput, Tabs } from "@km/shared-components-react";
import { SearchOutlined } from "@ant-design/icons";
import { useLinksStore } from "@/stores/modules/links";
import { t } from "@/locales";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { scrollToElement } from "@km/shared-utils";
import ListView from "./list";

interface ExploreToolkitProps {
  stickyOffset?: number;
}

export function ExploreToolkit({ stickyOffset = 0 }: ExploreToolkitProps) {
  const linksStore = useLinksStore();
  const isSoftStyle = useIsSoftStyle();
  const [groupId, setGroupId] = useState(0);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    linksStore.loadCategorys();
    linksStore.loadLinks();
  }, []);

  const categorys = linksStore.categorys || [];

  const links = (linksStore.links || []).filter((item) => {
    if (groupId === 0) return true;
    return item.group_id === groupId;
  });

  const tabItems = categorys.map((item) => ({
    key: String(item.group_id),
    label: item.group_name,
  }));

  const handleTabChange = (key: string) => {
    setGroupId(Number(key));
    scrollToElement(`#group_${key}`, (stickyOffset || 0) + 150);
  };

  return (
    <>
      <div
        className="sticky z-[100] bg-white"
        style={{ top: isSoftStyle ? "90px" : "30px" }}
      >
        <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-2">
          <Tabs
            activeKey={String(groupId)}
            onChange={handleTabChange}
            items={tabItems}
            className="flex-1 overflow-hidden toolkit-tabs"
          />
          <div className="w-full md:w-auto">
            <SearchInput
              className="hidden md:flex"
              value={keyword}
              onChange={setKeyword}
              placeholder={t("action.search") + t("module.toolbox")}
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t("toolbox.search_placeholder")}
              prefix={<SearchOutlined className="text-gray-400" />}
              className="w-full md:hidden"
              allowClear
              size="large"
            />
          </div>
        </div>
      </div>
      <ListView
        className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${isSoftStyle ? "mt-3 mb-16" : "my-3"}`}
        keyword={keyword}
        list={links}
        groupId={groupId}
      />
    </>
  );
}

export default ExploreToolkit;
