import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/server (handled by setup.ts)
// Mock Supabase clients
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
}));

import { createClient, createServiceClient } from '@/lib/supabase/server';
import { POST } from '@/app/api/vet/upload-diploma/route';

// Helper to build a multipart FormData request
function makeRequest(file?: File | null): Request {
  if (file === undefined) {
    // No form data at all — will fail formData parsing
    return new Request('http://localhost/api/vet/upload-diploma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'invalid',
    });
  }

  const formData = new FormData();
  if (file !== null) {
    formData.append('file', file);
  }

  return new Request('http://localhost/api/vet/upload-diploma', {
    method: 'POST',
    body: formData,
  });
}

// Helper to create a fake File
function makeFile(opts: {
  name?: string;
  type?: string;
  size?: number;
  content?: string;
}): File {
  const { name = 'test.pdf', type = 'application/pdf', size, content = 'file content' } = opts;
  if (size !== undefined) {
    const largeContent = 'x'.repeat(size);
    return new File([largeContent], name, { type });
  }
  return new File([content], name, { type });
}

describe('POST /api/vet/upload-diploma', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });

    const req = makeRequest(makeFile({}));
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when no file provided', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    });

    // FormData with no file appended
    const formData = new FormData();
    const req = new Request('http://localhost/api/vet/upload-diploma', {
      method: 'POST',
      body: formData,
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when file type is text/plain (invalid)', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    });

    const file = makeFile({ name: 'test.txt', type: 'text/plain' });
    const req = makeRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/PDF|JPG|PNG/i);
  });

  it('returns 400 when file size exceeds 5MB', async () => {
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    });

    // 5MB + 1 byte
    const oversizedFile = makeFile({ type: 'application/pdf', size: 5 * 1024 * 1024 + 1 });
    const req = makeRequest(oversizedFile);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/5 MB/i);
  });

  it('returns 200 with { url } on valid PDF upload', async () => {
    const mockPublicUrl = 'https://test.supabase.co/storage/v1/object/public/diplomas/diplomas/user-123/diploma.pdf';

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: mockPublicUrl },
          }),
        }),
      },
    });

    const file = makeFile({ name: 'diploma.pdf', type: 'application/pdf' });
    const req = makeRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeDefined();
    expect(body.url).toBe(mockPublicUrl);
  });

  it('returns 200 with { url } on valid JPEG upload', async () => {
    const mockPublicUrl = 'https://test.supabase.co/storage/v1/object/public/diplomas/user-123/diploma.jpg';

    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
    });

    (createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: mockPublicUrl },
          }),
        }),
      },
    });

    const file = makeFile({ name: 'diploma.jpg', type: 'image/jpeg' });
    const req = makeRequest(file);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe(mockPublicUrl);
  });
});
