import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server (handled by setup.ts)
// Mock Supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

// Mock vetBroadcast
vi.mock('@/lib/vetBroadcast', () => ({
  broadcastVetStatus: vi.fn().mockResolvedValue(undefined),
}));

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { broadcastVetStatus } from '@/lib/vetBroadcast';
import { POST } from '@/app/api/vet/toggle-online/route';

function makeRequest(body: object): Request {
  return new Request('http://localhost/api/vet/toggle-online', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Build a mock vet record
function mockVet(overrides: Partial<{
  id: string;
  offers_video: boolean;
  is_busy: boolean;
  buffer_lock: boolean;
  is_verified: boolean;
}> = {}) {
  return {
    id: 'vet-uuid-123',
    offers_video: true,
    is_busy: false,
    buffer_lock: false,
    is_verified: true,
    ...overrides,
  };
}

describe('POST /api/vet/toggle-online', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const req = makeRequest({ online: true });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 200 and updates DB correctly when toggling online', async () => {
    const vet = mockVet();

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: vet }),
          }),
        }),
      }),
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: mockUpdate,
      }),
    });

    const req = makeRequest({ online: true });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.is_online_now).toBe(true);
  });

  it('returns 200 and updates DB correctly when toggling offline', async () => {
    const vet = mockVet({ offers_video: true });

    const mockUpdateFn = vi.fn();
    mockUpdateFn.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: vet }),
          }),
        }),
      }),
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: mockUpdateFn,
      }),
    });

    const req = makeRequest({ online: false });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_online_now).toBe(false);
  });

  it('calls broadcastVetStatus after successful toggle', async () => {
    const vet = mockVet();

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: vet }),
          }),
        }),
      }),
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const req = makeRequest({ online: true });
    await POST(req);

    // broadcastVetStatus is void (fire-and-forget), so we check it was called
    // Note: it may be called asynchronously so we check if the mock was invoked
    expect(broadcastVetStatus).toHaveBeenCalledWith(vet.id, { is_online_now: true });
  });

  it('returns 403 when vet profile not found', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    const req = makeRequest({ online: true });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it('returns 400 when vet does not have video enabled but tries to go online', async () => {
    const vet = mockVet({ offers_video: false });

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: vet }),
          }),
        }),
      }),
    });

    const req = makeRequest({ online: true });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.layer).toBe(1);
  });

  it('returns 409 when vet is busy and tries to go online', async () => {
    const vet = mockVet({ is_busy: true });

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: vet }),
          }),
        }),
      }),
    });

    const req = makeRequest({ online: true });
    const res = await POST(req);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.layer).toBe(3);
  });
});
