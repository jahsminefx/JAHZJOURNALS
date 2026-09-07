export const popularBrokers = [
  // Prop Firms
  { name: 'FTMO', serverPrefixes: ['FTMO-Server', 'FTMO-Demo', 'FTMO-Server2', 'FTMO-Server3'], category: 'Prop Firm' },
  { name: 'Funding Pips', serverPrefixes: ['FundingPips-Server', 'FundingPips-Demo'], category: 'Prop Firm' },
  { name: 'FundedNext', serverPrefixes: ['FundedNext-Server', 'FundedNext-Demo'], category: 'Prop Firm' },
  { name: 'MyFundedFX', serverPrefixes: ['MyFundedFX-Live', 'MyFundedFX-Demo'], category: 'Prop Firm' },
  { name: 'Alpha Capital Group', serverPrefixes: ['AlphaCapitalGroup-Live', 'AlphaCapitalGroup-Demo'], category: 'Prop Firm' },
  { name: 'The Funded Trader', serverPrefixes: ['TheFundedTrader-Live', 'TheFundedTrader-Demo'], category: 'Prop Firm' },
  { name: 'The 5%ers', serverPrefixes: ['The5ers-Server', 'The5ers-Demo'], category: 'Prop Firm' },
  { name: 'E8 Markets', serverPrefixes: ['E8Markets-Server', 'E8Markets-Demo'], category: 'Prop Firm' },
  { name: 'True Forex Funds', serverPrefixes: ['TrueForexFunds-Live', 'TrueForexFunds-Demo'], category: 'Prop Firm' },

  // Retail Brokers
  { name: 'IC Markets', serverPrefixes: ['ICMarketsSC-Live01', 'ICMarketsSC-Live02', 'ICMarketsSC-Live03', 'ICMarkets-Demo'], category: 'Broker' },
  { name: 'Exness', serverPrefixes: ['Exness-Real', 'Exness-Real2', 'Exness-Trial'], category: 'Broker' },
  { name: 'Pepperstone', serverPrefixes: ['Pepperstone-Edge-Live01', 'Pepperstone-Demo'], category: 'Broker' },
  { name: 'XM', serverPrefixes: ['XMGlobal-Real', 'XMGlobal-Demo'], category: 'Broker' },
  { name: 'Forex.com', serverPrefixes: ['FOREX.com-Live', 'FOREX.com-Demo'], category: 'Broker' },
  { name: 'OANDA', serverPrefixes: ['OANDA-Live-1', 'OANDA-Practice'], category: 'Broker' },
  { name: 'Vantage Markets', serverPrefixes: ['VantageFX-Live', 'VantageFX-Demo'], category: 'Broker' },
  { name: 'Hugo\'s Way', serverPrefixes: ['HugosWay-Real', 'HugosWay-Demo'], category: 'Broker' },
  { name: 'Deriv / Binary.com', serverPrefixes: ['Deriv-Server', 'Deriv-Demo'], category: 'Broker' },
  { name: 'FBS', serverPrefixes: ['FBS-Real', 'FBS-Demo'], category: 'Broker' },
  { name: 'Eightcap', serverPrefixes: ['Eightcap-Real', 'Eightcap-Demo'], category: 'Broker' },
  { name: 'ThinkMarkets', serverPrefixes: ['ThinkMarkets-Live', 'ThinkMarkets-Demo'], category: 'Broker' },
];

export const commonBrokerServers = popularBrokers.flatMap(b => b.serverPrefixes);
