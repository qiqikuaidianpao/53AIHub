package dify

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type errorAfterDataReadCloser struct {
	data   []byte
	sent   bool
	closed bool
}

func (r *errorAfterDataReadCloser) Read(p []byte) (int, error) {
	if !r.sent {
		r.sent = true
		return copy(p, r.data), nil
	}
	return 0, errors.New("context deadline exceeded while reading response body")
}

func (r *errorAfterDataReadCloser) Close() error {
	r.closed = true
	return nil
}

func TestStreamHandlerReturnsReadErrorAndPreservesPartialText(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	body := &errorAfterDataReadCloser{
		data: []byte("data:{\"event\":\"message\",\"conversation_id\":\"conv-1\",\"answer\":\"partial\"}\n"),
	}
	resp := &http.Response{Body: body, StatusCode: http.StatusOK}

	err, text, conversationID := StreamHandler(ctx, resp)

	if err == nil {
		t.Fatal("expected stream read error")
	}
	if err.StatusCode != http.StatusGatewayTimeout {
		t.Fatalf("status code = %d", err.StatusCode)
	}
	if text == nil || !strings.Contains(*text, "partial") {
		t.Fatalf("partial response was not preserved: %v", text)
	}
	if !strings.Contains(*text, "超过系统等待上限") {
		t.Fatalf("timeout guidance missing: %q", *text)
	}
	if conversationID != "conv-1" {
		t.Fatalf("conversation id = %q", conversationID)
	}
	if !body.closed {
		t.Fatal("response body was not closed")
	}
}

var _ io.ReadCloser = (*errorAfterDataReadCloser)(nil)
