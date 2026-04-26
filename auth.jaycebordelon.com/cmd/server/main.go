package main

import (
	"log"
	"time"

	"golang.org/x/crypto/bcrypt"

	"auth.jaycebordelon.com/internal/config"
	"auth.jaycebordelon.com/internal/google"
	"auth.jaycebordelon.com/internal/server"
	"auth.jaycebordelon.com/internal/store"
)

func main() {
	cfg := config.Load()

	db, err := store.New(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("store: %v", err)
	}
	defer func() { _ = db.Close() }()

	for _, c := range cfg.Clients {
		hash, err := bcrypt.GenerateFromPassword([]byte(c.Secret), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("hash client secret for %s: %v", c.ID, err)
		}
		if err := db.UpsertClient(c.ID, hash, c.Name, c.RedirectURIs); err != nil {
			log.Fatalf("upsert client %s: %v", c.ID, err)
		}
		log.Printf("registered oauth client %s (%s) with %d redirect URI(s)", c.ID, c.Name, len(c.RedirectURIs))
	}

	go sweeper(db)

	gc := google.NewClient(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleCallbackURL)

	srv := server.New(db, server.Options{
		Port:           cfg.ServerPort,
		Google:         gc,
		IdPCookieName:  cfg.IdPCookieName,
		IdPCookieTTL:   time.Duration(cfg.IdPCookieTTL) * 24 * time.Hour,
		AuthCodeTTL:    time.Duration(cfg.AuthCodeTTLSec) * time.Second,
		AccessTokenTTL: time.Duration(cfg.AccessTokenTTL) * 24 * time.Hour,
	})

	if err := srv.Start(); err != nil {
		log.Fatalf("server: %v", err)
	}
}

/*
sweeper runs a nightly-ish cleanup in-process (no cron dep). Every hour
it deletes sessions/codes/states past their TTL.
*/
func sweeper(db *store.Store) {
	t := time.NewTicker(1 * time.Hour)
	defer t.Stop()
	for range t.C {
		sess, states, codes, err := db.SweepExpired()
		if err != nil {
			log.Printf("sweep: %v", err)
			continue
		}
		if sess+states+codes > 0 {
			log.Printf("sweep: %d sessions, %d oauth_states, %d auth_codes", sess, states, codes)
		}
	}
}
