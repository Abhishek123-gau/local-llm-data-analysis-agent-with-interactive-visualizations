import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Download, ArrowUpDown } from 'lucide-react';

export default function DataTable({ data = [], columns = [], title = "Data Preview" }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(true);
    }
  };

  const filteredData = useMemo(() => {
    if (!data) return [];
    let result = [...data];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(term)
        )
      );
    }

    if (sortCol) {
      result.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return result;
  }, [data, searchTerm, sortCol, sortAsc]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const exportCSV = () => {
    if (!data.length) return;
    const headers = columns.join(',');
    const rows = data.map((row) =>
      columns.map((col) => `"${String(row[col] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 glass-panel rounded-2xl">
        No rows to display.
      </div>
    );
  }

  return (
    <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            {title}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
            {filteredData.length} records
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={exportCSV}
            className="p-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
            title="Export as CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Table Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="py-3 px-4 cursor-pointer hover:text-white transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span>{col}</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {paginatedData.map((row, idx) => (
              <tr key={idx} className="hover:bg-indigo-950/20 transition-colors">
                {columns.map((col) => {
                  const val = row[col];
                  const isNumber = typeof val === 'number';
                  return (
                    <td key={col} className={`py-2.5 px-4 font-mono text-slate-300 ${isNumber ? 'text-right text-cyan-300' : ''}`}>
                      {val === null || val === undefined ? (
                        <span className="text-slate-600 italic">null</span>
                      ) : (
                        String(val)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg bg-slate-800 border border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
