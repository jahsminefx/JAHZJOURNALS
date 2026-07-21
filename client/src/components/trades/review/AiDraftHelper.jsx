import React, { useState, useEffect } from 'react';
import { Wand2, Plus, Replace, X, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../utils/api';

const AiDraftHelper = ({ getValues, setValue, fieldName, draftType }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [draftResult, setDraftResult] = useState(null);
  const [requestId, setRequestId] = useState(null);

  const generateDraft = async () => {
    setIsProcessing(true);
    setDraftResult(null);
    try {
      const tradeData = getValues();
      const { data } = await api.post('/ai/journal-draft', { draftType, tradeData });
      setRequestId(data.requestId);
      toast.success('AI is structuring your draft...', { id: 'aiDraftToast' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to start AI generation.');
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    let intervalId;
    if (requestId && isProcessing) {
      intervalId = setInterval(async () => {
        try {
          const { data } = await api.get(`/ai/journal-draft/${requestId}`);
          if (data.status === 'COMPLETED') {
             setDraftResult(data.structuredOutput);
             setIsProcessing(false);
             setRequestId(null);
             toast.success('Draft generated!', { id: 'aiDraftToast' });
             clearInterval(intervalId);
          } else if (data.status === 'FAILED') {
             setIsProcessing(false);
             setRequestId(null);
             toast.error(data.errorMessage || 'Failed to generate draft.', { id: 'aiDraftToast' });
             clearInterval(intervalId);
          }
        } catch (err) {
          console.error(err);
        }
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [requestId, isProcessing]);

  if (isProcessing) {
    return (
      <div className="flex items-center gap-2 text-xs text-purple-400 mt-2">
        <RefreshCw size={12} className="animate-spin" /> Analyzing trade parameters...
      </div>
    );
  }

  if (draftResult) {
    return (
      <div className="mt-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold text-purple-400">AI Draft Suggestion</p>
          <div className="flex gap-2">
            <button 
               type="button" 
               onClick={() => {
                 const current = getValues(fieldName) || '';
                 setValue(fieldName, current ? current + '\n\n' + draftResult.draft : draftResult.draft);
                 setDraftResult(null);
               }} 
               className="flex items-center gap-1 px-2 py-1 bg-surface border border-green-500/30 text-green-400 rounded hover:bg-green-500/10 transition text-xs">
               <Plus size={12} /> Append
            </button>
            <button 
               type="button" 
               onClick={() => {
                 setValue(fieldName, draftResult.draft);
                 setDraftResult(null);
               }} 
               className="flex items-center gap-1 px-2 py-1 bg-surface border border-yellow-500/30 text-yellow-500 rounded hover:bg-yellow-500/10 transition text-xs">
               <Replace size={12} /> Replace
            </button>
            <button 
               type="button" 
               onClick={() => setDraftResult(null)} 
               className="flex items-center gap-1 px-2 py-1 bg-surface border border-red-500/30 text-red-400 rounded hover:bg-red-500/10 transition text-xs">
               <X size={12} /> Discard
            </button>
          </div>
        </div>
        <p className="text-foreground leading-relaxed whitespace-pre-wrap">{draftResult.draft}</p>
        
        {draftResult.missingInformation?.length > 0 && (
           <p className="mt-3 text-xs text-muted italic border-l-2 border-purple-500/30 pl-2">
             Missing to improve reflection: {draftResult.missingInformation.join(', ')}
           </p>
        )}
      </div>
    );
  }

  return (
    <button 
       type="button" 
       onClick={generateDraft}
       className="mt-2 flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition"
    >
       <Wand2 size={12} /> AI Smart Draft
    </button>
  );
};

export default AiDraftHelper;
