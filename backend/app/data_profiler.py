import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional
from .database import db_manager

class DataProfiler:
    """Profiles CSV datasets and generates statistical metadata, history, and recommended questions."""

    @staticmethod
    def profile_csv(dataset_id: str, file_path: Path) -> Dict[str, Any]:
        meta = db_manager.get_table_meta(dataset_id)
        if not meta:
            meta = db_manager.register_csv(dataset_id, file_path)
            
        return DataProfiler.profile_dataset(dataset_id, filename=file_path.name)

    @staticmethod
    def profile_dataset(dataset_id: str, filename: Optional[str] = None) -> Dict[str, Any]:
        """Profiles the active DuckDB working table for dataset_id."""
        meta = db_manager.get_table_meta(dataset_id)
        if not meta:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        table_name = meta["table_name"]
        
        # Load working dataframe for statistics
        df = db_manager.con.sql(f"SELECT * FROM {table_name}").df()
        
        total_rows = len(df)
        total_columns = len(df.columns)
        
        # Preview rows (first 10)
        preview_df = df.head(10).where(pd.notnull(df.head(10)), None)
        preview_rows = preview_df.to_dict(orient="records")
        
        # Missing values count per column
        missing_values = {col: int(df[col].isnull().sum()) for col in df.columns}
        
        # Numeric stats
        numeric_stats = {}
        for col in df.select_dtypes(include=[np.number]).columns:
            series = df[col].dropna()
            if not series.empty:
                numeric_stats[col] = {
                    "min": float(series.min()) if not np.isnan(series.min()) else None,
                    "max": float(series.max()) if not np.isnan(series.max()) else None,
                    "mean": round(float(series.mean()), 2) if not np.isnan(series.mean()) else None,
                    "median": round(float(series.median()), 2) if not np.isnan(series.median()) else None,
                    "std": round(float(series.std()), 2) if not np.isnan(series.std()) else None,
                }

        # Generate intelligent suggestions based on detected columns
        suggested_questions = DataProfiler._generate_suggested_questions(df)

        actual_filename = filename or Path(meta.get("file_path", "dataset.csv")).name

        return {
            "dataset_id": dataset_id,
            "filename": actual_filename,
            "table_name": table_name,
            "total_rows": total_rows,
            "total_columns": total_columns,
            "original_rows": meta.get("original_rows", total_rows),
            "original_columns": meta.get("original_columns", total_columns),
            "history": meta.get("history", []),
            "columns": list(df.columns),
            "column_types": meta["column_types"],
            "preview_rows": preview_rows,
            "numeric_stats": numeric_stats,
            "missing_values": missing_values,
            "suggested_questions": suggested_questions,
        }

    @staticmethod
    def _generate_suggested_questions(df: pd.DataFrame) -> List[str]:
        questions = []
        cols = list(df.columns)
        num_cols = list(df.select_dtypes(include=[np.number]).columns)
        cat_cols = list(df.select_dtypes(include=['object', 'category', 'string']).columns)
        date_cols = [c for c in cols if any(kw in c.lower() for kw in ['date', 'time', 'year', 'month', 'day'])]

        # Question 1: Total records & overall overview
        questions.append("What is the total number of records and what are the main summary metrics?")

        # Question 2: Grouping by categorical column
        if cat_cols and num_cols:
            c = cat_cols[0]
            n = num_cols[0]
            questions.append(f"What is the total and average {n} grouped by {c}?")
        elif cat_cols:
            questions.append(f"What is the distribution of {cat_cols[0]}?")

        # Question 3: Top N items
        if cat_cols and num_cols:
            c = cat_cols[0]
            n = num_cols[0]
            questions.append(f"Show the top 5 {c} by highest total {n}.")
        elif num_cols:
            questions.append(f"What are the top 10 rows with highest {num_cols[0]}?")

        # Question 4: Date / Trend analysis if dates exist
        if date_cols and num_cols:
            questions.append(f"How does {num_cols[0]} trend over {date_cols[0]}?")
        elif len(num_cols) >= 2:
            questions.append(f"What is the relationship or correlation between {num_cols[0]} and {num_cols[1]}?")

        # Question 5: Outlier or anomaly check
        if num_cols:
            questions.append(f"Are there any outliers or notable maximums/minimums in {num_cols[0]}?")

        return questions[:5]
