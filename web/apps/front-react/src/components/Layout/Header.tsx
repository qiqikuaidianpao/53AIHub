import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Tooltip } from "antd";
import { LeftOutlined } from "@ant-design/icons";
import { useEnterpriseStore } from "@/stores/modules/enterprise";
import { checkPermission } from "@/utils/permission";
import { t } from "@/locales";
import { ExpandSidebarButton } from "./ExpandSidebarButton";
// import { Upgrade } from '@/components/Upgrade'

interface LayoutHeaderProps {
  className?: string;
  mainClass?: string;
  sticky?: boolean;
  hideUser?: boolean;
  back?: boolean;
  onBack?: () => void;
  title?: string;
  border?: boolean;
  beforePrefix?: React.ReactNode;
  titlePrefix?: React.ReactNode;
  titleSuffix?: React.ReactNode;
  titleSlot?: React.ReactNode;
  after?: React.ReactNode;
  right?: React.ReactNode;
}

export function Header({
  className = "",
  mainClass = "",
  sticky = false,
  hideUser = false,
  back = false,
  onBack,
  title = "",
  border = true,
  beforePrefix,
  titlePrefix,
  titleSuffix,
  titleSlot,
  after,
  right,
}: LayoutHeaderProps) {
  const navigate = useNavigate();
  const enterpriseStore = useEnterpriseStore();
  const upgradeRef = useRef<{
    open: () => void;
    close: () => void;
    validateUpgrade: () => Promise<boolean>;
  }>(null);

  useEffect(() => {
    // 初始化获取企业信息
    enterpriseStore.loadInfo();

    // 监听登录事件
    if (window.$chat53ai) {
      window.$chat53ai.$on(
        "agenthub:service",
        (
          _event: unknown,
          { type, data }: { type?: string; data?: unknown } = {},
        ) => {
          console.log(type, data);
          if (type === "login") {
            handleLogin();
          }
        },
      );
    }
  }, []);

  const handleLogin = async () => {
    await checkPermission();
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header
      className={`flex-none h-16 sticky top-0 z-10 bg-white ${border ? "border-b" : ""} ${className}`}
    >
      <div
        className={`mx-auto px-4 flex items-center justify-between h-full ${mainClass}`}
      >
        <div className="flex-1 flex items-center gap-2 overflow-hidden">
          <ExpandSidebarButton />
          {beforePrefix}
          {back && (
            <Tooltip title={t("action.back")}>
              <div
                className="flex-none size-7 rounded-md flex items-center justify-center cursor-pointer max-md:hidden hover:bg-[#ECEDEE]"
                onClick={handleBack}
              >
                <LeftOutlined
                  className="text-regular cursor-pointer"
                  style={{ fontSize: 14 }}
                />
              </div>
            </Tooltip>
          )}
          {titlePrefix}
          {titleSlot || (
            <div className="text-base text-primary font-bold line-clamp-1 max-md:flex-1 max-md:text-center">
              {title}
            </div>
          )}
          {titleSuffix}
        </div>

        <div className="flex items-center gap-2">{after || right}</div>
      </div>
      {/* todo: 引入后会报错 */}
      {/* <Upgrade ref={upgradeRef} /> */}
    </header>
  );
}

export default Header;
