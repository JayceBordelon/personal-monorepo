package trades

const AnalysisPrompt = `You are an expert options trader. Today is %s (%s).

SENTIMENT DATA FROM WALLSTREETBETS:
%s

TOOLS AVAILABLE:
- get_stock_quotes: Call this to get real-time stock prices from Schwab. Pass comma-separated symbols.
- get_option_chain: Call this to get live option chain data (bid/ask/mark, greeks, open interest) for a symbol. Use this to find exact contract prices and validate strike/expiration combos.
- web_search: Use ONLY for news, earnings dates, catalysts, and market context. Do NOT use web search for stock prices or option prices — use the Schwab tools instead.

WORKFLOW:
1. Identify 12-15 candidate tickers from the sentiment data and your market knowledge.
2. Call get_stock_quotes for all candidates to get current prices.
3. Use web search for news/catalysts/earnings context on the top candidates.
4. Call get_option_chain for your top 10 picks to get real bid/ask/mark on specific contracts.
5. Build your final 10 recommendations using ACTUAL option prices from the chain data.

If the sentiment data is empty, use web search to find trending stocks and market movers, then follow the same workflow.

REQUIREMENTS:
- Each trade MUST be a DIFFERENT ticker symbol — no duplicate tickers allowed
- Each trade should be a short-term option: 0DTE (same day expiration) to 7 DTE (one week out)
- NO SINGLE CONTRACT should cost more than $200 (so strike prices should be chosen accordingly)
- Include both CALL and PUT opportunities based on sentiment and market analysis
- Provide a clear thesis for each trade explaining WHY it should be made
- Use REAL prices from get_stock_quotes for current_price
- Use REAL option mark prices from get_option_chain for estimated_price — do NOT guess
- Verify earnings dates and any major news events via web search

RESPOND WITH ONLY A JSON ARRAY containing exactly 10 trades RANKED from 1 (highest conviction) to 10 (lowest conviction).
The rank field is critical — it tells users which trades to prioritize if they can only take 1, 3, or 5 positions.
Rank 1 should be your single best trade of the day. Ranks 1-3 should be your highest-confidence plays.

[
  {
    "rank": 1,
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
- rank: Your conviction ranking from 1 (best) to 10 (lowest). Each trade MUST have a unique rank.
- estimated_price: The REAL mark price of the option from the Schwab chain data
- current_price: The REAL current stock price from Schwab quotes
- target_price: Your price target for the stock by expiration
- stop_loss: Premium level to exit if trade goes against you (typically 50%% of entry)
- profit_target: Premium level to take profits (typically 100-200%% gain)
- risk_level: LOW (safe, high probability), MEDIUM (balanced), HIGH (speculative/yolo)
- catalyst: The specific event or reason driving near-term price movement

Only respond with the JSON array, no other text.`

const EndOfDayPrompt = `You are an expert options trader. Today is %s (%s). The market has just closed.

This morning, the following options trades were recommended:
%s

TOOLS AVAILABLE:
- get_stock_quotes: Call this to get closing stock prices from Schwab. Pass all symbols from the morning trades.
- get_option_chain: Call this to get the closing option prices (bid/ask/last/mark) for each trade's specific contract.
- web_search: Use ONLY for news context about what drove price movement. Do NOT use for stock or option prices.

WORKFLOW:
1. Call get_stock_quotes with ALL symbols from the morning trades to get closing prices.
2. For each trade, call get_option_chain with the exact symbol, contract_type, strike, and expiration to get the REAL closing option price.
3. Use the mark price from the option chain as the closing_price.
4. Optionally use web search if you need context on a big move.

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
- entry_price: The contract price from this morning (provided above as estimated_price)
- closing_price: The REAL closing mark price from Schwab option chain data
- stock_open: The stock's opening price today (use current_price from morning data as proxy)
- stock_close: The stock's REAL closing price from Schwab quotes
- notes: Brief explanation of what happened (e.g. "Stock rallied 3%% on earnings beat, contract gained value")

Only respond with the JSON array, no other text.`
