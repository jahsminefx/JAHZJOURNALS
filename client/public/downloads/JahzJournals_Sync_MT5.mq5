//+------------------------------------------------------------------+
//|                                       JahzJournals_Sync_MT5.mq5 |
//|                                  Copyright 2026, JAHZJOURNALS    |
//|                                       https://jahzjournal.com    |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, JAHZJOURNALS"
#property link      "https://jahzjournal.com"
#property version   "1.00"
#property property_show_inputs

//--- input parameters
input string   InpSyncToken     = "";                  // Your JAHZJOURNALS Account Sync Token
input string   InpServerUrl     = "https://jahzjournal.com/api/webhooks/mt-sync"; // Webhook URL
input int      InpCheckInterval = 3;                   // Poll Interval in Seconds

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   if(StringLen(InpSyncToken) == 0)
     {
      Print("JAHZJOURNALS Sync Error: Sync Token is empty! Please set your Token in EA inputs.");
      return(INIT_FAILED);
     }

   EventSetTimer(InpCheckInterval);
   Print("JAHZJOURNALS MT5 Sync EA Initialized successfully.");
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
  {
   SyncMT5Positions();
  }

//+------------------------------------------------------------------+
//| Trade Transaction Event Listener                                 |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction& trans,
                        const MqlTradeRequest& request,
                        const MqlTradeResult& result)
  {
   SyncMT5Positions();
  }

//+------------------------------------------------------------------+
//| Main MT5 Sync Function                                           |
//+------------------------------------------------------------------+
void SyncMT5Positions()
  {
   int totalPositions = PositionsTotal();
   for(int i = 0; i < totalPositions; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
        {
         string symbol = PositionGetString(POSITION_SYMBOL);
         long type = PositionGetInteger(POSITION_TYPE);
         double volume = PositionGetDouble(POSITION_VOLUME);
         double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
         double sl = PositionGetDouble(POSITION_SL);
         double tp = PositionGetDouble(POSITION_TP);
         double profit = PositionGetDouble(POSITION_PROFIT);
         double swap = PositionGetDouble(POSITION_SWAP);
         datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
         string comment = PositionGetString(POSITION_COMMENT);

         SendOrderData(ticket, symbol, type == POSITION_TYPE_BUY ? "BUY" : "SELL", volume, openPrice, sl, tp, 0, swap, 0, profit, openTime, 0, false, comment);
        }
     }

   // Sync Recent History Deals
   datetime fromTime = TimeCurrent() - 86400 * 7; // Last 7 days
   HistorySelect(fromTime, TimeCurrent());
   int totalDeals = HistoryDealsTotal();

   for(int j = totalDeals - 1; j >= MathMax(0, totalDeals - 50); j--)
     {
      ulong dealTicket = HistoryDealGetTicket(j);
      if(dealTicket > 0)
        {
         long entryType = HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
         if(entryType == DEAL_ENTRY_OUT)
           {
            string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
            long type = HistoryDealGetInteger(dealTicket, DEAL_TYPE);
            double volume = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
            double price = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
            double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
            double swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
            double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
            datetime dealTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
            ulong positionId = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
            string comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);

            SendOrderData(positionId > 0 ? positionId : dealTicket, symbol, type == DEAL_TYPE_BUY ? "SELL" : "BUY", volume, price, 0, 0, price, swap, commission, profit, dealTime, dealTime, true, comment);
           }
        }
     }
  }

//+------------------------------------------------------------------+
//| Send HTTP WebRequest Payload                                     |
//+------------------------------------------------------------------+
void SendOrderData(ulong ticket, string symbol, string typeStr, double lots, double openPrice, double sl, double tp, double closePrice, double swap, double commission, double profit, datetime openTime, datetime closeTime, bool isClosed, string comment)
  {
   string json = StringFormat(
      "{\"syncToken\":\"%s\",\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"type\":\"%s\",\"lots\":%.2f,\"openPrice\":%.5f,\"stopLoss\":%.5f,\"takeProfit\":%.5f,\"closePrice\":%.5f,\"swap\":%.2f,\"commission\":%.2f,\"profit\":%.2f,\"openTime\":\"%s\",\"closeTime\":\"%s\",\"isClosed\":%s,\"comment\":\"%s\"}",
      InpSyncToken, ticket, symbol, typeStr, lots, openPrice, sl, tp, closePrice, swap, commission, profit, TimeToString(openTime, TIME_DATE|TIME_SECONDS), isClosed ? TimeToString(closeTime, TIME_DATE|TIME_SECONDS) : "", isClosed ? "true" : "false", comment
   );

   char data[];
   StringToCharArray(json, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);

   char result[];
   string resultHeaders;
   string headers = "Content-Type: application/json\r\nx-sync-token: " + InpSyncToken + "\r\n";

   ResetLastError();
   int res = WebRequest("POST", InpServerUrl, headers, 3000, data, result, resultHeaders);
   if(res == -1)
     {
      int err = GetLastError();
      if(err == 4060)
        {
         Print("JAHZJOURNALS Sync Error: Please allow WebRequest to '", InpServerUrl, "' in MT5 Options -> Expert Advisors.");
        }
     }
  }
