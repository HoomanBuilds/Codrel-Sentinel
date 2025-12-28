"use client";

import React, { useState, useEffect } from "react";
import {
  Input,
  Textarea,
  Button,
  Label,
  SelectNative,
  Card,
  Badge,
} from "../../../components/ui/primitives";
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Plus,
  X,
  Copy,
  Check,
  Trash2,
  LinkIcon,
} from "lucide-react";

const EMBEDDING_MODELS = [
  { value: "gemini-embedding-exp-03-07", label: "Gemini Embedding Exp" },
  { value: "text-embedding-3-large", label: "OpenAI Text-3 Large" },
  { value: "cohere-embed-v3", label: "Cohere Embed v3" },
  { value: "huggingface-minilm", label: "HF MiniLM-L6" },
];

const VECTOR_STORES = [
  { value: "pinecone", label: "Pinecone" },
  { value: "milvus", label: "Milvus" },
  { value: "weaviate", label: "Weaviate" },
  { value: "chromadb", label: "ChromaDB" },
];

const RETRIEVERS = [
  { value: "cosine", label: "Cosine Similarity" },
  { value: "mmr", label: "Max Marginal Relevance" },
  { value: "bm25", label: "BM25 + Vector (Hybrid)" },
  { value: "multi-query", label: "Multi-Query Expansion" },
];

export interface RAGFormState {
  name: string;
  description: string;
  prompt: string;
  resourceLinks: string[];
  docId: string;
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  vectorStore: string;
  retrieverAlgo: string;
  maxTokens: number;
  temperature: number;
  topP: number;
}
const INITIAL_STATE: RAGFormState = {
  name: "",
  description: "",
  prompt: "",
  resourceLinks: [],
  docId: "",
  chunkSize: 512,
  chunkOverlap: 50,
  embeddingModel: "gemini-embedding-exp-03-07",
  vectorStore: "pinecone",
  retrieverAlgo: "bm25",
  maxTokens: 4096,
  temperature: 0.7,
  topP: 0.9,
};

