import React from 'react';
import { Database, Sparkles, Settings, Activity, HardDrive, RefreshCw } from 'lucide-react';

export default function Header({ activeDataset, llmHealth, onOpenSettings, onRefreshHealth }) {
  const isConnected = llmHealth?.status === 'connected' || llmHealth?.status === 'configured';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-dark-900/80 backdrop-blur-xl px-6 py-3.5 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Database className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              CSV AI Intelligence
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              DuckDB Agent
            </span>
          </div>
          <p className="text-xs text-slate-400">Autonomous Text-to-SQL & Visual Analytics</p>
        </div>
      </div>

      {/* Dataset & Engine Status */}
      <div className="flex items-center gap-3">
        {activeDataset && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-300 font-medium truncate max-w-[150px]">{activeDataset.filename}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 font-mono">{activeDataset.total_rows.toLocaleString()} rows</span>
          </div>
        )}

        {/* LLM Status Badge */}
        <div 
          onClick={onRefreshHealth}
          className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs hover:border-slate-600 transition-colors"
          title="Click to recheck LLM status"
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-slate-300 font-medium capitalize">
            {llmHealth?.provider || 'Ollama'}
          </span>
          <span className="text-slate-500 font-mono text-[11px]">
            {llmHealth?.active_model || 'llama3'}
          </span>
        </div>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          <span className="hidden sm:inline">Config</span>
        </button>
      </div>
    </header>
  );
}
