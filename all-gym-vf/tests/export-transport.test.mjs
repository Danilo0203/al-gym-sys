import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

test('transport verifies its configured certificate and hostname, and streams only allowed headers', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'algym-export-tls-'));
  const previous = { url:process.env.ALGYM_EXPORT_URL, ca:process.env.ALGYM_EXPORT_CA_BASE64 };
  let server;
  try {
    await writeFile(path.join(folder, 'openssl.cnf'), '[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=AlGym transport test\n[ext]\nsubjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\n');
    execFileSync('openssl', ['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-config',path.join(folder,'openssl.cnf'),'-keyout',path.join(folder,'key.pem'),'-out',path.join(folder,'cert.pem')], {stdio:'ignore'});
    const key = await readFile(path.join(folder,'key.pem')), cert = await readFile(path.join(folder,'cert.pem'));
    const source = await readFile(new URL('../src/lib/migration/export-transport.ts',import.meta.url),'utf8');
    await writeFile(path.join(folder,'transport.mjs'), ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
    const {requestExportService} = await import(pathToFileURL(path.join(folder,'transport.mjs')));
    let received;
    server = https.createServer({key,cert},(req,res)=>{received=req.headers.authorization;res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="test.algym"','X-Private-Header':'never-forward'});res.end('verified-package');});
    server.listen(0,'127.0.0.1'); await once(server,'listening');
    const port=server.address().port;
    process.env.ALGYM_EXPORT_URL=`https://127.0.0.1:${port}/`; process.env.ALGYM_EXPORT_CA_BASE64=cert.toString('base64');
    const response=await requestExportService('/jobs','owner-session','GET');
    assert.equal(await response.text(),'verified-package'); assert.equal(received,'Bearer owner-session');
    assert.equal(response.headers.get('x-private-header'),null); assert.equal(response.headers.get('cache-control'),'no-store, private');
    process.env.ALGYM_EXPORT_URL=`https://localhost:${port}/`;
    await assert.rejects(requestExportService('/jobs','owner-session','GET'),error=>error.code==='ERR_TLS_CERT_ALTNAME_INVALID');
    process.env.ALGYM_EXPORT_URL=`http://127.0.0.1:${port}/`;
    await assert.rejects(requestExportService('/jobs','owner-session','GET'),/Configuración/);
    process.env.ALGYM_EXPORT_URL=`https://127.0.0.1:${port}/`; process.env.ALGYM_EXPORT_CA_BASE64=Buffer.from('not a certificate').toString('base64');
    await assert.rejects(requestExportService('/jobs','owner-session','GET'));
  } finally {
    server?.closeAllConnections(); if(server) await new Promise(resolve=>server.close(resolve));
    for(const [key,value] of [['ALGYM_EXPORT_URL',previous.url],['ALGYM_EXPORT_CA_BASE64',previous.ca]]) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
    await rm(folder,{recursive:true,force:true});
  }
});


test('same-origin protection preserves loopback hosts, protocol and port boundaries', async () => {
  const source = await readFile(new URL('../src/lib/migration/export-origin.ts',import.meta.url),'utf8');
  const compiled = ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const {isSameOriginExport} = await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
  const {NextRequest} = await import('next/server.js');
  const request = new NextRequest('http://127.0.0.1:3100/api/windows-export/jobs',{headers:{host:'127.0.0.1:3100',origin:'http://127.0.0.1:3100'}});
  assert.equal(request.nextUrl.hostname,'localhost');
  assert.equal(isSameOriginExport(request.headers.get('origin'),request.headers.get('host'),request.nextUrl.protocol),true);
  assert.equal(isSameOriginExport('http://localhost:3100','localhost:3100','http:'),true);
  assert.equal(isSameOriginExport('http://localhost:3100','127.0.0.1:3100','http:'),false);
  assert.equal(isSameOriginExport('http://127.0.0.1:3101','127.0.0.1:3100','http:'),false);
  assert.equal(isSameOriginExport('https://127.0.0.1:3100','127.0.0.1:3100','http:'),false);
  assert.equal(isSameOriginExport('https://evil.example','127.0.0.1:3100','http:'),false);
  assert.equal(isSameOriginExport(null,'127.0.0.1:3100','http:'),false);
  assert.equal(isSameOriginExport('null','127.0.0.1:3100','http:'),false);
});
