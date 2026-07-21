import React from 'react';
import { Settings, ShieldCheck, Mail, Database, Globe } from 'lucide-react';

const SettingsTab = () => {
  return (
    <div className="max-w-4xl space-y-6">
       <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-sm">
         <div className="flex items-center gap-3 mb-6 border-b border-gray-700 pb-4">
           <Settings className="text-gray-400" size={24} />
           <h3 className="text-lg font-bold text-gray-200">Global Communication Settings</h3>
         </div>

         <div className="space-y-6">
           {/* Section 1 */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
             <div>
               <h4 className="font-semibold text-gray-300 text-sm flex items-center gap-2"><Mail size={16} /> SMTP Integration</h4>
               <p className="text-xs text-gray-500 mt-1">Configure your Sendgrid or AWS SES credentials for outbound emails.</p>
             </div>
             <div className="col-span-2 space-y-3">
                <input type="text" placeholder="SMTP Host (e.g., smtp.sendgrid.net)" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none" disabled />
                <div className="flex gap-4">
                  <input type="text" placeholder="Port (e.g., 587)" className="w-1/3 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none" disabled />
                  <input type="text" placeholder="API Key" className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none" disabled />
                </div>
                <button className="px-4 py-2 bg-gray-700 text-sm text-gray-300 rounded max-w-max hover:bg-gray-600 transition">Test Connection</button>
             </div>
           </div>

           <hr className="border-gray-700" />

           {/* Section 2 */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
             <div>
               <h4 className="font-semibold text-gray-300 text-sm flex items-center gap-2"><Globe size={16} /> Sender Address</h4>
               <p className="text-xs text-gray-500 mt-1">What email do users see when you reply to them?</p>
             </div>
             <div className="col-span-2">
                <input type="email" defaultValue="support@jahzjournals.com" className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none" disabled />
             </div>
           </div>

           <hr className="border-gray-700" />

           {/* Section 3 */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
             <div>
               <h4 className="font-semibold text-emerald-400 text-sm flex items-center gap-2"><ShieldCheck size={16} /> Data Retention</h4>
               <p className="text-xs text-gray-500 mt-1">Configure automated cleanup tasks for old messages and system logs.</p>
             </div>
             <div className="col-span-2 space-y-3">
                <label className="flex items-center gap-3 text-sm text-gray-300">
                  <input type="checkbox" defaultChecked className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-0" disabled />
                  Automatically archive resolved contact messages after 30 days
                </label>
                <label className="flex items-center gap-3 text-sm text-gray-300">
                  <input type="checkbox" defaultChecked className="rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-0" disabled />
                  Delete unread global announcements after 6 months to save space
                </label>
             </div>
           </div>
         </div>
       </div>
    </div>
  );
};

export default SettingsTab;
