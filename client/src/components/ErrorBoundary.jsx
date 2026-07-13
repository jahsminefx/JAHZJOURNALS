import React from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI Exception:', error, errorInfo);
  }

  render() {
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
            {process.env.NODE_ENV === 'development' && this.state.error && (
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
