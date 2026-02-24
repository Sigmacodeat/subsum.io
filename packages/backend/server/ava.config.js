const newE2E = process.env.TEST_MODE === 'e2e';
const newE2ETests = './src/__tests__/e2e/**/*.spec.ts';

const preludes = ['./src/prelude.ts'];

if (newE2E) {
  preludes.push('./src/__tests__/e2e/prelude.ts');
}

export default {
  timeout: '1m',
  extensions: {
    ts: 'module',
  },
  nodeArguments: [
    '--loader=ts-node/esm',
    '--experimental-specifier-resolution=node',
  ],
  watchMode: {
    ignoreChanges: ['**/*.gen.*'],
  },
  files: newE2E
    ? [newE2ETests]
    : ['**/*.spec.ts', '**/*.e2e.ts', '!' + newE2ETests],
  require: preludes,
  environmentVariables: {
    TS_NODE_PROJECT: './tsconfig.json',
    TS_NODE_TRANSPILE_ONLY: '1',
    TS_NODE_CACHE: 'false',
    NODE_ENV: 'test',
    DEPLOYMENT_TYPE: 'affine',
    MAILER_HOST: '0.0.0.0',
    MAILER_PORT: '1025',
    MAILER_USER: 'noreply@toeverything.info',
    MAILER_PASSWORD: 'affine',
    MAILER_SENDER: 'noreply@toeverything.info',
  },
};
