package server

import (
	"embed"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strings"

	"jaycetrades.com/internal/store"
	"jaycetrades.com/internal/trades"
)

//go:embed subscribe.html
var subscribeHTML embed.FS

//go:embed dashboard.html
var dashboardHTML embed.FS

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

type Server struct {
	db   *store.Store
	mux  *http.ServeMux
	port string
}

type subscribeRequest struct {
	Email string `json:"email"`
	Name  string `json:"name"`
}

type unsubscribeRequest struct {
	Email string `json:"email"`
}

type apiResponse struct {
	OK      bool   `json:"ok"`
	Message string `json:"message"`
}

func New(db *store.Store, port string) *Server {
	s := &Server{db: db, mux: http.NewServeMux(), port: port}
	s.routes()
	return s
}

func (s *Server) routes() {
	s.mux.HandleFunc("/", s.handleIndex)
	s.mux.HandleFunc("/api/subscribe", s.handleSubscribe)
	s.mux.HandleFunc("/api/unsubscribe", s.handleUnsubscribe)
	s.mux.HandleFunc("/dashboard", s.handleDashboard)
	s.mux.HandleFunc("/api/trades/today", s.handleTradesToday)
	s.mux.HandleFunc("/api/trades/dates", s.handleTradeDates)
	s.mux.HandleFunc("/api/trades/week", s.handleTradesWeek)
	s.mux.HandleFunc("/health", s.handleHealth)
	s.mux.HandleFunc("/robots.txt", s.handleRobots)
	s.mux.HandleFunc("/sitemap.xml", s.handleSitemap)
}

func (s *Server) Start() {
	addr := ":" + s.port
	log.Printf("API server listening on %s", addr)
	if err := http.ListenAndServe(addr, s.mux); err != nil {
		log.Fatalf("API server error: %v", err)
	}
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	data, err := subscribeHTML.ReadFile("subscribe.html")
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

func (s *Server) handleDashboard(w http.ResponseWriter, r *http.Request) {
	data, err := dashboardHTML.ReadFile("dashboard.html")
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

type dashboardTrade struct {
	Trade   trades.Trade         `json:"trade"`
	Summary *trades.TradeSummary `json:"summary,omitempty"`
}

type dashboardResponse struct {
	Date   string           `json:"date"`
	Trades []dashboardTrade `json:"trades"`
}

type weekDay struct {
	Date   string           `json:"date"`
	Trades []dashboardTrade `json:"trades"`
}

type weekResponse struct {
	Start string    `json:"start"`
	End   string    `json:"end"`
	Days  []weekDay `json:"days"`
}

func (s *Server) handleTradeDates(w http.ResponseWriter, r *http.Request) {
	dates, err := s.db.GetTradeDates(30)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"dates": []string{}})
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	writeJSON(w, http.StatusOK, map[string]any{"dates": dates})
}

func (s *Server) handleTradesToday(w http.ResponseWriter, r *http.Request) {
	// Accept optional ?date= query param for historical browsing
	requestDate := r.URL.Query().Get("date")

	var date string
	var err error
	if requestDate != "" {
		date = requestDate
	} else {
		date, err = s.db.GetLatestTradeDate()
		if err != nil {
			writeJSON(w, http.StatusOK, dashboardResponse{})
			return
		}
	}

	morningTrades, err := s.db.GetMorningTrades(date)
	if err != nil {
		writeJSON(w, http.StatusOK, dashboardResponse{Date: date})
		return
	}

	summaries, _ := s.db.GetEODSummaries(date)
	summaryMap := make(map[string]*trades.TradeSummary)
	for i := range summaries {
		key := summaries[i].Symbol + "|" + summaries[i].ContractType + "|" + fmt.Sprintf("%.2f", summaries[i].StrikePrice)
		summaryMap[key] = &summaries[i]
	}

	result := make([]dashboardTrade, len(morningTrades))
	for i, t := range morningTrades {
		key := t.Symbol + "|" + t.ContractType + "|" + fmt.Sprintf("%.2f", t.StrikePrice)
		result[i] = dashboardTrade{Trade: t, Summary: summaryMap[key]}
	}

	w.Header().Set("Cache-Control", "public, max-age=30")
	writeJSON(w, http.StatusOK, dashboardResponse{Date: date, Trades: result})
}

