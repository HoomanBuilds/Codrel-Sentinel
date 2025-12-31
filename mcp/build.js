import esbuild from "esbuild";

esbuild.build({
  entryPoints: ["src/server/mcp-stdio.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "./mcp-stdio.js",
})
.then(() => console.log("Bundle OK"))
.catch(() => process.exit(1));
