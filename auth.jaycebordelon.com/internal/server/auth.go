package server

import (
	"context"
	"crypto/subtle"
	"log"
	"net/http"
	"strings"
	"time"
)

const (
	oauthStateCookie = "aj_oauth_state"
	oauthStateTTL    = 10 * time.Minute
)

/*
handleGoogleLogin kicks off a plain IdP sign-in (no consumer app attached).
Used when a user lands on auth.jaycebordelon.com directly or when a consumer
flow bounces through to pick up a new Google token.
*/
func (s *Server) handleGoogleLogin(w http.ResponseWriter, r *http.Request) {
	returnTo := r.URL.Query().Get("return_to")
	if !isSafeReturnTo(returnTo) {
		returnTo = "/"
	}
	s.startGoogleFlow(w, r, "", "", "", returnTo)
}

/*
startGoogleFlow generates CSRF state, stashes any in-flight consumer
authorize request, sets the double-submit cookie, and redirects to Google.
clientID / redirectURI / consumerState are empty for plain IdP sign-in.
*/
func (s *Server) startGoogleFlow(w http.ResponseWriter, r *http.Request, clientID, redirectURI, consumerState, returnTo string) {
	state, err := randomToken(32)
	if err != nil {
		log.Printf("startGoogleFlow: random: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.db.CreateOAuthState(state, clientID, redirectURI, consumerState, returnTo, oauthStateTTL); err != nil {
		log.Printf("startGoogleFlow: create state: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    state,
		Path:     "/",
		MaxAge:   int(oauthStateTTL.Seconds()),
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, s.google.AuthURL(state), http.StatusFound)
}

func (s *Server) handleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" || state == "" {
		http.Error(w, "missing code or state", http.StatusBadRequest)
		return
	}

	cookie, err := r.Cookie(oauthStateCookie)
	if err != nil || cookie.Value == "" {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}
	if subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(state)) != 1 {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}

	stash, err := s.db.ConsumeOAuthState(state)
	if err != nil {
		http.Error(w, "invalid or expired state", http.StatusBadRequest)
		return
	}

	clearOAuthStateCookie(w)

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	info, err := s.google.Exchange(ctx, code)
	if err != nil {
		log.Printf("handleGoogleCallback: exchange: %v", err)
		http.Error(w, "OAuth exchange failed", http.StatusInternalServerError)
		return
	}
	if !info.EmailVerified {
		http.Redirect(w, r, "/?auth_error=email_unverified", http.StatusFound)
		return
	}

	email := strings.ToLower(strings.TrimSpace(info.Email))
	if email == "" {
		http.Error(w, "Google returned no email", http.StatusBadRequest)
		return
	}

	userID, err := s.db.UpsertUser(info.Sub, email, info.EmailVerified, info.Name, info.Picture)
	if err != nil {
		log.Printf("handleGoogleCallback: upsert user: %v", err)
		http.Error(w, "failed to create user", http.StatusInternalServerError)
		return
	}

	/*
	Mint an IdP session cookie on auth.jaycebordelon.com so subsequent
	authorize requests (possibly from a different consumer app) don't need
	to re-prompt Google.
	*/
	token, err := randomToken(32)
	if err != nil {
		log.Printf("handleGoogleCallback: random token: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.db.CreateSession(userID, "", sha256Hash(token), r.UserAgent(), clientIP(r), s.idpCookieTTL); err != nil {
		log.Printf("handleGoogleCallback: create session: %v", err)
		http.Error(w, "failed to create session", http.StatusInternalServerError)
		return
	}
	s.setSessionCookie(w, token)

	/*
	If this callback was the tail of a consumer authorize flow, resume it
	by minting an auth code and redirecting back to the consumer.
	*/
	if stash.ClientID != "" && stash.RedirectURI != "" {
		s.issueAuthCodeRedirect(w, r, userID, stash.ClientID, stash.RedirectURI, stash.ConsumerState)
		return
	}

	returnTo := stash.ReturnTo
	if !isSafeReturnTo(returnTo) {
		returnTo = "/"
	}
	log.Printf("IdP sign-in: user_id=%d email=%s", userID, email)
	http.Redirect(w, r, returnTo, http.StatusFound)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(s.idpCookieName); err == nil && c.Value != "" {
		if sess, err := s.db.LookupSession(sha256Hash(c.Value)); err == nil && sess != nil {
			if err := s.db.RevokeSession(sess.ID); err != nil {
				log.Printf("handleLogout: revoke: %v", err)
			}
		}
	}
	s.clearSessionCookie(w)
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	u := s.currentIdPUser(r)
	if u == nil {
		writeJSON(w, http.StatusOK, map[string]any{"user": nil})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": map[string]any{
		"id":          u.ID,
		"email":       u.Email,
		"name":        u.Name,
		"picture_url": u.PictureURL,
	}})
}

/*
currentIdPUser returns the user attached to the auth.jaycebordelon.com IdP
cookie, or nil if none.
*/
func (s *Server) currentIdPUser(r *http.Request) *idPUser {
	c, err := r.Cookie(s.idpCookieName)
	if err != nil || c.Value == "" {
		return nil
	}
	sess, err := s.db.LookupSession(sha256Hash(c.Value))
	if err != nil || sess == nil {
		return nil
	}
	/*
	Only IdP cookies (NULL client_id) count here — access tokens issued to
	consumer apps live in the same sessions table but aren't valid as the
	auth.jaycebordelon.com browser cookie.
	*/
	if sess.ClientID.Valid {
		return nil
	}
	_ = s.db.TouchSession(sess.ID)
	return &idPUser{
		ID:         sess.User.ID,
		Email:      sess.User.Email,
		Name:       sess.User.Name,
		PictureURL: sess.User.PictureURL,
	}
}

type idPUser struct {
	ID         int64
	Email      string
	Name       string
	PictureURL string
}

func clearOAuthStateCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	})
}

func isSafeReturnTo(p string) bool {
	if p == "" {
		return false
	}
	if !strings.HasPrefix(p, "/") {
		return false
	}
	if strings.HasPrefix(p, "//") {
		return false
	}
	if strings.Contains(p, "\\") {
		return false
	}
	return true
}
