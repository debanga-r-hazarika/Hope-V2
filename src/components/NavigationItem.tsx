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
  const baseClasses = 'font-medium transition-colors cursor-pointer';

  const variantClasses = variant === 'horizontal'
    ? 'px-4 py-2'
    : 'px-6 py-3 w-full text-left';

  const stateClasses = isLogout
    ? variant === 'horizontal'
      ? 'text-red-600 hover:text-red-700'
      : 'text-red-400 hover:text-red-300 hover:bg-red-900/20'
    : isActive
      ? variant === 'horizontal'
        ? 'text-primary border-b-2 border-primary'
        : 'text-white bg-primary/20 border-l-4 border-primary'
      : variant === 'horizontal'
        ? 'text-gray-700 hover:text-primary'
        : 'text-gray-300 hover:text-white hover:bg-gray-700';

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses} ${stateClasses}`}
    >
      {label}
    </button>
  );
}
