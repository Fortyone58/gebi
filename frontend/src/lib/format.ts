export function relativeTime(epoch: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - epoch);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (safeSeconds < 3600) return `${minutes} 分钟`;
  if (safeSeconds < 86400) return `${hours} 小时 ${minutes % 60} 分`;
  return `${days} 天 ${hours % 24} 小时`;
}

export function compactCount(value: number): string {
  return value.toLocaleString("zh-CN");
}

export function textLength(value: string): number {
  return Array.from(value).length;
}

export function truncateText(value: string, limit: number): string {
  return Array.from(value).slice(0, limit).join("");
}
