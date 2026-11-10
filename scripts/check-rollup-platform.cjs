const os = require('node:os');

const platformPackages = {
  'win32-x64': '@rollup/rollup-win32-x64-msvc',
  'win32-arm64': '@rollup/rollup-win32-arm64-msvc',
  'linux-x64': '@rollup/rollup-linux-x64-gnu',
  'linux-arm64': '@rollup/rollup-linux-arm64-gnu',
  'darwin-x64': '@rollup/rollup-darwin-x64',
  'darwin-arm64': '@rollup/rollup-darwin-arm64',
};

const key = `${process.platform}-${os.arch()}`;
const packageName = platformPackages[key];

if (!packageName) {
  console.error(`No hay una comprobación configurada para Rollup en ${key}.`);
  process.exit(1);
}

try {
  require.resolve(packageName);
} catch {
  console.error(
    `Falta el binario nativo de Rollup para ${key} (${packageName}). `
    + 'Las dependencias parecen instaladas para otro sistema operativo. '
    + 'En WSL, usa una copia del proyecto dentro del sistema de archivos Linux '
    + '(por ejemplo, ~/projects), no /mnt/c: npm ci puede fallar allí con ENOTEMPTY. '
    + 'Desde esa copia ejecuta "npm ci" y luego "npm run dev". '
    + 'Al volver a compilar para Windows, ejecuta "npm ci" desde PowerShell '
    + 'y después "npm run build:windows". No reutilices node_modules de Windows y WSL.',
  );
  process.exit(1);
}
