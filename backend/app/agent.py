import json
import re
import time
from typing import Dict, Any, List, Optional
from .database import db_manager
from .data_profiler import DataProfiler
from .python_executor import python_executor
from .llm_client import LLMClient
from .models import ChartConfig, QueryResponse, DatasetSummary

SQL_AGENT_SYSTEM_PROMPT = """You are an expert Data Analyst, DuckDB SQL Engineer, and Data Scientist.
Your job is to analyze tabular datasets, answer user questions, recommend visualizations, execute feature engineering transformations, AND write Python Seaborn/Matplotlib code for complex statistical plots.

MODES:
1. ANALYTICAL QUERY (DuckDB SQL & Interactive Charts):
   - For aggregations, metrics, trends, top N, group bys, and standard charts:
   - Generate valid DuckDB SQL.
   - Set `"is_mutation": false` and `"is_python_plot": false`.
   - Recommend `"chart_type"`: bar | line | area | pie | scatter | bubble | composed | table.

2. COMPLEX STATISTICAL VISUALIZATION (Python Seaborn / Matplotlib):
   - Use this whenever the user asks for:
     * Correlation Heatmap / Matrix
     * Box Plots (Outlier detection / IQR whiskers)
     * Violin Plots / KDE Probability Density curves
     * Pair Plots / Multi-feature distribution grids
     * Q-Q Plots (Normality test)
     * Complex feature engineering comparison distributions
     * Any request mentioning Python, Matplotlib, or Seaborn plots
   - Set `"is_python_plot": true` and `"is_mutation": false`.
   - Provide clean Python code in `"python_code"`.
   - Available variables in Python execution environment:
     `df` (pandas DataFrame containing active working dataset), `pd`, `np`, `plt`, `sns`, `stats` (scipy.stats).
   - Rules for Python code:
     * Do NOT call `plt.show()` (the system saves the active figure automatically).
     * Set clear titles, labels, and figure sizes (e.g., `plt.figure(figsize=(9, 5))`).
     * For correlation heatmaps: `corr = df.select_dtypes(include=[np.number]).corr(); sns.heatmap(corr, annot=True, cmap='mako', fmt='.2f')`.

3. DATASET TRANSFORMATION / FEATURE ENGINEERING (Working Table Mutation):
   - For creating new columns/ratios, dropping columns, filtering rows permanently, or cleaning nulls:
   - Generate DuckDB statement (e.g. `CREATE OR REPLACE TABLE <table_name> AS SELECT ... FROM <table_name>;` or `ALTER TABLE ...` or `DELETE FROM ...;`).
   - Set `"is_mutation": true` and `"is_python_plot": false`.
   - Provide a concise `"mutation_summary"`.

REQUIRED JSON FORMAT:
{
  "is_python_plot": false,
  "python_code": null,
  "sql_query": "SELECT ... or mutation SQL",
  "is_mutation": false,
  "mutation_summary": null,
  "explanation": "Clear explanation of what the query or plot visualizes.",
  "chart_type": "bar|line|area|pie|scatter|bubble|composed|table",
  "chart_title": "Descriptive Title",
  "x_axis": "column_for_x_axis",
  "y_axis": "column_for_y_axis",
  "summary_insights": "2-3 bullet point observations explaining what the data/plot shows."
}
"""

REPAIR_SYSTEM_PROMPT = """You are a Data Science debugging assistant. The previous DuckDB SQL statement or Python plot code failed with an execution error.
Analyze the schema, the failed code, and the error, then fix it. Return ONLY valid JSON matching the required format."""

