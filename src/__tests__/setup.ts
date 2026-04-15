import { vi } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => ({
      ...new Response(JSON.stringify(data), init),
      json: async () => data,
      status: init?.status ?? 200,
    }),
  },
}));
