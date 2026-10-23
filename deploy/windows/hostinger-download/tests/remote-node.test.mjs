import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const shell=await readFile(path.join(root,'Herramientas-Hostinger/Exportar-Hostinger.sh'),'utf8');
const block=shell.split("<<'ALGYM_NODE'\n")[1].split('\nALGYM_NODE')[0];
for (const scenario of ['ok','wrong-user','wrong-pg','wrong-hash','commands','migrations','pipeline-error','missing-job','invalid-job']) {
 test('exportador remoto: '+scenario,async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'algym-export-unit-'));
  try {
   const config={source:{user:scenario==='wrong-user'?'postgres':'algym_export_reader',password:'test-secret-never-print'},pgBin:scenario==='wrong-pg'?'/wrong':'/usr/lib/postgresql/17/bin'};
   await writeFile(path.join(dir,'config.json'),JSON.stringify(config));
   await writeFile(path.join(dir,'pipeline.mjs'),`export async function buildExport(){if(process.env.TEST_CASE==='pipeline-error')throw new Error('test-secret-never-print');return {sha256:'a'.repeat(64)}}`);
   await writeFile(path.join(dir,'transfer.mjs'),`export async function readPackage(){return {sha256:process.env.TEST_CASE==='wrong-hash'?'b'.repeat(64):'a'.repeat(64),data:{migrations:['same'],tables:[{schema:'public',name:'device_commands',rows:process.env.TEST_CASE==='commands'?[[1]]:[]}],source:{kind:'Hostinger'}}}}
export async function migrationHashes(){return process.env.TEST_CASE==='migrations'?['different']:['same']}
export function summary(data,sha256){return {sha256,snapshotAt:'2026-10-22T12:00:00Z',customers:2,plans:1,payments:3,attendance:4}}`);
   let code=block.replace("'/app/hostinger/pipeline.mjs'",JSON.stringify(pathToFileURL(path.join(dir,'pipeline.mjs')).href)).replace("'/app/windows/transfer.mjs'",JSON.stringify(pathToFileURL(path.join(dir,'transfer.mjs')).href));
   code=code.replaceAll("'/run/algym/export.json'",JSON.stringify(path.join(dir,'config.json'))).replaceAll("'/data/export'",JSON.stringify(dir)).replaceAll("'/data/export/data.algym'",JSON.stringify(path.join(dir,'data.algym'))).replaceAll("'/data/export/RESUMEN.json'",JSON.stringify(path.join(dir,'RESUMEN.json')));
   const script=path.join(dir,'run.mjs');await writeFile(script,code);
   const env={...process.env,TEST_CASE:scenario,ALGYM_EXPORT_JOB:scenario==='invalid-job'?'bad':'a'.repeat(32)};
   if(scenario==='missing-job')delete env.ALGYM_EXPORT_JOB;
   const result=spawnSync(process.execPath,[script],{env,encoding:'utf8',timeout:10000});
   assert.ok(!(result.stdout+result.stderr).includes('test-secret-never-print'));
   if(scenario==='ok'){
    assert.equal(result.status,0,result.stderr);const report=JSON.parse(await readFile(path.join(dir,'RESUMEN.json'),'utf8'));assert.equal(report.jobId,'a'.repeat(32));assert.equal(report.clockCommandQueue,0);assert.match(report.notice,/0\.3\.5/);
   } else {assert.equal(result.status,1);await assert.rejects(readFile(path.join(dir,'RESUMEN.json')));}
  } finally {await rm(dir,{recursive:true,force:true});}
 });
}
test('bash válido y no ejecutable por error en macOS',()=>{
 assert.equal(spawnSync('/bin/bash',['-n',path.join(root,'Herramientas-Hostinger/Exportar-Hostinger.sh')]).status,0);
 if(process.platform==='darwin'){
  const r=spawnSync('/bin/bash',[path.join(root,'Herramientas-Hostinger/Exportar-Hostinger.sh'),'a'.repeat(32)],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/VPS Linux/);
 }
});
