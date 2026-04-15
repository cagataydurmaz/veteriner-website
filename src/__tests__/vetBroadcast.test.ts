import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { broadcastVetStatus } from '@/lib/vetBroadcast';

describe('broadcastVetStatus', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should not throw when env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(
      broadcastVetStatus('vet-123', { is_online_now: true })
    ).resolves.toBeUndefined();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should not throw when only URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    await expect(
      broadcastVetStatus('vet-123', { is_online_now: true })
    ).resolves.toBeUndefined();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should not throw when only service key is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(
      broadcastVetStatus('vet-123', { is_online_now: true })
    ).resolves.toBeUndefined();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('should call fetch with correct endpoint when env vars are present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    await broadcastVetStatus('vet-abc', { is_online_now: true });

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      'https://test.supabase.co/realtime/v1/api/broadcast',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should call fetch with correct headers', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    await broadcastVetStatus('vet-abc', { is_online_now: true });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer test-service-key',
      'apikey': 'test-service-key',
    });
  });

  it('should send messages to both vet-status:{vetId} and vet-status-changes topics', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    const vetId = 'vet-uuid-123';

    await broadcastVetStatus(vetId, { is_online_now: false });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].topic).toBe(`vet-status:${vetId}`);
    expect(body.messages[1].topic).toBe('vet-status-changes');
  });

  it('should include the vetId and changes in the payload', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    const vetId = 'vet-uuid-456';
    const changes = { is_online_now: true, is_available_today: true };

    await broadcastVetStatus(vetId, changes);

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.messages[0].payload).toMatchObject({
      vetId,
      is_online_now: true,
      is_available_today: true,
    });
    expect(body.messages[1].payload).toMatchObject({
      vetId,
      is_online_now: true,
      is_available_today: true,
    });
  });

  it('should use status_change event for both messages', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    await broadcastVetStatus('vet-xyz', { is_on_call: true });

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(options.body);

    expect(body.messages[0].event).toBe('status_change');
    expect(body.messages[1].event).toBe('status_change');
  });

  it('should swallow fetch errors silently', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(
      broadcastVetStatus('vet-123', { is_online_now: true })
    ).resolves.toBeUndefined();
  });

  it('should swallow non-Error fetch exceptions silently', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    vi.spyOn(global, 'fetch').mockRejectedValue('string error');

    await expect(
      broadcastVetStatus('vet-123', { is_online_now: true })
    ).resolves.toBeUndefined();
  });
});
