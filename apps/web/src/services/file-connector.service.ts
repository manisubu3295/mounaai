import { apiClient } from '@/lib/api-client';

export interface FileConnector {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  file_name: string;
  headers: string[];
  row_count: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export async function listFileConnectors(): Promise<FileConnector[]> {
  const res = await apiClient.get<{ data: { connectors: FileConnector[] } }>('/connectors/file');
  return res.data.data.connectors;
}

export async function createFileConnector(input: {
  name: string;
  description?: string;
  file_name: string;
  csv_text: string;
}): Promise<FileConnector> {
  const res = await apiClient.post<{ data: { connector: FileConnector } }>('/connectors/file', input);
  return res.data.data.connector;
}

export async function deleteFileConnector(id: string): Promise<void> {
  await apiClient.delete(`/connectors/file/${id}`);
}
