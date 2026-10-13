import uuid
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, FileResponse

from .config import UPLOAD_DIR, DEFAULT_PROVIDER, OLLAMA_BASE_URL, DEFAULT_OLLAMA_MODEL
from .database import db_manager
from .data_profiler import DataProfiler
from .llm_client import LLMClient
from .agent import CSVSQLAgent
from .auto_analyzer.orchestrator import AutoAnalyzeOrchestrator, ARTIFACTS_DIR
from .models import (
    DatasetSummary,
    QueryRequest,
    QueryResponse,
    CustomSQLRequest,
    LLMConfigRequest,
)

class AutoAnalyzeRequest(BaseModel):
    dataset_id: str
    prompt: str
    provider: Optional[str] = "ollama"
    model_name: Optional[str] = None
    ollama_url: Optional[str] = None
    api_key: Optional[str] = None

app = FastAPI(
    title="CSV Analysis Agent API",
    description="DuckDB-powered Text-to-SQL Agentic CSV Analysis and Feature Engineering Engine",
    version="1.0.0",
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for dataset metadata
DATASETS_STORE: Dict[str, Dict[str, Any]] = {}

def get_or_restore_dataset(dataset_id: str) -> Optional[Dict[str, Any]]:
    """Gets dataset from memory or restores from disk if server was restarted."""
    if dataset_id in DATASETS_STORE:
        return DATASETS_STORE[dataset_id]
    
    # Check if file exists in UPLOAD_DIR
    matched_files = list(UPLOAD_DIR.glob(f"{dataset_id}_*.csv"))
    if matched_files:
        file_path = matched_files[0]
        try:
            profile = DataProfiler.profile_csv(dataset_id, file_path)
            DATASETS_STORE[dataset_id] = profile
            return profile
        except Exception as e:
            print(f"Error restoring dataset {dataset_id}: {e}")
            return None
    return None

@app.on_event("startup")
def startup_event():
    """Restore all existing uploaded CSV datasets on startup."""
    for csv_file in UPLOAD_DIR.glob("*_*.csv"):
        parts = csv_file.name.split("_", 1)
        if len(parts) == 2:
            dataset_id = parts[0]
            try:
                profile = DataProfiler.profile_csv(dataset_id, csv_file)
                DATASETS_STORE[dataset_id] = profile
                print(f"Loaded dataset: {dataset_id} ({csv_file.name})")
            except Exception as e:
                print(f"Could not load {csv_file.name}: {e}")

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "CSV Data Analysis Agent API",
        "duckdb_ready": True,
        "docs_url": "/docs"
    }

@app.get("/api/health")
async def health_check(
    provider: str = Query(DEFAULT_PROVIDER),
    ollama_url: str = Query(OLLAMA_BASE_URL),
    model_name: Optional[str] = Query(None),
    api_key: Optional[str] = Query(None),
):
    """Check connectivity to Ollama or selected LLM provider."""
    client = LLMClient(
        provider=provider,
        model_name=model_name,
        ollama_url=ollama_url,
        api_key=api_key
    )
    return await client.check_health()

