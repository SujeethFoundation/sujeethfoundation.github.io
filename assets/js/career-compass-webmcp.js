(function () {
  "use strict";

  if (!document.modelContext || typeof document.modelContext.registerTool !== "function") {
    return;
  }

  const resources = {
    "career-compass": {
      title: "Career Compass",
      url: "https://www.sujeeth.org/career-compass.md",
      description: "Read the Career Compass guide and connect to its anonymous MCP service."
    },
    "career-circles": {
      title: "Career Circles",
      url: "https://www.sujeeth.org/circle",
      description: "Learn about the Sujeeth Foundation's six-week small-group mentoring program."
    },
    "career-guidance": {
      title: "Career guidance",
      url: "https://www.sujeeth.org/career",
      description: "Browse the Foundation's public career preparation information."
    },
    "foundation-resources": {
      title: "Foundation resources",
      url: "https://www.sujeeth.org/sitemap.xml",
      description: "Browse the public sitemap for Sujeeth Foundation resources."
    }
  };

  document.modelContext.registerTool({
    name: "get-career-resource",
    title: "Get a Sujeeth Foundation career resource",
    description: "Use this to retrieve a public Sujeeth Foundation link for a student's career question.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: Object.keys(resources),
          description: "The public resource to return."
        }
      },
      required: ["topic"],
      additionalProperties: false
    },
    execute: async ({ topic }) => JSON.stringify(resources[topic]),
    annotations: {
      readOnlyHint: true
    }
  }).catch(function (error) {
    console.warn("Career Compass WebMCP tool was not registered.", error);
  });

  document.modelContext.registerTool({
    name: "get-career-compass-endpoint",
    title: "Get the Career Compass MCP endpoint",
    description: "Use this to retrieve the anonymous Career Compass MCP endpoint and its public service metadata.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    },
    execute: async () => JSON.stringify({
      name: "Career Compass by the Sujeeth Foundation",
      endpoint: "https://mcp.sujeeth.org/mcp",
      serverCard: "https://www.sujeeth.org/.well-known/mcp/server-card.json",
      authentication: "none",
      documentation: "https://www.sujeeth.org/career-compass.md"
    }),
    annotations: {
      readOnlyHint: true
    }
  }).catch(function (error) {
    console.warn("Career Compass endpoint tool was not registered.", error);
  });
}());
