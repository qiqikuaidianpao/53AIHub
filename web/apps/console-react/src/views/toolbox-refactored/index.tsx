/**
 * Toolbox 工具箱页面（重构版）
 * 使用 Zustand 状态管理 + Ant Design Form
 */
import { Modal, message, Input, Button, Spin, Empty } from "antd";
import { HolderOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash-es";

import { PageLayoutContent } from "@/components/PageLayout";
import SortableGroupGrid from "@/components/SortableGroupGrid";
import { GroupTabs } from "@/components/GroupTabs/GroupTabs";
import type {
  SortableGroup,
  SortableRenderProps,
} from "@/components/SortableGroupGrid/types";
import { GROUP_TYPE } from "@/constants/group";
import { t } from "@/locales";

import { useToolboxStore } from "./store";
import { toolboxApi } from "./api/toolboxApi";
import { ALL_GROUP_ID } from "./constants";
import type { AiLinkItem, RawGroupOption } from "./types";
import StoreDialog, { StoreDialogRef } from "./components/StoreDialog";

/**
 * Toolbox 工具箱页面
 */
export function ToolboxRefactoredPage() {
  const navigate = useNavigate();
  const storeDialogRef = useRef<StoreDialogRef>(null);
  const hasLoadedRef = useRef(false);

  // 从 Store 获取状态和方法
  const {
    groupOptions,
    rawGroupOptions,
    selectedGroups,
    keyword,
    loading,
    saving,
    isSort,
    loadGroups,
    loadListData,
    setSelectedGroups,
    setKeyword,
    setIsSort,
    setSaving,
    updateGroupOptions,
    updateSortOrder,
    refresh,
  } = useToolboxStore();

  // 使用 ref 存储 debounce 函数，避免依赖变化导致重新创建
  const debouncedLoadListDataRef = useRef(debounce(() => loadListData(), 300));

  // 计算属性
  const hasAllSelected =
    selectedGroups.includes(ALL_GROUP_ID) || selectedGroups.length === 0;
  let showGroupOptions = groupOptions.filter(
    (item) =>
      String(item.group_id) !== ALL_GROUP_ID && item.children?.length > 0,
  );
  // 当选中具体分组时，只显示选中的分组（参考Vue版本）
  if (selectedGroups.length > 0 && !hasAllSelected) {
    showGroupOptions = showGroupOptions.filter((item) =>
      selectedGroups.some((id) => String(id) === String(item.group_id)),
    );
  }
  // 排序按钮禁用条件：有搜索关键词 或 未选择全部（参考Vue版本）
  const sortDisabled = !!keyword || !hasAllSelected;

  // 初始化加载
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // 分组加载后加载列表
  useEffect(() => {
    if (rawGroupOptions.length > 0 && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadListData();
    }
  }, [rawGroupOptions, loadListData]);

  // 处理分组变更（参考Vue版本：只前端过滤，不重新请求接口）
  const handleGroupChange = useCallback(
    (groups: (string | number)[]) => {
      setSelectedGroups(groups);
    },
    [setSelectedGroups],
  );

  // 处理关键词变更（带防抖）
  const handleKeywordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setKeyword(e.target.value);
      debouncedLoadListDataRef.current();
    },
    [setKeyword],
  );

  // 清理防抖函数
  useEffect(() => {
    return () => {
      debouncedLoadListDataRef.current.cancel();
    };
  }, []);

  // 处理从 GroupTabs 获取选项
  const handleGetOptions = useCallback(
    (options: RawGroupOption[]) => {
      updateGroupOptions(options);
    },
    [updateGroupOptions],
  );

  // 处理排序变更
  const handleSortChange = useCallback(
    (nextGroups: SortableGroup<AiLinkItem>[]) => {
      const updated = groupOptions.map((group) => {
        const matched = nextGroups.find(
          (g) => String(g.id) === String(group.group_id),
        );
        if (matched) {
          return {
            ...group,
            children: matched.items.map((item) => item.data),
          };
        }
        return group;
      });
      updateSortOrder(updated);
    },
    [groupOptions, updateSortOrder],
  );

  // 处理保存排序
  const handleSortSave = useCallback(async () => {
    setSaving(true);
    try {
      const sortItems = groupOptions.flatMap((group) =>
        group.children.map((item, index) => ({
          group_id: Number(group.group_id),
          id: item.ai_link_id,
          sort: group.children.length - index,
        })),
      );
      await toolboxApi.sort(sortItems);
      message.success(t("action_save_success"));
      setIsSort(false);
      refresh();
    } finally {
      setSaving(false);
    }
  }, [groupOptions, setSaving, setIsSort, refresh]);

  // 处理添加
  const handleAdd = useCallback(() => {
    storeDialogRef.current?.open();
  }, []);

  // 处理创建/编辑跳转
  const handleCreate = useCallback(
    (params?: { data?: AiLinkItem }, type = "edit") => {
      const data = params?.data;
      const query: Record<string, string> = {};
      if (data?.ai_link_id) {
        query.id = data.ai_link_id;
      } else if (data?.name && type === "store") {
        query.name = data.name;
      }
      navigate({
        pathname: "/toolbox/create",
        search: new URLSearchParams(query).toString(),
      });
    },
    [navigate],
  );

  // 处理编辑
  const handleEdit = useCallback(
    (item: AiLinkItem) => {
      navigate(`/toolbox/create?id=${item.ai_link_id}`);
    },
    [navigate],
  );

  // 处理访问
  const handleVisit = useCallback((item: AiLinkItem) => {
    if (item.url) {
      window.open(item.url, "_blank");
    }
  }, []);

  // 处理删除
  const handleDelete = useCallback(
    (item: AiLinkItem) => {
      Modal.confirm({
        title: t("action_delete_tip"),
        content: t("action_delete_confirm"),
        onOk: async () => {
          await toolboxApi.delete(item.ai_link_id);
          message.success(t("action_delete_success"));
          refresh();
        },
      });
    },
    [refresh],
  );

  // 渲染工具卡片
  const renderToolCard = useCallback(
    (item: AiLinkItem, handleProps?: SortableRenderProps<AiLinkItem>) => (
      <div
        className="h-[72px] bg-white overflow-hidden group relative border rounded p-4 flex items-center gap-2 cursor-pointer"
        role="button"
        aria-label={item.name}
      >
        {!isSort ? (
          <div className="invisible group-hover:visible w-full h-full z-[2] absolute top-0 left-0 bg-black/40 flex items-center justify-center gap-1.5">
            <Button
              size="small"
              style={{ padding: "0 8px" }}
              onClick={() => handleVisit(item)}
            >
              {t("action_visit")}
            </Button>
            <Button
              type="primary"
              size="small"
              style={{ marginLeft: 0, padding: "0 8px" }}
              onClick={() => handleEdit(item)}
            >
              {t("action_edit")}
            </Button>
            <Button
              size="small"
              style={{ marginLeft: 0, padding: "0 8px" }}
              onClick={() => handleDelete(item)}
            >
              <SvgIcon name="delete" size={16} style={{ color: "#FA5151" }} />
            </Button>
          </div>
        ) : null}
        <img
          className="w-10 h-10 object-cover rounded-full overflow-hidden"
          src={item.logo}
          alt={item.name}
        />
        <div className="flex-1 w-0">
          <div className="text-sm text-[#1D1E1F] font-semibold line-clamp-1">
            {item.name}
          </div>
          <div className="text-sm text-[#1D1E1F] text-opacity-60 line-clamp-1">
            {item.description}
          </div>
        </div>
        {isSort && handleProps && (
          <div
            ref={handleProps.setActivatorNodeRef}
            {...handleProps.attributes}
            {...handleProps.listeners}
            className="sort-icon cursor-move text-[#a1a5af] hover:text-[#666] transition-colors"
          >
            <HolderOutlined style={{ fontSize: 24 }} />
          </div>
        )}
      </div>
    ),
    [isSort, handleVisit, handleEdit, handleDelete],
  );

  // 筛选栏
  const filterBar = (
    <>
      <div className="flex-1 w-0">
        <GroupTabs
          className="w-[200px]"
          type="dropdown"
          value={selectedGroups}
          onChange={handleGroupChange}
          groupType={GROUP_TYPE.AI_LINK}
          disabled={isSort}
          options={rawGroupOptions}
          onOptionsChange={handleGetOptions}
        />
      </div>
      <div className="flex items-center gap-3">
        <Input
          allowClear
          placeholder={t("module.ai_toolbox_search_placeholder_v2")}
          style={{ width: 268 }}
          value={keyword}
          onChange={handleKeywordChange}
          disabled={isSort}
        />
        {isSort ? (
          <>
            <Button onClick={() => setIsSort(false)}>
              {t("action_cancel")}
            </Button>
            <Button type="primary" loading={saving} onClick={handleSortSave}>
              {t("action_save")}
            </Button>
          </>
        ) : (
          <>
            <Button disabled={sortDisabled} onClick={() => setIsSort(true)}>
              {t("action_sort")}
            </Button>
            <Button type="primary" onClick={handleAdd}>
              {t("action_add")}
            </Button>
          </>
        )}
      </div>
    </>
  );

  return (
    <PageLayoutContent header={t("module.ai_toolbox")} filterBar={filterBar}>
      <Spin spinning={loading || saving}>
        {showGroupOptions.length === 0 && !loading ? (
          <Empty description={t("no_data")} className="mt-10" />
        ) : (
          <SortableGroupGrid
            sortable={isSort}
            showGroupTitle={true}
            groups={showGroupOptions.map((group) => ({
              id: group.group_id,
              title: group.group_name,
              items: group.children
                .filter((child) => child.ai_link_id)
                .map((child) => ({
                  id: String(child.ai_link_id),
                  data: child,
                })),
            }))}
            onChange={handleSortChange}
            renderItem={renderToolCard}
          />
        )}
      </Spin>

      {/* 商店对话框 */}
      <StoreDialog
        ref={storeDialogRef}
        showAddManual
        onAdd={(data) => handleCreate(data, "store")}
      />
    </PageLayoutContent>
  );
}

export default ToolboxRefactoredPage;
