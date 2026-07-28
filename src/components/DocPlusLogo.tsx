import React from 'react';

interface DocPlusLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const DocPlusLogo: React.FC<DocPlusLogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const dimensions = {
    sm: { icon: 'w-7 h-7', text: 'text-lg', sub: 'text-[9px]' },
    md: { icon: 'w-9 h-9', text: 'text-xl', sub: 'text-[10px]' },
    lg: { icon: 'w-12 h-12', text: 'text-2xl', sub: 'text-xs' },
    xl: { icon: 'w-20 h-20', text: 'text-4xl', sub: 'text-sm' },
  }[size];

  // Generate unique ID suffix to avoid duplicate SVG gradient definition conflicts
  const idSuffix = React.useId().replace(/:/g, '');

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Brand Icon SVG Emblem */}
      <div className={`relative flex items-center justify-center shrink-0 ${dimensions.icon}`}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          className="w-full h-full object-contain drop-shadow-md rounded-xl"
        >
          <defs>
            <linearGradient id={`bgGrad_${idSuffix}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#233d5d" />
              <stop offset="50%" stopColor="#162c47" />
              <stop offset="100%" stopColor="#102036" />
            </linearGradient>

            <linearGradient id={`hexFrame_${idSuffix}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2a4a73" />
              <stop offset="100%" stopColor="#1c3453" />
            </linearGradient>

            <linearGradient id={`hexWell_${idSuffix}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#101e33" />
              <stop offset="100%" stopColor="#1a2e4a" />
            </linearGradient>

            <linearGradient id={`greenTop_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#52d673" />
              <stop offset="100%" stopColor="#22b34a" />
            </linearGradient>

            <linearGradient id={`greenBody_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#28b84e" />
              <stop offset="50%" stopColor="#1e973d" />
              <stop offset="100%" stopColor="#15722c" />
            </linearGradient>

            <linearGradient id={`greenWing_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22ad48" />
              <stop offset="100%" stopColor="#1a8335" />
            </linearGradient>

            <filter id={`hexShadow_${idSuffix}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#08101c" floodOpacity="0.6" />
            </filter>

            <filter id={`plusShadow_${idSuffix}`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#091424" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Squircle Base */}
          <rect width="512" height="512" rx="112" fill={`url(#bgGrad_${idSuffix})`} />
          <rect width="504" height="504" x="4" y="4" rx="108" fill="none" stroke="#3b6294" strokeWidth="2" opacity="0.4" />

          {/* Hexagon Emblem */}
          <g filter={`url(#hexShadow_${idSuffix})`}>
            {/* Hexagon Outer Beveled Ring */}
            <path
              d="M 256 80 L 380 151.6 Q 396 160.8 396 179.3 L 396 322.7 Q 396 341.2 380 350.4 L 256 422 Q 240 431.2 224 422 L 100 350.4 Q 84 341.2 84 322.7 L 84 179.3 Q 84 160.8 100 151.6 L 224 80 Q 240 70.8 256 80 Z"
              fill={`url(#hexFrame_${idSuffix})`}
              stroke="#385e8e"
              strokeWidth="3"
            />

            {/* Hexagon Inner Depressed Well */}
            <path
              d="M 256 108 L 358 166.9 Q 370 173.8 370 187.7 L 370 295.3 Q 370 309.2 358 316.1 L 256 375 Q 244 381.9 232 375 L 130 316.1 Q 118 309.2 118 295.3 L 118 187.7 Q 118 173.8 130 166.9 L 232 108 Q 244 101.1 256 108 Z"
              fill={`url(#hexWell_${idSuffix})`}
              stroke="#0d1829"
              strokeWidth="6"
            />

            {/* Green Folded Document Flap & Body */}
            <path d="M 224 165 C 215 125, 232 120, 240 128 L 225 205 Z" fill={`url(#greenTop_${idSuffix})`} />
            <path d="M 170 220 L 240 128 C 248 138, 258 190, 225 285 C 205 338, 162 292, 170 220 Z" fill={`url(#greenBody_${idSuffix})`} />
            <path d="M 170 220 C 155 320, 230 360, 260 360 C 330 360, 396 270, 396 270 C 396 270, 328 335, 258 328 C 202 322, 182 270, 170 220 Z" fill={`url(#greenWing_${idSuffix})`} />

            {/* White Cross (+) */}
            <g transform="translate(268, 148)" filter={`url(#plusShadow_${idSuffix})`}>
              <rect x="28" y="0" width="24" height="72" rx="6" fill="#ffffff" />
              <rect x="4" y="24" width="72" height="24" rx="6" fill="#ffffff" />
            </g>
          </g>
        </svg>
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col justify-center leading-none">
          <div className={`font-black tracking-tight ${dimensions.text} flex items-center`}>
            <span className="text-slate-900 dark:text-slate-100 font-extrabold">Doc</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">Plus+</span>
          </div>
        </div>
      )}
    </div>
  );
};



