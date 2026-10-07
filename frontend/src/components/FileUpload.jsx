import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export default function FileUpload({ onDatasetLoaded }) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a valid .csv file.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.uploadCSV(file);
      onDatasetLoaded(data);
    } catch (err) {
      setError(err.message || 'Failed to process CSV file.');
    } finally {
      setLoading(false);
    }
  };

  const loadSampleDataset = async (sampleName) => {
    setLoading(true);
    setError(null);
    try {
      let csvContent = '';
      if (sampleName === 'tech_sales') {
        csvContent = `Order_ID,Order_Date,Region,Sales_Rep,Customer_Segment,Product_Category,Product_Name,Units_Sold,Unit_Price,Discount_Rate,Total_Revenue,Profit
1001,2024-01-05,North,Sarah Jenkins,Enterprise,Software,Cloud Analytics Pro,12,499.00,0.10,5389.20,3200.50
1002,2024-01-08,West,Michael Chang,SMB,Hardware,Enterprise Server X1,2,3500.00,0.05,6650.00,2100.00
1003,2024-01-12,East,Emily Watson,Consumer,Peripherals,4K Ultra Monitor,15,350.00,0.15,4462.50,1350.00
1004,2024-01-15,South,David Miller,Enterprise,Services,Annual Support SLA,1,12000.00,0.00,12000.00,7500.00
1005,2024-01-19,North,Sarah Jenkins,SMB,Software,DevOps Suite,8,850.00,0.10,6120.00,3800.00
1006,2024-01-22,West,Michael Chang,Enterprise,Hardware,Network Switch 48P,5,1200.00,0.08,5520.00,2200.00
1007,2024-01-28,East,Emily Watson,Consumer,Peripherals,Ergonomic Mech Keyboard,45,120.00,0.05,5130.00,2100.00
1008,2024-02-02,South,David Miller,SMB,Software,Cloud Analytics Pro,6,499.00,0.05,2844.30,1750.00
1009,2024-02-05,North,Sarah Jenkins,Enterprise,Hardware,Enterprise Server X1,4,3500.00,0.12,12320.00,4100.00
1010,2024-02-10,West,Michael Chang,Consumer,Peripherals,Noise Cancel Headset,30,180.00,0.10,4860.00,1950.00
1011,2024-02-14,East,Emily Watson,Enterprise,Services,Custom Migration,2,6500.00,0.00,13000.00,8200.00
1012,2024-02-18,South,David Miller,SMB,Software,DevOps Suite,5,850.00,0.05,4037.50,2500.00
1013,2024-02-23,North,Sarah Jenkins,Consumer,Peripherals,4K Ultra Monitor,8,350.00,0.10,2520.00,800.00
1014,2024-02-27,West,Michael Chang,Enterprise,Software,DevOps Suite,14,850.00,0.15,10115.00,6200.00
1015,2024-03-03,East,Emily Watson,SMB,Hardware,Network Switch 48P,3,1200.00,0.05,3420.00,1400.00
1016,2024-03-08,South,David Miller,Enterprise,Services,Annual Support SLA,1,12000.00,0.10,10800.00,6800.00
1017,2024-03-12,North,Sarah Jenkins,SMB,Peripherals,Noise Cancel Headset,25,180.00,0.08,4140.00,1700.00
1018,2024-03-17,West,Michael Chang,Enterprise,Hardware,Enterprise Server X1,3,3500.00,0.10,9450.00,3200.00
1019,2024-03-22,East,Emily Watson,Consumer,Software,Cloud Analytics Pro,4,499.00,0.00,1996.00,1200.00
1020,2024-03-28,South,David Miller,SMB,Hardware,Network Switch 48P,4,1200.00,0.10,4320.00,1800.00`;
      } else {
        csvContent = `Employee_ID,Name,Department,Job_Role,Salary,Years_At_Company,Age,Performance_Rating,Work_Life_Balance,Attrition
EMP001,Alice Johnson,Engineering,Senior Software Engineer,125000,5,34,4,Good,No
EMP002,Bob Smith,Sales,Account Executive,85000,2,28,3,Poor,Yes
EMP003,Charlie Brown,Marketing,Content Specialist,62000,1,25,3,Average,No
EMP004,Diana Prince,Engineering,Tech Lead,155000,8,39,5,Excellent,No
EMP005,Ethan Hunt,Product,Product Manager,130000,4,33,4,Good,No
EMP006,Fiona Gallagher,HR,Talent Acquisition,72000,3,29,3,Average,Yes
EMP007,George Clark,Finance,Financial Analyst,90000,6,36,4,Good,No
EMP008,Hannah Abbott,Engineering,DevOps Engineer,115000,2,27,4,Poor,Yes
EMP009,Ian Malcolm,Data Science,ML Engineer,140000,3,31,5,Good,No
EMP010,Jessica Jones,Sales,Sales Manager,110000,7,42,4,Good,No
EMP011,Kevin Hart,Marketing,Growth Lead,98000,4,35,4,Poor,Yes
EMP012,Laura Croft,Engineering,Frontend Engineer,105000,3,28,4,Good,No
EMP013,Mark Ruffalo,Operations,Operations Manager,95000,9,45,3,Good,No
EMP014,Nina Simone,Customer Support,Support Lead,68000,5,32,4,Average,No
EMP015,Oscar Isaac,Data Science,Data Analyst,88000,1,26,3,Poor,Yes`;
      }

      const file = new File([csvContent], `${sampleName === 'tech_sales' ? 'tech_sales_2024.csv' : 'employee_attrition.csv'}`, {
        type: 'text/csv',
      });
      const data = await api.uploadCSV(file);
      onDatasetLoaded(data);
    } catch (err) {
      setError(err.message || 'Failed to load sample dataset');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      {/* Upload Box */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-10 text-center glass-panel ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-700/80 hover:border-indigo-400/60 hover:bg-slate-800/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
            {loading ? (
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            ) : (
              <UploadCloud className="w-8 h-8" />
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white">
              {loading ? 'Ingesting and Profiling Dataset in DuckDB...' : 'Drop your CSV file here, or browse'}
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Supports any tabular CSV dataset • Automatic schema inference & SQL indexing
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-sm font-medium shadow-lg shadow-indigo-500/25 transition-all"
          >
            {loading ? 'Processing...' : 'Select CSV File'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Quick Test with Sample Datasets */}
      <div className="mt-6">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Or test immediately with a ready sample dataset</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => loadSampleDataset('tech_sales')}
            disabled={loading}
            className="flex items-center justify-between p-3.5 rounded-xl glass-panel glass-panel-hover text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">
                  Tech Sales & Revenue 2024
                </p>
                <p className="text-xs text-slate-400">Products, Regions, Revenue, Discounts</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
          </button>

          <button
            onClick={() => loadSampleDataset('employee_attrition')}
            disabled={loading}
            className="flex items-center justify-between p-3.5 rounded-xl glass-panel glass-panel-hover text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200 group-hover:text-violet-300 transition-colors">
                  Employee Attrition & Salaries
                </p>
                <p className="text-xs text-slate-400">Departments, Roles, Age, Performance</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
}
