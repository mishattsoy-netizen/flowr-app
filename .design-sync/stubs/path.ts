// Browser stub for Node.js 'path' — used only in server-side code.
const sep = '/';
const join = (...parts: string[]): string => parts.filter(Boolean).join('/');
const resolve = (...parts: string[]): string => parts.filter(Boolean).join('/');
const dirname = (p: string): string => p.split('/').slice(0, -1).join('/') || '.';
const basename = (p: string, ext?: string): string => {
  const b = p.split('/').pop() || '';
  return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
};
export { sep, join, resolve, dirname, basename };
export default { sep, join, resolve, dirname, basename };
