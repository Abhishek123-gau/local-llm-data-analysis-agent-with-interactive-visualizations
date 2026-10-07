from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field, field_validator

class DatasetSummary(BaseModel):
    dataset_id: str
    filename: str
    total_rows: int
    total_columns: int
    columns: List[str]
    column_types: Dict[str, str]
    preview_rows: List[Dict[str, Any]]
    suggested_questions: List[str] = []
    numeric_stats: Dict[str, Dict[str, Any]] = {}
    missing_values: Dict[str, int] = {}

class ChartConfig(BaseModel):
    chart_type: str = Field(description="bar, line, area, pie, scatter, histogram, heatmap, or table")
    title: str
    x_axis: Optional[str] = None
    y_axis: Optional[str] = None
    y_axes: Optional[List[str]] = None
    group_by: Optional[str] = None
    description: Optional[str] = None

class QueryRequest(BaseModel):
    dataset_id: str
    question: str
    provider: Optional[str] = "ollama"
    model_name: Optional[str] = None
    ollama_url: Optional[str] = None
    api_key: Optional[str] = None

class QueryResponse(BaseModel):
    dataset_id: str
    question: str
    sql_query: str
    results: List[Dict[str, Any]]
    columns: List[str]
    row_count: int
    explanation: Union[str, List[Any], Dict[str, Any]] = ""
    summary_insights: Union[str, List[Any], Dict[str, Any]] = ""
    chart_config: Optional[ChartConfig] = None
    execution_time_ms: float
    error: Optional[str] = None
    iterations: int = 1

    @field_validator('summary_insights', 'explanation', mode='before')
    @classmethod
    def coerce_to_string(cls, v: Any) -> str:
        if v is None:
            return ""
        if isinstance(v, list):
            return "\n".join(f"- {str(item)}" for item in v)
        if isinstance(v, dict):
            return "\n".join(f"- **{k}**: {val}" for k, val in v.items())
        return str(v)

class LLMConfigRequest(BaseModel):
    provider: str
    model_name: Optional[str] = None
    ollama_url: Optional[str] = None
    api_key: Optional[str] = None

class CustomSQLRequest(BaseModel):
    dataset_id: str
    sql_query: str
