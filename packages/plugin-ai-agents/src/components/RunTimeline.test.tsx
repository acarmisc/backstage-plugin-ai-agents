import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { RunTimelineView } from './RunTimeline';

test('RunTimelineView orders OTel events by sequence number', () => {
  const html = renderToString(
    <RunTimelineView
      run={{ runId: 'trace-1', agent: 'dinesh', target: '42', state: 'running' }}
      events={[
        { seq: 1, name: 'dinesh:get_mr_details', event: 'get_mr_details', tool: 'get_mr_details', outcome: 'ok' },
        { seq: 0, name: 'dinesh:start', event: 'start' },
        { seq: 2, name: 'dinesh:completed', event: 'completed' },
      ]}
    />,
  );
  assert.match(html, /Working on 42/);
  assert.ok(html.indexOf('Run started') < html.indexOf('get_mr_details'));
  assert.ok(html.indexOf('get_mr_details') < html.indexOf('Run completed'));
});

test('RunTimelineView displays tool errors and incomplete completion', () => {
  const html = renderToString(
    <RunTimelineView
      events={[
        { seq: 0, name: 'dinesh:start', event: 'start' },
        { seq: 1, name: 'dinesh:post_note', event: 'post_note', outcome: 'GitlabError' },
        { seq: 2, name: 'dinesh:completed', event: 'completed', incomplete: 'invocation_failed' },
      ]}
    />,
  );
  assert.match(html, /GitlabError/);
  assert.match(html, /Completed: invocation_failed/);
});
