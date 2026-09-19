import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Entity } from '@backstage/catalog-model';
import {
  buildInvocationArgs,
  buildInvocationTags,
  buildPrompt,
  fillTemplate,
  makeThreadId,
  normalizeSessionId,
} from './invocation';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'dinesh',
    annotations: {
      'ai-agent.io/prompt-template': 'Review MR !{target} in {project}',
    },
  },
  spec: { type: 'ai-agent' },
};

test('fillTemplate substitutes known placeholders and leaves unknown ones', () => {
  assert.equal(
    fillTemplate('Review {target} in {project} ({missing})', { target: '42', project: 'x' }),
    'Review 42 in x ({missing})',
  );
});

test('buildPrompt renders the template, falling back to a JSON dump', () => {
  assert.equal(buildPrompt(entity, { target: '42', project: 'x' }), 'Review MR !42 in x');
  const bare: Entity = { ...entity, metadata: { ...entity.metadata, annotations: {} } };
  assert.equal(buildPrompt(bare, { a: '1' }), JSON.stringify({ a: '1' }, null, 2));
});

test('buildInvocationArgs defaults post=false for dry-run and true for action=post', () => {
  assert.equal(buildInvocationArgs({ action: 'dry-run' }).post, false);
  assert.equal(buildInvocationArgs({}).post, false);
  assert.equal(buildInvocationArgs({ action: 'post' }).post, true);
  assert.equal(buildInvocationArgs({ post: 'true' }).post, true);
});

test('buildInvocationArgs honors an explicit request-level override', () => {
  assert.equal(buildInvocationArgs({ action: 'dry-run' }, { post: true }).post, true);
  assert.equal(buildInvocationArgs({ action: 'post' }, { post: false }).post, false);
});

test('buildInvocationArgs carries target/project/model/mode', () => {
  const args = buildInvocationArgs({
    target: 'CES-1',
    project: 'innovation/x',
    model: 'sonnet-5',
    mode: 'reviewer',
  });
  assert.equal(args.target, 'CES-1');
  assert.equal(args.project, 'innovation/x');
  assert.equal(args.model, 'sonnet-5');
  assert.equal(args.mode, 'reviewer');
});

test('normalizeSessionId is deterministic, >=33 chars, and AgentCore-safe', () => {
  const a = normalizeSessionId('component:default/dinesh-abc');
  const b = normalizeSessionId('component:default/dinesh-abc');
  assert.equal(a, b);
  assert.ok(a.length >= 33, `len ${a.length}`);
  assert.match(a, /^[a-z0-9-]+$/);
  assert.notEqual(a, normalizeSessionId('component:default/dinesh-def'));
});

test('makeThreadId embeds the entity name and a timestamp', () => {
  const id = makeThreadId('dinesh', () => 'rand');
  assert.match(id, /^dinesh-/);
});

test('buildInvocationTags includes channel, session, user and entity', () => {
  const tags = buildInvocationTags({
    threadId: 't1',
    userRef: 'user:default/jane',
    entityRef: 'component:default/dinesh',
  });
  assert.deepEqual(tags, [
    'channel:backstage',
    'session:t1',
    'invoked-by:user:default/jane',
    'backstage-entity:component:default/dinesh',
  ]);
});

test('buildInvocationTags omits the user tag when unknown', () => {
  const tags = buildInvocationTags({ threadId: 't1', entityRef: 'component:default/x' });
  assert.deepEqual(tags, ['channel:backstage', 'session:t1', 'backstage-entity:component:default/x']);
});
