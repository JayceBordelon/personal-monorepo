package trades

const AnalysisPrompt = `You are an expert options trader. Today is %s (%s).

SENTIMENT DATA FROM WALLSTREETBETS:
%s

Using the sentiment data above and your knowledge of current market conditions, provide exactly 3 options trade recommendations.

REQUIREMENTS:
- Each trade should be a short-term option: 0DTE (same day expiration) to 7 DTE (one week out)
- NO SINGLE CONTRACT should cost more than $200 (so strike prices should be chosen accordingly)
- Include both CALL and PUT opportunities based on sentiment and market analysis
- Provide a clear thesis for each trade explaining WHY it should be made
- Include the current stock price, a realistic price target, and identify any upcoming catalysts

Search the web for current stock prices, upcoming catalysts, earnings dates, and any relevant news that could impact these tickers.

RESPOND WITH ONLY A JSON ARRAY containing exactly 3 trades in this format:
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
