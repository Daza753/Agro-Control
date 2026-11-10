const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const buildDirs = [
  'build_electron',
  'build_electron_portable',
  'build_electron_portable2',
  'build_windows',
];

function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`Removed ${dir}`);
  } catch (error) {
    console.warn(`Unable to remove ${dir}:`, error.message);
  }
}

buildDirs.forEach((dir) => removeDir(path.join(projectRoot, dir)));
console.log('Electron cleanup complete.');
