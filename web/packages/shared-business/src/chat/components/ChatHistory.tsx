import {
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Drawer, Button, Modal, Input } from "antd";
import { Dropdown } from "@km/shared-components-react";
import { SvgIcon } from "@km/shared-components-react";
import type { ConversationInfo } from "../types";
import { useConversationStore } from "../stores/conversation";
import { useTranslation } from "../i18n";

export interface ChatHistoryRef {
  open: () => void;
}

export interface ChatHistoryProps {
  onNew?: () => void;
}

const ChatHistory = forwardRef<ChatHistoryRef, ChatHistoryProps>(
  ({ onNew }, ref) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [editVisible, setEditVisible] = useState(false);
    const [convForm, setConvForm] = useState({
      conversation_id: 0 as string | number,
      title: "",
    });

    const setCurrentState = useConversationStore((state) => state.setCurrentState);
    const delConversationStore = useConversationStore((state) => state.delConversation);
    const editConversationStore = useConversationStore((state) => state.editConversation);
    const conversations = useConversationStore((state) => state.conversations);
    const currentConversationId = useConversationStore(
      (state) => state.current_conversationid
    );

    useImperativeHandle(ref, () => ({
      open: () => setVisible(true),
    }));

    const handleCreate = useCallback(() => {
      onNew?.();
      setVisible(false);
    }, [onNew]);

    const handleEditConv = useCallback(async () => {
      if (!convForm.title.trim()) return;
      await editConversationStore({
        conversation_id: convForm.conversation_id,
        title: convForm.title,
      });
      setEditVisible(false);
    }, [convForm, editConversationStore]);

    const delConversation = useCallback(async (conv: ConversationInfo) => {
      Modal.confirm({
        title: t("chat.conversation_confirm_delete"),
        content: t("action.del"),
        okText: t("action.del"),
        cancelText: t("action.cancel"),
        okButtonProps: { danger: true },
        onOk: () => delConversationStore(conv),
      });
    }, [delConversationStore, t]);

    const handleCommandConv = useCallback((event: string, conv: ConversationInfo) => {
      if (event === "del") {
        delConversation(conv);
      } else if (event === "edit") {
        setConvForm({
          conversation_id: conv.conversation_id,
          title: conv.title || "",
        });
        setEditVisible(true);
      }
    }, [delConversation]);

    const handleSelect = useCallback((conv: ConversationInfo) => {
      setCurrentState(conv.agent_id || 0, conv.conversation_id);
      setVisible(false);
    }, [setCurrentState]);

    const menuItems = useCallback((item: ConversationInfo) => [
      {
        key: "edit",
        icon: <SvgIcon name="edit" className="mr-1" />,
        label: t("action.rename"),
      },
      {
        key: "del",
        danger: true,
        icon: <SvgIcon name="del" className="mr-1" />,
        label: t("action.del"),
      },
    ], [t]);

    const currentId = String(currentConversationId);

    return (
      <>
        <Drawer
          open={visible}
          onClose={() => setVisible(false)}
          title={t("chat.history_conversation")}
          styles={{ wrapper: { width: 300 } }}
        >
          <Button
            className="w-full border-none -mt-4"
            color="primary"
            variant="filled"
            size="large"
            onClick={handleCreate}
          >
            + {t("chat.new_conversation")}
          </Button>
          <div className="flex flex-col gap-2 mt-4">
            {conversations.map((item, index) => (
              <div
                key={item.conversation_id || `conv-${index}`}
                className={`group p-3 rounded cursor-pointer hover:bg-[#F5F6FA] ${
                  String(item.conversation_id) === currentId
                    ? "bg-[#F5F6FA]"
                    : ""
                }`}
                onClick={() => handleSelect(item)}
              >
                <div className="flex items-center gap-2">
                  <div className="flex-1 text-sm text-[#1F2123] truncate">
                    {item.title || t("chat.no_title")}
                  </div>
                  <Dropdown
                    menu={{
                      items: menuItems(item),
                      onClick: ({ key }) => handleCommandConv(key, item),
                    }}
                    trigger={["click"]}
                  >
                    <div
                      className="size-7 flex items-center justify-center cursor-pointer invisible group-hover:visible"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SvgIcon name="more-h" />
                    </div>
                  </Dropdown>
                </div>
                <div className="mt-2 text-xs text-[#909193]">
                  {item.created_at || ""}
                </div>
              </div>
            ))}
          </div>
        </Drawer>

        <Modal
          open={editVisible}
          onCancel={() => setEditVisible(false)}
          title={t("chat.edit_conversation")}
          onOk={handleEditConv}
          okButtonProps={{ disabled: !convForm.title.trim() }}
          width={480}
        >
          <Input
            size="large"
            value={convForm.title}
            onChange={(e) =>
              setConvForm({
                ...convForm,
                title: e.target.value,
              })
            }
            placeholder={t("chat.conversation_title_placeholder")}
            maxLength={20}
            showCount
          />
        </Modal>
      </>
    );
  },
);

ChatHistory.displayName = "ChatHistory";

export default ChatHistory;
