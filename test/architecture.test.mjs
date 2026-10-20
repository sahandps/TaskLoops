import esbuild from 'esbuild';
import { readdir } from 'node:fs/promises';
import { createSuite } from './harness.mjs';

export default async function run() {
 const { eq, results } = createSuite('module dependency boundaries');
 const bundleInputs = async (entryPoints, external = []) => {
  const result = await esbuild.build({
   entryPoints, outdir: 'test/.architecture-output', bundle: true, write: false,
   format: 'esm', platform: 'neutral', mainFields: ['module', 'main'],
   external, metafile: true, logLevel: 'silent',
  });
  return Object.keys(result.metafile.inputs);
 };
 const coreFiles = (await readdir('src/core')).filter(name => name.endsWith('.ts')).map(name => 'src/core/' + name);
 const coreInputs = await bundleInputs(coreFiles);
 eq(coreInputs.filter(path => !path.startsWith('src/core/')), [], 'core runs without GUI, vault or vendor dependencies');
 const serviceInputs = await bundleInputs(['src/application/task-service.ts'], ['obsidian']);
 eq(serviceInputs.some(path => path.startsWith('src/gui/')), false, 'task service never loads GUI modules');
 const guiInputs = await bundleInputs(['src/gui/views/taskloops-view.ts'], ['obsidian']);
 eq(guiInputs.some(path => path === 'src/main.ts' || path === 'src/application/task-service.ts'), false, 'shared GUI does not load the production plugin or write service');
 return results;
}
