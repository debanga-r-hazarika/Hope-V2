import { ReactNode } from 'react';

interface ModernCardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
  onClick?: () => void;
}

export function ModernCard({
  children,
  className = '',
  padding = 'md',
  shadow = 'md',
  border = true,
  onClick
}: ModernCardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  };

  const shadowClasses = {
    none: '',
    sm: 'shadow-premium-sm',
    md: 'shadow-premium',
    lg: 'shadow-premium-lg',
  };

  return (
    <div
      onClick={onClick}
      className={`
        bg-surface rounded-xl 
        ${border ? 'border border-border' : ''} 
        ${paddingClasses[padding]} 
        ${shadowClasses[shadow]} 
        ${onClick ? 'cursor-pointer hover:shadow-premium-md transition-shadow duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
