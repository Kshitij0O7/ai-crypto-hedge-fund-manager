# Project Summary

## What Was Built

A **Crypto Hedge Fund Manager** terminal application that:
1. Connects to Bitquery API to fetch real cryptocurrency volatility data
2. Displays cryptocurrencies sorted by volatility based on user's risk profile
3. Parses and extracts network and address information from currency IDs
4. Shows ~25,000 cryptocurrencies in a formatted table

## Key Features

✅ **Real Bitquery API Integration**
- Live data from Bitquery GraphQL endpoint
- Fetches volatility metrics (standard deviation, average, calculated volatility)

✅ **Risk-Based Sorting**
- High Risk: Sorted by highest volatility (most volatile first)
- Low Risk: Sorted by lowest volatility (most stable first)

✅ **Network & Address Parsing**
- Extracts blockchain network from currency IDs (Solana, Ethereum, etc.)
- Displays full token contract addresses

✅ **Terminal UI**
- Clean, formatted table display
- Shows rank, network, address, and volatility percentage

## Project Structure

```
crypto-hedge-fund/
├── index.js                # Main application entry point
├── src/
│   ├── services/
│   │   ├── bitquery.js     # Bitquery API client
│   │   └── tradingEngine.js # Trading logic (for future use)
│   ├── ui/
│   │   └── terminal.js      # Terminal user interface
│   └── utils/
│       └── logger.js        # Logging utility
├── package.json
└── README.md
```

## How It Works

1. User runs `npm start`
2. Selects risk profile (1 for High Risk or 2 for Low Risk)
3. App fetches currency data from Bitquery API
4. Parses currency IDs to extract network and address
5. Sorts currencies by volatility (descending for high risk, ascending for low risk)
6. Displays formatted table with full addresses

## Key Decisions

**Why `index.js` instead of `server.js`?**
- Originally planned as an MCP server, but requirements were simpler
- `index.js` is the working standalone terminal app
- `src/server.js` is unused MCP server code (can be removed)

**Why Bitquery API?**
- User provided specific Bitquery GraphQL query
- API key was included in requirements
- Returns currency volatility data with all needed fields

## Current Status

✅ **Working:** Bitquery API integration, volatility sorting, full address display  
🔧 **Future:** Trading automation, portfolio management, real-time monitoring

## Usage

```bash
npm start
# Select 1 for High Risk or 2 for Low Risk
```

The application will display sorted list of cryptocurrencies based on volatility!

