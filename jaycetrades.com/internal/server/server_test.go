package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"jaycetrades.com/internal/store"
)

const testDatabaseURL = "postgresql://jaycebordelon@localhost:5432/jaycetrades_test?sslmode=disable"

func setupTestServer(t *testing.T) *Server {
	t.Helper()
	db, err := store.New(testDatabaseURL)
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	db.RemoveAllForTest()

	return New(db, "0")
}

func TestSubscribeEndpoint(t *testing.T) {
	srv := setupTestServer(t)

	body, _ := json.Marshal(subscribeRequest{Email: "api@test.com", Name: "API User"})
	req := httptest.NewRequest(http.MethodPost, "/api/subscribe", bytes.NewReader(body))
	w := httptest.NewRecorder()

	srv.mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp apiResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !resp.OK {
		t.Fatalf("expected ok=true, got: %+v", resp)
	}
}

func TestSubscribeInvalidEmail(t *testing.T) {
	srv := setupTestServer(t)

	body, _ := json.Marshal(subscribeRequest{Email: "notanemail", Name: "Bad"})
	req := httptest.NewRequest(http.MethodPost, "/api/subscribe", bytes.NewReader(body))
	w := httptest.NewRecorder()

	srv.mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}

func TestSubscribeMethodNotAllowed(t *testing.T) {
	srv := setupTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/api/subscribe", nil)
	w := httptest.NewRecorder()

	srv.mux.ServeHTTP(w, req)

	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", w.Code)
	}
}

func TestUnsubscribeEndpoint(t *testing.T) {
	srv := setupTestServer(t)

	// First subscribe
	body, _ := json.Marshal(subscribeRequest{Email: "unsub@test.com", Name: "Unsub"})
	req := httptest.NewRequest(http.MethodPost, "/api/subscribe", bytes.NewReader(body))
	w := httptest.NewRecorder()
	srv.mux.ServeHTTP(w, req)

	// Then unsubscribe
	body, _ = json.Marshal(unsubscribeRequest{Email: "unsub@test.com"})
	req = httptest.NewRequest(http.MethodPost, "/api/unsubscribe", bytes.NewReader(body))
	w = httptest.NewRecorder()
	srv.mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
}

func TestUnsubscribeNotFound(t *testing.T) {
	srv := setupTestServer(t)

	body, _ := json.Marshal(unsubscribeRequest{Email: "ghost@test.com"})
	req := httptest.NewRequest(http.MethodPost, "/api/unsubscribe", bytes.NewReader(body))
	w := httptest.NewRecorder()

	srv.mux.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", w.Code)
	}
}

func TestIndexPage(t *testing.T) {
	srv := setupTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	w := httptest.NewRecorder()

	srv.mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	contentType := w.Header().Get("Content-Type")
	if contentType != "text/html; charset=utf-8" {
		t.Fatalf("expected text/html content type, got %s", contentType)
	}
	body := w.Body.String()
	if len(body) < 100 {
		t.Fatal("page body too short")
	}
}

func TestHealthEndpoint(t *testing.T) {
	srv := setupTestServer(t)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	srv.mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}
