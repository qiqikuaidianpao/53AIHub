import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "antd";
import { SvgIcon } from "@km/shared-components-react";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { useSkillsStore } from "@/stores/modules/skills";
import ExploreSkills from "./components/explore/index";
import MySkills from "./components/my/index";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import { t } from "@/locales";

const SkillsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const isSoftStyle = useIsSoftStyle();
  const skillsStore = useSkillsStore();
  const [activeType, setActiveType] = useState<"explore" | "my">("explore");

  useEffect(() => {
    if (searchParams.get("from") === "my") {
      setActiveType("my");
    }
    skillsStore.loadCategorys();
    skillsStore.loadSkillList();
    skillsStore.loadMySkillList();
  }, [searchParams]);

  return (
    <div className="size-full flex">
      <div
        className={`w-full flex-1 flex flex-col ${isSoftStyle ? "overflow-y-auto" : ""}`}
      >
        {isSoftStyle && <Header back={false} title="" border={false} />}
        <div className="w-11/12 lg:w-4/5 max-w-[1200px] mx-auto">
          <div
            className={`sticky z-[100] bg-white w-full flex gap-3 `}
            style={{ top: isSoftStyle ? "60px" : "0px" }}
          >
            <Button
              type="link"
              className={`text-xl py-4 px-0 ${activeType === "explore" ? "font-bold" : "text-[#999999]"}`}
              onClick={() => setActiveType("explore")}
            >
              {t("agent.explore")}
              {activeType === "explore" && (
                <SvgIcon
                  name="explore"
                  size={20}
                  color="var(--el-color-primary, #2563eb)"
                  className="relative left-1 -top-1"
                />
              )}
            </Button>
            <Button
              type="link"
              className={`text-xl py-4 px-0 ${activeType === "my" ? "font-bold" : "text-[#999999]"}`}
              onClick={() => setActiveType("my")}
            >
              {t("module.mine")}
              {activeType === "my" && (
                <SvgIcon
                  name="explore"
                  size={20}
                  color="var(--el-color-primary, #2563eb)"
                  className="relative left-1 -top-1"
                />
              )}
            </Button>
          </div>
          {activeType === "explore" ? <ExploreSkills /> : <MySkills />}
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default SkillsPage;
