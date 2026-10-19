#!/usr/bin/env python3
"""Export the current two worktrees without private config, data, or dependencies."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile


def export(frontend, backend, destination):
    if destination.exists():
        raise ValueError('El archivo de salida ya existe; elija otro nombre.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    roots = [(frontend, 'al-gym-sys', ('all-gym-vf/', 'gym-sync-server/', 'deploy/windows/')),
             (backend, 'algym-local-backend', ('src/', 'windows/', 'database/migrations/',
              'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json'))]
    with zipfile.ZipFile(destination, 'x', zipfile.ZIP_DEFLATED) as archive:
        for root, name, allowed in roots:
            files = subprocess.check_output(['git', '-C', str(root), 'ls-files', '-z', '--cached',
                                             '--others', '--exclude-standard']).decode().split('\0')
            selected = []
            hashes = {}
            for file in sorted(set(files)):
                if not file or not any(file.startswith(p) if p.endswith('/') else file == p for p in allowed):
                    continue
                parts = Path(file).parts
                if any(p in ('node_modules', '.next', '.git', 'data', 'backups', 'build', 'dist', '.agents', '.codex')
                       or p.startswith('.env') for p in parts):
                    continue
                source = root / file
                if not source.is_file() or source.is_symlink():
                    continue
                content = source.read_bytes()
                archive.writestr(name + '/' + file, content)
                selected.append(file)
                hashes[file] = hashlib.sha256(content).hexdigest()
            revision = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD']).decode().strip()
            archive.writestr(name + '/.windows-source.json', json.dumps({
                'revision': revision, 'files': selected, 'sha256': hashes}, indent=2))
    return hashlib.sha256(destination.read_bytes()).hexdigest()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    frontend = Path(__file__).resolve().parents[2]
    print(export(frontend, args.backend.resolve(), args.output.resolve()))
