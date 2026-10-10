import React, { useState } from 'react';
import {
  BrainCircuit,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Download,
  Code2,
  Copy,
  Check,
  Loader2,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Cpu,
  TableProperties,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../services/api';

export default function AutoAnalyzeTab({ dataset, llmSettings }) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleRun = async (overridePrompt) => {
    const q = overridePrompt || prompt;
    if (!q.trim() || !dataset?.dataset_id || loading) return;

    setLoading(true);
    setError(null);
    setReport(null);
    setActiveStep(1);

    try {
      // Simulate visual progress through agents
      const stepTimer1 = setTimeout(() => setActiveStep(2), 1500);
      const stepTimer2 = setTimeout(() => setActiveStep(3), 3500);

      const result = await api.runAutoAnalyze(dataset.dataset_id, q, llmSettings);
      
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setActiveStep(4);
      setReport(result);
    } catch (err) {
      setError(err.message || 'Multi-agent pipeline failed.');
      setActiveStep(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (report?.training_results?.python_script_code) {
      navigator.clipboard.writeText(report.training_results.python_script_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">CRITICAL</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">HIGH</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">INFO</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Prompt Input */}
      <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Autonomous Auto-Analyze & Machine Learning Pipeline
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                5 Coordinated Agents
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your prediction use case. The agents will diagnose data issues, verify actions, engineer features, benchmark algorithms, and save the champion model.
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleRun(); }}
          className="flex flex-col sm:flex-row gap-2.5 pt-2"
        >
          <input
            type="text"
            placeholder={`Enter your machine learning use case (e.g. "Predict employee attrition", "Predict revenue based on sales")...`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            className="flex-1 bg-slate-800/90 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />

          <button
            type="submit"
            disabled={!prompt.trim() || loading}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Running Multi-Agent Pipeline...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Auto-Analyze & Train</span>
              </>
            )}
          </button>
        </form>

        {/* Starter Templates */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-500 font-medium text-[11px]">Quick Templates:</span>
          {dataset?.columns?.slice(0, 4).map((col, idx) => (
            <button
              key={idx}
              onClick={() => {
                const templ = `Train a model to predict "${col}" using historical features`;
                setPrompt(templ);
                handleRun(templ);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-[11px] transition-colors"
            >
              Predict "{col}"
            </button>
          ))}
        </div>
      </div>

      {/* Error Card */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Live Stepper Tracker */}
      {loading && (
        <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-4 animate-pulse">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Agents Collaborating in Background...</span>
            <span className="text-indigo-400">Step {activeStep} of 4</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div className={`p-3 rounded-xl border ${activeStep >= 1 ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
              <p className="font-bold">1. Problem Formulator</p>
              <p className="text-[11px] mt-1 text-slate-400">Extracts target column & ML task</p>
            </div>
            <div className={`p-3 rounded-xl border ${activeStep >= 2 ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
              <p className="font-bold">2. Data Diagnostic Gate</p>
              <p className="text-[11px] mt-1 text-slate-400">Audits defects & verifies actions</p>
            </div>
            <div className={`p-3 rounded-xl border ${activeStep >= 3 ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
              <p className="font-bold">3. Preprocessing Agent</p>
              <p className="text-[11px] mt-1 text-slate-400">Imputes, scales & stratifies split</p>
            </div>
            <div className={`p-3 rounded-xl border ${activeStep >= 4 ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
              <p className="font-bold">4. Model Benchmarking</p>
              <p className="text-[11px] mt-1 text-slate-400">Trains 5 models & crowns champion</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Section */}
      {report && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl glass-panel">
              <p className="text-xs font-medium text-slate-400">Target Column</p>
              <p className="text-lg font-bold text-white mt-1 font-mono truncate">
                {report.plan.target_column}
              </p>
              <span className="text-[11px] text-cyan-400 capitalize font-medium">
                {report.plan.task_type} Task
              </span>
            </div>

            <div className="p-4 rounded-xl glass-panel">
              <p className="text-xs font-medium text-slate-400">Data Issues Remediated</p>
              <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">
                {report.diagnostics.total_issues_found}
              </p>
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> All verified & resolved
              </span>
            </div>

            <div className="p-4 rounded-xl glass-panel">
              <p className="text-xs font-medium text-slate-400">Engineered Features</p>
              <p className="text-2xl font-bold text-indigo-300 mt-1 font-mono">
                {report.preprocessing_summary.total_features}
              </p>
              <span className="text-[11px] text-slate-400">
                {report.preprocessing_summary.train_samples} train / {report.preprocessing_summary.test_samples} test
              </span>
            </div>

            <div className="p-4 rounded-xl glass-panel border border-emerald-500/30 bg-emerald-950/20">
              <p className="text-xs font-medium text-emerald-300 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Champion Algorithm
              </p>
              <p className="text-lg font-bold text-white mt-1 font-mono truncate">
                {report.training_results.champion_model_name}
              </p>
              <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                {report.plan.task_type === 'classification'
                  ? `F1: ${report.training_results.champion_metrics.f1_score} • Acc: ${(report.training_results.champion_metrics.accuracy * 100).toFixed(1)}%`
                  : `R²: ${report.training_results.champion_metrics.r2_score} • RMSE: ${report.training_results.champion_metrics.rmse}`}
              </span>
            </div>
          </div>

          {/* STAGE 2: Task-Aware Data Diagnostic & Verification Table */}
          <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Data Quality Diagnostics & Verified Actions Taken
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {report.diagnostics.issues.length} audit checkpoints
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3 px-3">Column</th>
                    <th className="pb-3 px-3">Category</th>
                    <th className="pb-3 px-3">Severity</th>
                    <th className="pb-3 px-3">Discovered Issue</th>
                    <th className="pb-3 px-3 text-emerald-400">Verified Remediation Executed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {report.diagnostics.issues.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{item.column}</td>
                      <td className="py-2.5 px-3 text-slate-400">{item.category}</td>
                      <td className="py-2.5 px-3">{getSeverityBadge(item.severity)}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-300 max-w-xs">{item.description}</td>
                      <td className="py-2.5 px-3 font-sans text-emerald-300 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{item.verified_action}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* STAGE 4: Model Leaderboard & Benchmarking */}
          <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Algorithm Benchmark Leaderboard
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Sorted by {report.plan.optimization_metric.toUpperCase()}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3 px-3">Rank</th>
                    <th className="pb-3 px-3">Model Algorithm</th>
                    {report.plan.task_type === 'classification' ? (
                      <>
                        <th className="pb-3 px-3">Accuracy</th>
                        <th className="pb-3 px-3 text-emerald-400">F1-Score</th>
                        <th className="pb-3 px-3">Precision</th>
                        <th className="pb-3 px-3">Recall</th>
                        <th className="pb-3 px-3">ROC-AUC</th>
                      </>
                    ) : (
                      <>
                        <th className="pb-3 px-3 text-emerald-400">R² Score</th>
                        <th className="pb-3 px-3">RMSE</th>
                        <th className="pb-3 px-3">MAE</th>
                      </>
                    )}
                    <th className="pb-3 px-3">Training Time</th>
                    <th className="pb-3 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                  {report.training_results.leaderboard.map((row) => (
                    <tr
                      key={row.rank}
                      className={row.is_champion ? "bg-emerald-950/20 font-bold" : "hover:bg-slate-800/30"}
                    >
                      <td className="py-2.5 px-3 text-slate-400">#{row.rank}</td>
                      <td className="py-2.5 px-3 text-white flex items-center gap-2">
                        {row.is_champion && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                        <span>{row.model_name}</span>
                      </td>
                      {report.plan.task_type === 'classification' ? (
                        <>
                          <td className="py-2.5 px-3">{(row.accuracy * 100).toFixed(1)}%</td>
                          <td className="py-2.5 px-3 text-emerald-300 font-bold">{row.f1_score}</td>
                          <td className="py-2.5 px-3">{row.precision}</td>
                          <td className="py-2.5 px-3">{row.recall}</td>
                          <td className="py-2.5 px-3">{row.roc_auc !== null ? row.roc_auc : '—'}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-3 text-emerald-300 font-bold">{row.r2_score}</td>
                          <td className="py-2.5 px-3">{row.rmse}</td>
                          <td className="py-2.5 px-3">{row.mae}</td>
                        </>
                      )}
                      <td className="py-2.5 px-3 text-slate-400">{row.training_time_ms} ms</td>
                      <td className="py-2.5 px-3 text-center">
                        {row.is_champion ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            CHAMPION
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Evaluated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Evaluation Visuals */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {report.training_results.feature_importance_image && (
              <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  Champion Feature Importance Ranking
                </h4>
                <div className="rounded-xl overflow-hidden bg-slate-950/60 p-2 flex justify-center">
                  <img
                    src={report.training_results.feature_importance_image}
                    alt="Feature Importance"
                    className="max-h-72 w-auto object-contain rounded-lg"
                  />
                </div>
              </div>
            )}

            {report.training_results.evaluation_image && (
              <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {report.plan.task_type === 'classification' ? 'Confusion Matrix' : 'Actual vs. Predicted Plot'}
                </h4>
                <div className="rounded-xl overflow-hidden bg-slate-950/60 p-2 flex justify-center">
                  <img
                    src={report.training_results.evaluation_image}
                    alt="Evaluation Chart"
                    className="max-h-72 w-auto object-contain rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Center & Artifact Downloads */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950/50 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Champion Model Artifacts Ready
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Download the serializable scikit-learn pipeline (.joblib) or inspect the Python reproduction script.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setShowCode(!showCode)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors border border-slate-700"
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>{showCode ? 'Hide Code' : 'View Python Script'}</span>
              </button>

              <a
                href={api.getModelDownloadUrl(report.task_id)}
                download
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download .joblib Model</span>
              </a>
            </div>
          </div>

          {/* Collapsible Python Script Viewer */}
          {showCode && report.training_results.python_script_code && (
            <div className="p-4 rounded-2xl glass-panel border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-semibold uppercase text-[11px]">
                  train_pipeline.py (Self-Contained Reproducible Code)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied!' : 'Copy Script'}</span>
                  </button>
                  <a
                    href={api.getScriptDownloadUrl(report.task_id)}
                    download="train_pipeline.py"
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 ml-2"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download .py</span>
                  </a>
                </div>
              </div>

              <pre className="overflow-x-auto text-emerald-400/90 leading-relaxed max-h-80 p-2 bg-slate-950/80 rounded-xl">
                <code>{report.training_results.python_script_code}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
