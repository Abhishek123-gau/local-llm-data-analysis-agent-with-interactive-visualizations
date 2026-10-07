# 🤖 Autonomous CSV Data Analysis AI Agent

A production-ready, full-stack **Agentic Text-to-SQL CSV Analysis System** powered by **FastAPI**, **DuckDB in-memory OLAP engine**, and **React + Vite**.

Designed to work with local **Ollama models** (e.g. `llama3`, `qwen2.5`, `mistral`, `deepseek-r1`) as well as cloud providers (OpenAI, Gemini, Groq).

---

## ✨ Key Features

- 📁 **Universal CSV Ingestion**: Drag & drop any CSV file. Automatic type inference and virtual table registration in DuckDB.
- 💬 **Natural Language Agent**: Ask questions in plain English (e.g., *"What were our top 5 products by profit in the North region?"*).
- ⚡ **DuckDB SQL Engine**: Sub-millisecond analytical execution directly on the dataset in memory.
- 🔁 **Self-Correction Retry Loop**: The agent automatically catches syntax or table schema errors and fixes its own SQL queries.
- 📊 **Smart Visualization Engine**: Recommends and renders dynamic charts (Bar, Line, Area, Pie, Tables) using Recharts.
- 🛠️ **SQL Playground & Inspector**: View, copy, or directly edit and execute the synthesized SQL against the database.
- 📋 **Automated Dataset Profiler**: Generates statistical summaries (min, max, mean, null counts) and 5 smart prompt suggestions based on column characteristics.
- 🦙 **Flexible LLM Provider**: Pre-configured for local Ollama, with UI switcher for OpenAI, Gemini, and Groq.

---

## 🏗️ Architecture

```
Ai_system/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI REST API
│   │   ├── agent.py          # Agentic Text-to-SQL + Self-Correction loop
│   │   ├── database.py       # DuckDB manager & SQL runner
│   │   ├── data_profiler.py  # Dataset statistics & prompt generator
│   │   ├── llm_client.py     # Ollama & Multi-provider client
│   │   └── models.py         # Pydantic schemas
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Tab management & state
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── FileUpload.jsx
│   │   │   ├── DatasetOverview.jsx
│   │   │   ├── DataTable.jsx
│   │   │   ├── ChartRenderer.jsx
│   │   │   ├── SqlViewer.jsx
│   │   │   ├── ChatInterface.jsx
│   │   │   └── SettingsModal.jsx
│   │   └── services/api.js
│   └── package.json
├── sample_data/
│   ├── tech_sales_2024.csv
│   └── employee_attrition.csv
└── run_all.py                # Master launcher script
```

---

## 🚀 Getting Started

### 1. Launch Ollama (Local Model)
Make sure Ollama is installed and running on your machine:
```bash
# Pull and start your preferred model (e.g., llama3 or qwen2.5)
ollama run llama3
```

### 2. Run the Application
Launch both backend and frontend with a single command:
```bash
python run_all.py
```

- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **FastAPI API**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **API Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🎯 Sample Questions You Can Ask

- *"What is the total revenue and profit grouped by Region?"*
- *"Show me the top 5 sales reps ranked by total profit."*
- *"What is the average discount given by customer segment?"*
- *"Show the monthly revenue trend for 2024."*
