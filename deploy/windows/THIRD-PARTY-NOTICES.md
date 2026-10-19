# Componentes redistribuidos

El paquete contiene Node.js (licencia MIT y avisos de sus dependencias), PostgreSQL
(PostgreSQL License y bibliotecas adicionales), WinSW 2.12.0 (MIT) y Microsoft Visual
C++ Redistributable (términos de redistribución de Microsoft). Los módulos npm
conservan sus licencias en los directorios de dependencias del paquete.

- Node.js: https://nodejs.org/en/about/previous-releases
- PostgreSQL para Windows: https://www.postgresql.org/download/windows/
- Distribución binaria EDB: https://www.enterprisedb.com/download-postgresql-binaries
- WinSW: https://github.com/winsw/winsw/tree/v2.12.0
- Microsoft: https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist

`vendors.json` fija las versiones, URL y hashes SHA-256. El hash de Node.js procede
del SHASUMS256 oficial. Los de WinSW, EDB y Microsoft se calcularon sobre las
descargas de sus distribuidores; el build comprueba además la firma Authenticode
de Microsoft. Actualizar conscientemente el manifiesto al cambiar una dependencia.

WinSW Copyright (c) 2008-2020, Kohsuke Kawaguchi, Sun Microsystems, Inc., CloudBees,
Inc., Oleg Nenashev and other contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
