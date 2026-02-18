package templates

import (
	"bytes"
	"embed"
	"html/template"
	"time"
)

//go:embed email.html
var templateFS embed.FS

type Trade struct {
	Symbol         string
	ContractType   string
	StrikePrice    float64
	Expiration     string
	DTE            int
	EstimatedPrice float64
	Thesis         string
	SentimentScore float64
	CurrentPrice   float64
	TargetPrice    float64
	StopLoss       float64
	ProfitTarget   float64
	RiskLevel      string
	Catalyst       string
	MentionCount   int
}

type EmailData struct {
	Subject string
	Date    string
	Trades  []Trade
}

var funcMap = template.FuncMap{
	"mul": func(a, b float64) float64 { return a * b },
	"div": func(a, b float64) float64 {
		if b == 0 {
			return 0
		}
		return a / b
	},
	"sub": func(a, b float64) float64 { return a - b },
	"add": func(a, b float64) float64 { return a + b },
}

func RenderEmail(trades []Trade) (string, error) {
	tmpl, err := template.New("email.html").Funcs(funcMap).ParseFS(templateFS, "email.html")
	if err != nil {
		return "", err
	}

	data := EmailData{
		Subject: "Today's Top Options Plays",
		Date:    time.Now().Format("Monday, Jan 2, 2006"),
		Trades:  trades,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}
