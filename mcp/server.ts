import "../lib/env";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerListBankConnections } from "./tools/list-bank-connections";
import { registerListAccounts } from "./tools/list-accounts";
import { registerGetBalances } from "./tools/get-balances";
import { registerGetTransactions } from "./tools/get-transactions";
import { registerSyncNow } from "./tools/sync-now";

// stdio reserves stdout for JSON-RPC framing — every log in this process (and everything
// it imports) must go to console.error, never console.log.

const server = new McpServer({ name: "finey", version: "0.1.0" });

registerListBankConnections(server);
registerListAccounts(server);
registerGetBalances(server);
registerGetTransactions(server);
registerSyncNow(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Finey MCP server running on stdio");
