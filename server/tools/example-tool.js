import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Example Tool - A comprehensive example showing best practices
 * 
 * This tool demonstrates:
 * - Proper input validation using Zod schemas
 * - Error handling and logging
 * - File system operations with permission checks
 * - Structured response formatting
 * - Timeout handling for long operations
 */

// Input validation schema
const inputSchema = z.object({
  action: z.enum(['greet', 'echo', 'file_info', 'system_info']).describe('Action to perform'),
  message: z.string().optional().describe('Message to process (for greet and echo actions)'),
  file_path: z.string().optional().describe('File path to analyze (for file_info action)'),
  include_details: z.boolean().default(false).describe('Include detailed information in response'),
});

/**
 * Check if a file path is within allowed directories
 * @param {string} filePath - Path to check
 * @returns {boolean} True if path is allowed
 */
function isPathAllowed(filePath) {
  const allowedPaths = process.env.ALLOWED_PATHS ? process.env.ALLOWED_PATHS.split(',') : [];
  const resolvedPath = path.resolve(filePath);
  
  return allowedPaths.some(allowedPath => {
    const resolvedAllowedPath = path.resolve(allowedPath.trim());
    return resolvedPath.startsWith(resolvedAllowedPath);
  });
}

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Execute the example tool
 * @param {Object} args - Tool arguments
 * @returns {Promise<Object>} Tool execution result
 */
async function execute(args) {
  // Validate input
  const validatedArgs = inputSchema.parse(args);
  const { action, message, file_path, include_details } = validatedArgs;

  const startTime = Date.now();
  
  try {
    let result;

    switch (action) {
      case 'greet':
        result = await handleGreet(message || 'World', include_details);
        break;
        
      case 'echo':
        result = await handleEcho(message || '', include_details);
        break;
        
      case 'file_info':
        if (!file_path) {
          throw new Error('file_path is required for file_info action');
        }
        result = await handleFileInfo(file_path, include_details);
        break;
        
      case 'system_info':
        result = await handleSystemInfo(include_details);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const executionTime = Date.now() - startTime;
    
    return {
      success: true,
      action,
      result,
      metadata: {
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
        ...(include_details && { 
          input_args: validatedArgs,
          environment: {
            node_version: process.version,
            platform: process.platform,
            arch: process.arch,
          }
        }),
      },
    };
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    return {
      success: false,
      action,
      error: {
        message: error.message,
        type: error.constructor.name,
      },
      metadata: {
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Handle greet action
 */
async function handleGreet(message, includeDetails) {
  const greeting = `Hello, ${message}!`;
  
  if (includeDetails) {
    return {
      greeting,
      details: {
        message_length: message.length,
        current_time: new Date().toLocaleString(),
        random_fact: 'Did you know? Claude Desktop Extensions use the Model Context Protocol!',
      },
    };
  }
  
  return { greeting };
}

/**
 * Handle echo action
 */
async function handleEcho(message, includeDetails) {
  if (includeDetails) {
    return {
      echo: message,
      details: {
        character_count: message.length,
        word_count: message.split(/\s+/).filter(word => word.length > 0).length,
        uppercase: message.toUpperCase(),
        lowercase: message.toLowerCase(),
        reversed: message.split('').reverse().join(''),
      },
    };
  }
  
  return { echo: message };
}

/**
 * Handle file info action
 */
async function handleFileInfo(filePath, includeDetails) {
  // Security check: ensure path is within allowed directories
  if (!isPathAllowed(filePath)) {
    throw new Error(`Access denied: ${filePath} is not in an allowed directory`);
  }

  try {
    const stats = await fs.stat(filePath);
    const parsedPath = path.parse(filePath);
    
    const basicInfo = {
      exists: true,
      name: parsedPath.name,
      extension: parsedPath.ext,
      size: formatFileSize(stats.size),
      size_bytes: stats.size,
      is_directory: stats.isDirectory(),
      is_file: stats.isFile(),
      modified: stats.mtime.toISOString(),
    };

    if (includeDetails) {
      return {
        ...basicInfo,
        details: {
          full_path: path.resolve(filePath),
          directory: parsedPath.dir,
          permissions: {
            readable: true, // We can assume readable since we got stats
            mode: stats.mode.toString(8),
          },
          created: stats.birthtime.toISOString(),
          accessed: stats.atime.toISOString(),
          blocks: stats.blocks,
          block_size: stats.blksize,
        },
      };
    }
    
    return basicInfo;
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        exists: false,
        path: filePath,
        error: 'File or directory not found',
      };
    }
    throw error;
  }
}

/**
 * Handle system info action
 */
async function handleSystemInfo(includeDetails) {
  const basicInfo = {
    platform: os.platform(),
    architecture: os.arch(),
    node_version: process.version,
    uptime_seconds: Math.floor(process.uptime()),
  };

  if (includeDetails) {
    return {
      ...basicInfo,
      details: {
        os_release: os.release(),
        os_type: os.type(),
        hostname: os.hostname(),
        total_memory: formatFileSize(os.totalmem()),
        free_memory: formatFileSize(os.freemem()),
        cpu_count: os.cpus().length,
        load_average: os.loadavg(),
        network_interfaces: Object.keys(os.networkInterfaces()),
        environment_variables: Object.keys(process.env).length,
        process_id: process.pid,
        current_working_directory: process.cwd(),
      },
    };
  }
  
  return basicInfo;
}

/**
 * Tool configuration object
 */
export const exampleTool = {
  name: 'example_tool',
  description: 'A comprehensive example tool demonstrating best practices for Claude Desktop Extensions. Supports greet, echo, file_info, and system_info actions.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['greet', 'echo', 'file_info', 'system_info'],
        description: 'Action to perform',
      },
      message: {
        type: 'string',
        description: 'Message to process (for greet and echo actions)',
      },
      file_path: {
        type: 'string',
        description: 'File path to analyze (for file_info action)',
      },
      include_details: {
        type: 'boolean',
        default: false,
        description: 'Include detailed information in response',
      },
    },
    required: ['action'],
  },
  execute,
};