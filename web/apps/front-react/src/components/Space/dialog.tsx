import { useState, forwardRef, useImperativeHandle } from "react";
import { Modal, Spin, Empty, Button, Popover, Table, message } from "antd";
import { DownOutlined, CloseOutlined, RightOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import { spacesApi, type SpaceItem } from "@/api/modules/spaces";
import { librariesApi, type LibraryItem } from "@/api/modules/libraries";
import { filesApi } from "@/api/modules/files";
import type { FileItem } from "@/api/modules/files/types";
import { buildFileTree, formatFile } from "@/api/modules/files/transform";
import { permissionsApi } from "@/api/modules/permissions";
import {
  RESOURCE_TYPE,
  PERMISSION_TYPE,
} from "@/components/KMPermission/constant";
import { cacheManager as cache } from "@km/shared-utils";
import { t } from "@/locales";
import { getPublicPath } from "@/utils/config";
import "./dialog.css";

export interface SpaceDialogRef {
  open: (files?: FileItem[], library?: LibraryItem) => void;
}

export interface SpaceDialogProps {
  onConfirm?: (files: FileItem[]) => void;
}

export const SpaceDialog = forwardRef<SpaceDialogRef, SpaceDialogProps>(
  ({ onConfirm }, ref) => {
    const [visible, setVisible] = useState(false);
    const [spaceList, setSpaceList] = useState<SpaceItem[]>([]);
    const [libraryList, setLibraryList] = useState<LibraryItem[]>([]);
    const [fileList, setFileList] = useState<FileItem[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
    const [popoverVisible, setPopoverVisible] = useState(false);

    const [spaceId, setSpaceId] = useState("");
    const [libraryId, setLibraryId] = useState("");
    const [spaceLoading, setSpaceLoading] = useState(false);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [fileLoading, setFileLoading] = useState(false);
    const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

    const loadSpaceList = async () => {
      setSpaceLoading(true);
      return cache
        .getOrFetch(`spaces_list`, () => {
          return spacesApi.list({
            status: 0,
            limit: 100,
            offset: 0,
            view: "user",
          });
        })
        .then(async (list: any) => {
          const privateSpaces = list.spaces.filter((item: SpaceItem) => !item.visibility);
          let permissionMap: Record<string, number> = {};
          if (privateSpaces.length > 0) {
            permissionMap = await permissionsApi.myBatch({
              resource_type: RESOURCE_TYPE.space,
              resource_ids: privateSpaces.map((item: SpaceItem) => item.id),
            });
          }
          const newList: SpaceItem[] = list.spaces.filter((item: SpaceItem) => {
            if (item.visibility) return true;
            const key = `${RESOURCE_TYPE.space}:${item.id}`;
            return permissionMap[key] >= PERMISSION_TYPE.viewer;
          });
          setSpaceList(newList);
          return newList;
        })
        .finally(() => {
          setSpaceLoading(false);
        });
    };

    const loadLibraryList = (spaceId: string) => {
      setLibraryLoading(true);
      return cache
        .getOrFetch(`libraries_list_${spaceId}`, () => {
          return librariesApi.list({
            space_id: spaceId,
            get_recently: 0,
            limit: 100,
          });
        })
        .then(async (list: any) => {
          if (list.length === 0) {
            setLibraryList([]);
            return [];
          }
          const permissionMap = await permissionsApi.myBatch({
            resource_type: RESOURCE_TYPE.library,
            resource_ids: list.map((item: LibraryItem) => item.id),
          });
          const newList: LibraryItem[] = list.filter((item: LibraryItem) => {
            const key = `${RESOURCE_TYPE.library}:${item.id}`;
            return permissionMap[key] >= PERMISSION_TYPE.viewer;
          });
          setLibraryList(newList);
          return newList;
        })
        .finally(() => {
          setLibraryLoading(false);
        });
    };

    const getAllFolderIds = (items: FileItem[]): string[] => {
      const ids: string[] = [];
      const traverse = (nodes: FileItem[]) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            ids.push(node.id);
            traverse(node.children);
          }
        }
      };
      traverse(items);
      return ids;
    };

    const loadFilesAll = async (libraryId: string) => {
      setFileLoading(true);
      cache
        .getOrFetch(`files_all_${libraryId}`, () => {
          return filesApi.all({
            library_id: libraryId,
          });
        })
        .then(async (list: any) => {
          if (list.length === 0) {
            setFileList([]);
            setExpandedRowKeys([]);
            return;
          }
          const permissionMap = await permissionsApi.myBatch({
            resource_type: RESOURCE_TYPE.file,
            resource_ids: list.map((item: any) => item.id),
          });
          const newList: FileItem[] = list
            .filter((item: any) => {
              const key = `${RESOURCE_TYPE.file}:${item.id}`;
              return permissionMap[key] >= PERMISSION_TYPE.viewer;
            })
            .map((item: any) => formatFile(item));
          const tree = buildFileTree<FileItem>(newList);
          setFileList(tree);
          setExpandedRowKeys(getAllFolderIds(tree));
        })
        .finally(() => {
          setFileLoading(false);
        });
    };

    const handleSelectLibrary = (item: LibraryItem) => {
      if (libraryId === item.id || libraryLoading) return;
      setLibraryId(item.id);
      loadFilesAll(item.id);
    };

    const handleSelectSpace = (item: SpaceItem, libraryIdParam?: string) => {
      if (spaceId === item.id || spaceLoading) return;
      setSpaceId(item.id);
      loadLibraryList(item.id).then((list) => {
        if (list && list.length > 0) {
          const library = list.find((item) => item.id === libraryIdParam);
          handleSelectLibrary(library || list[0]);
        } else {
          setLibraryId("");
          setFileList([]);
        }
      });
    };

    const isSelectedFile = (item: FileItem) => {
      return selectedFiles.some((file) => file.id === item.id);
    };

    const handleSelectFile = (item: FileItem) => {
      const hasSelected = selectedFiles.some((file) => file.id === item.id);
      if (hasSelected) {
        setSelectedFiles(selectedFiles.filter((file) => file.id !== item.id));
      } else {
        setSelectedFiles([...selectedFiles, item]);
      }
    };

    const handleRemoveFile = (item: FileItem) => {
      handleSelectFile(item);
    };

    const handleClose = () => {
      setVisible(false);
    };

    const handleConfirm = () => {
      if (selectedFiles.length === 0) {
        message.error(t("common.please_select_file"));
        return;
      }
      setVisible(false);
      onConfirm?.(selectedFiles);
    };

    useImperativeHandle(ref, () => ({
      open: (files, library) => {
        setSelectedFiles(files?.concat([]) || []);
        setVisible(true);
        setTimeout(() => {
          if (spaceId && spaceList.length > 0) return;
          loadSpaceList().then(() => {
            if (library) {
              handleSelectSpace(
                { id: library.space_id } as SpaceItem,
                library.id,
              );
            } else if (spaceList.length > 0 && !spaceId) {
              handleSelectSpace(spaceList[0]);
            }
          });
        }, 0);
      },
    }));

    const selectedFilesPopoverContent = (
      <div className="p-2">
        <div className="h-8 px-2 flex items-center gap-1 justify-between">
          <span className="text-sm">全部已选（{selectedFiles.length}）</span>
          <div
            className="size-6 flex items-center justify-center rounded cursor-pointer hover:bg-[#F2F3F5]"
            onClick={() => setPopoverVisible(false)}
          >
            <CloseOutlined />
          </div>
        </div>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {selectedFiles.map((item) => (
            <div
              key={item.id}
              className="h-8 px-2 rounded flex items-center gap-1 text-[#999999] hover:bg-[#F2F3F5] cursor-pointer group overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={item.icon} className="size-4" alt="" />
              <span className="flex-1 text-sm text-[#1D1E1F] truncate">
                {item.name}
              </span>
              <CloseOutlined
                className="group-hover:block hidden"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFile(item);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <Modal
        open={visible}
        title="选择"
        width={784}
        onCancel={handleClose}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div>
              {selectedFiles.length > 0 && (
                <Popover
                  open={popoverVisible}
                  onOpenChange={setPopoverVisible}
                  content={selectedFilesPopoverContent}
                  trigger="click"
                  placement="topLeft"
                  overlayClassName="!p-0"
                  overlayStyle={{ width: 360 }}
                >
                  <div className="h-8 px-2 rounded flex items-center gap-1 text-[#999999] hover:bg-[#F2F3F5] cursor-pointer">
                    <span className="text-sm">
                      已选{selectedFiles.length}个文件
                    </span>
                    <DownOutlined
                      className={popoverVisible ? "rotate-180" : ""}
                    />
                  </div>
                </Popover>
              )}
            </div>
            <div>
              <Button onClick={handleClose}>取消</Button>
              <Button type="primary" onClick={handleConfirm} className="ml-2">
                确定
              </Button>
            </div>
          </div>
        }
      >
        <div className="h-[514px] flex overflow-hidden border-t border-b -mx-6">
          <div className="flex-none w-[170px] py-1 border-r flex flex-col overflow-hidden">
            <div className="h-9 px-6 flex items-center text-sm text-[#999999]">
              空间
            </div>
            <div className="flex-1 px-2 space-y-1 overflow-y-auto">
              {spaceLoading ? (
                <div className="flex justify-center py-4">
                  <Spin />
                </div>
              ) : spaceList.length === 0 ? (
                <Empty
                  image={getPublicPath("/images/empty.png")}
                  description={t("common.no_data")}
                />
              ) : (
                spaceList.map((item) => (
                  <div
                    key={item.id}
                    className={`h-9 flex items-center gap-2 pl-2 mb-1 rounded cursor-pointer text-[#1D1E1F] hover:bg-[#F2F3F5] ${spaceId === item.id ? "bg-[#F2F3F5]" : ""}`}
                    onClick={() => handleSelectSpace(item)}
                  >
                    <div className="size-4 flex items-center justify-center rounded">
                      <SvgIcon name="app-one" size={18} />
                    </div>
                    <p className="flex-1 text-sm truncate">{item.name}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex-none w-[170px] py-1 border-r flex flex-col overflow-hidden">
            <div className="h-9 px-6 flex items-center text-sm text-[#999999]">
              知识库
            </div>
            <div className="flex-1 px-2 space-y-1 overflow-y-auto">
              {libraryLoading ? (
                <div className="flex justify-center py-4">
                  <Spin />
                </div>
              ) : libraryList.length === 0 ? (
                <Empty
                  image={getPublicPath("/images/empty.png")}
                  description={t("common.no_data")}
                />
              ) : (
                libraryList.map((item) => (
                  <div
                    key={item.id}
                    className={`h-9 flex items-center gap-2 pl-2 mb-1 rounded cursor-pointer text-[#1D1E1F] hover:bg-[#F2F3F5] ${libraryId === item.id ? "bg-[#F2F3F5]" : ""}`}
                    onClick={() => handleSelectLibrary(item)}
                  >
                    <div className="size-5 flex items-center justify-center rounded">
                      <img src={item.icon} className="size-5" alt="" />
                    </div>
                    <p className="flex-1 text-sm truncate">{item.name}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="h-9 px-6 flex items-center text-sm text-[#999999]">
              知识
            </div>
            {fileLoading ? (
              <div className="flex justify-center py-8">
                <Spin />
              </div>
            ) : fileList.length === 0 ? (
              <Empty
                image={getPublicPath("/images/empty.png")}
                description={t("common.no_data")}
              />
            ) : (
              <Table
                dataSource={fileList}
                rowKey="id"
                pagination={false}
                showHeader={false}
                expandIcon={() => null}
                expandedRowKeys={expandedRowKeys}
                onExpandedRowsChange={(keys) => setExpandedRowKeys(keys as string[])}
                className="file-table"
                columns={[
                  {
                    dataIndex: "name",
                    key: "name",
                    render: (_: any, record: FileItem) => {
                      const hasChildren = record.children && record.children.length > 0;
                      const isExpanded = expandedRowKeys.includes(record.id);
                      const depth = record.path.split('/').filter(Boolean).length - 1;
                      return (
                        <div
                          className="w-full flex items-center gap-2 py-2"
                          style={{ paddingLeft: depth * 14 }}
                          onClick={() => handleSelectFile(record)}
                        >
                          {hasChildren ? (
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 -ml-1 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isExpanded) {
                                  setExpandedRowKeys(expandedRowKeys.filter(id => id !== record.id));
                                } else {
                                  setExpandedRowKeys([...expandedRowKeys, record.id]);
                                }
                              }}
                            >
                              <RightOutlined
                                className="text-xs text-[#999] transition-transform duration-200"
                                style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
                              />
                            </span>
                          ) : (
                            <span className="inline-block w-6 h-6 -ml-1" />
                          )}
                          <img src={record.icon} className="size-6" alt="" />
                          <span className="flex-1 text-sm text-[#1D1E1F] truncate">
                            {record.name}
                          </span>
                          <input
                            type="checkbox"
                            checked={isSelectedFile(record)}
                            onChange={() => {}}
                            className="pointer-events-none"
                          />
                        </div>
                      );
                    },
                  },
                ]}
              />
            )}
          </div>
        </div>
      </Modal>
    );
  },
);

SpaceDialog.displayName = "SpaceDialog";

export default SpaceDialog;
