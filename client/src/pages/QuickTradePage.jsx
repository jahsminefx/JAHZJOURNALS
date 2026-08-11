import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { loadSettings } from '../utils/settings';
import QuickTradeForm from '../components/trades/QuickTradeForm';

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const getFirstInstrument = (value) => String(value || '').split(',')[0]?.trim().toUpperCase() || '';

const getNewTradeDefaults = (settings, accounts) => {
  const defaultAccount = accounts.find((account) => account.id === settings.trading.defaultTradingAccountId) || accounts[0];

  return {
    tradingAccountId: defaultAccount?.id || '',
    pair: getFirstInstrument(settings.trading.mainPairs),
    direction: 'BUY',
    status: 'PLANNED',
    result: 'OPEN',
    strategyId: '',
  };
};

const QuickTradePage = () => {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [strategies, setStrategies] = useState([]);
  const [initialData, setInitialData] = useState(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const settings = loadSettings();
        const [accountsResponse, strategiesResponse, tradeResponse] = await Promise.all([
          api.get('/accounts'),
          api.get('/strategies'),
          isEditMode ? api.get(`/trades/${id}`) : Promise.resolve({ data: null }),
        ]);

        const rawAccounts = accountsResponse.data;
        setAccounts(rawAccounts);
        setStrategies(strategiesResponse.data);

        if (tradeResponse.data) {
          const trade = tradeResponse.data;
          setInitialData({
            tradingAccountId: trade.tradingAccountId,
            pair: trade.pair || '',
            direction: trade.direction || 'BUY',
            status: trade.status || 'PLANNED',
            result: trade.result || 'OPEN',
            entryPrice: trade.entryPrice ?? '',
            exitPrice: trade.exitPrice ?? '',
            stopLoss: trade.stopLoss ?? '',
            takeProfit: trade.takeProfit ?? '',
            lotSize: trade.lotSize ?? '',
            riskAmount: trade.riskAmount ?? '',
            entryTime: toDateTimeLocal(trade.entryTime),
            exitTime: toDateTimeLocal(trade.exitTime),
            profitLossAmount: trade.profitLossAmount ?? '',
            strategyId: trade.strategyId || '',
            setupId: trade.setupId || '',
            entryReason: trade.entryReason || '',
          });
        } else if (rawAccounts.length > 0) {
          setInitialData(getNewTradeDefaults(settings, rawAccounts));
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'We had trouble loading your trade. Let\'s try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [id, isEditMode]);

  if (isLoading) {
    return <div className="text-center py-12 text-muted">Gathering your details...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto font-sans text-foreground">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{isEditMode ? 'Quick Edit' : 'Quick Log Trade'}</h2>
          <p className="text-sm text-muted">Capture the key details of your execution.</p>
        </div>
        {isEditMode && (
          <Link to={`/trades/${id}`} className="text-sm text-green-400 hover:text-green-300">Back to trade</Link>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="bg-surface-muted p-8 rounded-xl text-center">
          <p className="text-muted mb-4">You'll need a trading account before you can log trades.</p>
          <Link to="/accounts/new" className="px-4 py-2 bg-green-500 text-gray-900 rounded-lg">Create Your First Account</Link>
        </div>
      ) : initialData && (
        <QuickTradeForm key={id || 'new'} initialData={initialData} accounts={accounts} strategies={strategies} isEditMode={isEditMode} tradeId={id} />
      )}
    </div>
  );
};

export default QuickTradePage;
