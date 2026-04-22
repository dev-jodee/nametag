import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared capture store — hoisted so the mock factory can reference it.
const lines = vi.hoisted<Record<string, unknown>[]>(() => []);

// Hoisted prisma + bcrypt mock fns
const mocks = vi.hoisted(() => ({
  findUniqueUser: vi.fn(),
  updateUser: vi.fn(async () => ({})),
  comparePassword: vi.fn(async (p: string, h: string) => p === 'correct-password' && h === 'stored-hash'),
}));

vi.mock('@/lib/logger', async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Writable } = require('node:stream') as typeof import('node:stream');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pino = require('pino') as typeof import('pino');

  const actual = await vi.importActual<typeof import('@/lib/logger')>('@/lib/logger');

  const stream = new Writable({
    write(c: Buffer, _e: BufferEncoding, cb: () => void) {
      lines.push(JSON.parse(c.toString()) as Record<string, unknown>);
      cb();
    },
  });

  const log = pino.default({ ...actual.pinoOptions, transport: undefined }, stream);

  return {
    ...actual,
    logger: log,
    createModuleLogger: (m: string) => log.child({ module: m }),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mocks.findUniqueUser,
      update: mocks.updateUser,
    },
  },
}));

vi.mock('bcryptjs', () => ({
  default: { compare: mocks.comparePassword },
  compare: mocks.comparePassword,
}));

vi.mock('@/lib/features', () => ({
  isFeatureEnabled: vi.fn(() => false),
  isSaasMode: vi.fn(() => false),
}));

import { authorizeCredentials } from '@/lib/auth';

beforeEach(() => {
  lines.length = 0;
  mocks.findUniqueUser.mockReset();
  mocks.updateUser.mockClear();
});

describe('auth domain events', () => {
  it('emits auth.login.succeeded with userId on correct password', async () => {
    mocks.findUniqueUser.mockResolvedValue({
      id: 'u-1', email: 'a@b.com', password: 'stored-hash',
      name: 'A', surname: null, nickname: null, photo: null,
      failedLoginAttempts: 0, lockedUntil: null, emailVerified: new Date(),
      language: 'en',
    });

    const result = await authorizeCredentials({ email: 'a@b.com', password: 'correct-password' });
    expect(result).not.toBeNull();

    const evt = lines.find((l) => l.event === 'auth.login.succeeded');
    expect(evt).toBeDefined();
    expect(evt).toMatchObject({ userId: 'u-1', method: 'credentials' });
  });

  it('emits auth.login.failed with reason:invalid_credentials on wrong password', async () => {
    mocks.findUniqueUser.mockResolvedValue({
      id: 'u-1', email: 'a@b.com', password: 'stored-hash',
      name: 'A', failedLoginAttempts: 0, lockedUntil: null, emailVerified: new Date(),
      language: 'en',
    });

    const result = await authorizeCredentials({ email: 'a@b.com', password: 'wrong' });
    expect(result).toBeNull();

    const evt = lines.find((l) => l.event === 'auth.login.failed');
    expect(evt).toBeDefined();
    expect(evt).toMatchObject({ reason: 'invalid_credentials', email: 'a@b.com' });
  });

  it('emits auth.login.failed with reason:unknown_user when no such email', async () => {
    mocks.findUniqueUser.mockResolvedValue(null);

    const result = await authorizeCredentials({ email: 'missing@b.com', password: 'x' });
    expect(result).toBeNull();

    const evt = lines.find((l) => l.event === 'auth.login.failed');
    expect(evt).toBeDefined();
    expect(evt).toMatchObject({ reason: 'unknown_user' });
  });
});
