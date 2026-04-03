import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Clipboard API is not implemented in jsdom
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
});

// Suppress react-markdown / rehype console noise in tests
vi.spyOn(console, 'warn').mockImplementation(() => {});
