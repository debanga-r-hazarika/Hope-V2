interface NavigationItemProps {
  label: string;
  isActive: boolean;
  isLogout?: boolean;
  onClick: () => void;
  variant?: 'horizontal' | 'vertical';
}

export function NavigationItem({
  label,
  isActive,
  isLogout,
  onClick,
  variant = 'horizontal'
}: NavigationItemProps) {
  const baseClasses = 'font-medium transition-all duration-200 cursor-pointer flex items-center';

  const variantClasses = variant === 'horizontal'
    ? 'px-4 py-2 rounded-lg text-sm'
    : 'px-4 py-3 w-full text-left rounded-xl mx-2 mb-1 text-sm';

  const stateClasses = isLogout
    ? variant === 'horizontal'
      ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
      : 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
    : isActive
      ? variant === 'horizontal'
        ? 'text-primary bg-primary/5 font-semibold'
        : 'text-white bg-white/10 shadow-premium-sm font-semibold'
      : variant === 'horizontal'
        ? 'text-gray-600 hover:text-primary hover:bg-gray-50'
        : 'text-gray-400 hover:text-white hover:bg-white/5';

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses} ${stateClasses}`}
    >
      {label}
    </button>
  );
}
