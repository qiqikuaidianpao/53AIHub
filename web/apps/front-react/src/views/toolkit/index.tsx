import { useState } from "react";
import { Button } from "antd";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { t } from "@/locales";
import { SvgIcon } from "@km/shared-components-react";
import ExploreToolkit from "./components/group-list";
import Footer from "@/components/Layout/Footer";
import Header from "@/components/Layout/Header";
import "./toolkit.css";

export function ToolkitView() {
  const [activeType, setActiveType] = useState("explore");
  const isSoftStyle = useIsSoftStyle();

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
            className="h-[34px] text-xl font-bold flex items-center text-[#333333cc] hover:opacity-80 transition-opacity"
            onClick={() => setActiveType("explore")}
          >
            {t("toolbox.explore")}
            <SvgIcon
              name="explore"
              size={20}
              className="relative left-1 -top-1"
              color="var(--el-color-primary, #2563eb)"
            />
          </div>
        </div>

        {activeType === "explore" && <ExploreToolkit />}
      </div>
      <Footer />
    </>
  );
}

export default ToolkitView;
