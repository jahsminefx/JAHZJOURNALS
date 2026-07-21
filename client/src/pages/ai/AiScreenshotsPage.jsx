import React from 'react';
import { Camera, Image as ImageIcon, Lock } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const AiScreenshotsPage = () => {
  return (
    <div className="min-h-screen pb-16 bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-cyan-500/20 text-cyan-500 rounded-lg">
              <Camera size={24} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Vision Analysis</h1>
          </div>
          <p className="text-muted text-sm">
            Review AI insights generated directly from your chart markups. Identify if your technical analysis holds up to strict algorithmic evaluation.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-xl p-10 text-center shadow-sm">
           <ImageIcon size={48} className="text-muted mx-auto mb-5" />
           <h3 className="text-lg font-bold text-foreground mb-2">Centralized Vision Hub</h3>
           <p className="text-sm text-muted max-w-md mx-auto mb-6">
             All JAHZ Vision models currently operate directly inside individual Trades. To view a screenshot insight, please navigate to the specific trade details page.
           </p>
           <NavLink to="/trades" className="inline-flex px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors">
             Go to Trade Log
           </NavLink>
        </div>

      </div>
    </div>
  );
};

export default AiScreenshotsPage;