class CSVSQLAgent:
    """Agent that translates natural language questions to DuckDB SQL or Python Matplotlib/Seaborn plots with self-correction."""

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def analyze(self, dataset_id: str, question: str, max_iterations: int = 3) -> QueryResponse:
        start_time = time.perf_counter()
        schema_info = db_manager.get_schema_summary(dataset_id)
        meta = db_manager.get_table_meta(dataset_id)
        table_name = meta["table_name"] if meta else f"data_{dataset_id.replace('-', '_')}"
        
        prompt = f"""Dataset Schema:
{schema_info}

User Request: {question}

Generate the JSON response with the best SQL query, Python visualization code, or dataset transformation."""

        last_error = None
        sql_query = ""
        python_code = ""
        results = []
        columns = []
        explanation = ""
        summary_insights = ""
        chart_config = None
        current_iteration = 0
        is_mutation = False
        is_python_plot = False
        mutation_summary = None
        image_base64 = None

        print("\n" + "="*60, flush=True)
        print(f"📥 [AGENT RECEIVED REQUEST]: \"{question}\"", flush=True)
        print(f"📁 [DATASET ID]: {dataset_id} (Table: {table_name})", flush=True)
        print(f"🤖 [LLM MODEL]: {self.llm.provider} -> {self.llm.model_name}", flush=True)
        print("="*60, flush=True)

        for iteration in range(1, max_iterations + 1):
            current_iteration = iteration
            iter_start = time.perf_counter()
            try:
                if iteration == 1:
                    print(f"🔄 [Step 1/3] Prompting LLM for synthesis...", flush=True)
                    raw_response = await self.llm.generate(prompt, SQL_AGENT_SYSTEM_PROMPT)
                else:
                    # Repair step
                    print(f"\n⚠️ [SELF-REPAIR LOOP] Iteration {iteration}/{max_iterations}", flush=True)
                    print(f"   Fixing Error: {last_error}", flush=True)
                    repair_prompt = f"""Dataset Schema:
{schema_info}

User Request: {question}
Failed Query/Code: {python_code if is_python_plot else sql_query}
Error Message: {last_error}

Fix the code/SQL to resolve the error and correctly fulfill the user's request."""
                    raw_response = await self.llm.generate(repair_prompt, REPAIR_SYSTEM_PROMPT)

                llm_duration = round((time.perf_counter() - iter_start) * 1000.0, 1)
                print(f"⏱️ [LLM Time]: {llm_duration}ms", flush=True)

                parsed = self._extract_json(raw_response)
                is_python_plot = bool(parsed.get("is_python_plot", False))
                python_code = (parsed.get("python_code") or "").strip()

                # Check if prompt obviously requires Python plot even if LLM missed boolean
                lower_q = question.lower()
                if any(kw in lower_q for kw in ["heatmap", "correlation", "box plot", "boxplot", "violin", "q-q", "qq plot", "pairplot", "distribution kde"]):
                    if not python_code:
                        python_code = self._generate_auto_python_code(lower_q, meta)
                    is_python_plot = True

                explanation = str(parsed.get("explanation") or parsed.get("description") or "Operation completed successfully.")
                raw_insights = parsed.get("summary_insights") or parsed.get("insights") or ""
                if isinstance(raw_insights, list):
                    summary_insights = "\n".join(f"- {str(item)}" for item in raw_insights)
                elif isinstance(raw_insights, dict):
                    summary_insights = "\n".join(f"- **{k}**: {val}" for k, val in raw_insights.items())
                else:
                    summary_insights = str(raw_insights)

                # ==============================================================
                # BRANCH 1: PYTHON STATISTICAL PLOT (Matplotlib / Seaborn)
                # ==============================================================
                if is_python_plot and python_code:
                    print(f"\n🐍 [EXECUTING PYTHON VISUALIZATION CODE]:", flush=True)
                    print(f"   \033[92m{python_code[:200]}...\033[0m", flush=True)
                    
                    # Fetch active working dataframe
                    df = db_manager.con.sql(f"SELECT * FROM {table_name}").df()
                    exec_result = python_executor.execute_plot(python_code, df)
                    
                    if not exec_result["success"]:
                        raise ValueError(exec_result["error"])
                    
                    image_base64 = exec_result["image_base64"]
                    results_preview = df.head(10).where(df.head(10).notnull(), None).to_dict(orient="records")
                    
                    if not summary_insights.strip():
                        summary_insights = "Generated Python statistical visualization based on active working dataset."
                    
                    execution_time = round((time.perf_counter() - start_time) * 1000.0, 2)
                    print(f"✅ [PYTHON PLOT SUCCESS]: Generated image in {execution_time}ms", flush=True)

                    return QueryResponse(
                        dataset_id=dataset_id,
                        question=question,
                        sql_query="",
                        results=results_preview,
                        columns=list(df.columns),
                        row_count=len(df),
                        explanation=explanation,
                        summary_insights=summary_insights,
                        chart_config=None,
                        execution_time_ms=execution_time,
                        iterations=current_iteration,
                        is_python_plot=True,
                        python_code=python_code,
                        image_base64=image_base64
                    )

                # ==============================================================
                # BRANCH 2: DUCKDB SQL (Analysis or Working Table Mutation)
                # ==============================================================
                sql_query = (
                    parsed.get("sql_query") 
                    or parsed.get("sql") 
                    or parsed.get("query") 
                    or ""
                ).strip()

                if not sql_query:
                    sql_match = re.search(r"(SELECT|CREATE|ALTER|DELETE|UPDATE|DROP)\s+.*?;?", raw_response, re.IGNORECASE | re.DOTALL)
                    if sql_match:
                        sql_query = sql_match.group(0).rstrip(";")
                    else:
                        raise ValueError("No SQL query or statement could be parsed from LLM response.")

                is_mutation = bool(parsed.get("is_mutation", False))
                upper_sql = sql_query.upper().strip()
                if any(upper_sql.startswith(kw) for kw in ["CREATE", "ALTER", "DELETE", "UPDATE", "DROP", "INSERT", "TRUNCATE"]):
                    is_mutation = True

                mutation_summary = parsed.get("mutation_summary")

                print(f"\n📝 [SYNTHESIZED SQL] (is_mutation={is_mutation}):", flush=True)
                print(f"   \033[96m{sql_query}\033[0m", flush=True)
                
                updated_dataset_summary = None
                if is_mutation:
                    db_manager.con.execute(sql_query)
                    db_manager.refresh_table_meta(dataset_id)
                    cur_meta = db_manager.get_table_meta(dataset_id)
                    
                    history_entry = mutation_summary or explanation or question
                    cur_meta["history"].append(history_entry)
                    
                    updated_profile_dict = DataProfiler.profile_dataset(dataset_id)
                    updated_dataset_summary = DatasetSummary(**updated_profile_dict)
                    
                    results_df = db_manager.con.sql(f"SELECT * FROM {table_name} LIMIT 20").df()
                    columns = list(results_df.columns)
                    results = results_df.where(results_df.notnull(), None).to_dict(orient="records")
                    
                    if not summary_insights.strip():
                        summary_insights = f"Working dataset updated: now contains **{cur_meta['total_rows']}** rows and **{len(cur_meta['columns'])}** columns."
                    
                    chart_config = ChartConfig(chart_type="table", title="Transformed Dataset Preview")
                else:
                    results, columns, duck_time = db_manager.execute_query(sql_query)
                    
                    chart_type = parsed.get("chart_type") or parsed.get("chart") or "bar"
                    x_axis = parsed.get("x_axis")
                    y_axis = parsed.get("y_axis")
                    
                    chart_config = self._infer_chart_config(
                        chart_type=chart_type,
                        title=parsed.get("chart_title", question),
                        columns=columns,
                        results=results,
                        suggested_x=x_axis,
                        suggested_y=y_axis
                    )
                    
                    if not summary_insights.strip():
                        summary_insights = self._generate_quick_summary(results, columns)

                execution_time = round((time.perf_counter() - start_time) * 1000.0, 2)
                return QueryResponse(
                    dataset_id=dataset_id,
                    question=question,
                    sql_query=sql_query,
                    results=results,
                    columns=columns,
                    row_count=len(results),
                    explanation=explanation,
                    summary_insights=summary_insights,
                    chart_config=chart_config,
                    execution_time_ms=execution_time,
                    iterations=current_iteration,
                    dataset_updated=is_mutation,
                    is_mutation=is_mutation,
                    mutation_summary=mutation_summary,
                    updated_dataset=updated_dataset_summary
                )

            except Exception as e:
                last_error = str(e)
                print(f"❌ [FAILED ITERATION {iteration}]: {last_error}", flush=True)

        execution_time = round((time.perf_counter() - start_time) * 1000.0, 2)
        return self._build_fallback_response(dataset_id, question, last_error, execution_time, current_iteration)

    def _generate_auto_python_code(self, query: str, meta: Optional[Dict[str, Any]]) -> str:
        """Fallback Python generator for common statistical keywords."""
        if "heatmap" in query or "correlation" in query:
            return """plt.figure(figsize=(9, 6))
numeric_df = df.select_dtypes(include=[np.number])
if not numeric_df.empty:
    corr = numeric_df.corr()
    sns.heatmap(corr, annot=True, cmap="mako", fmt=".2f", linewidths=0.5, cbar_kws={'label': 'Correlation Coefficient'})
    plt.title("Feature Correlation Heatmap", fontsize=14, pad=12)
else:
    plt.text(0.5, 0.5, "No numeric columns found for correlation", ha='center', va='center')
"""
        elif "box" in query or "outlier" in query:
            return """plt.figure(figsize=(9, 5))
num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
if num_cols:
    target_col = num_cols[0]
    sns.boxplot(data=df, y=target_col, color="#6366F1", flierprops={"marker": "x", "markeredgecolor": "#F43F5E"})
    plt.title(f"Outlier & Distribution Boxplot for {target_col}", fontsize=14, pad=12)
"""
        elif "violin" in query:
            return """plt.figure(figsize=(9, 5))
num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
if num_cols:
    sns.violinplot(data=df, y=num_cols[0], color="#06B6D4", inner="quartile")
    plt.title(f"Violin Density Plot for {num_cols[0]}", fontsize=14, pad=12)
"""
        elif "q-q" in query or "qq" in query:
            return """plt.figure(figsize=(7, 5))
num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
if num_cols:
    import scipy.stats as stats
    stats.probplot(df[num_cols[0]].dropna(), dist="norm", plot=plt)
    plt.title(f"Normal Q-Q Plot for {num_cols[0]}", fontsize=14, pad=12)
"""
        return """plt.figure(figsize=(9, 5))
num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
if num_cols:
    sns.histplot(data=df, x=num_cols[0], kde=True, color="#6366F1")
    plt.title(f"Distribution of {num_cols[0]} with KDE", fontsize=14, pad=12)
"""

    def _extract_json(self, text: str) -> Dict[str, Any]:
        try:
            return json.loads(text.strip())
        except Exception:
            pass

        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except Exception:
                pass

        brace_match = re.search(r"(\{.*\})", text, re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(1))
            except Exception:
                pass

        sql_match = re.search(r"(SELECT|CREATE|ALTER|DELETE|UPDATE|DROP)\s+.*?;?", text, re.IGNORECASE | re.DOTALL)
        if sql_match:
            return {
                "sql_query": sql_match.group(0).rstrip(";"),
                "explanation": "Extracted query statement from agent response.",
                "chart_type": "bar"
            }

        raise ValueError(f"Could not parse valid JSON or SQL from response: {text[:200]}")

    def _infer_chart_config(
        self,
        chart_type: str,
        title: str,
        columns: List[str],
        results: List[Dict[str, Any]],
        suggested_x: Optional[str] = None,
        suggested_y: Optional[str] = None
    ) -> ChartConfig:
        if not columns or not results:
            return ChartConfig(chart_type="table", title=title)

        x_col = suggested_x if suggested_x in columns else columns[0]
        
        y_col = suggested_y if suggested_y in columns else None
        if not y_col:
            for col in columns:
                if col != x_col and results and isinstance(results[0].get(col), (int, float)):
                    y_col = col
                    break
        
        if not y_col and len(columns) > 1:
            y_col = columns[1]

        if len(results) == 1 and len(columns) == 1:
            chart_type = "table"
        elif len(results) > 30 and chart_type in ["pie"]:
            chart_type = "bar"

        valid_types = ["bar", "line", "area", "pie", "scatter", "bubble", "composed", "table"]
        clean_type = chart_type.lower() if chart_type.lower() in valid_types else "bar"

        return ChartConfig(
            chart_type=clean_type,
            title=title,
            x_axis=x_col,
            y_axis=y_col,
            description=f"Showing {y_col} by {x_col}" if x_col and y_col else "Result preview"
        )

    def _generate_quick_summary(self, results: List[Dict[str, Any]], columns: List[str]) -> str:
        if not results:
            return "No matching records found for this query."
        total_rows = len(results)
        if total_rows == 1:
            items = [f"**{k}**: {v}" for k, v in results[0].items()]
            return f"Result: {', '.join(items)}"
        return f"Returned **{total_rows}** records. The top result shows `{results[0]}`."

    def _build_fallback_response(
        self, dataset_id: str, question: str, error_msg: Optional[str], duration: float, iterations: int
    ) -> QueryResponse:
        meta = db_manager.get_table_meta(dataset_id)
        table_name = meta["table_name"] if meta else "data_table"
        
        fallback_sql = f"SELECT * FROM {table_name} LIMIT 10"
        try:
            results, columns, _ = db_manager.execute_query(fallback_sql)
        except Exception:
            results, columns = [], []

        return QueryResponse(
            dataset_id=dataset_id,
            question=question,
            sql_query=fallback_sql,
            results=results,
            columns=columns,
            row_count=len(results),
            explanation="The agent encountered an issue executing the requested code or query. Showing default preview.",
            summary_insights=f"Error details: {error_msg}.",
            chart_config=ChartConfig(chart_type="table", title="Dataset Preview"),
            execution_time_ms=duration,
            error=str(error_msg),
            iterations=iterations,
            dataset_updated=False
        )
