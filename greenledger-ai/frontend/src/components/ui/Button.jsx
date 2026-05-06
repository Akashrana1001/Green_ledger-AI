import { forwardRef, cloneElement, Children } from 'react';

/**
 * Three-tier button hierarchy (Fitts's Law + Affordance):
 *   primary (default) — solid emerald, primary CTA only
 *   secondary         — ghost with visible border, supporting actions
 *   outline           — alias for secondary (legacy compat)
 *   ghost             — no border, tertiary/text-level actions
 *   danger            — destructive actions
 *
 * All md/lg/xl sizes guarantee a 44×44px touch target per accessibility guidelines.
 */

const variantClasses = {
  default:
    'bg-emerald-600 text-white hover:bg-emerald-500 ' +
    'active:bg-emerald-700 ' +
    'transition-colors duration-200',
  secondary:
    'bg-transparent border border-slate-600 text-slate-200 ' +
    'hover:bg-slate-800 hover:border-slate-500 hover:text-slate-50 ' +
    'transition-colors duration-200',
  outline:
    'bg-transparent border border-slate-600 text-slate-200 ' +
    'hover:bg-slate-800 hover:border-slate-500 hover:text-slate-50 ' +
    'transition-colors duration-200',
  ghost:
    'bg-transparent text-slate-400 ' +
    'hover:bg-slate-800/60 hover:text-slate-100 ' +
    'transition-colors duration-200',
  danger:
    'bg-red-900/50 border border-red-800 text-red-300 ' +
    'hover:bg-red-900/70 hover:border-red-700 ' +
    'transition-colors duration-200',
};

const sizeClasses = {
  sm:  'h-9  px-3 text-xs  rounded   gap-1.5',
  md:  'h-11 px-4 text-sm  rounded-md gap-2',
  lg:  'h-11 px-6 text-sm  rounded-md gap-2  font-semibold',
  xl:  'h-12 px-8 text-base rounded-md gap-2 font-semibold',
};

const Button = forwardRef(({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  disabled,
  asChild = false,
  ...props
}, ref) => {
  const cls = [
    'inline-flex items-center justify-center font-medium',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
    'active:scale-[0.97]',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
    variantClasses[variant] ?? variantClasses.default,
    sizeClasses[size]       ?? sizeClasses.md,
    className,
  ].join(' ');

  if (asChild) {
    const child = Children.only(children);
    return cloneElement(child, {
      className: `${cls} ${child.props.className || ''}`.trim(),
      ref,
      ...props,
    });
  }

  return (
    <button ref={ref} disabled={disabled} className={cls} {...props}>
      {children}
    </button>
  );
});

Button.displayName = 'Button';
export { Button };
