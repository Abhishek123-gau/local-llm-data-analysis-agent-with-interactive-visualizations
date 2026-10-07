import React from 'react';
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
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon, AreaChart as AreaIcon } from 'lucide-react';

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

export default function ChartRenderer({ config, data = [] }) {
  if (!config || !data || data.length === 0) return null;

  const chartType = config.chart_type?.toLowerCase() || 'bar';
  const xAxis = config.x_axis || Object.keys(data[0])[0];
  
  // Identify numeric metrics for Y axis
  let yAxis = config.y_axis;
  if (!yAxis) {
    const keys = Object.keys(data[0]);
    yAxis = keys.find((k) => k !== xAxis && typeof data[0][k] === 'number') || keys[1];
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded-xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md text-xs font-mono">
          <p className="font-bold text-slate-200 mb-1">{String(label)}</p>
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
            {config.title || 'Visualization'}
          </h4>
          {config.description && (
            <p className="text-xs text-slate-400 mt-0.5">{config.description}</p>
          )}
        </div>
        <div className="p-1.5 rounded-lg bg-slate-800/80 text-indigo-400 border border-slate-700">
          {chartType === 'line' && <LineIcon className="w-4 h-4" />}
          {chartType === 'area' && <AreaIcon className="w-4 h-4" />}
          {chartType === 'pie' && <PieIcon className="w-4 h-4" />}
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
