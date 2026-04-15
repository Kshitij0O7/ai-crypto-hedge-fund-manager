/**
 * Agentic trading engine powered by Claude
 * Uses tool-use to let Claude autonomously fetch data and make trading decisions
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '../utils/logger.js';
import { BitqueryClient } from './bitquery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Load the trading strategy skill from .claude/skills/trading-strategy/SKILL.md
 * Strips YAML frontmatter and returns the markdown content as the system prompt.
 */
function loadTradingSkill() {
  const skillPath = join(__dirname, '../../.claude/skills/trading-strategy/SKILL.md');
  const raw = readFileSync(skillPath, 'utf-8');
  // Strip YAML frontmatter (between --- markers)
  const parts = raw.split('---');
  if (parts.length >= 3) {
    return parts.slice(2).join('---').trim();
  }
  return raw.trim();
}

// Tool definitions for the Claude agent
const TOOLS = [
  {
    name: 'get_market_data',
    description: 'Fetch OHLC, volume, and SMA market data for a trading pair from Bitquery. Returns the latest hourly candle plus historical data. Use this to analyze price action before making trading decisions.',
    input_schema: {
      type: 'object',
      properties: {
        pair: {
          type: 'string',
          enum: ['BTC', 'ETH', 'SOL'],
          description: 'The trading pair symbol to fetch data for (quoted against USDT)'
        },
        hours_ago: {
          type: 'number',
          description: 'Number of hours of historical data to fetch (default: 24)',
          default: 24
        }
      },
      required: ['pair']
    }
  },
  {
    name: 'get_portfolio_status',
    description: 'View the current portfolio including open positions, available capital, allocated capital, and P&L for each position.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'open_position',
    description: 'Open a new long or short position on a trading pair. Capital will be allocated based on risk parameters.',
    input_schema: {
      type: 'object',
      properties: {
        pair: {
          type: 'string',
          enum: ['BTC', 'ETH', 'SOL'],
          description: 'The trading pair to open a position on'
        },
        position_type: {
          type: 'string',
          enum: ['long', 'short'],
          description: 'Whether to go long (expecting price increase) or short (expecting price decrease)'
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation for why this position is being opened'
        }
      },
      required: ['pair', 'position_type', 'reasoning']
    }
  },
  {
    name: 'close_position',
    description: 'Close an existing open position on a trading pair. Will calculate P&L based on current market price.',
    input_schema: {
      type: 'object',
      properties: {
        pair: {
          type: 'string',
          enum: ['BTC', 'ETH', 'SOL'],
          description: 'The trading pair to close the position on'
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation for why this position is being closed'
        }
      },
      required: ['pair', 'reasoning']
    }
  }
];

export class TradingEngine {
  constructor(anthropicApiKey = null) {
    this.anthropicApiKey = anthropicApiKey;
    this.client = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;
    this.positions = new Map(); // Map<pair, Position>
    this.capital = 100000; // Starting capital in USD
    this.allocatedCapital = 0;
    this.bitqueryClient = null; // Set externally
    this.systemPrompt = loadTradingSkill();

    // Hedge fund risk parameters — conservative by design
    this.riskParams = {
      maxPositionSize: 0.1,   // 10% of capital per position
      stopLoss: 0.95,         // 5% stop loss
      takeProfit: 1.08        // 8% take profit
    };
  }

  /**
   * Set the Bitquery client for data fetching
   */
  setBitqueryClient(client) {
    this.bitqueryClient = client;
  }

