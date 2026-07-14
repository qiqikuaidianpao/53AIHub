package dify

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"html"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/mail"
	"net/textproto"
	"strings"
	"unicode"
	"unicode/utf8"

	db_model "github.com/53AI/53AIHub/model"
	xhtml "golang.org/x/net/html"
	"golang.org/x/net/html/charset"
)

const (
	difyNormalizedSourceMarker = `"source_normalized":true`
	maxNormalizedEMLRunes      = 24000
	maxEMLPartBytes            = 2 << 20
)

type difyUploadPayload struct {
	Content         []byte
	FileName        string
	MimeType        string
	SourceExtension string
	Normalized      bool
}

type emlContent struct {
	plainParts  []string
	htmlParts   []string
	attachments []string
}

func prepareDIFYUpload(uploadFile *db_model.UploadFile, content []byte) (*difyUploadPayload, error) {
	payload := &difyUploadPayload{
		Content:         content,
		FileName:        uploadFile.FileName,
		MimeType:        uploadFile.MimeType,
		SourceExtension: normalizedExtension(uploadFile),
	}

	if payload.SourceExtension != "eml" {
		return payload, nil
	}

	normalized, err := extractEMLText(uploadFile.FileName, content)
	if err != nil {
		return nil, fmt.Errorf("normalize EML for Dify: %w", err)
	}
	payload.Content = normalized
	payload.FileName = uploadFile.FileName + ".txt"
	payload.MimeType = "text/plain; charset=utf-8"
	payload.Normalized = true
	return payload, nil
}

func shouldRefreshDIFYFileMapping(uploadFile *db_model.UploadFile, mapping *db_model.ChannelFileMapping) bool {
	if normalizedExtension(uploadFile) != "eml" {
		return false
	}
	return mapping == nil || !strings.Contains(mapping.ApiResponse, difyNormalizedSourceMarker)
}

func normalizedExtension(uploadFile *db_model.UploadFile) string {
	ext := strings.TrimSpace(strings.ToLower(uploadFile.Extension))
	ext = strings.TrimPrefix(ext, ".")
	if ext != "" {
		return ext
	}
	name := strings.ToLower(strings.TrimSpace(uploadFile.FileName))
	if index := strings.LastIndex(name, "."); index >= 0 && index+1 < len(name) {
		return name[index+1:]
	}
	return ""
}

func extractEMLText(fileName string, content []byte) ([]byte, error) {
	message, err := mail.ReadMessage(bytes.NewReader(content))
	if err != nil {
		return nil, fmt.Errorf("read message: %w", err)
	}

	collector := &emlContent{}
	if err := collectEMLParts(textproto.MIMEHeader(message.Header), message.Body, collector, 0); err != nil {
		return nil, err
	}

	var output strings.Builder
	writeHeaderLine(&output, "原始文件名", fileName)
	writeHeaderLine(&output, "主题", decodeMIMEHeader(message.Header.Get("Subject")))
	writeHeaderLine(&output, "发件人", decodeMIMEHeader(message.Header.Get("From")))
	writeHeaderLine(&output, "收件人", decodeMIMEHeader(message.Header.Get("To")))
	writeHeaderLine(&output, "抄送", decodeMIMEHeader(message.Header.Get("Cc")))
	writeHeaderLine(&output, "日期", decodeMIMEHeader(message.Header.Get("Date")))

	body := strings.TrimSpace(strings.Join(collector.plainParts, "\n\n"))
	if body == "" {
		body = strings.TrimSpace(strings.Join(collector.htmlParts, "\n\n"))
	}
	if body != "" {
		output.WriteString("\n正文：\n")
		output.WriteString(body)
		output.WriteByte('\n')
	}
	if len(collector.attachments) > 0 {
		output.WriteString("\n附件：\n")
		for _, attachment := range collector.attachments {
			output.WriteString("- ")
			output.WriteString(attachment)
			output.WriteByte('\n')
		}
	}

	normalized := truncateRunes(strings.TrimSpace(output.String()), maxNormalizedEMLRunes)
	if normalized == "" {
		return nil, fmt.Errorf("message has no readable headers or body")
	}
	return []byte(normalized), nil
}

