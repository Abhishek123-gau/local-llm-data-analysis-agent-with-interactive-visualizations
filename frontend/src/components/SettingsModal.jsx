import React, { useState } from 'react';
import { X, Check, Activity, AlertCircle, RefreshCw, Server, Key, Cpu } from 'lucide-react';
import { api } from '../services/api';

export default function SettingsModal({ isOpen, onClose, settings, onSaveSettings }) {
  if (!isOpen) return null;

  const [provider, setProvider] = useState(settings.provider || 'ollama');
  const [modelName, setModelName] = useState(settings.modelName || 'llama3');
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl || 'http://127.0.0.1:11434');
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.checkHealth({ provider, modelName, ollamaUrl, apiKey });
      setTestResult(res);
    } catch (err) {
      setTestResult({ status: 'error', error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const updated = { provider, modelName, ollamaUrl, apiKey };
    localStorage.setItem('csv_agent_settings', JSON.stringify(updated));
    onSaveSettings(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl glass-panel border border-slate-700 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">LLM Provider Settings</h3>
              <p className="text-xs text-slate-400">Configure local Ollama or cloud models for Text-to-SQL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 text-xs">
          {/* Provider Selection */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Provider</label>
            <div className="grid grid-cols-4 gap-2">
              {['ollama', 'openai', 'gemini', 'groq'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setProvider(p);
                    if (p === 'ollama' && !modelName) setModelName('llama3');
                    if (p === 'openai' && !modelName) setModelName('gpt-4o-mini');
                    if (p === 'gemini' && !modelName) setModelName('gemini-1.5-flash');
                    if (p === 'groq' && !modelName) setModelName('llama-3.1-70b-versatile');
                  }}
                  className={`p-2.5 rounded-xl border text-center font-medium capitalize transition-all ${
                    provider === p
                      ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p === 'ollama' ? '🦙 Ollama' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Model Name */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-300 font-semibold">Model Name</label>
              {provider === 'ollama' && (
                <span className="text-[11px] text-slate-400">Quick Select:</span>
              )}
            </div>

            {provider === 'ollama' && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['qwen2.5-coder:7b', 'qwen2.5:7b', 'deepseek-coder:6.7b'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModelName(m)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                      modelName === m
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-semibold'
                        : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ⚡ {m}
                  </button>
                ))}
              </div>
            )}

            <input
              type="text"
              placeholder={provider === 'ollama' ? 'qwen2.5-coder:7b, deepseek-coder:6.7b' : 'gpt-4o-mini, gemini-1.5-flash'}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Ollama URL (only if Ollama is selected) */}
          {provider === 'ollama' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Ollama Base URL</label>
              <input
                type="text"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          )}

          {/* API Key (if cloud provider) */}
          {provider !== 'ollama' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">API Key</label>
              <input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          )}

          {/* Test Connection Button & Status */}
          <div className="pt-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1.5 transition-colors"
              >
                <Activity className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Testing...' : 'Test Connection'}</span>
              </button>

              {testResult && (
                <div className="text-[11px] flex items-center gap-1.5">
                  {testResult.status === 'connected' || testResult.status === 'configured' ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      <Check className="w-3.5 h-3.5" /> Connected!
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {testResult.hint || testResult.error || 'Check configuration'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/30 transition-all"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
