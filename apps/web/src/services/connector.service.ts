import { apiClient } from '@/lib/api-client';

export async function listApiConnectors() {
  const res = await apiClient.get('/connectors/api');
  return res.data.data.connectors;
}

export async function createApiConnector(data: object) {
  const res = await apiClient.post('/connectors/api', data);
  return res.data.data.connector;
}

export async function testApiConnector(id: string) {
  const res = await apiClient.post(`/connectors/api/${id}/test`);
  return res.data.data;
}

export async function addApiEndpoint(connectorId: string, data: object) {
  const res = await apiClient.post(`/connectors/api/${connectorId}/endpoints`, data);
  return res.data.data.endpoint;
}

export async function updateApiMapping(connectorId: string, fieldMappings: unknown[]) {
  const res = await apiClient.put(`/connectors/api/${connectorId}/mapping`, { field_mappings: fieldMappings });
  return res.data.data.mapping;
}

export async function deleteApiConnector(id: string) {
  await apiClient.delete(`/connectors/api/${id}`);
}

export async function listDbConnectors() {
  const res = await apiClient.get('/connectors/db');
  return res.data.data.connectors;
}

export async function createDbConnector(data: object) {
  const res = await apiClient.post('/connectors/db', data);
  return res.data.data.connector;
}

export async function testDbConnector(id: string) {
  const res = await apiClient.post(`/connectors/db/${id}/test`);
  return res.data.data;
}

export async function getDbSchema(id: string) {
  const res = await apiClient.get(`/connectors/db/${id}/schema`);
  return res.data.data.tables;
}

export async function addQueryTemplate(connectorId: string, data: object) {
  const res = await apiClient.post(`/connectors/db/${connectorId}/queries`, data);
  return res.data.data.template;
}

export async function deleteDbConnector(id: string) {
  await apiClient.delete(`/connectors/db/${id}`);
}

export async function listMaskingRules() {
  const res = await apiClient.get('/connectors/masking');
  return res.data.data.rules;
}

export async function createMaskingRule(data: object) {
  const res = await apiClient.post('/connectors/masking', data);
  return res.data.data.rule;
}

export async function deleteMaskingRule(id: string) {
  await apiClient.delete(`/connectors/masking/${id}`);
}

export async function previewMasking(samplePayload: object) {
  const res = await apiClient.post('/connectors/masking/preview', { sample_payload: samplePayload });
  return res.data.data;
}

export async function requestUpgrade(featureAttempted?: string) {
  const res = await apiClient.post('/upgrade/request', { feature_attempted: featureAttempted });
  return res.data.data;
}
