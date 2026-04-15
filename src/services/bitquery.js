/**
 * Bitquery API client for fetching on-chain crypto data
 * Supports WBTC/USDT, WETH/USDT pairs on Binance Smart Chain
 */

import { Logger } from '../utils/logger.js';

export class BitqueryClient {
  static SUPPORTED_PAIRS = [
    { symbol: 'WBTC', name: 'Wrapped Bitcoin', smartAddress: '0x0555e30da8f98308edb960aa94c0db47230d2b9c', network: 'Binance Smart Chain' },
    { symbol: 'WETH', name: 'Wrapped Ethereum', smartAddress: '0x4db5a66e937a9f4473fa95b1caf1d1e1d62e29ea', network: 'Binance Smart Chain' },
  ];

  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://streaming.bitquery.io/graphql';
  }

  /**
   * Get the list of supported trading pair symbols
   */
  static getSupportedPairs() {
    return BitqueryClient.SUPPORTED_PAIRS.map(p => p.symbol);
  }

  /**
   * Look up a pair config by symbol
   */
  static getPairConfig(symbol) {
    const pair = BitqueryClient.SUPPORTED_PAIRS.find(p => p.symbol === symbol);
    if (!pair) {
      throw new Error(`Unsupported symbol: ${symbol}. Supported: ${BitqueryClient.getSupportedPairs().join(', ')}`);
    }
    return pair;
  }

  /**
   * Execute a GraphQL query against Bitquery
   */
  async executeQuery(query, variables = {}) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query, variables: JSON.stringify(variables) }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      Logger.error(`HTTP Error ${response.status}: ${errorText}`);
      throw new Error(`HTTP Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();

    if (result.errors) {
      Logger.error('Bitquery API errors:', result.errors);
      throw new Error(result.errors[0].message);
    }

    return result.data;
  }

  // ─────────────────────────────────────────────────────────────
  // Query 1: OHLCV — 1-minute candles for the past 24 hours
  // Returns raw candles + computed VWAP and Volume Profile
  // ─────────────────────────────────────────────────────────────

  /**
   * Fetch 1-minute OHLCV candles for the past 24 hours
   * Also computes VWAP and Volume Profile client-side
   * @param {string} symbol - 'WBTC' or 'WETH'
   * @returns {Promise<Object>} { candles, vwap, volumeProfile, poc }
   */
  async getOHLCV(symbol) {
    const pair = BitqueryClient.getPairConfig(symbol);
    Logger.info(`Fetching OHLCV (1m, 24h) for ${symbol}`);

    const query = `
      query OHLCV_1Min_24hr($token: String!, $network: String!) {
        Trading {
          Tokens(
            where: {
              Token: { Address: { is: $token }, Network: { is: $network } }
              Interval: { Time: { Duration: { eq: 60 } } }
              Block: {
                Time: {
                  since_relative: {hours_ago: 24}
                }
              }
            }
            orderBy: { descending: Interval_Time_Start }
          ) {
            Interval {
              Time { Start Duration End }
            }
            Price {
              Ohlc { Open High Low Close }
            }
            Volume {
              Base
              Quote
              Usd
            }
            Token {
              Symbol Name Address Network
            }
          }
        }
      }
    `;

    const variables = { token: pair.smartAddress, network: pair.network };
    const data = await this.executeQuery(query, variables);
    const candles = data?.Trading?.Tokens || [];

    // Compute VWAP: Σ(typical_price × Volume.Usd) / Σ(Volume.Usd)
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    const enrichedCandles = candles.map(c => {
      const { Open, High, Low, Close } = c.Price.Ohlc;
      const volumeUsd = c.Volume.Usd || 0;
      const typicalPrice = (High + Low + Close) / 3;

      cumulativeTPV += typicalPrice * volumeUsd;
      cumulativeVolume += volumeUsd;
      const rollingVwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;

      return {
        timestamp: c.Interval.Time.Start,
        open: Open,
        high: High,
        low: Low,
        close: Close,
        volumeBase: c.Volume.Base,
        volumeQuote: c.Volume.Quote,
        volumeUsd: volumeUsd,
        typicalPrice,
        rollingVwap,
      };
    });

    const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;

    // Compute Volume Profile — bucket by close price
    const latestClose = enrichedCandles.length > 0 ? enrichedCandles[0].close : 0;
    const tickSize = latestClose > 1000 ? 100 : latestClose > 100 ? 10 : latestClose > 10 ? 1 : 0.01;

    const buckets = {};
    enrichedCandles.forEach(c => {
      const bucket = Math.floor(c.close / tickSize) * tickSize;
      buckets[bucket] = (buckets[bucket] || 0) + c.volumeUsd;
    });

    const sortedBuckets = Object.entries(buckets)
      .map(([price, volume]) => ({ price: parseFloat(price), volume }))
      .sort((a, b) => b.volume - a.volume);

    const poc = sortedBuckets.length > 0 ? sortedBuckets[0] : { price: 0, volume: 0 };

    return {
      symbol,
      pair: `${symbol}/USDT`,
      candleCount: enrichedCandles.length,
      candles: enrichedCandles,
      vwap,
      volumeProfile: sortedBuckets.slice(0, 10), // top 10 volume levels
      poc, // Point of Control — price level with highest volume
      totalVolumeUsd: cumulativeVolume,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Query 2: Latest Price & Market Cap
  // ─────────────────────────────────────────────────────────────

  /**
   * Fetch the latest price and market cap for a symbol
   * @param {string} symbol - 'WBTC' or 'WETH'
   * @returns {Promise<Object>} { price, marketCap, fdv }
   */
  async getPriceAction(symbol) {
    const pair = BitqueryClient.getPairConfig(symbol);
    Logger.info(`Fetching latest price for ${symbol}`);

    const query = `
      query PriceAction($token: String!, $network: String!) {
        Trading {
          Tokens(
            where: {Token: {Address: {is: $token}, Network: {is: $network}}, Interval: {Time: {Duration: {eq: 1}}}}
            orderBy: {descending: Interval_Time_Start}
            limit: {count:1}
          ) {
            Interval {
              Time {
                Start
              }
            }
            Price {
              Ohlc {
                Close
              }
            }
            Token {
              Symbol
              Name
              Address
              Network
            }
            Supply {
              FullyDilutedValuationUsd
              MarketCap
            }
          }
        }
      }
    `;

    const variables = { token: pair.smartAddress, network: pair.network };
    const data = await this.executeQuery(query, variables);
    const tokens = data?.Trading?.Tokens || [];

    if (tokens.length === 0) {
      return { symbol, price: 0, marketCap: 0, fdv: 0, timestamp: null };
    }

    const latest = tokens[0];
    return {
      symbol,
      pair: `${symbol}/USDT`,
      price: latest.Price.Ohlc.Close,
      marketCap: latest.Supply?.MarketCap || 0,
      fdv: latest.Supply?.FullyDilutedValuationUsd || 0,
      timestamp: latest.Interval.Time.Start,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Query 3: Moving Averages (SMA, WMA, EMA)
  // ─────────────────────────────────────────────────────────────

  /**
   * Fetch moving average data — Mean, SMA, WMA, EMA — for the past 24 hours
   * @param {string} symbol - 'WBTC' or 'WETH'
   * @returns {Promise<Object>} { averages[] with Mean, SMA, WMA, EMA per interval }
   */
  async getMovingAverages(symbol) {
    const pair = BitqueryClient.getPairConfig(symbol);
    Logger.info(`Fetching moving averages for ${symbol}`);

    const query = `
      query MA_1Min_24hr($token: String!, $network: String!) {
        Trading {
          Tokens(
            where: {
              Token: { Address: { is: $token }, Network: { is: $network } }
              Interval: { Time: { Duration: { eq: 1 } } }
              Block: {
                Time: {
                  since_relative: {hours_ago: 24}
                }
              }
            }
            orderBy: { descending: Interval_Time_Start }
          ) {
            Interval {
              Time { Start Duration End }
            }
            Price {
              Average{ Mean SimpleMoving WeightedSimpleMoving ExponentialMoving }
            }
            Token {
              Symbol Name Address Network
            }
          }
        }
      }
    `;

    const variables = { token: pair.smartAddress, network: pair.network };
    const data = await this.executeQuery(query, variables);
    const tokens = data?.Trading?.Tokens || [];

    const averages = tokens.map(t => ({
      timestamp: t.Interval.Time.Start,
      mean: t.Price.Average.Mean,
      sma: t.Price.Average.SimpleMoving,
      wma: t.Price.Average.WeightedSimpleMoving,
      ema: t.Price.Average.ExponentialMoving,
    }));

    const latest = averages.length > 0 ? averages[0] : { mean: 0, sma: 0, wma: 0, ema: 0 };

    return {
      symbol,
      pair: `${symbol}/USDT`,
      dataPoints: averages.length,
      latest,
      averages,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // Composite: getMarketData — all-in-one for the trading engine
  // ─────────────────────────────────────────────────────────────

  /**
   * Fetch all market data for a symbol — OHLCV + price + moving averages
   * This is the primary method called by the trading engine tools
   * @param {string} symbol - 'WBTC' or 'WETH'
   * @returns {Promise<Object>} Combined market data
   */
  async getMarketData(symbol) {
    Logger.info(`Fetching full market data for ${symbol}`);

    const [ohlcv, priceAction, movingAverages] = await Promise.all([
      this.getOHLCV(symbol),
      this.getPriceAction(symbol),
      this.getMovingAverages(symbol),
    ]);

    return {
      symbol,
      pair: `${symbol}/USDT`,

      // Latest price & market cap
      currentPrice: priceAction.price,
      marketCap: priceAction.marketCap,
      fdv: priceAction.fdv,

      // OHLCV summary (latest candle)
      candles: ohlcv.candles.slice(0, 60), // last 60 candles to keep payload manageable
      candleCount: ohlcv.candleCount,

      // Computed indicators
      vwap: ohlcv.vwap,
      volumeProfile: ohlcv.volumeProfile,
      poc: ohlcv.poc,
      totalVolumeUsd: ohlcv.totalVolumeUsd,

      // Moving averages (latest values)
      movingAverages: {
        mean: movingAverages.latest.mean,
        sma: movingAverages.latest.sma,
        wma: movingAverages.latest.wma,
        ema: movingAverages.latest.ema,
      },

      // Trend signals for Claude's analysis
      signals: {
        priceVsVwap: priceAction.price > ohlcv.vwap ? 'above' : 'below',
        priceVsSma: priceAction.price > movingAverages.latest.sma ? 'above' : 'below',
        priceVsEma: priceAction.price > movingAverages.latest.ema ? 'above' : 'below',
        priceVsPoc: priceAction.price > ohlcv.poc.price ? 'above' : 'below',
      },
    };
  }
}
