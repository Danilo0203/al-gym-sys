from pathlib import Path
import os,re,socket,threading,time,json,gzip,hashlib,base64,secrets
import paramiko
root=Path(__file__).resolve().parent.parent
state=root/'native-fixtures';state.mkdir(mode=0o700,exist_ok=True)
key=paramiko.RSAKey.generate(2048);client=paramiko.RSAKey.generate(2048)
client.write_private_key_file(str(state/'test_identity'));(state/'test_identity').chmod(0o600)
known=f'[10.211.55.2]:18737 {key.get_name()} {key.get_base64()}\n'
(state/'known_hosts').write_text(known)
wrong=paramiko.RSAKey.generate(2048)
(state/'wrong_hosts').write_text(f'[10.211.55.2]:18737 {wrong.get_name()} {wrong.get_base64()}\n')
events=[];lock=threading.Lock()
def event(value):
 with lock:
  events.append(value);(state/'events.json').write_text(json.dumps(events,indent=2))
pattern=re.compile(r"bash -o pipefail -c 'printf %s ([A-Za-z0-9+/=]+) \| base64 --decode \| bash -s -- ([a-f0-9]{32})'\Z")
def fixture(job):
 folder=state/job;folder.mkdir(exist_ok=False)
 data=gzip.compress(json.dumps({'testOnly':True,'jobId':job}).encode());digest=hashlib.sha256(data).hexdigest()
 summary={'jobId':job,'source':{'kind':'Hostinger'},'clockCommandQueue':0,'sha256':digest,'snapshotAt':'2026-10-22T12:00:00Z','customers':2,'plans':1,'payments':3,'attendance':4}
 (folder/'Hostinger-AlGym.algym.partial').write_bytes(data)
 for name in ['RESUMEN.json','VERIFICACION.json']:(folder/name).write_text(json.dumps(summary))
 files=['Hostinger-AlGym.algym.partial','RESUMEN.json','VERIFICACION.json']
 (folder/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256((folder/n).read_bytes()).hexdigest()+'  '+n+'\n' for n in files))
 return folder
def resolve(path):
 m=re.fullmatch(r'/root/algym-exportaciones/windows-([a-f0-9]{32})/para-windows(?:/(Hostinger-AlGym\.algym\.partial|RESUMEN\.json|VERIFICACION\.json|SHA256SUMS\.txt))?/?',path)
 if not m:raise FileNotFoundError()
 p=state/m[1]
 if m[2]:p=p/m[2]
 return p
def legacy(channel,folder):
 try:
  if channel.recv(1)!=b'\0':raise RuntimeError('ack')
  for f in sorted(folder.iterdir()):
   data=f.read_bytes();channel.sendall(f'C0600 {len(data)} {f.name}\n'.encode())
   if channel.recv(1)!=b'\0':raise RuntimeError('ack header')
   channel.sendall(data+b'\0')
   if channel.recv(1)!=b'\0':raise RuntimeError('ack data')
  channel.send_exit_status(0)
 except Exception as e:event({'legacyError':str(e)});channel.send_exit_status(1)
 finally:channel.close()
class Server(paramiko.ServerInterface):
 def check_auth_publickey(self,username,public):
  return paramiko.AUTH_SUCCESSFUL if username=='root' and public==client else paramiko.AUTH_FAILED
 def get_allowed_auths(self,username):return 'publickey'
 def check_channel_request(self,kind,chanid):return paramiko.OPEN_SUCCEEDED if kind=='session' else paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED
 def check_channel_exec_request(self,channel,command):
  text=command.decode('utf8');m=pattern.fullmatch(text)
  if m:
   expected=(root/'Herramientas-Hostinger/Exportar-Hostinger.sh').read_bytes()
   if base64.b64decode(m[1])!=expected:event({'payloadMismatch':True});return False
   fixture(m[2]);event({'execVerified':True,'job':m[2]})
   def finish():
    channel.sendall(b'COPIA DE PRUEBA LISTA\n');channel.send_exit_status(0);channel.close()
   threading.Thread(target=finish,daemon=True).start();return True
  m=re.fullmatch(r'scp -f (/root/algym-exportaciones/windows-[a-f0-9]{32}/para-windows)/\*',text)
  if m:
   event({'transport':'legacy-scp'})
   threading.Thread(target=legacy,args=(channel,resolve(m[1])),daemon=True).start();return True
  event({'unexpectedCommand':text[:120]});return False
class Handle(paramiko.SFTPHandle):
 def stat(self):return paramiko.SFTPAttributes.from_stat(os.fstat(self.readfile.fileno()))
class Sftp(paramiko.SFTPServerInterface):
 def list_folder(self,path):
  try:
   out=[]
   for f in resolve(path).iterdir():
    a=paramiko.SFTPAttributes.from_stat(f.stat());a.filename=f.name;out.append(a)
   event({'transport':'sftp'});return out
  except OSError:return paramiko.SFTP_NO_SUCH_FILE
 def stat(self,path):
  try:return paramiko.SFTPAttributes.from_stat(resolve(path).stat())
  except OSError:return paramiko.SFTP_NO_SUCH_FILE
 lstat=stat
 def open(self,path,flags,attr):
  event({'open':path,'flags':flags})
  if flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT):return paramiko.SFTP_PERMISSION_DENIED
  try:
   h=Handle(flags);h.readfile=resolve(path).open('rb');return h
  except OSError:return paramiko.SFTP_NO_SUCH_FILE
 def canonicalize(self,path):return path
class SftpSubsystem(paramiko.SFTPServer):
 def __init__(self,channel,*args,**kwargs):
  self.test_channel=channel;super().__init__(channel,*args,**kwargs)
 def finish_subsystem(self):
  self.test_channel.send_exit_status(0);super().finish_subsystem()
def serve(sock):
 t=paramiko.Transport(sock);t.add_server_key(key);t.set_subsystem_handler('sftp',SftpSubsystem,Sftp)
 try:
  t.start_server(server=Server())
  while t.is_active():time.sleep(.25)
 except Exception as e:event({'serverError':str(e)[:100]})
 finally:t.close()
s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('10.211.55.2',18737));s.listen(5)
print('Servidor SSH aislado de prueba listo.',flush=True)
while True:
 sock,addr=s.accept()
 if not addr[0].startswith('10.211.55.'):sock.close();continue
 threading.Thread(target=serve,args=(sock,),daemon=True).start()
