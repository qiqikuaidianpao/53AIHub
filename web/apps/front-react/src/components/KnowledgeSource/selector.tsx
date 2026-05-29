import { useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useState } from "react";
import { Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { DownOutlined, RightOutlined, CheckOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import SpaceDialog from "@/components/Space/dialog";
import { t } from "@/locales";
import type { KnowledgeSourceSelectorProps, KnowledgeSourceState, SelectedFile } from "./types";
import "./selector.css";

export const KnowledgeSourceSelector = forwardRef<any, KnowledgeSourceSelectorProps>(
  function KnowledgeSourceSelector(
    { value, onChange, library, disabled, agentInfo },
    ref
  ) {
    const spaceDialogRef = useRef<any>(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // 下拉框状态变化：点击菜单项时不关闭，只有点击外部时才关闭
    const handleDropdownOpenChange = useCallback((open: boolean, info: any) => {
      // source: 'trigger' = 点击触发器, 'menu' = 点击菜单项
      // 点击菜单项导致关闭时，保持打开状态
      if (!open && info?.source === 'menu') {
        return;
      }
      setDropdownOpen(open);
    }, []);

    // 配置开关
    const graphSearchEnabled = agentInfo?.settings?.graph_search_setting?.enable ?? false;
    const webSearchEnabled = agentInfo?.settings?.web_search_setting?.enable ?? false;

    // 重置方法
    const reset = useCallback(() => {
      const initialState: KnowledgeSourceState = {
        mode: 'all',
        allKnowledge: true,
        knowledgeGraph: agentInfo?.settings?.graph_search_setting?.default_enable ?? false,
        networkSearch: false,
        selectedFiles: []
      };
      onChange(initialState);
    }, [agentInfo, onChange]);

    useImperativeHandle(ref, () => ({ reset }), [reset]);

    // 触发按钮显示内容（图标+文字）
    const displayContent = useMemo(() => {
      // 联网搜索（与全部知识、选择文件互斥）
      if (value.networkSearch) {
        return {
          icon: <SvgIcon name="network" size={16} />,
          text: t("chat.online_search")
        };
      }
      // 从知识库选择文件
      if (value.mode === 'files' && value.selectedFiles.length > 0) {
        return {
          icon: <span className="text-base">@</span>,
          text: `${value.selectedFiles.length}个`
        };
      }
      // 否则显示当前知识库/空间
      if (library?.value?.length > 0) {
        return {
          icon: <SvgIcon name="folder" size={16} />,
          text: library.name
        };
      }
      // 默认显示全部知识（兜底）
      return {
        icon: <SvgIcon name="documents" size={16} />,
        text: t("library.all_knowledge")
      };
    }, [value, library]);

    // 打开文件选择弹窗（先关闭下拉框）
    const handleOpenFileDialog = useCallback(() => {
      setDropdownOpen(false);
      spaceDialogRef.current?.open(value.selectedFiles, library);
    }, [value.selectedFiles, library]);

    // 从知识库选择文件
    const handleSelectFiles = useCallback((files: SelectedFile[]) => {
      // 文件为空时重置为全部知识
      if (files.length === 0) {
        const newState: KnowledgeSourceState = {
          ...value,
          mode: 'all',
          allKnowledge: true,
          selectedFiles: [],
          networkSearch: false,
          knowledgeGraph: false
        };
        onChange(newState);
        return;
      }
      const newState: KnowledgeSourceState = {
        ...value,
        mode: 'files',
        selectedFiles: files,
        allKnowledge: false,
        networkSearch: false,
        knowledgeGraph: false // 选择文件时取消知识图谱
      };
      onChange(newState);
    }, [value, onChange]);

    // 切换全部知识
    const handleToggleAllKnowledge = useCallback(() => {
      // 联网搜索选中时，点击全部知识会取消联网搜索并选中全部知识
      if (value.networkSearch) {
        const newState: KnowledgeSourceState = {
          ...value,
          mode: 'all',
          allKnowledge: true,
          selectedFiles: [],
          networkSearch: false
        };
        onChange(newState);
        return;
      }
      // 当前不是全部知识时（allKnowledge = false），点击切换到全部知识
      if (!value.allKnowledge) {
        const newState: KnowledgeSourceState = {
          ...value,
          mode: 'all',
          allKnowledge: true,
          selectedFiles: []
        };
        onChange(newState);
        return;
      }
      // 全部知识已选中时，不做任何变化（保持选中）
    }, [value, onChange]);

    // 切换知识图谱（与选择文件互斥）
    const handleToggleKnowledgeGraph = useCallback(() => {
      const newKnowledgeGraph = !value.knowledgeGraph;
      const newState: KnowledgeSourceState = {
        ...value,
        mode: 'all',
        allKnowledge: true,
        knowledgeGraph: newKnowledgeGraph,
        networkSearch: false,
        selectedFiles: [] // 知识图谱与选择文件互斥，清空已选文件
      };
      onChange(newState);
    }, [value, onChange]);

    // 切换联网搜索（与全部知识、选择文件、知识图谱都互斥）
    const handleToggleNetworkSearch = useCallback(() => {
      const newState: KnowledgeSourceState = {
        ...value,
        mode: 'all',
        allKnowledge: !value.networkSearch ? false : true, // 选中联网搜索时取消全部知识，取消时恢复
        selectedFiles: [],
        knowledgeGraph: false,
        networkSearch: !value.networkSearch
      };
      onChange(newState);
    }, [value, onChange]);

    // 下拉菜单项
    const menuItems: MenuProps['items'] = useMemo(() => {
      const items: MenuProps['items'] = [
        {
          key: 'select-files',
          label: (
            <div className="flex items-center gap-[10px]">
              <span className="text-base">@</span>
              <span className={`knowledge-source-menu-text`}>{t("chat.select_from_library")}</span>
              {value.mode === 'files' && value.selectedFiles.length > 0 && (
                <span className="knowledge-source-file-count">{value.selectedFiles.length}</span>
              )}
              <RightOutlined className="knowledge-source-menu-arrow" />
            </div>
          ),
          onClick: handleOpenFileDialog
        },
        { type: 'divider' },
        {
          key: 'all-knowledge',
          label: (
            <div className="knowledge-source-menu-item">
              <SvgIcon name="documents" size={16} className={value.allKnowledge ? 'selected' : ''} />
              <span className={`knowledge-source-menu-text ${value.allKnowledge ? 'selected' : ''}`}>{t("library.all_knowledge")}</span>
              {value.allKnowledge && <CheckOutlined className="knowledge-source-menu-check" style={{ fontSize: 14 }} />}
            </div>
          ),
          onClick: handleToggleAllKnowledge
        }
      ];

      if (graphSearchEnabled) {
        items.push({
          key: 'knowledge-graph',
          label: (
            <div className="knowledge-source-menu-item">
              <SvgIcon name="graph_v2" size={16} className={value.knowledgeGraph ? 'selected' : ''} />
              <span className={`knowledge-source-menu-text ${value.knowledgeGraph ? 'selected' : ''}`}>{t("chat.knowledge_graph")}</span>
              {value.knowledgeGraph && <CheckOutlined className="knowledge-source-menu-check" style={{ fontSize: 14 }} />}
            </div>
          ),
          onClick: handleToggleKnowledgeGraph
        });
      }

      if (webSearchEnabled) {
        items.push({
          key: 'network-search',
          label: (
            <div className="knowledge-source-menu-item">
              <SvgIcon name="network" size={16} className={value.networkSearch ? 'selected' : ''} />
              <span className={`knowledge-source-menu-text ${value.networkSearch ? 'selected' : ''}`}>{t("chat.online_search")}</span>
              {value.networkSearch && <CheckOutlined className="knowledge-source-menu-check" style={{ fontSize: 14 }} />}
            </div>
          ),
          onClick: handleToggleNetworkSearch
        });
      }

      return items;
    }, [
      graphSearchEnabled,
      webSearchEnabled,
      value.allKnowledge,
      value.knowledgeGraph,
      value.networkSearch,
      handleOpenFileDialog,
      handleToggleAllKnowledge,
      handleToggleKnowledgeGraph,
      handleToggleNetworkSearch
    ]);

    return (
      <>
        <Dropdown
          open={dropdownOpen}
          onOpenChange={handleDropdownOpenChange}
          menu={{ items: menuItems }}
          trigger={['click']}
          placement="bottom"
          disabled={disabled}
          overlayClassName="knowledge-source-dropdown"
        >
          <Tooltip title={t("index.select_knowledge_range")}>
            <div className={`knowledge-source-trigger ${disabled ? 'disabled' : ''}`}>
              {displayContent.icon}
              <span className="knowledge-source-trigger-text">{displayContent.text}</span>
              <DownOutlined style={{ fontSize: 12 }} />
            </div>
          </Tooltip>
        </Dropdown>

        <SpaceDialog
          ref={spaceDialogRef}
          onConfirm={handleSelectFiles}
        />
      </>
    );
  }
);
