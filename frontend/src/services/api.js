const BASE_URL = 'http://127.0.0.1:8000';

export const api = {
  async checkHealth(settings = {}) {
    const params = new URLSearchParams({
      provider: settings.provider || 'ollama',
      ollama_url: settings.ollamaUrl || 'http://127.0.0.1:11434',
      ...(settings.modelName && { model_name: settings.modelName }),
      ...(settings.apiKey && { api_key: settings.apiKey }),
    });
    const res = await fetch(`${BASE_URL}/api/health?${params}`);
    if (!res.ok) throw new Error('Health check request failed');
    return res.json();
  },

  async uploadCSV(file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Failed to upload CSV');
    }
    return res.json();
  },

  async listDatasets() {
    const res = await fetch(`${BASE_URL}/api/datasets`);
    if (!res.ok) throw new Error('Failed to fetch datasets');
    return res.json();
  },

  async getDataset(datasetId) {
    const res = await fetch(`${BASE_URL}/api/datasets/${datasetId}`);
    if (!res.ok) throw new Error('Failed to fetch dataset details');
    return res.json();
  },

  async askAgent(datasetId, question, settings = {}) {
    const res = await fetch(`${BASE_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id: datasetId,
        question,
        provider: settings.provider || 'ollama',
        model_name: settings.modelName || undefined,
        ollama_url: settings.ollamaUrl || undefined,
        api_key: settings.apiKey || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Agent query failed' }));
      throw new Error(err.detail || 'Agent query failed');
    }
    return res.json();
  },

  async resetDataset(datasetId) {
    const res = await fetch(`${BASE_URL}/api/datasets/${datasetId}/reset`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to reset dataset' }));
      throw new Error(err.detail || 'Failed to reset dataset');
    }
    return res.json();
  },

  getExportUrl(datasetId, format = 'csv') {
    return `${BASE_URL}/api/datasets/${datasetId}/export?format=${format}`;
  },

  async downloadExport(datasetId, format = 'csv', filename = 'dataset') {
    const url = this.getExportUrl(datasetId, format);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_transformed.${format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  async runCustomSQL(datasetId, sqlQuery) {
    const res = await fetch(`${BASE_URL}/api/sql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id: datasetId,
        sql_query: sqlQuery,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'SQL execution failed' }));
      throw new Error(err.detail || 'SQL query failed');
    }
    return res.json();
  },

  async runAutoAnalyze(datasetId, prompt, settings = {}) {
    const res = await fetch(`${BASE_URL}/api/auto-analyze/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset_id: datasetId,
        prompt,
        provider: settings.provider || 'ollama',
        model_name: settings.modelName || undefined,
        ollama_url: settings.ollamaUrl || undefined,
        api_key: settings.apiKey || undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'AutoAnalyze failed' }));
      throw new Error(err.detail || 'AutoAnalyze execution failed');
    }
    return res.json();
  },

  getModelDownloadUrl(taskId) {
    return `${BASE_URL}/api/auto-analyze/${taskId}/download-model`;
  },

  getScriptDownloadUrl(taskId) {
    return `${BASE_URL}/api/auto-analyze/${taskId}/download-script`;
  }
};
