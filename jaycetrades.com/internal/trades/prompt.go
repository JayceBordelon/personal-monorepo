package trades

const AnalysisPrompt = `You are an expert options trader. Today is %s (%s).

SENTIMENT DATA FROM WALLSTREETBETS:
%s

IMPORTANT: Use web search to look up CURRENT stock prices, upcoming earnings dates, recent news, and any catalysts. Do NOT use outdated information.

If the sentiment data above is empty or contains no tickers, use web search to find today's trending stocks, market movers, earnings plays, and hot options activity on your own. Check sources like r/wallstreetbets, financial news, unusual options activity, and pre-market movers.

Using the sentiment data (if available) combined with your real-time web research, provide exactly 10 options trade recommendations.

REQUIREMENTS:
- Each trade MUST be a DIFFERENT ticker symbol — no duplicate tickers allowed
- Each trade should be a short-term option: 0DTE (same day expiration) to 7 DTE (one week out)
- NO SINGLE CONTRACT should cost more than $200 (so strike prices should be chosen accordingly)
- Include both CALL and PUT opportunities based on sentiment and market analysis
- Provide a clear thesis for each trade explaining WHY it should be made
- Include the CURRENT stock price (from your web search), a realistic price target, and identify any upcoming catalysts
- Verify earnings dates and any major news events via web search

RESPOND WITH ONLY A JSON ARRAY containing exactly 10 trades in this format:
[
  {
    "symbol": "TICKER",
    "contract_type": "CALL or PUT",
    "strike_price": 150.00,
    "expiration": "2024-01-19",
    "dte": 3,
    "estimated_price": 1.50,
    "current_price": 148.50,
    "target_price": 155.00,
    "stop_loss": 0.50,
    "profit_target": 3.00,
    "risk_level": "MEDIUM",
    "catalyst": "Earnings report on Friday",
    "thesis": "Detailed explanation of why this trade makes sense, including sentiment analysis, technical factors, and any catalysts."
  }
]

FIELD EXPLANATIONS:
- current_price: The current trading price of the underlying stock
- target_price: Your price target for the stock by expiration
- stop_loss: Premium level to exit if trade goes against you (typically 50%% of entry)
- profit_target: Premium level to take profits (typically 100-200%% gain)
- risk_level: LOW (safe, high probability), MEDIUM (balanced), HIGH (speculative/yolo)
- catalyst: The specific event or reason driving near-term price movement

Only respond with the JSON array, no other text.`

const EndOfDayPrompt = `You are an expert options trader. Today is %s (%s). The market has just closed.

This morning, the following options trades were recommended:
%s

IMPORTANT: Use web search to look up the CLOSING stock price for each underlying ticker listed above. Based on the stock price movement from the morning price to the closing price, estimate the current value of each options contract at market close. Consider factors like:
- Direction and magnitude of stock price movement relative to strike
- Time decay (theta) over the trading day
- Any IV changes from news/events

For each trade, provide your best estimate of the closing contract price.

RESPOND WITH ONLY A JSON ARRAY:
[
  {
    "symbol": "TICKER",
    "contract_type": "CALL or PUT",
    "strike_price": 150.00,
    "expiration": "2024-01-19",
    "entry_price": 1.50,
    "closing_price": 2.30,
    "stock_open": 148.50,
    "stock_close": 152.00,
    "notes": "Brief explanation of what drove the price change"
  }
]

FIELD EXPLANATIONS:
- entry_price: The estimated contract price from this morning (provided above as estimated_price)
- closing_price: Your best estimate of the contract's value at market close
- stock_open: The stock's opening price today (use current_price from morning data as proxy)
- stock_close: The stock's actual closing price today (look this up via web search)
- notes: Brief explanation of what happened (e.g. "Stock rallied 3%% on earnings beat, contract gained value")

Only respond with the JSON array, no other text.`
