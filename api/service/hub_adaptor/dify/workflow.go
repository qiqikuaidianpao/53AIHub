package dify

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	db_model "github.com/53AI/53AIHub/model"
	"github.com/53AI/53AIHub/service/hub_adaptor/custom"
	"github.com/gin-gonic/gin"
	"github.com/songquanpeng/one-api/common/helper"
	"github.com/songquanpeng/one-api/common/logger"
	"github.com/songquanpeng/one-api/relay/meta"
	"github.com/songquanpeng/one-api/relay/model"
)

type DifyWorkflowAdaptor struct {
	meta         *meta.Meta
	CustomConfig *custom.CustomConfig
}

// DifyWorkflowRequest DIFY 工作流请求结构
type DifyWorkflowRequest struct {
	Inputs       map[string]interface{} `json:"inputs"`
	ResponseMode string                 `json:"response_mode"`
	User         string                 `json:"user"`
}

// DifyFileInput DIFY 文件输入结构
type DifyFileInput struct {
	TransferMethod string `json:"transfer_method"`
	UploadFileID   string `json:"upload_file_id"`
	Type           string `json:"type"`
}

// DifyWorkflowEvent DIFY 工作流事件结构
type DifyWorkflowEvent struct {
	Event         string                 `json:"event"`
	TaskID        string                 `json:"task_id"`
	WorkflowRunID string                 `json:"workflow_run_id"`
	Data          map[string]interface{} `json:"data"`
}

// DifyWorkflowResponse DIFY 工作流完整响应结构
type DifyWorkflowResponse struct {
	WorkflowRunID string                 `json:"workflow_run_id"`
	TaskID        string                 `json:"task_id"`
	Data          map[string]interface{} `json:"data"`
}

func (a *DifyWorkflowAdaptor) Init(meta *meta.Meta) {
	a.meta = meta
}

func (a *DifyWorkflowAdaptor) GetRequestURL(meta *meta.Meta) (string, error) {
	baseURL := meta.BaseURL

	// 去掉可能的 /v1 后缀以避免重复
	baseURL = strings.TrimSuffix(baseURL, "/v1")

	// 确保 baseURL 不以 / 结尾
	baseURL = strings.TrimSuffix(baseURL, "/")

	return baseURL + "/v1/workflows/run", nil
}

func (a *DifyWorkflowAdaptor) SetupRequestHeader(c *gin.Context, req *http.Request, meta *meta.Meta) error {
	req.Header.Set("Authorization", "Bearer "+meta.APIKey)
	req.Header.Set("Content-Type", "application/json")
	return nil
}

// ConvertWorkflowRequest 直接从工作流参数构造 DIFY 请求
func (a *DifyWorkflowAdaptor) ConvertWorkflowRequest(workflowID string, parameters map[string]interface{}) (*DifyWorkflowRequest, error) {
	logger.SysLogf("DIFY工作流直接请求 - WorkflowID: %s, Parameters: %+v", workflowID, parameters)

	// 处理参数中的文件上传
	processedInputs, err := a.processWorkflowParameters(parameters)
	if err != nil {
		logger.SysErrorf("处理DIFY工作流文件参数失败: %v", err)
		// 如果文件处理失败，使用原始参数继续执行
		processedInputs = parameters
	}

	// 构建 DIFY 工作流请求
	request := &DifyWorkflowRequest{
		Inputs:       processedInputs,
		ResponseMode: "streaming", // 使用流式模式
		User:         a.getUserID(),
	}

	return request, nil
}

// processWorkflowParameters 处理工作流参数中的文件上传
func (a *DifyWorkflowAdaptor) processWorkflowParameters(parameters map[string]interface{}) (map[string]interface{}, error) {
	if a.meta == nil {
		return parameters, fmt.Errorf("meta is nil")
	}

	processedParams := make(map[string]interface{})

	for key, value := range parameters {
		processedValue, err := a.processParameterValue(value)
		if err != nil {
			logger.SysErrorf("处理DIFY参数 %s 失败: %v", key, err)
			// 如果单个参数处理失败，使用原始值
			processedParams[key] = value
		} else {
			processedParams[key] = processedValue
		}
	}

	return processedParams, nil
}

