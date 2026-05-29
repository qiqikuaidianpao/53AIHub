import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Empty, Spin } from "antd";
import { filesApi } from "@/api/modules/files";
import { librariesApi } from "@/api/modules/libraries";
import { formatFile } from "@/api/modules/files/transform";
import { formatLibrary } from "@/stores/modules/library";
import { VirtualLogo } from "@/components";
import { getPublicPath } from "@/utils/config";
import { t } from "@/locales";

export default function VisitView() {
  const [loading, setLoading] = useState(true);
  const [recentlyLibrary, setRecentlyLibrary] = useState<any[]>([]);
  const [recentlyFiles, setRecentlyFiles] = useState<any[]>([]);

  useEffect(() => {
    loadRecentlyData();
  }, []);

  const loadRecentlyData = async () => {
    setLoading(true);
    try {
      const [librariesRes, filesRes] = await Promise.all([
        librariesApi.recently(),
        filesApi.recently(),
      ]);

      setRecentlyLibrary(
        (librariesRes || [])
          .slice(0, 4)
          .map((item: any) => formatLibrary(item)),
      );
      setRecentlyFiles(
        (filesRes || []).slice(0, 10).map((item: any) => formatFile(item)),
      );
    } catch (error) {
      console.error("Failed to load recently data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* 知识库部分 */}
      <div className="mt-8 items-center justify-between">
        <h4 className="text-base text-[#1D1E1F]">{t("library.name")}</h4>
        <div className="grid grid-cols-4 gap-4 mt-4 max-md:grid-cols-2 max-[480px]:grid-cols-1">
          {recentlyLibrary.map((item) => (
            <Link
              key={item.id}
              to={`/library/${item.id}`}
              className="h-[75px] rounded items-center flex gap-2 px-4 cursor-pointer hover:bg-[#EEEFF0] border-[1px]"
            >
              <div className="flex-none size-9 flex items-center justify-center">
                <VirtualLogo text={item.name} src={item.icon} size={36} />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-base text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                  {item.name}
                </div>
                <p className="pt-0 text-xs text-placeholder">
                  {item.updated_date} {t("mine.updated")}
                </p>
              </div>
            </Link>
          ))}
        </div>
        {!loading && recentlyLibrary.length === 0 && (
          <Empty
            className="mx-auto !py-0"
            styles={{ image: { height: 80 } }}
            image={getPublicPath("/images/empty.png")}
            description={t("common.no_data")}
          />
        )}
      </div>

      {/* 知识内容部分 */}
      <div className="flex items-center justify-between mt-10">
        <h4 className="text-base text-[#1D1E1F]">{t("mine.knowledge")}</h4>
      </div>

      {/* 表格头部 */}
      <div className="bg-white rounded-lg border border-gray-200 mt-4">
        <div className="h-12 flex items-center gap-2 px-4 border-b border-gray-100">
          <div className="flex-1 text-sm text-[#4F5052] font-medium">
            {t("common.title")}
          </div>
          <div className="flex-1 text-sm text-[#4F5052] font-medium text-right">
            {t("common.recently_updated")}
          </div>
        </div>

        {/* 表格内容 */}
        <div className="flex flex-col gap-1">
          {recentlyFiles.map((item) => (
            <Link
              key={item.id}
              to={`/library/${item.library_id}/file/${item.id}`}
              className="h-12 flex items-center gap-2 px-4 cursor-pointer hover:bg-[#EEEFF0]"
            >
              {/* 标题列 */}
              <div className="flex-1 flex items-center gap-2 overflow-hidden">
                <img className="flex-none size-6" src={item.icon} alt="" />
                <p className="flex-1 text-sm text-primary truncate">
                  {item.name}
                </p>
              </div>

              {/* 浏览时间列 */}
              <div className="flex-1 text-sm text-placeholder text-right">
                {item.updated_at}
              </div>
            </Link>
          ))}
          {!loading && recentlyFiles.length === 0 && (
            <Empty
              className="mx-auto !py-0"
              styles={{ image: { height: 80 } }}
              image={getPublicPath("/images/empty.png")}
              description={t("common.no_data")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
