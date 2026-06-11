interface DenoEnv {
  get(key: string): string | undefined;
}

declare namespace Deno {
  const env: DenoEnv;
  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/*";
declare module "https://deno.land/*";
declare module "npm:*";
declare module "../_shared/wordpress-credentials.ts" {
  export function decryptSecret(encrypted: string): Promise<string>;
  export function encodeBasicAuth(username: string, password_decrypted: string): string;
}
