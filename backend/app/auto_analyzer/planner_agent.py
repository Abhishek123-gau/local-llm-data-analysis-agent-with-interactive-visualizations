import json
import re
from typing import Dict, Any, List
import pandas as pd
import numpy as np
from ..llm_client import LLMClient

PLANNER_SYSTEM_PROMPT = """You are a Principal Machine Learning Architect and Problem Formulator Agent.
Your job is to examine the user's high-level goal and dataset schema, then formulate the exact Machine Learning problem specification.

TASKS:
1. Identify the TARGET column from the dataset that answers the user's prompt.
2. Determine the TASK TYPE:
   - "classification" (if target is categorical, boolean, discrete labels, e.g. Churn, Attrition, Yes/No, Department)
   - "regression" (if target is continuous numeric, e.g. Revenue, Price, Salary, Days, Rating)
3. Select the primary optimization metric:
   - Classification: "f1", "roc_auc", or "accuracy"
   - Regression: "r2", "rmse", or "mae"
4. Identify any columns explicitly mentioned to include or exclude.

OUTPUT FORMAT (STRICT JSON ONLY, no markdown wrapping):
{
  "target_column": "exact_column_name",
  "task_type": "classification|regression",
  "is_binary": true|false,
  "optimization_metric": "f1|roc_auc|r2|rmse",
  "problem_statement": "Clear formulation of what the model is learning to predict.",
  "features_to_drop": ["any obvious leakage or ID column names mentioned"]
}
"""

class PlannerAgent:
    """Formulates the machine learning task and target specification from natural language prompt."""

    def __init__(self, llm_client: LLMClient):
        self.llm = llm_client

    async def formulate_problem(self, user_prompt: str, df: pd.DataFrame, dataset_meta: Dict[str, Any]) -> Dict[str, Any]:
        columns_info = []
        for col in df.columns:
            dtype = str(df[col].dtype)
            sample_vals = [str(x) for x in df[col].dropna().unique()[:4]]
            unique_cnt = df[col].nunique()
            columns_info.append(f"- \"{col}\" ({dtype}, {unique_cnt} unique values, samples: {sample_vals})")

        prompt = f"""Dataset Columns and Samples:
{chr(10).join(columns_info)}

User ML Request / Goal:
"{user_prompt}"

Formulate the Machine Learning problem specification. Select the most appropriate target column from the columns list."""

        raw_response = await self.llm.generate(prompt, PLANNER_SYSTEM_PROMPT)
        parsed = self._extract_json(raw_response)

        # Fallback / validation
        target_col = parsed.get("target_column")
        if not target_col or target_col not in df.columns:
            # Fallback heuristic: find column closest to prompt keywords
            target_col = self._heuristic_target_find(user_prompt, df)

        task_type = parsed.get("task_type", "classification")
        if df[target_col].nunique() > 20 and np.issubdtype(df[target_col].dtype, np.number):
            task_type = "regression"
        elif df[target_col].nunique() <= 10:
            task_type = "classification"

        is_binary = bool(df[target_col].nunique() == 2) if task_type == "classification" else False
        default_metric = "f1" if (task_type == "classification" and is_binary) else ("accuracy" if task_type == "classification" else "r2")

        return {
            "target_column": target_col,
            "task_type": task_type,
            "is_binary": is_binary,
            "target_classes": [str(x) for x in df[target_col].dropna().unique()] if task_type == "classification" else None,
            "optimization_metric": parsed.get("optimization_metric") or default_metric,
            "problem_statement": parsed.get("problem_statement") or f"Predict '{target_col}' using historical dataset features.",
            "features_to_drop": parsed.get("features_to_drop", []),
        }

    def _heuristic_target_find(self, prompt: str, df: pd.DataFrame) -> str:
        prompt_lower = prompt.lower()
        for col in df.columns:
            if col.lower() in prompt_lower:
                return col
        # If nothing matched, pick last column or binary column
        for col in reversed(df.columns):
            if df[col].nunique() == 2:
                return col
        return df.columns[-1]

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
        return {}
