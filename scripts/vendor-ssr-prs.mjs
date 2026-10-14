import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
const directory = 'packages/renderers/src/ssr-pr';
const sources = JSON.parse(await readFile(`${directory}/sources.json`, 'utf8'));
for (const source of sources.filter((item) => item.number !== 34)) {
  if (!/^[a-f0-9]{40}$/.test(source.headRefOid)) throw new Error('Invalid source commit');
  const args = ['-C', 'submodules/three-pr34', 'show', `${source.headRefOid}:examples/jsm/tsl/display/SSRNode.js`];
  const original =
    process.platform === 'win32'
      ? execFileSync('cmd.exe', ['/d', '/s', '/c', `git-dedup.cmd ${args.join(' ')}`], { encoding: 'utf8' })
      : execFileSync('git-dedup', args, { encoding: 'utf8' });
  const code = original
    .replaceAll("'three/", "'three-dev/")
    .replaceAll("'../utils/", "'three-dev/addons/tsl/utils/")
    .replaceAll("'./boxBlur.js'", "'three-dev/addons/tsl/display/boxBlur.js'")
    .replaceAll(
      "'./ImportanceSampledEnvironment.js'",
      "'three-dev/addons/tsl/display/ImportanceSampledEnvironment.js'",
    );
  await writeFile(
    `${directory}/SSRNode-pr${source.number}.js`,
    `// MIT Three.js SSRNode from ${source.url} @ ${source.headRefOid}.\n/* oxlint-disable no-shadow -- preserve upstream shader variable names */\n${code}`,
  );
}
