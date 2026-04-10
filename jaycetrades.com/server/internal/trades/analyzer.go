package trades

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"jaycetrades.com/internal/schwab"
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
	Rank         int     `json:"rank"`          // 1 = highest conviction, 10 = lowest
}

type TradeSummary struct {
	Symbol       string  `json:"symbol"`
	ContractType string  `json:"contract_type"`
	StrikePrice  float64 `json:"strike_price"`
	Expiration   string  `json:"expiration"`
	EntryPrice   float64 `json:"entry_price"`
	ClosingPrice float64 `json:"closing_price"`
	StockOpen    float64 `json:"stock_open"`
	StockClose   float64 `json:"stock_close"`
	Notes        string  `json:"notes"`
}

type Analyzer struct {
	apiKey     string
	schwab     *schwab.Client
	httpClient *http.Client
}

func NewAnalyzer(apiKey string, schwabClient *schwab.Client) *Analyzer {
	return &Analyzer{
		apiKey: apiKey,
		schwab: schwabClient,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// Responses API request structure (supports web search + function tools)
type responsesAPIRequest struct {
	Model              string      `json:"model"`
	Input              interface{} `json:"input"` // string or []inputItem
	Tools              []tool      `json:"tools,omitempty"`
	Temperature        float64     `json:"temperature,omitempty"`
	PreviousResponseID string      `json:"previous_response_id,omitempty"`
}

type tool struct {
	Type        string                 `json:"type"`
	Name        string                 `json:"name,omitempty"`
	Description string                 `json:"description,omitempty"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
}

type functionCallOutputItem struct {
	Type   string `json:"type"` // "function_call_output"
	CallID string `json:"call_id"`
	Output string `json:"output"`
}

// Responses API response structure
type responsesAPIResponse struct {
	ID         string       `json:"id"`
	Output     []outputItem `json:"output"`
	OutputText string       `json:"output_text"`
	Error      *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type outputItem struct {
	Type      string        `json:"type"`
	ID        string        `json:"id,omitempty"`
	CallID    string        `json:"call_id,omitempty"`
	Name      string        `json:"name,omitempty"`
	Arguments string        `json:"arguments,omitempty"`
	Content   []contentItem `json:"content,omitempty"`
}

type contentItem struct {
	Type string `json:"type"`
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

	content, err := a.callWithTools(ctx, prompt, 0.7)
	if err != nil {
		return nil, err
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

func (a *Analyzer) GetEndOfDayAnalysis(ctx context.Context, morningTrades []Trade) ([]TradeSummary, error) {
	tradesJSON, err := json.Marshal(morningTrades)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal morning trades: %w", err)
	}

	today := time.Now().Format("2006-01-02")
	weekday := time.Now().Weekday().String()

	prompt := fmt.Sprintf(EndOfDayPrompt, today, weekday, string(tradesJSON))

	content, err := a.callWithTools(ctx, prompt, 0.3)
	if err != nil {
		return nil, err
	}

	var summaries []TradeSummary
	content = stripMarkdownCodeBlock(content)
	if err := json.Unmarshal([]byte(content), &summaries); err != nil {
		return nil, fmt.Errorf("failed to parse summaries from OpenAI response: %w", err)
	}

	return summaries, nil
}

// ── Multi-turn function calling with Schwab market data tools ──

func (a *Analyzer) buildTools() []tool {
	tools := []tool{{Type: "web_search_preview"}}

	if a.schwab != nil && a.schwab.IsConnected() {
		tools = append(tools, tool{
			Type:        "function",
			Name:        "get_stock_quotes",
			Description: "Get real-time stock quotes from Schwab. Returns last price, bid, ask, open, high, low, volume, and day change for each symbol.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"symbols": map[string]interface{}{
						"type":        "string",
						"description": "Comma-separated stock ticker symbols (e.g. 'AAPL,MSFT,TSLA')",
					},
				},
				"required":             []string{"symbols"},
				"additionalProperties": false,
			},
		}, tool{
			Type:        "function",
			Name:        "get_option_chain",
			Description: "Get live option chain from Schwab for a symbol. Returns bid/ask/last/mark, greeks (delta, gamma, theta, vega), open interest, and volume for matching contracts.",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"symbol": map[string]interface{}{
						"type":        "string",
						"description": "Stock ticker symbol (e.g. 'AAPL')",
					},
					"contract_type": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"CALL", "PUT", "ALL"},
						"description": "Filter by contract type. Default ALL.",
					},
					"from_date": map[string]interface{}{
						"type":        "string",
						"description": "Start date for expiration range (YYYY-MM-DD). Defaults to today.",
					},
					"to_date": map[string]interface{}{
						"type":        "string",
						"description": "End date for expiration range (YYYY-MM-DD). Defaults to 7 days out.",
					},
					"strike": map[string]interface{}{
						"type":        "number",
						"description": "Filter to a specific strike price.",
					},
				},
				"required":             []string{"symbol"},
				"additionalProperties": false,
			},
		})
	}

	return tools
}

func (a *Analyzer) callWithTools(ctx context.Context, prompt string, temp float64) (string, error) {
	tools := a.buildTools()

	reqBody := responsesAPIRequest{
		Model:       "gpt-5.4",
		Input:       prompt,
		Tools:       tools,
		Temperature: temp,
	}

	const maxRounds = 10
	for round := 0; round < maxRounds; round++ {
		apiResp, err := a.sendRequest(ctx, reqBody)
		if err != nil {
			return "", err
		}

		// Collect any function calls from the output.
		var funcCalls []outputItem
		for _, item := range apiResp.Output {
			if item.Type == "function_call" {
				funcCalls = append(funcCalls, item)
			}
		}

		// If no function calls, we have the final text.
		if len(funcCalls) == 0 {
			content := extractText(apiResp)
			if content == "" {
				return "", fmt.Errorf("empty response from OpenAI")
			}
			return content, nil
		}

		// Execute each function call and build outputs for the next round.
		var outputs []interface{}
		for _, fc := range funcCalls {
			result := a.executeFunction(ctx, fc.Name, fc.Arguments)
			log.Printf("Tool call: %s → %d bytes", fc.Name, len(result))
			outputs = append(outputs, functionCallOutputItem{
				Type:   "function_call_output",
				CallID: fc.CallID,
				Output: result,
			})
		}

		// Continue conversation with function results.
		reqBody = responsesAPIRequest{
			Model:              "gpt-5.4",
			Input:              outputs,
			Tools:              tools,
			Temperature:        temp,
			PreviousResponseID: apiResp.ID,
		}
	}

	return "", fmt.Errorf("exceeded max function call rounds (%d)", maxRounds)
}

func (a *Analyzer) sendRequest(ctx context.Context, reqBody responsesAPIRequest) (*responsesAPIResponse, error) {
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

	return &apiResp, nil
}

func extractText(resp *responsesAPIResponse) string {
	if resp.OutputText != "" {
		return resp.OutputText
	}
	for _, item := range resp.Output {
		if item.Type == "message" && len(item.Content) > 0 {
			for _, c := range item.Content {
				if c.Type == "output_text" && c.Text != "" {
					return c.Text
				}
			}
		}
	}
	return ""
}

func (a *Analyzer) executeFunction(ctx context.Context, name, arguments string) string {
	switch name {
	case "get_stock_quotes":
		return a.execGetStockQuotes(ctx, arguments)
	case "get_option_chain":
		return a.execGetOptionChain(ctx, arguments)
	default:
		return fmt.Sprintf(`{"error": "unknown function: %s"}`, name)
	}
}

func (a *Analyzer) execGetStockQuotes(ctx context.Context, arguments string) string {
	var args struct {
		Symbols string `json:"symbols"`
	}
	if err := json.Unmarshal([]byte(arguments), &args); err != nil {
		return `{"error": "invalid arguments"}`
	}

	symbols := strings.Split(args.Symbols, ",")
	for i := range symbols {
		symbols[i] = strings.TrimSpace(symbols[i])
	}

	quotes, err := a.schwab.GetQuotes(symbols)
	if err != nil {
		return fmt.Sprintf(`{"error": %q}`, err.Error())
	}

	result, _ := json.Marshal(quotes)
	return string(result)
}

func (a *Analyzer) execGetOptionChain(ctx context.Context, arguments string) string {
	var args struct {
		Symbol       string  `json:"symbol"`
		ContractType string  `json:"contract_type"`
		FromDate     string  `json:"from_date"`
		ToDate       string  `json:"to_date"`
		Strike       float64 `json:"strike"`
	}
	if err := json.Unmarshal([]byte(arguments), &args); err != nil {
		return `{"error": "invalid arguments"}`
	}

	// Default date range: today to 7 days out.
	if args.FromDate == "" {
		args.FromDate = time.Now().Format("2006-01-02")
	}
	if args.ToDate == "" {
		args.ToDate = time.Now().AddDate(0, 0, 7).Format("2006-01-02")
	}

	chain, err := a.schwab.GetOptionChain(args.Symbol, args.ContractType, args.FromDate, args.ToDate, args.Strike)
	if err != nil {
		return fmt.Sprintf(`{"error": %q}`, err.Error())
	}

	result, _ := json.Marshal(chain)
	return string(result)
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
