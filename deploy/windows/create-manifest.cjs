const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const [rootArg, version, frontend, backend] = process.argv.slice(2);
const root = path.resolve(rootArg);
const files = [];
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (full === path.join(root, 'build-manifest.json')) continue;
    if (entry.isSymbolicLink()) throw new Error('El paquete no debe depender de enlaces externos: ' + full);
    if (entry.isDirectory()) visit(full);
    else if (entry.isFile()) files.push({ path: path.relative(root, full).split(path.sep).join('/'),
      sha256: createHash('sha256').update(fs.readFileSync(full)).digest('hex') });
  }
}
visit(root);
fs.writeFileSync(path.join(root, 'build-manifest.json'), JSON.stringify({ version, platform: 'win-x64',
  frontend, backend, builtAt: new Date().toISOString(), files }, null, 2));
console.log('Manifiesto de integridad: ' + files.length + ' archivos.');
