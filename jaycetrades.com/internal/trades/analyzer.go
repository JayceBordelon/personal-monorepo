package trades

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
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

// Responses API request structure (supports web search)
type responsesAPIRequest struct {
	Model       string  `json:"model"`
	Input       string  `json:"input"`
	Tools       []tool  `json:"tools,omitempty"`
	Temperature float64 `json:"temperature,omitempty"`
}

type tool struct {
	Type string `json:"type"`
}

// Responses API response structure
type responsesAPIResponse struct {
	ID         string       `json:"id"`
	Output     []outputItem `json:"output"`
	OutputText string       `json:"output_text"` // Convenience field that aggregates all text output
	Error      *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type outputItem struct {
	Type    string        `json:"type"`
	Content []contentItem `json:"content,omitempty"` // Array of content items
}

type contentItem struct {
	Type string `json:"type"` // "output_text" or "refusal"
	Text string `json:"text"`
}

func (a *Analyzer) GetTopTrades(ctx context.Context, sentimentData []sentiment.TickerMention) ([]Trade, error) {
	sentimentJSON, err := json.Marshal(sentimentData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal sentiment data: %w", err)
	}

	today := time.Now().Format("2006-01-02")
	weekday := time.Now().Weekday().String()

	prompt := fmt.Sprintf(AnalysisPrompt, today, weekday, string(sentimentJSON))

	// Use Responses API with web search enabled
	reqBody := responsesAPIRequest{
		Model: "gpt-4o",
		Input: prompt,
		Tools: []tool{
			{Type: "web_search_preview"},
		},
		Temperature: 0.7,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal OpenAI request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/responses", bytes.NewBuffer(body))
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

	var apiResp responsesAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode OpenAI response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		errMsg := "unknown error"
		if apiResp.Error != nil {
			errMsg = apiResp.Error.Message
		}
		return nil, fmt.Errorf("openAI API returned status %d: %s", resp.StatusCode, errMsg)
	}

	// Extract text content from response output
	// Prefer the convenience output_text field, fall back to parsing nested structure
	content := apiResp.OutputText
	if content == "" {
		// Fallback: extract from nested output structure
		for _, item := range apiResp.Output {
			if item.Type == "message" && len(item.Content) > 0 {
				for _, c := range item.Content {
					if c.Type == "output_text" && c.Text != "" {
						content = c.Text
						break
					}
				}
				if content != "" {
					break
				}
			}
		}
	}

	if content == "" {
		return nil, fmt.Errorf("empty response from OpenAI")
	}

	var trades []Trade
	content = stripMarkdownCodeBlock(content)
	if err := json.Unmarshal([]byte(content), &trades); err != nil {
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

// stripMarkdownCodeBlock removes markdown code block formatting from a string.
// OpenAI sometimes returns JSON wrapped in ```json ... ``` blocks.
func stripMarkdownCodeBlock(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		// Remove opening fence (with optional language identifier)
		if idx := strings.Index(s, "\n"); idx != -1 {
			s = s[idx+1:]
		}
		// Remove closing fence
		if idx := strings.LastIndex(s, "```"); idx != -1 {
			s = s[:idx]
		}
	}
	return strings.TrimSpace(s)
}