export default function UploadForm() {
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success">(
    "idle"
  );

  const [linkInput, setLinkInput] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files ? Array.from(e.target.files) : [];
    setFiles((prev) => [...prev, ...newFiles].slice(0, 10));
    e.target.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    setStatus("processing");

    setTimeout(() => {
      setIsUploading(false);
      setStatus("success");
    }, 2000);
  };

  const handleReset = () => {
    setFiles([]);
    setShowAdvanced(false);
    setStatus("idle");

    const newId = "doc_" + crypto.randomUUID().slice(0, 8);
    setFormData({ ...INITIAL_STATE, docId: newId });
  };

  const handleAddLink = () => {
    if (!linkInput.trim()) return;
    setFormData((p) => ({
      ...p,
      resourceLinks: [...p.resourceLinks, linkInput.trim()],
    }));
    setLinkInput("");
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(formData.docId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1200);
  };

  return (
    <div
      style={{
        overflow: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
      }}
      className="max-w-5xl overflow-y-auto h-screen mx-auto space-y-6 py-10"
    >
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-lg font-semibold text-white">New Pipeline</h2>
          <p className="text-sm text-muted">
            Ingest documents for retrieval augmented generation.
          </p>
        </div>

        <Badge variant={status === "success" ? "success" : "default"}>
          {status === "success" ? "Ingestion Complete" : "Ready to Index"}
        </Badge>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MAIN */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-6 space-y-5 border  bg-[#1c1c1c] border-white/10">
              {/* name */}
              <div className="space-y-1.5">
                <Label>Pipeline Name</Label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Q4 Reports"
                  className="bg-[#151515]"
                />
              </div>

              {/* description */}
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="bg-[#151515]"
                />
              </div>

              <div className="space-y-2">
                <Label>Resource URLs</Label>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                    <Input
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      className="pl-9 bg-[#151515]"
                      placeholder="https://github.com/..."
                    />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleAddLink}
                    disabled={!linkInput.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {formData.resourceLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.resourceLinks.map((l, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-neutral-800/40 border border-border rounded-md pl-3 pr-1 py-1"
                      >
                        <span className="text-xs text-neutral-300 truncate max-w-[220px]">
                          {l}
                        </span>
                        <button
                          type="button"
                          className="p-1"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              resourceLinks: p.resourceLinks.filter(
                                (_, i) => i !== idx
                              ),
                            }))
                          }
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prompt */}
              <div className="space-y-1.5">
                <Label>Extraction Prompt</Label>
                <div className="relative">
                  <Sparkles className="absolute left-3 top-3 h-4 w-4 text-yellow-500/50" />
                  <Textarea
                    name="prompt"
                    value={formData.prompt}
                    onChange={handleChange}
                    className="pl-9 bg-[#151515] min-h-[100px]"
                  />
                </div>
              </div>

              {/* Upload */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label>Source Files</Label>
                  <span className="text-xs text-neutral-500">
                    {files.length}/10 files
                  </span>
                </div>

                <label className="border border-dashed border-white/10 bg-[#151515] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-800/20 min-h-[120px]">
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept=".txt,.md,.json,.csv,.pdf"
                    onChange={handleFileChange}
                  />
                  <UploadCloud className="h-5 w-5 text-muted mb-2" />
                  <span className="text-sm text-neutral-300">
                    Click to upload files
                  </span>
                </label>

                {files.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {files.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-neutral-800/40 border border-white/10 rounded"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-4 w-4 text-neutral-400" />
                          <span className="text-xs truncate">{f.name}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1 text-neutral-500"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* SIDEBAR */}
          <div className="space-y-4">
            <Card className="p-6 space-y-5 border-white/10 bg-[#1c1c1c]">
              <div className="space-y-1.5">
                <Label>Document ID</Label>
                <div className="flex gap-2">
                  <Input
                    className="font-mono text-xs bg-[#151515]"
                    readOnly
                    value={formData.docId}
                  />
                  <Button type="button" size="icon" onClick={handleCopyId}>
                    {isCopied ? (
                      <Check className="h-3 w-3 text-green-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Advanced Settings</Label>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-2"
                  onClick={() => setShowAdvanced((x) => !x)}
                >
                  {showAdvanced ? "Hide" : "Open"}
                </Button>
              </div>

              {showAdvanced && (
                <div className="space-y-3">
                  <div>
                    <Label>Chunking</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        name="chunkSize"
                        value={formData.chunkSize}
                        onChange={handleChange}
                        className="bg-[#151515]"
                      />
                      <Input
                        type="number"
                        name="chunkOverlap"
                        value={formData.chunkOverlap}
                        onChange={handleChange}
                        className="bg-[#151515]"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Embedding Model</Label>
                    <SelectNative
                      name="embeddingModel"
                      value={formData.embeddingModel}
                      onChange={handleChange}
                      className="bg-[#151515]"
                    >
                      {EMBEDDING_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </SelectNative>
                  </div>

                  <div>
                    <Label>Vector Store</Label>
                    <SelectNative
                      name="vectorStore"
                      value={formData.vectorStore}
                      onChange={handleChange}
                      className="bg-[#151515]"
                    >
                      {VECTOR_STORES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </SelectNative>
                  </div>

                  <div>
                    <Label>Retriever</Label>
                    <SelectNative
                      name="retrieverAlgo"
                      value={formData.retrieverAlgo}
                      onChange={handleChange}
                      className="bg-[#151515]"
                    >
                      {RETRIEVERS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </SelectNative>
                  </div>
                </div>
              )}
            </Card>

            <Button
              type="submit"
              disabled={isUploading || !formData.name || files.length === 0}
              className="w-full h-10"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : status === "success" ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Uploaded
                </span>
              ) : (
                "Start Ingestion"
              )}
            </Button>

            {status === "success" && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                className="w-full text-xs"
              >
                Ingest Another Document
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
