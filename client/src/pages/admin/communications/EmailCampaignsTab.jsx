import React from 'react';
import { Mailbox, ArrowRight, Star } from 'lucide-react';

const EmailCampaignsTab = () => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center min-h-[500px] border border-dashed border-gray-700 bg-gray-800/20 rounded-2xl">
       <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6">
         <Mailbox className="text-indigo-400" size={32} />
       </div>
       <h2 className="text-2xl font-black mb-2 text-white">Email Campaigns</h2>
       <p className="text-gray-400 max-w-lg mb-8">
         Manage drip campaigns, lifecycle emails, and monthly newsletters directly alongside your in-app announcements.
       </p>
       
       <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl text-left w-full max-w-md shadow-sm">
         <div className="flex items-center gap-2 text-emerald-400 font-bold mb-3 uppercase tracking-wider text-xs">
           <Star size={14} /> Coming Soon
         </div>
         <h4 className="text-gray-200 font-medium mb-4">Features in development:</h4>
         <ul className="space-y-3 text-sm text-gray-400 mb-6">
           <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div> Custom Visual Template Builder</li>
           <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div> Sendgrid / AWS SES Native Integration</li>
           <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div> Automated Churn Rescue Campaigns</li>
           <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div> Founding Trader Drip Sequence</li>
         </ul>
         <button className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm font-medium transition cursor-not-allowed opacity-50">
           Activate Module
         </button>
       </div>
    </div>
  );
};

export default EmailCampaignsTab;