@app.post("/api/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a CSV file, register with DuckDB, and profile schema and statistics."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported.")

    dataset_id = str(uuid.uuid4())[:8]
    clean_filename = Path(file.filename).name
    file_path = UPLOAD_DIR / f"{dataset_id}_{clean_filename}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        profile = DataProfiler.profile_csv(dataset_id, file_path)
        DATASETS_STORE[dataset_id] = profile
        return profile
    except Exception as e:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")

@app.get("/api/datasets")
def list_datasets():
    """List all loaded datasets."""
    return list(DATASETS_STORE.values())

@app.get("/api/datasets/{dataset_id}")
def get_dataset(dataset_id: str):
    """Get metadata, stats, and preview rows for a dataset."""
    dataset = get_or_restore_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found. Please upload the CSV.")
    return dataset

@app.post("/api/query", response_model=QueryResponse)
async def query_dataset(request: QueryRequest):
    """Run an agentic natural language question or feature engineering transformation against the dataset."""
    dataset = get_or_restore_dataset(request.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found in memory or disk. Please re-upload your CSV file.")

    client = LLMClient(
        provider=request.provider or DEFAULT_PROVIDER,
        model_name=request.model_name,
        ollama_url=request.ollama_url,
        api_key=request.api_key,
    )
    agent = CSVSQLAgent(client)

    try:
        response = await agent.analyze(
            dataset_id=request.dataset_id,
            question=request.question,
        )
        if response.dataset_updated and response.updated_dataset:
            DATASETS_STORE[request.dataset_id] = response.updated_dataset.model_dump()
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent analysis failed: {str(e)}")

@app.post("/api/datasets/{dataset_id}/reset")
def reset_dataset(dataset_id: str):
    """Reset the mutable working dataset back to the initial raw copy."""
    dataset = get_or_restore_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    try:
        db_manager.reset_to_original(dataset_id)
        fresh_profile = DataProfiler.profile_dataset(dataset_id, filename=dataset.get("filename"))
        DATASETS_STORE[dataset_id] = fresh_profile
        return fresh_profile
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset dataset: {str(e)}")

@app.get("/api/datasets/{dataset_id}/export")
def export_dataset(dataset_id: str, format: str = Query("csv", pattern="^(csv|json)$")):
    """Export the active modified working dataset as downloadable CSV or JSON."""
    dataset = get_or_restore_dataset(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    meta = db_manager.get_table_meta(dataset_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Table metadata for '{dataset_id}' not found.")

    table_name = meta["table_name"]
    base_name = Path(dataset.get("filename", "dataset.csv")).stem
    df = db_manager.con.sql(f"SELECT * FROM {table_name}").df()

    if format == "json":
        json_content = df.to_json(orient="records", indent=2)
        return Response(
            content=json_content,
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{base_name}_transformed.json"'
            }
        )
    else:
        csv_content = df.to_csv(index=False)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{base_name}_transformed.csv"'
            }
        )

@app.post("/api/sql")
def execute_custom_sql(request: CustomSQLRequest):
    """Execute raw SQL in DuckDB against the dataset table."""
    dataset = get_or_restore_dataset(request.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found.")

    try:
        results, columns, duration_ms = db_manager.execute_query(request.sql_query)
        return {
            "dataset_id": request.dataset_id,
            "sql_query": request.sql_query,
            "results": results,
            "columns": columns,
            "row_count": len(results),
            "execution_time_ms": duration_ms,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL Execution Error: {str(e)}")

# ==============================================================================
# AUTO-ANALYZE & MULTI-AGENT MACHINE LEARNING PIPELINE ENDPOINTS
# ==============================================================================

@app.post("/api/auto-analyze/run")
async def run_auto_analyze(request: AutoAnalyzeRequest):
    """Executes the full multi-agent autonomous problem formulation, data diagnostic, remediation, and modeling pipeline."""
    dataset = get_or_restore_dataset(request.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail=f"Dataset '{request.dataset_id}' not found.")

    client = LLMClient(
        provider=request.provider or DEFAULT_PROVIDER,
        model_name=request.model_name,
        ollama_url=request.ollama_url,
        api_key=request.api_key,
    )

    orchestrator = AutoAnalyzeOrchestrator(client)
    try:
        report = await orchestrator.run_pipeline(request.dataset_id, request.prompt)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AutoAnalyze Pipeline Execution Failed: {str(e)}")

@app.get("/api/auto-analyze/{task_id}/download-model")
def download_champion_model(task_id: str):
    """Downloads the trained champion .joblib model pipeline."""
    task_dir = ARTIFACTS_DIR / task_id
    if not task_dir.exists():
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' artifacts not found.")

    joblib_files = list(task_dir.glob("champion_*.joblib"))
    if not joblib_files:
        raise HTTPException(status_code=404, detail="Champion model file not found.")

    model_file = joblib_files[0]
    return FileResponse(
        path=str(model_file),
        filename=model_file.name,
        media_type="application/octet-stream"
    )

@app.get("/api/auto-analyze/{task_id}/download-script")
def download_training_script(task_id: str):
    """Downloads the standalone reproducible Python training script."""
    task_dir = ARTIFACTS_DIR / task_id
    script_file = task_dir / "reproducible_train_pipeline.py"
    if not script_file.exists():
        raise HTTPException(status_code=404, detail="Training script not found.")

    return FileResponse(
        path=str(script_file),
        filename="train_pipeline.py",
        media_type="text/x-python"
    )
