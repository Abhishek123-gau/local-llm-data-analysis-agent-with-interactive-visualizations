import React, { useState } from 'react';
import { Database, Sparkles, Settings, HardDrive, Download, RotateCcw, ChevronDown, Check } from 'lucide-react';
import { api } from '../services/api';

export default function Header({ activeDataset, llmHealth, onOpenSettings, onRefreshHealth, onDatasetUpdated }) {
  const isConnected = llmHealth?.status === 'connected' || llmHealth?.status === 'configured';
  const [isExporting, setIsExporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const isModified = activeDataset && (
    (activeDataset.history && activeDataset.history.length > 0) ||
    activeDataset.total_rows !== activeDataset.original_rows ||
    activeDataset.total_columns !== activeDataset.original_columns
  );

  const handleExport = async (format) => {
    if (!activeDataset) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      await api.downloadExport(activeDataset.dataset_id, format, activeDataset.filename);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = async () => {
    if (!activeDataset || !window.confirm('Reset this dataset back to its original unmodified state?')) return;
    setIsResetting(true);
    try {
      const fresh = await api.resetDataset(activeDataset.dataset_id);
      if (onDatasetUpdated) onDatasetUpdated(fresh);
    } catch (e) {
      alert('Reset failed: ' + e.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-dark-900/80 backdrop-blur-xl px-4 sm:px-6 py-3.5 flex items-center justify-between">
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
          <p className="text-xs text-slate-400 hidden sm:block">Autonomous Text-to-SQL & Feature Engineering Engine</p>
        </div>
      </div>

      {/* Actions & Status */}
      <div className="flex items-center gap-2 sm:gap-3">
        {activeDataset && (
          <>
            {/* Live Dataset Info */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300 font-medium truncate max-w-[140px]">{activeDataset.filename}</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-mono">{activeDataset.total_rows.toLocaleString()} rows</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-mono">{activeDataset.total_columns} cols</span>
              {isModified && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Modified ({activeDataset.history?.length || 'Live'})
                </span>
              )}
            </div>

            {/* Reset Button (visible if modified) */}
            {isModified && (
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-medium transition-all"
                title="Reset dataset back to original uploaded state"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Reset Original</span>
              </button>
            )}

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Data</span>
                <ChevronDown className="w-3 h-3 opacity-75" />
              </button>

              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>Download as CSV</span>
                    <span className="text-[10px] text-slate-400 font-mono">.csv</span>
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center justify-between"
                  >
                    <span>Download as JSON</span>
                    <span className="text-[10px] text-slate-400 font-mono">.json</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* LLM Status Badge */}
        <div 
          onClick={onRefreshHealth}
          className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs hover:border-slate-600 transition-colors"
          title="Click to recheck LLM status"
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-slate-300 font-medium capitalize hidden sm:inline">
            {llmHealth?.provider || 'Ollama'}
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
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
