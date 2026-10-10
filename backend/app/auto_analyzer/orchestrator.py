import uuid
import time
from typing import Dict, Any
from pathlib import Path
import pandas as pd
from ..database import db_manager
from ..llm_client import LLMClient
from ..config import UPLOAD_DIR
from .planner_agent import PlannerAgent
from .diagnostic_agent import data_diagnostic_agent
from .preprocessor_pipeline import data_prep_agent
from .model_trainer_agent import model_trainer_agent

ARTIFACTS_DIR = UPLOAD_DIR / "auto_ml_models"

class AutoAnalyzeOrchestrator:
    """Orchestrates the 5-stage Multi-Agent Autonomous Machine Learning Pipeline."""

    def __init__(self, llm_client: LLMClient):
        self.planner = PlannerAgent(llm_client)
        self.diagnostic = data_diagnostic_agent
        self.prep = data_prep_agent
        self.trainer = model_trainer_agent

    async def run_pipeline(self, dataset_id: str, user_prompt: str) -> Dict[str, Any]:
        start_time = time.perf_counter()
        task_id = str(uuid.uuid4())[:8]

        # 1. Fetch current live working table
        meta = db_manager.get_table_meta(dataset_id)
        if not meta:
            raise ValueError(f"Dataset {dataset_id} not found.")

        table_name = meta["table_name"]
        df = db_manager.con.sql(f"SELECT * FROM {table_name}").df()

        print(f"\n🚀 [AUTO-ANALYZE PIPELINE START] Task ID: {task_id}", flush=True)
        print(f"   Prompt: \"{user_prompt}\"", flush=True)

        # STAGE 1: Problem Formulation
        print("🧠 [STAGE 1/4] Running Planner & Problem Formulator Agent...", flush=True)
        plan = await self.planner.formulate_problem(user_prompt, df, meta)
        print(f"   Target: '{plan['target_column']}' | Task: {plan['task_type']} | Metric: {plan['optimization_metric']}", flush=True)

        # STAGE 2: Task-Aware Data Diagnostic & Verification
        print("🔍 [STAGE 2/4] Running Data Diagnostic & Verification Agent...", flush=True)
        diagnostics = self.diagnostic.diagnose_and_verify(df, plan)
        print(f"   Issues found: {diagnostics['total_issues_found']} | Dropping: {len(diagnostics['columns_to_drop'])} cols", flush=True)

        # STAGE 3: Preprocessing & Split
        print("⚙️ [STAGE 3/4] Running Preprocessing & Feature Engineering Agent...", flush=True)
        prep_data = self.prep.prepare_data(df, diagnostics)
        print(f"   Engineered Features: {prep_data['total_features']} | Train samples: {prep_data['train_samples']}", flush=True)

        # STAGE 4: Model Training, Benchmarking & Evaluation
        print("🏆 [STAGE 4/4] Running Model Benchmarking & Trainer Agent...", flush=True)
        task_artifact_dir = ARTIFACTS_DIR / task_id
        training_results = self.trainer.train_and_benchmark(prep_data, plan, task_artifact_dir)
        print(f"   Champion: {training_results['champion_model_name']}!", flush=True)

        total_duration = round((time.perf_counter() - start_time), 2)
        print(f"✅ [PIPELINE COMPLETED in {total_duration}s]\n", flush=True)

        return {
            "task_id": task_id,
            "dataset_id": dataset_id,
            "user_prompt": user_prompt,
            "execution_duration_sec": total_duration,
            "plan": plan,
            "diagnostics": {
                "issues": diagnostics["issues"],
                "total_issues_found": diagnostics["total_issues_found"],
                "critical_issues_count": diagnostics["critical_issues_count"],
                "high_issues_count": diagnostics["high_issues_count"],
                "columns_to_drop": diagnostics["columns_to_drop"],
                "columns_to_impute_num": diagnostics["columns_to_impute_num"],
                "columns_to_impute_cat": diagnostics["columns_to_impute_cat"],
                "columns_to_encode": diagnostics["columns_to_encode"],
            },
            "preprocessing_summary": {
                "total_features": prep_data["total_features"],
                "train_samples": prep_data["train_samples"],
                "test_samples": prep_data["test_samples"],
                "dropped_columns": prep_data["dropped_columns"],
                "numeric_features": prep_data["num_cols"],
                "categorical_features": prep_data["cat_cols"],
            },
            "training_results": {
                "leaderboard": training_results["leaderboard"],
                "champion_model_name": training_results["champion_model_name"],
                "champion_metrics": training_results["champion_metrics"],
                "feature_importance_image": training_results["feature_importance_image"],
                "evaluation_image": training_results["evaluation_image"],
                "python_script_code": training_results["python_script_code"],
                "model_download_url": f"/api/auto-analyze/{task_id}/download-model",
                "script_download_url": f"/api/auto-analyze/{task_id}/download-script",
            }
        }
