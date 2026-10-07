import json
import re
import time
from typing import Dict, Any, List, Optional
from .database import db_manager
from .llm_client import LLMClient
from .models import ChartConfig, QueryResponse

SQL_AGENT_SYSTEM_PROMPT = """You are an expert Data Analyst and DuckDB SQL Agent.
Your job is to analyze user questions on a tabular dataset, generate precise DuckDB SQL queries, explain the findings, and recommend the best visualization.

RULES:
1. Generate valid DuckDB SQL.
2. ALWAYS wrap column names in double quotes if they contain spaces, special characters, or match reserved keywords. Example: "Product Category", "Order Date".
3. Use the exact table name and column names provided in the Schema. Do NOT invent columns.
4. For aggregations (SUM, AVG, COUNT, etc.), give columns clean aliases (e.g., SELECT "Region", SUM("Revenue") AS "Total_Revenue" FROM table GROUP BY "Region" ORDER BY "Total_Revenue" DESC).
5. When filtering dates, use standard SQL/DuckDB date functions (e.g., strftime, strptime, year, month).
6. Always return your response in strictly valid JSON format with NO markdown wrapping outside the JSON.

REQUIRED JSON FORMAT:
{
  "sql_query": "SELECT ... FROM ...",
  "explanation": "Short clear explanation of what this query calculates.",
  "chart_type": "bar|line|area|pie|scatter|histogram|table",
  "chart_title": "Descriptive Chart Title",
  "x_axis": "column_name_for_x_axis",
  "y_axis": "column_name_for_y_axis",
  "summary_insights": "2-3 bullet point observations explaining what the data indicates or highlights."
}
"""

REPAIR_SYSTEM_PROMPT = """You are a SQL debugging assistant. The previous DuckDB SQL query failed with an execution error.
Analyze the schema and the exact error, then fix the SQL query. Return ONLY valid JSON matching the required format with the corrected SQL."""

