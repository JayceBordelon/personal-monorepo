package server

import (
	"crypto/subtle"
	"log"
	"net/http"
	"net/url"

	"golang.org/x/crypto/bcrypt"
)

/*
handleAuthorize is the entry point for consumer apps. Expected query:

		GET /oauth/authorize?client_id=X&redirect_uri=Y&state=Z

	  - Validates client_id + redirect_uri against oauth_clients
	  - If the user has a valid IdP cookie, mints a one-shot auth code and
	    redirects to redirect_uri?code=...&state=...
	  - If no IdP cookie, kicks off the Google flow with the consumer request
	    stashed, so the callback can resume + mint the code.
*/
func (s *Server) handleAuthorize(w http.ResponseWriter, r *http.Request) {
	clientID := r.URL.Query().Get("client_id")
	redirectURI := r.URL.Query().Get("redirect_uri")
	consumerState := r.URL.Query().Get("state")

	if clientID == "" || redirectURI == "" {
		http.Error(w, "client_id and redirect_uri are required", http.StatusBadRequest)
		return
	}

	client, err := s.db.GetClient(clientID)
	if err != nil {
		log.Printf("handleAuthorize: get client: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if client == nil {
		http.Error(w, "unknown client_id", http.StatusBadRequest)
		return
	}
	if !allowedRedirect(client.RedirectURIs, redirectURI) {
		http.Error(w, "redirect_uri not allowed for this client", http.StatusBadRequest)
		return
	}

	user := s.currentIdPUser(r)
	if user == nil {
		s.startGoogleFlow(w, r, clientID, redirectURI, consumerState, "/")
		return
	}
	s.issueAuthCodeRedirect(w, r, user.ID, clientID, redirectURI, consumerState)
}

/*
issueAuthCodeRedirect mints a one-shot auth code, stores its hash, and
redirects the browser back to the consumer app with ?code=...&state=....
*/
func (s *Server) issueAuthCodeRedirect(w http.ResponseWriter, r *http.Request, userID int64, clientID, redirectURI, consumerState string) {
	code, err := randomToken(32)
	if err != nil {
		log.Printf("issueAuthCode: random: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.db.CreateAuthCode(sha256Hash(code), userID, clientID, redirectURI, s.authCodeTTL); err != nil {
		log.Printf("issueAuthCode: create: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	u, err := url.Parse(redirectURI)
	if err != nil {
		http.Error(w, "invalid redirect_uri", http.StatusBadRequest)
		return
	}
	q := u.Query()
	q.Set("code", code)
	if consumerState != "" {
		q.Set("state", consumerState)
	}
	u.RawQuery = q.Encode()
	http.Redirect(w, r, u.String(), http.StatusFound)
}

/*
handleToken exchanges a one-shot auth code for an opaque access token.
Form fields: code, client_id, client_secret, redirect_uri.
*/
func (s *Server) handleToken(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	code := r.PostFormValue("code")
	clientID := r.PostFormValue("client_id")
	clientSecret := r.PostFormValue("client_secret")
	redirectURI := r.PostFormValue("redirect_uri")

	if code == "" || clientID == "" || clientSecret == "" || redirectURI == "" {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}

	client, err := s.db.GetClient(clientID)
	if err != nil {
		log.Printf("handleToken: get client: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if client == nil {
		http.Error(w, "invalid client", http.StatusUnauthorized)
		return
	}
	if err := bcrypt.CompareHashAndPassword(client.ClientSecretHash, []byte(clientSecret)); err != nil {
		http.Error(w, "invalid client credentials", http.StatusUnauthorized)
		return
	}

	ac, err := s.db.ConsumeAuthCode(sha256Hash(code))
	if err != nil {
		http.Error(w, "invalid or expired code", http.StatusBadRequest)
		return
	}
	if ac.ClientID != clientID {
		http.Error(w, "code was issued to a different client", http.StatusBadRequest)
		return
	}
	if subtle.ConstantTimeCompare([]byte(ac.RedirectURI), []byte(redirectURI)) != 1 {
		http.Error(w, "redirect_uri mismatch", http.StatusBadRequest)
		return
	}

	accessToken, err := randomToken(32)
	if err != nil {
		log.Printf("handleToken: random: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if err := s.db.CreateSession(ac.UserID, clientID, sha256Hash(accessToken), r.UserAgent(), clientIP(r), s.accessTokenTTL); err != nil {
		log.Printf("handleToken: create session: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	user, err := s.db.GetUser(ac.UserID)
	if err != nil || user == nil {
		log.Printf("handleToken: load user: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"access_token": accessToken,
		"token_type":   "Bearer",
		"expires_in":   int(s.accessTokenTTL.Seconds()),
		"user": map[string]any{
			"id":          user.ID,
			"email":       user.Email,
			"name":        user.Name,
			"picture_url": user.PictureURL,
		},
	})
}

/*
handleVerify is the introspection endpoint. Consumers call it on every
request (with a short in-memory cache) to validate the opaque access
token they hold. Authorization: Bearer <token>.
*/
func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	token := bearerToken(r)
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"active": false})
		return
	}
	sess, err := s.db.LookupSession(sha256Hash(token))
	if err != nil {
		log.Printf("handleVerify: lookup: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]any{"active": false})
		return
	}
	if sess == nil || !sess.ClientID.Valid {
		/*
		Active only if this is a session issued to a specific client
		(access token), not an IdP browser cookie.
		*/
		writeJSON(w, http.StatusUnauthorized, map[string]any{"active": false})
		return
	}
	_ = s.db.TouchSession(sess.ID)
	writeJSON(w, http.StatusOK, map[string]any{
		"active":    true,
		"client_id": sess.ClientID.String,
		"user": map[string]any{
			"id":          sess.User.ID,
			"email":       sess.User.Email,
			"name":        sess.User.Name,
			"picture_url": sess.User.PictureURL,
		},
	})
}

/*
handleRevoke revokes the session identified by the bearer token.
Used when a consumer app's user clicks Sign out.
*/
func (s *Server) handleRevoke(w http.ResponseWriter, r *http.Request) {
	token := bearerToken(r)
	if token == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"ok": false})
		return
	}
	sess, err := s.db.LookupSession(sha256Hash(token))
	if err != nil || sess == nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	if err := s.db.RevokeSession(sess.ID); err != nil {
		log.Printf("handleRevoke: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]any{"ok": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func bearerToken(r *http.Request) string {
	h := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(h) < len(prefix) || h[:len(prefix)] != prefix {
		return ""
	}
	return h[len(prefix):]
}

func allowedRedirect(allowed []string, candidate string) bool {
	for _, a := range allowed {
		if a == candidate {
			return true
		}
	}
	return false
}
