import { useState, forwardRef, useImperativeHandle, useRef } from "react";
import { Modal, Button, Form, Input, Progress, message, Tooltip } from "antd";
import { CheckOutlined, UploadOutlined } from "@ant-design/icons";
import { SvgIcon } from "@km/shared-components-react";
import FileUpload from "@/components/Upload";
import { useNavigate } from "react-router-dom";
import {
  startVirtualProgress,
  type ProgressController,
} from "@/utils/progress";
import { skillApi } from "@/api/modules/skill/index";

interface CreateSkillDialogRef {
  open: () => void;
}

interface RepoFormData {
  url: string;
}

interface UploadFormData {
  file: File[];
}

interface UploadedFile {
  name: string;
  id?: string;
}

interface TypeOption {
  value: "repo" | "upload" | "chat";
  label: string;
  description: string;
  icon: string | React.ComponentType;
  iconType: "svg" | "el";
  iconColor: string;
  disabled?: boolean;
  tooltip?: string;
}

const typeOptions: TypeOption[] = [
  {
    value: "repo",
    label: "仓库URL",
    description: "输入包含 Skill 的 GitHub 链接，自动拉取并加载技能代码与配置",
    icon: "github",
    iconType: "svg",
    iconColor: "bg-blue-500",
  },
  {
    value: "upload",
    label: "上传技能",
    description: "选择包含Skill的zip压缩包，系统将解压并解析技能配置",
    icon: "upload",
    iconType: "svg",
    iconColor: "bg-purple-500",
  },
  {
    value: "chat",
    label: "对话创建",
    description: "与 AI 助手进行交互式对话，描述你的技能需求与功能逻辑",
    icon: "chat",
    iconType: "svg",
    iconColor: "bg-blue-400",
    disabled: true,
    tooltip: "功能即将上线，敬请期待",
  },
];

