import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Spin, Space } from "antd";
import { useBasicLayout } from "@/hooks/useBasicLayout";
import { t } from "@/locales";
import { ExpandSidebarButton } from "@/components/Layout/ExpandSidebarButton";

// Lazy load sub-components
const VisitView = lazy(() => import("./visit"));
const FavView = lazy(() => import("./fav"));

export function MineView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMdScreen } = useBasicLayout();
  const [activeTab, setActiveTab] = useState("visit");

  const tabList = [
    { label: t("mine.recent_visit"), value: "visit" },
    { label: t("mine.my_favorites"), value: "fav" },
  ];

  useEffect(() => {
    const tab = searchParams.get("tab") || "visit";
    setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const CurrentComponent = activeTab === "visit" ? VisitView : FavView;

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex-none h-14" />
      <div className="max-w-[1200px] box-content mx-auto p-5 relative">
        <ExpandSidebarButton />

        <Space.Compact>
          {tabList.map((item) => (
            <Button
              key={item.value}
              type="primary"
              className={`border-0 ${activeTab === item.value ? "bg-[#2563EB]" : "bg-[#F2F3F5] text-[#4F5052]"}`}
              onClick={() => handleTabChange(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </Space.Compact>

        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Spin size="large" />
            </div>
          }
        >
          <CurrentComponent />
        </Suspense>
      </div>
    </div>
  );
}

export default MineView;
