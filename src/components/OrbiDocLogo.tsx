import React from 'react';

interface OrbiDocLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

/**
 * Compatibility component name retained to avoid breaking historical imports.
 * The top-level product is now Orbit; OrbiDoc is the Office module inside it.
 */
export const OrbiDocLogo: React.FC<OrbiDocLogoProps> = ({
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
    <div className={`flex items-center gap-2.5 ${className}`} aria-label="Orbit">
      <div className={`relative shrink-0 ${dimensions.icon}`} aria-hidden="true">
        <img
          src="/brand/orbidoc-symbol-light.svg"
          alt=""
          draggable={false}
          className="block w-full h-full object-contain dark:hidden"
        />
        <img
          src="/brand/orbidoc-symbol-dark.svg"
          alt=""
          draggable={false}
          className="hidden w-full h-full object-contain dark:block"
        />
      </div>

      {showText ? (
        <div className={`${dimensions.text} font-bold tracking-[-0.035em] leading-none whitespace-nowrap font-inter`}>
          <span className="text-[#0B1220] dark:text-[#F8FAFF]">Orbit</span>
        </div>
      ) : null}
    </div>
  );
};
