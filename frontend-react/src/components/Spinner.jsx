export default function Spinner({ size = 'md', light = false }) {
  const sizeMap = { sm: 'spinner-sm', md: '', lg: 'spinner-lg' };
  const lightStyle = light
    ? { borderColor: 'rgba(253,250,244,.25)', borderTopColor: '#FDFAF4' }
    : {};
  return (
    <span
      className={`spinner ${sizeMap[size]}`}
      style={lightStyle}
      aria-label="Loading"
    />
  );
}
