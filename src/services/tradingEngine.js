/**
 * Trading decision engine that analyzes data and makes trading decisions
 */

import { Logger } from '../utils/logger.js';
import { getStrategy } from '../strategies/baseStrategy.js';

export class TradingEngine {
  constructor(riskProfile = 'low', geminiApiKey = null) {
    this.riskProfile = riskProfile;
    this.geminiApiKey = geminiApiKey;
    this.positions = new Map(); // Map<tokenAddress, Position>
    this.capital = 100000; // Starting capital in USD
    this.allocatedCapital = 0;
    
    // Risk parameters based on profile
    this.riskParams = this.getRiskParameters(riskProfile);
  }

  /**
   * Get risk parameters based on selected profile
   */
  getRiskParameters(profile) {
    const profiles = {
      low: {
        maxPositionSize: 0.1, // 10% of capital per position
        volatilityThreshold: 0.02, // 2% volatility
        stopLoss: 0.95, // 5% stop loss
        takeProfit: 1.05 // 5% take profit
      },
      high: {
        maxPositionSize: 0.3, // 30% of capital per position
        volatilityThreshold: 0.05, // 5% volatility
        stopLoss: 0.90, // 10% stop loss
        takeProfit: 1.15 // 15% take profit
      }
    };
    
    return profiles[profile] || profiles.low;
  }



