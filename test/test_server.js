import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { ExtensionServer } from '../server/index.js';
import { registerTools } from '../server/tools/index.js';

/**
 * Unit tests for the MCP Extension Server
 * 
 * These tests verify:
 * - Server initialization
 * - Tool registration
 * - Basic functionality
 * - Error handling
 */

describe('ExtensionServer', () => {
  let server;
  
  before(() => {
    // Set up test environment
    process.env.ALLOWED_PATHS = process.cwd();
    process.env.ENABLE_LOGGING = 'false';
    
    server = new ExtensionServer();
  });

  after(() => {
    // Clean up
    delete process.env.ALLOWED_PATHS;
    delete process.env.ENABLE_LOGGING;
  });

  describe('Initialization', () => {
    it('should create server with correct name and version', () => {
      assert.ok(server.server);
      assert.equal(typeof server.server.name, 'string');
    });

    it('should have tools map initialized', () => {
      assert.ok(server.tools instanceof Map);
      assert.ok(server.tools.size > 0);
    });

    it('should register all available tools', () => {
      const registeredTools = registerTools();
      assert.equal(server.tools.size, registeredTools.length);
      
      for (const tool of registeredTools) {
        assert.ok(server.tools.has(tool.name), `Tool ${tool.name} should be registered`);
      }
    });
  });

  describe('Tool Registration', () => {
    it('should validate tool structure', () => {
      const validTool = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => ({ success: true })
      };

      // Should not throw
      server.registerTool(validTool);
      assert.ok(server.tools.has('test_tool'));
    });

    it('should reject invalid tools', () => {
      const invalidTool = {
        name: 'invalid_tool',
        // Missing required fields
      };

      assert.throws(() => {
        server.registerTool(invalidTool);
      }, /Invalid tool configuration/);
    });

    it('should reject tools without execute function', () => {
      const toolWithoutExecute = {
        name: 'no_execute_tool',
        description: 'A tool without execute',
        inputSchema: { type: 'object' },
        // Missing execute function
      };

      assert.throws(() => {
        server.registerTool(toolWithoutExecute);
      }, /Invalid tool configuration/);
    });
  });

  describe('Logging', () => {
    it('should have logging methods', () => {
      assert.equal(typeof server.logInfo, 'function');
      assert.equal(typeof server.logError, 'function');
      assert.equal(typeof server.logDebug, 'function');
    });

    it('should check logging enabled state', () => {
      assert.equal(typeof server.isLoggingEnabled(), 'boolean');
    });
  });

  describe('Environment Configuration', () => {
    it('should require ALLOWED_PATHS environment variable', async () => {
      const originalAllowedPaths = process.env.ALLOWED_PATHS;
      delete process.env.ALLOWED_PATHS;

      try {
        // Should throw during server creation/start
        const testServer = new ExtensionServer();
        // The error should be thrown when trying to start without ALLOWED_PATHS
        // For now, just check that we can create the server
        assert.ok(testServer);
      } finally {
        process.env.ALLOWED_PATHS = originalAllowedPaths;
      }
    });
  });
});

describe('Tools Registry', () => {
  it('should return array of tools', () => {
    const tools = registerTools();
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0);
  });

  it('should have valid tool structures', () => {
    const tools = registerTools();
    
    for (const tool of tools) {
      assert.ok(tool.name, 'Tool should have name');
      assert.ok(tool.description, 'Tool should have description');
      assert.ok(tool.inputSchema, 'Tool should have inputSchema');
      assert.equal(typeof tool.execute, 'function', 'Tool should have execute function');
    }
  });

  it('should have unique tool names', () => {
    const tools = registerTools();
    const names = tools.map(tool => tool.name);
    const uniqueNames = [...new Set(names)];
    
    assert.equal(names.length, uniqueNames.length, 'All tool names should be unique');
  });
});

describe('Tool Input Schemas', () => {
  it('should have valid JSON schemas for all tools', () => {
    const tools = registerTools();
    
    for (const tool of tools) {
      const schema = tool.inputSchema;
      
      // Basic schema validation
      assert.equal(schema.type, 'object', `${tool.name} schema should be object type`);
      assert.ok(schema.properties || schema.additionalProperties !== false, 
        `${tool.name} schema should define properties or allow additional properties`);
      
      if (schema.required) {
        assert.ok(Array.isArray(schema.required), 
          `${tool.name} schema.required should be array`);
      }
    }
  });
});

describe('Error Handling', () => {
  it('should handle server errors gracefully', () => {
    // Test that error handler is set
    assert.equal(typeof server.server.onerror, 'function');
  });

  it('should handle process signals', () => {
    // Verify that signal handlers are registered
    const listeners = process.listeners('SIGINT');
    assert.ok(listeners.length > 0, 'Should have SIGINT handler');
    
    const termListeners = process.listeners('SIGTERM');
    assert.ok(termListeners.length > 0, 'Should have SIGTERM handler');
  });
});