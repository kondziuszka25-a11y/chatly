export const getAvatarUrl = (url) => {
  if (!url) return null;
  if (
    url.startsWith('http://') || 
    url.startsWith('https://') || 
    url.startsWith('blob:') || 
    url.startsWith('data:')
  ) {
    return url;
  }
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  return `${backendUrl}${url}`;
};
