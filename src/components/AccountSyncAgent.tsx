import React, { useEffect, useRef } from 'react';
import { subscribeToOrbiDocAuth, type OrbiDocAuthUser } from '../services/firebase';
import { pushCurrentThemePreference, syncOrbiDocPreferences, upsertOrbiDocUserProfile } from '../services/accountSync';
import {
  currentWorkspaceProjectIds,
  mergeCloudWorkspaceProjects,
  switchWorkspaceAccountScope,
  syncCurrentWorkspaceProjects,
} from '../services/workspaceAccountSync';

export const AccountSyncAgent: React.FC = () => {
  const lastTheme = useRef<'light' | 'dark'>(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  const timer = useRef<number>(0);
  const projectTimer = useRef<number>(0);
  const activeUser = useRef<OrbiDocAuthUser | null>(null);
  const projectIds = useRef<Set<string>>(new Set());
  const workspaceReady = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let reloadTimer = 0;

    const unsubscribe = subscribeToOrbiDocAuth((user) => {
      activeUser.current = user;
      workspaceReady.current = false;

      void (async () => {
        if (!user || user.isAnonymous) {
          const scopeChanged = switchWorkspaceAccountScope(null);
          projectIds.current = currentWorkspaceProjectIds();
          workspaceReady.current = true;
          if (scopeChanged && !cancelled) {
            reloadTimer = window.setTimeout(() => window.location.reload(), 80);
          }
          return;
        }

        const scopeChanged = switchWorkspaceAccountScope(user);
        await upsertOrbiDocUserProfile(user);
        const preferences = await syncOrbiDocPreferences(user);
        if (preferences) lastTheme.current = preferences.themeMode;

        const cloudChanged = await mergeCloudWorkspaceProjects();
        projectIds.current = currentWorkspaceProjectIds();
        workspaceReady.current = true;

        if (scopeChanged || cloudChanged) {
          if (!cancelled) reloadTimer = window.setTimeout(() => window.location.reload(), 100);
          return;
        }

        // The initial snapshot is known at this point, so later missing IDs can be
        // treated as intentional local deletions rather than an empty boot race.
        projectIds.current = await syncCurrentWorkspaceProjects(projectIds.current);
      })().catch((error) => {
        console.warn('OrbiDoc account workspace initialization failed:', error);
        workspaceReady.current = true;
      });
    });

    const onProjectsUpdated = () => {
      const user = activeUser.current;
      if (!workspaceReady.current || !user || user.isAnonymous) return;
      window.clearTimeout(projectTimer.current);
      projectTimer.current = window.setTimeout(() => {
        const previous = projectIds.current;
        void syncCurrentWorkspaceProjects(previous)
          .then((next) => { projectIds.current = next; })
          .catch((error) => console.warn('OrbiDoc project cloud sync failed:', error));
      }, 1200);
    };

    window.addEventListener('orbidoc:projects-updated', onProjectsUpdated);
    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('orbidoc:projects-updated', onProjectsUpdated);
      window.clearTimeout(projectTimer.current);
      window.clearTimeout(reloadTimer);
    };
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
