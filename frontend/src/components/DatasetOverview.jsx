import React from 'react';
import { Columns, Hash, AlertCircle, HelpCircle, ArrowUpRight, CheckCircle2, History, Download, RotateCcw, Sparkles } from 'lucide-react';
import { api } from '../services/api';

export default function DatasetOverview({ dataset, onSelectQuestion, onDatasetUpdated }) {
  if (!dataset) return null;

  const numericCount = Object.keys(dataset.numeric_stats || {}).length;
  const missingCount = Object.values(dataset.missing_values || {}).reduce((a, b) => a + b, 0);
  const isModified = (dataset.history && dataset.history.length > 0) || 
    (dataset.original_rows && dataset.total_rows !== dataset.original_rows) ||
    (dataset.original_columns && dataset.total_columns !== dataset.original_columns);

  const handleExport = (format) => {
    api.downloadExport(dataset.dataset_id, format, dataset.filename);
  };

  const handleReset = async () => {
    if (!window.confirm('Reset this dataset back to its original state?')) return;
    try {
      const fresh = await api.resetDataset(dataset.dataset_id);
      if (onDatasetUpdated) onDatasetUpdated(fresh);
    } catch (e) {
      alert('Reset failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl glass-panel">
          <p className="text-xs font-medium text-slate-400">Total Rows</p>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            {dataset.total_rows.toLocaleString()}
          </p>
          <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 
            {dataset.original_rows && dataset.original_rows !== dataset.total_rows
              ? `Changed from ${dataset.original_rows.toLocaleString()}`
              : 'Indexed in DuckDB'}
          </p>
        </div>

        <div className="p-4 rounded-xl glass-panel">
          <p className="text-xs font-medium text-slate-400">Total Columns</p>
          <p className="text-2xl font-bold text-cyan-300 mt-1 font-mono">
            {dataset.total_columns}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {dataset.original_columns && dataset.original_columns !== dataset.total_columns
              ? `Changed from ${dataset.original_columns}`
              : `${numericCount} numeric measures`}
          </p>
        </div>

        <div className="p-4 rounded-xl glass-panel">
          <p className="text-xs font-medium text-slate-400">DuckDB Working Table</p>
          <p className="text-sm font-semibold text-indigo-300 mt-2 font-mono truncate">
            {dataset.table_name}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Active mutable state</p>
        </div>

        <div className="p-4 rounded-xl glass-panel">
          <p className="text-xs font-medium text-slate-400">Missing Values</p>
          <p className={`text-2xl font-bold mt-1 font-mono ${missingCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
            {missingCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {missingCount === 0 ? 'Clean dataset' : 'Nulls detected'}
          </p>
        </div>
      </div>

      {/* Working Dataset Transformation History & Export Bar */}
      {isModified && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-amber-500/30 backdrop-blur-md space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Working Dataset Transformation History
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-medium transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Original Snapshot</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Modified CSV</span>
              </button>
            </div>
          </div>

          {dataset.history?.length > 0 && (
            <ul className="space-y-1.5 mt-2 pt-2 border-t border-slate-800 text-xs text-slate-300">
              {dataset.history.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-amber-400 font-mono">#{idx + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Suggested Agent Questions */}
      {dataset.suggested_questions?.length > 0 && (
        <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Smart Suggested Questions for this Dataset
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {dataset.suggested_questions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onSelectQuestion(q)}
                className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700/60 hover:border-indigo-400/50 text-xs text-slate-300 hover:text-white transition-all text-left"
              >
                <span>{q}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Column Schema & Statistics */}
      <div className="p-5 rounded-2xl glass-panel">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Columns className="w-4 h-4 text-cyan-400" />
            Column Schema & Profiles
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3 h-3 text-indigo-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3 h-3 text-cyan-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <th className="pb-3 px-3">Column</th>
                <th className="pb-3 px-3">DuckDB Type</th>
                <th className="pb-3 px-3">Nulls</th>
                <th className="pb-3 px-3">Summary Stats (Min / Max / Avg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {dataset.columns.map((col) => {
                const type = dataset.column_types?.[col] || 'VARCHAR';
                const nulls = dataset.missing_values?.[col] || 0;
                const stats = dataset.numeric_stats?.[col];

                return (
                  <tr key={col} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-slate-200 font-mono">
                      {col}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 border border-slate-700 text-cyan-300">
                        {type}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={nulls > 0 ? 'text-amber-400 font-medium' : 'text-slate-500'}>
                        {nulls}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">
                      {stats ? (
                        <span>
                          min: {stats.min} | max: {stats.max} | avg: {stats.mean}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
