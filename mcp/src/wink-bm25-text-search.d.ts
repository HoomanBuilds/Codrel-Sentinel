declare module "wink-bm25-text-search" {
  interface BM25Config {
    fldWeights: Record<string, number>;
    bm25Params?: {
      k1?: number;
      b?: number;
      k?: number;
    };
    ovFldNames?: string[];
  }

  interface BM25Engine {
    defineConfig(config: BM25Config): void;

    definePrepTasks(
      tasks: Array<(input: string) => string[]>,
      field?: string
    ): number;

    addDoc(doc: Record<string, string>, id: string): number;
    consolidate(): void;

    search(query: string): Array<{ id: string; score: number }>;
  }

  function bm25(): BM25Engine;
  export default bm25;
}