const CreateSkillDialog = forwardRef<CreateSkillDialogRef>((props, ref) => {
  const navigate = useNavigate();
  const [dialogVisible, setDialogVisible] = useState(false);
  const [securityDialogVisible, setSecurityDialogVisible] = useState(false);
  const [loadingDialogVisible, setLoadingDialogVisible] = useState(false);
  const [loadingPercentage, setLoadingPercentage] = useState(0);
  const [addType, setAddType] = useState<"repo" | "upload" | "chat">("repo");
  const [scanStatusText, setScanStatusText] = useState("");
  const [repoForm] = Form.useForm<RepoFormData>();
  const uploadRef = useRef<any>(null);
  const [uploadForm, setUploadForm] = useState<UploadFormData>({ file: [] });
  const [uploadedFile, setUploadedFile] = useState<UploadedFile>({ name: "" });

  useImperativeHandle(ref, () => ({
    open: () => {
      setDialogVisible(true);
    },
  }));

  const handleClose = () => {
    setDialogVisible(false);
    resetForms();
  };

  const resetForms = () => {
    setAddType("repo");
    repoForm.resetFields();
    setUploadForm({ file: [] });
    setUploadedFile({ name: "", id: undefined });
    uploadRef.current?.clearFiles?.();
  };

  const handleFileBefore = (file: File) => {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      message.error("文件大小不能超过10M");
      uploadRef.current?.clearFiles?.();
      return false;
    }
    if (!file.name.endsWith(".zip")) {
      message.error("仅支持.zip文件");
      uploadRef.current?.clearFiles?.();
      return false;
    }
    return true;
  };

  const handleFileSuccess = (data: any) => {
    if (data) {
      setUploadedFile({
        name: data.name,
        id: data.id,
      });
      message.success("文件上传成功");
    }
  };

  const handleFileError = () => {
    message.error("文件上传失败，请重试");
    setUploadedFile({ name: "", id: undefined });
  };

  const handleRemoveFile = () => {
    setUploadedFile({ name: "", id: undefined });
    uploadRef.current?.clearFiles?.();
    setUploadForm({ file: [] });
  };

  const submitSkill = (): Promise<{ skill_id: string }> => {
    return new Promise((resolve, reject) => {
      let fetchController: ProgressController | null = null;
      let scanController: ProgressController | null = null;
      let pollingTimer: ReturnType<typeof setTimeout> | null = null;

      setScanStatusText(
        addType === "repo" ? "正在连接远程仓库..." : "正在解压Skill文件...",
      );
      fetchController = startVirtualProgress({
        startPercent: 0,
        endPercent: 50,
        baseInterval: 80,
        onProgress: (p) => setLoadingPercentage(p),
      });

      const requestData =
        addType === "repo"
          ? {
              source_type: "github" as const,
              github_url: repoForm.getFieldValue("url"),
            }
          : {
              source_type: "zip" as const,
              upload_file_id: uploadedFile.id,
            };

      skillApi
        .import(requestData)
        .then((result: any) => {
          const jobId = result?.scan_job_id;
          if (!jobId) {
            throw new Error("未获取到扫描任务ID");
          }

          fetchController?.stop();
          scanController = startVirtualProgress({
            startPercent: 50,
            endPercent: 90,
            baseInterval: 150,
            onProgress: (p) => setLoadingPercentage(p),
          });

          const pollScanStatus = () => {
            skillApi
              .getImportJob({ id: jobId })
              .then((detailResult: any) => {
                const scanJob = detailResult?.job;
                const status = scanJob?.status;
                const skillId = detailResult?.skill?.id;

                if (status === "pending") {
                  setScanStatusText("正在等待扫描...");
                  pollingTimer = setTimeout(pollScanStatus, 5000);
                } else if (status === "running") {
                  setScanStatusText("正在扫描技能文件...");
                  pollingTimer = setTimeout(pollScanStatus, 5000);
                } else if (status === "success") {
                  const riskLevel = scanJob?.risk_level;
                  if (riskLevel === "high") {
                    scanController?.stop();
                    if (pollingTimer) clearTimeout(pollingTimer);
                    reject({ code: "SECURITY_RISK", message: "安全风险过高" });
                    return;
                  }

                  scanController?.stop();
                  if (pollingTimer) clearTimeout(pollingTimer);

                  setScanStatusText("扫描完成");
                  const completeTimer = setInterval(() => {
                    setLoadingPercentage((prev) => {
                      if (prev >= 100) {
                        clearInterval(completeTimer);
                        resolve({ skill_id: skillId });
                        return 100;
                      }
                      return Math.min(100, prev + 5);
                    });
                  }, 30);
                } else if (status === "failed") {
                  const riskLevel = scanJob?.risk_level;

                  if (
                    riskLevel === "high" ||
                    scanJob?.message?.includes("skill scan risk is too high")
                  ) {
                    scanController?.stop();
                    if (pollingTimer) clearTimeout(pollingTimer);
                    reject({ code: "SECURITY_RISK", message: "安全风险过高" });
                    return;
                  }

                  scanController?.stop();
                  if (pollingTimer) clearTimeout(pollingTimer);

                  const errorMsg = scanJob?.message || "扫描失败";
                  reject({ code: "SCAN_FAILED", message: errorMsg });
                } else {
                  pollingTimer = setTimeout(pollScanStatus, 5000);
                }
              })
              .catch(() => {
                scanController?.stop();
                if (pollingTimer) clearTimeout(pollingTimer);
                reject({ code: "POLL_ERROR", message: "查询扫描状态失败" });
              });
          };

          pollScanStatus();
        })
        .catch((error: any) => {
          fetchController?.stop();
          scanController?.stop();
          if (pollingTimer) clearTimeout(pollingTimer);

          const errorCode = error?.response?.data?.code;
          reject({ code: errorCode, message: "导入失败" });
        });
    });
  };

  const handleConfirm = async () => {
    if (addType === "repo") {
      try {
        await repoForm.validateFields();
      } catch {
        return;
      }
    } else if (addType === "upload") {
      if (!uploadedFile.name) {
        message.warning("请选择要上传的文件");
        return;
      }
    }

    setLoadingDialogVisible(true);
    setLoadingPercentage(0);
    try {
      const result = await submitSkill();
      setLoadingDialogVisible(false);
      setDialogVisible(false);
      navigate({
        pathname: "/skill-detail",
        search: `?skill_id=${result.skill_id}&isNew=true`,
      });
    } catch (error: any) {
      setLoadingDialogVisible(false);
      if (error?.code === "SECURITY_RISK") {
        setSecurityDialogVisible(true);
      } else if (
        error?.message === "db error: work ai model is not configured"
      ) {
        message.error("工作台未设置模型");
      } else if (error?.message?.includes("skill package missing SKILL.md")) {
        message.error("导入失败：技能包缺少SKILL.MD文件");
      } else if (error?.message?.includes("skill name already exists")) {
        message.error("导入失败：该技能已存在");
      } else {
        message.error(error?.message);
      }
    }
  };

  const handleSecurityConfirm = () => {
    setSecurityDialogVisible(false);
  };

  const renderTypeIcon = (option: TypeOption) => {
    if (option.iconType === "svg") {
      return <SvgIcon name={option.icon as string} color="#fff" size={20} />;
    }
    const IconComponent = option.icon as React.ComponentType;
    return <IconComponent />;
  };

  return (
    <>
      {/* 添加技能对话框 */}
      <Modal
        open={dialogVisible}
        title="添加"
        width="60%"
        mask={{ closable: false }}
        onCancel={handleClose}
        footer={
          <div className="flex justify-end gap-3">
            <Button onClick={handleClose}>取消</Button>
            <Button type="primary" onClick={handleConfirm}>
              确定
            </Button>
          </div>
        }
      >
        {/* 类型选择 */}
        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-4">
            类型
          </label>
          <div className="flex gap-4">
            {typeOptions.map((option) => (
              <Tooltip
                key={option.value}
                title={option.disabled ? option.tooltip : ""}
              >
                <div
                  className={`flex items-start gap-4 p-3 rounded-lg border-2 transition-all duration-200 ${
                    option.disabled
                      ? "opacity-50 cursor-not-allowed bg-gray-50/50"
                      : "cursor-pointer hover:border-blue-200"
                  } ${
                    addType === option.value && !option.disabled
                      ? "border-blue-500 hover:border-blue-500 bg-blue-50/30"
                      : "border-gray-100"
                  }`}
                  onClick={() => !option.disabled && setAddType(option.value)}
                >
                  <div
                    className={`size-9 rounded-lg flex items-center justify-center text-white flex-shrink-0 ${option.iconColor}`}
                  >
                    {renderTypeIcon(option)}
                  </div>
                  <div>
                    <div
                      className={`text-sm font-semibold text-gray-900 mb-1 ${
                        addType === option.value && !option.disabled
                          ? "!text-blue-600"
                          : ""
                      }`}
                    >
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-400 leading-relaxed">
                      {option.description}
                    </div>
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* 仓库URL表单 */}
        {addType === "repo" && (
          <div className="space-y-6 mb-4">
            <Form form={repoForm} layout="vertical">
              <Form.Item
                label="GitHub 仓库 URL"
                name="url"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) {
                        return Promise.reject(new Error("请输入GitHub仓库URL"));
                      }
                      if (!value.includes("github.com")) {
                        return Promise.reject(
                          new Error("请输入有效的GitHub仓库URL"),
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input
                  placeholder="请输入GitHub仓库的URL，例如：https://github.com/user/skill-repo"
                  maxLength={200}
                  showCount
                />
              </Form.Item>
            </Form>
          </div>
        )}

        {/* 上传技能表单 */}
        {addType === "upload" && (
          <div>
            {uploadedFile.name ? (
              <div className="mt-3 py-[10px] px-2 rounded-lg border border-blue-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckOutlined className="text-green-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {uploadedFile.name}
                  </span>
                </div>
                <SvgIcon
                  name="delete"
                  className="text-red-500 cursor-pointer"
                  onClick={handleRemoveFile}
                />
              </div>
            ) : (
              <FileUpload
                ref={uploadRef}
                className="w-full"
                full
                drag
                limit={1}
                accept=".zip"
                size={10}
                beforeUpload={handleFileBefore}
                onSuccess={handleFileSuccess}
                onError={handleFileError}
              >
                <div className="w-full flex flex-col items-center justify-center p-8 bg-[rgba(249,250,251,0.3)] rounded-xl border-2 border-dashed border-gray-200 transition-all hover:bg-[rgba(239,246,255,0.2)] hover:border-blue-500">
                  <UploadOutlined
                    className="text-blue-500 mb-4"
                    style={{ fontSize: 48 }}
                  />
                  <div className="text-base font-medium text-gray-900">
                    拖拽文件至此，或点击选择文件
                  </div>
                  <div className="text-sm text-gray-400 mt-2">
                    仅支持拓展名为.zip的文件，大小不超过10M
                  </div>
                </div>
              </FileUpload>
            )}
          </div>
        )}
      </Modal>

      {/* 加载中弹窗 */}
      <Modal
        open={loadingDialogVisible}
        width={360}
        closable={false}
        mask={{ closable: false }}
        footer={null}
      >
        <div className="flex flex-col items-center py-8">
          <Progress
            type="circle"
            percent={loadingPercentage}
            strokeWidth={6}
            size={100}
            strokeColor="#2563EB"
            className="mb-6"
          />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {addType === "repo" ? "正在拉取并扫描" : "正在解压并扫描"}
          </h3>
          <p className="text-sm text-blue-300">{scanStatusText}</p>
        </div>
      </Modal>

      {/* 安全风险拦截弹窗 */}
      <Modal
        open={securityDialogVisible}
        width={420}
        closable={false}
        mask={{ closable: false }}
        footer={null}
      >
        <div className="flex flex-col items-center py-4">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <SvgIcon name="warning" size="32px" color="#EF4444" />
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-4">
            安全风险拦截
          </h3>
          <div className="w-full bg-red-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-500 font-semibold text-center mb-2">
              此技能安全性风险过高，禁止添加！
            </p>
            <p className="text-red-400 text-xs text-center leading-relaxed">
              系统检测到该技能包含高危系统调用及危险操作的网络访问，为了您的数据安全，已自动拦截。
            </p>
          </div>
          <Button
            type="primary"
            className="w-full"
            onClick={handleSecurityConfirm}
          >
            我知道了
          </Button>
        </div>
      </Modal>
    </>
  );
});

CreateSkillDialog.displayName = "CreateSkillDialog";

export default CreateSkillDialog;
