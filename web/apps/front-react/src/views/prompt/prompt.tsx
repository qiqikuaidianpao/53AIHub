import { useState, useEffect, useMemo } from "react";
import { Input, Spin } from "antd";
import { Dropdown } from "@km/shared-components-react";
import { SearchOutlined, DownOutlined } from "@ant-design/icons";
import { Search as SearchInput, Tabs } from "@km/shared-components-react";
import { SvgIcon } from "@km/shared-components-react";
import { usePromptStore } from "@/stores/modules/prompt";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { t } from "@/locales";
import Footer from "@/components/Layout/Footer";
import Header from "@/components/Layout/Header";
import PromptList from "./components/List";
import "./prompt.css";

const sortOptions = [
  { key: "default_sort", label: t("prompt.default_sort") },
  { key: "likes_sort", label: t("prompt.likes_sort") },
  { key: "views_sort", label: t("prompt.views_sort") },
];

export function PromptView() {
  const promptStore = usePromptStore();
  const isSoftStyle = useIsSoftStyle();

  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [groupId, setGroupId] = useState(0);
  const [sortType, setSortType] = useState("default_sort");
  const [activeType, setActiveType] = useState("explore");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      promptStore.loadCategorys(),
      promptStore.loadPromptList(),
    ]).finally(() => {
      setLoading(false);
    });
  }, []);

  const showPromptList = useMemo(() => {
    let promptList = promptStore.promptList.map((item: any = {}) => {
      item.group_ids = item.group_ids || [];
      const group_options = promptStore.categorys.filter(
        (row: any = {}) =>
          +row.group_id && item.group_ids.includes(row.group_id),
      );
      item.group_names = group_options.map((row: any = {}) => row.group_name);
      return item;
    });

    if (sortType === "likes_sort") {
      promptList = [...promptList].sort(
        (a, b) => (b.likes || 0) - (a.likes || 0),
      );
    } else if (sortType === "views_sort") {
      promptList = [...promptList].sort(
        (a, b) => (b.views || 0) - (a.views || 0),
      );
    }

    const lowerKeyword = keyword.toLowerCase().trim();
    if (lowerKeyword) {
      promptList = promptList.filter((item: any) => {
        const matchKeyword = item.name?.toLowerCase().includes(lowerKeyword);
        return (
          (groupId === 0 || (+groupId && item.group_ids?.includes(groupId))) &&
          matchKeyword
        );
      });
    } else {
      promptList =
        groupId === 0
          ? promptList
          : promptList.filter(
              (item: any) => +groupId && item.group_ids?.includes(groupId),
            );
    }

    return promptList;
  }, [
    promptStore.promptList,
    promptStore.categorys,
    keyword,
    groupId,
    sortType,
  ]);

  const tabItems = useMemo(() => {
    return promptStore.categorys.map((item: any) => ({
      key: String(item.group_id),
      label: item.group_name,
    }));
  }, [promptStore.categorys]);

  const handleSortChange = (value: string) => {
    setSortType(value);
  };

  const handleTabChange = (key: string) => {
    setGroupId(Number(key));
  };

  return (
    <>
      {isSoftStyle && <Header title={""} border={false} />}
      <div
        className={`w-11/12 lg:w-4/5 max-w-[1200px] mx-auto ${isSoftStyle ? "" : "pt-4"}`}
      >
        <div
          className="sticky z-[101] bg-white w-full flex items-end"
          style={{ top: isSoftStyle ? "60px" : "0px" }}
        >
          <div
            className="h-[34px] text-xl font-bold flex items-center text-[#333333cc] hover:opacity-80 transition-opacity cursor-pointer"
            onClick={() => setActiveType("explore")}
          >
            {t("prompt.explore")}
            <SvgIcon
              name="explore"
              size={20}
              className="relative left-1 -top-1"
              color="var(--el-color-primary, #2563eb)"
            />
          </div>
        </div>

        {/* Content */}
        {activeType === "explore" && (
          <>
            {/* Sticky filter bar */}
            <div
              className="sticky z-[100] bg-white"
              style={{ top: isSoftStyle ? "90px" : "30px" }}
            >
              <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-2">
                <div className="flex-1 md:w-0 flex items-center gap-2">
                  <Tabs
                    activeKey={String(groupId)}
                    onChange={handleTabChange}
                    items={tabItems}
                    className="w-full prompt-tabs md:mb-0 overflow-hidden"
                  />
                  <Dropdown
                    menu={{
                      items: sortOptions,
                      onClick: ({ key }) => handleSortChange(key),
                    }}
                  >
                    <div className="flex-none md:hidden flex items-center gap-1 text-gray-600 cursor-pointer">
                      <SvgIcon name="sort" stroke />
                      <span className="text-sm">
                        {sortOptions.find((opt) => opt.key === sortType)?.label}
                      </span>
                      <DownOutlined style={{ fontSize: 14, color: "#aaa" }} />
                    </div>
                  </Dropdown>
                </div>
                <div className="w-full md:w-auto flex-none flex md:flex-row-reverse items-center gap-2">
                  <SearchInput
                    className="flex-none hidden md:flex"
                    value={keyword}
                    onChange={setKeyword}
                    placeholder={t("action.search") + t("module.prompt")}
                  />
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder={t("action.search") + t("module.prompt")}
                    prefix={<SearchOutlined className="text-gray-400" />}
                    className="w-full md:hidden"
                    allowClear
                    size="large"
                  />
                  <Dropdown
                    menu={{
                      items: sortOptions,
                      onClick: ({ key }) => handleSortChange(key),
                    }}
                  >
                    <div className="hidden md:flex items-center space-x-1 cursor-pointer text-gray-600">
                      <SvgIcon name="sort" stroke size={14} />
                      <span className="text-sm">
                        {sortOptions.find((opt) => opt.key === sortType)?.label}
                      </span>
                      <DownOutlined style={{ fontSize: 14, color: "#aaa" }} />
                    </div>
                  </Dropdown>
                </div>
              </div>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Spin size="large" />
              </div>
            ) : (
              <PromptList
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 ${isSoftStyle ? "mt-3 mb-16" : "my-3"}`}
                list={showPromptList}
                keyword={keyword}
              />
            )}
          </>
        )}
      </div>
      <Footer />
    </>
  );
}

export default PromptView;
