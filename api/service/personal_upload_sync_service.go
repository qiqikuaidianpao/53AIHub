package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"mime"
	"path"
	"strings"

	"github.com/53AI/53AIHub/common/logger"
	"github.com/53AI/53AIHub/model"
	"github.com/53AI/53AIHub/service/elasticsearch"
	"gorm.io/gorm"
)

type PersonalUploadSyncService struct {
	Eid                  int64
	personalSpaceService *PersonalSpaceService
}

func NewPersonalUploadSyncService(eid int64) *PersonalUploadSyncService {
	return &PersonalUploadSyncService{
		Eid:                  eid,
		personalSpaceService: NewPersonalSpaceService(eid),
	}
}

func (s *PersonalUploadSyncService) SyncUploadedFile(ctx context.Context, userID int64, uploadFile *model.UploadFile) (*model.File, error) {
	if uploadFile == nil {
		return nil, fmt.Errorf("upload file is required")
	}
	if uploadFile.ID <= 0 {
		return nil, fmt.Errorf("upload file id is required")
	}

	_, library, err := s.personalSpaceService.EnsurePersonalWorkspace(ctx, userID)
	if err != nil {
		return nil, err
	}

	filePath, err := s.buildUniquePersonalUploadPath(library.ID, uploadFile)
	if err != nil {
		return nil, err
	}

	file := &model.File{
		Path:             filePath,
		Type:             model.FILE_TYPE_FILE,
		LibraryID:        library.ID,
		Eid:              s.Eid,
		UploadFileID:     uploadFile.ID,
		OriginType:       model.FileOriginTypePersonalUpload,
		OriginRefID:      uploadFile.ID,
		OriginSource:     model.FileOriginSourceLocal,
		ConversionStatus: model.FileConversionStatusNormal,
		ParsingStatus:    model.FileParsingStatusPending,
		UserID:           userID,
	}

	if err := file.Save(); err != nil {
		return nil, err
	}

	// 触发文档解析 pipeline:让个人库上传的文档也能被解析(工作台/检索可读)
	go func() {
		params := map[string]interface{}{
			"eid":           s.Eid,
			"file_id":       file.ID,
			"user_id":       userID,
			"library_id":    library.ID,
			"upload_id":     uploadFile.ID,
			"origin_status": model.FileConversiontatusInactive,
		}
		paramsJSON, err := json.Marshal(params)
		if err != nil {
			logger.SysErrorf("【我的上传】序列化解析参数失败: eid=%d fileID=%d err=%v", s.Eid, file.ID, err)
			return
		}
		jobs, err := createRagJobsForFile(context.Background(), s.Eid, file.ID, string(paramsJSON))
		if err != nil {
			logger.SysErrorf("【我的上传】创建解析任务失败: eid=%d fileID=%d err=%v", s.Eid, file.ID, err)
			return
		}
		if len(jobs) > 0 {
			model.UpdateFileConversionStatus(file.ID, model.FileConversionStatusPending)
			logger.SysLogf("【我的上传】已触发解析: eid=%d fileID=%d jobCount=%d", s.Eid, file.ID, len(jobs))
		}
	}()

	fps := NewFilePermissionService(s.Eid)
	if err := fps.AddFileCreatorPermission(file.ID, userID); err != nil {
		logger.SysErrorf("【我的上传】补充创建者权限失败: eid=%d fileID=%d userID=%d err=%v", s.Eid, file.ID, userID, err)
	}

	elasticsearch.SyncFileToES(file, "create")

	return file, nil
}

func (s *PersonalUploadSyncService) buildUniquePersonalUploadPath(libraryID int64, uploadFile *model.UploadFile) (string, error) {
	fileName := strings.TrimSpace(uploadFile.FileName)
	if fileName == "" {
		return "", fmt.Errorf("upload file name is required")
	}

	fileName = strings.TrimPrefix(fileName, "/")
	if strings.LastIndex(fileName, ".") == -1 {
		ext := strings.TrimSpace(uploadFile.Extension)
		if ext == "" {
			if mimeExts, _ := mime.ExtensionsByType(uploadFile.MimeType); len(mimeExts) > 0 {
				ext = mimeExts[0]
			}
		}
		if ext == "" {
			ext = ".bin"
		}
		fileName += ext
	}

	originalPath := "/" + fileName
	existing, err := model.GetFileByPathAndLibraryNotDeleted(s.Eid, libraryID, originalPath)
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", err
		}
		return originalPath, nil
	}
	if existing == nil {
		return originalPath, nil
	}

	dir := path.Dir(originalPath)
	baseName := path.Base(originalPath)
	name, ext := splitFileNameAndExtensions(baseName)
	for i := 1; i <= 1000; i++ {
		candidate := path.Join(dir, fmt.Sprintf("%s（%d）%s", name, i, ext))
		if !strings.HasPrefix(candidate, "/") {
			candidate = "/" + candidate
		}
		existingCandidate, candidateErr := model.GetFileByPathAndLibraryNotDeleted(s.Eid, libraryID, candidate)
		if candidateErr != nil {
			if errors.Is(candidateErr, gorm.ErrRecordNotFound) {
				return candidate, nil
			}
			return "", candidateErr
		}
		if existingCandidate == nil {
			return candidate, nil
		}
	}

	return "", fmt.Errorf("cannot generate unique personal upload path")
}

func splitFileNameAndExtensions(filename string) (baseName, extensions string) {
	firstDotIndex := strings.Index(filename, ".")
	if firstDotIndex == -1 {
		return filename, ""
	}

	return filename[:firstDotIndex], filename[firstDotIndex:]
}
