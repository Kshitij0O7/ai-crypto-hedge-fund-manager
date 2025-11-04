# Architecture Overview

## System Flow

```
User Input (Terminal)
       ↓
MCP Server (server.js)
       ↓
   ┌───┴───┐
   ↓       ↓
Trading  Bitquery
Engine   Client
   ↓       ↓
   └───┬───┘
       ↓
Position Management
```

## Core Components

### 1. MCP Server (`src/server.js`)
- Entry point of the application
- Handles MCP protocol communication
- Manages tool requests and responses
- Coordinates between all services
- **Key responsibilities:**
  - Receive tool calls from MCP client
  - Initialize services (Bitquery, Trading Engine)
  - Start monitoring loop for tokens
  - Dispatch data to appropriate handlers

### 2. Bitquery Client (`src/services/bitquery.js`)
- Handles all external API communication
- Fetches on-chain data from Bitquery
- **Placeholder functions:**
  - `getCurrentPrice()` - Current token price
  - `getHistoricalPrices()` - Historical price data for volatility
  - `getTradingVolume()` - 24h volume and liquidity
  - `getRecentTrades()` - Recent DEX trades
  - `subscribeToTrades()` - Real-time trade streaming

### 3. Trading Engine (`src/services/tradingEngine.js`)
- Core decision-making logic
- Position management
- Risk calculations
- **Key methods:**
  - `calculateVolatility()` - Compute standard deviation-based volatility
  - `analyzeMarket()` - Main decision loop
  - `evaluatePosition()` - Check if positions should be closed
  - `evaluateEntry()` - Determine if new position should be opened
  - `openPosition()` - Execute position opening
  - `closePosition()` - Execute position closing

### 4. Terminal UI (`src/ui/terminal.js`)
- User interaction layer
- Dashboard display
- Risk profile selection
- **Features:**
  - Welcome screen
  - Risk profile prompt
  - Live dashboard with positions
  - Trading action notifications
  - Market data display

## Data Flow

### Token Monitoring Loop (every 30 seconds)

1. **Fetch Data**
   - Current price from Bitquery
   - Historical prices (last 7 days)
   - Volume and liquidity metrics

2. **Calculate Metrics**
   - Average price from historical data
   - Standard deviation
   - Volatility percentage

3. **Analysis**
   - Check if position exists for token
   - If exists: Evaluate for exit (stop loss/take profit)
   - If not: Evaluate for entry (volatility threshold)

4. **Decision**
   - Hold: No action needed
   - Open: Create new position
   - Close: Close existing position

5. **Execution**
   - Update position map
   - Adjust allocated capital
   - Log action
   - Update dashboard

## Risk Profiles

### Low Risk, Low Returns
```javascript
{
  maxPositionSize: 0.1,      // 10% of capital per position
  volatilityThreshold: 0.02, // 2% volatility required
  stopLoss: 0.95,            // 5% stop loss
  takeProfit: 1.05           // 5% take profit
}
```

### High Risk, High Returns
```javascript
{
  maxPositionSize: 0.3,      // 30% of capital per position
  volatilityThreshold: 0.05, // 5% volatility required
  stopLoss: 0.90,            // 10% stop loss
  takeProfit: 1.15           // 15% take profit
}
```

## Volatility Calculation

### Formula
```
1. Average Price = Sum(all prices) / count
2. Variance = Sum((price - average)²) / count
3. Standard Deviation = √Variance
4. Volatility = Standard Deviation / Average Price
```

### Example
- Prices: [100, 105, 98, 110, 102]
- Average: 103
- Variance: (9+4+25+49+1)/5 = 17.6
- Std Dev: 4.20
- Volatility: 4.20/103 = 4.08%

## Position Structure

```javascript
{
  id: "pos_1234567890",
  tokenAddress: "0x123...abc",
  type: "long",
  entryPrice: 2500.00,
  size: 10000.00,
  timestamp: 1234567890,
  stopLoss: 0.95,
  takeProfit: 1.05
}
```

## MCP Tool Interface

### Available Tools

1. **start_fund_manager**
   - Initializes system
   - Prompts for risk profile
   - Starts monitoring loop

2. **add_token** (tokenAddress, network)
   - Adds token to watchlist
   - Begins data fetching
   - Starts decision loop

3. **get_positions** ()
   - Returns all open positions
   - Shows P&L if available

4. **get_market_data** (tokenAddress, network)
   - Fetches current and historical data
   - Returns price, volume, trends

## Future Extensions

### 1. Advanced Signals
- RSI, MACD, Bollinger Bands
- Support/resistance levels
- Multi-timeframe analysis

### 2. Portfolio Optimization
- Multi-token rebalancing
- Correlation analysis
- Risk-adjusted returns

### 3. Real-time Streaming
- WebSocket integration with Bitquery
- Event-driven architecture
- Low-latency trade execution

### 4. Backtesting
- Historical strategy testing
- Performance metrics
- Risk analysis

### 5. Advanced Position Management
- Partial exits
- Trailing stops
- Dynamic position sizing

