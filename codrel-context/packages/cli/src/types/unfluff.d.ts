// src/types/unfluff.d.ts
declare module "unfluff" {
  interface UnfluffResult {
    text?: string;
    title?: string;
    softTitle?: string;
    image?: string;
    videos?: string[];
    tags?: string[];
    canonicalLink?: string;
  }

  function unfluff(html: string): UnfluffResult;
  export = unfluff;
}
