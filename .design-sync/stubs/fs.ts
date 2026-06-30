// Browser stub for Node.js 'fs' — used only in server-side code.
const existsSync = (_path: string): boolean => false;
const readFileSync = (_path: string, _opts?: any): string => '';
const writeFileSync = (_path: string, _data: any): void => {};
const mkdirSync = (_path: string, _opts?: any): void => {};
export { existsSync, readFileSync, writeFileSync, mkdirSync };
export default { existsSync, readFileSync, writeFileSync, mkdirSync };
