package store

import (
	"database/sql"
	"errors"
	"fmt"

	"vibetradez.com/internal/exec"
)

// ErrNoDecision is returned by GetDecision when no row matches.
var ErrNoDecision = errors.New("no decision found")

// InsertDecision creates the daily go/no-go row. Returns the new row's
// id. Fails (UNIQUE violation) if a decision already exists for
// trade_date, which is the schema-level guard against firing twice in a
// day.
func (s *Store) InsertDecision(d exec.Decision) (int, error) {
	var id int
	err := s.db.QueryRow(`
		INSERT INTO execution_decisions (
			trade_date, symbol, contract_type, strike_price, expiration,
			occ_symbol, contract_price, gpt_score, claude_score, trade_id,
			token_hash, decision, expires_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12)
		RETURNING id
	`, d.TradeDate, d.Symbol, d.ContractType, d.StrikePrice, d.Expiration,
		d.OCCSymbol, d.ContractPrice, d.GPTScore, d.ClaudeScore, nullableInt(d.TradeID),
		d.TokenHash, d.ExpiresAt).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("insert decision: %w", err)
	}
	return id, nil
}

// GetDecision loads a decision row by id.
func (s *Store) GetDecision(id int) (*exec.Decision, error) {
	var d exec.Decision
	var tradeID sql.NullInt64
	var decidedAt sql.NullTime
	err := s.db.QueryRow(`
		SELECT id, trade_date, symbol, contract_type, strike_price, expiration,
			occ_symbol, contract_price, gpt_score, claude_score, trade_id,
			token_hash, decision, decided_at, expires_at, created_at
		FROM execution_decisions WHERE id = $1
	`, id).Scan(&d.ID, &d.TradeDate, &d.Symbol, &d.ContractType, &d.StrikePrice, &d.Expiration,
		&d.OCCSymbol, &d.ContractPrice, &d.GPTScore, &d.ClaudeScore, &tradeID,
		&d.TokenHash, &d.Decision, &decidedAt, &d.ExpiresAt, &d.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNoDecision
	}
	if err != nil {
		return nil, fmt.Errorf("get decision: %w", err)
	}
	if tradeID.Valid {
		d.TradeID = int(tradeID.Int64)
	}
	if decidedAt.Valid {
		d.DecidedAt = &decidedAt.Time
	}
	return &d, nil
}

