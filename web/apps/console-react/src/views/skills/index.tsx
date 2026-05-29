import { SearchOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Switch, Table, message, Modal } from "antd";
import type { ColumnsType } from "antd/es/table";
import CreateSkillDialog from "./components/CreateSkillDialog";
import { skillApi } from "@/api/modules/skill";
import { GROUP_TYPE } from "@/constants/group";
import { PublishStatus_TYPE } from "@/api/modules/skill/types";
import GroupTabs from "@/components/GroupTabs";
import { PageLayoutContent } from "@/components/PageLayout";
import { t } from "@/locales";

import type { Group } from "@/api/modules/group";

interface SkillItem {
  id: string;
  skill_name: string;
  display_name: string;
  description: string;
  group_ids: number[];
  group_names: string[];
  admin_status: "enabled" | "disabled";
  status: number;
  eid: number;
  publish_status: string;
}

interface FilterForm {
  group_id: number[];
  keyword: string;
  page: number;
  page_size: number;
}

export default function Skills() {
  const navigate = useNavigate();
  const groupTabsRef = useRef<any>(null);
  const createSkillRef = useRef<any>(null);

  const [filterForm, setFilterForm] = useState<FilterForm>({
    group_id: [],
    keyword: "",
    page: 1,
    page_size: 10,
  });
  const [tableData, setTableData] = useState<SkillItem[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);

  const getGroupList = useCallback(() => {
    const options = groupTabsRef.current?.getOptions() || [];
    const idNameMap: Record<number, string> = {};
    if (options?.length > 0) {
      options.forEach((item: Group) => {
        idNameMap[item.group_id] = item.group_name;
      });
    }
    return idNameMap;
  }, []);

  const fetchSkillData = useCallback(
    async (params?: { page?: number; page_size?: number; group_id?: number[]; keyword?: string }) => {
      const page = params?.page ?? filterForm.page;
      const pageSize = params?.page_size ?? filterForm.page_size;
      const groupId = params?.group_id ?? filterForm.group_id;
      const keyword = params?.keyword ?? filterForm.keyword;

      setTableLoading(true);
      try {
        const { total = 0, list = [] } = await skillApi.list({
          params: {
            group_id: groupId.join(","),
            keyword,
            offset: (page - 1) * pageSize,
            limit: pageSize,
          },
        });
        setTableTotal(total);
        const options = getGroupList();
        const data = [...list].map((item: any) => {
          item.status =
            item.admin_status === "enabled"
              ? 1
              : item.admin_status === "disabled"
                ? 0
                : null;
          item.group_ids = item.group_ids || [];
          item.group_names = [];
          item.group_ids.forEach((id: number) => {
            if (options[id]) {
              item.group_names.push(options[id]);
            }
          });
          return item;
        });
        setTableData(data);
      } finally {
        setTableLoading(false);
      }
    },
    [filterForm.page, filterForm.page_size, filterForm.group_id, filterForm.keyword, getGroupList],
  );

  const refresh = useCallback(async () => {
    setFilterForm((prev) => ({ ...prev, page: 1 }));
    await fetchSkillData({ page: 1, group_id: filterForm.group_id, keyword: filterForm.keyword });
  }, [fetchSkillData, filterForm.group_id, filterForm.keyword]);

  const handlePageChange = useCallback(
    async (page: number, pageSize: number) => {
      setFilterForm((prev) => ({ ...prev, page, page_size: pageSize }));
      await fetchSkillData({ page, page_size: pageSize });
    },
    [fetchSkillData],
  );

  const handleStatusToggle = async (row: SkillItem) => {
    // 先计算新状态
    const newStatus = row.status === 1 ? "disabled" : "enabled";
    const oldStatus = row.status;

    // 先更新 UI 状态
    setTableData((prev) =>
      prev.map((item) =>
        item.id === row.id
          ? { ...item, status: newStatus === "enabled" ? 1 : 0 }
          : item,
      ),
    );

    try {
      await skillApi.update_status({
        skill_id: row.id,
        admin_status: newStatus,
      });
      message.success(t("action_save_success"));
    } catch (error) {
      // 发生错误时恢复原状态
      setTableData((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, status: oldStatus } : item,
        ),
      );
    }
  };

  const handleMoreCommand = async (command: string, data?: any) => {
    switch (command) {
      case "add":
        createSkillRef.current?.open();
        break;
      case "edit":
        navigate({
          pathname: "/skill-detail",
          search: `?skill_id=${data.id}`,
        });
        break;
      case "delete":
        Modal.confirm({
          title: t("tip"),
          content: t("skills.delete_confirm", { skill: data.skill_name }),
          onOk: async () => {
            await skillApi.delete({ skill_id: data.id });
            message.success(t("action_delete_success"));
            fetchSkillData();
          },
        });
        break;
    }
  };

  const onRowClick = (row: SkillItem) => {
    handleMoreCommand("edit", row);
  };

  useEffect(() => {
    // 数据加载由 GroupTabs onOptionsChange 触发
  }, []);

  const columns: ColumnsType<SkillItem> = [
    {
      title: t("name"),
      dataIndex: "skill_name",
      minWidth: 140,
      ellipsis: true,
      render: (_: any, row: SkillItem) => (
        <div>
          <div className="text-sm">{row.skill_name}</div>
          <div className="text-xs text-gray-400">{row.display_name}</div>
        </div>
      ),
    },
    {
      title: t("description"),
      dataIndex: "description",
      minWidth: 250,
      ellipsis: true,
      render: (text: string) => (
        <span className={!text ? "text-gray-400" : ""}>{text || "--"}</span>
      ),
    },
    {
      title: t("group"),
      dataIndex: "group_names",
      minWidth: 180,
      render: (names: string[]) => (
        <span className={!names?.length ? "text-gray-400" : ""}>
          {names?.join("、") || "--"}
        </span>
      ),
    },
    {
      title: t("action_enable"),
      width: 100,
      render: (_: any, row: SkillItem) => (
        <div>
          {row.publish_status === PublishStatus_TYPE.draft ? (
            <div>草稿</div>
          ) : (
            <div onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={row.status === 1}
                onChange={() => handleStatusToggle(row)}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      title: t("operation"),
      width: 120,
      align: "right",
      fixed: "right",
      render: (_: any, row: SkillItem) => (
        <div className="invisible group-hover:visible flex gap-2 justify-end">
          <Button
            type="link"
            icon={<SvgIcon name="edit" />}
            className="hover:!text-blue-600 px-0"
            onClick={(e) => {
              e.stopPropagation();
              handleMoreCommand("edit", row);
            }}
          />
          <Button
            type="link"
            icon={<SvgIcon name="delete" />}
            className="hover:!text-red-500 px-0"
            disabled={row.eid === 0}
            onClick={(e) => {
              e.stopPropagation();
              handleMoreCommand("delete", row);
            }}
          />
        </div>
      ),
    },
  ];

  const filterBar = (
    <>
      <div className="flex items-center gap-3">
        <GroupTabs
          className="w-[200px]"
          ref={groupTabsRef}
          value={filterForm.group_id}
          onChange={(val: number[]) => {
            setFilterForm((prev) => ({ ...prev, group_id: val, page: 1 }));
            fetchSkillData({ page: 1, group_id: val, keyword: filterForm.keyword });
          }}
          type="dropdown"
          groupType={GROUP_TYPE.SKILLS}
          onOptionsChange={() => refresh()}
        />
        <Input
          style={{ width: 256 }}
          value={filterForm.keyword}
          onChange={(e) =>
            setFilterForm((prev) => ({ ...prev, keyword: e.target.value }))
          }
          onPressEnter={refresh}
          placeholder={t("skills.search_placeholder")}
          prefix={<SearchOutlined />}
          allowClear
        />
      </div>
      <Button type="primary" onClick={() => handleMoreCommand("add")}>
        {t("skills.action_add")}
      </Button>
    </>
  );

  return (
    <>
      <PageLayoutContent header={t("module.skills")} filterBar={filterBar}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tableData}
          loading={tableLoading}
          pagination={{
            current: filterForm.page,
            pageSize: filterForm.page_size,
            total: tableTotal,
            showSizeChanger: true,
            showTotal: (total) => t("table_footer_text", { total }),
            onChange: handlePageChange,
          }}
          onRow={(record) => ({
            onClick: () => onRowClick(record),
            className: "group cursor-pointer",
          })}
        />
      </PageLayoutContent>
      <CreateSkillDialog ref={createSkillRef} />
    </>
  );
}
