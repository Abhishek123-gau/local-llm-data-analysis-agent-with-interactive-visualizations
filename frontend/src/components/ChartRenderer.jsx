import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
  ComposedChart
} from 'recharts';
import {
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  AreaChart as AreaIcon,
  CircleDot,
  Layers,
  Code2,
  Download,
  Copy,
  Check,
  Maximize2,
  X
} from 'lucide-react';

const COLORS = [
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#14B8A6', // Teal
];

export default function ChartRenderer({ config, data = [], imageBase64, pythonCode }) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleCopyCode = () => {
    if (pythonCode) {
      navigator.clipboard.writeText(pythonCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // If a Python-generated plot image is provided
  if (imageBase64) {
    return (
      <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <CircleDot className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-wide">
                Statistical Visualization
              </h4>
              <p className="text-xs text-slate-400">Generated via Python (Matplotlib & Seaborn)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pythonCode && (
              <button
                onClick={() => setShowCode(!showCode)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-all"
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>{showCode ? 'Hide Code' : 'View Code'}</span>
              </button>
            )}

            <button
              onClick={() => setIsZoomed(true)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
              title="Expand image"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <a
              href={imageBase64}
              download="statistical_plot.png"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save PNG</span>
            </a>
          </div>
        </div>

        {/* Collapsible Python Code Block */}
        {showCode && pythonCode && (
          <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-3.5 relative text-xs font-mono">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2 text-slate-400">
              <span className="text-[11px] uppercase tracking-wider text-indigo-300">Python Visualization Script</span>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="overflow-x-auto text-emerald-400/90 leading-relaxed max-h-48">
              <code>{pythonCode}</code>
            </pre>
          </div>
        )}

        {/* Plot Image Display */}
        <div className="rounded-xl overflow-hidden bg-slate-950/60 border border-slate-800/80 flex justify-center p-2">
          <img
            src={imageBase64}
            alt="Statistical Plot"
            className="rounded-lg max-h-[460px] w-auto object-contain cursor-pointer hover:opacity-95 transition-opacity"
            onClick={() => setIsZoomed(true)}
          />
        </div>

        {/* Fullscreen Zoom Modal */}
        {isZoomed && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsZoomed(false)}
          >
            <div className="relative max-w-5xl max-h-[90vh] bg-slate-900 rounded-2xl border border-slate-700 p-3 shadow-2xl">
              <button
                onClick={() => setIsZoomed(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={imageBase64}
                alt="Enlarged Plot"
                className="max-h-[82vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!config || !data || data.length === 0) return null;

  const chartType = config.chart_type?.toLowerCase() || 'bar';
  const xAxis = config.x_axis || Object.keys(data[0])[0];
  
  // Identify numeric metrics for Y axis
  let yAxis = config.y_axis;
  if (!yAxis) {
    const keys = Object.keys(data[0]);
    yAxis = keys.find((k) => k !== xAxis && typeof data[0][k] === 'number') || keys[1];
  }

  const zAxis = config.z_axis;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md text-xs font-mono">
          <p className="font-bold text-slate-200 mb-1">{String(label || '')}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color || entry.fill }} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className="text-slate-400">{entry.name}:</span>
              <span className="font-semibold">{Number(entry.value).toLocaleString()}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-5 rounded-2xl glass-panel border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-white tracking-wide">
            {config.title || 'Interactive Visualization'}
          </h4>
          {config.description && (
            <p className="text-xs text-slate-400 mt-0.5">{config.description}</p>
          )}
        </div>
        <div className="p-1.5 rounded-lg bg-slate-800/80 text-indigo-400 border border-slate-700">
          {chartType === 'line' && <LineIcon className="w-4 h-4" />}
          {chartType === 'area' && <AreaIcon className="w-4 h-4" />}
          {chartType === 'pie' && <PieIcon className="w-4 h-4" />}
          {(chartType === 'scatter' || chartType === 'bubble') && <CircleDot className="w-4 h-4" />}
          {chartType === 'composed' && <Layers className="w-4 h-4" />}
          {chartType === 'bar' && <BarChart3 className="w-4 h-4" />}
        </div>
      </div>

      <div className="w-full h-72">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis dataKey={xAxis} stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line
                type="monotone"
                dataKey={yAxis}
                stroke="#6366F1"
                strokeWidth={3}
                dot={{ fill: '#6366F1', r: 4 }}
                activeDot={{ r: 6, fill: '#06B6D4' }}
              />
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis dataKey={xAxis} stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey={yAxis} stroke="#6366F1" fillOpacity={1} fill="url(#areaGrad)" />
            </AreaChart>
          ) : chartType === 'pie' ? (
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Pie
                data={data}
                dataKey={yAxis}
                nameKey={xAxis}
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={50}
                paddingAngle={4}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : (chartType === 'scatter' || chartType === 'bubble') ? (
            <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey={xAxis} name={xAxis} stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis dataKey={yAxis} name={yAxis} stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              {zAxis && <ZAxis dataKey={zAxis} range={[40, 400]} name={zAxis} />}
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Scatter name={`${xAxis} vs ${yAxis}`} data={data} fill="#6366F1">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          ) : chartType === 'composed' ? (
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis dataKey={xAxis} stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey={yAxis} fill="#6366F1" radius={[6, 6, 0, 0]} />
              {config.y_axes?.[1] && (
                <Line type="monotone" dataKey={config.y_axes[1]} stroke="#10B981" strokeWidth={3} />
              )}
            </ComposedChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
              <XAxis dataKey={xAxis} stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <YAxis stroke="#6B7280" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey={yAxis} fill="#6366F1" radius={[6, 6, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
