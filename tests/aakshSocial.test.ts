import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createUnifiedWorkspaceRouter } from '../unifiedWorkspaces.ts';

const TENANT_A = '11111111-2222-4333-8444-555555555555';
const TENANT_B = '99999999-2222-4333-8444-555555555555';
const POST_ID = '2c4c3d4e-5f60-4a71-8b92-123456789abc';

class SocialDb {
  tenant = TENANT_A;
  posts: any[] = [];
  likes: any[] = [];
  comments: any[] = [];
  queries: Array<{ sql: string; values: unknown[] }> = [];

  async query(sql: string, values: unknown[] = []) {
    this.queries.push({ sql: sql.replace(/\\s+/g, ' ').trim(), values });
    if (/INSERT INTO aaksh_social_posts/.test(sql)) {
      const post = { id: POST_ID, tenant_id: values[0], author_user_id: values[1], body: values[2], created_at: new Date().toISOString() };
      this.posts.push(post);
      return { rows: [{ id: post.id, author_user_id: post.author_user_id, body: post.body, created_at: post.created_at }] };
    }
    if (/SELECT p\.id, p\.author_user_id, p\.body/.test(sql)) {
      return { rows: this.posts.filter(p => p.tenant_id === values[0] && !p.deleted_at).map(p => ({
        id: p.id, author_user_id: p.author_user_id, body: p.body, created_at: p.created_at,
        likes_count: this.likes.filter(x => x.tenant_id === p.tenant_id && x.post_id === p.id).length,
        comments_count: this.comments.filter(x => x.tenant_id === p.tenant_id && x.post_id === p.id).length,
        liked_by_me: this.likes.some(x => x.tenant_id === p.tenant_id && x.post_id === p.id && x.user_id === values[1])
      })) };
    }
    if (/SELECT id FROM aaksh_social_posts/.test(sql)) {
      return { rows: this.posts.some(p => p.id === values[0] && p.tenant_id === values[1] && !p.deleted_at) ? [{ id: POST_ID }] : [] };
    }
    if (/DELETE FROM aaksh_social_likes/.test(sql)) {
      const index = this.likes.findIndex(x => x.tenant_id === values[0] && x.post_id === values[1] && x.user_id === values[2]);
      if (index < 0) return { rows: [] };
      this.likes.splice(index, 1);
      return { rows: [{ post_id: POST_ID }] };
    }
    if (/INSERT INTO aaksh_social_likes/.test(sql)) {
      if (!this.likes.some(x => x.tenant_id === values[0] && x.post_id === values[1] && x.user_id === values[2])) this.likes.push({ tenant_id: values[0], post_id: values[1], user_id: values[2] });
      return { rows: [] };
    }
    if (/SELECT COUNT\(\*\)::int AS count FROM aaksh_social_likes/.test(sql)) {
      return { rows: [{ count: this.likes.filter(x => x.tenant_id === values[0] && x.post_id === values[1]).length }] };
    }
    if (/SELECT id, author_user_id, body, created_at FROM aaksh_social_comments/.test(sql)) {
      return { rows: this.comments.filter(x => x.tenant_id === values[0] && x.post_id === values[1]) };
    }
    if (/INSERT INTO aaksh_social_comments/.test(sql)) {
      const post = this.posts.find(x => x.id === values[1] && x.tenant_id === values[0] && !x.deleted_at);
      if (!post) return { rows: [] };
      const comment = { id: 'comment-1', tenant_id: values[0], post_id: values[1], author_user_id: values[2], body: values[3], created_at: new Date().toISOString() };
      this.comments.push(comment);
      return { rows: [{ id: comment.id, author_user_id: comment.author_user_id, body: comment.body, created_at: comment.created_at }] };
    }
    if (/UPDATE aaksh_social_posts SET deleted_at/.test(sql)) {
      const post = this.posts.find(x => x.id === values[0] && x.tenant_id === values[1] && !x.deleted_at && (x.author_user_id === values[2] || values[3] === true));
      if (!post) return { rows: [] };
      post.deleted_at = new Date().toISOString();
      return { rows: [{ id: post.id }] };
    }
    return { rows: [] };
  }
}

async function withServer(tenantId: string, role: 'owner' | 'admin' | 'member', run: (url: string, db: SocialDb) => Promise<void>) {
  const db = new SocialDb();
  const routers = createUnifiedWorkspaceRouter({ pool: db as any });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.authSession = { id: 'user-123', role: 'owner' };
    res.locals.tenantContext = { tenantId, role };
    next();
  });
  app.use('/api/aaksh/social', routers.social);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  try { await run('http://127.0.0.1:' + address.port, db); }
  finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

test('AAKSH social post, feed, likes and comments use shared tenant-scoped PostgreSQL', async () => withServer(TENANT_A, 'member', async (url, db) => {
  const created = await fetch(url + '/api/aaksh/social/posts', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Shared social workspace' })
  });
  assert.equal(created.status, 201);
  const post = (await created.json() as any).post;
  assert.equal(post.text, 'Shared social workspace');
  assert.equal(db.posts[0].tenant_id, TENANT_A);

  const feed = await fetch(url + '/api/aaksh/social/feed');
  assert.equal(feed.status, 200);
  assert.equal((await feed.json() as any).posts.length, 1);

  const liked = await fetch(url + '/api/aaksh/social/posts/' + POST_ID + '/like', { method: 'POST' });
  assert.equal(liked.status, 200);
  assert.equal((await liked.json() as any).likes, 1);

  const comment = await fetch(url + '/api/aaksh/social/posts/' + POST_ID + '/comments', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Looks good' })
  });
  assert.equal(comment.status, 201);
  assert.equal(db.comments[0].tenant_id, TENANT_A);
}));

test('AAKSH social routes do not reveal or mutate another tenant posts', async () => {
  const db = new SocialDb();
  db.posts.push({ id: POST_ID, tenant_id: TENANT_A, author_user_id: 'user-a', body: 'Private to tenant A', created_at: new Date().toISOString() });
  const routers = createUnifiedWorkspaceRouter({ pool: db as any });
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.authSession = { id: 'user-b', role: 'owner' };
    res.locals.tenantContext = { tenantId: TENANT_B, role: 'owner' };
    next();
  });
  app.use('/api/aaksh/social', routers.social);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const url = 'http://127.0.0.1:' + address.port;
  try {
    const feed = await fetch(url + '/api/aaksh/social/feed');
    assert.equal((await feed.json() as any).posts.length, 0);
    const comment = await fetch(url + '/api/aaksh/social/posts/' + POST_ID + '/comments', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Cross tenant attempt' })
    });
    assert.equal(comment.status, 404);
    const like = await fetch(url + '/api/aaksh/social/posts/' + POST_ID + '/like', { method: 'POST' });
    assert.equal(like.status, 404);
    assert.equal(db.likes.length, 0);
    assert.equal(db.comments.length, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  }
});