// processParameterValue 递归处理参数值，支持字符串、数组、对象
func (a *DifyWorkflowAdaptor) processParameterValue(value interface{}) (interface{}, error) {
	switch v := value.(type) {
	case string:
		// 检查是否为 file_id: 格式
		return a.processFileIDString(v)
	case []interface{}:
		// 处理数组
		processedArray := make([]interface{}, len(v))
		for i, item := range v {
			processedItem, err := a.processParameterValue(item)
			if err != nil {
				processedArray[i] = item // 使用原始值
			} else {
				processedArray[i] = processedItem
			}
		}
		return processedArray, nil
	case map[string]interface{}:
		// 处理对象
		processedMap := make(map[string]interface{})
		for k, val := range v {
			processedVal, err := a.processParameterValue(val)
			if err != nil {
				processedMap[k] = val // 使用原始值
			} else {
				processedMap[k] = processedVal
			}
		}
		return processedMap, nil
	default:
		// 其他类型直接返回
		return value, nil
	}
}

// processFileIDString 处理 file_id: 格式的字符串，转换为 DIFY 文件格式
func (a *DifyWorkflowAdaptor) processFileIDString(value string) (interface{}, error) {
	// 检查是否为 file_id: 格式
	if !strings.HasPrefix(value, "file_id:") {
		return value, nil
	}

	// 提取文件ID
	fileIDStr := strings.TrimPrefix(value, "file_id:")
	fileID, err := strconv.ParseInt(fileIDStr, 10, 64)
	if err != nil {
		logger.SysErrorf("解析文件ID失败: %s, error: %v", fileIDStr, err)
		return value, err
	}

	// 获取上传文件对象
	uploadFile, err := db_model.GetUploadFileByID(fileID)
	if err != nil {
		logger.SysErrorf("获取上传文件失败: ID=%d, error: %v", fileID, err)
		return value, err
	}

	// 获取渠道文件映射
	channelID := a.meta.ChannelId
	// 使用与 chat 一致的模型名称格式
	modelName := "bot-" + strings.TrimPrefix(a.meta.ActualModelName, "bot-")

	fileMapping := uploadFile.GetChannelFileMapping(channelID, modelName)
	if fileMapping == nil {
		// 创建新的文件映射
		fileMapping = &db_model.ChannelFileMapping{}
		err := DifyUploadFile(a.meta, uploadFile, fileMapping)
		if err != nil {
			logger.SysErrorf("上传文件到DIFY失败: %v", err)
			return value, err
		}
		err = db_model.CreateChannelFileMapping(fileMapping)
		if err != nil {
			logger.SysErrorf("创建文件映射失败: %v", err)
			return value, err
		}
	} else if helper.GetTimestamp() > fileMapping.ExpirationTime || shouldRefreshDIFYFileMapping(uploadFile, fileMapping) {
		// 文件映射已过期，重新上传
		err := DifyUploadFile(a.meta, uploadFile, fileMapping)
		if err != nil {
			logger.SysErrorf("重新上传文件到DIFY失败: %v", err)
			return value, err
		}
		err = db_model.UpdateChannelFileMapping(fileMapping)
		if err != nil {
			logger.SysErrorf("更新文件映射失败: %v", err)
			return value, err
		}
	}

	// 根据文件类型生成 DIFY 文件格式
	fileType := a.getDifyFileType(uploadFile.MimeType, uploadFile.Extension)

	// 对于不支持的文件类型，记录警告但不中断处理
	if fileType == "unsupported" {
		logger.SysLogf("⚠️  DIFY工作流暂不支持文件类型: %s (MIME: %s)", uploadFile.Extension, uploadFile.MimeType)
		// 返回原始值，让上层决定如何处理
		return value, nil
	}

	// 返回 DIFY 文件数组格式（单个文件也要包装成数组）
	fileArray := []DifyFileInput{
		{
			TransferMethod: "local_file",
			UploadFileID:   fileMapping.ChannelFileID,
			Type:           fileType,
		},
	}

	logger.SysLogf("✅ DIFY工作流文件处理成功 - 原始ID: %d, 渠道文件ID: %s, 类型: %s",
		fileID, fileMapping.ChannelFileID, fileType)

	return fileArray, nil
}

