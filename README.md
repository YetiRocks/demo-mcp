<p align="center">
  <img src="https://cdn.prod.website-files.com/68e09cef90d613c94c3671c0/697e805a9246c7e090054706_logo_horizontal_grey.png" alt="Yeti" width="200" />
</p>

---

# demo-mcp

[![Yeti](https://img.shields.io/badge/Yeti-Demo-blue)](https://yetirocks.com/demo-mcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **[Yeti](https://yetirocks.com)** - The Performance Platform for Agent-Driven Development.
> Schema-driven APIs, real-time streaming, and vector search. From prompt to production.

Interactive Model Context Protocol (MCP) client. Exposes table data to AI agents via JSON-RPC 2.0 with protocol-level audit logging.

## Features

- MCP server endpoint for AI tool-use patterns
- JSON-RPC 2.0 protocol over HTTP
- Product catalog with full-text search
- Protocol-level audit logging via yeti-audit
- Interactive web client for testing

## APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/demo-mcp/mcp` | MCP JSON-RPC endpoint |
| `GET` | `/demo-mcp/Product` | List products (REST) |
| `GET` | `/demo-mcp/Product/{id}` | Get product by ID |

### MCP Tools

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "search_products",
    "arguments": { "query": "electronics under $50" }
  },
  "id": 1
}
```

## Installation

```bash
cd ~/yeti/applications
git clone https://github.com/yetirocks/demo-mcp.git
cd demo-mcp/source
npm install
npm run build
```

Or install from the Studio **Applications** tab.

## Project Structure

```
demo-mcp/
├── config.yaml              # App configuration + MCP + audit
├── schemas/
│   └── mcp.graphql          # Product table
├── data/
│   └── products.json        # Seed data
└── source/                  # React/Vite frontend
```

## Configuration

```yaml
name: "MCP Demo"
app_id: "demo-mcp"
version: "1.0.0"
description: "Interactive Model Context Protocol (MCP) client — search tables via JSON-RPC 2.0"
schemas:
  - schemas/mcp.graphql

dataLoader: data/*.json

static_files:
  path: web
  route: /
  index: index.html
  notFound:
    file: index.html
    statusCode: 200
  build:
    sourceDir: source
    command: npm run build
```

## Schema

**mcp.graphql** - Product catalog with public read access:
```graphql
type Product @table(database: "demo-mcp") @export(public: [read]) {
  id: String! @primaryKey
  name: String!
  category: String!
  description: String!
  price: Float!
  inStock: Boolean!
}
```

## Development

```bash
cd source

# Install dependencies
npm install

# Start dev server with HMR
npm run dev

# Build for production
npm run build
```

---

Built with [Yeti](https://yetirocks.com) | The Performance Platform for Agent-Driven Development
