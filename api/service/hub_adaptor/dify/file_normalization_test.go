package dify

import (
	"strings"
	"testing"

	db_model "github.com/53AI/53AIHub/model"
)

func TestPrepareDIFYUploadNormalizesEML(t *testing.T) {
	eml := strings.Join([]string{
		"From: sender@example.com",
		"To: receiver@example.com",
		"Subject: Test mail",
		"MIME-Version: 1.0",
		`Content-Type: multipart/mixed; boundary="boundary"`,
		"",
		"--boundary",
		`Content-Type: text/plain; charset="utf-8"`,
		"Content-Transfer-Encoding: quoted-printable",
		"",
		"Please finish the review by Friday.",
		"--boundary",
		`Content-Type: application/octet-stream; name="secret.bin"`,
		`Content-Disposition: attachment; filename="secret.bin"`,
		"Content-Transfer-Encoding: base64",
		"",
		"U0VDUkVUX0FUVEFDSE1FTlRfQ09OVEVOVA==",
		"--boundary--",
	}, "\r\n")
	uploadFile := &db_model.UploadFile{
		FileName:  "message.eml",
		Extension: ".eml",
		MimeType:  "message/rfc822",
	}

	payload, err := prepareDIFYUpload(uploadFile, []byte(eml))
	if err != nil {
		t.Fatalf("prepareDIFYUpload() error = %v", err)
	}
	text := string(payload.Content)
	if !payload.Normalized {
		t.Fatal("expected EML payload to be normalized")
	}
	if payload.FileName != "message.eml.txt" {
		t.Fatalf("FileName = %q", payload.FileName)
	}
	if payload.MimeType != "text/plain; charset=utf-8" {
		t.Fatalf("MimeType = %q", payload.MimeType)
	}
	for _, expected := range []string{
		"原始文件名：message.eml",
		"主题：Test mail",
		"发件人：sender@example.com",
		"Please finish the review by Friday.",
		"附件：",
		"secret.bin",
	} {
		if !strings.Contains(text, expected) {
			t.Fatalf("normalized EML missing %q:\n%s", expected, text)
		}
	}
	if strings.Contains(text, "SECRET_ATTACHMENT_CONTENT") {
		t.Fatal("attachment body must not be included")
	}
}

func TestPrepareDIFYUploadLeavesOtherFilesUntouched(t *testing.T) {
	uploadFile := &db_model.UploadFile{
		FileName:  "notes.txt",
		Extension: "txt",
		MimeType:  "text/plain",
	}
	content := []byte("hello")

	payload, err := prepareDIFYUpload(uploadFile, content)
	if err != nil {
		t.Fatalf("prepareDIFYUpload() error = %v", err)
	}
	if payload.Normalized {
		t.Fatal("TXT must not be normalized")
	}
	if string(payload.Content) != "hello" || payload.FileName != "notes.txt" {
		t.Fatalf("unexpected payload: %+v", payload)
	}
}

func TestShouldRefreshDIFYFileMappingForLegacyEML(t *testing.T) {
	uploadFile := &db_model.UploadFile{FileName: "message.eml", Extension: "eml"}
	legacy := &db_model.ChannelFileMapping{ApiResponse: `{"id":"old"}`}
	normalized := &db_model.ChannelFileMapping{ApiResponse: `{"id":"new","source_normalized":true}`}

	if !shouldRefreshDIFYFileMapping(uploadFile, legacy) {
		t.Fatal("legacy EML mapping must be refreshed")
	}
	if shouldRefreshDIFYFileMapping(uploadFile, normalized) {
		t.Fatal("normalized EML mapping must be reused")
	}
}
