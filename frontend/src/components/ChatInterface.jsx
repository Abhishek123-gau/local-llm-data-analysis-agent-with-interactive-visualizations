import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  AlertCircle,
  BarChart2,
  Table as TableIcon,
  Wand2,
  Download,
  CheckCircle2,
  Filter,
  Trash2,
  Trash
} from 'lucide-react';
import SqlViewer from './SqlViewer';
import ChartRenderer from './ChartRenderer';
import DataTable from './DataTable';
import { api } from '../services/api';

export default function ChatInterface({
  dataset,
  llmSettings,
  onDatasetUpdated,
  pendingQuestion,
  onClearPendingQuestion
}) {
  const storageKey = dataset?.dataset_id ? `csv_agent_chat_${dataset.dataset_id}` : null;

  const [messages, setMessages] = useState(() => {
    if (storageKey) {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Sync with storageKey if dataset changes
  useEffect(() => {
    if (storageKey) {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
          return;
        } catch (e) {}
      }
    }
    setMessages([]);
  }, [dataset?.dataset_id]);

  // Persist messages whenever they change
  useEffect(() => {
    if (storageKey) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
      } catch (e) {}
    }
  }, [messages, storageKey]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (queryText) => {
    const question = queryText || input;
    if (!question.trim() || !dataset?.dataset_id || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.askAgent(dataset.dataset_id, question, llmSettings);
      
      if (response.dataset_updated && response.updated_dataset) {
        if (onDatasetUpdated) {
          onDatasetUpdated(response.updated_dataset);
        }
      }

      const agentMsg = {
        id: Date.now() + 1,
        sender: 'agent',
        data: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'agent',
        error: err.message || 'Failed to process request',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Handle pending question from suggestions
  useEffect(() => {
    if (pendingQuestion && dataset?.dataset_id) {
      handleSend(pendingQuestion);
      if (onClearPendingQuestion) {
        onClearPendingQuestion();
      }
    }
  }, [pendingQuestion, dataset?.dataset_id]);

  const handleQuickExport = (format) => {
    if (!dataset?.dataset_id) return;
    api.downloadExport(dataset.dataset_id, format, dataset.filename);
  };

  const clearChatHistory = () => {
    if (window.confirm('Clear all conversation messages for this dataset?')) {
      setMessages([]);
      if (storageKey) {
        sessionStorage.removeItem(storageKey);
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[550px] glass-panel rounded-2xl border border-slate-800 overflow-hidden">
      {/* Top Header of Chat */}
      {messages.length > 0 && (
        <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium text-slate-300">
            {messages.length} message{messages.length === 1 ? '' : 's'} recorded
          </span>
          <button
            onClick={clearChatHistory}
            className="flex items-center gap-1 text-slate-400 hover:text-rose-400 text-[11px] transition-colors"
            title="Clear chat history"
          >
            <Trash className="w-3 h-3" />
            <span>Clear History</span>
          </button>
        </div>
      )}

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-200">
                Ask Questions or Transform <span className="text-indigo-400">{dataset?.filename}</span>
              </h3>
              <p className="text-xs text-slate-400 max-w-lg mt-1 leading-relaxed">
                You can ask questions to analyze and graph the data, OR command the agent to engineer new features, drop columns, filter rows, clean nulls, and export the modified dataset.
              </p>
            </div>

            {/* Quick Starter Prompts */}
            <div className="space-y-2 max-w-xl w-full">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Suggested Actions & Questions</p>
              <div className="flex flex-wrap justify-center gap-2">
                {dataset?.suggested_questions?.slice(0, 2).map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-xs text-slate-300 hover:text-white transition-all text-left flex items-center gap-1.5"
                  >
                    <span>📊 {q}</span>
                  </button>
                ))}
                
                {/* Feature engineering starters */}
                <button
                  onClick={() => handleSend("Drop any rows where important numeric fields are null")}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 transition-all text-left flex items-center gap-1.5"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Clean missing / null rows</span>
                </button>

                <button
                  onClick={() => handleSend("Generate a feature correlation heatmap for all numeric columns")}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-xs text-cyan-300 transition-all text-left flex items-center gap-1.5"
                >
                  <span>🔥 Correlation Heatmap</span>
                </button>

                <button
                  onClick={() => handleSend("Show an outlier boxplot and distribution analysis")}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-xs text-purple-300 transition-all text-left flex items-center gap-1.5"
                >
                  <span>📦 Outlier Boxplot</span>
                </button>
                
                {dataset?.columns?.length > 2 && (
                  <button
                    onClick={() => handleSend(`Drop column "${dataset.columns[dataset.columns.length - 1]}"`)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs text-rose-300 transition-all text-left flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Drop column "{dataset.columns[dataset.columns.length - 1]}"</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'agent' && (
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-indigo-600/30">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[90%] sm:max-w-[85%] space-y-3 ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-3.5 px-4 rounded-2xl rounded-tr-sm shadow-md'
                    : 'w-full'
                }`}
              >
                {msg.sender === 'user' ? (
                  <div>
                    <p className="text-sm font-medium">{msg.text}</p>
                    <span className="text-[10px] text-indigo-200/80 mt-1 block text-right">
                      {msg.timestamp}
                    </span>
                  </div>
                ) : msg.error ? (
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Analysis Error</p>
                      <p className="mt-0.5 text-slate-400">{msg.error}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Mutation Banner if dataset was altered */}
                    {msg.data.is_mutation && (
                      <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div>
                            <span className="font-semibold">Working Dataset Updated:</span>{' '}
                            <span className="text-slate-200">{msg.data.mutation_summary || msg.data.explanation}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleQuickExport('csv')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 shrink-0 shadow-sm transition-all"
                        >
                          <Download className="w-3 h-3" />
                          <span>Export CSV</span>
                        </button>
                      </div>
                    )}

                    {/* Explanation / Reasoning */}
                    <div className="p-4 rounded-2xl glass-panel text-xs text-slate-200 leading-relaxed border border-slate-800">
                      <p className="font-medium text-slate-100">{msg.data.explanation}</p>
                      {msg.data.summary_insights && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 text-cyan-300">
                          <span className="font-semibold text-slate-300 block mb-1">Key Observations:</span>
                          <p className="text-slate-300 leading-relaxed">{msg.data.summary_insights}</p>
                        </div>
                      )}
                    </div>

                    {/* SQL Inspector */}
                    {msg.data.sql_query && (
                      <SqlViewer
                        sqlQuery={msg.data.sql_query}
                        datasetId={dataset.dataset_id}
                        executionTime={msg.data.execution_time_ms}
                        iterations={msg.data.iterations}
                      />
                    )}

                    {/* Chart Visualization (Python Matplotlib/Seaborn or Interactive Recharts) */}
                    {(msg.data.image_base64 || (msg.data.chart_config && msg.data.chart_config.chart_type !== 'table')) && (
                      <ChartRenderer
                        config={msg.data.chart_config}
                        data={msg.data.results}
                        imageBase64={msg.data.image_base64}
                        pythonCode={msg.data.python_code}
                      />
                    )}

                    {/* Results Table */}
                    {msg.data.results?.length > 0 && (
                      <DataTable
                        data={msg.data.results}
                        columns={msg.data.columns}
                        title={msg.data.is_mutation ? "Transformed Dataset Preview" : "Query Result Set"}
                      />
                    )}
                  </div>
                )}
              </div>

              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/30">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="p-3.5 rounded-2xl glass-panel border border-slate-800 flex items-center gap-2.5 text-xs text-indigo-300">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Thinking & compiling DuckDB SQL query / data operation...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Query Input Footer */}
      <div className="p-3.5 sm:p-4 bg-slate-900/90 border-t border-slate-800">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder={`Ask a question or request a feature transformation (e.g. "add profit margin column", "drop column X")...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-slate-800/90 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
          />

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Run</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
