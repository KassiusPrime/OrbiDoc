import React from 'react';
import { OrbitProfileBadge } from './OrbitProfileBadge';

type Props = React.ComponentProps<typeof OrbitProfileBadge>;

/** Compatibility filename for AppV5 imports; the rendered surface is Conta Orbit. */
export const GoogleProfileBadge: React.FC<Props> = (props) => <OrbitProfileBadge {...props} />;
