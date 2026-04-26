package config

import (
	"encoding/json"
	"log"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	DatabaseURL        string
	ServerPort         string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleCallbackURL  string

	/*
	Cookie set on auth.jaycebordelon.com when the user authenticates with
	the IdP directly (so a second consumer app doesn't need to re-prompt
	Google). Host-scoped: does NOT leak to other subdomains.
	*/
	IdPCookieName  string
	IdPCookieTTL   int // days
	AuthCodeTTLSec int // seconds
	AccessTokenTTL int // days

	/*
	Registered OAuth clients (consumer apps). Loaded from OAUTH_CLIENTS_JSON
	as an array of {id, secret, name, redirect_uris[]} objects. Clients are
	upserted into the DB on every boot so config changes propagate.
	*/
	Clients []ClientSeed
}

type ClientSeed struct {
	ID           string   `json:"id"`
	Secret       string   `json:"secret"`
	Name         string   `json:"name"`
	RedirectURIs []string `json:"redirect_uris"`
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("%s is required", key)
	}
	return v
}

func Load() *Config {
	databaseURL := mustEnv("AUTH_DATABASE_URL")
	clientID := mustEnv("GOOGLE_CLIENT_ID")
	clientSecret := mustEnv("GOOGLE_CLIENT_SECRET")
	callbackURL := mustEnv("GOOGLE_CALLBACK_URL")

	raw := strings.TrimSpace(os.Getenv("OAUTH_CLIENTS_JSON"))
	if raw == "" {
		log.Fatal("OAUTH_CLIENTS_JSON is required (must contain at least one registered consumer client)")
	}
	var clients []ClientSeed
	if err := json.Unmarshal([]byte(raw), &clients); err != nil {
		log.Fatalf("OAUTH_CLIENTS_JSON is not valid JSON: %v", err)
	}
	if len(clients) == 0 {
		log.Fatal("OAUTH_CLIENTS_JSON must contain at least one client")
	}
	seenIDs := make(map[string]bool, len(clients))
	for i, c := range clients {
		if c.ID == "" || c.Secret == "" || len(c.RedirectURIs) == 0 {
			log.Fatalf("OAUTH_CLIENTS_JSON[%d] missing id, secret, or redirect_uris", i)
		}
		if seenIDs[c.ID] {
			log.Fatalf("OAUTH_CLIENTS_JSON has duplicate client id %q", c.ID)
		}
		seenIDs[c.ID] = true
		for j, uri := range c.RedirectURIs {
			if uri == "" {
				log.Fatalf("OAUTH_CLIENTS_JSON[%d].redirect_uris[%d] is empty", i, j)
			}
		}
	}

	return &Config{
		DatabaseURL:        databaseURL,
		ServerPort:         getEnv("AUTH_SERVER_PORT", "8081"),
		GoogleClientID:     clientID,
		GoogleClientSecret: clientSecret,
		GoogleCallbackURL:  callbackURL,
		IdPCookieName:      getEnv("IDP_COOKIE_NAME", "aj_session"),
		IdPCookieTTL:       getEnvInt("IDP_COOKIE_TTL_DAYS", 30),
		AuthCodeTTLSec:     getEnvInt("AUTH_CODE_TTL_SECONDS", 60),
		AccessTokenTTL:     getEnvInt("ACCESS_TOKEN_TTL_DAYS", 30),
		Clients:            clients,
	}
}
