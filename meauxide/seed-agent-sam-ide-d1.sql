-- Seed: agent_sam IDE Assistant in D1 (agent_configs)
-- Database: inneranimalmedia-business (binding DB)
-- Run: wrangler d1 execute inneranimalmedia-business --file=meauxide/seed-agent-sam-ide-d1.sql --remote
--
-- Query before additions (optional): run this first to verify table and existing row:
--   SELECT id, name, slug, status, updated_at FROM agent_configs WHERE id = 'agent-sam-ide';

INSERT INTO agent_configs (
  id,
  tenant_id,
  name,
  slug,
  description,
  config_type,
  config_json,
  status,
  version,
  is_public,
  created_at,
  updated_at
) VALUES (
  'agent-sam-ide',
  'system',
  'agent_sam IDE Assistant',
  'agent-sam-ide',
  'Conversational AI assistant for MeauxIDE - helps with code, queries, deployments, and project management',
  'custom',
  '{
    "agent_type": "conversational",
    "model": "claude-sonnet-4-5-20250929",
    "temperature": 0.7,
    "max_tokens": 4000,
    "tools": [
      "r2_read_file",
      "r2_write_file",
      "r2_list_files",
      "d1_query",
      "cloudflare_deploy",
      "workers_ai_generate"
    ],
    "system_prompt": "You are agent_sam, the IDE assistant for MeauxIDE. You help Sam Primeaux and his team manage their multi-client Cloudflare infrastructure.\n\nYour capabilities:\n- Read/write files in R2 buckets\n- Execute D1 database queries\n- Deploy Workers and Pages\n- Generate code and content\n- Manage projects across workspaces\n- Answer questions about the infrastructure\n\nYour personality:\n- Helpful and conversational (not robotic)\n- Technically precise but explain clearly\n- Proactive about suggesting improvements\n- Remember context from the conversation\n\nCurrent infrastructure:\n- 6 active projects (Pelican Peptides, Southern Pets, etc.)\n- 32+ deployed workers\n- Multiple client workspaces\n- Full Cloudflare stack (Workers, D1, R2, Pages)\n\nWhen asked to do something:\n1. Understand the goal\n2. Ask clarifying questions if needed\n3. Execute or generate what''s needed\n4. Explain what you did and why\n\nBe conversational, not formal. Sam wants a colleague, not a ticket system.",
    "capabilities": [
      "File management (R2)",
      "Database queries (D1)",
      "Code generation",
      "Deployment assistance",
      "Project management",
      "Infrastructure monitoring"
    ],
    "constraints": [
      "Never delete production data without explicit confirmation",
      "Always verify before deploying to production",
      "Ask before making destructive changes",
      "Respect client data privacy"
    ],
    "error_handling": {
      "api_failures": "retry_with_fallback",
      "unclear_requests": "ask_clarifying_questions",
      "missing_permissions": "explain_and_suggest_workaround"
    },
    "d1_databases": [
      {
        "binding": "DB",
        "database_name": "inneranimalmedia-business",
        "database_id": "cf87b717-d4e2-4cf8-bab0-a81268e32d49"
      }
    ]
  }',
  'active',
  1,
  0,
  unixepoch(),
  unixepoch()
)
ON CONFLICT(id) DO UPDATE SET
  config_json = excluded.config_json,
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  version = excluded.version,
  updated_at = unixepoch();
