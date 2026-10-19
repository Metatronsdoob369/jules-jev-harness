import React from 'react';
import { AlertTriangle, RefreshCw, LayoutGrid } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Harness ErrorBoundary caught an exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 bg-canvas-deep border border-optic-bright/20 rounded-lg text-center space-y-4 font-mono">
          <div className="p-3 rounded-full bg-drift-amber/10 border border-drift-amber/40 text-drift-amber">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-base font-bold text-slate-100">Display Guard Triggered</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {this.props.title || 'A render component encountered an unexpected state. The application recovered automatically.'}
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] text-drift-amber/80 bg-canvas-deck p-2 rounded border border-canvas-bezel font-mono truncate max-w-sm mx-auto mt-2">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={this.handleReset}
              className="flex items-center space-x-2 px-3 py-1.5 rounded bg-optic-cyan/20 hover:bg-optic-cyan/30 text-optic-cyan border border-optic-cyan/40 text-xs font-bold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Render</span>
            </button>
            {this.props.onSwitchTo2D && (
              <button
                onClick={() => {
                  this.handleReset();
                  this.props.onSwitchTo2D();
                }}
                className="flex items-center space-x-2 px-3 py-1.5 rounded bg-canvas-deck hover:bg-canvas-bezel text-slate-300 border border-canvas-bezel text-xs font-bold transition-colors"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Switch to 2D Board</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
