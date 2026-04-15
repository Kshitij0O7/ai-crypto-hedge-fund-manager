/**
 * Terminal UI for user interaction
 */

import readline from 'readline';

export class TerminalUI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  displayWelcome() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║   AI Crypto Hedge Fund Manager (Claude Agent) v2.0  ║');
    console.log('║   Trading: BTC/USDT, ETH/USDT, SOL/USDT            ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');
  }

  close() {
    this.rl.close();
  }
}
