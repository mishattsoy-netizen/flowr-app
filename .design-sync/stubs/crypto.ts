// Browser stub for Node.js 'crypto' — used only in server-side code that won't
// execute in design-sync preview renders.
const randomBytes = (_n: number): Buffer => Buffer.alloc(0);
const createCipheriv = (_alg: string, _key: any, _iv: any) => ({
  update: (_data: any): Buffer => Buffer.alloc(0),
  final: (): Buffer => Buffer.alloc(0),
});
const createDecipheriv = (_alg: string, _key: any, _iv: any) => ({
  update: (_data: any): Buffer => Buffer.alloc(0),
  final: (): Buffer => Buffer.alloc(0),
});
const createHash = (_alg: string) => ({
  update: (_data: any) => ({ digest: (_enc?: string) => '' }),
});
export { randomBytes, createCipheriv, createDecipheriv, createHash };
export default { randomBytes, createCipheriv, createDecipheriv, createHash };
