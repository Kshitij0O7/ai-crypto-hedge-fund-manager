# Crypto Hedge Fund Manager

A terminal-based crypto hedge fund manager that pulls on-chain trade data from Bitquery API and displays cryptocurrencies sorted by volatility based on your risk profile.

## Features

- **Gemini-Powered Trading**: AI-driven trading decisions using Google Gemini with comprehensive prompts
- **Risk-Based Analysis**: Choose between Low Risk/Low Returns or High Risk/High Returns profiles
- **Real-Time Data**: Bitquery API integration for OHLC, Volume, Price, and Weighted SMA
- **Automatic Decisions**: LLM analyzes market data and executes trades (Open/Close/Hold)
- **Position Management**: Stop-loss, take-profit, and capital allocation based on risk profile
- **Terminal UI**: Command-line interface showing trading actions in real-time

## Architecture

```
src/
├── services/
│   ├── bitquery.js        # Bitquery API client (OHLC, Volume, Price, Weighted SMA)
│   └── tradingEngine.js   # Gemini-powered trading decision engine
├── strategies/
│   └── baseStrategy.js    # Trading strategies (Low/High risk prompts)
├── ui/
│   └── terminal.js        # Terminal user interface
└── utils/
    └── logger.js          # Logging utility
index.js                   # Main application entry point
```

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure API Keys**
   - Bitquery API key is hardcoded in index.js for demonstration
   - For Gemini-powered trading: Set `GEMINI_API_KEY` in `.env` file
   - Get API keys from:
     - [Bitquery](https://graphql.bitquery.io)
     - [Google AI Studio](https://makersuite.google.com/app/apikey) (Gemini API key)

## Usage

### Run the Application

```bash
npm start
```

This will:
1. Display a welcome message
2. Prompt you to select a risk profile (1 for High Risk/High Returns or 2 for Low Risk/Low Returns)
3. Show "Checking the high risk coins..." or "Checking the low risk coins..." based on your selection
4. Fetch real data from Bitquery API (volatility, OHLC, Volume, Price, Weighted SMA)
5. Display list of cryptocurrencies sorted by volatility
6. Gemini analyzes all currencies together and makes trading decisions (Open/Close/Hold)
7. Display trading actions: "Opening Long position...", "Closing Short position...", etc.

### Risk Profiles

When you select your risk profile:
   - **Option 1**: High Risk High Returns
     - Displays cryptocurrencies sorted by **highest** volatility first
     - Most volatile tokens at the top
   
   - **Option 2**: Low Risk Low Returns
     - Displays cryptocurrencies sorted by **lowest** volatility first
     - Least volatile tokens at the top

## Data Display

The application fetches real currency data from Bitquery API and displays:
- **Rank**: Position in the volatility sorted list
- **Network**: Blockchain network (e.g., Solana, Ethereum)
- **Address**: Token contract address
- **Volatility**: Calculated volatility percentage (standard deviation from average price)

## Technical Details

### Volatility Calculation
- Uses standard deviation from average price provided by Bitquery
- Formula: `volatility = 100 * (standard_deviation / average_price)`

### Bitquery Integration
- Real-time data from Bitquery GraphQL API
- Fetches hourly price intervals with USD quotes
- Processes and sorts ~25,000 cryptocurrency pairs

### AI Trading Flow

1. **Fetch Data**: Get currencies with volatility from Bitquery
2. **Risk Filtering**: Filter by volatility range (<50% for low risk, >=50% for high risk)
3. **Fetch Metrics**: Get OHLC, Volume, Price, Weighted SMA for each currency
4. **Gemini Analysis**: Send strategy + metrics for all currencies to Google Gemini 1.5 Flash (single API call)
5. **Decision**: Parse response (OPEN LONG, OPEN SHORT, CLOSE, HOLD)
6. **Execute**: Open/Close positions with automatic stop-loss/take-profit
7. **Display**: Show trading actions with profit/loss amounts

### Current Status

✅ **Working Features:**
- Real Bitquery API integration (getTradeMetrics, getCurrencyVolatilityData)
- Google Gemini 1.5 Flash powered trading decisions (single API call for 10 currencies)
- Risk-based strategies with customizable prompts
- Automatic position management (stop-loss, take-profit, capital allocation)
- Real-time trading action display
- Fallback logic if Gemini API fails

🔧 **Future Enhancements:**
- Real DEX trade execution
- WebSocket streaming for live updates
- Portfolio rebalancing
- Backtesting framework
- Multiple strategy support

## License

MIT

