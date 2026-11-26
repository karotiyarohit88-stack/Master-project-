import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTenantKnowledgeDocument,
  deleteTenantKnowledgeDocument,
  listTenantKnowledgeDocuments,
  searchTenantKnowledgeDocuments,
  type TenantKnowledgePool
} from '../server/tenantKnowledge.ts';

const OWNER_A = '11111111-1111-4111-8111-111111111111';
const OWNER_B = '22222222-2222-4222-8222-222222222222';
const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function fakePool() {
  const rows: any[] = [];
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const pool: TenantKnowledgePool = {
    connect: async () => ({
      query: async (sql: string, values: unknown[] = []) => {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        calls.push({ sql: normalized, values });
        if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(normalized) || normalized.startsWith('SELECT set_config')) return { rows: [] };
        if (normalized.startsWith('INSERT INTO tenant_knowledge_documents')) {
          const row = { id: values[0], owner_id: values[1], tenant_id: values[2], title: values[3], source: values[4], content: values[5], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
          rows.push(row);
          return { rows: [row] };
        }
        if (normalized.startsWith('SELECT id, title, source, created_at')) {
          return { rows: rows.filter(row => row.owner_id === values[0] && row.tenant_id === values[1]).slice(0, Number(values[2])) };
        }
        if (normalized.startsWith('SELECT id, title, source, left(content')) {
          return { rows: rows.filter(row => row.owner_id === values[0] && row.tenant_id === values[1] && row.content.toLowerCase().includes(String(values[2]).toLowerCase())).slice(0, Number(values[3])).map(row => ({ ...row, rank: 0.5 })) };
        }
        if (normalized.startsWith('DELETE FROM tenant_knowledge_documents')) {
          const index = rows.findIndex(row => row.id === values[0] && row.owner_id === values[1] && row.tenant_id === values[2]);
          if (index < 0) return { rows: [] };
          const [removed] = rows.splice(index, 1);
          return { rows: [{ id: removed.id }] };
        }
        throw new Error('Unexpected SQL: ' + normalized);
      },
      release: () => undefined
    })
  };
  return { pool, rows, calls };
}

test('RAG documents are created, listed, retrieved and deleted within one Owner tenant', async () => {
  const { pool, rows, calls } = fakePool();
  const a = await createTenantKnowledgeDocument(OWNER_A, TENANT_A, 'Tenant A guide', 'private architecture details', 'owner_upload', pool);
  await createTenantKnowledgeDocument(OWNER_B, TENANT_B, 'Tenant B guide', 'separate billing details', 'owner_upload', pool);
  const listedA = await listTenantKnowledgeDocuments(OWNER_A, TENANT_A, 10, pool);
  const searchA = await searchTenantKnowledgeDocuments(OWNER_A, TENANT_A, 'architecture', 5, pool);
  const searchB = await searchTenantKnowledgeDocuments(OWNER_B, TENANT_B, 'architecture', 5, pool);
  assert.deepEqual(listedA.map(row => row.title), ['Tenant A guide']);
  assert.equal(searchA[0].content, 'private architecture details');
  assert.deepEqual(searchB, []);
  assert.equal(await deleteTenantKnowledgeDocument(OWNER_A, TENANT_A, a.id, pool), true);
  assert.equal(rows.length, 1);
  for (const call of calls.filter(item => /tenant_knowledge_documents/.test(item.sql) && /^(SELECT|DELETE)/.test(item.sql))) {
    assert.match(call.sql, /owner_id = \$\d+ AND tenant_id = \$\d+/);
  }
});

test('RAG document ingestion rejects oversized or missing content', async () => {
  const { pool } = fakePool();
  await assert.rejects(() => createTenantKnowledgeDocument(OWNER_A, TENANT_A, '', 'content', 'owner_upload', pool));
  await assert.rejects(() => createTenantKnowledgeDocument(OWNER_A, TENANT_A, 'Large', 'x'.repeat(100_001), 'owner_upload', pool));
});
