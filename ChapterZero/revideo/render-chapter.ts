/**
 * render-chapter.ts — actually invokes @revideo/renderer.renderVideo().
 * Called by render-chapter.mjs with parsed CLI args. Kept as TypeScript
 * because the renderer API is fully typed and we get the variables manifest
 * typed end-to-end.
 */
import { renderVideo } from '@revideo/renderer';
import * as path from 'node:path';
import * as fs from 'node:fs';

interface CliArgs {
  project: string;
  out: string;
  workers: number;
  variables: Record<string, unknown>;
}

function parseArgs(): CliArgs {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) {
      args[process.argv[i].slice(2)] = process.argv[i + 1] ?? '';
    }
  }
  const variablesPath = args['variables-file'];
  const variablesInline = args.variables;
  let variables: Record<string, unknown> = {};
  if (variablesPath) {
    variables = JSON.parse(fs.readFileSync(path.resolve(variablesPath), 'utf8'));
  } else if (variablesInline) {
    variables = JSON.parse(variablesInline);
  }
  return {
    project: args.project,
    out: args.out,
    workers: Number(args.workers ?? '1'),
    variables,
  };
}

async function main() {
  const { project, out, workers, variables } = parseArgs();
  // ponytail: Vite's import-of-absolute-path breaks on Windows backslashes
  // (\ interpreted as escape). Always pass forward slashes.
  const absProject = path.resolve(project).replace(/\\/g, '/');
  const absOut = path.resolve(out).replace(/\\/g, '/');
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  console.log(`[revideo] rendering ${absProject}`);
  console.log(`[revideo]   → ${absOut}`);
  console.log(`[revideo]   workers=${workers} vars=${Object.keys(variables).join(',')}`);

  // ponytail: Vite dep optimization on first hit reloads the page mid-navigation,
  // which Puppeteer reports as "Navigating frame was detached". The renderer
  // itself retries the goto up to 5x with networkidle0 — we just call once and
  // let the inner retry handle it.
  const t0 = Date.now();
  const finalPath = await renderVideo({
    projectFile: absProject,
    variables,
    settings: {
      outFile: absOut as `${string}.mp4`,
      workers,
      logProgress: true,
      // ponytail: appType:'custom' disables Vite's HMR client + full-page-reload
      // plumbing entirely. optimizeDeps.disabled skips dep discovery so Vite
      // never triggers its reload cycle. Together they make page.goto safe
      // against "Navigating frame was detached".
      viteConfig: {
        appType: 'custom',
        optimizeDeps: { disabled: true },
      },
    },
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[revideo] ✓ done in ${elapsed}s → ${finalPath}`);
}

main().catch((err) => {
  console.error('[revideo] failed:', err);
  process.exit(1);
});
