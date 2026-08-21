import React, { useEffect, useRef } from 'react';
import { subscribeToOrbiDocAuth } from '../services/firebase';
import { pushCurrentThemePreference, syncOrbiDocPreferences, upsertOrbiDocUserProfile } from '../services/accountSync';

export const AccountSyncAgent: React.FC = () => {
  const lastTheme = useRef<'light' | 'dark'>(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const timer = useRef<number>(0);

  useEffect(() => {
    const unsubscribe = subscribeToOrbiDocAuth((user) => {
      if (!user || user.isAnonymous) return;
      void upsertOrbiDocUserProfile(user);
      void syncOrbiDocPreferences(user).then((preferences) => {
        if (preferences) lastTheme.current = preferences.themeMode;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme: 'light' | 'dark' = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      if (theme === lastTheme.current) return;
      lastTheme.current = theme;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { void pushCurrentThemePreference(); }, 900);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer.current);
    };
  }, []);

  return null;
};
