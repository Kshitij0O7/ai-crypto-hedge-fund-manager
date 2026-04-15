/**
 * Trading decision engine using Claude AI with agentic tool-use
 * Claude autonomously fetches market data, analyzes conditions, and executes trades
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { BitqueryClient } from './bitquery.js';

export class TradingEngine {
  constructor(anthropicApiKey) {
    this.client = new Anthropic({ apiKey: anthropicApiKey });
    this.bitqueryClient = null;
    this.positions = new Map(); // Map<symbol, Position>
    this.capital = 100000; // Starting capital in USD
    this.allocatedCapital = 0;
    this.riskParams = this.getRiskParameters('low');
  }

  /**
   * Set the Bitquery client for market data fetching
   */
  setBitqueryClient(client) {
    this.bitqueryClient = client;
  }

  /**
   * Get risk parameters based on selected profile
   */
  getRiskParameters(profile) {
    const profiles = {
      low: {
        maxPositionSize: 0.1,
        volatilityThreshold: 0.02,
        stopLoss: 0.95,
        takeProfit: 1.08,
      },
      high: {
        maxPositionSize: 0.3,
        volatilityThreshold: 0.05,
        stopLoss: 0.90,
        takeProfit: 1.15,
      },
    };
    return profiles[profile] || profiles.low;
  }

  /**
   * Load the trading strategy from the SKILL.md file
   */
  loadStrategy() {
    const skillPath = path.join(process.cwd(), 'skills', 'trading-strategy', 'SKILL.md');
    const content = fs.readFileSync(skillPath, 'utf-8');
    // Strip YAML frontmatter
    const stripped = content.replace(/^---[\s\S]*?---\n/, '');
    return stripped.trim();
  }

  /**
   * Define the tools Claude can use during trading
   */
  getToolDefinitions() {
    const supportedSymbols = BitqueryClient.getSupportedPairs();
    return [
      {
        name: 'get_market_data',
        description: 'Fetch comprehensive market data for a trading pair against USDT. Returns: 1-minute OHLCV candles (24h), VWAP, Volume Profile with Point of Control, current price, market cap, FDV, and moving averages (SMA, WMA, EMA). Also includes pre-computed trend signals (price vs VWAP/SMA/EMA/POC).',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              enum: supportedSymbols,
              description: 'The cryptocurrency symbol to fetch data for',
            },
          },
          required: ['symbol'],
        },
      },
      {
        name: 'get_portfolio_status',
        description: 'Get current portfolio state including total capital, allocated capital, available capital, and all open positions with their entry prices, sizes, stop-loss/take-profit levels, and unrealized P&L.',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'open_position',
        description: 'Open a new long or short position on a trading pair. Position size is determined by risk parameters (max 10% of capital). Will fail if max allocation (30%) is reached or a position already exists on the pair.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              enum: supportedSymbols,
              description: 'The cryptocurrency to trade',
            },
            position_type: {
              type: 'string',
              enum: ['long', 'short'],
              description: 'Whether to go long (buy) or short (sell)',
            },
            reasoning: {
              type: 'string',
              description: 'Explanation for why this trade is being made, referencing the analysis',
            },
          },
          required: ['symbol', 'position_type', 'reasoning'],
        },
      },
      {
        name: 'close_position',
        description: 'Close an existing position on a trading pair and realize P&L. Will fail if no position exists on the pair.',
        input_schema: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              enum: supportedSymbols,
              description: 'The cryptocurrency position to close',
            },
            reasoning: {
              type: 'string',
              description: 'Explanation for why this position is being closed',
            },
          },
          required: ['symbol', 'reasoning'],
        },
      },
    ];
  }

  /**
   * Dispatch tool calls to the appropriate handler
   */
  async handleToolCall(toolName, toolInput) {
    switch (toolName) {
      case 'get_market_data':
        return await this.toolGetMarketData(toolInput);
      case 'get_portfolio_status':
        return this.toolGetPortfolioStatus();
      case 'open_position':
        return await this.toolOpenPosition(toolInput);
      case 'close_position':
        return await this.toolClosePosition(toolInput);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  /**
   * Tool: Fetch market data for a symbol
   */
  async toolGetMarketData({ symbol }) {
    if (!this.bitqueryClient) {
      return { error: 'Bitquery client not initialized' };
    }
    const data = await this.bitqueryClient.getMarketData(symbol);
    return data;
  }

  /**
   * Tool: Get current portfolio status
   */
  toolGetPortfolioStatus() {
    const positions = this.getOpenPositions().map(pos => ({
      symbol: pos.symbol,
      type: pos.type,
      entryPrice: pos.entryPrice,
      size: pos.size,
      stopLoss: `${((1 - pos.stopLoss) * 100).toFixed(1)}%`,
      takeProfit: `${((pos.takeProfit - 1) * 100).toFixed(1)}%`,
      reasoning: pos.reasoning,
      openedAt: new Date(pos.timestamp).toISOString(),
    }));

    return {
      totalCapital: this.capital,
      allocatedCapital: this.allocatedCapital,
      availableCapital: this.capital - this.allocatedCapital,
      maxAllocation: this.capital * 0.3,
      positionSizePerTrade: this.capital * this.riskParams.maxPositionSize,
      maxConcurrentPositions: 3,
      openPositions: positions,
      openPositionCount: positions.length,
    };
  }

  /**
   * Tool: Open a new position
   */
  async toolOpenPosition({ symbol, position_type, reasoning }) {
    // Check if position already exists
    if (this.positions.has(symbol)) {
      return { error: `Position already exists for ${symbol}. Close it first.` };
    }

    // Check capital limits
    if (this.positions.size >= 3) {
      return { error: 'Maximum 3 concurrent positions reached.' };
    }

    if (this.allocatedCapital >= this.capital * 0.3) {
      return { error: 'Maximum capital allocation (30%) reached.' };
    }

    // Fetch current price
    let currentPrice = 0;
    try {
      const priceData = await this.bitqueryClient.getPriceAction(symbol);
      currentPrice = priceData.price;
    } catch (error) {
      return { error: `Failed to fetch current price for ${symbol}: ${error.message}` };
    }

    if (currentPrice <= 0) {
      return { error: `Invalid price for ${symbol}: ${currentPrice}` };
    }

    const positionSize = this.capital * this.riskParams.maxPositionSize;
    const position = {
      id: `pos_${Date.now()}`,
      symbol,
      pair: `${symbol}/USDT`,
      type: position_type,
      entryPrice: currentPrice,
      size: positionSize,
      timestamp: Date.now(),
      stopLoss: this.riskParams.stopLoss,
      takeProfit: this.riskParams.takeProfit,
      reasoning,
      expectedProfit: this.calculateExpectedProfit(positionSize, currentPrice, this.riskParams.takeProfit),
    };

    this.positions.set(symbol, position);
    this.allocatedCapital += positionSize;

    Logger.info(`Position opened: ${position.id} — ${position_type.toUpperCase()} ${symbol} @ $${currentPrice.toFixed(2)}`);

    return {
      success: true,
      position: {
        id: position.id,
        symbol: position.symbol,
        pair: position.pair,
        type: position.type,
        entryPrice: position.entryPrice,
        size: position.size,
        stopLossPercent: `${((1 - position.stopLoss) * 100).toFixed(1)}%`,
        takeProfitPercent: `${((position.takeProfit - 1) * 100).toFixed(1)}%`,
        expectedProfit: position.expectedProfit,
      },
    };
  }

  /**
   * Tool: Close an existing position
   */
  async toolClosePosition({ symbol, reasoning }) {
    const position = this.positions.get(symbol);
    if (!position) {
      return { error: `No open position for ${symbol}.` };
    }

    // Fetch current price
    let currentPrice = position.entryPrice;
    try {
      const priceData = await this.bitqueryClient.getPriceAction(symbol);
      currentPrice = priceData.price || position.entryPrice;
    } catch (error) {
      Logger.warn(`Could not fetch current price for ${symbol}, using entry price`);
    }

    // Calculate P&L
    let pnl = 0;
    if (position.type === 'long') {
      pnl = ((currentPrice - position.entryPrice) / position.entryPrice) * position.size;
    } else {
      pnl = ((position.entryPrice - currentPrice) / position.entryPrice) * position.size;
    }

    this.positions.delete(symbol);
    this.allocatedCapital -= position.size;
    this.capital += pnl;

    Logger.info(`Position closed: ${position.id} — ${symbol} P&L: $${pnl.toFixed(2)}`);

    return {
      success: true,
      closedPosition: {
        id: position.id,
        symbol: position.symbol,
        pair: position.pair,
        type: position.type,
        entryPrice: position.entryPrice,
        exitPrice: currentPrice,
        size: position.size,
        pnl: pnl,
        pnlPercent: `${((pnl / position.size) * 100).toFixed(2)}%`,
        reasoning,
      },
    };
  }

  /**
   * Run a full agentic trading cycle — Claude autonomously fetches data,
   * analyzes markets, and executes trades using tools
   */
  async runTradingCycle() {
    const systemPrompt = this.loadStrategy();
    const tools = this.getToolDefinitions();

    const pairs = BitqueryClient.getSupportedPairs();
    const pairsList = pairs.map(p => `${p}/USDT`).join(', ');

    const messages = [
      {
        role: 'user',
        content: `Analyze the current market conditions for ${pairsList}.

Follow the trading strategy to:
1. Fetch market data for each pair using get_market_data (returns OHLCV, VWAP, Volume Profile, moving averages, and trend signals)
2. Check the current portfolio using get_portfolio_status
3. Evaluate each pair against the entry/exit/hold criteria using the rich indicator data
4. Execute any trades (open_position or close_position) if criteria are met
5. Provide a summary of your analysis and actions taken`,
      },
    ];

    Logger.info('Starting Claude agentic trading cycle...');

    while (true) {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages,
      });

      const toolResults = [];

      for (const block of response.content) {
        if (block.type === 'text') {
          console.log(block.text);
        } else if (block.type === 'tool_use') {
          const inputStr = JSON.stringify(block.input);
          console.log(`\n  [Tool] ${block.name}(${inputStr})`);

          try {
            const result = await this.handleToolCall(block.name, block.input);
            const resultStr = JSON.stringify(result);
            console.log(`  [Result] ${resultStr.length > 300 ? resultStr.substring(0, 300) + '...' : resultStr}\n`);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: resultStr,
            });
          } catch (error) {
            Logger.error(`Tool ${block.name} failed: ${error.message}`);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: error.message }),
              is_error: true,
            });
          }
        }
      }

      // If Claude is done (no more tool calls), break
      if (response.stop_reason === 'end_turn') {
        break;
      }

      // If there were tool calls, send results back and continue
      if (toolResults.length > 0) {
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: toolResults });
      } else {
        break;
      }
    }

    Logger.info('Trading cycle completed');
  }

  /**
   * Calculate expected profit based on position size and take profit target
   */
  calculateExpectedProfit(positionSize, entryPrice, takeProfitMultiplier) {
    return positionSize * (takeProfitMultiplier - 1);
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

    Logger.info(`Closing ${positions.length} open position(s)...`);

    for (const position of positions) {
      try {
        let currentPrice = position.entryPrice;

        if (this.bitqueryClient) {
          try {
            const priceData = await this.bitqueryClient.getPriceAction(position.symbol);
            currentPrice = priceData.price || position.entryPrice;
          } catch (error) {
            Logger.warn(`Could not fetch current price for ${position.symbol}, using entry price`);
          }
        }

        // Calculate P&L
        let pnl = 0;
        if (position.type === 'long') {
          pnl = ((currentPrice - position.entryPrice) / position.entryPrice) * position.size;
        } else {
          pnl = ((position.entryPrice - currentPrice) / position.entryPrice) * position.size;
        }

        this.positions.delete(position.symbol);
        this.allocatedCapital -= position.size;
        this.capital += pnl;

        closedPositions.push({ ...position, currentPrice, pnl, pair: `${position.symbol}/USDT` });
        totalPnL += pnl;

        Logger.info(`Closed ${position.symbol}: P&L $${pnl.toFixed(2)}`);
      } catch (error) {
        Logger.error(`Error closing position ${position.id}: ${error.message}`);
      }
    }

    return { closedCount: closedPositions.length, totalPnL, positions: closedPositions };
  }
}
