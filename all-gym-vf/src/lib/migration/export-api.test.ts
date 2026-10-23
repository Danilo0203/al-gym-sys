import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createExportApi } from "./export-api";
import { ExportVault } from "./export-vault";

function setup() {
  let now = Date.now(); const vault = new ExportVault(() => now);
  const calls: { path: string; token: string | null; method: string; body?: string }[] = [];
  let rejection = 0;
  const handle = createExportApi({ vault, owner: async request => request.headers.get("x-owner"), remote: async(path,token,method,body) => {
    calls.push({path,token,method,body});
    if(path==="/health") return Response.json({nativeLogin:true});
    if(path==="/session") return Response.json({accessToken:"private.remote.token",expiresAt:now+3600000});
    if(rejection) return Response.json({error:"Denied"},{status:rejection});
    return Response.json({job:null});
  } });
  async function request(path: string, method="GET", body?: unknown, cookie="", owner: string|null="local-owner:session-one", origin="http://127.0.0.1:3000") {
    const headers: Record<string,string>={host:"127.0.0.1:3000",origin,"content-type":"application/json",cookie};
    if(owner) headers["x-owner"]=owner;
    return handle(new NextRequest("http://127.0.0.1:3000/api/windows-export"+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),{params:Promise.resolve({segments:path.slice(1).split("/")})});
  }
  return {request,calls,vault,advance:()=>{now+=3600001;},revoke:()=>{rejection=401;}};
}
test("only a local owner from the same origin can connect; credentials stay in the HTTPS request",async()=>{
  const s=setup();const credentials={email:"owner@example.test",password:"private-password"};
  assert.equal((await s.request("/session","GET",undefined,"",null)).status,403);assert.equal(s.calls.length,0);
  assert.equal((await s.request("/session","POST",credentials,"","owner","http://localhost:3000")).status,403);
  assert.equal((await s.request("/session","POST",{...credentials,url:"http://evil"})).status,400);
  assert.equal((await s.request("/session","POST",{...credentials,password:"x".repeat(5000)})).status,413);
  const response=await s.request("/session","POST",credentials);assert.equal(response.status,200);
  const body=await response.text();assert.equal(body.includes("private"),false);
  const cookie=response.headers.get("set-cookie")!;assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=strict/i);
  assert.equal(cookie.includes("private.remote.token"),false);assert.equal(cookie.includes("private-password"),false);
  const id=cookie.split(";")[0];
  assert.equal((await s.request("/jobs","GET",undefined,id)).status,200);
  assert.equal(s.calls.at(-1)?.token,"private.remote.token");
  assert.equal((await s.request("/jobs","GET",undefined,id,"local-owner:session-two")).status,401);
  assert.equal((await s.request("/jobs","GET",undefined,id,"other-owner:session-one")).status,401);
  assert.equal((await s.request("/jobs","GET",undefined,id)).status,200);
});
test("expiry, disconnect and remote revocation invalidate access; paths are confined",async()=>{
  for(const operation of ["expire","disconnect","revoke"]){
    const s=setup();const login=await s.request("/session","POST",{email:"owner@example.test",password:"password"});
    const cookie=login.headers.get("set-cookie")!.split(";")[0];
    if(operation==="expire")s.advance();
    if(operation==="disconnect")assert.equal((await s.request("/session","DELETE",undefined,cookie)).status,200);
    if(operation==="revoke")s.revoke();
    assert.equal((await s.request("/jobs","GET",undefined,cookie)).status,401);
    const status=await s.request("/session","GET",undefined,cookie);
    assert.equal((await status.json()).connected,false);
  }
  const s=setup();assert.equal((await s.request("/admin")).status,404);
  assert.equal((await s.request("/jobs/file","POST",{})).status,404);assert.equal(s.calls.length,0);
});
