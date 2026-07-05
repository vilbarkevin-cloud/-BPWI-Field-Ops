import { resolveConfig } from "vite";
async function main() {
  const config = await resolveConfig({}, "serve");
  console.log("hmr:", config.server.hmr);
}
main();
