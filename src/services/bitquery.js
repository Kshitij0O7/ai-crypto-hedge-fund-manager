/**
 * Bitquery API client for fetching on-chain crypto data
 * Limited to BTC/USDT, ETH/USDT, SOL/USDT pairs
 */

import { Logger } from '../utils/logger.js';

// Supported trading pairs with their Bitquery currency identifiers
const SUPPORTED_PAIRS = {
  BTC: {
    name: 'Bitcoin',
    symbol: 'BTC',
    currencyId: 'bid:ethereum:0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    network: 'ethereum'
  },
  ETH: {
    name: 'Ethereum',
    symbol: 'ETH',
    currencyId: 'bid:ethereum:0x0000000000000000000000000000000000000000',
    network: 'ethereum'
  },
  SOL: {
    name: 'Solana',
    symbol: 'SOL',
    currencyId: 'bid:solana:So11111111111111111111111111111111111111112',
    network: 'solana'
  }
};

export class BitqueryClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://streaming.bitquery.io/graphql';
  }

  /**
   * Get all supported trading pair symbols
   */
  static getSupportedPairs() {
    return Object.keys(SUPPORTED_PAIRS);
  }

  /**
   * Get pair info by symbol
   */
  static getPairInfo(symbol) {
    return SUPPORTED_PAIRS[symbol.toUpperCase()] || null;
  }

  /**
   * Fetch market data (OHLC, Volume, SMA) for a specific trading pair
   * @param {string} pair - Trading pair symbol (BTC, ETH, SOL)
   * @param {number} hoursAgo - Number of hours to look back (default: 24)
   * @returns {Promise<Object>} Structured market data
   */
  async getMarketData(pair, hoursAgo = 24) {
    const pairInfo = SUPPORTED_PAIRS[pair.toUpperCase()];
    if (!pairInfo) {
      throw new Error(`Unsupported pair: ${pair}. Supported: ${Object.keys(SUPPORTED_PAIRS).join(', ')}`);
    }

    Logger.info(`Fetching ${pair}/USDT market data for last ${hoursAgo} hours`);

    try {
      const query = `
        query MyQuery {
          Trading {
            Currencies(
              where: {
                Currency: {Id: {is: "${pairInfo.currencyId}"}},
                Interval: {Time: {Duration: {eq: 3600}}},
                Block: {Time: {since_relative: {hours_ago: ${hoursAgo}}}}
              }
              orderBy: {ascending: Interval_Time_Start}
            ) {
              Price {
                Average {
                  Estimate
                  WeightedSimpleMoving
                }
                Ohlc {
                  Open
                  High
                  Low
                  Close
                }
              }
              Volume {
                Usd
              }
              Interval {
                Time {
                  Start
                  End
                }
              }
            }
          }
        }
      `;

      const result = await this._executeQuery(query);
      const currencies = result.data?.Trading?.Currencies || [];

      if (currencies.length === 0) {
        return {
          pair: `${pair}/USDT`,
          symbol: pair,
          network: pairInfo.network,
          currencyId: pairInfo.currencyId,
          dataPoints: 0,
          latest: null,
          history: []
        };
      }

      const latest = currencies[currencies.length - 1];
      const ohlc = latest.Price?.Ohlc || {};
      const avg = latest.Price?.Average || {};

      return {
        pair: `${pair}/USDT`,
        symbol: pair,
        network: pairInfo.network,
        currencyId: pairInfo.currencyId,
        dataPoints: currencies.length,
        latest: {
          open: ohlc.Open || 0,
          high: ohlc.High || 0,
          low: ohlc.Low || 0,
          close: ohlc.Close || 0,
          priceEstimate: avg.Estimate || ohlc.Close || 0,
          weightedSMA: avg.WeightedSimpleMoving || avg.Estimate || ohlc.Close || 0,
          volumeUSD: latest.Volume?.Usd || 0,
          timestamp: latest.Interval?.Time?.Start || null
        },
        history: currencies.map(c => ({
          open: c.Price?.Ohlc?.Open || 0,
          high: c.Price?.Ohlc?.High || 0,
          low: c.Price?.Ohlc?.Low || 0,
          close: c.Price?.Ohlc?.Close || 0,
          priceEstimate: c.Price?.Average?.Estimate || c.Price?.Ohlc?.Close || 0,
          weightedSMA: c.Price?.Average?.WeightedSimpleMoving || c.Price?.Average?.Estimate || 0,
          volumeUSD: c.Volume?.Usd || 0,
          timestamp: c.Interval?.Time?.Start || null
        }))
      };
    } catch (error) {
      Logger.error(`Error fetching market data for ${pair}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch current price for a pair (used during position closing)
   * @param {string} pair - Trading pair symbol
   * @returns {Promise<number>} Current price
   */
  async getCurrentPrice(pair) {
    const data = await this.getMarketData(pair, 1);
    return data.latest?.close || data.latest?.priceEstimate || 0;
  }

  /**
   * Execute a GraphQL query against Bitquery
   * @private
   */
  async _executeQuery(query) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ query, variables: '{}' })
    });

    if (!response.ok) {
      const errorText = await response.text();
      Logger.error(`Bitquery HTTP Error ${response.status}: ${errorText}`);
      throw new Error(`Bitquery HTTP Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.errors) {
      Logger.error('Bitquery API errors:', result.errors);
      throw new Error(result.errors[0].message);
    }

    return result;
  }
}
