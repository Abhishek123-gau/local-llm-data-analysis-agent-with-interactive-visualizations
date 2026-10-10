from typing import Dict, Any, List
import pandas as pd
import numpy as np

class DataDiagnosticAgent:
    """Audits data defects specifically tailored to the ML task and verifies remediation actions."""

    def diagnose_and_verify(self, df: pd.DataFrame, plan: Dict[str, Any]) -> Dict[str, Any]:
        target_col = plan["target_column"]
        task_type = plan["task_type"]
        total_rows = len(df)

        issues: List[Dict[str, Any]] = []
        columns_to_drop: List[str] = list(plan.get("features_to_drop", []))
        columns_to_impute_num: List[str] = []
        columns_to_impute_cat: List[str] = []
        columns_to_encode: List[str] = []
        columns_to_scale: List[str] = []
        target_remediation: Dict[str, Any] = {}

        # ------------------------------------------------------------------
        # 1. TARGET VARIABLE DIAGNOSTIC
        # ------------------------------------------------------------------
        target_nulls = int(df[target_col].isnull().sum())
        if target_nulls > 0:
            issues.append({
                "column": target_col,
                "category": "Target Missingness",
                "severity": "Critical",
                "description": f"Target column '{target_col}' has {target_nulls} missing values ({round(target_nulls/total_rows*100, 1)}%).",
                "verified_action": f"Drop {target_nulls} rows with null target values before training."
            })
            target_remediation["drop_null_rows"] = True

        if task_type == "classification":
            val_counts = df[target_col].dropna().value_counts(normalize=True)
            min_class_ratio = float(val_counts.min())
            min_class_label = str(val_counts.idxmin())
            maj_class_ratio = float(val_counts.max())

            if min_class_ratio < 0.25:
                severity = "High" if min_class_ratio < 0.15 else "Medium"
                imbalance_pct = round(min_class_ratio * 100, 1)
                issues.append({
                    "column": target_col,
                    "category": "Class Imbalance",
                    "severity": severity,
                    "description": f"Minority class '{min_class_label}' represents only {imbalance_pct}% of the dataset (Majority: {round(maj_class_ratio*100, 1)}%).",
                    "verified_action": "Apply Stratified Train/Test split and enable balanced class weighting ('class_weight=balanced')."
                })
                target_remediation["use_stratified_split"] = True
                target_remediation["use_balanced_weights"] = True
            else:
                target_remediation["use_stratified_split"] = True
                target_remediation["use_balanced_weights"] = False
        else:
            # Regression target skew
            if np.issubdtype(df[target_col].dtype, np.number):
                skew = float(df[target_col].skew())
                if abs(skew) > 1.5:
                    issues.append({
                        "column": target_col,
                        "category": "Target Skewness",
                        "severity": "Medium",
                        "description": f"Continuous target '{target_col}' is highly skewed (skewness = {round(skew, 2)}).",
                        "verified_action": "Evaluate models with Robust loss metrics and tree ensembles resilient to heavy tails."
                    })

        # ------------------------------------------------------------------
        # 2. FEATURE DIAGNOSTICS & VERIFICATION
        # ------------------------------------------------------------------
        for col in df.columns:
            if col == target_col or col in columns_to_drop:
                continue

            series = df[col]
            unique_cnt = series.nunique()
            null_cnt = int(series.isnull().sum())
            null_pct = null_cnt / total_rows

            # A. Constant / Zero-variance columns
            if unique_cnt <= 1:
                issues.append({
                    "column": col,
                    "category": "Zero Variance",
                    "severity": "Critical",
                    "description": f"Column '{col}' has only {unique_cnt} distinct value across all rows (no predictive information).",
                    "verified_action": f"Drop useless column '{col}' from feature matrix."
                })
                columns_to_drop.append(col)
                continue

            # B. Identifier / Leakage / High Cardinality Text
            col_lower = col.lower()
            is_id_name = any(id_kw in col_lower for id_kw in ["id", "uuid", "guid", "code", "index", "hash"])
            if (unique_cnt / total_rows > 0.90 and series.dtype == "object") or (is_id_name and unique_cnt / total_rows > 0.50):
                issues.append({
                    "column": col,
                    "category": "Identifier / Leakage",
                    "severity": "Critical",
                    "description": f"Column '{col}' acts as a unique row identifier ({unique_cnt} unique values, {round(unique_cnt/total_rows*100, 1)}% cardinality).",
                    "verified_action": f"Drop identifier '{col}' to prevent spurious overfitting and memorization."
                })
                columns_to_drop.append(col)
                continue

            # C. Severe Missingness (> 50%)
            if null_pct > 0.50:
                issues.append({
                    "column": col,
                    "category": "Severe Missingness",
                    "severity": "High",
                    "description": f"Column '{col}' is missing {round(null_pct*100, 1)}% of its values.",
                    "verified_action": f"Drop column '{col}' due to high missingness exceeding the 50% threshold."
                })
                columns_to_drop.append(col)
                continue

            # D. Mild Missingness (< 50%)
            if null_cnt > 0:
                if np.issubdtype(series.dtype, np.number):
                    issues.append({
                        "column": col,
                        "category": "Missing Values",
                        "severity": "Low",
                        "description": f"Numeric column '{col}' has {null_cnt} missing values ({round(null_pct*100, 1)}%).",
                        "verified_action": "Apply Median Imputation with missing value indicator."
                    })
                    columns_to_impute_num.append(col)
                else:
                    issues.append({
                        "column": col,
                        "category": "Missing Values",
                        "severity": "Low",
                        "description": f"Categorical column '{col}' has {null_cnt} missing values ({round(null_pct*100, 1)}%).",
                        "verified_action": "Apply Most-Frequent (Mode) Imputation."
                    })
                    columns_to_impute_cat.append(col)

            # E. High Cardinality Categorical
            if series.dtype == "object" or series.dtype.name == "category":
                if unique_cnt > 35:
                    issues.append({
                        "column": col,
                        "category": "High Cardinality Category",
                        "severity": "Medium",
                        "description": f"Categorical column '{col}' has {unique_cnt} unique categories (would blow up One-Hot encoding).",
                        "verified_action": f"Drop high-cardinality string column '{col}' or select top frequency levels."
                    })
                    columns_to_drop.append(col)
                else:
                    columns_to_encode.append(col)

            # F. Numeric Outliers / Scaling Check
            if np.issubdtype(series.dtype, np.number):
                q25, q75 = series.quantile(0.25), series.quantile(0.75)
                iqr = q75 - q25
                if iqr > 0:
                    outliers_cnt = int(((series < (q25 - 3 * iqr)) | (series > (q75 + 3 * iqr))).sum())
                    if outliers_cnt > (0.03 * total_rows):
                        issues.append({
                            "column": col,
                            "category": "Severe Outliers",
                            "severity": "Medium",
                            "description": f"Column '{col}' has {outliers_cnt} severe outliers beyond 3x IQR.",
                            "verified_action": "Apply Robust / Standard scaling and prioritize tree-based ensemble models."
                        })
                columns_to_scale.append(col)

        # Retain order and deduplicate
        columns_to_drop = list(dict.fromkeys(columns_to_drop))

        return {
            "target_column": target_col,
            "task_type": task_type,
            "issues": issues,
            "total_issues_found": len(issues),
            "critical_issues_count": sum(1 for i in issues if i["severity"] == "Critical"),
            "high_issues_count": sum(1 for i in issues if i["severity"] == "High"),
            "columns_to_drop": columns_to_drop,
            "columns_to_impute_num": columns_to_impute_num,
            "columns_to_impute_cat": columns_to_impute_cat,
            "columns_to_encode": list(dict.fromkeys(columns_to_encode)),
            "columns_to_scale": list(dict.fromkeys(columns_to_scale)),
            "target_remediation": target_remediation,
        }

data_diagnostic_agent = DataDiagnosticAgent()
