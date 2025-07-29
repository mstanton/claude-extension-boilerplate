import { exampleTool } from './example-tool.js';
import { fileProcessorTool } from './file-processor-tool.js';
import { systemInfoTool } from './system-info-tool.js';

/**
 * Tools Registry
 * 
 * This module exports all available tools for the MCP server.
 * Add new tools to the tools array to make them available to Claude.
 */

/**
 * Register and return all available tools
 * @returns {Array} Array of tool objects
 */
export function registerTools() {
  const tools = [
    exampleTool,
    fileProcessorTool,
    systemInfoTool,
    // Add more tools here as you create them
  ];

  // Validate that all tools have required properties
  tools.forEach((tool, index) => {
    if (!tool.name || !tool.description || !tool.execute) {
      throw new Error(`Tool at index ${index} is missing required properties (name, description, execute)`);
    }
  });

  return tools;
}

/**
 * Get a specific tool by name
 * @param {string} name - Tool name
 * @returns {Object|null} Tool object or null if not found
 */
export function getTool(name) {
  const tools = registerTools();
  return tools.find(tool => tool.name === name) || null;
}

/**
 * Get all tool names
 * @returns {Array<string>} Array of tool names
 */
export function getToolNames() {
  return registerTools().map(tool => tool.name);
}

/**
 * Validate tool structure
 * @param {Object} tool - Tool to validate
 * @throws {Error} If tool structure is invalid
 */
export function validateTool(tool) {
  const requiredFields = ['name', 'description', 'inputSchema', 'execute'];
  
  for (const field of requiredFields) {
    if (!(field in tool)) {
      throw new Error(`Tool is missing required field: ${field}`);
    }
  }

  if (typeof tool.name !== 'string') {
    throw new Error('Tool name must be a string');
  }

  if (typeof tool.description !== 'string') {
    throw new Error('Tool description must be a string');
  }

  if (typeof tool.execute !== 'function') {
    throw new Error('Tool execute must be a function');
  }

  if (typeof tool.inputSchema !== 'object') {
    throw new Error('Tool inputSchema must be an object');
  }
}