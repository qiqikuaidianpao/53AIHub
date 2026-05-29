import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Tag,
  Button,
  Select,
  Input,
  DatePicker,
  Space,
  Modal,
  message,
  Tooltip,
} from "antd";
import {
  SearchOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useUserStore } from "@/stores/modules/user";
import { useIsSoftStyle } from "@/stores/modules/enterprise";
import { subscriptionApi } from "@/api/modules/subscription";
import { ordersApi } from "@/api/modules/order";
import Header from "@/components/Layout/Header";
import { t } from "@/locales";
import "./order.css";

const ORDER_STATUS = {
  ALL: -1,
  NOT_CONFIRM: 1,
  PENDING: 2,
  PAID: 3,
  EXPIRED: 4,
  CANCEL: 5,
};

const PAY_TYPE = {
  ALL: -1,
  WECHAT: 1,
  ALIPAY: 4,
  MANUAL: 2,
};

const getStatusType = (
  status: number,
): "default" | "info" | "success" | "warning" | "error" | "processing" => {
  switch (status) {
    case ORDER_STATUS.CANCEL:
      return "default";
    case ORDER_STATUS.NOT_CONFIRM:
      return "error";
    case ORDER_STATUS.PENDING:
      return "processing";
    case ORDER_STATUS.EXPIRED:
      return "warning";
    case ORDER_STATUS.PAID:
      return "success";
    default:
      return "default";
  }
};

const getTimeUnitLabel = (timeUnit: string): string => {
  return t(`subscription.${timeUnit}`);
};

interface OrderItem {
  order_id: string;
  subscription_name: string;
  duration: number;
  time_unit: string;
  status: number;
  amount: number;
  currency: string;
  pay_type: number;
  created_time: string;
  service_id: string | number;
}

