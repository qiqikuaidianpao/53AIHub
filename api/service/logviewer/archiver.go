package logviewer

import (
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/53AI/53AIHub/config"
)

// ArchiveResult 归档操作结果
type ArchiveResult struct {
	ArchivedFiles []ArchivedFile `json:"archived_files"`
	TotalSize     int64          `json:"total_size"`
	ArchivedSize  int64          `json:"archived_size"`
}

// ArchivedFile 单个归档文件信息
type ArchivedFile struct {
	Name           string `json:"name"`
	Size           int64  `json:"size"`
	CompressedSize int64  `json:"compressed_size"`
}

// ArchiveOldLogs 归档所有非当前活跃的日志文件。
// 当前活跃文件判断：
//   - OnlyOneLogFile=true: 53AIHub.log, 53AIHub-error.log, 53AIHub-crash.log
//   - OnlyOneLogFile=false: 今天日期的日志文件
//
// 归档文件移至 archive/ 子目录并以 .gz 压缩。
func ArchiveOldLogs(logDir string) (*ArchiveResult, error) {
	result := &ArchiveResult{
		ArchivedFiles: make([]ArchivedFile, 0),
	}

	// 确定活跃文件名集合
	activeFiles := makeActiveFileSet()

	// 查找所有日志文件（跳过已有的 archive 目录）
	allFiles, err := collectLogFiles(logDir, true)
	if err != nil {
		return nil, err
	}

	// 创建 archive 目录
	archiveDir := filepath.Join(logDir, "archive")
	if err := os.MkdirAll(archiveDir, 0755); err != nil {
		return nil, err
	}

	for _, fpath := range allFiles {
		base := filepath.Base(fpath)
		if activeFiles[base] {
			continue
		}

		// 读取原文件
		data, err := os.ReadFile(fpath)
		if err != nil {
			continue
		}

		// 准备 gz 输出路径
		gzName := base + ".gz"
		gzPath := filepath.Join(archiveDir, gzName)

		// gzip 压缩写入
		gzFile, err := os.Create(gzPath)
		if err != nil {
			continue
		}

		gzw := gzip.NewWriter(gzFile)
		if _, err := io.Copy(gzw, strings.NewReader(string(data))); err != nil {
			_ = gzw.Close()
			_ = gzFile.Close()
			os.Remove(gzPath)
			continue
		}
		_ = gzw.Close()
		_ = gzFile.Close()

		// 获取压缩后大小
		gzStat, _ := os.Stat(gzPath)
		var compressedSize int64
		if gzStat != nil {
			compressedSize = gzStat.Size()
		}

		// 删除原文件
		if err := os.Remove(fpath); err != nil {
			// 删除失败时，把 gz 文件也删掉回滚
			os.Remove(gzPath)
			continue
		}

		result.TotalSize += int64(len(data))
		result.ArchivedSize += compressedSize
		result.ArchivedFiles = append(result.ArchivedFiles, ArchivedFile{
			Name:           base,
			Size:           int64(len(data)),
			CompressedSize: compressedSize,
		})
	}

	return result, nil
}

// makeActiveFileSet 根据配置确定当前正在被写入的日志文件名集合。
func makeActiveFileSet() map[string]bool {
	activeFiles := make(map[string]bool)
	today := time.Now().Format("20060102")

	if config.OnlyOneLogFile {
		activeFiles["53AIHub.log"] = true
		activeFiles["53AIHub-error.log"] = true
		activeFiles["53AIHub-crash.log"] = true
	} else {
		activeFiles["53AIHub-"+today+".log"] = true
		activeFiles["53AIHub-error-"+today+".log"] = true
		activeFiles["53AIHub-crash-"+today+".log"] = true
	}

	// RagJob 日志按任务命名，难以判断是否活跃，不自动归档
	return activeFiles
}
