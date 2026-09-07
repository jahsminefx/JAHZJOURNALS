//+------------------------------------------------------------------+
//|                                       JahzJournals_Sync_MT4.mq4 |
//|                                  Copyright 2026, JAHZJOURNALS    |
//|                                       https://jahzjournal.com    |
//+------------------------------------------------------------------+
#property copyright "Copyright 2026, JAHZJOURNALS"
#property link      "https://jahzjournal.com"
#property version   "1.00"
#property strict
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
   Print("JAHZJOURNALS MT4 Sync EA Initialized successfully.");
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
   SyncTrades();
  }

//+------------------------------------------------------------------+
//| Main Sync Function                                               |
//+------------------------------------------------------------------+
void SyncTrades()
  {
   int totalOrders = OrdersTotal();
   for(int i = 0; i < totalOrders; i++)
     {
      if(OrderSelect(i, SELECT_BY_POS, MODE_TRADES))
        {
         if(OrderType() == OP_BUY || OrderType() == OP_SELL)
           {
            SendOrderData(OrderTicket(), OrderSymbol(), OrderType(), OrderLots(), OrderOpenPrice(), OrderStopLoss(), OrderTakeProfit(), 0, OrderSwap(), OrderCommission(), OrderProfit(), OrderOpenTime(), 0, false, OrderComment());
           }
        }
     }

   int historyOrders = OrdersHistoryTotal();
   for(int j = historyOrders - 1; j >= MathMax(0, historyOrders - 50); j--)
     {
      if(OrderSelect(j, SELECT_BY_POS, MODE_HISTORY))
        {
         if(OrderType() == OP_BUY || OrderType() == OP_SELL)
           {
            SendOrderData(OrderTicket(), OrderSymbol(), OrderType(), OrderLots(), OrderOpenPrice(), OrderStopLoss(), OrderTakeProfit(), OrderClosePrice(), OrderSwap(), OrderCommission(), OrderProfit(), OrderOpenTime(), OrderCloseTime(), true, OrderComment());
           }
        }
     }
  }

//+------------------------------------------------------------------+
//| Send HTTP WebRequest Payload                                     |
//+------------------------------------------------------------------+
void SendOrderData(int ticket, string symbol, int type, double lots, double openPrice, double sl, double tp, double closePrice, double swap, double commission, double profit, datetime openTime, datetime closeTime, bool isClosed, string comment)
  {
   string typeStr = (type == OP_BUY) ? "BUY" : "SELL";
   string json = StringFormat(
      "{\"syncToken\":\"%s\",\"ticket\":\"%d\",\"symbol\":\"%s\",\"type\":\"%s\",\"lots\":%.2f,\"openPrice\":%.5f,\"stopLoss\":%.5f,\"takeProfit\":%.5f,\"closePrice\":%.5f,\"swap\":%.2f,\"commission\":%.2f,\"profit\":%.2f,\"openTime\":\"%s\",\"closeTime\":\"%s\",\"isClosed\":%s,\"comment\":\"%s\"}",
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
         Print("JAHZJOURNALS Sync Error: Please allow WebRequest to '", InpServerUrl, "' in MT4 Options -> Expert Advisors.");
        }
     }
  }
