const MI = ({ icon, className = '', fill = false }) => (
  <span
    className={`material-symbols-outlined ${className}`}
    style={fill ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : {}}
  >
    {icon}
  </span>
);
export default MI;
