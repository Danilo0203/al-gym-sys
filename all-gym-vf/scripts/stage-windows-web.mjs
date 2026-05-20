import fs from "node:fs/promises";
import path from "node:path";

const webRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(webRoot, "..");
const stagingRoot = path.join(repoRoot, "installer", "windows", "staging");
const programFilesRoot = path.join(stagingRoot, "ProgramFiles", "AllGym");
const programDataRoot = path.join(stagingRoot, "ProgramData", "AllGym");

async function copy(src, dest) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.cp(src, dest, { recursive: true });
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readManifest() {
  const manifestPath = path.join(stagingRoot, "manifest.json");
  if (!(await exists(manifestPath))) {
    return {
      generatedAt: new Date().toISOString(),
      stageRoot: stagingRoot,
      programFilesRoot,
      programDataRoot,
    };
  }

  return JSON.parse(await fs.readFile(manifestPath, "utf8"));
}

async function main() {
  const standaloneRoot = path.join(webRoot, ".next", "standalone");
  const staticRoot = path.join(webRoot, ".next", "static");
  const publicRoot = path.join(webRoot, "public");
  const installScriptsRoot = path.join(repoRoot, "installer", "windows", "scripts");
  const winswSourceRoot = path.join(repoRoot, "installer", "windows", "winsw");
  const webEnvTemplateSource = path.join(repoRoot, "installer", "windows", "templates", "allgym-web.env.example");

  const webStageRoot = path.join(programFilesRoot, "allgym-web");
  const scriptsStageRoot = path.join(programFilesRoot, "scripts");
  const winswStageRoot = path.join(programFilesRoot, "winsw");
  const templatesStageRoot = path.join(programFilesRoot, "templates");
  const configStageRoot = path.join(programDataRoot, "config");
  const logsStageRoot = path.join(programDataRoot, "logs");

  await fs.mkdir(webStageRoot, { recursive: true });
  await fs.mkdir(configStageRoot, { recursive: true });
  await fs.mkdir(logsStageRoot, { recursive: true });

  await copy(standaloneRoot, webStageRoot);
  await copy(staticRoot, path.join(webStageRoot, ".next", "static"));

  if (await exists(publicRoot)) {
    await copy(publicRoot, path.join(webStageRoot, "public"));
  }

  await copy(installScriptsRoot, scriptsStageRoot);
  await copy(winswSourceRoot, winswStageRoot);
  await copy(webEnvTemplateSource, path.join(configStageRoot, "allgym-web.env.example"));
  await copy(webEnvTemplateSource, path.join(templatesStageRoot, "allgym-web.env.example"));

  const manifest = await readManifest();
  manifest.generatedAt = new Date().toISOString();
  manifest.web = {
    serviceName: "allgym-web",
    entrypoint: "ProgramFiles/AllGym/allgym-web/server.js",
    winswConfig: "ProgramFiles/AllGym/winsw/allgym-web.xml",
    winswBinaryPresent: await exists(path.join(winswSourceRoot, "allgym-web.exe")),
    staticAssets: "ProgramFiles/AllGym/allgym-web/.next/static",
    publicAssets: "ProgramFiles/AllGym/allgym-web/public",
    envTemplate: "ProgramData/AllGym/config/allgym-web.env.example",
    envTemplateInProgramFiles: "ProgramFiles/AllGym/templates/allgym-web.env.example",
    startScript: "ProgramFiles/AllGym/scripts/start-allgym-web.ps1",
  };

  await fs.writeFile(path.join(stagingRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
