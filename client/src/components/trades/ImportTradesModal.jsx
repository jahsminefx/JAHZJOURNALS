import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Upload, X } from 'lucide-react';
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
      setFile(e.target.files[0]);
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
      onImportSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to import trades. Please check the CSV format.');
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-bold text-foreground">Import History</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-surface-muted hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleImport} className="p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-muted mb-2">Target Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground focus:border-emerald-400 focus:outline-none"
              required
            >
              <option value="" disabled>Select an account...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-muted/50 p-6 text-center">
            <Upload size={32} className="mb-3 text-emerald-600 dark:text-emerald-400" />
            <p className="mb-1 text-sm font-medium text-foreground">Upload CSV File</p>
            <p className="mb-4 text-xs text-muted">MT4, MT5, and generic CSV layouts supported.</p>
            
            <label className="cursor-pointer rounded-lg bg-surface-muted px-4 py-2 border border-border text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground transition-all">
              Choose File
              <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            </label>
            
            {file && (
              <p className="mt-4 text-xs font-medium text-emerald-600 dark:text-emerald-400 max-w-full truncate px-4">
                Selected: {file.name}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
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