export function OrderView() {
  const navigate = useNavigate();
  const userStore = useUserStore();
  const isSoftStyle = useIsSoftStyle();

  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<OrderItem[]>([]);
  const [tableTotal, setTableTotal] = useState(0);

  const [searchParams, setSearchParams] = useState({
    offset: 0,
    limit: 10,
    status: -1,
    pay_type: -1,
    keyword: "",
    date: null as [number, number] | null,
    subscription: 0,
  });

  const ORDER_STATUS_LABEL_MAP: Record<number, string> = useMemo(
    () => ({
      [ORDER_STATUS.ALL]: t("order.status_list.all"),
      [ORDER_STATUS.NOT_CONFIRM]: t("order.status_list.not_confirm"),
      [ORDER_STATUS.PENDING]: t("order.status_list.pending"),
      [ORDER_STATUS.PAID]: t("order.status_list.paid"),
      [ORDER_STATUS.EXPIRED]: t("order.status_list.expired"),
      [ORDER_STATUS.CANCEL]: t("order.status_list.cancel"),
    }),
    [],
  );

  const subscriptionList = useMemo(() => {
    return [
      { label: t("common.all"), value: 0 },
      ...userStore.subscriptions.map((item) => ({
        label: item.group_name,
        value: item.group_id,
      })),
    ];
  }, [userStore.subscriptions]);

  const payTypeList = useMemo(
    () => [
      { label: t("common.all"), value: PAY_TYPE.ALL },
      { label: t("subscription.wechat_pay"), value: PAY_TYPE.WECHAT },
      { label: t("subscription.alipay"), value: PAY_TYPE.ALIPAY },
      { label: t("subscription.manual_pay"), value: PAY_TYPE.MANUAL },
    ],
    [],
  );

  const getPayTypeLabel = useCallback(
    (pay_type: number) => {
      return payTypeList.find((item) => item.value === pay_type)?.label || "";
    },
    [payTypeList],
  );

  const columns: ColumnsType<OrderItem> = useMemo(
    () => [
      {
        title: t("order.id"),
        dataIndex: "order_id",
        width: 160,
        ellipsis: true,
      },
      {
        title: t("order.subscription"),
        dataIndex: "subscription_name",
        width: 140,
        render: (text, record) => (
          <span className={!text ? "text-[#9B9B9B]" : ""}>
            {text}*{record.duration}
            {getTimeUnitLabel(record.time_unit)}
          </span>
        ),
      },
      {
        title: t("order.status"),
        dataIndex: "status",
        width: 120,
        render: (status) => (
          <Tag className="!border-none" color={getStatusType(status)}>
            {ORDER_STATUS_LABEL_MAP[status]}
          </Tag>
        ),
      },
      {
        title: t("order.amount"),
        dataIndex: "amount",
        width: 140,
        render: (amount, record) => (
          <span className={!amount ? "text-[#9B9B9B]" : ""}>
            {record.currency || "CNY"}&nbsp;{((amount || 0) / 100).toFixed(2)}
          </span>
        ),
      },
      {
        title: t("order.pay_type"),
        dataIndex: "pay_type",
        width: 120,
        render: (pay_type) => getPayTypeLabel(pay_type),
      },
      {
        title: t("order.create_time"),
        dataIndex: "created_time",
        width: 160,
        render: (time) => (
          <span className={!time ? "text-[#9B9B9B]" : ""}>
            {time?.slice(0, 16) || "--"}
          </span>
        ),
      },
      {
        title: t("order.action"),
        width: 170,
        fixed: "right",
        render: (_, record) => {
          if (
            record.pay_type === PAY_TYPE.ALIPAY &&
            record.status === ORDER_STATUS.PENDING
          ) {
            return (
              <Space className="action-buttons">
                <Tooltip title={t("order.payment")} placement="top">
                  <Button
                    type="link"
                    className="!text-[#5A6D9E] !bg-transparent hover:!text-[#2563EB]"
                    icon={<CheckCircleOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAlipay(record);
                    }}
                  />
                </Tooltip>
                <Tooltip title={t("order.cancel")} placement="top">
                  <Button
                    type="link"
                    className="!text-[#5A6D9E] !bg-transparent hover:!text-[#FA5151]"
                    icon={<CloseCircleOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancel(record);
                    }}
                  />
                </Tooltip>
              </Space>
            );
          }
          return <span className="text-[#9B9B9B]">--</span>;
        },
      },
    ],
    [ORDER_STATUS_LABEL_MAP, getPayTypeLabel],
  );

  const loadList = async () => {
    setLoading(true);
    try {
      const res = await ordersApi.list({
        ...searchParams,
        start_time: searchParams.date?.[0],
        end_time: searchParams.date?.[1],
      });
      const orders = (res as any).data?.orders || (res as any).orders || [];
      const total = (res as any).data?.total || (res as any).total || 0;
      setTableData(
        orders.map((item: any) => ({
          ...item,
          created_time: item.created_time || "",
        })),
      );
      setTableTotal(total);
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchParams((prev) => ({ ...prev, offset: 0 }));
    setTimeout(loadList, 0);
  };

  const handleAlipay = async (record: OrderItem) => {
    Modal.confirm({
      title: t("order.payment_confirm"),
      onOk: async () => {
        try {
          await subscriptionApi.createOrder({
            params: {
              user_id: userStore.info.user_id,
              nickname: userStore.info.nickname,
              subscription_id: Number(record.service_id) || 0,
              subscription_name: record.subscription_name,
              pay_type: record.pay_type as any,
              amount: Number(record.amount || 0),
              currency: (record.currency || "CNY") as any,
              duration: 1,
              time_unit: record.time_unit as any,
              return_url: window.location.href,
            },
          });
        } catch (error) {
          console.error("Failed to pay:", error);
        }
      },
    });
  };

  const handleCancel = async (record: OrderItem) => {
    Modal.confirm({
      title: t("order.cancel_confirm"),
      onOk: async () => {
        try {
          await ordersApi.close(record.order_id);
          message.success(t("status.approve_cancel"));
          loadList();
        } catch (error) {
          console.error("Failed to cancel order:", error);
        }
      },
    });
  };

  const handleRowClick = (record: OrderItem) => {
    if (
      record.pay_type === PAY_TYPE.ALIPAY &&
      record.status === ORDER_STATUS.PENDING
    ) {
      handleAlipay(record);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  return (
    <div
      className={`h-full bg-white z-10 overflow-y-auto ${
        isSoftStyle ? "absolute inset-0" : "fixed inset-0"
      }`}
    >
      <Header
        sticky
        title={t("profile.order_info")}
        after={
          <CloseOutlined
            className="text-primary cursor-pointer"
            style={{ fontSize: 18 }}
            onClick={() => navigate(-1)}
          />
        }
      />

      <div className="px-10 py-8">
        <div className="flex items-center gap-4 flex-wrap">
          <DatePicker.RangePicker
            className="max-w-[300px]"
            onChange={(dates) => {
              setSearchParams((prev) => ({
                ...prev,
                date: dates ? [dates[0]!.valueOf(), dates[1]!.valueOf()] : null,
              }));
              setTimeout(loadList, 0);
            }}
          />
          <Select
            className="w-[200px]"
            options={subscriptionList}
            value={searchParams.subscription}
            onChange={(value) => {
              setSearchParams((prev) => ({ ...prev, subscription: value }));
              setTimeout(loadList, 0);
            }}
            prefix={
              <span className="text-sm text-gray-500">
                {t("order.subscription")}：
              </span>
            }
          />
          <Select
            className="w-[180px]"
            options={payTypeList}
            value={searchParams.pay_type}
            onChange={(value) => {
              setSearchParams((prev) => ({ ...prev, pay_type: value }));
              setTimeout(loadList, 0);
            }}
            prefix={
              <span className="text-sm text-gray-500">
                {t("order.pay_type")}：
              </span>
            }
          />
          <Input
            className="w-[160px]"
            placeholder={t("order.search_placeholder")}
            prefix={<SearchOutlined />}
            value={searchParams.keyword}
            onChange={(e) =>
              setSearchParams((prev) => ({ ...prev, keyword: e.target.value }))
            }
            onPressEnter={handleSearch}
            allowClear
          />
        </div>

        <Table
          className="mt-4 order-table"
          columns={columns}
          dataSource={tableData}
          rowKey="order_id"
          loading={loading}
          pagination={{
            total: tableTotal,
            pageSize: searchParams.limit,
            current: Math.floor(searchParams.offset / searchParams.limit) + 1,
            showSizeChanger: true,
            onChange: (page, pageSize) => {
              setSearchParams((prev) => ({
                ...prev,
                offset: (page - 1) * pageSize,
                limit: pageSize,
              }));
              setTimeout(loadList, 0);
            },
          }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            className: "group cursor-pointer",
          })}
        />
      </div>
    </div>
  );
}

export default OrderView;
