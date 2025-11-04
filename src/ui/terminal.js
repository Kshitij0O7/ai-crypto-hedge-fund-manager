/**
 * Terminal UI for user interaction
 */

import readline from 'readline';
import { Logger } from '../utils/logger.js';

export class TerminalUI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.riskProfile = null;
  }

  /**
   * Display welcome message and main menu
   */
  displayWelcome() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║     MCP Crypto Hedge Fund Manager Terminal v1.0     ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
  }

  /**
   * Prompt user to select risk profile
   */
  async selectRiskProfile() {
    return new Promise((resolve) => {
      console.log('1. High Risk High Returns');
      console.log('2. Low Risk Low Returns\n');
      
      this.rl.question('Enter any digit 1 or 2: ', (answer) => {
        const choice = answer.trim();
        
        if (choice === '1') {
          this.riskProfile = 'high';
          Logger.info('Selected: High Risk, High Returns profile');
          console.log('\nChecking the high risk coins...');
        } else if (choice === '2') {
          this.riskProfile = 'low';
          Logger.info('Selected: Low Risk, Low Returns profile');
          console.log('\nChecking the low risk coins...');
        } else {
          console.log('\nInvalid choice. Defaulting to Low Risk.');
          this.riskProfile = 'low';
          console.log('Checking the low risk coins...');
        }
        
        resolve(this.riskProfile);
      });
    });
  }

  /**
   * Display main trading dashboard
   * @param {Array} positions - Current positions
   * @param {number} capital - Available capital
   */
  displayDashboard(positions, capital) {
    console.clear();
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║              HEDGE FUND DASHBOARD                     ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
    
    console.log(`Risk Profile: ${this.riskProfile.toUpperCase()}`);
    console.log(`Total Capital: $${capital.toFixed(2)}`);
    console.log(`Open Positions: ${positions.length}\n`);
    
    if (positions.length > 0) {
      console.log('Current Positions:');
      console.log('─'.repeat(60));
      positions.forEach((pos, idx) => {
        console.log(`${idx + 1}. ${pos.type.toUpperCase()} - ${pos.tokenAddress.substring(0, 10)}...`);
        console.log(`   Entry: $${pos.entryPrice.toFixed(2)} | Size: $${pos.size.toFixed(2)}`);
        console.log(`   Stop Loss: ${((1 - pos.stopLoss) * 100).toFixed(2)}% | Take Profit: ${((pos.takeProfit - 1) * 100).toFixed(2)}%\n`);
      });
    } else {
      console.log('No open positions.\n');
    }
  }

  /**
   * Display trading action
   * @param {Object} action - Trading action to display
   */
  displayTradingAction(action) {
    console.log('\n' + '─'.repeat(60));
    console.log(`TRADING ACTION: ${action.action.toUpperCase()}`);
    
    if (action.action === 'open') {
      console.log(`Type: ${action.type.toUpperCase()}`);
      console.log(`Token: ${action.tokenAddress}`);
      console.log(`Reason: ${action.reason}`);
    } else if (action.action === 'close') {
      console.log(`Position ID: ${action.position.id}`);
      console.log(`Reason: ${action.reason}`);
      if (action.pnl) {
        const color = action.pnl > 0 ? '\x1b[32m' : '\x1b[31m'; // Green or Red
        console.log(`P&L: ${color}${(action.pnl * 100).toFixed(2)}%\x1b[0m`);
      }
    }
    
    console.log('─'.repeat(60) + '\n');
  }

  /**
   * Display market data
   * @param {Object} marketData - Current market data
   */
  displayMarketData(marketData) {
    console.log('\nMarket Data:');
    console.log(`Token: ${marketData.tokenAddress.substring(0, 20)}...`);
    console.log(`Current Price: $${marketData.currentPrice.price.toFixed(2)}`);
    console.log(`24h Volume: $${marketData.currentPrice.volume24h.toLocaleString()}`);
  }

  /**
   * Wait for user input to continue
   */
  async waitForInput(message = 'Press Enter to continue...') {
    return new Promise((resolve) => {
      this.rl.question(message, () => {
        resolve();
      });
    });
  }

  /**
   * Close the terminal interface
   */
  close() {
    this.rl.close();
  }
}

