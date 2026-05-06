import { Inbox } from 'lucide-react';

const EmptyState = ({ icon: Icon = Inbox, title = 'Nothing here yet', message = '', action = null }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
    <Icon className="h-12 w-12 text-gray-600" strokeWidth={1.5} />
    <h3 className="text-gray-300 font-medium text-lg">{title}</h3>
    {message && <p className="text-gray-500 text-sm max-w-sm">{message}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export default EmptyState;
