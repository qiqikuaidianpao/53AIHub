import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { Search, Tabs } from "@km/shared-components-react";
import { useSpaceStore } from "@/stores/modules/space";
import { t } from "@/locales";
import List, { type ListRef } from "./List";
import "./GroupList.css";

interface GroupListProps {
  stickyOffset?: number;
  spaceId?: string;
}

export function GroupList({
  stickyOffset = 0,
  spaceId: propSpaceId,
}: GroupListProps) {
  const navigate = useNavigate();
  const listViewRef = useRef<ListRef>(null);

  const params = useParams<{ space_id: string }>();

  // 使用 Zustand 选择器模式订阅状态
  const spaceList = useSpaceStore((state) => state.spaceList);
  const loadSpaceList = useSpaceStore((state) => state.loadSpaceList);

  const [activeSpaceId, setActiveSpaceId] = useState(
    propSpaceId || params.space_id || "",
  );
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let mounted = true;

    loadSpaceList().then((list) => {
      if (!mounted) return;

      const targetSpaceId = propSpaceId || params.space_id;
      if (targetSpaceId && list.find((item) => item.id === targetSpaceId)) {
        setActiveSpaceId(targetSpaceId);
      } else if (list.length > 0) {
        setActiveSpaceId(list[0].id);
      }
    });

    return () => {
      mounted = false;
    };
  }, [propSpaceId, params.space_id, loadSpaceList]);

  useEffect(() => {
    if (keyword !== undefined && listViewRef.current) {
      listViewRef.current.search(keyword);
    }
  }, [keyword]);

  const handleTabChange = (key: string) => {
    setActiveSpaceId(key);
    // Note: Navigation removed per Vue diff - now updates local state only
    // navigate(`/knowledge/${key}`)
  };

  const tabItems = useMemo(() => {
    return spaceList.map((item) => ({
      key: item.id,
      label: item.name,
    }));
  }, [spaceList]);

  return (
    <div className="group-list-container">
      <div className="group-list-header" style={{ top: stickyOffset }}>
        <div className="flex md:flex-row flex-col-reverse gap-5 items-stretch md:items-center justify-between bg-white py-2 overflow-hidden">
          <Tabs
            activeKey={activeSpaceId}
            onChange={handleTabChange}
            className="flex-1 min-w-0 group-list-tabs"
            items={tabItems}
          />
          <div className="w-full md:w-auto flex items-center gap-2">
            <Search
              value={keyword}
              onChange={setKeyword}
              placeholder={t("action.search") + t("module.prompt")}
              className="hidden md:flex"
            />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              size="large"
              className="w-full md:hidden"
              placeholder={t("toolbox.search_placeholder")}
              prefix={<SearchOutlined />}
            />
          </div>
        </div>
      </div>

      {activeSpaceId && (
        <List ref={listViewRef} key={activeSpaceId} spaceId={activeSpaceId} />
      )}
    </div>
  );
}

export default GroupList;
