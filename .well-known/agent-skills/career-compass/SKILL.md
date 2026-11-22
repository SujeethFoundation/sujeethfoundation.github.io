---
name: career-compass
description: Use the Sujeeth Foundation's anonymous Career Compass MCP to find source-backed guidance for students preparing for their first job, including applications, resumes, interviews, networking, and career exploration.
---

# Career Compass

Career Compass is an anonymous, read-only MCP search service at https://mcp.sujeeth.org/mcp (version 1.0). It is not a resume scoring engine, application submission service, or interview simulator.

## Actual MCP tools

- `search_sujeeth_foundation`: Main ontology-guided search across approved websites and the Foundation wiki. Use first for questions about job-search guidance or Foundation programs.
- `get_documents`: Read more of selected search results by passing URLs returned by search. Use when excerpts are insufficient.
- `search_website`: Search ontology-approved websites only.
- `search_wiki`: Search Foundation wiki content only.

These are the four public tools documented by the MCP repository. Administrative diagnostic tools are not available publicly.

## Student use cases

Use those same tools to retrieve relevant Foundation guidance for resume and application feedback, interview preparation, career exploration, networking, job-search planning, and Career Circles. These are topics for coaching, **not** separate MCP endpoints or tools. A connected AI assistant can discuss student-provided material and practice answers using retrieved guidance; the MCP itself only searches and reads sources.

## Retrieval rules

Search results contain excerpts and source URLs. Read selected documents when needed. Respect ontology-approved sources and out-of-scope or degraded-service responses. Cite source URLs. Do not invent statistics, personal achievements, employment outcomes, or claims about an employer. Do not expose private student records or recorded Circle sessions.
