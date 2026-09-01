# 🧠 Project Lessons Learned

## 1. Microsoft 365 & Azure Entra ID
* **Tenant Isolation**: Azure tenants are strict security boundaries. Guest accounts (`#EXT#`) cannot query host mailboxes without admin consent in the target tenant.
* **Corporate Admin Consent Bypass**: If a corporate tenant restricts admin consent for standard accounts, create a free dedicated Entra ID tenant (`onmicrosoft.com`) where the developer holds 100% Global Admin rights for 1-click consent.
* **OData Array Unpacking**: Microsoft Graph wraps JSON responses inside `{ "@odata.context": "...", "value": [...] }`. Always add `return data.value || data;` in the query's Transformer tab to unpack rows into table columns.
* **Secret Value Masking**: Azure hides client secret values permanently once navigated away. Must copy immediately.
* **Credentials Source of Truth**: Never use or assume IDs from `.env` — live credentials and tenant IDs are managed and stored directly inside the Budibase UI REST API Connection settings.
* **Dataverse Error `0x80072560` ("The user is not a member of the organization")**: Azure Entra ID OAuth tokens are validated by Entra, but Dataverse rejects requests if the App is not registered inside that specific CRM environment as an **Application User** with a Security Role (e.g., `System Administrator`) in Power Platform Admin Center.
* **Microsoft Graph `$search` Empty Parameter Error (`An identifier was expected at position 0`)**: When executing queries with dynamic bindings like `?$search="{{ search_term }}"`, testing the query with an empty binding causes Microsoft Graph OData parser to crash. Always configure a non-empty **Default Value** in the Bindings tab and add the `ConsistencyLevel: eventual` header.
* **Microsoft Graph `$search` & `$orderby` Incompatibility (`SearchWithOrderBy`)**: Microsoft Graph does not permit `$orderby` when `$search` is used (search results are automatically ranked by relevance). Remove `&$orderby=...` from search URLs and sort via the JavaScript Transformer tab if needed.

## 2. Low-Code & BI Architectures (Metabase vs Budibase)
* **Metabase**: Pure SQL BI, read-only, JVM memory-heavy (~1GB RAM), cannot connect natively to Microsoft Graph REST APIs or execute 2-way write actions.
* **Budibase**: Node.js/Svelte based, lightweight (~200-300MB RAM), supports REST APIs + SQL, 2-way CRUD buttons, and native AI Agent workflows.
* **Liquibase Locks**: If Metabase crashes abruptly, run `migrate release-locks` before startup.
* **Budibase Self-Hosted Password Recovery & Lockout Reset**: If locked out of Budibase without SMTP reset, update the user bcrypt hash directly in CouchDB `global-db/<userId>` (`password` field) and flush `data_cache-auth*` keys in Redis (`redis-cli -a <REDIS_PASSWORD>`) to clear brute-force lockouts without wiping apps or volumes.

## 3. Containerization & Cloud Deployment
* **Render Free Tier Limit**: 512 MB RAM ceiling will crash multi-service containers (like Budibase with CouchDB/Redis/MinIO/Nginx) during startup spikes (OOM Exit Code 137). Use Railway (8 GB RAM) or Oracle Always Free (24 GB RAM).
* **Instant Tunneling**: Use `cloudflare/cloudflared` Docker container or SSH Pinggy (`ssh -p 443 -R0:localhost:10000 a.pinggy.io`) to expose local Docker containers to secure HTTPS URLs instantly.

## 4. AI Safety & Token Cost Control
* **Zero Data Loss**: Enforce 5 layers: Dedicated read-only DB user, read replica, AST SQL parser, read-only session transactions, and human-in-the-loop confirmation. Never rely on system prompts alone.
* **Schema Pruning & Semantic Cache**: Pruning database schemas via vector RAG + caching frequent queries reduces LLM token costs by 85–95%.
