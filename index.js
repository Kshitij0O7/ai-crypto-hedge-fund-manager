/**
 * Crypto Hedge Fund Manager - Main entry point
 * Uses Claude agent with tool-use to trade BTC/USDT, ETH/USDT, SOL/USDT
 */

import { BitqueryClient } from './src/services/bitquery.js';
import { TradingEngine } from './src/services/tradingEngine.js';
import { TerminalUI } from './src/ui/terminal.js';
import { Logger } from './src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

class HedgeFundManager {
  constructor() {
    this.terminal = new TerminalUI();
    this.bitqueryClient = null;
    this.tradingEngine = null;
    this.isRunning = false;
  }

  async start() {
    this.setupGracefulShutdown();

    this.terminal.displayWelcome();

    // Initialize services
    const bitqueryApiKey = process.env.BITQUERY_API_KEY || '';
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

    if (!anthropicApiKey) {
      console.error('\n❌ ANTHROPIC_API_KEY not set in .env file');
      process.exit(1);
    }

    this.bitqueryClient = new BitqueryClient(bitqueryApiKey);
    this.tradingEngine = new TradingEngine(anthropicApiKey);
    this.tradingEngine.setBitqueryClient(this.bitqueryClient);

    this.isRunning = true;

    Logger.info('Hedge fund manager started');

    const pairs = BitqueryClient.getSupportedPairs();
    console.log(`📊 Trading pairs: ${pairs.map(p => `${p}/USDT`).join(', ')}`);
    console.log(`💰 Starting capital: $100,000\n`);

    await this.mainLoop();
  }

  async mainLoop() {
    try {
      console.log('\n🤖 Starting Claude AI Trading Agent...\n');
      console.log('─'.repeat(60));

      // Run the agentic trading cycle — Claude will autonomously
      // fetch data, analyze markets, and execute trades via tools
      await this.tradingEngine.runTradingCycle();

      console.log('\n─'.repeat(60));
      console.log('\n✅ Trading cycle completed');
      console.log('💡 Press Ctrl+C to shutdown and close all positions...\n');

      // Keep running until interrupted
      await new Promise(() => {});

    } catch (error) {
      console.error(`\n❌ Error during trading: ${error.message}`);
      console.log('\nPlease check your API keys in the .env file');
      process.exit(1);
    }
  }

  setupGracefulShutdown() {
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down gracefully...');

      this.isRunning = false;

      if (this.tradingEngine) {
        const openPositions = this.tradingEngine.getOpenPositions();

        if (openPositions.length > 0) {
          console.log(`\n📊 Closing ${openPositions.length} open position(s)...\n`);

          const closeResult = await this.tradingEngine.closeAllPositions();

          console.log('\n' + '─'.repeat(60));
          console.log('📉 POSITION CLOSURE SUMMARY');
          console.log('─'.repeat(60));

          closeResult.positions.forEach((pos, index) => {
            const profitOrLoss = pos.pnl >= 0 ? 'profit' : 'loss';
            const amount = Math.abs(pos.pnl).toFixed(2);

            console.log(`${index + 1}. ${pos.pair}/USDT`);
            console.log(`   Type: ${pos.type.toUpperCase()} | Entry: $${pos.entryPrice.toFixed(2)} | Size: $${pos.size.toFixed(2)}`);
            console.log(`   P&L: $${amount} (${profitOrLoss})`);
            console.log('');
          });

          console.log(`Total Closed: ${closeResult.closedCount} position(s)`);
          console.log(`Total P&L: $${closeResult.totalPnL.toFixed(2)}`);
          console.log('─'.repeat(60));
        } else {
          console.log('\n📊 No open positions to close.');
        }
      }

      this.terminal.close();
      console.log('\n✅ Shutdown complete.\n');
      process.exit(0);
    });
  }
}

const manager = new HedgeFundManager();
manager.start().catch(error => {
  Logger.error(`Failed to start: ${error.message}`);
  process.exit(1);
});
