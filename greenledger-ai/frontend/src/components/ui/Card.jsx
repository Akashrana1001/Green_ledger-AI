/**
 * Enterprise card system — Tactile Brutalism.
 * 1px solid border, slate-800 surface, 4px radius. No shadows, no blur.
 * Accepts a className override for one-off adjustments.
 */

const Card = ({ children, className = '', ...props }) => (
  <div
    className={`gl-card ${className}`}
    {...props}
  >
    {children}
  </div>
);

const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`px-6 pt-6 pb-4 ${className}`} {...props}>
    {children}
  </div>
);

const CardTitle = ({ children, className = '', ...props }) => (
  <h3
    className={`text-base font-semibold leading-6 tracking-tight text-slate-50 ${className}`}
    {...props}
  >
    {children}
  </h3>
);

const CardDescription = ({ children, className = '', ...props }) => (
  <p
    className={`mt-1 text-sm leading-5 text-slate-400 ${className}`}
    {...props}
  >
    {children}
  </p>
);

const CardContent = ({ children, className = '', ...props }) => (
  <div className={`px-6 pb-6 ${className}`} {...props}>
    {children}
  </div>
);

const CardFooter = ({ children, className = '', ...props }) => (
  <div
    className={`flex items-center px-6 pb-6 pt-0 ${className}`}
    {...props}
  >
    {children}
  </div>
);

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
