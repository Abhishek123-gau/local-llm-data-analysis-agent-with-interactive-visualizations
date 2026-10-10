import duckdb
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import time

class DuckDBManager:
    """Manages DuckDB in-memory database with raw snapshot backups and working mutable tables."""
    
    def __init__(self):
        self.con = duckdb.connect(database=":memory:")
        self.tables: Dict[str, Dict[str, Any]] = {}

    def register_csv(self, dataset_id: str, file_path: Path, table_name: Optional[str] = None) -> Dict[str, Any]:
        """Registers a CSV file as both a raw permanent copy and a working mutable DuckDB table."""
        sanitized_id = dataset_id.replace('-', '_')
        working_table = table_name or f"data_{sanitized_id}"
        raw_table = f"raw_{sanitized_id}"
        
        # Read with DuckDB's automatic CSV sniffer and type inferrer into raw backup table
        escaped_path = str(file_path).replace("\\", "/")
        self.con.execute(f"CREATE OR REPLACE TABLE {raw_table} AS SELECT * FROM read_csv_auto('{escaped_path}');")
        # Create active working copy from raw
        self.con.execute(f"CREATE OR REPLACE TABLE {working_table} AS SELECT * FROM {raw_table};")

        # Inspect columns & types
        info = self.con.execute(f"DESCRIBE {working_table};").fetchall()
        column_types = {row[0]: row[1] for row in info}
        columns = list(column_types.keys())
        
        # Total rows
        total_rows = self.con.execute(f"SELECT COUNT(*) FROM {working_table};").fetchone()[0]

        meta = {
            "dataset_id": dataset_id,
            "table_name": working_table,
            "raw_table_name": raw_table,
            "file_path": str(file_path),
            "columns": columns,
            "column_types": column_types,
            "total_rows": total_rows,
            "original_rows": total_rows,
            "original_columns": len(columns),
            "history": [],
            "created_at": time.time()
        }
        self.tables[dataset_id] = meta
        return meta

    def get_table_meta(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        return self.tables.get(dataset_id)

    def refresh_table_meta(self, dataset_id: str) -> Dict[str, Any]:
        """Refreshes schema, column names, types, and row count from the live DuckDB working table."""
        meta = self.tables.get(dataset_id)
        if not meta:
            raise ValueError(f"Dataset {dataset_id} not found in database manager")
        
        working_table = meta["table_name"]
        info = self.con.execute(f"DESCRIBE {working_table};").fetchall()
        column_types = {row[0]: row[1] for row in info}
        columns = list(column_types.keys())
        total_rows = self.con.execute(f"SELECT COUNT(*) FROM {working_table};").fetchone()[0]

        meta["columns"] = columns
        meta["column_types"] = column_types
        meta["total_rows"] = total_rows
        self.tables[dataset_id] = meta
        return meta

    def reset_to_original(self, dataset_id: str) -> Dict[str, Any]:
        """Restores the working table from the original immutable raw copy."""
        meta = self.tables.get(dataset_id)
        if not meta:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        working_table = meta["table_name"]
        raw_table = meta["raw_table_name"]
        
        # Overwrite working table from raw snapshot
        self.con.execute(f"CREATE OR REPLACE TABLE {working_table} AS SELECT * FROM {raw_table};")
        meta["history"] = []
        return self.refresh_table_meta(dataset_id)

    def execute_query(self, sql_query: str, max_rows: int = 1000) -> Tuple[List[Dict[str, Any]], List[str], float]:
        """Executes a SQL query in DuckDB and returns (rows, column_names, duration_ms)."""
        start_time = time.perf_counter()
        
        # Check if query is a DDL/DML mutation
        query_strip = sql_query.strip().upper()
        is_mutation_stmt = any(query_strip.startswith(prefix) for prefix in [
            "CREATE", "ALTER", "DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE"
        ])

        if is_mutation_stmt:
            self.con.execute(sql_query)
            # Find which table was modified
            # Fetch a sample of the first table matching data_ or return empty
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            return [], [], round(duration_ms, 2)

        # Normal SELECT query
        rel = self.con.sql(sql_query)
        columns = [col for col in rel.columns]
        
        # Limit result size for responsiveness
        df = rel.limit(max_rows).df()
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
