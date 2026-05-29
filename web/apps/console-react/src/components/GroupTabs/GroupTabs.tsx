import { Tabs, Select, Button } from "antd";
import {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { t } from "@/locales";
import type { Group } from "@/api/modules/group";
import type { GroupType } from "@/constants/group";
import GroupDialog from "@/components/GroupDialog";
import "./index.scss";

// ============================================================================
// Types
// ============================================================================

export type GroupTabsVariant = "tabs" | "dropdown" | "tabs-pure";

export interface GroupTabsProps {
  /** 显示模式 */
  type?: GroupTabsVariant;
  /** 分组类型 */
  groupType?: GroupType;
  /** 当前值（受控） */
  value?: string | number | string[] | number[] | null;
  /** 分组选项 */
  options?: Group[];
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否隐藏底部（确认/取消栏） */
  hideFooter?: boolean;
  /** 是否隐藏前缀 */
  hidePrefix?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 值变化回调 */
  onChange?: (value: string | number | string[]) => void;
  /** 分组选项变化回调 */
  onOptionsChange?: (options: Group[]) => void;
}

export interface GroupTabsRef {
  /** 打开分组管理弹窗 */
  open: () => void;
  /** 获取当前选项 */
  getOptions: () => Group[];
}

// ============================================================================
// Constants
// ============================================================================

const ALL_OPTION: Group = { group_id: "-1", group_name: "all" };
const EMPTY_OPTIONS: Group[] = [];

// Tabs 样式常量（避免每次渲染创建新对象）
const TABS_STYLES = {
  tab: {
    borderRadius: 4,
    background: "#fff",
    color: "#1d1e1f",
    border: "none",
    marginLeft: 0,
    marginRight: 12,
  },
};

// ============================================================================
// Helpers
// ============================================================================

function toArray(val: unknown): (string | number)[] {
  if (Array.isArray(val)) return val;
  if (val == null) return [];
  return [val] as (string | number)[];
}

function filterAllOption(val: (string | number)[]): (string | number)[] {
  // dropdown 模式不包含 "全部" 选项，需要过滤掉 -1
  return val.filter((v) => String(v) !== "-1");
}

function buildOptions(options: Group[], includeAll: boolean): Group[] {
  return includeAll ? [ALL_OPTION, ...options] : [...options];
}

// ============================================================================
// Component
// ============================================================================

export const GroupTabs = forwardRef<GroupTabsRef, GroupTabsProps>(
  (
    {
      type = "tabs",
      groupType,
      value,
      options = EMPTY_OPTIONS,
      disabled = false,
      hideFooter = false,
      hidePrefix = false,
      className,
      onChange,
      onOptionsChange,
    },
    ref,
  ) => {
    const isDropdown = type === "dropdown";
    const isTabsPure = type === "tabs-pure";
    const includeAll = !isTabsPure && !isDropdown; // dropdown 模式不包含 "全部"

    // Refs
    const dialogRef = useRef<{ open: () => void }>(null);
    const selectRef = useRef<any>(null);
    const prevOptionsRef = useRef<Group[]>(options);

    // State
    const [activeTab, setActiveTab] = useState<string | number>(
      (value as string | number) ?? "",
    );
    const [tabOptions, setTabOptions] = useState<Group[]>(() =>
      buildOptions(options, includeAll),
    );
    const [selectedValue, setSelectedValue] = useState<(string | number)[]>(
      () => filterAllOption(toArray(value)),
    );
    const [selectOpen, setSelectOpen] = useState(false);

    // 同步外部 value
    useEffect(() => {
      if (isDropdown) {
        // dropdown 模式过滤掉 "-1"（全部选项）
        setSelectedValue(filterAllOption(toArray(value)));
      } else {
        setActiveTab((value as string | number) ?? "");
      }
    }, [value, isDropdown]);

    // 同步外部 options（带比较防护，避免无限循环）
    useEffect(() => {
      const isSame =
        options.length === prevOptionsRef.current.length &&
        options.every(
          (item, index) =>
            item.group_id === prevOptionsRef.current[index]?.group_id,
        );
      if (isSame) return;
      prevOptionsRef.current = options;
      setTabOptions(buildOptions(options, includeAll));
    }, [options, includeAll]);

    // 分组变化处理
    const handleGroupChange = (result: { value: Group[] }) => {
      if (isTabsPure) return;

      const newOptions = result.value || [];

      // Vue 原版逻辑：先清空再设置
      setTabOptions([]);

      setTimeout(() => {
        const finalOptions = buildOptions(newOptions, includeAll);
        setTabOptions(finalOptions);
        onOptionsChange?.(finalOptions);

        // tabs 模式：当前选中项不存在时切换到第一个
        if (!isDropdown && includeAll) {
          const exists = finalOptions.some(
            (o) => String(o.group_id) === String(activeTab),
          );
          if (!exists && finalOptions.length > 0) {
            const newActive = finalOptions[0].group_id;
            setActiveTab(newActive);
            onChange?.(newActive);
          }
        }
      }, 0);
    };

    // Tab 切换
    const handleTabChange = (key: string) => {
      setActiveTab(key);
      onChange?.(key);
    };

    // 取消选择 - 恢复到原始值
    const handleCancel = () => {
      setSelectedValue(filterAllOption(toArray(value)));
      setSelectOpen(false);
    };

    // 确认选择
    const handleConfirm = () => {
      onChange?.(selectedValue as string[]);
      setSelectOpen(false);
    };

    // Select 打开/关闭
    const handleOpenChange = (open: boolean) => {
      setSelectOpen(open);
      if (!open) {
        handleCancel();
      }
    };

    // 打开分组管理
    const openDialog = () => {
      setSelectOpen(false);
      setTimeout(() => dialogRef.current?.open(), 100);
    };

    // 暴露方法
    useImperativeHandle(ref, () => ({
      open: () => dialogRef.current?.open(),
      getOptions: () => tabOptions,
    }));

    // ========== Dropdown 模式 ==========
    if (isDropdown) {
      // 计算显示的 prefix 文本：选中分组时显示"分组：第一个分组名称"，选中多个时后面折叠
      const selectedOptions = tabOptions.filter((opt) =>
        selectedValue.includes(opt.group_id)
      );
      const prefixText = selectedOptions.length
        ? t("group") + "：" + (selectedOptions[0].group_name || "--")
        : t("group") + "：";

      // 选中一个时隐藏 tags，选中多个时显示 tag "+N"
      const showTags = selectedOptions.length > 1;
      const extraCount = selectedOptions.length > 1 ? selectedOptions.length - 1 : 0;

      return (
        <div className="group-tabs-dropdown">
          <Select
            ref={selectRef}
            open={selectOpen}
            mode="multiple"
            maxTagCount={0}
            disabled={disabled}
            prefix={
              hidePrefix ? undefined : (
                <span className="flex items-center max-w-48 text-sm truncate">
                  <span className="truncate">{prefixText}</span>
                  {showTags && (
                    <span className="ml-1 px-1.5 h-5 text-xs text-gray-600 bg-[#f4f4f5] rounded inline-flex items-center">
                      +{extraCount}
                    </span>
                  )}
                </span>
              )
            }
            placeholder={t("all")}
            value={selectedValue}
            onChange={setSelectedValue}
            onOpenChange={handleOpenChange}
            options={tabOptions.map((opt) => ({
              label: opt.group_name,
              value: opt.group_id,
            }))}
            classNames={{
              root: className || "w-full min-w-[100px] max-w-[160px]",
              popup: { root: "!w-[220px]" },
            }}
            notFoundContent={
              <div className="text-center text-[#A4AABA] text-sm py-8">
                {t("no_data")}
              </div>
            }
            popupRender={
              !hideFooter
                ? (menu) => (
                    <>
                      {menu}
                      <DropdownFooter
                        onCancel={handleCancel}
                        onConfirm={handleConfirm}
                        onManage={openDialog}
                      />
                    </>
                  )
                : undefined
            }
          />
          {groupType && (
            <GroupDialog
              ref={dialogRef}
              groupType={groupType}
              onChange={handleGroupChange}
            />
          )}
        </div>
      );
    }

    // ========== Tabs 模式 ==========
    return (
      <div className="group-tabs">
        <Tabs
          activeKey={String(activeTab ?? "")}
          onChange={handleTabChange}
          type="card"
          items={tabOptions.map((opt) => ({
            key: String(opt.group_id),
            label: isTabsPure ? opt.group_name : t(opt.group_name),
            disabled: disabled || opt.disabled,
          }))}
          styles={TABS_STYLES}
          style={{
            "--ant-line-width": 0,
            "--ant-tabs-horizontal-margin": 0,
          }}
          // 内容超出时显示左右滚动箭头
          indicator={{ size: 0 }}
        />
        {groupType && (
          <GroupDialog
            ref={dialogRef}
            groupType={groupType}
            onChange={handleGroupChange}
          />
        )}
      </div>
    );
  },
);

GroupTabs.displayName = "GroupTabs";

// ============================================================================
// Sub-components
// ============================================================================

interface DropdownFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  onManage: () => void;
}

function DropdownFooter({
  onCancel,
  onConfirm,
  onManage,
}: DropdownFooterProps) {
  return (
    <div className="group-tabs-dropdown-footer">
      <div className="group-tabs-dropdown-footer-link" onClick={onManage}>
        {t("group_management")}
      </div>
      <div className="flex gap-2">
        <Button size="small" onClick={onCancel}>
          {t("action_cancel")}
        </Button>
        <Button size="small" type="primary" onClick={onConfirm}>
          {t("action_confirm")}
        </Button>
      </div>
    </div>
  );
}

export default GroupTabs;
