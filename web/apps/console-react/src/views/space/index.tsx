import { Table, Input, Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { t } from "@/locales";
import type { ColumnsType } from "antd/es/table";
import { SvgIcon } from "@km/shared-components-react";
import { spacesApi } from "@/api/modules/spaces";
import { transformSpaceList } from "@/api/modules/spaces/transform";
import type {
  SpaceItem,
  SpaceDisplayItem,
  SpaceListRequest,
} from "@/api/modules/spaces/types";
import Detail, { DetailRef } from "./components/Detail";
import { getPublicPath } from "@/utils/config";
export function SpacePage() {
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<SpaceDisplayItem[]>([]);
  const [total, setTotal] = useState(0);
  const detailRef = useRef<DetailRef>(null);

  const [filterForm, setFilterForm] = useState<SpaceListRequest>({
    name: "",
    offset: 0,
    limit: 10,
    view: "admin",
  });

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await spacesApi.list(filterForm);
      setTableData(transformSpaceList(res?.spaces || []));
      setTotal(res?.count || 0);
    } catch (error) {
      console.error("Load space list error:", error);
    } finally {
      setLoading(false);
    }
  }, [filterForm]);

  const refresh = useCallback(
    (reset: boolean = true) => {
      if (reset) {
        setFilterForm((prev) => ({ ...prev, offset: 0 }));
      }
      loadData();
    },
    [loadData],
  );

  // Handle search
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilterForm((prev) => ({ ...prev, name: e.target.value, offset: 0 }));
    },
    [],
  );

  const handleSearch = useCallback(() => {
    refresh();
  }, [refresh]);

  // Handle view
  const handleView = useCallback((item: SpaceDisplayItem) => {
    detailRef.current?.open(item as SpaceItem);
  }, []);

  // Pagination handlers
  const handlePageSizeChange = useCallback((page: number, pageSize: number) => {
    setFilterForm((prev) => ({
      ...prev,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilterForm((prev) => ({ ...prev, offset: (page - 1) * prev.limit }));
  }, []);

  // Table columns
  const columns: ColumnsType<SpaceDisplayItem> = useMemo(
    () => [
      {
        title: t("common.name"),
        dataIndex: "name",
        key: "name",
        minWidth: 160,
        maxWidth: 200,
        ellipsis: true,
        render: (_, record) => (
          <div className="flex items-center gap-2">
            <img
              src={record.icon}
              className="size-7 rounded-full"
              alt={record.name}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = getPublicPath("/images/default_agent.png");
              }}
            />
            <span>{record.name}</span>
          </div>
        ),
      },
      {
        title: t("common.creator"),
        dataIndex: "owner_info",
        key: "owner_info",
        minWidth: 160,
        maxWidth: 200,
        ellipsis: true,
        render: (_, record) => {
          if (record.is_default) {
            return (
              <div className="flex items-center gap-2">
                <div className="size-7 bg-[#E0EEFF] flex items-center justify-center rounded-full">
                  <div className="text-xs text-[#2563EB]">系</div>
                </div>
                {t("space.system")}
              </div>
            );
          }
          return (
            <div className="flex items-center gap-2">
              <img
                src={(record.owner_info as any)?.avatar}
                className="size-7 rounded-full"
                alt=""
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "/images/default_avatar.png";
                }}
              />
              {(record.owner_info as any)?.nickname || "--"}
            </div>
          );
        },
      },
      {
        title: t("created_time"),
        dataIndex: "created_time",
        key: "created_time",
        minWidth: 160,
        render: (time: string) => time || "--",
      },
      {
        title: t("knowledge.name"),
        dataIndex: "library_count",
        key: "library_count",
        minWidth: 120,
      },
      {
        title: t("operation"),
        key: "operation",
        width: 80,
        align: "right",
        render: (_, record) => (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="link"
              icon={<SvgIcon name="view" />}
              onClick={(e) => {
                e.stopPropagation();
                handleView(record);
              }}
            />
          </div>
        ),
      },
    ],
    [t, handleView],
  );

  useEffect(() => {
    loadData();
  }, [filterForm.offset, filterForm.limit]);

  return (
    <div className="h-full flex flex-col bg-white px-2 py-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Input
            value={filterForm.name}
            onChange={handleSearchChange}
            onPressEnter={handleSearch}
            onBlur={handleSearch}
            style={{ maxWidth: 268 }}
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t("space.search_placeholder")}
          />
        </div>
        <div className="flex items-center gap-3" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg mt-4">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tableData}
          loading={loading}
          pagination={{
            current: Math.floor(filterForm.offset / filterForm.limit) + 1,
            pageSize: filterForm.limit,
            total,
            showSizeChanger: true,
            showTotal: (total) => t("table_footer_text", { total }),
            onChange: handlePageChange,
            onShowSizeChange: handlePageSizeChange,
          }}
          scroll={{ x: "max-content" }}
          onRow={(record) => ({
            className: "group cursor-pointer",
            onClick: () => handleView(record),
          })}
        />
      </div>

      {/* Detail Drawer */}
      <Detail ref={detailRef} onRefresh={refresh} />
    </div>
  );
}

export default SpacePage;
