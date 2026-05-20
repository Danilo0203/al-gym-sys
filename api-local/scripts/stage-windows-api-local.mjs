import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const apiRoot = path.resolve(import.meta.dirname, "..");
const stagingRoot = path.join(repoRoot, "installer", "windows", "staging");
const programFilesRoot = path.join(stagingRoot, "ProgramFiles", "AllGym");
const programDataRoot = path.join(stagingRoot, "ProgramData", "AllGym");

async function resetDir(target) {
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
}

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

async function main() {
  const apiStageRoot = path.join(programFilesRoot, "api-local");
  const scriptsStageRoot = path.join(programFilesRoot, "scripts");
  const winswStageRoot = path.join(programFilesRoot, "winsw");
  const runtimeStageRoot = path.join(programFilesRoot, "runtime");
  const templatesStageRoot = path.join(programFilesRoot, "templates");
  const configStageRoot = path.join(programDataRoot, "config");
  const logsStageRoot = path.join(programDataRoot, "logs");
  const dataStageRoot = path.join(programDataRoot, "data");
  const uploadsStageRoot = path.join(programDataRoot, "uploads");
  const backupsStageRoot = path.join(programDataRoot, "backups");
  const runtimeSourceRoot = path.join(repoRoot, "installer", "windows", "runtime");
  const winswSourceRoot = path.join(repoRoot, "installer", "windows", "winsw");
  const envTemplateSource = path.join(repoRoot, "installer", "windows", "templates", "api-local.env.example");

  await resetDir(stagingRoot);

  await copy(path.join(apiRoot, "dist"), path.join(apiStageRoot, "dist"));
  await copy(path.join(apiRoot, "node_modules"), path.join(apiStageRoot, "node_modules"));
  await copy(path.join(apiRoot, "package.json"), path.join(apiStageRoot, "package.json"));
  await copy(path.join(apiRoot, "package-lock.json"), path.join(apiStageRoot, "package-lock.json"));
  await copy(path.join(apiRoot, "README.md"), path.join(apiStageRoot, "README.md"));
  await copy(envTemplateSource, path.join(configStageRoot, "api-local.env.example"));
  await copy(envTemplateSource, path.join(templatesStageRoot, "api-local.env.example"));
  await copy(path.join(repoRoot, "installer", "windows", "scripts"), scriptsStageRoot);
  await copy(winswSourceRoot, winswStageRoot);

  if (await exists(runtimeSourceRoot)) {
    await copy(runtimeSourceRoot, runtimeStageRoot);
  }

  await Promise.all([
    fs.mkdir(logsStageRoot, { recursive: true }),
    fs.mkdir(dataStageRoot, { recursive: true }),
    fs.mkdir(uploadsStageRoot, { recursive: true }),
    fs.mkdir(backupsStageRoot, { recursive: true })
  ]);

  const manifest = {
    generatedAt: new Date().toISOString(),
    stageRoot: stagingRoot,
    programFilesRoot,
    programDataRoot,
    apiLocal: {
      serviceName: "allgym-api-local",
      entrypoint: "ProgramFiles/AllGym/api-local/dist/server.js",
      winswConfig: "ProgramFiles/AllGym/winsw/allgym-api-local.xml",
      winswBinaryPresent: await exists(path.join(winswSourceRoot, "allgym-api-local.exe")),
      nodeRuntimePresent: await exists(path.join(runtimeSourceRoot, "node", "node.exe")),
      envTemplate: "ProgramData/AllGym/config/api-local.env.example",
      envTemplateInProgramFiles: "ProgramFiles/AllGym/templates/api-local.env.example",
      startScript: "ProgramFiles/AllGym/scripts/start-api-local.ps1"
    }
  };

  await fs.writeFile(path.join(stagingRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