// getDifyFileType 根据 MIME 类型和扩展名确定 DIFY 文件类型
func (a *DifyWorkflowAdaptor) getDifyFileType(mimeType, extension string) string {
	// 图片类型 - 与 chat 保持一致，优先支持图片
	if strings.HasPrefix(mimeType, "image/") {
		return "image"
	}

	// 音频类型 - 支持的音频格式
	if strings.HasPrefix(mimeType, "audio/") {
		ext := strings.ToLower(extension)
		supportedAudio := []string{".mp3", ".m4a", ".wav", ".webm", ".amr"}
		for _, audioExt := range supportedAudio {
			if ext == audioExt {
				return "audio"
			}
		}
	}

	// 视频类型 - 支持的视频格式
	if strings.HasPrefix(mimeType, "video/") {
		ext := strings.ToLower(extension)
		supportedVideo := []string{".mp4", ".mov", ".mpeg", ".mpga"}
		for _, videoExt := range supportedVideo {
			if ext == videoExt {
				return "video"
			}
		}
	}

	// 文档类型 - 根据 DIFY 文档支持的格式
	ext := strings.ToLower(extension)
	documentExts := []string{".txt", ".md", ".markdown", ".pdf", ".html", ".xlsx", ".xls", ".docx", ".csv", ".eml", ".msg", ".pptx", ".ppt", ".xml", ".epub"}
	for _, docExt := range documentExts {
		if ext == docExt {
			return "document"
		}
	}

	// 对于不在支持列表中的文件类型，返回 unsupported
	// 这样可以让上层代码决定如何处理
	logger.SysLogf("🔍 检测到未明确支持的文件类型 - MIME: %s, Extension: %s", mimeType, extension)

	// 其他类型归为 custom，但记录警告
	return "custom"
}

// getUserID 获取用户ID
func (a *DifyWorkflowAdaptor) getUserID() string {
	if a.CustomConfig != nil && a.CustomConfig.UserId != "" {
		return a.CustomConfig.UserId
	}
	return "default_user"
}

// DoRequest 执行 DIFY 工作流请求
func (a *DifyWorkflowAdaptor) DoRequest(c *gin.Context, meta *meta.Meta, requestBody io.Reader) (*http.Response, error) {
	url, err := a.GetRequestURL(meta)
	if err != nil {
		return nil, err
	}

	// 读取请求体用于日志输出
	bodyBytes, err := io.ReadAll(requestBody)
	if err != nil {
		return nil, fmt.Errorf("读取请求体失败: %v", err)
	}

	// 格式化输出请求信息
	logger.SysLogf("🚀 DIFY工作流请求开始")
	logger.SysLogf("┌─────────────────────────────────────────────────────────────")
	logger.SysLogf("│ 📡 请求URL: %s", url)
	logger.SysLogf("│ 🔑 API Key: %s", maskAPIKey(meta.APIKey))
	logger.SysLogf("│ 📝 请求方法: POST")
	logger.SysLogf("│ 📋 Content-Type: application/json")
	logger.SysLogf("├─────────────────────────────────────────────────────────────")
	logger.SysLogf("│ 📦 请求参数:")

	// 格式化输出请求体
	var requestData map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &requestData); err == nil {
		prettyJSON, _ := json.MarshalIndent(requestData, "│   ", "  ")
		logger.SysLogf("│   %s", string(prettyJSON))
	} else {
		logger.SysLogf("│   %s", string(bodyBytes))
	}
	logger.SysLogf("└─────────────────────────────────────────────────────────────")

	// 重新创建请求体
	req, err := http.NewRequest("POST", url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}

	err = a.SetupRequestHeader(c, req, meta)
	if err != nil {
		return nil, err
	}

	client := &http.Client{}
	resp, err := client.Do(req)

	if err != nil {
		logger.SysErrorf("❌ DIFY工作流请求失败: %v", err)
		return nil, err
	}

	logger.SysLogf("✅ DIFY工作流请求成功 - 状态码: %d", resp.StatusCode)
	return resp, nil
}

