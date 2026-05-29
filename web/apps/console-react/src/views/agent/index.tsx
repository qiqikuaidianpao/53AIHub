import {
  Table,
  Button,
  Input,
  Select,
  Switch,
  Modal,
  message, Divider,
  Drawer
} from "antd";
import {
  SearchOutlined
} from "@ant-design/icons";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { t } from "@/locales";
import { useNavigate } from "react-router-dom";
import { agentApi, AgentData } from "@/api/modules/agent";
import { providerApi } from "@/api/modules/provider";
import { subscriptionApi } from "@/api/modules/subscription";
import { groupApi, Group } from "@/api/modules/group";
import { channelApi } from "@/api/modules/channel";
import {
  channels,
  getProvidersByAuth,
  getProviderByAgentId,
  getAgentByAgentType,
  AgentType,
} from "@/constants/platform/config";
import { AGENT_APP_OPTIONS } from "@/constants/platform/agent";
import { VERSION_MODULE } from "@/constants/enterprise";
import { GROUP_TYPE } from "@/constants/group";
import { PageLayoutContent } from "@/components/PageLayout";
import { GroupDialog } from "@/components/GroupDialog";
import { useVersion } from "@/hooks";
import { eventBus } from "@km/shared-utils";
import {
  useAgentFormStore,
  CreateAgentDialog,
  AGENT_TYPE_OPTIONS,
  createPlatformsByType,
  getInitialFormData,
} from "@km/shared-business/agent-create";
import type { AgentPlatformOption, CreateAgentDialogResult } from "@km/shared-business/agent-create";
import { consoleAgentAdapter } from "@/adapters/agent-create-adapter";
import { SvgIcon } from "@km/shared-components-react";
import { img_host } from "@/utils/config";

// 获取默认的注册用户和内部用户分组 ID
const getDefaultGroupIds = async () => {
  const subscriptionRes = await subscriptionApi.list({ params: { offset: 0, limit: 1000 } });
  const subscriptionGroupIds = subscriptionRes.map((item: SubscriptionItem) => item.group_id);

  const internalGroupRes = await groupApi.list({ params: { group_type: GROUP_TYPE.INTERNAL_USER } });
  const internalGroupIds = internalGroupRes.map((item: Group) => item.group_id);

  return { subscriptionGroupIds, internalGroupIds };
}

interface SubscriptionItem {
  group_id: number;
  group_name: string;
}

type GroupList = Group[];

interface ProviderItem {
  provider_type: string;
  is_auth: boolean;
  [key: string]: any;
}

interface FilterForm {
  group: string;
  platform: string;
  type: string;
  keyword: string;
  page: number;
  page_size: number;
}

interface AgentState extends AgentData {
  user_group_names: string[];
  internal_members: string[];
}

