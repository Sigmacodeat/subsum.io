module.exports = {
  '*': 'prettier --write --ignore-unknown --cache',
  '*.{ts,tsx,mjs,js,jsx}': [
    'prettier --ignore-unknown --write',
    'cross-env NODE_OPTIONS="--max-old-space-size=8192" eslint --cache --fix --max-warnings=0',
  ],
  '*.toml': ['taplo format'],
  '*.rs': ['cargo fmt --'],
};
