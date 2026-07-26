import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { sendPasswordResetEmail } from './mailer';

vi.mock('axios');

describe('sendPasswordResetEmail', () => {
  const originalKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('logs to the console instead of calling Resend when no API key is configured', async () => {
    delete process.env.RESEND_API_KEY;
    await sendPasswordResetEmail('a@example.com', 'growme://reset?token=abc');
    expect(axios.post).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('growme://reset?token=abc'));
  });

  it('calls the Resend API when an API key is configured', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    (axios.post as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockResolvedValue({ status: 200 });
    await sendPasswordResetEmail('a@example.com', 'growme://reset?token=abc');
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ to: 'a@example.com', html: expect.stringContaining('growme://reset?token=abc') }),
      expect.objectContaining({ headers: { Authorization: 'Bearer re_test_key' } })
    );
  });

  it('falls back to console logging if the Resend API call fails', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    (axios.post as unknown as ReturnType<typeof vi.fn>) = vi.fn().mockRejectedValue(new Error('network down'));
    await sendPasswordResetEmail('a@example.com', 'growme://reset?token=abc');
    expect(console.error).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('growme://reset?token=abc'));
  });
});