export function AgentPage() {
  const navigate = useNavigate();
  const dialogRef = useRef<any>(null);
  const uploadImageRef = useRef<{ trigger: () => void }>(null);

  const [filterForm, setFilterForm] = useState<FilterForm>({
    group: "",
    platform: "",
    type: "",
    keyword: "",
    page: 1,
    page_size: 10,
  });
  const filterFormRef = useRef(filterForm);
  const [allTotal, setAllTotal] = useState(0);
  const [tableData, setTableData] = useState<AgentState[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [legacyAddVisible, setLegacyAddVisible] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(undefined);
  const [groupSelectOpen, setGroupSelectOpen] = useState(false);
  const [subscriptionList, setSubscriptionList] = useState<SubscriptionItem[]>(
    [],
  );
  const [groupList, setGroupList] = useState<Group[]>([]);
  const [internalGroupOptions, setInternalGroupOptions] = useState<
    Record<number, string>
  >({});
  const [authProviders, setAuthProviders] = useState<ProviderItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  // 从适配器获取图片上传组件
  const ImageUploadComponent = consoleAgentAdapter.ImageUploadComponent;

  const { guard: guardAgentVersion } = useVersion({
    module: VERSION_MODULE.AGENT,
    count: allTotal,
    content: t("version.agent_limit"),
  });

  // 使用 ref 来追踪是否已加载，避免闭包问题
  const subscriptionLoadedRef = useRef(false);
  const groupLoadedRef = useRef(false);
  const internalGroupLoadedRef = useRef(false);
  const providerLoadedRef = useRef(false);

  // 使用 ref 存储最新数据，供 loadListData 使用
  const subscriptionListRef = useRef<SubscriptionItem[]>([]);
  const internalGroupOptionsRef = useRef<Record<number, string>>({});
  const authProvidersRef = useRef<ProviderItem[]>([]);

  // 更新 filterFormRef
  useEffect(() => {
    filterFormRef.current = filterForm;
  }, [filterForm]);

  // 更新 authProvidersRef
  useEffect(() => {
    authProvidersRef.current = authProviders;
  }, [authProviders]);

  const openDialog = () => {
    setGroupSelectOpen(false);
    setTimeout(() => {
      dialogRef.current?.open();
    }, 100);
  };

  // 类型选项使用公共配置
  const types = AGENT_TYPE_OPTIONS;

  // 使用公共配置，并根据权限过滤
  const platformsByType = useMemo<Record<string, AgentPlatformOption[]>>(() => {
    // 构建权限映射
    const authMap = new Map(
      authProviders.map((provider) => [
        provider.provider_type,
        provider.is_auth,
      ]),
    );

    // 权限过滤函数
    const filterByAuth = (platforms: AgentPlatformOption[]): AgentPlatformOption[] => {
      return platforms.filter((platform) => {
        const provider = getProviderByAgentId(platform.value as AgentType);
        // 如果不需要授权，或者已授权，则显示
        if (!provider?.auth) return true;
        return authMap.get(provider.id) === true;
      });
    };

    // 获取公共配置的平台列表
    const basePlatforms = createPlatformsByType(img_host);
    return filterByAuth(basePlatforms);
  }, [authProviders]);

  // 旧添加 Drawer 的过滤逻辑（按 category 分组）
  const filteredAgentOptions = useMemo(() => {
    const authMap = new Map(
      authProviders.map((provider) => [
        provider.provider_type,
        provider.is_auth,
      ]),
    );
    return AGENT_APP_OPTIONS.map((item) => {
      const filteredChildren = item.children.filter((row) => {
        const provider = getProviderByAgentId(row.value as AgentType);
        if (!provider?.auth) {
          return true;
        }
        return authMap.get(provider.id) === true;
      });

      return {
        ...item,
        filteredChildren,
      };
    }).filter((item) => {
      return item.filteredChildren.length > 0;
    });
  }, [authProviders]);

  // 旧添加 Drawer 的处理函数
  const handleAgentPrepare = async (data: {
    value: string;
    channel_type: number;
    label: string;
  }) => {
    await checkAuth(data.value as AgentType);
    navigate({
      pathname: "/agent/create",
      search: `?type=${data.value}&group_id=${+filterForm.group > 0 ? filterForm.group : ""}&is_new=true&channel_type=${data.channel_type}&title=${data.label}`,
    } as any);
    setLegacyAddVisible(false);
  };

  const loadSubscriptionList = async () => {
    if (subscriptionLoadedRef.current) return;
    subscriptionLoadedRef.current = true;
    const list = await subscriptionApi.list({
      params: { offset: 0, limit: 1000 },
    });
    subscriptionListRef.current = list;
    setSubscriptionList(list);
  };

  const loadGroupList = async () => {
    if (groupLoadedRef.current) return;
    groupLoadedRef.current = true;
    const list = await groupApi.list({
      params: { group_type: GROUP_TYPE.AGENT },
    });
    setGroupList(list);
  };

  const loadInternalGroupList = async () => {
    if (internalGroupLoadedRef.current) return;
    internalGroupLoadedRef.current = true;
    const list = await groupApi.list({
      params: { group_type: GROUP_TYPE.INTERNAL_USER },
    });
    const options: Record<number, string> = {};
    list.forEach((item: Group) => {
      options[item.group_id] = item.group_name;
    });
    internalGroupOptionsRef.current = options;
    setInternalGroupOptions(options);
  };

  const loadAllTotal = async () => {
    const { count = 0 } = await agentApi.list({
      params: {
        group_id: "-1",
        keyword: "",
        offset: 0,
        limit: 1,
      },
    });
    setAllTotal(count);
  };

  const loadListData = async () => {
    setTableLoading(true);
    await loadSubscriptionList();
    await loadGroupList();

    try {
      const currentFilter = filterFormRef.current;
      const { count = 0, agents = [] } = await agentApi.list({
        params: {
          group_id: currentFilter.group,
          channel_types: currentFilter.platform,
          agent_types: currentFilter.type,
          keyword: currentFilter.keyword,
          offset: (currentFilter.page - 1) * currentFilter.page_size,
          limit: currentFilter.page_size,
        },
      });

      setTableTotal(count);

      // 使用 ref 中的最新数据，而不是 state
      const currentSubscriptionList = subscriptionListRef.current;
      const currentInternalGroupOptions = internalGroupOptionsRef.current;

      const formattedAgents = agents.map((item: Partial<AgentState> = {}) => {
        const agent = item as AgentState;
        agent.user_group_ids = agent.user_group_ids || [];
        agent.user_group_names = [];
        agent.internal_members = [];
        agent.user_group_ids.forEach((value) => {
          const subscription = currentSubscriptionList.find(
            (row) => row.group_id === value,
          );
          if (subscription?.group_name)
            agent.user_group_names.push(subscription.group_name);
          if (currentInternalGroupOptions[value]) {
            agent.internal_members.push(currentInternalGroupOptions[value]);
          }
        });
        return agent;
      });

      setTableData(formattedAgents);
      setInitialized(true);
    } finally {
      setTableLoading(false);
    }

    loadAllTotal();
  };

  const refresh = useCallback(async () => {
    // 重置页码并刷新数据
    filterFormRef.current = { ...filterFormRef.current, page: 1 };
    setFilterForm((prev) => ({ ...prev, page: 1 }));
    await loadListData();
  }, []);

  // 带参数变更的刷新，避免多次 setFilterForm
  const refreshWithFilter = useCallback(
    async (key: keyof FilterForm, value: string) => {
      filterFormRef.current = {
        ...filterFormRef.current,
        [key]: value,
        page: 1,
      };
      setFilterForm((prev) => ({ ...prev, [key]: value, page: 1 }));
      await loadListData();
    },
    [],
  );

  const handleGroupChange = (result: { value: Group[] }) => {
    setGroupList(result.value);
    filterFormRef.current = { ...filterFormRef.current, group: "", page: 1 };
    setFilterForm((prev) => ({ ...prev, group: "", page: 1 }));
    loadListData();
  };

  const onTableSizeChange = (size: number) => {
    filterFormRef.current = { ...filterFormRef.current, page: 1, page_size: size };
    setFilterForm((prev) => ({ ...prev, page: 1, page_size: size }));
    loadListData();
  };

  const onTableCurrentChange = (current: number) => {
    filterFormRef.current = { ...filterFormRef.current, page: current };
    setFilterForm((prev) => ({ ...prev, page: current }));
    loadListData();
  };

  const onRowClick = (row: AgentState) => {
    onAgentAdd(row.agent_type, row);
  };

  const onAgentDelete = async (row: AgentState) => {
    Modal.confirm({
      title: t("action_delete"),
      content: t("agent_delete_confirm"),
      okText: t("action_confirm"),
      cancelText: t("action_cancel"),
      onOk: async () => {
        await agentApi.delete({ data: { agent_id: row.agent_id } });
        message.success(t("action_delete_success"));
        loadListData();
      },
    });
  };

  const loadProviderList = async () => {
    if (providerLoadedRef.current) return;
    providerLoadedRef.current = true;
    const list = (await providerApi.list()) as ProviderItem[];

    const providers = getProvidersByAuth(true).map((item) => {
      const provider_type = item.id;
      return {
        ...item,
        provider_type,
        is_auth: !!list.find((row) => row.provider_type === provider_type),
      };
    });
    setAuthProviders(providers);
  };

  const checkAuth = (value: AgentType): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const provider = getProviderByAgentId(value);
      const auth_provider = authProvidersRef.current.find(
        (row) => row.provider_type === provider?.id,
      );

      if (auth_provider && !auth_provider?.is_auth) {
        reject(new Error("Authentication required"));
        Modal.confirm({
          title: t("tip"),
          content: t("auth_required", {
            provider_name: t(provider?.label || ""),
          }),
          okText: t("action_go"),
          cancelText: t("action_cancel"),
          onOk: () => {
            navigate("/platform");
          },
        });
        return;
      }

      resolve();
    });
  };

  // 处理创建弹窗确认
  const handleCreateConfirm = async (data: CreateAgentDialogResult) => {
    await checkAuth(data.agentType as AgentType);

    // Openclaw 类型：在弹框确定时调用 API 创建
    if (data.agentType === 'openclaw') {
      try {
        // 获取或创建 channel
        const channelList = await channelApi.listv2();
        const existingChannel = channelList.find((item: any) => item.type === 1014);
        let channelId = existingChannel?.channel_id;

        if (!channelId) {
          const res = await channelApi.create({
            type: 1014,
            name: t('agent.personal_agent_channel'),
            models: 'openclaw-ws',
          });
          channelId = res?.data?.channel_id || res?.data?.id || res?.channel_id;
        }

        const { subscriptionGroupIds, internalGroupIds } = await getDefaultGroupIds();

        // 创建智能体
        const result = await agentApi.save({
          data: {
            agent_type: 2,
            name: data.name,
            description: data.description,
            logo: data.logo,
            group_id: data.groupId || 0,
            channel_type: 1014,
            model: 'openclaw-ws',
            prompt: '',
            tools: [],
            use_cases: [],
            user_group_ids: internalGroupIds,
            subscription_group_ids: subscriptionGroupIds,
            configs: {
              completion_params: {
                temperature: 0.2,
                top_p: 0.75,
                presence_penalty: 0.5,
                frequency_penalty: 0.5,
              },
            },
            custom_config: {
              agent_type: 'openclaw',
              agent_mode: 'assistant',
              provider_id: 0,
              channel_id: channelId || 0,
              tencent_bot_id: '',
              coze_workspace_id: '',
              coze_bot_id: '',
              coze_bot_url: '',
              app_builder_bot_id: '',
              chat53ai_agent_id: '',
              channel_config: {},
            },
            settings: {
              opening_statement: '',
              suggested_questions: [],
              file_parse: { enable: false },
              image_parse: { vision: false, enable: false },
              relate_agents: [],
              input_fields: [],
              output_fields: [],
            },
            enable: true,
          }
        })

        navigate({
          pathname: '/agent/create-v2',
          search: `?type=openclaw&agent_id=${result.agent_id}&is_new=false`,
        } as any)
      } catch (error) {
        console.error('创建 Openclaw 智能体失败:', error)
      }
      return
    }

    // 其他类型：更新 store 状态，在编辑页创建
    const agentConfig = getAgentByAgentType(data.agentType as AgentType);
    const { subscriptionGroupIds, internalGroupIds } = await getDefaultGroupIds();

    useAgentFormStore.setState({
      is_new: true,
      agent_type: data.agentType,
      agent_id: 0,
      form_data: {
        ...getInitialFormData(),
        logo: data.logo,
        name: data.name,
        group_id: data.groupId || 0,
        description: data.description,
        channel_type: agentConfig?.channelType || 0,
        user_group_ids: internalGroupIds,
        subscription_group_ids: subscriptionGroupIds,
        custom_config: {
          ...getInitialFormData().custom_config,
          agent_mode: data.agent_mode,
          agent_type: data.agentType,
        },
      },
    });
    useAgentFormStore.getState().setAgentData({
      ...useAgentFormStore.getState().agent_data,
      backend_agent_type: data.backend_agent_type,
    })

    navigate({
      pathname: "/agent/create-v2",
      search: `?type=${data.agentType}&is_new=true`,
    } as any);
    setAddVisible(false);
  };

  const onAgentAdd = async (
    value: string,
    data: Partial<AgentState> = {},
    is_new = false,
  ) => {
    await checkAuth(value as AgentType);
    loadListData();

    const searchParams = data.agent_id
      ? `?type=${data.agent_type}&agent_id=${data.agent_id}&is_new=${is_new}`
      : `?type=${value}&group_id=${+filterForm.group > 0 ? filterForm.group : ""}&is_new=${is_new}`;

    navigate({
      pathname: "/agent/create-v2",
      search: searchParams,
    } as any);
  };

  const onAgentStatusChange = async (row: AgentState) => {
    await agentApi.updateStatus({
      data: { agent_id: row.agent_id, enable: row.enable },
    });
    message.success(
      t(row.enable ? "action_enable_success" : "action_disable_success"),
    );
  };

  useEffect(() => {
    const init = async () => {
      await loadInternalGroupList();
      loadListData();
    };
    init();
    loadProviderList();
    eventBus.on("user-login-success", loadListData);
    eventBus.on("agent-create", loadListData);
    eventBus.on("agent-update", loadListData);

    return () => {
      eventBus.off("user-login-success", loadListData);
      eventBus.off("agent-create", loadListData);
      eventBus.off("agent-update", loadListData);
    };
  }, []);

  const columns = [
    {
      title: t("module.agent"),
      dataIndex: "name",
      key: "name",
      width: 180,
      render: (_: any, row: AgentState) => (
        <div className="flex items-center gap-2 w-full">
          <img
            className="flex-none w-8 h-8 rounded-full overflow-hidden"
            src={row.logo || "/images/default_logo.png"}
            alt=""
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/images/default_logo.png";
            }}
          />
          <div className="flex-1 w-0 text-sm flex flex-col">
            <div className="text-[#2563EB] truncate">{row.name || "--"}</div>
            {row.description && (
              <div className="text-xs text-[#808080] truncate">
                {row.description}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: t("module.platform_v2"),
      dataIndex: "agent_type",
      key: "agent_type",
      width: 140,
      render: (_: any, row: AgentState) =>
        t(`agent_app.${row.agent_type}`) || "--",
    },
    {
      title: t("type"),
      dataIndex: "backend_agent_type",
      key: "backend_agent_type",
      width: 140,
      render: (backend_agent_type: number) => {
        if (backend_agent_type === 0) return t("agent_type_chat_v2")
        if (backend_agent_type === 1) return t("agent_type_completion_v2")
        if (backend_agent_type === 2) return t("agent_type.assistant")
        return "--"
      },
    },
    {
      title: t("usage_range"),
      dataIndex: "usage_range",
      key: "usage_range",
      width: 180,
      ellipsis: true,
      render: (_: any, row: AgentState) => (
        <div>
          <div
            className={`whitespace-nowrap truncate ${!row.user_group_names.length ? "text-[#999]" : ""}`}
          >
            <span className="text-[#999]">{t("register_user.title")}：</span>
            {row.user_group_names.join("、") || "--"}
          </div>
          <div
            className={`whitespace-nowrap truncate ${!row.internal_members.length ? "text-[#999]" : ""}`}
          >
            <span className="text-[#999]">{t("internal_user.title")}：</span>
            {row.internal_members.join("、") || "--"}
          </div>
        </div>
      ),
    },
    {
      title: t("action_enable"),
      dataIndex: "enable",
      key: "enable",
      width: 80,
      render: (_: any, row: AgentState) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={row.enable}
            onChange={(checked) => {
              row.enable = checked;
              setTableData([...tableData]);
              onAgentStatusChange(row);
            }}
          />
        </div>
      ),
    },
    {
      title: t("operation"),
      key: "operation",
      width: 120,
      align: "right" as const,
      render: (_: any, row: AgentState) => (
        <>
          <Button
            type="text"
            icon={<SvgIcon name="edit" />}
            className="invisible group-hover:visible hover:!text-[#2563EB]"
            onClick={(e) => {
              e.stopPropagation();
              onAgentAdd(row.agent_type, row);
            }}
          />
          <Button
            type="text"
            danger
            icon={<SvgIcon name="delete" />}
            className="invisible group-hover:visible hover:!text-[#FA5151]"
            onClick={(e) => {
              e.stopPropagation();
              onAgentDelete(row);
            }}
          />
        </>
      ),
    },
  ];

  const channelOptions = Object.values(channels);

  // 分组选项
  const groupOptions = useMemo(() =>
    groupList.map((item) => ({
      label: item.group_name,
      value: item.group_id,
    })),
    [groupList]
  );

  // 弹窗打开时默认选中第一个分组
  useEffect(() => {
    if (addVisible && groupOptions.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groupOptions[0].value);
    }
  }, [addVisible, groupOptions, selectedGroupId]);

  const filterBar = (
    <>
      <div className="flex flex-1 w-0 gap-2">
        <Select
          open={groupSelectOpen}
          onOpenChange={setGroupSelectOpen}
          value={filterForm.group || undefined}
          placeholder={t("all")}
          className="flex-none w-[150px]"
          onChange={(value) => refreshWithFilter("group", value || "")}
          prefix={
            <span className="text-black mr-2">
              {t("internal_user.group.title")}:
            </span>
          }
          styles={{ popup: { root: { width: "204px" } } }}
          popupRender={(menu) => (
            <>
              {menu}
              <Divider style={{ margin: "8px 0" }} />
              <div className="flex justify-between items-center mx-2 px-1 py-2 sticky bottom-0 bg-white z-10">
                <div
                  className="cursor-pointer text-[#5A6D9E] text-sm hover:opacity-80"
                  onClick={openDialog}
                >
                  {t("group_management")}
                </div>
              </div>
            </>
          )}
        >
          {filterForm.group && (
            <Select.Option value="">{t("all_group")}</Select.Option>
          )}
          {(groupList || []).map((item) => (
            <Select.Option
              key={item.group_id}
              value={String(item.group_id)}
              className="bg-[#ffffff]"
            >
              {item.group_name}
            </Select.Option>
          ))}
        </Select>

        <Select
          value={filterForm.platform || undefined}
          className="flex-none w-[160px]"
          allowClear
          placeholder={t("all")}
          onChange={(value) => refreshWithFilter("platform", value || "")}
          prefix={
            <span className="text-black mr-2">
              {t("module.platform_v2")}:
            </span>
          }
        >
          {filterForm.platform && (
            <Select.Option value="">
              {t("module.all_platform")}
            </Select.Option>
          )}
          {channelOptions.map((item) => (
            <Select.Option
              key={item.label}
              value={
                item.channelType === 0
                  ? "1,3,44,36"
                  : String(item.channelType)
              }
            >
              {item.label}
            </Select.Option>
          ))}
        </Select>

        <Select
          value={filterForm.type || undefined}
          className="flex-none w-[160px]"
          allowClear
          placeholder={t("all")}
          onChange={(value) => refreshWithFilter("type", value || "")}
          prefix={<span className="text-black mr-2">{t("type")}:</span>}
        >
          {filterForm.type && (
            <Select.Option value="">{t("all_type")}</Select.Option>
          )}
          <Select.Option value="1">
            {t("agent_type_completion_v2")}
          </Select.Option>
          <Select.Option value="0">{t("agent_type_chat_v2")}</Select.Option>
          <Select.Option value="2">{t("agent_type.assistant")}</Select.Option>
        </Select>
      </div>
      <div className="flex-none flex items-center gap-3 ml-8">
        <Input
          value={filterForm.keyword}
          onChange={(e) => {
            setFilterForm((prev) => ({ ...prev, keyword: e.target.value }));
          }}
          onBlur={() => refresh()}
          onPressEnter={() => refresh()}
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t("agent.name_v2")}
        />
        <Button
          type="primary"
          onClick={() => {
            if (guardAgentVersion()) {
              setAddVisible(true);
            }
          }}
        >
          {t("action_add")}
        </Button>
        {/* <Button
          icon={<PlusOutlined />}
          onClick={() => {
            if (guardAgentVersion()) {
              setLegacyAddVisible(true);
            }
          }}
        >
          旧添加
        </Button> */}
      </div>
    </>
  );

  return (
    <PageLayoutContent header={t("module.agent")} filterBar={filterBar}>
      <Table
        rowKey="agent_id"
        columns={columns}
        dataSource={tableData}
        loading={tableLoading}
        pagination={{
          current: filterForm.page,
          pageSize: filterForm.page_size,
          total: tableTotal,
          showSizeChanger: true,
          showTotal: (total) => t("table_footer_text", { total }),
          onChange: (page, pageSize) => {
            if (pageSize !== filterForm.page_size) {
              onTableSizeChange(pageSize);
            } else {
              onTableCurrentChange(page);
            }
          },
        }}
        onRow={(record) => ({
          onClick: () => onRowClick(record),
          className: "group cursor-pointer",
        })}
        rowClassName="group cursor-pointer"
      />

      {/* 创建智能体弹窗 */}
      <CreateAgentDialog
        visible={addVisible}
        onClose={() => {
          setAddVisible(false);
          setSelectedGroupId(undefined);
        }}
        onConfirm={handleCreateConfirm}
        types={types}
        platformsByType={platformsByType}
        groupValue={selectedGroupId}
        onGroupChange={setSelectedGroupId}
        groupOptions={groupOptions}
        t={t}
        avatarSlot={ImageUploadComponent ? ({ value, onChange }) => (
          <div className="flex flex-col items-center gap-2">
            <ImageUploadComponent
              ref={uploadImageRef}
              value={value}
              onChange={onChange}
              className="!w-[72px] !h-[72px]"
            />
            <Button
              className="w-[72px] text-xs"
              onClick={() => uploadImageRef.current?.trigger()}
            >
              {t("change_avatar")}
            </Button>
          </div>
        ) : undefined}
      />

      {/* 旧添加 Drawer */}
      <Drawer
        open={legacyAddVisible}
        title={t("action_add")}
        onClose={() => setLegacyAddVisible(false)}
        styles={{ wrapper: { width: 650 } }}
      >
        <ul className="w-full min-h-[300px] overflow-y-auto">
          {filteredAgentOptions.map((item, itemIndex) => (
            <li key={itemIndex}>
              <h4 className="text-sm text-[#939499]">{t(item.title)}</h4>
              <ul className="flex flex-col gap-3 pt-4 pb-6">
                {item.filteredChildren.map((row) => (
                  <li
                    key={row.value}
                    className="h-[72px] px-6 rounded flex items-center gap-3 bg-[#F8F9FA] cursor-pointer hover:shadow"
                  >
                    <img
                      className="flex-none size-10 rounded-lg"
                      src={row.icon}
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "/images/default_logo.png";
                      }}
                    />
                    <div className="flex-1 text-base text-[#1D1E1F] truncate">
                      {t(row.label)}
                    </div>
                    <Button
                      type="primary"
                      className="border-none"
                      onClick={() => handleAgentPrepare(row)}
                    >
                      {t("action_add")}
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Drawer>

      <GroupDialog
        ref={dialogRef}
        groupType={GROUP_TYPE.AGENT}
        options={groupList}
        onChange={handleGroupChange}
      />
    </PageLayoutContent>
  );
}

export default AgentPage;