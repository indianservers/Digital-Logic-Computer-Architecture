const esbuild=require('../node_modules/esbuild');
const fs=require('fs');
const out=esbuild.buildSync({entryPoints:['src/studios/how-devices-work/advanced/data.ts'],bundle:true,platform:'node',format:'cjs',write:false});
fs.writeFileSync('tmp/device-definitions.cjs',out.outputFiles[0].text);
const {ADVANCED_LABS}=require('./device-definitions.cjs');
console.log('Initialized '+ADVANCED_LABS.length+' definitions');
console.log(JSON.stringify(ADVANCED_LABS.filter(l=>l.number>=75&&l.number<=94).map(l=>({number:l.number,parts:l.parts})),null,2));
