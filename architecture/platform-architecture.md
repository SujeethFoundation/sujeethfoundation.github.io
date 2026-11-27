# Sujeeth Foundation Platform: Architecture and Repos

Last verified: 2026-11-26, from the GitHub org, Dataverse and the Foundation Graph. This doc records names and locations only. Secret values never go in it.

Program statistics are not in this doc on purpose. Pull them from sujeeth.org before citing.

The companion doc is [platform-data-model-and-portal.md](platform-data-model-and-portal.md).

## Map in one paragraph

Students, mentors and partners use two front ends: the static site at sujeeth.org (Jekyll on GitHub Pages) and the Power Pages portal (the "Program Portal" website). Both sit on one Dataverse environment. Seven Azure Function apps add the services Power Pages can't do: chat, knowledge search, payments, short links and texting.

Two delivery paths:
- **Code in GitHub, deployed to Azure:** chat, MCP, ontology, websearch, wikisearch, payments, shortner, acs-sms-bot, and the website.
- **Dataverse solutions, published to prod by Avi:** Base Camp, book requests, credentials, surveys, circles, online course tables. No repo. See the data model doc for the solution list.

## GitHub org: SujeethFoundation (9 repos, default branch `main`)

| Repo | What it is | Runtime |
|---|---|---|
| `sujeethfoundation.github.io` | Website, wiki, Discussions, course player JS, Power Pages CSS | Jekyll, JS, CSS |
| `chat` | Chat agent API behind the site widget | Azure Functions, Python v2 |
| `mcp` | MCP server (Career Compass, a.k.a. "Sujeeth Foundation Graph") | Azure Functions, custom handler |
| `ontology` | Concept graph and governance (`ontology/ontology.json`) | Azure Functions, Python v2 |
| `websearch` | Crawler plus hybrid search over approved domains | Azure Functions, Python v2 |
| `wikisearch` | BM25 search over the GitHub wiki | Azure Functions, Python v2 |
| `payments` | PayPal checkout and webhook for online courses | Azure Functions, TypeScript, Node 24 |
| `shortner` | Link shortener for `go.sujeeth.org` (repo spelling is "shortner") | Azure Functions, Python |
| `acs-sms-bot` | Texting through Azure Communication Services: `SendSMS` and `RelayReply`. Apache-2.0 | Azure Functions, Node.js (v3 model, `function.json`) |

## Azure Function apps

| App | Host | Notes |
|---|---|---|
| websearch | `websearch-h9arcweeftfrd8e0.eastus-01.azurewebsites.net` | Flex Consumption. Queue `web-crawl-pages` |
| wikisearch | `wikisearch-gmebdbewaec6axdp.eastus-01.azurewebsites.net` | Flex Consumption |
| ontology | `ontology-ghgedphdh6eefych.eastus-01.azurewebsites.net` | Flex Consumption |
| mcp | `sujeethmcp-c3hjg6g4c2f2f2dn.eastus-01.azurewebsites.net`, custom domain `mcp.sujeeth.org/mcp`, health `/healthz` | Flex Consumption, stateless, tools run on worker threads |
| chat | `sujeethchat-bwbrhgb9f2gbhubt.centralus-01.azurewebsites.net` | Central US, the only app outside East US |
| payments | `suj-payments`, custom domain `payments.sujeeth.org` | Deploy workflow `.github/workflows/main_suj-payments.yml` |
| shortner | `go.sujeeth.org` | Table Storage for links |
| acs-sms-bot | Deploy workflow `.github/workflows/main_acs-sms-bot.yml` | Two functions, see below |

## Chat agent

The widget (`js/sujeeth-chat-widget.js`, `js/foundry-chat-connection.js`, on sujeeth.org and Power Pages) calls the chat app at `/api/chat`. The chat app calls the Foundry agent `Sujeeth-Foundation-Web` (model GPT-6 Luna) using its managed identity. The agent has two tools:

1. The MCP server "Sujeeth Foundation Graph" for knowledge and career questions.
2. The Dataverse MCP connector for program data, through the Foundry connection `Sujeeth-Foundation-Back-End`.

Chat repo files: `chat_blueprint.py`, `chat_stream.py` (SSE), `chat_attachments.py`, `enrich.py` (ontology question enrichment), `ontology_copy.py` (nightly 08:00 UTC copy). Origin, CORS and rate-limit settings use the `CHAT_*` prefix.

## MCP server

Public tools: `search_sujeeth_foundation`, `get_documents` (plural, max 2 urls), `search_website`, `search_wiki`.
Admin tools, gated by `MCP_ADMIN_TOOLS`: `check_services`, `resolve_ontology`, `get_ontology_context`.

For each question the MCP calls GPT-6 Luna through the Azure Responses API to resolve ontology concepts, then sends the matched concepts and approved domains to websearch and wikisearch. Rate limits have three buckets: public, trusted and global. Trusted means a known partner address range or the `x-mcp-client-key` header. Env template: `mcp/mcp.env.example`.

## Ontology

`ontology/ontology.json` is the source of truth for concepts, relationships, crawl governance and search governance, plus the Feelings API. Routes include `/api/ontology/crawl-manifest` and `/api/ontology/search-manifest`. The chat endpoint used to live here and has moved to the chat app.

### Coverage check (2026-11-26, ontology version `1.15.5-proposed`)

Eleven searches through `search_sujeeth_foundation` produced this. What the Graph resolved and what it did not:

