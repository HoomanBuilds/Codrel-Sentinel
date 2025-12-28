export const IGNORE_LIST: Set<string> = new Set<string>([
  // core
  ".git",
  ".DS_Store",
  ".idea",
  ".vscode",
  ".cache",
  "dist",
  "build",
  "out",
  "target",
  "__pycache__",
  "*.log",

  // node
  "node_modules",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",

  // bun
  "bun.lock",
  "bun.lockb",

  // python
  "venv",
  "poetry.lock",
  "Pipfile.lock",

  // go
  "go.sum",
  "go.work",

  // rust
  "Cargo.lock",
  "target",

  // java
  ".gradle",
  ".mvn",

  // env
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",

  // misc
  "coverage",
  ".next",
  ".turbo",
  ".vercel"
]);

export const BINARY_EXT: Set<string> = new Set<string>([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".tiff", ".tif",
  ".pdf", ".zip", ".gz", ".tar", ".tgz", ".xz",
  ".mp3", ".mp4", ".mov", ".avi", ".mkv", ".wav", ".flac",
  ".exe", ".dll", ".so", ".bin", ".dylib", ".wasm",
  ".woff", ".woff2", ".ttf", ".otf"
]);
