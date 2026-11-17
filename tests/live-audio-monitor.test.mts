/*************************************************
 * Regression: LiveAudioMonitor must not spam ws://localhost
 * from public origins
 *
 * The live-audio bridge is a LOCAL companion service (:8090). On the
 * production site the monitor tried ws://localhost:8090 from every
 * visitor's browser and auto-reconnected every 10s forever, flooding
 * the console. It must only auto-connect on localhost (or an explicit
 * NEXT_PUBLIC_LIVE_AUDIO_WS_URL) and cap auto-reconnects. (v0.67.8)
 *************************************************/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/components/LiveAudioMonitor.tsx'), 'utf8');

test('live audio monitor gates connection to local hosts (or explicit env URL)', () => {
  assert.match(src, /NEXT_PUBLIC_LIVE_AUDIO_WS_URL/, 'must allow an explicit WS URL override');
  assert.match(src, /localhost/, 'must detect localhost before connecting');
  assert.match(src, /MAX_AUTO_RECONNECTS|attemptsRef/, 'auto-reconnect must be capped');
});
