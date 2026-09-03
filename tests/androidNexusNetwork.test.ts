import assert from 'node:assert/strict';
import test from 'node:test';
import { orbitApiUrl, ORBIT_PRODUCTION_API_ORIGIN } from '../src/lib/orbitApiOrigin';

function setWindow(value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value });
  return () => {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else delete (globalThis as { window?: unknown }).window;
  };
}

test('web keeps Nexus API same-origin', () => {
  const restore = setWindow({});
  try {
    assert.equal(orbitApiUrl('/api/chat'), '/api/chat');
    assert.equal(orbitApiUrl('api/chat/stream'), '/api/chat/stream');
  } finally {
    restore();
  }
});

test('Capacitor Android routes Nexus API to production HTTPS origin', () => {
  const restore = setWindow({
    Capacitor: {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
    },
  });

  try {
    assert.equal(ORBIT_PRODUCTION_API_ORIGIN, 'https://doc-swiss.vercel.app');
    assert.equal(orbitApiUrl('/api/chat'), 'https://doc-swiss.vercel.app/api/chat');
    assert.equal(orbitApiUrl('/api/chat/stream'), 'https://doc-swiss.vercel.app/api/chat/stream');
  } finally {
    restore();
  }
});
