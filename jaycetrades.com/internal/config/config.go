package config

import (
	"os"
	"strings"
)

type Config struct {
	CronScheduleOpen  string
	CronScheduleClose string
	ResendAPIKey      string
	OpenAIAPIKey      string
	EmailRecipients   []string // Fallback: seed subscribers from env on first run
	EmailFrom         string
	DatabaseURL       string
	ServerPort        string
}

func Load() *Config {
	cronOpen := os.Getenv("CRON_SCHEDULE_OPEN")
	if cronOpen == "" {
		cronOpen = "25 9 * * 1-5"
	}

	cronClose := os.Getenv("CRON_SCHEDULE_CLOSE")
	if cronClose == "" {
		cronClose = "5 16 * * 1-5"
	}

	emailFrom := os.Getenv("EMAIL_FROM")
	if emailFrom == "" {
		emailFrom = "Jayce's Trading Bot <trades@jaycetrades.com>"
	}

	var recipients []string
	if r := os.Getenv("EMAIL_RECIPIENTS"); r != "" {
		for _, email := range strings.Split(r, ",") {
			if trimmed := strings.TrimSpace(email); trimmed != "" {
				recipients = append(recipients, trimmed)
			}
		}
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgresql://jaycetrades:jaycetrades@postgres:5432/jaycetrades?sslmode=disable"
	}

	serverPort := os.Getenv("SERVER_PORT")
	if serverPort == "" {
		serverPort = "8080"
	}

	return &Config{
		CronScheduleOpen:  cronOpen,
		CronScheduleClose: cronClose,
		ResendAPIKey:      os.Getenv("RESEND_API_KEY"),
		OpenAIAPIKey:      os.Getenv("OPENAI_API_KEY"),
		EmailRecipients:   recipients,
		EmailFrom:         emailFrom,
		DatabaseURL:       databaseURL,
		ServerPort:        serverPort,
	}
}