func collectEMLParts(header textproto.MIMEHeader, body io.Reader, collector *emlContent, depth int) error {
	if depth > 10 {
		return fmt.Errorf("MIME nesting exceeds limit")
	}

	mediaType, params, err := mime.ParseMediaType(header.Get("Content-Type"))
	if err != nil || mediaType == "" {
		mediaType = "text/plain"
		params = map[string]string{}
	}
	mediaType = strings.ToLower(mediaType)

	decodedBody := decodeTransferEncoding(header.Get("Content-Transfer-Encoding"), body)
	if strings.HasPrefix(mediaType, "multipart/") {
		boundary := params["boundary"]
		if boundary == "" {
			return fmt.Errorf("multipart message has no boundary")
		}
		reader := multipart.NewReader(decodedBody, boundary)
		for {
			part, partErr := reader.NextPart()
			if partErr == io.EOF {
				break
			}
			if partErr != nil {
				return fmt.Errorf("read MIME part: %w", partErr)
			}
			name := decodeMIMEHeader(part.FileName())
			disposition, _, _ := mime.ParseMediaType(part.Header.Get("Content-Disposition"))
			if name != "" || strings.EqualFold(disposition, "attachment") {
				if name == "" {
					name = "未命名附件"
				}
				collector.attachments = appendUnique(collector.attachments, name)
				_ = part.Close()
				continue
			}
			if err := collectEMLParts(part.Header, part, collector, depth+1); err != nil {
				_ = part.Close()
				return err
			}
			_ = part.Close()
		}
		return nil
	}

	if mediaType == "message/rfc822" {
		nested, err := mail.ReadMessage(decodedBody)
		if err != nil {
			return fmt.Errorf("read nested message: %w", err)
		}
		return collectEMLParts(textproto.MIMEHeader(nested.Header), nested.Body, collector, depth+1)
	}
	if mediaType != "text/plain" && mediaType != "text/html" {
		return nil
	}

	text, err := readTextPart(decodedBody, params["charset"])
	if err != nil {
		return fmt.Errorf("read %s part: %w", mediaType, err)
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	if mediaType == "text/html" {
		text = htmlToText(text)
		if text != "" {
			collector.htmlParts = append(collector.htmlParts, text)
		}
		return nil
	}
	collector.plainParts = append(collector.plainParts, text)
	return nil
}

func decodeTransferEncoding(encoding string, reader io.Reader) io.Reader {
	switch strings.ToLower(strings.TrimSpace(encoding)) {
	case "base64":
		return base64.NewDecoder(base64.StdEncoding, reader)
	case "quoted-printable":
		return quotedprintable.NewReader(reader)
	default:
		return reader
	}
}

func readTextPart(reader io.Reader, charsetName string) (string, error) {
	limited := io.LimitReader(reader, maxEMLPartBytes)
	if strings.TrimSpace(charsetName) != "" {
		decoded, err := charset.NewReaderLabel(charsetName, limited)
		if err == nil {
			limited = io.LimitReader(decoded, maxEMLPartBytes)
		}
	}
	content, err := io.ReadAll(limited)
	if err != nil {
		return "", err
	}
	if !utf8.Valid(content) {
		content = bytes.ToValidUTF8(content, []byte("�"))
	}
	return string(content), nil
}

func decodeMIMEHeader(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	decoded, err := (&mime.WordDecoder{}).DecodeHeader(value)
	if err != nil {
		return value
	}
	return strings.TrimSpace(decoded)
}

func htmlToText(value string) string {
	tokenizer := xhtml.NewTokenizer(strings.NewReader(value))
	var output strings.Builder
	skipDepth := 0
	for {
		tokenType := tokenizer.Next()
		switch tokenType {
		case xhtml.ErrorToken:
			return normalizeWhitespace(html.UnescapeString(output.String()))
		case xhtml.StartTagToken:
			token := tokenizer.Token()
			if token.Data == "script" || token.Data == "style" {
				skipDepth++
			}
			if skipDepth == 0 && isBlockTag(token.Data) {
				output.WriteByte('\n')
			}
		case xhtml.EndTagToken:
			token := tokenizer.Token()
			if token.Data == "script" || token.Data == "style" {
				if skipDepth > 0 {
					skipDepth--
				}
				continue
			}
			if skipDepth == 0 && isBlockTag(token.Data) {
				output.WriteByte('\n')
			}
		case xhtml.TextToken:
			if skipDepth == 0 {
				output.Write(tokenizer.Text())
				output.WriteByte(' ')
			}
		}
	}
}

func isBlockTag(tag string) bool {
	switch tag {
	case "br", "p", "div", "li", "tr", "table", "section", "article", "header", "footer", "h1", "h2", "h3", "h4", "h5", "h6":
		return true
	default:
		return false
	}
}

func normalizeWhitespace(value string) string {
	lines := strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n")
	result := make([]string, 0, len(lines))
	for _, line := range lines {
		fields := strings.FieldsFunc(line, unicode.IsSpace)
		if len(fields) == 0 {
			continue
		}
		result = append(result, strings.Join(fields, " "))
	}
	return strings.Join(result, "\n")
}

func writeHeaderLine(output *strings.Builder, label, value string) {
	value = strings.TrimSpace(value)
	if value == "" {
		return
	}
	output.WriteString(label)
	output.WriteString("：")
	output.WriteString(value)
	output.WriteByte('\n')
}

func appendUnique(values []string, value string) []string {
	for _, current := range values {
		if current == value {
			return values
		}
	}
	return append(values, value)
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + "\n\n[邮件正文过长，已截断]"
}
