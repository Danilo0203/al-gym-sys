import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const shellRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(shellRoot, "..", "..", "..");
const apiRoot = path.join(repoRoot, "api-local");
const stagingRoot = path.join(repoRoot, "installer", "windows", "staging");

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function assertFileExists(target, message) {
  try {
    await fs.access(target);
  } catch {
    throw new Error(`${message}\nMissing: ${target}`);
  }
}

async function main() {
  await run("npm", ["run", "build:windows:api"], apiRoot);

  await assertFileExists(
    path.join(stagingRoot, "ProgramFiles", "AllGym", "api-local", "dist", "server.js"),
    "The staged api-local bundle was not generated."
  );

  await assertFileExists(
    path.join(stagingRoot, "ProgramFiles", "AllGym", "winsw", "allgym-api-local.exe"),
    "The WinSW binary is required to build the installer. Copy WinSW-x64.exe to installer/windows/winsw/allgym-api-local.exe first."
  );

  await assertFileExists(
    path.join(stagingRoot, "ProgramFiles", "AllGym", "runtime", "node", "node.exe"),
    "The Windows Node runtime is required to build the installer. Copy node.exe to installer/windows/runtime/node/node.exe first."
  );

  await assertFileExists(
    path.join(stagingRoot, "ProgramFiles", "AllGym", "templates", "api-local.env.example"),
    "The api-local env template is missing from the staged installer payload."
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