- **Resolved:** career development, first job, interviewing, job application strategy, Career Circle Program, circle, partnership, partner, career mentor, substitute request, book and book request, onboarding survey, feedback survey, impact report, program statistics, spotlight, Right Kind of Wrong, Permission to Feel.
- **Out of scope (no concept matched):** "Career Ascent online course certificate" and "mentor training and onboarding". The Graph returns its standard out-of-scope message for both.
- **Partial:** "Base Camp online circles" matched only the `circle` concept. Base Camp has no concept of its own.
- **Approved domains seen:** `sujeeth.org`, `topics.sujeeth.org`, `portal.sujeeth.org`, `app.candid.org`, plus third-party career sources (LinkedIn for Students, Teal, The Muse, Working Out Loud, YouSpot and others).

Why it matters: the MCP server only answers about concepts the ontology contains. The online course, certificates and mentor training are real parts of the platform, and an AI assistant connected to the MCP server cannot answer questions about them until concepts and source pages exist. The B2C test in `business-architecture.md` depends on this.

Search results also include wiki and portal pages, so the portal's public pages (for example `/books`) are searchable alongside the site.

## websearch

- Crawl: ontology-approved domains only. One queue message per page. Page cap `MAX_PAGES_PER_DOMAIN` (10,000), depth `MAX_CRAWL_DEPTH` (5).
- Storage: chunks and vectors in Blob Storage, index in Table Storage (`searchchunks`), loaded into memory by every instance. Azure AI Search is retired. A prebuilt snapshot under `index-snapshot/` speeds startup.
- Search: BM25 plus 1-bit vector shortlist re-ranked on 8-bit vectors, fused by reciprocal rank, with concept and phrase bonuses. One result per page.
- Schedules (UTC): crawl recovery 10:00 daily, index reconcile 11:00 daily, job cleanup 11:30 daily, weekly crawl Sundays 08:00 for `sujeeth.org` and `topics.sujeeth.org`.
- Embeddings: Azure OpenAI deployment `sf-embeddings`, 1,536 dimensions.
- Helpers: `crawl-helper.ps1`, `Add-ManualPage.ps1`, `check_sitemap.py`.

## wikisearch

Clones the GitHub wiki with Dulwich, builds a BM25 index, saves a snapshot blob and rebuilds on the GitHub `gollum` webhook. `synonyms.json` handles synonyms. `WIKI_EXCLUDE_TITLE_PATTERN` keeps circle-session pages out of results.

## payments

Routes: `GET /api/health`, `POST /api/checkout` (quote, PayPal order, or $0 enroll), `POST /api/paypal/webhook`, and a checkout status route described in `docs/course-player.md`. The environment (dev, test, prod) is picked by allowlisted origin. Settings follow `PAYMENTS_{DEV|TEST|PROD}_*`. Secrets live in Azure Key Vault. Dev and Test charge $0.01. The webhook keys on the PayPal order ID, so a redelivered event changes nothing. Template: `payments/local.settings.json.example`.

## shortner (go.sujeeth.org)

- Public: `GET /{code}` returns a 302.
- `POST /api/shorten` needs a function key (used by Power Automate).
- `/manage`, `/api/links` and CSV import/export are Entra-protected.
- Storage: Azure Table Storage, `RowKey` is the code.
- Files: `function_app.py`, `link_service.py`, `storage.py`, `identity_policy.py`, `infrastructure/main.bicep`, `connector/openapi.json`, `migration/MIGRATION-REPORT.md`.
- Open item: the Rebrandly migration is waiting on a Rebrandly CSV export.

## acs-sms-bot (texting)

Two small functions on Azure Communication Services (ACS) SMS, using `@azure/communication-sms`. Both are HTTP POST triggers that need a function key.

| Function | Trigger | What it does |
|---|---|---|
| `SendSMS` | HTTP POST, called from Power Automate | Body `{ "to": "<number or array>", "message": "<text>" }`. Sends from the ACS number and returns the ACS result, or a 500 with the error message |
| `RelayReply` | Event Grid delivery of an ACS inbound SMS event | Answers the Event Grid subscription handshake, ignores messages from its own number, and forwards any other reply to one fixed phone number |

Settings (names only): `ACS_CONNECTION_STRING`, `ACS_PHONE_NUMBER`, `RELAY_PHONE_NUMBER`. The admin app's Quick Tasks use it to text mentors when a substitute request comes in.

## Website repo: JavaScript and CSS

JS (`js/`): `foundry-chat-connection.js`, `sujeeth-chat-widget.js`, `sujeeth-course-player.js` (44 KB), `theme.js`.
CSS (`css/`): `style.css`, `mobile.css`, `reset.css`, `sujeeth.css`, `sujeeth-chat.css`, `sujeeth-chat-widget.css`, `skin/`.
Power Pages CSS (`css/powerpages/`): `sujeeth-foundation-course-player`, `-form`, `-power-pages-grid`, `-modal`, `-profile`.
Pages: `chat.html`, `circle.html`, `volunteer.html`, `partner.html`, `joinpartner.html`, `spotlight.html`, `engage.html`, `career-compass.md`, `llms.txt`.

Course player embed:
`<script defer src="https://www.sujeeth.org/js/sujeeth-course-player.js" data-course-id data-contact-id="{{ user.id }}" data-progress-write data-payments-url ...>`
It needs the Power Pages Web API site settings (see the data model doc), table permissions, and `https://www.sujeeth.org` in the portal CSP `script-src`.
