import ava from 'ava';

import { requireIdempotencyKey } from '../../plugins/payment/resolver';

const test = ava;

test('requireIdempotencyKey should use header key when provided', t => {
  const key = requireIdempotencyKey('header-key', 'legacy-key');
  t.is(key, 'header-key');
});

test('requireIdempotencyKey should fallback to legacy key', t => {
  const key = requireIdempotencyKey(undefined, 'legacy-key');
  t.is(key, 'legacy-key');
});

test('requireIdempotencyKey should reject empty keys', t => {
  const error = t.throws(() => requireIdempotencyKey('   ', undefined));
  t.is(error?.message, 'Idempotency key is required.');
});
