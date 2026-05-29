import { Button, Input, Space } from "antd";
import { Dropdown } from "@km/shared-components-react";
import type { MenuProps } from "antd";
import { SvgIcon } from "@km/shared-components-react";
import type { MineTabKey } from "../types";

export interface TabItem {
  label: string;
  value: MineTabKey;
}

export interface MineHeaderProps {
  tabs: TabItem[];
  activeTab: MineTabKey;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  onTabChange: (tab: MineTabKey) => void;
  uploadActions?: {
    importMenuItems: MenuProps["items"];
    createMenuItems: MenuProps["items"];
  };
  audioActions?: {
    onImportFile: () => void;
    importing: boolean;
    hasActiveRecording: boolean;
    onCreateFolder?: () => void;
    onStartRecording?: () => void;
  };
}

/**
 * 我的页面头部组件
 * 包含 Tab 切换、搜索框、操作按钮
 */
export function MineHeader({
  tabs,
  activeTab,
  keyword,
  onKeywordChange,
  onTabChange,
  uploadActions,
  audioActions,
}: MineHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      {/* Tab 切换 */}
      <div className="flex flex-none items-center gap-1 bg-[#F5F5F5] p-1 rounded-xl">
        {tabs.map((item) => (
          <div
            key={item.value}
            className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
              activeTab === item.value
                ? "text-[#1D1E1F] font-medium bg-white rounded-md"
                : "text-[#9A9A9A] hover:text-[#666]"
            }`}
            onClick={() => onTabChange(item.value)}
          >
            {item.label}
          </div>
        ))}
      </div>

      {/* 搜索和操作按钮 */}
      <Space>
        <Input
          placeholder={activeTab === "audio" ? "搜索录音" : "搜索文档"}
          prefix={<SvgIcon name="search" size={16} />}
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          className="max-w-[200px] rounded-lg"
          allowClear
        />

        {/* 上传 Tab 操作 */}
        {activeTab === "upload" && uploadActions && (
          <>
            <Dropdown
              menu={{ items: uploadActions.importMenuItems }}
              placement="bottomRight"
            >
              <Button
                color="primary"
                variant="filled"
                icon={<SvgIcon name="download" size={16} />}
              >
                导入
              </Button>
            </Dropdown>
            <Dropdown
              menu={{ items: uploadActions.createMenuItems }}
              placement="bottomRight"
            >
              <Button type="primary" icon={<SvgIcon name="plus" size={16} />}>
                新建
              </Button>
            </Dropdown>
          </>
        )}

        {/* 音频 Tab 操作 - 有活跃录音时隐藏，无活跃录音时显示 */}
        {activeTab === "audio" &&
          audioActions &&
          !audioActions.hasActiveRecording && (
            <>
              <Button
                color="primary"
                variant="filled"
                icon={<SvgIcon name="download" size={16} />}
                loading={audioActions.importing}
                onClick={audioActions.onImportFile}
              >
                导入
              </Button>
              <Button
                color="primary"
                variant="filled"
                onClick={audioActions.onCreateFolder}
                icon={<SvgIcon name="folder-plus" size={16} />}
              >
                新建文件夹
              </Button>
              <Button type="primary" onClick={audioActions.onStartRecording}>
                <SvgIcon name="voice" size={16} />
                录音
              </Button>
            </>
          )}
      </Space>
    </div>
  );
}

export default MineHeader;
