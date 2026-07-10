export const formatFileSize = (value = 0) => {
  const size = Number(value);
  const safeSize = Number.isFinite(size) && size > 0 ? size : 0;
  if (safeSize < 1024) {
    return safeSize + 'B';
  } else if (safeSize < 1024 * 1024) {
    return (safeSize / 1024).toFixed(2) + 'KB';
  } else if (safeSize < 1024 * 1024 * 1024) {
    return (safeSize / 1024 / 1024).toFixed(2) + 'MB';
  } else {
    return (safeSize / 1024 / 1024 / 1024).toFixed(2) + 'GB';
  }
}
