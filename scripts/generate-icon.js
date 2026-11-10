import fs from 'fs';
import path from 'path';
import pngToIco from 'png-to-ico';

const src = path.resolve('public/images/logo.png');
const out = path.resolve('electron/icon.ico');

const buffer = fs.readFileSync(src);
pngToIco(buffer).then((ico) => {
  fs.writeFileSync(out, ico);
  console.log(`Generated icon: ${out}`);
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
