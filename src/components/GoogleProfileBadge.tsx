import React from 'react';
import { OrbitProfileBadge } from './OrbitProfileBadge';

type Props = React.ComponentProps<typeof OrbitProfileBadge>;

/**
 * Compatibility export for existing shell imports.
 *
 * The hidden legacy trigger exists only so older quick-menu code can open the
 * new Orbit account surface during the migration. It exposes no credentials or
 * provider controls and can be removed once every internal aria selector uses
 * the Orbit name.
 */
export const GoogleProfileBadge: React.FC<Props> = (props) => (
  <>
    <OrbitProfileBadge {...props} />
    <button
      type="button"
      hidden
      tabIndex={-1}
      aria-hidden="true"
      aria-label="Conta OrbiDoc e conexões externas"
      onClick={() => {
        document.querySelector<HTMLButtonElement>('button[aria-label="Conta Orbit e conexões externas"]')?.click();
      }}
    />
  </>
);
