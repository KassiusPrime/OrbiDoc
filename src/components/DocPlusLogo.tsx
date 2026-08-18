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
    sm: { icon: 'w-7 h-7', text: 'text-base' },
    md: { icon: 'w-9 h-9', text: 'text-lg' },
    lg: { icon: 'w-12 h-12', text: 'text-xl' },
    xl: { icon: 'w-20 h-20', text: 'text-3xl' },
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`relative shrink-0 ${dimensions.icon}`}>
        <img
          src="/logo.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="w-full h-full object-contain rounded-[22%] shadow-sm"
        />
      </div>

      {showText && (
        <div className={`${dimensions.text} font-black tracking-[-0.035em] leading-none whitespace-nowrap`}>
          <span className="text-slate-950 dark:text-white">Doc</span>
          <span className="text-indigo-600 dark:text-indigo-400">Swiss</span>
        </div>
      )}
    </div>
  );
};
