-- Query agent_configs before adding/updating agent_sam IDE (run this first)
-- Run: wrangler d1 execute inneranimalmedia-business --file=meauxide/query-agent-configs.sql --remote

SELECT id, name, slug, config_type, status, version, updated_at
FROM agent_configs
WHERE id = 'agent-sam-ide'
   OR slug = 'agent-sam-ide';

-- List all agent configs (optional)
-- SELECT id, name, slug, status FROM agent_configs ORDER BY updated_at DESC LIMIT 20;
