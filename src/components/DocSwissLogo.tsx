import React from 'react';

interface DocSwissLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const DocSwissLogo: React.FC<DocSwissLogoProps> = ({
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

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Emblem SVG Inline */}
      <div className={`relative flex items-center justify-center shrink-0 ${dimensions.icon}`}>
        <svg
          viewBox="0 0 512 512"
          className="w-full h-full object-contain drop-shadow-md"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="logoBgBlueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3454" />
              <stop offset="50%" stopColor="#152642" />
              <stop offset="100%" stopColor="#0f1b30" />
            </linearGradient>

            <linearGradient id="logoHexFrameGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2a456e" />
              <stop offset="100%" stopColor="#1a2e4c" />
            </linearGradient>

            <linearGradient id="logoHexWellGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#13223b" />
              <stop offset="100%" stopColor="#1a2d4b" />
            </linearGradient>

            <linearGradient id="logoGreenTopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>

            <linearGradient id="logoGreenBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>

            <linearGradient id="logoGreenSwooshGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>
          </defs>

          {/* Squircle Base */}
          <rect width="512" height="512" rx="100" fill="url(#logoBgBlueGrad)" />
          <rect width="504" height="504" x="4" y="4" rx="96" fill="none" stroke="#385888" strokeWidth="3" opacity="0.6" />

          {/* Hexagon Group */}
          <g>
            {/* Outer Hexagon */}
            <path
              d="M 256 95 L 375 163.7 Q 388 171.2 388 186.2 L 388 325.8 Q 388 340.8 375 348.3 L 256 417 Q 243 424.5 230 417 L 111 348.3 Q 98 340.8 98 325.8 L 98 186.2 Q 98 171.2 111 163.7 L 230 95 Q 243 87.5 256 95 Z"
              fill="url(#logoHexFrameGrad)"
              stroke="#3b5d92"
              strokeWidth="4"
            />

            {/* Inner Hexagon */}
            <path
              d="M 256 122 L 352 177.4 Q 362 183.2 362 194.7 L 362 305.3 Q 362 316.8 352 322.6 L 256 378 Q 246 383.8 236 378 L 140 322.6 Q 130 316.8 130 305.3 L 130 194.7 Q 130 183.2 140 177.4 L 236 122 Q 246 116.2 256 122 Z"
              fill="url(#logoHexWellGrad)"
              stroke="#111c2e"
              strokeWidth="6"
            />

            {/* Green Folded Document Leaf */}
            <path d="M 222 178 C 215 140, 230 135, 238 142 L 225 210 Z" fill="url(#logoGreenTopGrad)" />
            <path d="M 182 226 L 238 142 C 246 150, 252 200, 222 282 C 205 328, 175 290, 182 226 Z" fill="url(#logoGreenBodyGrad)" />
            <path d="M 182 226 C 170 315, 235 348, 260 348 C 320 348, 382 278, 382 278 C 382 278, 320 328, 256 322 C 208 318, 192 272, 182 226 Z" fill="url(#logoGreenSwooshGrad)" />

            {/* White Cross (+) */}
            <g transform="translate(270, 155)">
              <rect x="25" y="0" width="22" height="66" rx="5" fill="#ffffff" />
              <rect x="3" y="22" width="66" height="22" rx="5" fill="#ffffff" />
            </g>
          </g>
        </svg>
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col justify-center leading-none">
          <div className={`font-black tracking-tight ${dimensions.text} flex items-center`}>
            <span className="text-slate-900 dark:text-slate-100 font-extrabold">Doc</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black">Swiss</span>
          </div>
          <span className={`text-slate-400 dark:text-slate-500 font-medium tracking-wider uppercase mt-0.5 ${dimensions.sub}`}>
            Suite Profissional
          </span>
        </div>
      )}
    </div>
  );
};

