import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
if (!process.argv[2]) throw new Error('Pass the completed performance run directory');
const runRoot = resolve(process.argv[2]);
const registry = JSON.parse(await readFile('registry.json', 'utf8'));
const capture = JSON.parse(await readFile('docs/data/SSR-HIZ-CAPTURES.json', 'utf8'));
const measurements = [];
for (const entry of registry.performance.hiz.entries) {
  const result = JSON.parse(await readFile(resolve(runRoot, entry.renderer, entry.scene, 'metrics.json'), 'utf8'));
  const { completedFrames, elapsed } = result.throughput ?? {};
  if (result.status !== 'ok' || !(completedFrames > 0) || !(elapsed >= 10) || completedFrames % 16 !== 0)
    throw new Error(`Incomplete throughput result: ${entry.scene}/${entry.renderer}`);
  const adapter = result.environment?.gpuAdapter;
  if (!adapter?.vendor || /swiftshader|llvmpipe|lavapipe|software|basic render/i.test(JSON.stringify(adapter)))
    throw new Error('Physical GPU required');
  const flags = result.environment.chromeFlags;
  if (!flags.includes('--disable-gpu-vsync') || !flags.includes('--disable-frame-rate-limit'))
    throw new Error('Frame caps must be disabled');
  measurements.push({
    scene: entry.scene,
    renderer: entry.renderer,
    completedFrames,
    elapsedSeconds: elapsed,
    fps: completedFrames / elapsed,
    gpuAdapter: adapter,
  });
}
for (const row of measurements) {
  const mode = row.renderer.includes('-mirror-') ? 'mirror' : 'ggx';
  const control = measurements.find(
    (other) => other.scene === row.scene && other.renderer === `three-hiz-${mode}-linear`,
  );
  if (!control) throw new Error(`Missing control: ${row.scene}/${mode}`);
  row.ratioVsLinear = row.fps / control.fps;
}
const aggregate = [...new Set(measurements.map((row) => row.renderer))].map((renderer) => {
  const rows = measurements.filter((row) => row.renderer === renderer);
  return {
    renderer,
    scenes: rows.length,
    geometricMeanRatio: Math.exp(rows.reduce((sum, row) => sum + Math.log(row.ratioVsLinear), 0) / rows.length),
    minRatio: Math.min(...rows.map((row) => row.ratioVsLinear)),
    maxRatio: Math.max(...rows.map((row) => row.ratioVsLinear)),
  };
});
const report = {
  forkCommit: capture.forkCommit,
  runDirectory: process.argv[2].replaceAll('\\', '/'),
  browser: capture.browser,
  quality: 0.5,
  width: 480,
  height: 360,
  protocol:
    'GPU-completed end-to-end throughput; 1-second warmup; 16-frame batches and queue drains; 10-second windows; sequential cases; vsync and frame caps disabled',
  repeats: 1,
  aggregate,
  measurements,
};
await writeFile('docs/data/SSR-HIZ-PERFORMANCE.json', JSON.stringify(report, null, 2) + '\n');
console.log('| Variant | Geometric mean throughput vs linear | Min | Max |\n| --- | ---: | ---: | ---: |');
for (const row of aggregate)
  console.log(
    `| ${row.renderer} | ${row.geometricMeanRatio.toFixed(3)}× | ${row.minRatio.toFixed(3)}× | ${row.maxRatio.toFixed(3)}× |`,
  );
