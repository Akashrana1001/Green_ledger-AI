import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const VARIANT = {
  compliant: {
    label: 'SEBI Compliant',
    bg: 'bg-emerald-900/50',
    text: 'text-emerald-400',
    ring: 'ring-emerald-800/40',
    Icon: CheckCircle2,
    spin: false,
  },
  'non-compliant': {
    label: 'Non-Compliant',
    bg: 'bg-red-900/50',
    text: 'text-red-300',
    ring: 'ring-red-800/40',
    Icon: XCircle,
    spin: false,
  },
  analyzing: {
    label: 'Pending Audit',
    bg: 'bg-amber-900/40',
    text: 'text-amber-400',
    ring: 'ring-amber-800/40',
    Icon: Loader2,
    spin: true,
  },
};

export default function ComplianceBadge({ status = 'analyzing' }) {
  const v = VARIANT[status] ?? VARIANT.analyzing;
  const { Icon } = v;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ${v.bg} ${v.text} ${v.ring}`}
      role="status"
    >
      <Icon className={`h-3.5 w-3.5 ${v.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      {v.label}
    </span>
  );
}
