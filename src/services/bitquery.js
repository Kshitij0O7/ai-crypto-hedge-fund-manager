/**
 * Bitquery API client for fetching on-chain crypto data
 */

import { Logger } from '../utils/logger.js';

export class BitqueryClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://streaming.bitquery.io/graphql';
  }

  /**
   * Fetch cryptocurrencies with volatility data from Bitquery
   * @returns {Promise<Array>} Array of currency data with volatility
   */
  async getCurrencyVolatilityData() {
    Logger.info('Fetching currency volatility data from Bitquery');
    
    try {
      const query = `
        query MyQuery {
          Trading {
            Currencies(
              orderBy: {descendingByField: "volatility", descending: Interval_Time_Start}
              where: {Price: {IsQuotedInUsd: true}, Interval: {Time: {Duration: {eq: 3600}}}}
            ) {
              Currency {
                Id
              }
              average(of: Price_Ohlc_Close)
              standard_deviation(of: Price_Ohlc_Close)
              volatility: calculate(expression: "100 * ( $standard_deviation / $average )")
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

      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      myHeaders.append("Authorization", `Bearer ${this.apiKey}`);

      const raw = JSON.stringify({
        query: query,
        variables: "{}"
      });

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
      };

      const response = await fetch(this.baseURL, requestOptions);
      
      // Check if response is OK
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
      
      if (!result.data || !result.data.Trading || !result.data.Trading.Currencies) {
        Logger.error('Unexpected response structure:', result);
        throw new Error('Unexpected response structure from Bitquery API');
      }
      
      return result.data.Trading.Currencies;
    } catch (error) {
      Logger.error(`Error fetching volatility data: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch trade metrics (OHLC, Volume, Price, Weighted SMA) for a specific currency
   * @param {string} currencyId - Currency ID (e.g., "bid:solana:XLnpFRQ3rSWupCRjuQfx74mgVoT3ezVJKE1CogRZxhH")
   * @param {number} hoursAgo - Number of hours to look back (default: 24)
   * @returns {Promise<Array>} Array of trade metrics data
   */
  async getTradeMetrics(currencyId, hoursAgo = 24) {
    Logger.info(`Fetching trade metrics for ${currencyId} for last ${hoursAgo} hours`);
    
    try {
      const query = `
        query MyQuery {
          Trading {
            Currencies(
              where: {Currency: {Id: {is: "${currencyId}"}}, Interval: {Time: {Duration: {eq: 3600}}}, Block: {Time: {since_relative: {hours_ago: ${hoursAgo}}}}}
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

      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      myHeaders.append("Authorization", `Bearer ${this.apiKey}`);

      const raw = JSON.stringify({
        query: query,
        variables: "{}"
      });

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
      };

      const response = await fetch(this.baseURL, requestOptions);
      
      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(`HTTP Error ${response.status}: ${errorText}`);
        throw new Error(`HTTP Error ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log(result);
      
      if (result.errors) {
        Logger.error('Bitquery API errors:', result.errors);
        throw new Error(result.errors[0].message);
      }
      
      if (!result.data || !result.data.Trading || !result.data.Trading.Currencies) {
        Logger.error('Unexpected response structure:', result);
        throw new Error('Unexpected response structure from Bitquery API');
      }
      
      return result.data.Trading.Currencies;
    } catch (error) {
      Logger.error(`Error fetching trade metrics: ${error.message}`);
      throw error;
    }
  }

}

