import { t } from "@/locales";
import { useState, useEffect } from "react";
import { Table, Select, Button, message, Spin } from "antd";
import platformSettingsApi from "@/api/modules/platform-settings";
import { transformPlatformSetting } from "@/api/modules/platform-settings/transform";
import type { PlatformSetting } from "@/api/modules/platform-settings/types";
import { settingApi } from "@/api/modules/setting";
import { getPublicPath } from "@/utils/config";

export function KnowledgeDocumentSetting() {
  const [isLoading, setIsLoading] = useState(true);
  const [wpsSetting, setWpsSetting] = useState<PlatformSetting | null>(null);
  const [baiduEditorSetting, setBaiduEditorSetting] = useState(true);
  const [settingId, setSettingId] = useState<number | null>(null);
  const [tableData, setTableData] = useState([
    {
      ext: "doc",
      name: "Word",
      shortName: "DOC",
      extensions: "doc, docx",
      preview: "default",
      editor: "default",
      allow_wps: true,
      allow_baidu_editor: false,
    },
    {
      ext: "xls",
      name: "Excel",
      shortName: "XLS",
      extensions: "xls, xlsx, csv",
      preview: "default",
      editor: "default",
      allow_wps: true,
      allow_baidu_editor: false,
    },
    {
      ext: "ppt",
      name: "PowerPoint",
      shortName: "PPT",
      extensions: "ppt, pptx",
      preview: "default",
      editor: "default",
      allow_wps: true,
      allow_baidu_editor: false,
    },
    {
      ext: "pdf",
      name: "PDF",
      shortName: "PDF",
      extensions: "pdf",
      preview: "default",
      editor: "default",
      allow_wps: true,
      allow_baidu_editor: false,
    },
    {
      ext: "md",
      name: "Markdown",
      shortName: "MD",
      extensions: "md, txt",
      preview: "default",
      editor: "builtin_editor",
      allow_wps: false,
      allow_baidu_editor: false,
    },
    {
      ext: "html",
      name: "HTML",
      shortName: "HTML",
      extensions: "html, htm",
      preview: "default",
      editor: "default",
      allow_wps: false,
      allow_baidu_editor: true,
    },
  ]);

  const SETTING_KEY = "document_js_sdk_setting";

  const loadWpsSetting = async () => {
    try {
      const res = await platformSettingsApi.find();
      const wpsItem = res.find((item: any) => item.platform_key === "wps");
      if (wpsItem) {
        return transformPlatformSetting(wpsItem);
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const loadViewerSetting = async (wpsSet: PlatformSetting | null) => {
    try {
      const res = await settingApi.get(SETTING_KEY);
      let valueData: any = { preview: {}, editor: {} };
      if (res.data) {
        setSettingId(res.data.setting_id);
        valueData = JSON.parse(res.data.value);
      }
      setTableData((prevData) =>
        prevData.map((item) => {
          const data = valueData.preview[item.ext];
          const editorData = valueData.editor[item.ext];
          const newItem = { ...item };
          if (data) {
            newItem.preview = wpsSet ? data : "default";
          }
          if (editorData) {
            // 根据类型和配置判断是否应用保存的编辑器设置
            const validEditorOptions = ["default"];
            if (item.ext === "md") {
              validEditorOptions.push("builtin_editor");
            }
            if (baiduEditorSetting && item.allow_baidu_editor) {
              validEditorOptions.push("baidu_editor");
            }
            if (wpsSet && item.allow_wps) {
              validEditorOptions.push("wps");
            }
            newItem.editor = validEditorOptions.includes(editorData)
              ? editorData
              : "default";
          }
          return newItem;
        }),
      );
    } catch (e) {
      console.error(e);
    }
  };

  const initData = async () => {
    setIsLoading(true);
    const wpsSet = await loadWpsSetting();
    setWpsSetting(wpsSet);
    await loadViewerSetting(wpsSet);
    setIsLoading(false);
  };

  useEffect(() => {
    initData();
  }, []);

  const handleSave = async () => {
    const data = {
      key: SETTING_KEY,
      value: JSON.stringify({
        preview: tableData.reduce((acc: any, item: any) => {
          acc[item.ext] = item.preview;
          return acc;
        }, {}),
        editor: tableData.reduce((acc: any, item: any) => {
          acc[item.ext] = item.editor;
          return acc;
        }, {}),
      }),
    };
    try {
      if (settingId) {
        await settingApi.update(settingId, data);
      } else {
        await settingApi.create(data);
      }
      await loadViewerSetting(wpsSetting);
      message.success(t("action_save_success"));
    } catch (e) {
      console.error(e);
      message.error("Failed to save settings");
    }
  };

  const columns = [
    {
      title: t("document_setting.type"),
      dataIndex: "type",
      key: "type",
      render: (_: any, row: any) => (
        <div className="flex items-center gap-2">
          <img
            src={getPublicPath(`/images/parse/${row.ext}.png`)}
            className="w-5 h-5"
            alt={row.ext}
          />
          <span className="text-sm text-[#4F5052]">{row.name}</span>
        </div>
      ),
    },
    {
      title: t("document_setting.support_format"),
      dataIndex: "extensions",
      key: "extensions",
      render: (text: string) => (
        <span className="text-sm text-gray-600">{text}</span>
      ),
    },
    {
      title: t("document_setting.view"),
      dataIndex: "preview",
      key: "preview",
      width: 160,
      render: (text: string, row: any, index: number) => (
        <Select
          value={row.preview}
          disabled={!row.allow_wps}
          onChange={(val) => {
            const newData = [...tableData];
            newData[index].preview = val;
            setTableData(newData);
          }}
          className="w-full"
          options={[
            { label: t("document_setting.builtin_viewer"), value: "default" },
            ...(wpsSetting ? [{ label: "WPS WebOffice", value: "wps" }] : []),
          ]}
        />
      ),
    },
    {
      title: t("document_setting.edit"),
      dataIndex: "editor",
      key: "editor",
      width: 160,
      render: (text: string, row: any, index: number) => (
        <Select
          value={row.editor}
          disabled={!row.allow_wps && !row.allow_baidu_editor}
          onChange={(val) => {
            const newData = [...tableData];
            newData[index].editor = val;
            setTableData(newData);
          }}
          className="w-full"
          options={[
            { label: t("document_setting.not_open"), value: "default" },
            ...(row.ext === "md"
              ? [
                  {
                    label: t("document_setting.builtin_editor"),
                    value: "builtin_editor",
                  },
                ]
              : []),
            ...(wpsSetting && row.allow_wps
              ? [{ label: "WPS WebOffice", value: "wps" }]
              : []),
            ...(baiduEditorSetting && row.allow_baidu_editor
              ? [{ label: "百度编辑器", value: "baidu_editor" }]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <div className="h-full py-5 px-2 overflow-auto">
      <Spin spinning={isLoading}>
        <div className="px-5 py-4 border rounded-md">
          <Table
            dataSource={tableData}
            columns={columns}
            rowKey="ext"
            pagination={false}
          />
        </div>
        <div className="mt-6">
          <Button type="primary" onClick={handleSave}>
            {t("action_save")}
          </Button>
        </div>
      </Spin>
    </div>
  );
}

export default KnowledgeDocumentSetting;