// SetDecisionStatus transitions a decision's status atomically. The
// transition fails (returns ErrDecisionNotPending) if the current value
// isn't 'pending' — this is the single-use enforcement: a token can only
// move a decision out of pending state once.
func (s *Store) SetDecisionStatus(id int, newStatus string) error {
	res, err := s.db.Exec(`
		UPDATE execution_decisions
		SET decision = $1, decided_at = NOW()
		WHERE id = $2 AND decision = 'pending'
	`, newStatus, id)
	if err != nil {
		return fmt.Errorf("update decision: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return ErrDecisionNotPending
	}
	return nil
}

// ErrDecisionNotPending is returned when a state transition is attempted
// on a decision that has already been decided.
var ErrDecisionNotPending = errors.New("decision is no longer pending")

// PendingDecisions returns all decisions still awaiting user action.
// Used by the auto-cancel cron to find decisions whose 5-minute window
// has elapsed.
func (s *Store) PendingDecisions() ([]exec.Decision, error) {
	rows, err := s.db.Query(`
		SELECT id, trade_date, symbol, contract_type, strike_price, expiration,
			occ_symbol, contract_price, gpt_score, claude_score,
			COALESCE(trade_id, 0), token_hash, decision, expires_at, created_at
		FROM execution_decisions
		WHERE decision = 'pending'
	`)
	if err != nil {
		return nil, fmt.Errorf("query pending decisions: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []exec.Decision
	for rows.Next() {
		var d exec.Decision
		if err := rows.Scan(&d.ID, &d.TradeDate, &d.Symbol, &d.ContractType, &d.StrikePrice, &d.Expiration,
			&d.OCCSymbol, &d.ContractPrice, &d.GPTScore, &d.ClaudeScore,
			&d.TradeID, &d.TokenHash, &d.Decision, &d.ExpiresAt, &d.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan pending decision: %w", err)
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// InsertExecution records an order submission (paper or live). Returns
// the new row id. The caller is responsible for setting Status correctly
// based on the trader's response.
func (s *Store) InsertExecution(e exec.Execution) (int, error) {
	var id int
	err := s.db.QueryRow(`
		INSERT INTO executions (
			decision_id, mode, side, schwab_order_id, status,
			fill_price, filled_quantity, requested_quantity,
			filled_at, error_message
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`, e.DecisionID, e.Mode, e.Side, e.SchwabOrderID, e.Status,
		e.FillPrice, e.FilledQuantity, e.RequestedQuantity,
		e.FilledAt, e.ErrorMessage).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("insert execution: %w", err)
	}
	return id, nil
}

// UpdateExecutionStatus updates fill state on an existing execution row.
// Used as orders progress from working → filled (or canceled / failed).
func (s *Store) UpdateExecutionStatus(id int, status string, fillPrice *float64, filledQty int, errMsg string) error {
	_, err := s.db.Exec(`
		UPDATE executions
		SET status = $1, fill_price = COALESCE($2, fill_price), filled_quantity = $3,
		    error_message = CASE WHEN $4 = '' THEN error_message ELSE $4 END,
		    filled_at = CASE WHEN $1 = 'filled' AND filled_at IS NULL THEN NOW() ELSE filled_at END
		WHERE id = $5
	`, status, fillPrice, filledQty, errMsg, id)
	if err != nil {
		return fmt.Errorf("update execution: %w", err)
	}
	return nil
}

// GetExecution loads one execution row by id.
func (s *Store) GetExecution(id int) (*exec.Execution, error) {
	var e exec.Execution
	var schwabOrderID sql.NullString
	var fillPrice sql.NullFloat64
	var filledAt sql.NullTime
	err := s.db.QueryRow(`
		SELECT id, decision_id, mode, side, schwab_order_id, status,
			fill_price, filled_quantity, requested_quantity,
			submitted_at, filled_at, error_message, created_at
		FROM executions WHERE id = $1
	`, id).Scan(&e.ID, &e.DecisionID, &e.Mode, &e.Side, &schwabOrderID, &e.Status,
		&fillPrice, &e.FilledQuantity, &e.RequestedQuantity,
		&e.SubmittedAt, &filledAt, &e.ErrorMessage, &e.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("no execution with id %d", id)
	}
	if err != nil {
		return nil, fmt.Errorf("get execution: %w", err)
	}
	if schwabOrderID.Valid {
		v := schwabOrderID.String
		e.SchwabOrderID = &v
	}
	if fillPrice.Valid {
		v := fillPrice.Float64
		e.FillPrice = &v
	}
	if filledAt.Valid {
		e.FilledAt = &filledAt.Time
	}
	return &e, nil
}

// OpenPositionsForDate returns decisions for the given trade_date that
// have a filled open execution but no filled close execution. Used by
// the 3:55pm cron to find what needs to be closed.
func (s *Store) OpenPositionsForDate(tradeDate string) ([]exec.Decision, error) {
	rows, err := s.db.Query(`
		SELECT d.id, d.trade_date, d.symbol, d.contract_type, d.strike_price, d.expiration,
			d.occ_symbol, d.contract_price, d.gpt_score, d.claude_score,
			COALESCE(d.trade_id, 0), d.token_hash, d.decision, d.expires_at, d.created_at
		FROM execution_decisions d
		WHERE d.trade_date = $1
		  AND d.decision = 'execute'
		  AND EXISTS (
			SELECT 1 FROM executions e
			WHERE e.decision_id = d.id AND e.side = 'open' AND e.status = 'filled'
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM executions e
			WHERE e.decision_id = d.id AND e.side = 'close' AND e.status = 'filled'
		  )
	`, tradeDate)
	if err != nil {
		return nil, fmt.Errorf("query open positions: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []exec.Decision
	for rows.Next() {
		var d exec.Decision
		if err := rows.Scan(&d.ID, &d.TradeDate, &d.Symbol, &d.ContractType, &d.StrikePrice, &d.Expiration,
			&d.OCCSymbol, &d.ContractPrice, &d.GPTScore, &d.ClaudeScore,
			&d.TradeID, &d.TokenHash, &d.Decision, &d.ExpiresAt, &d.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan open position: %w", err)
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// nullableInt converts a zero int to a SQL NULL so the trade_id FK is
// stored as NULL when the caller doesn't have a backing trade row yet.
func nullableInt(v int) any {
	if v == 0 {
		return nil
	}
	return v
}
