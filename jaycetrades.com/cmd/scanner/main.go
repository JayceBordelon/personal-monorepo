package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"jaycetrades.com/internal/config"
	"jaycetrades.com/internal/email"
	"jaycetrades.com/internal/sentiment"
	"jaycetrades.com/internal/server"
	"jaycetrades.com/internal/store"
	"jaycetrades.com/internal/templates"
	"jaycetrades.com/internal/trades"

	"github.com/robfig/cron/v3"
)

// US Market Holidays (NYSE/NASDAQ closed)
var marketHolidays = map[string]string{
	// 2025
	"2025-01-01": "New Year's Day",
	"2025-01-20": "MLK Day",
	"2025-02-17": "Presidents Day",
	"2025-04-18": "Good Friday",
	"2025-05-26": "Memorial Day",
	"2025-06-19": "Juneteenth",
	"2025-07-04": "Independence Day",
	"2025-09-01": "Labor Day",
	"2025-11-27": "Thanksgiving",
	"2025-12-25": "Christmas",
	// 2026
	"2026-01-01": "New Year's Day",
	"2026-01-19": "MLK Day",
	"2026-02-16": "Presidents Day",
	"2026-04-03": "Good Friday",
	"2026-05-25": "Memorial Day",
	"2026-06-19": "Juneteenth",
	"2026-07-03": "Independence Day (Observed)",
	"2026-09-07": "Labor Day",
	"2026-11-26": "Thanksgiving",
	"2026-12-25": "Christmas",
}

func isMarketOpen() (bool, string) {
	loc, _ := time.LoadLocation("America/New_York")
	now := time.Now().In(loc)
	today := now.Format("2006-01-02")

	// Check for holiday
	if holiday, exists := marketHolidays[today]; exists {
		return false, holiday
	}

	// Check for weekend (should already be handled by cron, but double-check)
	if now.Weekday() == time.Saturday || now.Weekday() == time.Sunday {
		return false, "Weekend"
	}

	return true, ""
}

func todayDate() string {
	loc, _ := time.LoadLocation("America/New_York")
	return time.Now().In(loc).Format("2006-01-02")
}

func main() {
	cfg := config.Load()

	if cfg.ResendAPIKey == "" {
		log.Fatal("RESEND_API_KEY is required")
	}
	if cfg.OpenAIAPIKey == "" {
		log.Fatal("OPENAI_API_KEY is required")
	}

	db, err := store.New(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer func() { _ = db.Close() }()

	// Seed subscribers from EMAIL_RECIPIENTS env var (for backward compatibility)
	if len(cfg.EmailRecipients) > 0 {
		for _, email := range cfg.EmailRecipients {
			if err := db.AddSubscriber(email, ""); err != nil {
				log.Printf("Warning: failed to seed subscriber %s: %v", email, err)
			}
		}
		log.Printf("Seeded %d subscribers from EMAIL_RECIPIENTS", len(cfg.EmailRecipients))
	}

	scraper := sentiment.NewScraper()
	analyzer := trades.NewAnalyzer(cfg.OpenAIAPIKey)
	emailClient := email.NewClient(cfg.ResendAPIKey)

	openJob := func() {
		if open, reason := isMarketOpen(); !open {
			log.Printf("Skipping morning analysis: Market closed (%s)", reason)
			return
		}
		runTradeAnalysis(cfg, db, scraper, analyzer, emailClient)
	}

	closeJob := func() {
		if open, reason := isMarketOpen(); !open {
			log.Printf("Skipping EOD summary: Market closed (%s)", reason)
			return
		}
		runEndOfDayAnalysis(cfg, db, analyzer, emailClient)
	}

	loc, err := time.LoadLocation("America/New_York")
	if err != nil {
		log.Fatalf("Failed to load timezone: %v", err)
	}

	c := cron.New(cron.WithLocation(loc))

	_, err = c.AddFunc(cfg.CronScheduleOpen, openJob)
	if err != nil {
		log.Fatalf("Failed to add market open cron job: %v", err)
	}

	_, err = c.AddFunc(cfg.CronScheduleClose, closeJob)
	if err != nil {
		log.Fatalf("Failed to add market close cron job: %v", err)
	}

	c.Start()

	// Start HTTP API server in background
	srv := server.New(db, cfg.ServerPort)
	go srv.Start()

	log.Printf("Options trade scanner started")
	log.Printf("Database: PostgreSQL")
	log.Printf("API server: :%s", cfg.ServerPort)
	log.Printf("Market open schedule: %s (ET)", cfg.CronScheduleOpen)
	log.Printf("Market close schedule: %s (ET)", cfg.CronScheduleClose)

	// Log current subscriber count
	if subs, err := db.GetActiveSubscribers(); err == nil {
		log.Printf("Active subscribers: %d", len(subs))
	}

	// Run immediately on startup if RUN_ON_START is set
	if os.Getenv("RUN_ON_START") == "true" {
		log.Println("Running initial analysis...")
		openJob()
	}

	// Wait for shutdown signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	c.Stop()
}

func getRecipients(db *store.Store) []string {
	emails, err := db.GetActiveEmails()
	if err != nil {
		log.Printf("Error getting subscribers: %v", err)
		return nil
	}
	return emails
}

func runTradeAnalysis(cfg *config.Config, db *store.Store, scraper *sentiment.Scraper, analyzer *trades.Analyzer, emailClient *email.Client) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	log.Println("Starting trade analysis...")

	// Get sentiment data from WSB
	log.Println("Scraping WSB sentiment...")
	sentimentData, err := scraper.GetTrendingTickers(ctx, 20)
	if err != nil {
		log.Printf("Warning: error getting sentiment data: %v", err)
		sentimentData = nil
	}
	log.Printf("Found %d trending tickers", len(sentimentData))

	// Get top 10 trades from OpenAI (works with or without sentiment data —
	// OpenAI will use web search to find trending tickers when Reddit fails)
	log.Println("Analyzing trades with OpenAI...")
	topTrades, err := analyzer.GetTopTrades(ctx, sentimentData)
	if err != nil {
		log.Printf("Error analyzing trades: %v", err)
		return
	}
	log.Printf("Generated %d trade recommendations", len(topTrades))

	if len(topTrades) == 0 {
		log.Println("No trades generated, skipping email")
		return
	}

	// Deduplicate tickers (keep first occurrence)
	seen := make(map[string]bool)
	var uniqueTrades []trades.Trade
	for _, t := range topTrades {
		if !seen[t.Symbol] {
			seen[t.Symbol] = true
			uniqueTrades = append(uniqueTrades, t)
		}
	}
	topTrades = uniqueTrades

	// Persist to database
	date := todayDate()
	if err := db.SaveMorningTrades(date, topTrades); err != nil {
		log.Printf("Error saving trades to database: %v", err)
		return
	}
	log.Printf("Saved %d trades to database for %s", len(topTrades), date)

	// Convert to template trades
	templateTrades := make([]templates.Trade, len(topTrades))
	for i, t := range topTrades {
		templateTrades[i] = templates.Trade{
			Symbol:         t.Symbol,
			ContractType:   t.ContractType,
			StrikePrice:    t.StrikePrice,
			Expiration:     t.Expiration,
			DTE:            t.DTE,
			EstimatedPrice: t.EstimatedPrice,
			Thesis:         t.Thesis,
			SentimentScore: t.SentimentScore,
			CurrentPrice:   t.CurrentPrice,
			TargetPrice:    t.TargetPrice,
			StopLoss:       t.StopLoss,
			ProfitTarget:   t.ProfitTarget,
			RiskLevel:      t.RiskLevel,
			Catalyst:       t.Catalyst,
			MentionCount:   t.MentionCount,
		}
	}

	// Render email template
	htmlContent, err := templates.RenderEmail(templateTrades)
	if err != nil {
		log.Printf("Error rendering email: %v", err)
		return
	}
	subject := fmt.Sprintf("Options Trades for %s", time.Now().Format("Monday, Jan 2"))

	// Get recipients from database
	recipients := getRecipients(db)
	if len(recipients) == 0 {
		log.Println("No active subscribers, skipping email send")
		return
	}

	log.Printf("Sending email to %d subscribers...", len(recipients))
	if err := emailClient.SendTradeEmail(cfg.EmailFrom, recipients, subject, htmlContent); err != nil {
		log.Printf("Error sending email: %v", err)
		return
	}

	log.Println("Trade analysis complete and email sent!")
}

