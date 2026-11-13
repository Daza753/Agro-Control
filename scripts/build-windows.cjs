const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { isIP } = require('node:net');
const { loadEnv } = require('vite');
const { version } = require('../package.json');

const root = path.resolve(__dirname, '..');
const outputRoot = path.join('build_windows', `Version_${version}`);
const stagingRoot = path.join(os.tmpdir(), `fincacontrol-${version}-${process.pid}`);

function configureProductionApi(target) {
  const env = loadEnv('production', root, 'VITE_');
  const isPortable = target === 'portable';
  const variable = isPortable ? 'VITE_API_URL_PORTABLE' : 'VITE_API_URL_INSTALLER';
  const apiUrl = process.env[variable]?.trim()
    || env[variable]?.trim()
    || (isPortable && (process.env.VITE_API_URL?.trim() || env.VITE_API_URL?.trim()))
    || 'https://agro-control-7f5z.onrender.com';
  if (!apiUrl) {
    throw new Error(`Configura ${variable} con la dirección accesible de la API de FincaControl.`);
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(apiUrl);
  } catch (error) {
    throw new Error(`${variable} debe ser una URL válida.`, { cause: error });
  }
  const hostname = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isLoopback = hostname === 'localhost'
    || hostname === '0.0.0.0'
    || hostname === '::1'
    || (isIP(hostname) === 4 && hostname.startsWith('127.'));
  if (!['http:', 'https:'].includes(parsedUrl.protocol)
    || isLoopback
    || parsedUrl.username
    || parsedUrl.password) {
    throw new Error(
      `${variable} debe usar HTTP o HTTPS, no incluir credenciales ni apuntar a localhost o una dirección loopback.`,
    );
  }
  if (parsedUrl.search || parsedUrl.hash) {
    throw new Error(`${variable} no debe incluir parámetros de consulta ni fragmentos.`);
  }
  process.env.VITE_API_URL = apiUrl.replace(/\/$/, '');
  if (parsedUrl.protocol !== 'https:') {
    console.warn(`Aviso: ${variable} usa HTTP. En producción, se recomienda HTTPS.`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32' && command !== process.execPath,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} terminó con código ${result.status ?? 'desconocido'}.`);
  }
}

try {
  run(process.execPath, ['scripts/generate-icon.js']);
  run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    'scripts/generate-installer-assets.ps1',
  ]);
  fs.mkdirSync(stagingRoot, { recursive: true });
  const userManual = path.join(stagingRoot, 'Manual_Usuario_FincaControl.docx');
  run(process.execPath, ['scripts/update-word-documents.mjs', '--manual-only', userManual]);
  const installerStaging = path.join(stagingRoot, 'Instalador');
  const portableStaging = path.join(stagingRoot, 'Portable');
  const releaseOutput = path.join(root, outputRoot);
  const installerOutput = path.join(root, outputRoot, 'Instalador');
  const portableOutput = path.join(root, outputRoot, 'Portable');
  fs.mkdirSync(releaseOutput, { recursive: true });
  fs.mkdirSync(installerOutput, { recursive: true });
  fs.mkdirSync(portableOutput, { recursive: true });

  configureProductionApi('installer');
  run('npm', ['run', 'build']);
  run('npx', [
    'electron-builder',
    'build',
    '--win',
    'nsis',
    '--x64',
    `--config.directories.output=${installerStaging}`,
  ]);

  configureProductionApi('portable');
  run('npm', ['run', 'build']);
  run('npx', [
    'electron-builder',
    'build',
    '--win',
    'portable',
    '--x64',
    `--config.directories.output=${portableStaging}`,
  ]);
  const installer = fs.readdirSync(installerStaging)
    .find((file) => file.endsWith('.exe') && file.includes('Setup'));
  const portable = fs.readdirSync(portableStaging)
    .find((file) => file.endsWith('.exe') && !file.includes('Setup'));
  if (!installer || !portable) {
    throw new Error('No se encontraron el instalador NSIS y el ejecutable portable generados.');
  }
  if (!fs.existsSync(userManual)) {
    throw new Error('No se encontró el manual de usuario actualizado para incluirlo en la compilación.');
  }
  for (const file of fs.readdirSync(installerStaging)) {
    if (file === installer || file.endsWith('.blockmap') || file.endsWith('.yml')) {
      fs.copyFileSync(path.join(installerStaging, file), path.join(installerOutput, file));
    }
  }
  for (const file of fs.readdirSync(portableStaging)) {
    if (file === portable || file.endsWith('.blockmap')) {
      fs.copyFileSync(path.join(portableStaging, file), path.join(portableOutput, file));
    }
  }
  const manualName = path.basename(userManual);
  fs.copyFileSync(userManual, path.join(releaseOutput, manualName));
  fs.copyFileSync(userManual, path.join(installerOutput, manualName));
  fs.copyFileSync(userManual, path.join(portableOutput, manualName));
  fs.rmSync(stagingRoot, { recursive: true, force: true });
  console.log(`\nInstalador: ${path.join(outputRoot, 'Instalador')}`);
  console.log(`Ejecutable portable: ${path.join(outputRoot, 'Portable')}`);
  console.log(`Manual de usuario: ${outputRoot}`);
} catch (error) {
  console.error(`\nNo se pudo completar la compilación para Windows: ${error.message}`);
  process.exitCode = 1;
}
