/**
 * E2E test: FlowChangePoller live polling with real Node-RED
 *
 * Prerequisites: Node-RED running on localhost:1880 with adminAuth configured
 * Run: bun scripts/e2e-poller-test.ts
 */
import { EventBus } from '../src/core/kernel/event-bus';
import { FlowManager } from '../src/plugins/nodered/services/FlowManager';
import { FlowChangePoller } from '../src/plugins/nodered/services/FlowChangePoller';
import type { NodeRedConfig, FlowChangeEvent } from '../src/plugins/nodered/types';

// Load config from disk (has the API token)
import * as fs from 'fs';
const configFile = JSON.parse(fs.readFileSync(process.env.HOME + '/.slashbot/nodered.json', 'utf8'));
const config: NodeRedConfig = {
  enabled: true,
  port: configFile.port ?? 1880,
  userDir: configFile.userDir ?? process.env.HOME + '/.slashbot/nodered',
  healthCheckInterval: 30,
  shutdownTimeout: 10,
  maxRestartAttempts: 3,
  localhostOnly: true,
  editorUsername: configFile.editorUsername,
  editorPasswordHash: configFile.editorPasswordHash,
  editorApiToken: configFile.editorApiToken,
};

// Minimal NodeRedManager stub for FlowManager
const managerStub = {
  getState: () => 'running' as const,
  getConfig: () => config,
};

// Test FlowManager directly first
async function testFlowManagerDirect(fm: FlowManager) {
  console.log('Testing FlowManager.listFlows() directly...');
  try {
    const flows = await fm.listFlows();
    console.log(`  listFlows: ${flows.length} flows found`);
    for (const f of flows) {
      console.log(`    - ${f.label} (${f.id}), nodes: ${f.nodeCount}`);
    }
  } catch (err) {
    console.error('  listFlows ERROR:', err);
  }

  console.log('Testing FlowManager.getFlowsRevisionHash() directly...');
  try {
    const hash = await fm.getFlowsRevisionHash();
    console.log(`  hash: ${hash}`);
  } catch (err) {
    console.error('  getFlowsRevisionHash ERROR:', err);
  }
}

async function main() {
  const eventBus = new EventBus();
  const flowManager = new FlowManager(managerStub as any, eventBus, process.env.HOME + '/.slashbot');
  const poller = new FlowChangePoller(flowManager, eventBus);

  // Listen for external change events
  let changeDetected = false;
  eventBus.subscribe('flow:external-change', (envelope: any) => {
    const event = envelope.payload as FlowChangeEvent;
    console.log('\n=== FLOW CHANGE DETECTED ===');
    console.log(`Previous hash: ${event.previousHash}`);
    console.log(`Current hash:  ${event.currentHash}`);
    console.log(`Changes:`);
    for (const change of event.changes) {
      console.log(`  - ${change.changeType}: ${change.flowId} (${change.label})`);
    }
    changeDetected = true;
  });

  // Step 0: Test FlowManager directly
  await testFlowManagerDirect(flowManager);

  // Step 1: Start poller
  console.log('\nStarting FlowChangePoller (15s interval)...');
  poller.start();

  // Step 2: Wait for baseline poll
  console.log('Waiting 18s for baseline poll...');
  await sleep(18_000);
  console.log(`Baseline hash set: ${poller.getLastHash()}`);

  // Step 3: Get auth token
  console.log('\nGetting auth token...');
  const tokenRes = await fetch('http://localhost:1880/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'client_id=node-red-admin&grant_type=password&scope=*&username=admin&password=testpass123',
  });
  const tokenData = await tokenRes.json() as { access_token: string };
  const token = tokenData.access_token;
  console.log('Token obtained.');

  // Step 4: Deploy a new flow (simulating editor action)
  const uniqueSuffix = Date.now().toString(36);
  const flowLabel = `mcp-poller-test-${uniqueSuffix}`;
  console.log(`\nDeploying new flow "${flowLabel}" via API...`);
  const deployRes = await fetch('http://localhost:1880/flow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      label: flowLabel,
      nodes: [
        { id: `pt-n1-${uniqueSuffix}`, type: 'http in', url: `/poller-test-${uniqueSuffix}`, method: 'get', wires: [[`pt-n2-${uniqueSuffix}`]] },
        { id: `pt-n2-${uniqueSuffix}`, type: 'http response' },
      ],
    }),
  });
  const deployText = await deployRes.text();
  console.log(`Deploy response (${deployRes.status}): ${deployText}`);
  const deployData = JSON.parse(deployText) as { id: string };
  console.log(`Flow ID: ${deployData.id}`);

  // Step 5: Wait for poller to detect the change (max 20s)
  console.log('\nWaiting up to 20s for poller to detect change...');
  const deadline = Date.now() + 20_000;
  while (!changeDetected && Date.now() < deadline) {
    await sleep(1000);
  }

  if (changeDetected) {
    console.log('\nE2E POLLER TEST: PASSED');
  } else {
    console.log(`\nLast hash after wait: ${poller.getLastHash()}`);
    console.log('E2E POLLER TEST: FAILED (no change detected within 20s)');
  }

  // Cleanup
  poller.stop();
  console.log('\nCleaning up test flow...');
  await fetch(`http://localhost:1880/flow/${deployData.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('Done.');
  process.exit(changeDetected ? 0 : 1);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('E2E test error:', err);
  process.exit(1);
});