func runEndOfDayAnalysis(cfg *config.Config, db *store.Store, analyzer *trades.Analyzer, emailClient *email.Client) {
	date := todayDate()

	savedTrades, err := db.GetMorningTrades(date)
	if err != nil {
		log.Printf("Error loading morning trades from database: %v", err)
		return
	}

	if len(savedTrades) == 0 {
		log.Println("Skipping EOD summary: no morning trades found for today")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	log.Printf("Starting end-of-day analysis for %d trades...", len(savedTrades))

	summaries, err := analyzer.GetEndOfDayAnalysis(ctx, savedTrades)
	if err != nil {
		log.Printf("Error getting EOD analysis: %v", err)
		return
	}
	log.Printf("Got %d trade summaries", len(summaries))

	// Persist summaries to database
	if err := db.SaveEODSummaries(date, summaries); err != nil {
		log.Printf("Error saving summaries to database: %v", err)
	}

	// Convert to template summary trades
	templateSummaries := make([]templates.SummaryTrade, len(summaries))
	for i, s := range summaries {
		templateSummaries[i] = templates.SummaryTrade{
			Symbol:       s.Symbol,
			ContractType: s.ContractType,
			StrikePrice:  s.StrikePrice,
			Expiration:   s.Expiration,
			EntryPrice:   s.EntryPrice,
			ClosingPrice: s.ClosingPrice,
			StockOpen:    s.StockOpen,
			StockClose:   s.StockClose,
			Notes:        s.Notes,
		}
	}

	htmlContent, err := templates.RenderSummaryEmail(templateSummaries)
	if err != nil {
		log.Printf("Error rendering summary email: %v", err)
		return
	}
	subject := fmt.Sprintf("EOD Summary for %s", time.Now().Format("Monday, Jan 2"))

	// Get recipients from database
	recipients := getRecipients(db)
	if len(recipients) == 0 {
		log.Println("No active subscribers, skipping EOD email send")
		return
	}

	log.Printf("Sending EOD summary email to %d subscribers...", len(recipients))
	if err := emailClient.SendTradeEmail(cfg.EmailFrom, recipients, subject, htmlContent); err != nil {
		log.Printf("Error sending EOD email: %v", err)
		return
	}

	log.Println("EOD summary complete and email sent!")
}
