import { apiClient } from '@/lib/api-client';
import type { SimulationResult } from '@pocketcomputer/shared-types';

export async function runSimulation(scenario: string): Promise<SimulationResult> {
  const res = await apiClient.post<{ success: true; data: { simulation: SimulationResult } }>(
    '/simulate',
    { scenario }
  );
  return res.data.data.simulation;
}
