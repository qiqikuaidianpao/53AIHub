package custom

import (
	"net/http"
	"testing"
	"time"
)

func TestCloneHTTPClientWithTimeoutDoesNotMutateBase(t *testing.T) {
	transport := &http.Transport{}
	base := &http.Client{
		Transport: transport,
		Timeout:   2 * time.Minute,
	}

	cloned := cloneHTTPClientWithTimeout(base, 10*time.Minute)

	if cloned == base {
		t.Fatal("expected a cloned client")
	}
	if cloned.Timeout != 10*time.Minute {
		t.Fatalf("cloned timeout = %s", cloned.Timeout)
	}
	if cloned.Transport != transport {
		t.Fatal("transport must be preserved")
	}
	if base.Timeout != 2*time.Minute {
		t.Fatalf("base timeout was mutated: %s", base.Timeout)
	}
}