class CSVSQLAgent:
    """Agent that translates natural language questions to DuckDB SQL, executes with self-correction, and recommends visualizations."""

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def analyze(self, dataset_id: str, question: str, max_iterations: int = 3) -> QueryResponse:
        start_time = time.perf_counter()
        schema_info = db_manager.get_schema_summary(dataset_id)
        
        prompt = f"""Dataset Schema:
{schema_info}

User Question: {question}

Generate the JSON response with the best SQL query to answer this question."""

        last_error = None
        sql_query = ""
        results = []
        columns = []
        explanation = ""
        summary_insights = ""
        chart_config = None
        current_iteration = 0

        print("\n" + "="*60, flush=True)
        print(f"📥 [AGENT RECEIVED QUESTION]: \"{question}\"", flush=True)
        print(f"📁 [DATASET ID]: {dataset_id}", flush=True)
        print(f"🤖 [LLM MODEL]: {self.llm.provider} -> {self.llm.model_name}", flush=True)
        print("="*60, flush=True)

        for iteration in range(1, max_iterations + 1):
            current_iteration = iteration
            iter_start = time.perf_counter()
            try:
                if iteration == 1:
                    print(f"🔄 [Step 1/3] Prompting LLM for DuckDB SQL synthesis...", flush=True)
                    raw_response = await self.llm.generate(prompt, SQL_AGENT_SYSTEM_PROMPT)
                else:
                    # Repair step
                    print(f"\n⚠️ [SELF-REPAIR LOOP] Iteration {iteration}/{max_iterations}", flush=True)
                    print(f"   Fixing Error: {last_error}", flush=True)
                    repair_prompt = f"""Dataset Schema:
{schema_info}

User Question: {question}
Failed SQL: {sql_query}
Error Message: {last_error}

Fix the SQL query to resolve the error and correctly answer the question."""
                    raw_response = await self.llm.generate(repair_prompt, REPAIR_SYSTEM_PROMPT)

                llm_duration = round((time.perf_counter() - iter_start) * 1000.0, 1)
                print(f"⏱️ [LLM Time]: {llm_duration}ms", flush=True)

                parsed = self._extract_json(raw_response)
                sql_query = (
                    parsed.get("sql_query") 
                    or parsed.get("sql") 
                    or parsed.get("query") 
                    or ""
                ).strip()

                if not sql_query:
                    # Try regex extraction from raw text as fallback
                    sql_match = re.search(r"SELECT\s+.*?;?", raw_response, re.IGNORECASE | re.DOTALL)
                    if sql_match:
                        sql_query = sql_match.group(0).rstrip(";")
                    else:
                        raise ValueError("No SQL query could be parsed from LLM response.")

                explanation = str(parsed.get("explanation") or parsed.get("description") or "Query generated to answer your question.")
                raw_insights = parsed.get("summary_insights") or parsed.get("insights") or ""
                if isinstance(raw_insights, list):
                    summary_insights = "\n".join(f"- {str(item)}" for item in raw_insights)
                elif isinstance(raw_insights, dict):
                    summary_insights = "\n".join(f"- **{k}**: {val}" for k, val in raw_insights.items())
                else:
                    summary_insights = str(raw_insights)

                print(f"\n📝 [SYNTHESIZED SQL]:", flush=True)
                print(f"   \033[96m{sql_query}\033[0m", flush=True)
                
                # Execute in DuckDB
                print(f"🦆 [EXECUTING IN DUCKDB]...", flush=True)
                results, columns, duck_time = db_manager.execute_query(sql_query)
                print(f"✅ [DUCKDB SUCCESS]: {len(results)} rows returned in {duck_time}ms", flush=True)
                
                # Prepare chart recommendation
                chart_type = parsed.get("chart_type") or parsed.get("chart") or "bar"
                x_axis = parsed.get("x_axis")
                y_axis = parsed.get("y_axis")
                
                # Auto-adjust chart config based on returned columns
                chart_config = self._infer_chart_config(
                    chart_type=chart_type,
                    title=parsed.get("chart_title", question),
                    columns=columns,
                    results=results,
                    suggested_x=x_axis,
                    suggested_y=y_axis
                )
                print(f"📊 [CHART SELECTED]: {chart_config.chart_type.upper()} (X: {chart_config.x_axis}, Y: {chart_config.y_axis})", flush=True)

                # If no summary insights provided by LLM, generate quick insights
                if not summary_insights.strip():
                    summary_insights = self._generate_quick_summary(results, columns)

                execution_time = round((time.perf_counter() - start_time) * 1000.0, 2)
                print(f"🎉 [AGENT COMPLETED IN]: {execution_time}ms\n" + "="*60 + "\n", flush=True)
                
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
                    iterations=current_iteration
                )

            except Exception as e:
                last_error = str(e)
                print(f"❌ [QUERY / EXECUTION FAILED]: {last_error}", flush=True)
                # Continue loop to attempt repair

        # If LLM failed all iterations or wasn't reachable, build a smart fallback
        execution_time = round((time.perf_counter() - start_time) * 1000.0, 2)
        return self._build_fallback_response(dataset_id, question, last_error, execution_time, current_iteration)

    def _extract_json(self, text: str) -> Dict[str, Any]:
        """Robust JSON extraction from LLM response."""
        # Try direct JSON parse
        try:
            return json.loads(text.strip())
        except Exception:
            pass

        # Try regex extract between ```json and ```
        match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except Exception:
                pass

        # Try finding outer braces { ... }
        brace_match = re.search(r"(\{.*\})", text, re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(1))
            except Exception:
                pass

        # Fallback: extract SQL if present in text
        sql_match = re.search(r"SELECT\s+.*?;?", text, re.IGNORECASE | re.DOTALL)
        if sql_match:
            return {
                "sql_query": sql_match.group(0).rstrip(";"),
                "explanation": "Extracted query from agent response.",
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
        
        # Find first numeric column for Y axis
        y_col = suggested_y if suggested_y in columns else None
        if not y_col:
            for col in columns:
                if col != x_col and results and isinstance(results[0].get(col), (int, float)):
                    y_col = col
                    break
        
        if not y_col and len(columns) > 1:
            y_col = columns[1]

        # Check chart validity
        if len(results) == 1 and len(columns) == 1:
            chart_type = "table"
        elif len(results) > 30 and chart_type in ["pie"]:
            chart_type = "bar"

        return ChartConfig(
            chart_type=chart_type if chart_type in ["bar", "line", "area", "pie", "scatter", "table"] else "bar",
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
        
        # Fallback query
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
            explanation="The agent encountered an issue communicating with the local LLM or formulating the query. Showing default preview.",
            summary_insights=f"Error details: {error_msg}. Check if Ollama is running (`ollama serve`).",
            chart_config=ChartConfig(chart_type="table", title="Dataset Preview"),
            execution_time_ms=duration,
            error=str(error_msg),
            iterations=iterations
        )
