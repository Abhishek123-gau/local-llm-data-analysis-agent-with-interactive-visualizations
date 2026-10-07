import duckdb
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import time

class DuckDBManager:
    """Manages DuckDB in-memory database and loaded CSV tables."""
    
    def __init__(self):
        self.con = duckdb.connect(database=":memory:")
        self.tables: Dict[str, Dict[str, Any]] = {}

    def register_csv(self, dataset_id: str, file_path: Path, table_name: Optional[str] = None) -> Dict[str, Any]:
        """Registers a CSV file as a DuckDB table."""
        sanitized_table = table_name or f"data_{dataset_id.replace('-', '_')}"
        
        # Read with DuckDB's automatic CSV sniffer and type inferrer
        escaped_path = str(file_path).replace("\\", "/")
        query = f"CREATE OR REPLACE TABLE {sanitized_table} AS SELECT * FROM read_csv_auto('{escaped_path}');"
        self.con.execute(query)

        # Inspect columns & types
        info = self.con.execute(f"DESCRIBE {sanitized_table};").fetchall()
        column_types = {row[0]: row[1] for row in info}
        columns = list(column_types.keys())
        
        # Total rows
        total_rows = self.con.execute(f"SELECT COUNT(*) FROM {sanitized_table};").fetchone()[0]

        meta = {
            "dataset_id": dataset_id,
            "table_name": sanitized_table,
            "file_path": str(file_path),
            "columns": columns,
            "column_types": column_types,
            "total_rows": total_rows,
            "created_at": time.time()
        }
        self.tables[dataset_id] = meta
        return meta

    def get_table_meta(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        return self.tables.get(dataset_id)

    def execute_query(self, sql_query: str, max_rows: int = 1000) -> Tuple[List[Dict[str, Any]], List[str], float]:
        """Executes a SQL query in DuckDB and returns (rows, column_names, duration_ms)."""
        start_time = time.perf_counter()
        
        # Execute query
        rel = self.con.sql(sql_query)
        columns = [col for col in rel.columns]
        
        # Limit result size for responsiveness
        df = rel.limit(max_rows).df()
        
        # Convert NaN / NaT / Inf to None / serializable values
        df = df.where(pd.notnull(df), None)
        
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        results = df.to_dict(orient="records")
        return results, columns, round(duration_ms, 2)

    def get_schema_summary(self, dataset_id: str) -> str:
        """Returns a clean schema prompt string with column names, types, and 3 sample rows."""
        meta = self.get_table_meta(dataset_id)
        if not meta:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        table_name = meta["table_name"]
        columns_desc = []
        for col, col_type in meta["column_types"].items():
            columns_desc.append(f"  - \"{col}\" ({col_type})")
        
        # Fetch 3 sample rows
        sample_df = self.con.sql(f"SELECT * FROM {table_name} LIMIT 3").df()
        sample_df = sample_df.where(pd.notnull(sample_df), None)
        sample_json = sample_df.to_dict(orient="records")

        schema_text = f"""Table Name: {table_name}
Total Rows: {meta['total_rows']}
Columns and Data Types:
{chr(10).join(columns_desc)}

Sample Data (First 3 rows):
{sample_json}
"""
        return schema_text

db_manager = DuckDBManager()
