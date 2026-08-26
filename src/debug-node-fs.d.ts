/** Temporary ambient types for debug repro (project has no @types/node). */
declare module "node:fs" {
  export function appendFileSync(
    path: string,
    data: string | Uint8Array,
  ): void;
  export function writeFileSync(path: string, data: string | Uint8Array): void;
}