  /**
   * AI-powered: Analyze multiple currencies with a single Gemini API call
   * @param {Array} currenciesWithMetrics - Array of {currencyId, volatilityData, tradeMetrics}
   * @returns {Promise<Array>} Array of decision objects
   */
  async analyzeMultipleWithAI(currenciesWithMetrics) {
    Logger.info(`Gemini analyzing ${currenciesWithMetrics.length} currencies in a single API call`);
    
    if (!this.geminiApiKey) {
      Logger.warn('Gemini API key not provided, using fallback logic');
      return currenciesWithMetrics.map(({ currencyId, volatilityData, tradeMetrics }) =>
        this.fallbackDecision(currencyId, volatilityData, tradeMetrics)
      );
    }
    
    try {
      // Build prompt with all currencies
      const prompt = this.buildMultiCurrencyPrompt(currenciesWithMetrics);
      
      // Call Gemini API
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${this.geminiApiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are an expert crypto trading assistant. Analyze the provided currencies and return trading decisions in JSON format. 
For each currency, respond with one of: OPEN LONG, OPEN SHORT, CLOSE, or HOLD.
Return a JSON array with objects containing: currencyId, action, positionType (long/short/null), and reasoning.

${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
            responseMimeType: 'application/json'
          }
        })
      });
      
      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: errorText };
        }
        Logger.error(`Gemini API HTTP Error ${response.status}: ${JSON.stringify(errorData, null, 2)}`);
        return currenciesWithMetrics.map(({ currencyId, volatilityData, tradeMetrics }) =>
          this.fallbackDecision(currencyId, volatilityData, tradeMetrics)
        );
      }
      
      const data = await response.json();
      
      // Check for API errors in response
      if (data.error) {
        Logger.error(`Gemini API error: ${JSON.stringify(data.error, null, 2)}`);
        return currenciesWithMetrics.map(({ currencyId, volatilityData, tradeMetrics }) =>
          this.fallbackDecision(currencyId, volatilityData, tradeMetrics)
        );
      }
      
      // Validate response structure
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        Logger.error(`Gemini API invalid response structure: ${JSON.stringify(data, null, 2)}`);
        return currenciesWithMetrics.map(({ currencyId, volatilityData, tradeMetrics }) =>
          this.fallbackDecision(currencyId, volatilityData, tradeMetrics)
        );
      }
      
      // Extract text from Gemini response
      const responseText = data.candidates[0].content.parts[0].text;
      
      // Parse multi-currency response
      const decisions = this.parseMultiCurrencyResponse(
        responseText,
        currenciesWithMetrics
      );
      
      return decisions;
      
    } catch (error) {
      Logger.error(`Gemini API call failed: ${error.message}`);
      Logger.error(`Error stack: ${error.stack}`);
      return currenciesWithMetrics.map(({ currencyId, volatilityData, tradeMetrics }) =>
        this.fallbackDecision(currencyId, volatilityData, tradeMetrics)
      );
    }
  }

  /**
   * Build prompt with strategy and trading metrics for multiple currencies
   */
  buildMultiCurrencyPrompt(currenciesWithMetrics) {
    const strategy = getStrategy(this.riskProfile);
    let prompt = `${strategy}\n\n`;
    prompt += `Analyze the following ${currenciesWithMetrics.length} currencies and provide trading decisions:\n\n`;
    
    currenciesWithMetrics.forEach(({ currencyId, volatilityData, tradeMetrics }, index) => {
      const num = index + 1;
      prompt += `--- CURRENCY ${num} ---\n`;
      prompt += `Currency ID: ${currencyId}\n`;
      prompt += `Volatility: ${volatilityData.volatility?.toFixed(2) ?? '0.00'}%\n`;
      prompt += `Average Price: ${volatilityData.average?.toFixed(6) ?? '0.000000'} USD\n`;
      
      if (Array.isArray(tradeMetrics) && tradeMetrics.length > 0) {
        const latestMetric = tradeMetrics[tradeMetrics.length - 1];
        const ohlc = latestMetric.Price?.Ohlc || {};
        const average = latestMetric.Price?.Average || {};
        const volume = latestMetric.Volume || {};
        
        prompt += `OHLC: Open=${(ohlc.Open ?? 0).toFixed(6)}, High=${(ohlc.High ?? 0).toFixed(6)}, Low=${(ohlc.Low ?? 0).toFixed(6)}, Close=${(ohlc.Close ?? 0).toFixed(6)}\n`;
        prompt += `Price Estimate: ${(average.Estimate ?? ohlc.Close ?? 0).toFixed(6)} USD\n`;
        prompt += `Weighted SMA: ${(average.WeightedSimpleMoving ?? average.Estimate ?? ohlc.Close ?? 0).toFixed(6)} USD\n`;
        prompt += `Volume (USD): ${(volume.Usd ?? 0).toFixed(2)} USD\n`;
      } else {
        prompt += `Metrics: Not available\n`;
      }
      prompt += '\n';
    });
    
    prompt += `\nReturn your decisions as a JSON array. Example format:\n`;
    prompt += `[\n`;
    prompt += `  {"currencyId": "bid:solana:XXX", "action": "OPEN LONG", "positionType": "long", "reasoning": "Strong bullish trend"},\n`;
    prompt += `  {"currencyId": "bid:solana:YYY", "action": "HOLD", "positionType": null, "reasoning": "Waiting for confirmation"}\n`;
    prompt += `]\n`;
    
    return prompt;
  }

  /**
   * Parse multi-currency Gemini response into array of decisions
   */
  parseMultiCurrencyResponse(gptText, currenciesWithMetrics) {
    const decisions = [];
    
    try {
      // Try to extract JSON from the response
      const jsonMatch = gptText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);
        
        // Create a map for quick lookup
        const decisionMap = new Map();
        jsonData.forEach(item => {
          if (item.currencyId) {
            decisionMap.set(item.currencyId, item);
          }
        });
        
        // Match decisions to currencies
        currenciesWithMetrics.forEach(({ currencyId, volatilityData, tradeMetrics }) => {
          const item = decisionMap.get(currencyId);
          if (item) {
            const action = item.action?.toUpperCase() || 'HOLD';
            let decision = 'hold';
            
            // Parse action more flexibly
            if (action.includes('OPEN')) {
              decision = 'open';
            } else if (action.includes('CLOSE')) {
              decision = 'close';
            }
            
            // Determine position type from action or item.positionType
            let type = 'long';
            if (item.positionType) {
              type = item.positionType.toLowerCase();
            } else if (action.includes('SHORT')) {
              type = 'short';
            } else if (action.includes('LONG')) {
              type = 'long';
            }
            
            const latestMetric = tradeMetrics[tradeMetrics.length - 1];
            const entryPrice = latestMetric?.Price?.Average?.Estimate || latestMetric?.Price?.Ohlc?.Close || 0;
            
            decisions.push({
              currencyId,
              decision,
              positionType: type,
              confidence: 0.7,
              reasoning: item.reasoning || 'Market analysis completed',
              entryPrice
            });
          } else {
            // Fallback if currency not found in response
            decisions.push(this.fallbackDecision(currencyId, volatilityData, tradeMetrics));
          }
        });
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (error) {
      Logger.warn(`Failed to parse Gemini multi-currency response: ${error.message}, using fallback`);
      // Fallback to individual parsing or fallback decisions
      return currenciesWithMetrics.map(({ currencyId, volatilityData, tradeMetrics }) =>
        this.fallbackDecision(currencyId, volatilityData, tradeMetrics)
      );
    }
    
    return decisions;
  }

  /**
   * Fallback decision logic if Gemini API fails
   */
  fallbackDecision(currencyId, volatilityData, tradeMetrics) {
    // Validate tradeMetrics before accessing
    if (!Array.isArray(tradeMetrics) || tradeMetrics.length === 0) {
      return {
        currencyId,
        decision: 'hold',
        positionType: 'long',
        confidence: 0.5,
        reasoning: 'No trade metrics available',
        entryPrice: 0
      };
    }
    
    const latestMetric = tradeMetrics[tradeMetrics.length - 1];
    
    if (!latestMetric || !latestMetric.Price) {
      return {
        currencyId,
        decision: 'hold',
        positionType: 'long',
        confidence: 0.5,
        reasoning: 'Insufficient market data',
        entryPrice: 0
      };
    }
    
    const { Price } = latestMetric;
    const ohlc = Price.Ohlc;
    const estimate = Price.Average?.Estimate || ohlc.Close;
    const sma = Price.Average?.WeightedSimpleMoving || estimate;
    
    const isPriceAboveSMA = ohlc.Close > sma;
    const isBullish = ohlc.Close > ohlc.Open;
    
    let action = 'hold';
    let type = 'long';
    
    if (isPriceAboveSMA && isBullish) {
      action = 'open';
      type = 'long';
    } else if (!isPriceAboveSMA && !isBullish) {
      action = 'open';
      type = 'short';
    }
    
    return {
      currencyId,
      decision: action,
      positionType: type,
      confidence: 0.6,
      reasoning: `Fallback: Price ${isPriceAboveSMA ? 'above' : 'below'} SMA with ${isBullish ? 'bullish' : 'bearish'} candle`,
      entryPrice: estimate
    };
  }

  /**
   * Open a position based on AI decision
   * @param {Object} aiDecision - AI decision result
   */
  async openPosition(aiDecision) {
    Logger.info(`Opening ${aiDecision.positionType} position for ${aiDecision.currencyId}`);
    
    if (this.allocatedCapital >= this.capital * 0.9) {
      Logger.warn('Not enough capital to open new position');
      return null;
    }
    
    const positionSize = this.capital * this.riskParams.maxPositionSize;
    const { network, address } = this.parseCurrencyId(aiDecision.currencyId);
    
    const position = {
      id: `pos_${Date.now()}`,
      currencyId: aiDecision.currencyId,
      tokenAddress: address,
      network,
      type: aiDecision.positionType,
      entryPrice: aiDecision.entryPrice,
      size: positionSize,
      timestamp: Date.now(),
      stopLoss: this.riskParams.stopLoss,
      takeProfit: this.riskParams.takeProfit,
      confidence: aiDecision.confidence,
      reasoning: aiDecision.reasoning,
      expectedProfit: this.calculateExpectedProfit(positionSize, aiDecision.entryPrice, this.riskParams.takeProfit)
    };
    
    this.positions.set(address, position);
    this.allocatedCapital += positionSize;
    
    Logger.info(`Position opened: ${position.id}`);
    return position;
  }

  /**
   * Close a position with P&L calculation
   * @param {Object} position - Position to close
   * @param {number} currentPrice - Current market price
   */
  async closePosition(position, currentPrice) {
    Logger.info(`Closing ${position.type} position for ${position.currencyId}`);
    
    // Calculate P&L
    let pnl = 0;
    if (position.type === 'long') {
      pnl = ((currentPrice - position.entryPrice) / position.entryPrice) * position.size;
    } else {
      pnl = ((position.entryPrice - currentPrice) / position.entryPrice) * position.size;
    }
    
    this.positions.delete(position.tokenAddress);
    this.allocatedCapital -= position.size;
    
    Logger.info(`Position closed: ${position.id} with P&L: $${pnl.toFixed(2)}`);
    return { ...position, currentPrice, pnl };
  }

  /**
   * Parse currency ID to extract network and address
   * @param {string} currencyId - Currency ID from Bitquery
   */
  parseCurrencyId(currencyId) {
    const parts = currencyId.split(':');
    
    if (parts.length === 3) {
      return { network: parts[1], address: parts[2] };
    } else if (parts.length === 2) {
      return { network: 'ethereum', address: parts[1] };
    } else {
      return { network: 'unknown', address: currencyId };
    }
  }

  /**
   * Calculate expected profit based on position
   */
  calculateExpectedProfit(positionSize, entryPrice, takeProfitMultiplier) {
    return positionSize * (takeProfitMultiplier - 1);
  }

  /**
   * Get all open positions
   * @returns {Array} Array of position objects
   */
  getOpenPositions() {
    return Array.from(this.positions.values());
  }

  /**
   * Close all open positions (used for graceful shutdown)
   * @param {Object} bitqueryClient - Optional Bitquery client to fetch current prices
   * @returns {Promise<Object>} Summary of closed positions with total P&L
   */
  async closeAllPositions(bitqueryClient = null) {
    const positions = this.getOpenPositions();
    
    if (positions.length === 0) {
      return {
        closedCount: 0,
        totalPnL: 0,
        positions: []
      };
    }

    const closedPositions = [];
    let totalPnL = 0;

    Logger.info(`Closing ${positions.length} open position(s)...`);

    for (const position of positions) {
      try {
        let currentPrice = position.entryPrice; // Default to entry price
        
        // Try to fetch current price if Bitquery client is available
        if (bitqueryClient) {
          try {
            const metrics = await bitqueryClient.getTradeMetrics(position.currencyId, 1);
            if (Array.isArray(metrics) && metrics.length > 0) {
              const latestMetric = metrics[metrics.length - 1];
              currentPrice = latestMetric?.Price?.Average?.Estimate || 
                           latestMetric?.Price?.Ohlc?.Close || 
                           position.entryPrice;
            }
          } catch (error) {
            Logger.warn(`Could not fetch current price for ${position.currencyId}, using entry price`);
          }
        }
        
        const closedPosition = await this.closePosition(position, currentPrice);
        closedPositions.push(closedPosition);
        totalPnL += closedPosition.pnl;
      } catch (error) {
        Logger.error(`Error closing position ${position.id}: ${error.message}`);
      }
    }

    return {
      closedCount: closedPositions.length,
      totalPnL,
      positions: closedPositions
    };
  }

  /**
   * Execute AI decision and generate terminal message
   * @param {Object} aiDecision - AI decision result
   * @param {Object} tradingParams - Current trading parameters
   */
  async executeDecision(aiDecision, tradingParams) {
    const { currencyId, decision, positionType, confidence, reasoning, entryPrice } = aiDecision;
    
    // Get currency display name
    const { network, address } = this.parseCurrencyId(currencyId);
    const shortAddress = address.substring(0, 10) + '...' + address.slice(-6);
    const displayName = `${network}/${shortAddress}`;
    
    let message = '';
    
    if (decision === 'open') {
      // Open position
      const position = await this.openPosition(aiDecision);
      if (position) {
        message = `\n📈 Opening ${positionType} position for ${displayName} with expected profit of $${position.expectedProfit.toFixed(2)}`;
      }
    } else if (decision === 'close') {
      // Close position
      const position = this.positions.get(address);
      if (position) {
        const closedPosition = await this.closePosition(position, entryPrice);
        const profitOrLoss = closedPosition.pnl >= 0 ? 'profit' : 'loss';
        const amount = Math.abs(closedPosition.pnl).toFixed(2);
        message = `\n📉 Closing ${positionType} position for ${displayName} for ${profitOrLoss} of $${amount}`;
      }
    } else {
      // Hold
      message = `\n⏸️  Holding position for ${displayName}`;
    }
    
    return { message, decision, currencyId: displayName };
  }
}

