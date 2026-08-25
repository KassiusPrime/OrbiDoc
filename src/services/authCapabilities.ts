import firebaseConfig from '../../firebase-applet-config.json';

export type PasswordAuthState = 'checking' | 'enabled' | 'disabled' | 'unavailable';

let cached: Promise<Exclude<PasswordAuthState, 'checking'>> | null = null;

export function probeOrbiDocPasswordAuth(): Promise<Exclude<PasswordAuthState, 'checking'>> {
  if (cached) return cached;
  cached = (async () => {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '';
    if (!apiKey) return 'unavailable';

    try {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `orbidoc-capability-${Date.now()}@invalid.example`,
          password: 'OrbiDoc-capability-check-not-a-real-password',
          returnSecureToken: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      const code = String(payload?.error?.message || '');

      if (/PASSWORD_LOGIN_DISABLED|OPERATION_NOT_ALLOWED|CONFIGURATION_NOT_FOUND/.test(code)) return 'disabled';
      if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD|USER_DISABLED/.test(code)) return 'enabled';
      return 'unavailable';
    } catch {
      return 'unavailable';
    }
  })();
  return cached;
}

export function clearOrbiDocAuthCapabilityCache() {
  cached = null;
}
