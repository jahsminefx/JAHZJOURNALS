import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';
import {
  isChunkLoadError,
  attemptChunkRecoveryReload,
  forceAppReload,
} from '../utils/chunkRecovery';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isRecovering: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, isRecovering: false };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI Exception:', error, errorInfo);

    if (isChunkLoadError(error) && attemptChunkRecoveryReload(error)) {
      this.setState({ isRecovering: true });
    }
  }

  render() {
    if (this.state.isRecovering) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-muted font-sans">
          <div className="flex flex-col items-center gap-3 text-center">
            <RefreshCw size={24} className="animate-spin text-emerald-400" />
            <p className="text-sm font-medium">Updating JAHZJOURNALS...</p>
          </div>
        </div>
      );
    }

    if (this.state.hasError && isChunkLoadError(this.state.error)) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground font-sans">
          <div className="max-w-md w-full bg-surface border border-emerald-500/20 rounded-2xl shadow-xl overflow-hidden text-center p-8">
            <div className="mx-auto bg-emerald-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-6">
              <RefreshCw size={30} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">New update available</h1>
            <p className="text-sm text-muted mb-8 leading-relaxed">
              A newer version of JAHZJOURNALS was just deployed. Refresh to load the latest version — your data is safe on the server.
            </p>
            <Button
              className="w-full justify-center"
              onClick={() => forceAppReload()}
            >
              Refresh Now
            </Button>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground font-sans">
          <div className="max-w-md w-full bg-surface border border-red-500/20 rounded-2xl shadow-xl overflow-hidden text-center p-8">
            <div className="mx-auto bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-6">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-sm text-muted mb-8 leading-relaxed">
              Our trading sanctuary encountered an unexpected glitch. Don't worry, your data is safe on the server.
            </p>
            <Button
              className="w-full justify-center"
              onClick={() => window.location.assign('/')}
            >
              Refresh Application
            </Button>
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-8 text-left bg-black p-4 rounded-lg overflow-x-auto">
                <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
