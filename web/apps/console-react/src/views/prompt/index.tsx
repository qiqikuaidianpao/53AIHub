import { Table, Input, Button, Switch, message, Modal } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import { PageLayoutContent } from "@/components/PageLayout";
import { promptApi } from "@/api/modules/prompt";
import { groupApi } from "@/api/modules/group";
import type { Group } from "@/api/modules/group";
import { subscriptionApi } from "@/api/modules/subscription";
import { GroupTabs, type GroupTabsRef } from "@/components/GroupTabs";
import { GROUP_TYPE } from "@/constants/group";
import { eventBus } from "@km/shared-utils";
import { t } from "@/locales";

interface PromptItem {
  prompt_id: number;
  name: string;
  description: string;
  group_ids: number[];
  group_names: string[];
  user_group_names: string[];
  internal_members: string[];
  status: number;
  created_time: string;
}

interface FilterForm {
  group_id: number[];
  keyword: string;
  page: number;
  pageSize: number;
}

export function PromptPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<PromptItem[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [filterForm, setFilterForm] = useState<FilterForm>({
    group_id: [],
    keyword: "",
    page: 1,
    pageSize: 10,
  });

  const groupTabsRef = useRef<GroupTabsRef>(null);
  const internalGroupOptionsRef = useRef<Record<number, string>>({});
  const subscriptionListOptionsRef = useRef<Record<number, string>>({});
  const filterFormRef = useRef<FilterForm>(filterForm);

  // 添加 loading 引用
  const loadingRef = useRef(false);

  // Load subscription list
  const loadSubscriptionList = async () => {
    try {
      const list = await subscriptionApi.list({
        params: { offset: 0, limit: 1000 },
      });
      const options: Record<number, string> = {};
      list.forEach((item: any) => {
        options[item.group_id] = item.group_name;
      });
      subscriptionListOptionsRef.current = options;
    } catch (error) {
      console.error("Load subscription list error:", error);
    }
  };

  // Load internal group list
  const loadInternalGroupList = async () => {
    try {
      const list = await groupApi.list({
        params: { group_type: GROUP_TYPE.INTERNAL_USER },
      });
      const options: Record<number, string> = {};
      list.forEach((item: any) => {
        options[item.group_id] = item.group_name;
      });
      internalGroupOptionsRef.current = options;
    } catch (error) {
      console.error("Load internal group list error:", error);
    }
  };

  // Table columns
  const columns: ColumnsType<PromptItem> = useMemo(
    () => [
      {
        title: t("title"),
        dataIndex: "name",
        key: "name",
        width: 140,
        ellipsis: true,
      },
      {
        title: t("description"),
        dataIndex: "description",
        key: "description",
        width: 250,
        ellipsis: true,
        render: (desc: string) => (
          <span className={!desc ? "text-[#999]" : ""}>{desc || "--"}</span>
        ),
      },
      {
        title: t("group"),
        dataIndex: "group_names",
        key: "group_names",
        width: 180,
        ellipsis: true,
        render: (names: string[]) => (
          <span className={!names?.length ? "text-[#999]" : ""}>
            {names?.join("、") || "--"}
          </span>
        ),
      },
      {
        title: t("usage_range"),
        key: "usage_range",
        width: 180,
        ellipsis: true,
        render: (_, record) => (
          <div>
            <div
              className={`whitespace-nowrap truncate ${!record.user_group_names?.length ? "text-[#999]" : ""}`}
            >
              <span className="text-[#999]">{t("register_user.title")}：</span>
              {record.user_group_names?.join("、") || "--"}
            </div>
            <div
              className={`whitespace-nowrap truncate ${!record.internal_members?.length ? "text-[#999]" : ""}`}
            >
              <span className="text-[#999]">{t("internal_user.title")}：</span>
              {record.internal_members?.join("、") || "--"}
            </div>
          </div>
        ),
      },
      {
        title: t("action_enable"),
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (status: number, record) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={status === 1}
              onChange={(checked) => handleStatusChange(record, checked)}
            />
          </div>
        ),
      },
      {
        title: t("operation"),
        key: "operation",
        width: 120,
        align: "right",
        fixed: "end",
        render: (_, record) => (
          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100">
            <Button
              type="link"
              icon={<SvgIcon name="edit" />}
              className="hover:!text-[#2563EB]"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(record);
              }}
            />
            <Button
              type="link"
              danger
              icon={<SvgIcon name="delete" />}
              className="hover:!text-[#FA5151]"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(record);
              }}
            />
          </div>
        ),
      },
    ],
    [t],
  );

  // Load data
  const loadData = useCallback(async () => {
    // 防止重复请求
    if (loadingRef.current) return;

    setLoading(true);

    loadingRef.current = true;

    try {
      const { group_id, keyword, page, pageSize } = filterFormRef.current;
      const res = await promptApi.list({
        params: {
          group_id: group_id.join(","),
          keyword,
          offset: (page - 1) * pageSize,
          limit: pageSize,
        },
      });

      const groupOptsList = groupTabsRef.current?.getOptions() || [];
      const groupOpts: Record<number, string> = {};
      groupOptsList.forEach((item: Group) => {
        groupOpts[item.group_id] = item.group_name;
      });
      const internalOpts = internalGroupOptionsRef.current;
      const subscriptionOpts = subscriptionListOptionsRef.current;

      const list = (res.list || []).map((item: any) => {
        item.group_ids = item.group_ids || [];
        item.group_names = [];
        item.internal_members = [];
        item.user_group_names = [];
        item.group_ids.forEach((id: number) => {
          if (groupOpts[id]) {
            item.group_names.push(groupOpts[id]);
          }
          if (internalOpts[id]) {
            item.internal_members.push(internalOpts[id]);
          }
          if (subscriptionOpts[id]) {
            item.user_group_names.push(subscriptionOpts[id]);
          }
        });
        return item;
      });

      setTableData(list);
      setTableTotal(res.total || 0);
    } catch (error) {
      console.error("Load prompt list error:", error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Refresh
  const refresh = async () => {
    setFilterForm((prev) => {
      const newForm = { ...prev, page: 1 };
      filterFormRef.current = newForm;
      return newForm;
    });
    await loadSubscriptionList();
    return loadData();
  };

  // Handle status change
  const handleStatusChange = async (item: PromptItem, checked: boolean) => {
    try {
      await promptApi.update_status({
        prompt_id: item.prompt_id,
        status: checked ? 1 : 0,
      });
      message.success(t("action_save_success"));
      loadData();
    } catch (error) {
      console.error("Update status error:", error);
    }
  };

  // Handle add
  const handleAdd = () => {
    navigate("/prompt/create");
  };

  // Handle edit
  const handleEdit = (item: PromptItem) => {
    navigate(`/prompt/create?prompt_id=${item.prompt_id}`);
  };

  // Handle delete
  const handleDelete = async (item: PromptItem) => {
    Modal.confirm({
      title: t("tip"),
      content: t("prompt.delete_confirm"),
      onOk: async () => {
        try {
          await promptApi.delete({ prompt_id: item.prompt_id });
          message.success(t("action_delete_success"));
          loadData();
        } catch (error) {
          console.error("Delete prompt error:", error);
        }
      },
    });
  };

  // Handle row click
  const onRowClick = (record: PromptItem) => {
    handleEdit(record);
  };

  useEffect(() => {
    loadInternalGroupList();
    loadSubscriptionList();
    eventBus.on("user-login-success", refresh);
    eventBus.on("prompt-create", refresh);
    eventBus.on("prompt-update", loadData);

    return () => {
      eventBus.off("user-login-success", refresh);
      eventBus.off("prompt-create", refresh);
      eventBus.off("prompt-update", loadData);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle filter change - manually trigger loadData
  const handleFilterChange = (updates: Partial<FilterForm>) => {
    setFilterForm((prev) => {
      const newForm = { ...prev, ...updates, page: updates.page ?? 1 };
      filterFormRef.current = newForm;
      return newForm;
    });
    // Use setTimeout to ensure state is updated before loadData
    setTimeout(() => loadData(), 0);
  };

  // Handle pagination
  const handleTableChange = (pagination: any) => {
    setFilterForm((prev) => {
      const newForm = {
        ...prev,
        page: pagination.current,
        pageSize: pagination.pageSize,
      };
      filterFormRef.current = newForm;
      return newForm;
    });
    setTimeout(() => loadData(), 0);
  };

  // Filter bar
  const filterBar = (
    <>
      <div className="flex-1 w-0">
        <GroupTabs
          ref={groupTabsRef}
          className="w-[200px]"
          type="dropdown"
          groupType={GROUP_TYPE.PROMPT}
          value={filterForm.group_id}
          onChange={(ids: string | number | string[]) =>
            handleFilterChange({ group_id: ids as number[] })
          }
          onOptionsChange={() => loadData()}
        />
      </div>
      <div className="flex-none flex items-center gap-3 ml-8">
        <Input
          value={filterForm.keyword}
          onChange={(e) => {
            // Update state immediately for display
            setFilterForm((prev) => {
              const newForm = { ...prev, keyword: e.target.value };
              filterFormRef.current = newForm;
              return newForm;
            });
          }}
          onPressEnter={() => {
            setFilterForm((prev) => {
              const newForm = { ...prev, page: 1 };
              filterFormRef.current = newForm;
              return newForm;
            });
            setTimeout(() => loadData(), 0);
          }}
          onBlur={() => {
            setFilterForm((prev) => {
              const newForm = { ...prev, page: 1 };
              filterFormRef.current = newForm;
              return newForm;
            });
            setTimeout(() => loadData(), 0);
          }}
          placeholder={t("prompt.search_placeholder")}
          prefix={<SearchOutlined />}
          allowClear
          style={{ width: 268 }}
        />
        <Button type="primary" onClick={handleAdd}>
          {t("action_add")}
        </Button>
      </div>
    </>
  );

  return (
    <PageLayoutContent header={t("module.prompt")} filterBar={filterBar}>
      <Table
        rowKey="prompt_id"
        columns={columns}
        dataSource={tableData}
        loading={loading}
        pagination={{
          current: filterForm.page,
          pageSize: filterForm.pageSize,
          total: tableTotal,
          showSizeChanger: true,
          showTotal: (total) => t("table_footer_text", { total }),
        }}
        onChange={handleTableChange}
        onRow={(record) => ({
          onClick: () => onRowClick(record),
          className: "cursor-pointer group",
        })}
      />
    </PageLayoutContent>
  );
}

export default PromptPage;
