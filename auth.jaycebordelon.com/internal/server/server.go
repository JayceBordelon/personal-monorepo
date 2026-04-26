package server

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"auth.jaycebordelon.com/internal/google"
	"auth.jaycebordelon.com/internal/store"
)

type Server struct {
	db             *store.Store
	google         *google.Client
	idpCookieName  string
	idpCookieTTL   time.Duration
	authCodeTTL    time.Duration
	accessTokenTTL time.Duration
	port           string
}

type Options struct {
	Port           string
	Google         *google.Client
	IdPCookieName  string
	IdPCookieTTL   time.Duration
	AuthCodeTTL    time.Duration
	AccessTokenTTL time.Duration
}

func New(db *store.Store, opts Options) *Server {
	return &Server{
		db:             db,
		google:         opts.Google,
		idpCookieName:  opts.IdPCookieName,
		idpCookieTTL:   opts.IdPCookieTTL,
		authCodeTTL:    opts.AuthCodeTTL,
		accessTokenTTL: opts.AccessTokenTTL,
		port:           opts.Port,
	}
}

func (s *Server) Start() error {
	mux := s.routes()
	log.Printf("auth server listening on :%s", s.port)
	return http.ListenAndServe(":"+s.port, mux)
}

func (s *Server) routes() *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", s.handleHealth)

	// IdP Google flow
	mux.HandleFunc("GET /auth/google", s.handleGoogleLogin)
	mux.HandleFunc("GET /auth/google/callback", s.handleGoogleCallback)

	// Consumer OAuth flow
	mux.HandleFunc("GET /oauth/authorize", s.handleAuthorize)
	mux.HandleFunc("POST /oauth/token", s.handleToken)
	mux.HandleFunc("GET /oauth/verify", s.handleVerify)
	mux.HandleFunc("POST /oauth/revoke", s.handleRevoke)

	/*
	IdP session introspection (for users viewing auth.jaycebordelon.com
	directly, or for auth service's own landing page if ever built).
	*/
	mux.HandleFunc("GET /api/me", s.handleMe)
	mux.HandleFunc("POST /auth/logout", s.handleLogout)

	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	if err := s.db.Ping(); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func randomToken(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func sha256Hash(s string) []byte {
	h := sha256.Sum256([]byte(s))
	return h[:]
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.Index(xff, ","); i > 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	addr := r.RemoteAddr
	if i := strings.LastIndex(addr, ":"); i > 0 {
		return addr[:i]
	}
	return addr
}

/*
setSessionCookie sets a host-scoped cookie on auth.jaycebordelon.com for
the IdP session. No Domain attribute so it's NOT shared across subdomains,
which is the correct scope (each consumer app gets its own cookie on its
own domain).
*/
func (s *Server) setSessionCookie(w http.ResponseWriter, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.idpCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   int(s.idpCookieTTL.Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.idpCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}
