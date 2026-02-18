package trades

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"jaycetrades.com/internal/sentiment"
)

type Trade struct {
	Symbol         string  `json:"symbol"`
	ContractType   string  `json:"contract_type"` // CALL or PUT
	StrikePrice    float64 `json:"strike_price"`
	Expiration     string  `json:"expiration"`
	DTE            int     `json:"dte"` // Days to expiration
	EstimatedPrice float64 `json:"estimated_price"`
	Thesis         string  `json:"thesis"`
	SentimentScore float64 `json:"sentiment_score"`
	// Additional fields for better trade context
	CurrentPrice float64 `json:"current_price"` // Current stock price
	TargetPrice  float64 `json:"target_price"`  // Price target for the underlying
	StopLoss     float64 `json:"stop_loss"`     // Exit premium if trade goes against you
	ProfitTarget float64 `json:"profit_target"` // Exit premium for taking profits
	RiskLevel    string  `json:"risk_level"`    // LOW, MEDIUM, HIGH
	Catalyst     string  `json:"catalyst"`      // Upcoming event driving the trade
	MentionCount int     `json:"mention_count"` // WSB mention count
}

type Analyzer struct {
	apiKey     string
	httpClient *http.Client
}

func NewAnalyzer(apiKey string) *Analyzer {
	return &Analyzer{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

type openAIRequest struct {
	Model       string    `json:"model"`
	Messages    []message `json:"messages"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (a *Analyzer) GetTopTrades(ctx context.Context, sentimentData []sentiment.TickerMention) ([]Trade, error) {
	sentimentJSON, err := json.Marshal(sentimentData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal sentiment data: %w", err)
	}

	today := time.Now().Format("2006-01-02")
	weekday := time.Now().Weekday().String()

	prompt := fmt.Sprintf(AnalysisPrompt, today, weekday, string(sentimentJSON))

	reqBody := openAIRequest{
		Model: "gpt-4o",
		Messages: []message{
			{Role: "system", Content: "You are an expert options trader. Respond only with valid JSON arrays."},
			{Role: "user", Content: prompt},
		},
		MaxTokens:   4096,
		Temperature: 0.7,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal OpenAI request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+a.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call OpenAI API: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	var openAIResp openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&openAIResp); err != nil {
		return nil, fmt.Errorf("failed to decode OpenAI response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		errMsg := "unknown error"
		if openAIResp.Error != nil {
			errMsg = openAIResp.Error.Message
		}
		return nil, fmt.Errorf("openAI API returned status %d: %s", resp.StatusCode, errMsg)
	}

	if len(openAIResp.Choices) == 0 {
		return nil, fmt.Errorf("empty response from OpenAI")
	}

	var trades []Trade
	if err := json.Unmarshal([]byte(openAIResp.Choices[0].Message.Content), &trades); err != nil {
		return nil, fmt.Errorf("failed to parse trades from OpenAI response: %w", err)
	}

	// Enrich with sentiment data
	type sentimentInfo struct {
		Score    float64
		Mentions int
	}
	sentimentMap := make(map[string]sentimentInfo)
	for _, s := range sentimentData {
		sentimentMap[s.Symbol] = sentimentInfo{Score: s.Sentiment, Mentions: s.Mentions}
	}
	for i := range trades {
		if info, ok := sentimentMap[trades[i].Symbol]; ok {
			trades[i].SentimentScore = info.Score
			trades[i].MentionCount = info.Mentions
		}
	}

	return trades, nil
}
