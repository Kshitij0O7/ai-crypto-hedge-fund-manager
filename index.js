/**
 * Crypto Hedge Fund Manager - Main entry point
 */

import readline from 'readline';
import { BitqueryClient } from './src/services/bitquery.js';
import { TradingEngine } from './src/services/tradingEngine.js';
import { TerminalUI } from './src/ui/terminal.js';
import { Logger } from './src/utils/logger.js';
import dotenv from 'dotenv'

dotenv.config({ path: './.env' })

class HedgeFundManager {
  constructor() {
    this.terminal = new TerminalUI();
    this.bitqueryClient = null;
    this.tradingEngine = null;
    this.isRunning = false;
  }

  async start() {
    // Set up graceful shutdown handler FIRST, before any async operations
    this.setupGracefulShutdown();
    
    // Display welcome message
    this.terminal.displayWelcome();
    
    // Ask user to select risk profile
    const riskProfile = await this.terminal.selectRiskProfile();
    
    // Initialize services
    const apiKey = process.env.BITQUERY_API_KEY || '';
    const geminiApiKey = process.env.GEMINI_API_KEY || '';
    this.bitqueryClient = new BitqueryClient(apiKey);
    this.tradingEngine = new TradingEngine(riskProfile, geminiApiKey);
    
    this.isRunning = true;
    
    Logger.info(`Fund manager started with ${riskProfile} risk profile`);
    
    Logger.info(`Monitoring ${riskProfile} risk, ${riskProfile === 'low' ? 'low' : 'high'} volatility tokens`);
    
    // Start the main loop
    await this.mainLoop();
  }

  async mainLoop() {
    // Wait a moment to show the message
    await this.sleep(1000);
    
    console.log('\n📊 Fetching currency data from Bitquery...\n');
    
    try {
      // Fetch currency volatility data from Bitquery
      const currencies = await this.bitqueryClient.getCurrencyVolatilityData();
      
      // Select first 10 currencies based on risk profile
      const selectedCurrencies = this.selectCurrenciesForTrading(currencies);
      
      console.log(`✅ Selected ${selectedCurrencies.length} currencies for trading\n`);
      
      // Start AI trading for selected currencies
      await this.startAITrading(selectedCurrencies);
      
    } catch (error) {
      console.error(`\n❌ Error fetching data: ${error.message}`);
      console.log('\nPlease check your API key in the .env file');
      process.exit(1);
    }
  }

  selectCurrenciesForTrading(currencies) {
    // Bitquery returns currencies sorted descending by volatility (highest first)
    // For high risk: take first 10 (highest volatility)
    // For low risk: reverse and take first 10 (lowest volatility)
    let selected = [...currencies];
    
    if (this.tradingEngine.riskProfile === 'low') {
      // Reverse to get lowest volatility first
      selected = selected.reverse();
    }
    
    // Take first 10 currencies
    return selected.slice(0, 10);
  }

  async startAITrading(currencies) {
    console.log('\n🤖 Starting AI Trading Engine...\n');
    console.log('📊 Fetching trade metrics for all currencies...\n');
    
    // Step 1: Fetch all trade metrics first
    const currenciesWithMetrics = [];
    for (const currency of currencies) {
      const currencyId = currency.Currency.Id;
      const volatilityData = currency.volatility;
      
      try {
        // Fetch trade metrics (OHLC, Volume, Price, Weighted SMA)
        const tradeMetrics = await this.bitqueryClient.getTradeMetrics(currencyId, 24);
        currenciesWithMetrics.push({
          currencyId,
          volatilityData,
          tradeMetrics
        });
        process.stdout.write(`✓ Fetched metrics for ${currencyId.substring(0, 30)}...\n`);
        await this.sleep(100); // Small delay to avoid rate limiting
      } catch (error) {
        Logger.error(`Error fetching metrics for ${currencyId}: ${error.message}`);
        // Still add it with empty metrics for fallback
        currenciesWithMetrics.push({
          currencyId,
          volatilityData: currency,
          tradeMetrics: []
        });
      }
    }
    
    console.log('\n🤖 Analyzing all currencies with Gemini (single API call)...\n');
    
    // Step 2: Make single Gemini API call for all currencies
    const geminiDecisions = await this.tradingEngine.analyzeMultipleWithAI(currenciesWithMetrics);
    
    // Step 3: Execute all decisions
    for (let i = 0; i < currenciesWithMetrics.length; i++) {
      const { currencyId, tradeMetrics } = currenciesWithMetrics[i];
      const geminiDecision = geminiDecisions[i] || this.tradingEngine.fallbackDecision(
        currencyId,
        currenciesWithMetrics[i].volatilityData,
        tradeMetrics
      );
      
      try {
        const result = await this.tradingEngine.executeDecision(geminiDecision, {});
        console.log(result.message);
        await this.sleep(200);
      } catch (error) {
        Logger.error(`Error executing decision for ${currencyId}: ${error.message}`);
      }
    }
    
    console.log('\n✅ AI Trading cycle completed\n');
    console.log('💡 Press Ctrl+C to shutdown and close all positions...\n');
    
    // Keep the program running so user can test Ctrl+C
    // In a real scenario, you might want to add a monitoring loop here
    await new Promise(() => {}); // Wait indefinitely until interrupted
  }



  setupGracefulShutdown() {
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down gracefully...');
      
      this.isRunning = false;
      
      // Close all open positions
      if (this.tradingEngine) {
        const openPositions = this.tradingEngine.getOpenPositions();
        
        if (openPositions.length > 0) {
          console.log(`\n📊 Closing ${openPositions.length} open position(s)...\n`);
          
          // Pass bitqueryClient to fetch current prices before closing
          const closeResult = await this.tradingEngine.closeAllPositions(this.bitqueryClient);
          
          console.log('\n' + '─'.repeat(80));
          console.log('📉 POSITION CLOSURE SUMMARY');
          console.log('─'.repeat(80));
          
          closeResult.positions.forEach((pos, index) => {
            const { network, address } = this.tradingEngine.parseCurrencyId(pos.currencyId);
            const shortAddress = address.substring(0, 10) + '...' + address.slice(-6);
            const profitOrLoss = pos.pnl >= 0 ? 'profit' : 'loss';
            const amount = Math.abs(pos.pnl).toFixed(2);
            
            console.log(`${index + 1}. ${network}/${shortAddress}`);
            console.log(`   Type: ${pos.type.toUpperCase()} | Entry: $${pos.entryPrice.toFixed(6)} | Size: $${pos.size.toFixed(2)}`);
            console.log(`   P&L: $${amount} (${profitOrLoss})`);
            console.log('');
          });
          
          console.log(`Total Closed: ${closeResult.closedCount} position(s)`);
          console.log(`Total P&L: $${closeResult.totalPnL.toFixed(2)}`);
          console.log('─'.repeat(80));
        } else {
          console.log('\n📊 No open positions to close.');
        }
      }
      
      // Close terminal and exit
      this.terminal.close();
      console.log('\n✅ Shutdown complete.\n');
      process.exit(0);
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the hedge fund manager
const manager = new HedgeFundManager();
manager.start().catch(error => {
  Logger.error(`Failed to start: ${error.message}`);
  process.exit(1);
});

