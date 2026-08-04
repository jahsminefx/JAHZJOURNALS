import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Upload, X, FileSpreadsheet } from 'lucide-react';
import api from '../../utils/api';
import Button from '../Button';

const ImportTradesModal = ({ defaultAccountId, isOpen, onClose, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState(defaultAccountId || '');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen && accounts.length === 0) {
      api.get('/accounts').then(({ data }) => {
        setAccounts(data);
        if (!accountId && data.length > 0) setAccountId(data[0].id);
      }).catch(console.error);
    }
  }, [isOpen, accounts.length, accountId]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.csv' && ext !== '.txt') {
        toast.error('Please select a valid CSV file (.csv).');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a CSV file to upload.');
      return;
    }
    if (!accountId) {
      toast.error('Please select a specific account before importing trades.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('accountId', accountId);

    setIsUploading(true);
    try {
      const response = await api.post('/trades/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      toast.success(response.data.message || 'Trades imported successfully.');
      if (onImportSuccess) onImportSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import trades. Please check the CSV format.');
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4 animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-muted/40">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-500" size={20} />
            <h2 className="text-lg font-bold text-foreground">Import Trade History</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleImport} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
              Target Account
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted/60 px-3.5 py-2.5 text-sm text-foreground focus:border-emerald-500 focus:outline-none transition-colors"
              required
            >
              <option value="" disabled>Select an account...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-surface-muted/30 p-6 text-center transition-colors hover:border-emerald-500/50">
            <Upload size={32} className="mb-2.5 text-emerald-500" />
            <p className="mb-1 text-sm font-bold text-foreground">Upload CSV File</p>
            <p className="mb-4 text-xs text-muted">MT4, MT5, cTrader, and generic CSV formats supported.</p>
            
            <label className="cursor-pointer rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-4 py-2 text-xs font-bold hover:bg-emerald-500/20 transition-all">
              Choose File
              <input 
                type="file" 
                accept=".csv,text/csv,text/plain,application/vnd.ms-excel,application/csv" 
                className="hidden" 
                onChange={handleFileChange} 
              />
            </label>
            
            {file && (
              <p className="mt-3.5 text-xs font-bold text-emerald-400 max-w-full truncate px-4 bg-emerald-500/10 py-1.5 rounded-lg border border-emerald-500/20">
                Selected: {file.name}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUploading || !file}
            >
              {isUploading ? 'Importing...' : 'Start Import'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImportTradesModal;
