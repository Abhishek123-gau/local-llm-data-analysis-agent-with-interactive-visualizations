import os
import joblib
import io
import time
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.ensemble import (
    RandomForestClassifier,
    GradientBoostingClassifier,
    ExtraTreesClassifier,
    RandomForestRegressor,
    GradientBoostingRegressor,
    ExtraTreesRegressor,
)
from sklearn.linear_model import LogisticRegression, Ridge, Lasso
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    r2_score,
    mean_squared_error,
    mean_absolute_error,
)
from sklearn.pipeline import Pipeline
from ..python_executor import python_executor

class ModelTrainerAgent:
    """Trains, cross-evaluates candidate algorithms, generates leaderboards, and serializes champion models."""

    def train_and_benchmark(
        self,
        prep_data: Dict[str, Any],
        plan: Dict[str, Any],
        artifact_dir: Path
    ) -> Dict[str, Any]:
        task_type = plan["task_type"]
        X_train = prep_data["X_train"]
        X_test = prep_data["X_test"]
        y_train = prep_data["y_train"]
        y_test = prep_data["y_test"]
        feature_names = prep_data["feature_names"]
        target_classes = prep_data.get("target_classes")
        preprocessor = prep_data["preprocessor"]

        # 1. Define candidate algorithm pool
        candidates = self._get_candidates(task_type)

        leaderboard: List[Dict[str, Any]] = []
        trained_models: Dict[str, Any] = {}

        # 2. Benchmark each candidate
        for name, model_init in candidates.items():
            start_t = time.perf_counter()
            try:
                model = model_init()
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                duration_ms = round((time.perf_counter() - start_t) * 1000.0, 1)

                metrics = self._calculate_metrics(task_type, y_test, y_pred, model, X_test)
                metrics["training_time_ms"] = duration_ms
                metrics["model_name"] = name

                trained_models[name] = model
                leaderboard.append(metrics)
            except Exception as e:
                print(f"Algorithm {name} failed: {e}")

        if not leaderboard:
            raise ValueError("All candidate ML models failed to train.")

        # 3. Rank models & select Champion
        sort_key = "f1_score" if task_type == "classification" else "r2_score"
        leaderboard.sort(key=lambda x: x.get(sort_key, 0), reverse=True)

        for idx, row in enumerate(leaderboard):
            row["rank"] = idx + 1
            row["is_champion"] = (idx == 0)

        champion_row = leaderboard[0]
        champion_name = champion_row["model_name"]
        champion_model = trained_models[champion_name]

        # 4. Generate Feature Importance & Evaluation Visuals
        feature_importance_plot = self._generate_feature_importance_plot(
            champion_model, feature_names, champion_name
        )
        evaluation_plot = self._generate_evaluation_plot(
            task_type, y_test, champion_model.predict(X_test), target_classes, champion_name
        )

        # 5. Build end-to-end inference Pipeline & serialize
        full_pipeline = Pipeline([
            ('preprocessor', preprocessor),
            ('model', champion_model)
        ])

        artifact_dir.mkdir(parents=True, exist_ok=True)
        model_filename = f"champion_{champion_name.lower().replace(' ', '_')}.joblib"
        model_path = artifact_dir / model_filename
        joblib.dump(full_pipeline, model_path)

        # 6. Generate reproducible training Python script
        training_script = self._generate_training_script(
            plan, prep_data, champion_name
        )
        script_path = artifact_dir / "reproducible_train_pipeline.py"
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(training_script)

        return {
            "leaderboard": leaderboard,
            "champion_model_name": champion_name,
            "champion_metrics": champion_row,
            "model_file_path": str(model_path),
            "model_file_name": model_filename,
            "script_file_path": str(script_path),
            "feature_importance_image": feature_importance_plot,
            "evaluation_image": evaluation_plot,
            "python_script_code": training_script,
        }

    def _get_candidates(self, task_type: str) -> Dict[str, Any]:
        if task_type == "classification":
            return {
                "Gradient Boosting": lambda: GradientBoostingClassifier(n_estimators=100, random_state=42),
                "Random Forest": lambda: RandomForestClassifier(n_estimators=100, class_weight='balanced', random_state=42),
                "Extra Trees": lambda: ExtraTreesClassifier(n_estimators=100, random_state=42),
                "Logistic Regression": lambda: LogisticRegression(max_iter=500, class_weight='balanced', random_state=42),
                "Decision Tree": lambda: DecisionTreeClassifier(max_depth=6, random_state=42),
            }
        else:
            return {
                "Gradient Boosting": lambda: GradientBoostingRegressor(n_estimators=100, random_state=42),
                "Random Forest": lambda: RandomForestRegressor(n_estimators=100, random_state=42),
                "Extra Trees": lambda: ExtraTreesRegressor(n_estimators=100, random_state=42),
                "Ridge Regression": lambda: Ridge(alpha=1.0),
                "Lasso Regression": lambda: Lasso(alpha=0.1),
            }

    def _calculate_metrics(self, task_type: str, y_test, y_pred, model, X_test) -> Dict[str, Any]:
        if task_type == "classification":
            acc = round(float(accuracy_score(y_test, y_pred)), 4)
            f1 = round(float(f1_score(y_test, y_pred, average='weighted', zero_division=0)), 4)
            prec = round(float(precision_score(y_test, y_pred, average='weighted', zero_division=0)), 4)
            rec = round(float(recall_score(y_test, y_pred, average='weighted', zero_division=0)), 4)

            roc = None
            try:
                if hasattr(model, "predict_proba"):
                    probs = model.predict_proba(X_test)
                    if probs.shape[1] == 2:
                        roc = round(float(roc_auc_score(y_test, probs[:, 1])), 4)
                    else:
                        roc = round(float(roc_auc_score(y_test, probs, multi_class='ovr')), 4)
            except Exception:
                roc = None

            return {
                "accuracy": acc,
                "f1_score": f1,
                "precision": prec,
                "recall": rec,
                "roc_auc": roc,
            }
        else:
            r2 = round(float(r2_score(y_test, y_pred)), 4)
            rmse = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4)
            mae = round(float(mean_absolute_error(y_test, y_pred)), 4)
            return {
                "r2_score": r2,
                "rmse": rmse,
                "mae": mae,
            }

    def _generate_feature_importance_plot(self, model, feature_names: List[str], model_name: str) -> Optional[str]:
        importances = None
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
        elif hasattr(model, "coef_"):
            importances = np.abs(model.coef_).flatten()

        if importances is None or len(importances) == 0:
            return None

        # Build code snippet
        df_imp = pd.DataFrame({
            "feature": feature_names[:len(importances)],
            "importance": importances[:len(feature_names)]
        }).sort_values("importance", ascending=False).head(12)

        code = f"""import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

features = {df_imp['feature'].tolist()!r}
importances = {df_imp['importance'].tolist()!r}

plt.figure(figsize=(9, 5.5))
ax = sns.barplot(x=importances, y=features, palette="mako")
plt.title("Top Feature Importances ({model_name})", fontsize=14, pad=12)
plt.xlabel("Importance Weight", fontsize=11)
plt.ylabel("Feature", fontsize=11)
"""
        res = python_executor.execute_plot(code, pd.DataFrame())
        return res.get("image_base64")

    def _generate_evaluation_plot(self, task_type: str, y_test, y_pred, target_classes: Optional[List[str]], model_name: str) -> Optional[str]:
        if task_type == "classification":
            from sklearn.metrics import confusion_matrix
            cm = confusion_matrix(y_test, y_pred).tolist()
            labels = target_classes or [str(i) for i in range(len(cm))]
            code = f"""import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

cm = np.array({cm!r})
labels = {labels!r}

plt.figure(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=labels, yticklabels=labels, cbar=False)
plt.title("Confusion Matrix ({model_name})", fontsize=14, pad=12)
plt.xlabel("Predicted Label", fontsize=11)
plt.ylabel("Actual True Label", fontsize=11)
"""
        else:
            y_t = y_test[:150].tolist() if len(y_test) > 150 else y_test.tolist()
            y_p = y_pred[:150].tolist() if len(y_pred) > 150 else y_pred.tolist()
            code = f"""import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

actual = np.array({y_t!r})
pred = np.array({y_p!r})

plt.figure(figsize=(7, 5))
plt.scatter(actual, pred, color="#06B6D4", alpha=0.7, edgecolors="none")
min_val, max_val = min(min(actual), min(pred)), max(max(actual), max(pred))
plt.plot([min_val, max_val], [min_val, max_val], color="#F43F5E", linestyle="--", linewidth=2, label="Perfect Fit (y=x)")
plt.title("Actual vs. Predicted Residual Plot ({model_name})", fontsize=14, pad=12)
plt.xlabel("Actual Value", fontsize=11)
plt.ylabel("Predicted Value", fontsize=11)
plt.legend()
"""
        res = python_executor.execute_plot(code, pd.DataFrame())
        return res.get("image_base64")

    def _generate_training_script(self, plan: Dict[str, Any], prep_data: Dict[str, Any], champion_name: str) -> str:
        target_col = plan["target_column"]
        task_type = plan["task_type"]
        dropped = prep_data["dropped_columns"]

        return f'''"""
Auto-Generated Reproducible Machine Learning Training Script
Generated by: CSV AI Intelligence Multi-Agent System
Target Column: {target_col} | Task: {task_type} | Champion Model: {champion_name}
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import {champion_name.replace(" ", "")}
import joblib

def train_pipeline(csv_file_path: str):
    print("Loading data from:", csv_file_path)
    df = pd.read_csv(csv_file_path)

    target_col = "{target_col}"
    columns_to_drop = {dropped!r}

    # 1. Clean missing target
    df = df.dropna(subset=[target_col])
    
    # 2. Extract features and target
    y_raw = df[target_col]
    X_df = df.drop(columns=[col for col in columns_to_drop if col in df.columns] + [target_col])

    # Encode target if classification
    if "{task_type}" == "classification":
        le = LabelEncoder()
        y = le.fit_transform(y_raw.astype(str))
    else:
        y = pd.to_numeric(y_raw, errors="coerce").fillna(y_raw.median()).values

    # 3. Setup Preprocessing Pipeline
    num_cols = X_df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = X_df.select_dtypes(exclude=[np.number]).columns.tolist()

    transformers = []
    if num_cols:
        num_pipe = Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler())
        ])
        transformers.append(('num', num_pipe, num_cols))

    if cat_cols:
        cat_pipe = Pipeline([
            ('imputer', SimpleImputer(strategy='most_frequent')),
            ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
        ])
        transformers.append(('cat', cat_pipe, cat_cols))

    preprocessor = ColumnTransformer(transformers=transformers, remainder='drop')

    # 4. End-to-End Pipeline
    pipeline = Pipeline([
        ('preprocessor', preprocessor),
        ('model', {champion_name.replace(" ", "")}(random_state=42))
    ])

    # 5. Train & Evaluate
    X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=0.20, random_state=42)
    print("Training {champion_name}...")
    pipeline.fit(X_train, y_train)

    score = pipeline.score(X_test, y_test)
    print(f"Test Score: {{score:.4f}}")

    joblib.dump(pipeline, "champion_model_pipeline.joblib")
    print("Model saved to champion_model_pipeline.joblib")

if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else "data.csv"
    train_pipeline(path)
'''

model_trainer_agent = ModelTrainerAgent()
