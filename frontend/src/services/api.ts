import { DashboardFilterParams, DashboardResponse, HealthResponse, SyncStatusResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchDashboard(params: DashboardFilterParams, signal?: AbortSignal): Promise<DashboardResponse> {
  const query = new URLSearchParams({
    start_date: params.start_date,
    end_date: params.end_date,
    mode: params.mode,
    horizon_hours: params.horizon_hours.toString(),
    gate_closure_hour_utc: params.gate_closure_hour_utc.toString(),
    percentile: params.percentile.toString(),
    resolution: params.resolution,
  });

  const controller = new AbortController();
  // 60-second timeout allows graceful cold-start wake-up on free tier hosts (e.g. Render)
  const timeoutId = setTimeout(() => controller.abort(), 60000);
  
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const res = await fetch(`${API_BASE}/api/v1/wind/dashboard?${query.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      let errorMessage = res.statusText;
      try {
        const errJson = await res.json();
        errorMessage = errJson.detail || JSON.stringify(errJson);
      } catch {
        const text = await res.text();
        if (text) errorMessage = text;
      }
      throw new Error(`API Error ${res.status}: ${errorMessage}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function triggerSync(): Promise<SyncStatusResponse> {
  const res = await fetch(`${API_BASE}/api/v1/wind/sync`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Failed to initiate sync: ${res.statusText}`);
  }
  return res.json();
}

export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const res = await fetch(`${API_BASE}/api/v1/wind/sync/status`);
  if (!res.ok) {
    throw new Error(`Failed to fetch sync status: ${res.statusText}`);
  }
  return res.json();
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}
