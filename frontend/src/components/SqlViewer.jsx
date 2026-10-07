import React, { useState } from 'react';
import { Terminal, Copy, Check, Play, Clock, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function SqlViewer({ sqlQuery, datasetId, executionTime, iterations = 1, onCustomRun }) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableSql, setEditableSql] = useState(sqlQuery || '');
  const [running, setRunning] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(editableSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunCustom = async () => {
    if (!editableSql.trim() || !datasetId) return;
    setRunning(true);
    try {
      const res = await api.runCustomSQL(datasetId, editableSql);
      if (onCustomRun) onCustomRun(res);
    } catch (err) {
      alert(`SQL Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden text-xs">
      {/* Top Bar */}
      <div className="px-3.5 py-2 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-slate-300 font-semibold">DuckDB SQL</span>
          {executionTime && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
              <Clock className="w-3 h-3" /> {executionTime}ms
            </span>
          )}
          {iterations > 1 && (
            <span className="text-[10px] text-amber-400 font-mono bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20">
              {iterations} agent iterations
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
          >
            {isEditing ? 'Cancel' : 'Edit Query'}
          </button>
          
          {isEditing && (
            <button
              onClick={handleRunCustom}
              disabled={running}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium transition-colors"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{running ? 'Running...' : 'Run'}</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Copy SQL"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* SQL Code Box */}
      <div className="p-3">
        {isEditing ? (
          <textarea
            value={editableSql}
            onChange={(e) => setEditableSql(e.target.value)}
            rows={4}
            className="w-full bg-slate-900 text-cyan-300 font-mono text-xs p-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-cyan-500"
          />
        ) : (
          <pre className="text-cyan-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {sqlQuery}
          </pre>
        )}
      </div>
    </div>
  );
}
