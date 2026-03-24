package store

import (
	"database/sql"
	"fmt"
	"time"

	"jaycetrades.com/internal/trades"

	_ "github.com/lib/pq"
)

type Store struct {
	db *sql.DB
}

type Subscriber struct {
	ID             int
	Email          string
	Name           string
	Active         bool
	CreatedAt      time.Time
	UnsubscribedAt *time.Time
}

func New(databaseURL string) (*Store, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	if err := migrate(db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &Store{db: db}, nil
}

func migrate(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS trades (
			id SERIAL PRIMARY KEY,
			date TEXT NOT NULL,
			symbol TEXT NOT NULL,
			contract_type TEXT NOT NULL,
			strike_price DOUBLE PRECISION NOT NULL,
			expiration TEXT NOT NULL,
			dte INTEGER NOT NULL,
			estimated_price DOUBLE PRECISION NOT NULL,
			thesis TEXT NOT NULL DEFAULT '',
			sentiment_score DOUBLE PRECISION NOT NULL DEFAULT 0,
			current_price DOUBLE PRECISION NOT NULL DEFAULT 0,
			target_price DOUBLE PRECISION NOT NULL DEFAULT 0,
			stop_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
			profit_target DOUBLE PRECISION NOT NULL DEFAULT 0,
			risk_level TEXT NOT NULL DEFAULT '',
			catalyst TEXT NOT NULL DEFAULT '',
			mention_count INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_trades_date ON trades(date);

		CREATE TABLE IF NOT EXISTS summaries (
			id SERIAL PRIMARY KEY,
			date TEXT NOT NULL,
			symbol TEXT NOT NULL,
			contract_type TEXT NOT NULL,
			strike_price DOUBLE PRECISION NOT NULL,
			expiration TEXT NOT NULL,
			entry_price DOUBLE PRECISION NOT NULL,
			closing_price DOUBLE PRECISION NOT NULL,
			stock_open DOUBLE PRECISION NOT NULL,
			stock_close DOUBLE PRECISION NOT NULL,
			notes TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ DEFAULT NOW()
		);

		CREATE INDEX IF NOT EXISTS idx_summaries_date ON summaries(date);

		CREATE TABLE IF NOT EXISTS subscribers (
			id SERIAL PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL DEFAULT '',
			active BOOLEAN NOT NULL DEFAULT true,
			created_at TIMESTAMPTZ DEFAULT NOW(),
			unsubscribed_at TIMESTAMPTZ
		);

		CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(active);
	`)
	return err
}

func (s *Store) Close() error {
	return s.db.Close()
}

// RemoveAllForTest clears all data — only for use in tests.
func (s *Store) RemoveAllForTest() {
	_, _ = s.db.Exec("DELETE FROM subscribers")
	_, _ = s.db.Exec("DELETE FROM trades")
	_, _ = s.db.Exec("DELETE FROM summaries")
}

// --- Subscriber methods ---

func (s *Store) AddSubscriber(email, name string) error {
	_, err := s.db.Exec(`
		INSERT INTO subscribers (email, name, active)
		VALUES ($1, $2, true)
		ON CONFLICT (email) DO UPDATE SET
			name = EXCLUDED.name,
			active = true,
			unsubscribed_at = NULL
	`, email, name)
	if err != nil {
		return fmt.Errorf("failed to add subscriber: %w", err)
	}
	return nil
}

func (s *Store) RemoveSubscriber(email string) error {
	result, err := s.db.Exec(`
		UPDATE subscribers SET active = false, unsubscribed_at = NOW()
		WHERE email = $1 AND active = true
	`, email)
	if err != nil {
		return fmt.Errorf("failed to remove subscriber: %w", err)
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("subscriber not found or already unsubscribed")
	}
	return nil
}

func (s *Store) GetActiveSubscribers() ([]Subscriber, error) {
	rows, err := s.db.Query(`
		SELECT id, email, name, active, created_at
		FROM subscribers WHERE active = true ORDER BY created_at
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query subscribers: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var result []Subscriber
	for rows.Next() {
		var sub Subscriber
		if err := rows.Scan(&sub.ID, &sub.Email, &sub.Name, &sub.Active, &sub.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan subscriber: %w", err)
		}
		result = append(result, sub)
	}
	return result, rows.Err()
}

func (s *Store) GetActiveEmails() ([]string, error) {
	subs, err := s.GetActiveSubscribers()
	if err != nil {
		return nil, err
	}
	emails := make([]string, len(subs))
	for i, sub := range subs {
		emails[i] = sub.Email
	}
	return emails, nil
}

// --- Trade methods ---

func (s *Store) SaveMorningTrades(date string, tradeList []trades.Trade) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec("DELETE FROM trades WHERE date = $1", date); err != nil {
		return fmt.Errorf("failed to clear existing trades: %w", err)
	}

	stmt, err := tx.Prepare(`
		INSERT INTO trades (
			date, symbol, contract_type, strike_price, expiration, dte,
			estimated_price, thesis, sentiment_score, current_price,
			target_price, stop_loss, profit_target, risk_level,
			catalyst, mention_count
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer func() { _ = stmt.Close() }()

	for _, t := range tradeList {
		_, err := stmt.Exec(
			date, t.Symbol, t.ContractType, t.StrikePrice, t.Expiration, t.DTE,
			t.EstimatedPrice, t.Thesis, t.SentimentScore, t.CurrentPrice,
			t.TargetPrice, t.StopLoss, t.ProfitTarget, t.RiskLevel,
			t.Catalyst, t.MentionCount,
		)
		if err != nil {
			return fmt.Errorf("failed to insert trade %s: %w", t.Symbol, err)
		}
	}

	return tx.Commit()
}

func (s *Store) GetMorningTrades(date string) ([]trades.Trade, error) {
	rows, err := s.db.Query(`
		SELECT symbol, contract_type, strike_price, expiration, dte,
			estimated_price, thesis, sentiment_score, current_price,
			target_price, stop_loss, profit_target, risk_level,
			catalyst, mention_count
		FROM trades WHERE date = $1 ORDER BY id
	`, date)
	if err != nil {
		return nil, fmt.Errorf("failed to query trades: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var result []trades.Trade
	for rows.Next() {
		var t trades.Trade
		err := rows.Scan(
			&t.Symbol, &t.ContractType, &t.StrikePrice, &t.Expiration, &t.DTE,
			&t.EstimatedPrice, &t.Thesis, &t.SentimentScore, &t.CurrentPrice,
			&t.TargetPrice, &t.StopLoss, &t.ProfitTarget, &t.RiskLevel,
			&t.Catalyst, &t.MentionCount,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan trade row: %w", err)
		}
		result = append(result, t)
	}

	return result, rows.Err()
}

func (s *Store) SaveEODSummaries(date string, summaryList []trades.TradeSummary) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.Exec("DELETE FROM summaries WHERE date = $1", date); err != nil {
		return fmt.Errorf("failed to clear existing summaries: %w", err)
	}

	stmt, err := tx.Prepare(`
		INSERT INTO summaries (
			date, symbol, contract_type, strike_price, expiration,
			entry_price, closing_price, stock_open, stock_close, notes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer func() { _ = stmt.Close() }()

	for _, s := range summaryList {
		_, err := stmt.Exec(
			date, s.Symbol, s.ContractType, s.StrikePrice, s.Expiration,
			s.EntryPrice, s.ClosingPrice, s.StockOpen, s.StockClose, s.Notes,
		)
		if err != nil {
			return fmt.Errorf("failed to insert summary %s: %w", s.Symbol, err)
		}
	}

	return tx.Commit()
}

func (s *Store) GetEODSummaries(date string) ([]trades.TradeSummary, error) {
	rows, err := s.db.Query(`
		SELECT symbol, contract_type, strike_price, expiration,
			entry_price, closing_price, stock_open, stock_close, notes
		FROM summaries WHERE date = $1 ORDER BY id
	`, date)
	if err != nil {
		return nil, fmt.Errorf("failed to query summaries: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var result []trades.TradeSummary
	for rows.Next() {
		var s trades.TradeSummary
		err := rows.Scan(
			&s.Symbol, &s.ContractType, &s.StrikePrice, &s.Expiration,
			&s.EntryPrice, &s.ClosingPrice, &s.StockOpen, &s.StockClose, &s.Notes,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan summary row: %w", err)
		}
		result = append(result, s)
	}

	return result, rows.Err()
}
