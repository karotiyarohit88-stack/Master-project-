import { AICategory } from '../types';

export function generateSandboxSimulation(prompt: string, category: AICategory): string {
  const lower = prompt.toLowerCase();

  if (category === 'database' || lower.includes('database') || lower.includes('sql') || lower.includes('schema')) {
    return `### 🗄️ Master Database Planning Blueprint

**Target Architecture:** PostgreSQL 16 (Relational & Normalized)  
**Schema Pattern:** Multi-Tenant Row-Level Security (RLS) with Audit Log Isolation

#### 1. Core Schema Definition

\`\`\`sql
-- Enable cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants isolation table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    plan_tier VARCHAR(32) DEFAULT 'standard' CHECK (plan_tier IN ('standard', 'pro', 'enterprise')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization users with multi-tenant foreign key
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable audit log for safety & compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- High-performance composite indexes
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);
\`\`\`

#### 2. Data Integrity & Migration Safeguards
- **Zero-Downtime Indexing:** Use \`CREATE INDEX CONCURRENTLY\` for production migrations.
- **Transactional Migrations:** Wrap schema changes in strict transaction blocks (\`BEGIN ... COMMIT\`).
- **Connection Pooling:** Recommend PgBouncer with transaction-mode pooling (limit 20 connections per pod).`;
  }

  if (category === 'worker_agent' || lower.includes('worker') || lower.includes('sub-agent') || lower.includes('delegate')) {
    return `### 🤖 Sub-Agent Delegation Plan & Mission Brief

**Target Worker Role:** \`Worker-Agent-SecurityAuditor-01\`  
**Designated Scope:** Automated Security Reviews & Secret Leak Prevention  
**Coordinator:** Master Project AI Agent

#### 1. Mission Specification
- **Primary Objective:** Inspect pull requests, dependency manifests, and infrastructure code for security vulnerabilities, OWASP Top 10 breaches, and hardcoded secrets.
- **Authority Boundary:** Advisory and static analysis only. **Zero mutation permissions** on live production clusters or databases.

#### 2. Input & Output Contract
\`\`\`json
{
  "agent_id": "worker-security-auditor",
  "input_payload": {
    "git_diff": "diff --git a/server.ts b/server.ts",
    "dependency_manifest": "package.json",
    "target_environment": "staging"
  },
  "required_output_artifacts": [
    "cve_vulnerability_matrix.json",
    "secret_scanning_verdict.md",
    "least_privilege_rbac_audit.json"
  ],
  "safety_constraints": {
    "network_access": "Sandboxed internal registry only",
    "human_approval_required": true
  }
}
\`\`\`

#### 3. Delegation Workflow
1. Master Project AI Agent provisions an ephemeral sandbox.
2. Worker Agent ingests AST and dependency graph.
3. Worker runs semantic security rule engines.
4. Worker delivers structured audit verdict to Master Agent.
5. Master Agent summarizes findings and requests human operator review.`;
  }

  if (category === 'software_design' || lower.includes('architect') || lower.includes('design')) {
    return `### 📐 Software Architecture & System Design

**System Pattern:** Event-Driven Microservices with Asynchronous Message Queue  
**Throughput Target:** 15,000 requests/sec with sub-50ms p95 latency

#### 1. ASCII Architecture Diagram
\`\`\`text
[ Client Applications / Mobile ]
               │
               ▼
   [ API Gateway / Cloudflare ]
               │  (JWT Validation & Rate Limiting)
               ▼
     ┌────────────────────────────────────────────────────────┐
     │           Master Orchestration Service                 │
     └─────────┬───────────────────────────────┬──────────────┘
               │                               │
       (HTTP / gRPC)                   (Event Stream)
               ▼                               ▼
    ┌──────────────────────┐        ┌──────────────────────┐
    │   Core App Service   │        │ Apache Kafka / PubSub│
    └──────────┬───────────┘        └──────────┬───────────┘
               │                               │
               ▼                               ▼
    ┌──────────────────────┐        ┌──────────────────────┐
    │ PostgreSQL (Primary) │        │ Asynchronous Workers │
    └──────────────────────┘        └──────────────────────┘
\`\`\`

#### 2. Architectural Pillars
- **Decoupled Event Stream:** Use RabbitMQ or Google Cloud Pub/Sub for background jobs.
- **Circuit Breaker Pattern:** Implement Resilience4j or Polly patterns with 3-second fallback timeouts.
- **Idempotency Keys:** Every mutation request enforces unique UUID header to prevent duplicate processing.`;
  }

  if (category === 'deployment' || lower.includes('deploy') || lower.includes('docker') || lower.includes('ci/cd')) {
    return `### 🚀 Deployment Plan & Container Pipeline

**Platform:** Google Cloud Run / Container Registry  
**Rollout Strategy:** Canary Rollout (10% -> 50% -> 100%) with automated error-rate rollback

#### 1. Production Dockerfile (Multi-Stage)
\`\`\`dockerfile
# Stage 1: Build & Optimize
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Minimal Distroless / Alpine Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
\`\`\`

#### 2. Rollback Verification Safeguard
- If HTTP 5xx error rate exceeds 0.5% during the 10-minute canary phase, automated rollback triggers instantly.
- Database migrations are backward-compatible (expand before contract).`;
  }

  if (category === 'security' || lower.includes('security') || lower.includes('owasp')) {
    return `### 🛡️ Security Review & Threat Modeling

**Standard:** OWASP Top 10 (2025/2026 Edition)  
**Threat Model:** Zero-Trust Identity Boundary & Defensive Programming

#### 1. Security Checklist
- [x] **A01: Broken Access Control:** Enforce server-side role validation on every API endpoint. Never rely on frontend claims.
- [x] **A02: Cryptographic Failures:** Argon2id or bcrypt (cost factor >= 12) for credentials. TLS 1.3 enforced.
- [x] **A03: Injection Defense:** 100% parameterized queries via modern ORM or prepared statements.
- [x] **A04: Insecure Design:** Strict rate limiting (100 req/min per IP) and account lockout after 5 consecutive failures.
- [x] **A05: Security Misconfiguration:** Helmet.js HTTP headers enabled (\`Content-Security-Policy\`, \`X-Frame-Options\`).`;
  }

  // Default Programming / Testing response
  return `### 💻 Master Project AI Agent: Solution Plan

**Category:** Programming & Implementation  
**Status:** Verification Sandbox Ready

#### 1. Implementation
\`\`\`typescript
export interface ExecutionContext {
  taskId: string;
  timestamp: string;
  isSandboxed: boolean;
}

export class TaskRunner {
  private activeTasks: Map<string, ExecutionContext> = new Map();

  async executeTask(taskId: string, payload: unknown): Promise<{ verified: boolean; result: unknown }> {
    console.log(\`[Master Agent] Initializing task: \${taskId}\`);
    // Pre-flight validation
    this.activeTasks.set(taskId, {
      taskId,
      timestamp: new Date().toISOString(),
      isSandboxed: true
    });

    // Clean execution with verifiable telemetry
    return {
      verified: true,
      result: { status: 'completed', payload }
    };
  }
}
\`\`\`

#### 2. Key Highlights
- Type-safe implementation with explicit interfaces.
- Sandboxed execution tracking to ensure no unverified claims.
- Ready for integration with future worker agents.`;
}
