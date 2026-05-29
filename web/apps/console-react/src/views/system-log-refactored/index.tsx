/**
 * System Log 系统日志页面（重构版）
 * 使用 Zustand 状态管理
 */
import { useEffect, useCallback } from "react";
import { Select, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";

import { t } from "@/locales";
import { PageLayoutContent } from "@/components/PageLayout";
import { DateRangeFilter } from "@/components/Filter";

import {
  useSystemLogStore,
  calculateCurrentPage,
  calculateOffset,
} from "./store";
import { COLUMN_WIDTH, EMPTY_TEXT_COLOR, PAGE_SIZE_OPTIONS } from "./constants";
import type { SystemLogDisplayItem } from "./types";

/**
 * 渲染可空文本
 */
function renderNullableText(
  value: string | number | undefined | null,
): React.ReactNode {
  if (value === undefined || value === null || value === "") {
    return <span style={{ color: EMPTY_TEXT_COLOR }}>-</span>;
  }
  return String(value);
}

/**
 * 系统日志页面
 */
export function SystemLogRefactoredPage() {
  // 从 Store 获取状态和方法
  const {
    list,
    total,
    actions,
    modules,
    params,
    dateRange,
    loading,
    loadList,
    loadActions,
    loadModules,
    setParams,
    setFilterParams,
    setDateRange,
  } = useSystemLogStore();

  // 计算当前页码
  const currentPage = calculateCurrentPage(params.offset, params.limit);

  // 表格列定义
  const columns: ColumnsType<SystemLogDisplayItem> = [
    {
      title: t("system_log.log_time"),
      dataIndex: "action_time",
      key: "action_time",
      width: COLUMN_WIDTH.ACTION_TIME,
      render: renderNullableText,
    },
    {
      title: t("system_log.log_action"),
      dataIndex: "action",
      key: "action",
      width: COLUMN_WIDTH.ACTION,
      render: (value: number) => {
        const found = actions.find((item) => item.value === value);
        return found ? found.text : renderNullableText(value);
      },
    },
    {
      title: t("system_log.log_module"),
      dataIndex: "module",
      key: "module",
      width: COLUMN_WIDTH.MODULE,
      render: (value: number) => {
        const found = modules.find((item) => item.value === value);
        return found ? found.text : renderNullableText(value);
      },
    },
    {
      title: t("system_log.log_operator"),
      dataIndex: "nickname",
      key: "nickname",
      width: COLUMN_WIDTH.OPERATOR,
      render: renderNullableText,
    },
    {
      title: t("system_log.log_label"),
      dataIndex: "content",
      key: "content",
      ellipsis: true,
      render: renderNullableText,
    },
    {
      title: t("system_log.log_ip"),
      dataIndex: "ip",
      key: "ip",
      width: COLUMN_WIDTH.IP,
      render: renderNullableText,
    },
  ];

  // 处理分页变化
  const handlePageChange = useCallback(
    (pagination: TablePaginationConfig) => {
      const page = pagination.current || 1;
      const pageSize = pagination.pageSize || params.limit;
      const offset = calculateOffset(page, pageSize);
      setParams({ offset, limit: pageSize });
    },
    [params.limit, setParams],
  );

  // 处理日期范围变化
  const handleDateChange = useCallback(
    (dates: (string | number)[]) => {
      if (dates && dates.length === 2) {
        setDateRange([
          dates[0] ? Number(dates[0]) : null,
          dates[1] ? Number(dates[1]) : null,
        ]);
      } else {
        setDateRange([null, null]);
      }
    },
    [setDateRange],
  );

  // 处理操作类型变化
  const handleActionChange = useCallback(
    (value: number | undefined) => {
      setFilterParams({ action: value });
    },
    [setFilterParams],
  );

  // 处理模块变化
  const handleModuleChange = useCallback(
    (value: number | undefined) => {
      setFilterParams({ module: value });
    },
    [setFilterParams],
  );

  // 初始化加载
  useEffect(() => {
    Promise.all([loadList(), loadActions(), loadModules()]);
  }, [loadList, loadActions, loadModules]);

  // 日期值：过滤掉 null
  const dateValue = dateRange[0] && dateRange[1]
    ? [dateRange[0], dateRange[1]]
    : [];

  // 筛选栏
  const filterBar = (
    <div className="flex gap-2">
      <DateRangeFilter
        value={dateValue}
        valueFormat={(date: Date) => date.getTime()}
        onChange={handleDateChange}
      />
      <Select
        allowClear
        className="w-44"
        placeholder={t("system_log.log_action")}
        value={params.action}
        onChange={handleActionChange}
        options={actions.map((item) => ({
          label: item.text,
          value: item.value,
        }))}
      />
      <Select
        allowClear
        className="w-44"
        placeholder={t("system_log.log_module")}
        value={params.module}
        onChange={handleModuleChange}
        options={modules.map((item) => ({
          label: item.text,
          value: item.value,
        }))}
      />
    </div>
  );

  return (
    <PageLayoutContent header={t("module.system_log")} filterBar={filterBar}>
      <Table<SystemLogDisplayItem>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={list}
        pagination={{
          current: currentPage,
          pageSize: params.limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showTotal: (total) => t("table_footer_text", { total }),
        }}
        onChange={handlePageChange}
      />
    </PageLayoutContent>
  );
}

export default SystemLogRefactoredPage;
