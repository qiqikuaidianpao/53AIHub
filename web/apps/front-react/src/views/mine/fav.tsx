import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Empty, Spin } from "antd";
import favoritesApi from "@/api/modules/favorites";
import { getFormatTimeStamp } from "@km/shared-utils";
import { formatFile } from "@/api/modules/files/transform";
import { formatLibrary } from "@/stores/modules/library";
import { VirtualLogo } from "@/components";
import { SvgIcon } from "@km/shared-components-react";
import { getPublicPath } from "@/utils/config";
import { t } from "@/locales";

interface FavLibraryItem {
  favoriteTime: string;
  library: any;
}

interface FavFileItem {
  favoriteTime: string;
  file: any;
  library: any;
  space: any;
}

export default function FavView() {
  const [loading, setLoading] = useState(true);
  const [recentlyLibrary, setRecentlyLibrary] = useState<FavLibraryItem[]>([]);
  const [recentlyFiles, setRecentlyFiles] = useState<FavFileItem[]>([]);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const res = await favoritesApi.list();

      setRecentlyLibrary(
        (res.libraries || []).map((item: any) => ({
          favoriteTime: getFormatTimeStamp(item.favorite_time),
          library: formatLibrary(item.library),
        })),
      );

      setRecentlyFiles(
        (res.files || []).map((item: any) => ({
          favoriteTime: getFormatTimeStamp(item.favorite_time),
          file: formatFile(item.file),
          library: formatLibrary(item.library),
          space: item.space,
        })),
      );
    } catch (error) {
      console.error("Failed to load favorites:", error);
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
              key={item.library.id}
              to={`/library/${item.library.id}`}
              className="h-[75px] rounded items-center flex gap-2 px-4 cursor-pointer hover:bg-[#EEEFF0] border-[1px]"
            >
              <div className="flex-none size-9 flex items-center justify-center">
                <VirtualLogo
                  text={item.library.name}
                  src={item.library.icon}
                  size={36}
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-base text-primary whitespace-nowrap overflow-hidden flex items-center gap-1 text-ellipsis">
                  {item.library.name}
                  <SvgIcon
                    name="star-filled"
                    className="text-[#FFB300]"
                    size="14"
                  />
                </div>
                <p className="pt-0 text-xs text-placeholder">
                  {item.favoriteTime} {t("mine.updated")}
                </p>
              </div>
            </Link>
          ))}
        </div>
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
          <div className="flex-1 max-w-[100px] text-sm text-[#4F5052] font-medium">
            {t("mine.from")}
          </div>
          <div className="flex-1 text-sm text-[#4F5052] font-medium text-right">
            {t("common.recently_updated")}
          </div>
        </div>

        {/* 表格内容 */}
        <div className="flex flex-col gap-1">
          {recentlyFiles.map((item) => (
            <Link
              key={item.file.id}
              to={`/library/${item.library.id}/file/${item.file.id}`}
              className="h-12 flex items-center gap-2 px-4 cursor-pointer hover:bg-[#EEEFF0]"
            >
              {/* 标题列 */}
              <div className="flex-1 flex items-center gap-2 overflow-hidden">
                <img className="flex-none size-6" src={item.file.icon} alt="" />
                <p className="text-sm text-primary truncate">
                  {item.file.name}
                </p>
                <SvgIcon
                  name="star-filled"
                  className="text-[#FFB300]"
                  size="14"
                />
              </div>

              {/* 知识库列 */}
              <div className="flex-1 max-w-[100px] text-sm text-primary truncate">
                {item.space?.name}/{item.library.name}
              </div>

              {/* 收藏时间列 */}
              <div className="flex-1 text-sm text-placeholder text-right">
                {item.favoriteTime}
              </div>
            </Link>
          ))}
          {!loading && recentlyFiles.length === 0 && (
            <Empty
              styles={{ image: { height: 100 } }}
              image={getPublicPath("/images/empty.png")}
            />
          )}
        </div>
      </div>
    </div>
  );
}
