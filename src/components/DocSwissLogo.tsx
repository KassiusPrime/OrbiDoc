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
      {/* Emblem */}
      <div className={`relative flex items-center justify-center shrink-0 ${dimensions.icon}`}>
        <img
          src="/logo.svg"
          alt="DocSwiss Emblem"
          className="w-full h-full object-contain drop-shadow-xs"
        />
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
