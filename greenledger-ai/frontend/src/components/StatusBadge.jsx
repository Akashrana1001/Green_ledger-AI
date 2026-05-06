const STATUS_STYLES = {
  pending:    'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
  processing: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  verified:   'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  failed:     'bg-red-500/10 text-red-400 border border-red-500/30',
};

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
    {status}
  </span>
);

export default StatusBadge;
