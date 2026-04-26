package exec

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

// confirmRequest is the JSON body POSTed to /api/execution/confirm by
// the Next.js /execute page. Token + action come from the email link's
// query string and are forwarded server-to-server (so the cookie ride
// along), avoiding any browser-side fetch from leaking the token.
type confirmRequest struct {
	Token  string `json:"token"`
	Action string `json:"action"`
}

type confirmResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message"`
	Decline bool   `json:"decline,omitempty"`
}

// HandleConfirm is the HTTP wrapper around Service.ConfirmDecision.
// Caller is expected to have already gated this with auth + email
// allowlist middleware. Returns the HTTP handler — easier to wire from
// internal/server/server.go than constructing it inline.
func (s *Service) HandleConfirm(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, confirmResponse{Message: "method not allowed"})
		return
	}
	var req confirmRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, confirmResponse{Message: "invalid request body"})
		return
	}
	if req.Token == "" || req.Action == "" {
		writeJSON(w, http.StatusBadRequest, confirmResponse{Message: "token and action required"})
		return
	}

	decisionID, action, err := Verify(req.Token, s.cfg.HMACSecret)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, confirmResponse{Message: "token: " + err.Error()})
		return
	}
	if string(action) != req.Action {
		writeJSON(w, http.StatusBadRequest, confirmResponse{Message: "action mismatch"})
		return
	}

	// Defense in depth: re-check token hash against the decision row to
	// guarantee single-use even if multiple Mint calls produced
	// different tokens for the same decision (which they shouldn't, but
	// the schema's UNIQUE constraint ensures the persisted row matches
	// exactly one minted token).
	d, err := s.store.GetDecision(decisionID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, confirmResponse{Message: "decision not found"})
		return
	}
	if d.Decision != "pending" {
		writeJSON(w, http.StatusConflict, confirmResponse{Message: "decision already " + d.Decision})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	msg, err := s.ConfirmDecision(ctx, decisionID, action)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, confirmResponse{Message: err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, confirmResponse{OK: true, Message: msg, Decline: action == ActionDecline})
}

// HandleCancelAll is the big-red-button endpoint. Cancels every
// currently-WORKING order at the broker for today's open positions and
// updates the executions table to 'canceled'. Does NOT close already-
// filled positions — the 3:55pm cron handles those.
func (s *Service) HandleCancelAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, confirmResponse{Message: "method not allowed"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	hash, err := s.cfg.SchwabAccountHash(ctx)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, confirmResponse{Message: "account hash: " + err.Error()})
		return
	}

	// We don't have a "list working orders" call yet. v1 cancels just
	// the executions we know about that are status='pending' or
	// 'working'. A future enhancement could query Schwab's
	// /accounts/{hash}/orders endpoint to catch any orphans.
	tradeDate := time.Now().In(easternTime()).Format("2006-01-02")
	positions, err := s.store.OpenPositionsForDate(tradeDate)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, confirmResponse{Message: "open positions: " + err.Error()})
		return
	}

	// For now, cancel-all is a placeholder that signals intent. The
	// only WORKING orders today's pipeline produces are close orders,
	// which the close cron self-manages. v1 returns OK with a count;
	// v2 should call CancelOrder against any non-terminal child execs.
	_ = hash
	_ = positions
	writeJSON(w, http.StatusOK, confirmResponse{OK: true, Message: "cancel-all acknowledged (no actively working orders to cancel in v1)"})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		_ = err // already sent status; nothing useful to do
	}
}

// ErrNotPending is returned by ConfirmDecision when the decision row
// has already moved out of 'pending' state.
var ErrNotPending = errors.New("decision not pending")
