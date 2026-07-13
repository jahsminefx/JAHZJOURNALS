import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import TradeReviewForm from '../components/trades/TradeReviewForm';

const TradeReviewPage = () => {
  const { id } = useParams();
  const [trade, setTrade] = useState(null);
  const [activeRules, setActiveRules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReviewData = async () => {
      setIsLoading(true);
      try {
        const [tradeRes, rulesRes] = await Promise.all([
          api.get(`/trades/${id}`),
          api.get('/rules'),
        ]);

        if (!tradeRes.data) throw new Error('Trade not found');

        setTrade(tradeRes.data);
        setActiveRules((rulesRes.data || []).filter((rule) => rule.active));
      } catch (err) {
        console.error(err);
        toast.error('Couldn\'t load your trade for review. Heading back...');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReviewData();
  }, [id]);

  if (isLoading) {
    return <div className="text-center py-12 text-muted">Preparing your review space...</div>;
  }

  if (!trade) {
    return <div className="text-center py-12 text-red-400">We couldn't find that trade.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto font-sans text-foreground pb-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-2">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Deep Trade Review</h2>
          <p className="text-sm text-muted">Reflect on your execution, mindset, and discipline for <strong>{trade.pair}</strong>.</p>
        </div>
        <Link to={`/trades/${id}`} className="text-sm text-green-400 hover:text-green-300">Back to trade</Link>
      </div>

      <TradeReviewForm trade={trade} activeRules={activeRules} />
    </div>
  );
};

export default TradeReviewPage;
