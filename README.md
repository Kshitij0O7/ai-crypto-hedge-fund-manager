# Crypto AI Hedge Fund Manager - AI-Powered Cryptocurrency Trading System

An advanced **crypto hedge fund manager** powered by **AI** that automatically analyzes on-chain data and executes trading decisions. This **crypto hedge fund** application leverages Google Gemini AI and Bitquery's real-time market data to manage cryptocurrency positions with sophisticated risk management strategies.

## 🚀 Overview

This **AI hedge fund** system is a terminal-based **crypto hedge fund manager** designed for automated cryptocurrency trading. It combines real-time blockchain data from Bitquery with Google Gemini AI to make intelligent trading decisions, implementing professional **hedging** strategies for both high-risk and low-risk **crypto hedge fund** portfolios.

### Key Features

- **AI-Powered Trading**: Advanced **AI hedge fund** technology using Google Gemini for intelligent market analysis
- **Crypto Hedge Fund Strategies**: Professional risk-based strategies (High Risk/High Returns or Low Risk/Low Returns)
- **Real-Time Market Data**: Integration with Bitquery Crypto Price API for OHLC, Volume, Price, and Weighted SMA
- **Automated Position Management**: Intelligent stop-loss, take-profit, and capital allocation
- **Multi-Currency Analysis**: Simultaneously analyzes 10 cryptocurrencies in a single AI call
- **Terminal Interface**: Clean command-line interface for real-time trading operations

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Installation & Setup](#-installation--setup)
- [Getting API Keys](#-getting-api-keys)
- [Usage](#-usage)
- [How It Works](#-how-it-works)
- [Risk Profiles](#-risk-profiles)
- [Technical Details](#-technical-details)
- [Project Structure](#-project-structure)

## ✨ Features

### AI-Powered Trading Engine

Our **crypto AI hedge fund** system uses Google Gemini 1.5 Flash to analyze market conditions across multiple cryptocurrencies simultaneously. The AI makes intelligent trading decisions based on:

- OHLC (Open, High, Low, Close) data
- Moving averages (Weighted SMA)
- Trading volume metrics
- Volatility calculations
- Risk profile strategies

### Risk-Based Portfolio Management

Choose your **crypto hedge fund** strategy:

- **High Risk High Returns**: Aggressive **hedging** strategy targeting volatile cryptocurrencies
- **Low Risk Low Returns**: Conservative approach focusing on stable, established tokens

### Real-Time Data Integration

Powered by [Bitquery Crypto Price API](https://docs.bitquery.io/docs/category/crypto-price-apis/?utm_source=github_readme&utm_medium=referral&utm_campaign=crypto-hedge-fund), providing:

- Real-time cryptocurrency prices
- Historical OHLC candle data
- Volume and liquidity metrics
- Market volatility calculations

### Automated Position Management

- Automatic stop-loss and take-profit execution
- Capital allocation based on risk profile
- Position tracking and P&L calculations
- Graceful shutdown with position closure (Ctrl+C)

## 🏗️ Architecture

### System Flow

```
User Input (Terminal)
       ↓
Hedge Fund Manager
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

### Core Components

#### 1. Trading Engine (`src/services/tradingEngine.js`)
The heart of our **AI hedge fund** system:
- **AI Decision Making**: Analyzes multiple currencies with Google Gemini
- **Position Management**: Opens/closes positions with automatic risk controls
- **Capital Allocation**: Manages position sizing based on risk profile
- **Fallback Logic**: Ensures trading continues even if AI API fails

#### 2. Bitquery Client (`src/services/bitquery.js`)
Real-time cryptocurrency data provider:
- Fetches volatility data for 25,000+ currency pairs
- Retrieves OHLC, Volume, Price, and Weighted SMA metrics
- Handles API authentication and error management

#### 3. Terminal UI (`src/ui/terminal.js`)
User interface layer:
- Welcome screen and risk profile selection
- Real-time trading action display
- Position status updates

#### 4. Strategy Manager (`src/strategies/baseStrategy.js`)
Customizable trading strategies:
- Low-risk conservative prompts
- High-risk aggressive prompts
- Strategy customization for different market conditions

## 📦 Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Bitquery API key ([Get one here](https://account.bitquery.io/user/api_v2/access_tokens?utm_source=github_readme&utm_medium=referral&utm_campaign=crypto-hedge-fund))
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Quick Start

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd mcp-hedge-fund
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the root directory:
   ```env
   BITQUERY_API_KEY=your_bitquery_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run the Application**
   ```bash
   npm start
   ```

### Testing

You can test the application with different risk profiles:

```bash
# Test with High Risk profile
echo "1" | npm start

# Test with Low Risk profile  
echo "2" | npm start

# Or run interactively
npm start
```

## 🔑 Getting API Keys

### Bitquery API Key

Bitquery provides comprehensive cryptocurrency market data APIs:

1. **Sign Up**: [Create a Bitquery account](https://account.bitquery.io/auth/signup?utm_source=github_readme&utm_medium=referral&utm_campaign=crypto-hedge-fund)

2. **Get Access Token**: 
   - Visit the [Access Tokens page](https://account.bitquery.io/user/api_v2/access_tokens?utm_source=github_readme&utm_medium=referral&utm_campaign=crypto-hedge-fund)
   - Generate a new access token or use an existing one

3. **Learn More**: 
   - [Crypto Price API Documentation](https://docs.bitquery.io/docs/category/crypto-price-apis/?utm_source=github_readme&utm_medium=referral&utm_campaign=crypto-hedge-fund)
   - [How to Generate Access Token Guide](https://docs.bitquery.io/docs/authorisation/how-to-generate/?utm_source=github_readme&utm_medium=referral&utm_campaign=crypto-hedge-fund)

### Google Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add it to your `.env` file

## 💻 Usage

### Running the Application

```bash
npm start
```

### Application Flow

1. **Welcome Screen**: The application displays a welcome message
2. **Risk Profile Selection**: Choose between:
   - Option 1: High Risk High Returns
   - Option 2: Low Risk Low Returns
3. **Data Fetching**: The system fetches real-time data from Bitquery
4. **AI Analysis**: Gemini AI analyzes all 10 selected currencies
5. **Trading Decisions**: The system executes trading actions (Open/Close/Hold)
6. **Position Management**: Positions are tracked with automatic risk controls

### Expected Output

**High Risk Profile:**
```
Enter any digit 1 or 2: 1
Checking the high risk coins...
📊 Fetching currency data from Bitquery...
✅ Selected 10 currencies for trading
🤖 Starting AI Trading Engine...
```

**Low Risk Profile:**
```
Enter any digit 1 or 2: 2
Checking the low risk coins...
📊 Fetching currency data from Bitquery...
✅ Selected 10 currencies for trading
🤖 Starting AI Trading Engine...
```

### Graceful Shutdown

Press `Ctrl+C` to shutdown the application. All open positions will be automatically closed with a detailed summary:

```
🛑 Shutting down gracefully...
📊 Closing 3 open position(s)...

────────────────────────────────────────────────────────────────────────────────
📉 POSITION CLOSURE SUMMARY
────────────────────────────────────────────────────────────────────────────────
Total Closed: 3 position(s)
Total P&L: $1,234.56
```

## 🔄 How It Works

### Data Flow

1. **Fetch Currency Data**: Retrieves volatility data from Bitquery for 25,000+ cryptocurrency pairs
2. **Risk Filtering**: Selects top 10 currencies based on risk profile (highest or lowest volatility)
3. **Fetch Trade Metrics**: Retrieves OHLC, Volume, Price, and Weighted SMA for each currency
4. **AI Analysis**: Sends all 10 currencies to Google Gemini in a single API call
5. **Decision Parsing**: Parses AI response (OPEN LONG, OPEN SHORT, CLOSE, HOLD)
6. **Position Execution**: Opens/closes positions with automatic stop-loss/take-profit
7. **Display Results**: Shows trading actions with profit/loss amounts

### AI Trading Flow

```
Fetch Data → Risk Filtering → Fetch Metrics → Gemini Analysis → Execute → Display
     ↓             ↓              ↓                ↓              ↓         ↓
 Bitquery    Top 10 Currencies  OHLC/Volume   AI Decision   Position   Terminal
   API         Selection         Metrics        (JSON)      Management   Output
```

### Volatility Calculation

The system uses Bitquery's built-in volatility calculation:

```
volatility = 100 * (standard_deviation / average_price)
```

This formula provides the volatility percentage used for sorting and risk assessment.

## 📊 Risk Profiles

### High Risk, High Returns Strategy

This **crypto hedge fund** strategy targets volatile cryptocurrencies for maximum returns:

```javascript
{
  maxPositionSize: 0.3,      // 30% of capital per position
  volatilityThreshold: 0.05, // 5% volatility required
  stopLoss: 0.90,            // 10% stop loss
  takeProfit: 1.15           // 15% take profit
}
```

- Targets cryptocurrencies with **highest volatility**
- Larger position sizes (30% of capital)
- Wider stop-loss (10%) and take-profit (15%) margins
- Suitable for aggressive **hedging** strategies

### Low Risk, Low Returns Strategy

Conservative **crypto hedge fund** approach focusing on stability:

```javascript
{
  maxPositionSize: 0.1,      // 10% of capital per position
  volatilityThreshold: 0.02, // 2% volatility required
  stopLoss: 0.95,            // 5% stop loss
  takeProfit: 1.05           // 5% take profit
}
```

- Targets cryptocurrencies with **lowest volatility**
- Smaller position sizes (10% of capital)
- Tighter stop-loss (5%) and take-profit (5%) margins
- Suitable for conservative **hedging** strategies

## 🔧 Technical Details

### Position Structure

Each position contains:

```javascript
{
  id: "pos_1234567890",
  currencyId: "bid:solana:XXX...",
  tokenAddress: "0x123...abc",
  network: "solana",
  type: "long" | "short",
  entryPrice: 0.000072,
  size: 30000.00,
  timestamp: 1234567890,
  stopLoss: 0.90,
  takeProfit: 1.15,
  confidence: 0.7,
  reasoning: "AI analysis reasoning...",
  expectedProfit: 4500.00
}
```

### Bitquery Integration

The application uses Bitquery's GraphQL API:

- **Endpoint**: `https://graphql.bitquery.io`
- **Authentication**: Bearer token in Authorization header
- **Real-time Data**: Hourly price intervals with USD quotes
- **Currency Coverage**: 25,000+ cryptocurrency pairs

### AI Integration

- **Model**: Google Gemini 1.5 Flash
- **API Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent`
- **Batch Processing**: Single API call for all 10 currencies
- **Response Format**: JSON array with trading decisions
- **Fallback**: Automatic fallback logic if AI API fails

### Position Management

- **Capital Tracking**: Monitors allocated vs. available capital
- **Stop Loss**: Automatic position closure on loss threshold
- **Take Profit**: Automatic position closure on profit target
- **P&L Calculation**: Real-time profit/loss tracking
- **Graceful Shutdown**: Closes all positions on Ctrl+C

## 📁 Project Structure

```
mcp-hedge-fund/
├── index.js                    # Main application entry point
├── package.json                # Project dependencies
├── .env                        # Environment variables (create this)
├── .env.example                # Environment variables template
├── src/
│   ├── services/
│   │   ├── bitquery.js         # Bitquery API client
│   │   └── tradingEngine.js    # AI-powered trading engine
│   ├── strategies/
│   │   └── baseStrategy.js     # Trading strategy prompts
│   ├── ui/
│   │   └── terminal.js         # Terminal user interface
│   └── utils/
│       └── logger.js           # Logging utility
└── README.md                   # This file
```

## 🎯 Current Status

### ✅ Working Features

- ✅ Real Bitquery API integration (getTradeMetrics, getCurrencyVolatilityData)
- ✅ Google Gemini AI-powered trading decisions (batch processing)
- ✅ Risk-based strategies with customizable prompts
- ✅ Automatic position management (stop-loss, take-profit, capital allocation)
- ✅ Real-time trading action display
- ✅ Fallback logic if AI API fails
- ✅ Graceful shutdown with position closure
- ✅ Multi-currency analysis (10 currencies in single API call)

### 🔮 Future Enhancements

- 🔧 Real DEX trade execution integration
- 🔧 WebSocket streaming for live market updates
- 🔧 Portfolio rebalancing algorithms
- 🔧 Backtesting framework for strategy validation
- 🔧 Multiple simultaneous strategy support
- 🔧 Advanced technical indicators (RSI, MACD, Bollinger Bands)
- 🔧 Multi-timeframe analysis
- 🔧 Correlation analysis for portfolio optimization

## 📚 Additional Resources

- [Bitquery Crypto Price API Documentation](https://docs.bitquery.io/docs/category/crypto-price-apis/?utm_source=github_readme&utm_medium=referral&utm_campaign=crypto-hedge-fund)
- [Bitquery Access Token Guide](https://docs.bitquery.io/docs/authorisation/how-to-generate/?utm_source=github_readme&utm_medium=referral&utm_campaign=crypto-hedge-fund)
- [Bitquery Sign Up](https://account.bitquery.io/auth/signup?utm_source=github_readme&utm_medium=referral&utm_campaign=crypto-hedge-fund)

## 📄 License

MIT License - Feel free to use this **crypto hedge fund manager** for your own projects!

---

**Built for Automated Crypto Trading** | **AI-Powered Hedge Fund Management** | **Professional Risk Management**

