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
  BrainCircuit,
} from 'lucide-react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import DatasetOverview from './components/DatasetOverview';
import DataTable from './components/DataTable';
import ChatInterface from './components/ChatInterface';
import AutoAnalyzeTab from './components/AutoAnalyzeTab';
import SettingsModal from './components/SettingsModal';
import { api } from './services/api';

export default function App() {
  const [dataset, setDataset] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'overview' | 'table' | 'automl'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [llmHealth, setLlmHealth] = useState(null);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  
  const [llmSettings, setLlmSettings] = useState(() => {
    const saved = localStorage.getItem('csv_agent_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.modelName === 'qwen2.5-coder:7b' || parsed.modelName === 'llama3') {
          parsed.modelName = 'qwen2.5-coder:0.5b';
          localStorage.setItem('csv_agent_settings', JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) {}
    }
    return {
      provider: 'ollama',
      modelName: 'qwen2.5-coder:0.5b',
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

  const handleDatasetUpdated = (updatedDataset) => {
    if (updatedDataset) {
      setDataset(updatedDataset);
    }
  };

  const handleSelectSuggestedQuestion = (question) => {
    setPendingQuestion(question);
    setActiveTab('chat');
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-900 text-slate-100">
      <Header
        activeDataset={dataset}
        llmHealth={llmHealth}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRefreshHealth={checkHealth}
        onDatasetUpdated={handleDatasetUpdated}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {!dataset ? (
          <div className="py-6 space-y-6">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Text-to-SQL & Autonomous Feature Engineering Engine</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Turn any CSV into an Intelligent Analytical Agent
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Upload any CSV dataset to analyze, engineer features, filter data, and query in natural language. Powered by DuckDB high-performance SQL engine with memory snapshots and live data exports.
              </p>
            </div>

            <FileUpload onDatasetLoaded={handleDatasetLoaded} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Navigation & Dataset Switcher Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 rounded-2xl glass-panel border border-slate-800">
              {/* Tab Switcher */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800 w-full sm:w-auto">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'chat'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Agent Chat & Transformations</span>
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
                  <span>Working Data Table</span>
                </button>

                <button
                  onClick={() => setActiveTab('automl')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'automl'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30 font-bold'
                      : 'text-indigo-400 hover:text-indigo-300'
                  }`}
                >
                  <BrainCircuit className="w-3.5 h-3.5" />
                  <span>Auto-ML Multi-Agent</span>
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

            {/* Persistent Tab Views - kept in DOM so history & state never reset */}
            <div>
              <div className={activeTab === 'chat' ? 'block' : 'hidden'}>
                <ChatInterface
                  dataset={dataset}
                  llmSettings={llmSettings}
                  onDatasetUpdated={handleDatasetUpdated}
                  pendingQuestion={pendingQuestion}
                  onClearPendingQuestion={() => setPendingQuestion(null)}
                />
              </div>

              <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
                <DatasetOverview
                  dataset={dataset}
                  onSelectQuestion={handleSelectSuggestedQuestion}
                  onDatasetUpdated={handleDatasetUpdated}
                />
              </div>

              <div className={activeTab === 'table' ? 'block' : 'hidden'}>
                <DataTable
                  data={dataset.preview_rows}
                  columns={dataset.columns}
                  title={`Working Dataset Preview (${dataset.filename})`}
                />
              </div>

              <div className={activeTab === 'automl' ? 'block' : 'hidden'}>
                <AutoAnalyzeTab
                  dataset={dataset}
                  llmSettings={llmSettings}
                />
              </div>
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
