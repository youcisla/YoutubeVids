#!/usr/bin/env node
/**
 * yt-auth.mjs — One-time YouTube OAuth2 authorization.
 * Opens a browser, you log in, it prints a refresh token.
 * Put the token in .env as YT_REFRESH_TOKEN.
 *
 * Prereq: Create OAuth credentials at
 *   https://console.cloud.google.com/apis/credentials
 *   Application type: "Desktop app"
 *   Enable YouTube Data API v3
 *   Add yourself as a Test User
 *
 * Usage:
 *   YT_CLIENT_ID=xxx YT_CLIENT_SECRET=yyy node scripts/yt-auth.mjs
 */
import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';

const clientId = process.env.YT_CLIENT_ID;
const clientSecret = process.env.YT_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set YT_CLIENT_ID and YT_CLIENT_SECRET env vars first.');
  process.exit(1);
}

const redirectUri = 'http://localhost:3000';
const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
const scope = ['https://www.googleapis.com/auth/youtube.upload'];

const authUrl = oauth2.generateAuthUrl({ access_type: 'offline', scope, prompt: 'consent' });
console.log('\nOpen this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for callback on http://localhost:3000 ...\n');

const server = http.createServer(async (req, res) => {
  const { searchParams } = new URL(req.url, redirectUri);
  const code = searchParams.get('code');
  if (!code) { res.writeHead(400); res.end('No code'); return; }

  const { tokens } = await oauth2.getToken(code);
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Done — close this tab.</h1>');
  console.log('═'.repeat(60));
  console.log('Add this to your .env:\n');
  console.log(`YT_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('═'.repeat(60));
  server.close();
  process.exit(0);
}).listen(3000, () => {
  import('open').then(m => m.default(authUrl)).catch(() => {});
});