// ProcessStreamingResponse 处理 DIFY 工作流的流式响应
func (a *DifyWorkflowAdaptor) ProcessStreamingResponse(resp *http.Response) (*custom.WorkflowResponseData, error) {
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	// 设置更大的缓冲区以处理大型响应 (1MB)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)

	var finalOutputs map[string]interface{}
	var workflowRunID string
	var taskID string
	var textChunks []string

	logger.SysLogf("📡 开始处理DIFY工作流流式响应")
	logger.SysLogf("┌─────────────────────────────────────────────────────────────")
	logger.SysLogf("│ 🔄 响应状态码: %d", resp.StatusCode)
	logger.SysLogf("│ 📋 Content-Type: %s", resp.Header.Get("Content-Type"))
	logger.SysLogf("├─────────────────────────────────────────────────────────────")

	// 使用标签来支持跳出外层循环
scanLoop:
	for scanner.Scan() {
		line := scanner.Text()

		// 跳过空行和非数据行
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		// 提取 JSON 数据
		jsonData := strings.TrimPrefix(line, "data: ")
		if jsonData == "" {
			continue
		}

		// 解析事件
		var event DifyWorkflowEvent
		if err := json.Unmarshal([]byte(jsonData), &event); err != nil {
			logger.SysErrorf("解析DIFY工作流事件失败: %v, 数据: %s", err, jsonData)
			continue
		}

		// 记录基本信息
		if workflowRunID == "" {
			workflowRunID = event.WorkflowRunID
		}
		if taskID == "" {
			taskID = event.TaskID
		}

		// 处理不同类型的事件
		switch event.Event {
		case "workflow_started":
			logger.SysLogf("DIFY工作流开始执行 - WorkflowRunID: %s", event.WorkflowRunID)

		case "node_started":
			if nodeID, ok := event.Data["node_id"].(string); ok {
				if title, ok := event.Data["title"].(string); ok {
					logger.SysLogf("DIFY节点开始执行 - NodeID: %s, Title: %s", nodeID, title)
				}
			}

		case "text_chunk":
			if text, ok := event.Data["text"].(string); ok {
				textChunks = append(textChunks, text)
				// logger.SysLogf("%s", text)
			}

		case "node_finished":
			if nodeID, ok := event.Data["node_id"].(string); ok {
				if status, ok := event.Data["status"].(string); ok {
					logger.SysLogf("DIFY节点执行完成 - NodeID: %s, Status: %s", nodeID, status)
				}
			}

		case "workflow_finished":
			logger.SysLogf("DIFY工作流执行完成")

			// 提取最终输出
			if outputs, ok := event.Data["outputs"].(map[string]interface{}); ok {
				finalOutputs = outputs
				logger.SysLogf("DIFY工作流最终输出: %+v", finalOutputs)
			}

			// 工作流完成，可以退出循环
			break scanLoop

		case "ping":
			// 心跳事件，保持连接
			logger.SysLogf("DIFY工作流心跳")

		default:
			logger.SysLogf("DIFY工作流未知事件类型: %s", event.Event)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("读取DIFY工作流响应流失败: %v", err)
	}

	// 构建最终响应
	if finalOutputs == nil {
		finalOutputs = make(map[string]interface{})
	}

	// 如果有文本片段，合并到输出中
	if len(textChunks) > 0 {
		finalOutputs["text"] = strings.Join(textChunks, "")
	}

	workflowResponse := &custom.WorkflowResponseData{
		WorkflowOutputData: finalOutputs,
		ExecuteID:          workflowRunID,
		ChannelID:          a.meta.ChannelId,
		ModelName:          a.meta.OriginModelName,
	}

	logger.SysLogf("DIFY工作流处理完成 - ExecuteID: %s, 输出字段数: %d",
		workflowRunID, len(finalOutputs))

	return workflowResponse, nil
}

// DifyUploadFile 上传文件到 DIFY (复用 chat 的实现)
func DifyUploadFile(meta *meta.Meta, uploadFile *db_model.UploadFile, fileMapping *db_model.ChannelFileMapping) error {
	// 直接调用 chat 适配器的文件上传实现
	return DIFYUploadFile(meta, uploadFile, fileMapping)
}

func (a *DifyWorkflowAdaptor) ConvertImageRequest(request *model.ImageRequest) (any, error) {
	return nil, errors.New("dify workflow adaptor does not support image requests")
}
