import { z } from 'zod';

export const runSimulationSchema = z.object({
  scenario: z.string().min(5, 'Describe your scenario in at least 5 characters').max(500),
});

export type RunSimulationInput = z.infer<typeof runSimulationSchema>;
