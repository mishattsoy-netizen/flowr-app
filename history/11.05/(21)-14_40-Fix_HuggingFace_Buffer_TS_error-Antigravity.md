User request: "@[current_problems]"

### 0. Date and time of the request
Date: 11.05.2026
Time: 14:40

### 1. User request
"@[current_problems]" (Referencing a TypeScript error in `src/lib/bot/providers/huggingface.ts` where `Buffer` is not assignable to `BodyInit` in a `fetch` call).

### 2. Objective Reconstruction
Fix the TypeScript compilation error in the HuggingFace provider where a `Buffer` object is passed directly as the `body` of a `fetch` request.

### 3. Strategic Reasoning
In standard `fetch` environments (and their TypeScript definitions), the `body` property of `RequestInit` expects a `BodyInit` type (like `ArrayBuffer`, `Uint8Array`, `Blob`, `string`, etc.). While Node.js `fetch` might accept `Buffer` at runtime, the TypeScript compiler (using `lib.dom.d.ts` or similar) flags `Buffer` as incompatible. Converting the `Buffer` to a `Uint8Array` satisfies the type checker without changing the runtime behavior (since `Buffer` is a subclass of `Uint8Array`).

### 4. Detailed Blueprint
- Target file: `src/lib/bot/providers/huggingface.ts`
- Target line: 135
- Change: Wrap `imageBuffer` in `new Uint8Array()` to ensure type compatibility with `BodyInit`.

### 5. Operational Trace
- Modified `src/lib/bot/providers/huggingface.ts`:
  - Changed `body: imageBuffer` to `body: new Uint8Array(imageBuffer)` inside the `runHuggingFaceUpscale` function.

### 6. Status Assessment
- **Completed**: The specific TypeScript error reported in the HuggingFace provider has been resolved.
- **Note**: A separate error in `src/lib/encryption.ts` regarding `crypto` default export was observed during verification but was not part of the original request.