  /**
   * Run a full trading cycle using Claude's agentic loop
   * Claude will autonomously fetch data, analyze, and make trading decisions
   */
  async runTradingCycle() {
    if (!this.client) {
      Logger.error('Anthropic API key not configured');
      throw new Error('Anthropic API key required for trading');
    }

    if (!this.bitqueryClient) {
      throw new Error('Bitquery client not set. Call setBitqueryClient() first.');
    }

    const pairs = BitqueryClient.getSupportedPairs();

    const userMessage = `Analyze the current market conditions for ${pairs.join(', ')} (all quoted against USDT) and make trading decisions.

Start by fetching market data for each pair, then check the current portfolio, and finally make your trading decisions (open, close, or hold positions).

Available capital: $${(this.capital - this.allocatedCapital).toFixed(2)} of $${this.capital.toFixed(2)} total.`;

    Logger.info('Starting Claude agentic trading cycle...');

    const messages = [{ role: 'user', content: userMessage }];

    // Agentic loop: keep calling Claude until it stops requesting tools
    let response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: this.systemPrompt,
      tools: TOOLS,
      messages
    });

    const actions = []; // Track actions for display

    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const textBlocks = response.content.filter(b => b.type === 'text');

      // Display any text Claude outputs
      for (const text of textBlocks) {
        if (text.text.trim()) {
          console.log(`\n🤖 ${text.text}`);
        }
      }

      // Process each tool call
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        console.log(`\n🔧 Calling tool: ${toolUse.name}(${JSON.stringify(toolUse.input)})`);

        const result = await this._executeTool(toolUse.name, toolUse.input);
        actions.push({ tool: toolUse.name, input: toolUse.input, result });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }

      // Feed results back to Claude
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });

      response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: this.systemPrompt,
        tools: TOOLS,
        messages
      });
    }

    // Display Claude's final analysis
    const finalText = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    if (finalText.trim()) {
      console.log(`\n📊 Claude's Analysis:\n${finalText}`);
    }

    return { actions, summary: finalText };
  }

  /**
   * Execute a tool call from Claude
   * @private
   */
  async _executeTool(name, input) {
    switch (name) {
      case 'get_market_data':
        return this._toolGetMarketData(input);
      case 'get_portfolio_status':
        return this._toolGetPortfolioStatus();
      case 'open_position':
        return this._toolOpenPosition(input);
      case 'close_position':
        return this._toolClosePosition(input);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  /**
   * Tool: Fetch market data from Bitquery
   */
  async _toolGetMarketData({ pair, hours_ago = 24 }) {
    try {
      const data = await this.bitqueryClient.getMarketData(pair, hours_ago);
      return data;
    } catch (error) {
      return { error: `Failed to fetch market data for ${pair}: ${error.message}` };
    }
  }

  /**
   * Tool: Get current portfolio status
   */
  _toolGetPortfolioStatus() {
    const openPositions = Array.from(this.positions.entries()).map(([pair, pos]) => ({
      pair: `${pair}/USDT`,
      type: pos.type,
      entryPrice: pos.entryPrice,
      size: pos.size,
      stopLoss: `${((1 - pos.stopLoss) * 100).toFixed(1)}%`,
      takeProfit: `${((pos.takeProfit - 1) * 100).toFixed(1)}%`,
      reasoning: pos.reasoning,
      openedAt: new Date(pos.timestamp).toISOString()
    }));

    return {
      totalCapital: this.capital,
      allocatedCapital: this.allocatedCapital,
      availableCapital: this.capital - this.allocatedCapital,
      openPositions,
      positionCount: openPositions.length
    };
  }

  /**
   * Tool: Open a new position
   */
  async _toolOpenPosition({ pair, position_type, reasoning }) {
    const upperPair = pair.toUpperCase();

    if (this.positions.has(upperPair)) {
      return { error: `Already have an open position on ${upperPair}/USDT. Close it first.` };
    }

    if (this.allocatedCapital >= this.capital * 0.9) {
      return { error: 'Not enough capital to open a new position (90% allocated).' };
    }

    // Fetch current price
    let entryPrice;
    try {
      entryPrice = await this.bitqueryClient.getCurrentPrice(upperPair);
      if (entryPrice === 0) {
        return { error: `Could not determine entry price for ${upperPair}/USDT.` };
      }
    } catch (error) {
      return { error: `Failed to fetch price for ${upperPair}: ${error.message}` };
    }

    const positionSize = this.capital * this.riskParams.maxPositionSize;

    const position = {
      id: `pos_${Date.now()}`,
      pair: upperPair,
      type: position_type,
      entryPrice,
      size: positionSize,
      timestamp: Date.now(),
      stopLoss: this.riskParams.stopLoss,
      takeProfit: this.riskParams.takeProfit,
      reasoning
    };

    this.positions.set(upperPair, position);
    this.allocatedCapital += positionSize;

    const action = position_type === 'long' ? '📈' : '📉';
    console.log(`\n${action} Opened ${position_type.toUpperCase()} position on ${upperPair}/USDT at $${entryPrice.toFixed(2)} | Size: $${positionSize.toFixed(2)}`);

    return {
      success: true,
      position: {
        pair: `${upperPair}/USDT`,
        type: position_type,
        entryPrice,
        size: positionSize,
        stopLoss: `${((1 - this.riskParams.stopLoss) * 100).toFixed(1)}%`,
        takeProfit: `${((this.riskParams.takeProfit - 1) * 100).toFixed(1)}%`
      },
      remainingCapital: this.capital - this.allocatedCapital
    };
  }

  /**
   * Tool: Close an existing position
   */
  async _toolClosePosition({ pair, reasoning }) {
    const upperPair = pair.toUpperCase();
    const position = this.positions.get(upperPair);

    if (!position) {
      return { error: `No open position on ${upperPair}/USDT.` };
    }

    // Fetch current price for P&L calculation
    let currentPrice;
    try {
      currentPrice = await this.bitqueryClient.getCurrentPrice(upperPair);
      if (currentPrice === 0) currentPrice = position.entryPrice;
    } catch {
      currentPrice = position.entryPrice;
    }

    let pnl;
    if (position.type === 'long') {
      pnl = ((currentPrice - position.entryPrice) / position.entryPrice) * position.size;
    } else {
      pnl = ((position.entryPrice - currentPrice) / position.entryPrice) * position.size;
    }

    this.positions.delete(upperPair);
    this.allocatedCapital -= position.size;

    const emoji = pnl >= 0 ? '💰' : '💸';
    const label = pnl >= 0 ? 'profit' : 'loss';
    console.log(`\n${emoji} Closed ${position.type.toUpperCase()} on ${upperPair}/USDT | P&L: $${Math.abs(pnl).toFixed(2)} (${label})`);

    return {
      success: true,
      pair: `${upperPair}/USDT`,
      type: position.type,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      pnl,
      reasoning
    };
  }

  /**
   * Get all open positions
   */
  getOpenPositions() {
    return Array.from(this.positions.values());
  }

  /**
   * Close all open positions (used for graceful shutdown)
   */
  async closeAllPositions() {
    const positions = this.getOpenPositions();

    if (positions.length === 0) {
      return { closedCount: 0, totalPnL: 0, positions: [] };
    }

    const closedPositions = [];
    let totalPnL = 0;

    for (const position of positions) {
      let currentPrice = position.entryPrice;

      if (this.bitqueryClient) {
        try {
          currentPrice = await this.bitqueryClient.getCurrentPrice(position.pair);
          if (currentPrice === 0) currentPrice = position.entryPrice;
        } catch {
          Logger.warn(`Could not fetch current price for ${position.pair}, using entry price`);
        }
      }

      let pnl;
      if (position.type === 'long') {
        pnl = ((currentPrice - position.entryPrice) / position.entryPrice) * position.size;
      } else {
        pnl = ((position.entryPrice - currentPrice) / position.entryPrice) * position.size;
      }

      this.positions.delete(position.pair);
      this.allocatedCapital -= position.size;
      closedPositions.push({ ...position, currentPrice, pnl });
      totalPnL += pnl;
    }

    return { closedCount: closedPositions.length, totalPnL, positions: closedPositions };
  }
}