func (s *Server) handleTradesWeek(w http.ResponseWriter, r *http.Request) {
	start := r.URL.Query().Get("start")
	end := r.URL.Query().Get("end")

	if start == "" || end == "" {
		writeJSON(w, http.StatusBadRequest, apiResponse{OK: false, Message: "start and end query params required"})
		return
	}

	tradesMap, err := s.db.GetTradesForDateRange(start, end)
	if err != nil {
		writeJSON(w, http.StatusOK, weekResponse{Start: start, End: end})
		return
	}

	summariesMap, _ := s.db.GetSummariesForDateRange(start, end)

	// Collect all dates that have trades
	dateSet := make(map[string]bool)
	for d := range tradesMap {
		dateSet[d] = true
	}
	var dates []string
	for d := range dateSet {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	var days []weekDay
	for _, date := range dates {
		dayTrades := tradesMap[date]
		daySummaries := summariesMap[date]

		summaryMap := make(map[string]*trades.TradeSummary)
		for i := range daySummaries {
			key := daySummaries[i].Symbol + "|" + daySummaries[i].ContractType + "|" + fmt.Sprintf("%.2f", daySummaries[i].StrikePrice)
			summaryMap[key] = &daySummaries[i]
		}

		result := make([]dashboardTrade, len(dayTrades))
		for i, t := range dayTrades {
			key := t.Symbol + "|" + t.ContractType + "|" + fmt.Sprintf("%.2f", t.StrikePrice)
			result[i] = dashboardTrade{Trade: t, Summary: summaryMap[key]}
		}

		days = append(days, weekDay{Date: date, Trades: result})
	}

	w.Header().Set("Cache-Control", "public, max-age=30")
	writeJSON(w, http.StatusOK, weekResponse{Start: start, End: end, Days: days})
}

func (s *Server) handleSubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, apiResponse{OK: false, Message: "method not allowed"})
		return
	}

	var req subscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiResponse{OK: false, Message: "invalid JSON body"})
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)

	if req.Email == "" || !emailRegex.MatchString(req.Email) {
		writeJSON(w, http.StatusBadRequest, apiResponse{OK: false, Message: "valid email is required"})
		return
	}

	if err := s.db.AddSubscriber(req.Email, req.Name); err != nil {
		log.Printf("Error adding subscriber %s: %v", req.Email, err)
		writeJSON(w, http.StatusInternalServerError, apiResponse{OK: false, Message: "failed to subscribe"})
		return
	}

	log.Printf("New subscriber: %s (%s)", req.Email, req.Name)
	writeJSON(w, http.StatusOK, apiResponse{OK: true, Message: "subscribed successfully"})
}

func (s *Server) handleUnsubscribe(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, apiResponse{OK: false, Message: "method not allowed"})
		return
	}

	var req unsubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiResponse{OK: false, Message: "invalid JSON body"})
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Email == "" {
		writeJSON(w, http.StatusBadRequest, apiResponse{OK: false, Message: "email is required"})
		return
	}

	if err := s.db.RemoveSubscriber(req.Email); err != nil {
		writeJSON(w, http.StatusNotFound, apiResponse{OK: false, Message: err.Error()})
		return
	}

	log.Printf("Unsubscribed: %s", req.Email)
	writeJSON(w, http.StatusOK, apiResponse{OK: true, Message: "unsubscribed successfully"})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, apiResponse{OK: true, Message: "healthy"})
}

func (s *Server) handleRobots(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("User-agent: *\nAllow: /\nDisallow: /api/\n\nUser-agent: Googlebot\nAllow: /\nDisallow: /api/\n\nSitemap: https://jaycetrades.com/sitemap.xml\n"))
}

func (s *Server) handleSitemap(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://jaycetrades.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://jaycetrades.com/dashboard</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>
`))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
