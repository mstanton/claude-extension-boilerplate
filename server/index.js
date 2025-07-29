#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { registerTools } from './tools/index.js';

/**
 * Main MCP Server for Claude Desktop Extension
 * 
 * This server implements the Model Context Protocol (MCP) to provide
 * tools and capabilities to Claude Desktop through the extension system.
 */
class ExtensionServer {
  constructor() {
    this.server = new Server(
      {
        name: process.env.EXTENSION_NAME || 'claude-extension-boilerplate',
        version: process.env.EXTENSION_VERSION || '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          logging: {},
        },
      }
    );

    this.tools = new Map();
    this.setupHandlers();
    this.registerAllTools();
  }

  /**
   * Set up the core MCP protocol handlers
   */
  setupHandlers() {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (!this.tools.has(name)) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool "${name}" not found`
        );
      }

      try {
        const tool = this.tools.get(name);
        const result = await tool.execute(args || {});
        
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        this.logError(`Tool execution failed for "${name}":`, error);
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });

    // Handle server errors
    this.server.onerror = (error) => {
      this.logError('Server error:', error);
    };

    // Handle process termination
    process.on('SIGINT', () => {
      this.logInfo('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.logInfo('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
  }

  /**
   * Register all available tools
   */
  registerAllTools() {
    try {
      const registeredTools = registerTools();
      
      for (const tool of registeredTools) {
        this.registerTool(tool);
      }
      
      this.logInfo(`Registered ${this.tools.size} tools`);
    } catch (error) {
      this.logError('Failed to register tools:', error);
      throw error;
    }
  }

  /**
   * Register a single tool with validation
   * @param {Object} tool - Tool configuration object
   */
  registerTool(tool) {
    // Validate tool structure
    const toolSchema = z.object({
      name: z.string(),
      description: z.string(),
      inputSchema: z.object({}).passthrough(),
      execute: z.function(),
    });

    try {
      const validatedTool = toolSchema.parse(tool);
      this.tools.set(validatedTool.name, validatedTool);
      this.logInfo(`Registered tool: ${validatedTool.name}`);
    } catch (error) {
      this.logError(`Failed to register tool "${tool.name}":`, error);
      throw new Error(`Invalid tool configuration for "${tool.name}": ${error.message}`);
    }
  }

  /**
   * Start the MCP server
   */
  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.logInfo('MCP Server started successfully');
      this.logInfo(`Server: ${this.server.name} v${this.server.version}`);
      this.logInfo(`Tools available: ${Array.from(this.tools.keys()).join(', ')}`);
      
    } catch (error) {
      this.logError('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Logging utilities
   */
  logInfo(message, ...args) {
    if (this.isLoggingEnabled()) {
      console.error('[INFO]', message, ...args);
    }
  }

  logError(message, ...args) {
    console.error('[ERROR]', message, ...args);
  }

  logDebug(message, ...args) {
    if (this.isLoggingEnabled() && process.env.NODE_ENV === 'development') {
      console.error('[DEBUG]', message, ...args);
    }
  }

  isLoggingEnabled() {
    return process.env.ENABLE_LOGGING === 'true' || process.env.NODE_ENV === 'development';
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Validate environment
    if (!process.env.ALLOWED_PATHS) {
      throw new Error('ALLOWED_PATHS environment variable is required');
    }

    const server = new ExtensionServer();
    await server.start();
    
  } catch (error) {
    console.error('Fatal error starting extension server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { ExtensionServer };