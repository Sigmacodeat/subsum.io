/// <reference path="./global.d.ts" />
import './prelude';

import { run as runCli } from './cli';
import { run as runServer } from './server';

try {
  // Ensure env is available before accessing it
  if (!globalThis.env) {
    throw new Error('Global env not initialized. Check prelude.ts execution order.');
  }

  if (env.flavors.script) {
    await runCli();
  } else {
    await runServer();
  }
} catch (error) {
  console.error('Fatal error during server startup:');
  console.error(error);
  if (error instanceof Error) {
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  } else {
    console.error('Non-Error object thrown:', JSON.stringify(error, null, 2));
  }
  process.exit(1);
}

export {};
