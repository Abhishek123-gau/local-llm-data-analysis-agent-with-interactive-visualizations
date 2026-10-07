import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  BarChart3,
  Table as TableIcon,
  Upload,
  Sparkles,
  Database,
  Layers,
  HelpCircle,
} from 'lucide-react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import DatasetOverview from './components/DatasetOverview';
import DataTable from './components/DataTable';
import ChatInterface from './components/ChatInterface';
import SettingsModal from './components/SettingsModal';
import { api } from './services/api';

export default function App() {
  const [dataset, setDataset] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'overview' | 'table'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [llmHealth, setLlmHealth] = useState(null);
  
  const [llmSettings, setLlmSettings] = useState(() => {
    const saved = localStorage.getItem('csv_agent_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      provider: 'ollama',
      modelName: 'qwen2.5-coder:7b',
      ollamaUrl: 'http://127.0.0.1:11434',
      apiKey: '',
    };
  });

  const checkHealth = async () => {
    try {
      const status = await api.checkHealth(llmSettings);
      setLlmHealth(status);
    } catch (err) {
      setLlmHealth({ status: 'unreachable', provider: llmSettings.provider });
    }
  };

  useEffect(() => {
    checkHealth();
  }, [llmSettings]);

  const handleDatasetLoaded = (newDataset) => {
    setDataset(newDataset);
    setActiveTab('chat');
  };

  const handleSelectSuggestedQuestion = (question) => {
    setActiveTab('chat');
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-slate-100">
      <Header
        activeDataset={dataset}
        llmHealth={llmHealth}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefreshHealth={checkHealth}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {!dataset ? (
          <div className="py-6 space-y-6">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Text-to-SQL Multi-Step Autonomous Analytics</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Turn any CSV into an Intelligent Analytical Agent
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Upload any CSV dataset to query in natural language. Powered by DuckDB high-performance SQL engine with autonomous self-correcting query synthesis and automatic charting.
              </p>
            </div>

            <FileUpload onDatasetLoaded={handleDatasetLoaded} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Navigation & Dataset Switcher Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-2xl glass-panel border border-slate-800">
              {/* Tab Switcher */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'chat'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Agent Chat</span>
                </button>

                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'overview'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Overview & Schema</span>
                </button>

                <button
                  onClick={() => setActiveTab('table')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'table'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Data Table Preview</span>
                </button>
              </div>

              {/* Upload Another CSV button */}
              <button
                onClick={() => setDataset(null)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors self-end sm:self-auto"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Upload Different CSV</span>
              </button>
            </div>

            {/* Active Tab View */}
            <div>
              {activeTab === 'chat' && (
                <ChatInterface dataset={dataset} llmSettings={llmSettings} />
              )}

              {activeTab === 'overview' && (
                <DatasetOverview
                  dataset={dataset}
                  onSelectQuestion={handleSelectSuggestedQuestion}
                />
              )}

              {activeTab === 'table' && (
                <DataTable
                  data={dataset.preview_rows}
                  columns={dataset.columns}
                  title={`Preview (${dataset.filename})`}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={llmSettings}
        onSaveSettings={(newSettings) => setLlmSettings(newSettings)}
      />
    </div>
  );
}
