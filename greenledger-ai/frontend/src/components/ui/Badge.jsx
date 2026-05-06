const variantClasses = {
  default:   'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  outline:   'border-emerald-500/50 text-emerald-400 bg-transparent',
  secondary: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  warning:   'bg-yellow-900/20 text-yellow-400 border-yellow-700/30',
  danger:    'bg-red-900/20 text-red-400 border-red-700/30',
  blue:      'bg-sky-900/20 text-sky-400 border-sky-700/30',
  teal:      'bg-teal-500/10 text-teal-400 border-teal-500/25',
  subtle:    'bg-white/5 text-zinc-400 border-white/10',
};

const Badge = ({ children, variant = 'default', className = '', ...props }) => (
  <span
    className={[
      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full',
      'text-[10px] font-bold tracking-wider uppercase border',
      variantClasses[variant] || variantClasses.default,
      className,
    ].join(' ')}
    {...props}
  >
    {children}
  </span>
);

export { Badge };
