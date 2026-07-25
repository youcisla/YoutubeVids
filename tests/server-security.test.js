const test = require('node:test');
const assert = require('node:assert/strict');

const { app } = require('../ui/server.cjs');

function startServer() {
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('session token stays in an HttpOnly SameSite cookie', async t => {
  const server = await startServer();
  t.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/session`);
  assert.equal(response.status, 204);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /^edu_action=[^;]+; HttpOnly; SameSite=Strict; Path=\/api$/);
  assert.equal(await response.text(), '');
});

test('mutating endpoints reject requests without session cookie', async t => {
  const server = await startServer();
  t.after(() => server.close());
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const configResponse = await fetch(`${base}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(configResponse.status, 403);

  const buildResponse = await fetch(`${base}/api/build?book=atomic-habits&chapter=1`);
  assert.equal(buildResponse.status, 403);
});
