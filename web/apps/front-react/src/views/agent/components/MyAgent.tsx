import { useState, useEffect, useMemo } from "react";
import { Input, Select } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { Search } from "@km/shared-components-react";
import { useAgentStore } from "@/stores/modules/agent";
import MyAgentList from "./MyList";
import { t } from "@/locales";

export function MyAgent() {
  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<"created_time" | "updated_time">(
    "created_time",
  );

  const agentStore = useAgentStore();

  const sortOptions = useMemo(
    () => [
      {
        label: t("agent.sort_by_created_time"),
        value: "created_time" as const,
      },
      {
        label: t("agent.sort_by_updated_time"),
        value: "updated_time" as const,
      },
    ],
    [],
  );

  const loadAgentList = () => {
    agentStore.loadMyAgentList(true);
  };

  useEffect(() => {
    loadAgentList();
  }, []);

  return (
    <div>
      <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between py-2 mb-5">
        <div className="flex items-center gap-2 w-[200px]">
          <Select
            prefix={t("module.time") + "："}
            value={sort}
            onChange={setSort}
            className="flex-none"
          >
            {sortOptions.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>
        </div>
        <div className="w-full md:w-auto flex-none flex md:flex-row-reverse items-center gap-2">
          <Search
            value={keyword}
            onChange={setKeyword}
            className="flex-none hidden md:flex"
            placeholder={t("action.search")}
          />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            size="large"
            className="w-full md:hidden el-input--main"
            placeholder={t("action.search")}
            prefix={<SearchOutlined />}
          />
        </div>
      </div>

      {/* Agent list grid */}
      <MyAgentList
        keyword={keyword}
        sort={sort}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"
        onRefresh={loadAgentList}
      />
    </div>
  );
}

export default MyAgent;
