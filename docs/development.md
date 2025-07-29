# Development Guide

This guide covers advanced development topics for building Claude Desktop Extensions using this boilerplate.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Creating Custom Tools](#creating-custom-tools)
- [Working with User Configuration](#working-with-user-configuration)
- [Error Handling Best Practices](#error-handling-best-practices)
- [Security Considerations](#security-considerations)
- [Testing Strategy](#testing-strategy)
- [Debugging Tips](#debugging-tips)
- [Performance Optimization](#performance-optimization)
- [Cross-Platform Development](#cross-platform-development)

## Architecture Overview

### MCP Protocol Flow

```
Claude Desktop → MCP Transport → Your Extension Server → Tool Execution → Response
```

1. **Claude Desktop** sends requests via stdin/stdout transport
2. **MCP Server** (your extension) receives and processes requests
3. **Tool Registry** routes calls to appropriate tool implementations
4. **Tools** execute business logic and return structured responses
5. **Server** formats responses according to MCP protocol

### Directory Structure Explained

```
server/
├── index.js           # Main MCP server - handles protocol, routing
├── tools/
│   ├── index.js      # Tool registry - manages tool discovery
│   ├── *.tool.js     # Individual tool implementations
└── utils/            # Shared utilities (optional)
```

### Key Components

- **ExtensionServer**: Main server class handling MCP protocol
- **Tool Registry**: Discovers and validates available tools
- **Individual Tools**: Self-contained tool implementations
- **Validation Layer**: Input/output validation using Zod schemas

## Creating Custom Tools

### Basic Tool Structure

```javascript
import { z } from 'zod';

// 1. Define input validation schema
const inputSchema = z.object({
  required_param: z.string().describe('Description of parameter'),
  optional_param: z.number().optional().default(42),
});

// 2. Implement the tool logic
async function execute(args) {
  // Validate inputs
  const validatedArgs = inputSchema.parse(args);
  
  try {
    // Your tool logic here
    const result = await doSomething(validatedArgs);
    
    return {
      success: true,
      data: result,
      metadata: {
        timestamp: new Date().toISOString(),
        // Add any relevant metadata
      }
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error.message,
        type: error.constructor.name,
      }
    };
  }
}

// 3. Export tool configuration
export const myCustomTool = {
  name: 'my_custom_tool',
  description: 'Clear, concise description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      required_param: {
        type: 'string',
        description: 'Description for Claude to understand the parameter'
      },
      optional_param: {
        type: 'number',
        default: 42,
        description: 'Optional parameter with default value'
      }
    },
    required: ['required_param']
  },
  execute,
};
```

### Advanced Tool Patterns

#### Async Operations with Timeout

```javascript
async function executeWithTimeout(args, timeoutMs = 30000) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
  });
  
  const operationPromise = performLongOperation(args);
  
  try {
    return await Promise.race([operationPromise, timeoutPromise]);
  } catch (error) {
    if (error.message === 'Operation timed out') {
      return {
        success: false,
        error: {
          message: 'Operation timed out after 30 seconds',
          type: 'TimeoutError'
        }
      };
    }
    throw error;
  }
}
```

#### Streaming/Progressive Results

```javascript
async function executeWithProgress(args, progressCallback) {
  const steps = ['Initializing', 'Processing', 'Finalizing'];
  
  for (let i = 0; i < steps.length; i++) {
    progressCallback?.({
      step: i + 1,
      total: steps.length,
      message: steps[i]
    });
    
    await performStep(steps[i], args);
  }
  
  return { success: true, completed: steps.length };
}
```

#### Tool Composition

```javascript
// Create tools that use other tools
async function compositeToolExecute(args) {
  // Use results from one tool in another
  const firstResult = await firstTool.execute(args.firstParams);
  
  if (!firstResult.success) {
    return firstResult; // Propagate error
  }
  
  const secondResult = await secondTool.execute({
    ...args.secondParams,
    input: firstResult.data
  });
  
  return {
    success: true,
    data: {
      first: firstResult.data,
      second: secondResult.data
    }
  };
}
```

## Working with User Configuration

### Accessing Configuration

```javascript
// Environment variables are automatically populated from user config
const apiKey = process.env.API_KEY;
const allowedPaths = process.env.ALLOWED_PATHS?.split(',') || [];
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024;
const enableFeature = process.env.ENABLE_FEATURE === 'true';
```

### Configuration Validation

```javascript
function validateConfiguration() {
  const requiredEnvVars = ['API_KEY', 'ALLOWED_PATHS'];
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}
```

### Dynamic Configuration

```javascript
// React to configuration changes
function getConfigWithDefaults() {
  return {
    apiKey: process.env.API_KEY,
    timeout: parseInt(process.env.TIMEOUT_MS || '30000'),
    retries: parseInt(process.env.MAX_RETRIES || '3'),
    batchSize: parseInt(process.env.BATCH_SIZE || '100'),
  };
}
```

## Error Handling Best Practices

### Structured Error Responses

```javascript
class ExtensionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.details = details;
  }
}

// Usage in tools
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  if (error instanceof ExtensionError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
        type: 'ExtensionError'
      }
    };
  }
  
  // Handle unexpected errors
  return {
    success: false,
    error: {
      message: 'An unexpected error occurred',
      type: error.constructor.name,
      details: { originalMessage: error.message }
    }
  };
}
```

### Error Categories

```javascript
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
};

function createError(code, message, details) {
  return new ExtensionError(message, code, details);
}
```

### Graceful Degradation

```javascript
async function executeWithFallback(args) {
  try {
    // Try primary method
    return await primaryOperation(args);
  } catch (error) {
    console.warn('Primary operation failed, trying fallback:', error.message);
    
    try {
      // Try fallback method
      return await fallbackOperation(args);
    } catch (fallbackError) {
      // Both failed, return comprehensive error
      return {
        success: false,
        error: {
          message: 'Both primary and fallback operations failed',
          details: {
            primary: error.message,
            fallback: fallbackError.message
          }
        }
      };
    }
  }
}
```

## Security Considerations

### Path Validation

```javascript
import path from 'path';

function isPathAllowed(targetPath, allowedPaths) {
  const resolvedTarget = path.resolve(targetPath);
  
  return allowedPaths.some(allowedPath => {
    const resolvedAllowed = path.resolve(allowedPath);
    
    // Prevent path traversal attacks
    try {
      const relativePath = path.relative(resolvedAllowed, resolvedTarget);
      return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
    } catch (error) {
      return false;
    }
  });
}
```

### Input Sanitization

```javascript
import { z } from 'zod';

// Create strict schemas
const sanitizedStringSchema = z.string()
  .min(1)
  .max(1000)
  .regex(/^[a-zA-Z0-9\s\-_\.]+$/, 'Only alphanumeric characters, spaces, and basic punctuation allowed');

const filePathSchema = z.string()
  .min(1)
  .max(500)
  .refine(path => !path.includes('..'), 'Path traversal not allowed')
  .refine(path => !path.startsWith('/'), 'Absolute paths not allowed');
```

### Sensitive Data Handling

```javascript
// Never log sensitive data
function logSafeArgs(args) {
  const safe = { ...args };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'key', 'secret'];
  sensitiveFields.forEach(field => {
    if (field in safe) {
      safe[field] = '[REDACTED]';
    }
  });
  
  return safe;
}

// Use for debugging
console.log('Tool called with args:', logSafeArgs(args));
```

### Rate Limiting

```javascript
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }
  
  isAllowed(identifier = 'default') {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const requests = this.requests.get(identifier);
    
    // Remove old requests
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }
    
    if (requests.length >= this.maxRequests) {
      return false;
    }
    
    requests.push(now);
    return true;
  }
}

const rateLimiter = new RateLimiter();

async function rateLimitedExecute(args) {
  if (!rateLimiter.isAllowed()) {
    return {
      success: false,
      error: {
        message: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      }
    };
  }
  
  // Continue with normal execution
}
```

## Testing Strategy

### Unit Testing Tools

```javascript
// test/my-tool.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { myCustomTool } from '../server/tools/my-custom-tool.js';

describe('My Custom Tool', () => {
  before(() => {
    // Setup test environment
    process.env.API_KEY = 'test-key';
  });
  
  after(() => {
    // Cleanup
    delete process.env.API_KEY;
  });

  it('should handle valid input', async () => {
    const result = await myCustomTool.execute({
      required_param: 'test-value'
    });
    
    assert.strictEqual(result.success, true);
    assert.ok(result.data);
  });

  it('should reject invalid input', async () => {
    const result = await myCustomTool.execute({
      // Missing required_param
    });
    
    assert.strictEqual(result.success, false);
    assert.ok(result.error);
  });
});
```

### Integration Testing

```javascript
// test/integration.test.js
import { ExtensionServer } from '../server/index.js';

describe('Integration Tests', () => {
  let server;
  
  before(async () => {
    process.env.ALLOWED_PATHS = '/tmp/test';
    server = new ExtensionServer();
  });

  it('should handle complete tool workflow', async () => {
    // Test tool discovery
    const tools = Array.from(server.tools.keys());
    assert.ok(tools.includes('my_custom_tool'));
    
    // Test tool execution
    const tool = server.tools.get('my_custom_tool');
    const result = await tool.execute({ required_param: 'test' });
    
    assert.ok(result.success);
  });
});
```

### Mocking External Dependencies

```javascript
// test/mocks.js
export const mockApiClient = {
  get: async (url) => {
    if (url.includes('error')) {
      throw new Error('Mock API error');
    }
    return { data: 'mock response' };
  }
};

// Use in tests
import { mockApiClient } from './mocks.js';

// Replace real API client with mock
myTool.__apiClient = mockApiClient;
```

## Debugging Tips

### Comprehensive Logging

```javascript
class Logger {
  constructor(enabled = process.env.ENABLE_LOGGING === 'true') {
    this.enabled = enabled;
  }
  
  debug(message, ...args) {
    if (this.enabled) {
      console.error('[DEBUG]', message, ...args);
    }
  }
  
  info(message, ...args) {
    if (this.enabled) {
      console.error('[INFO]', message, ...args);
    }
  }
  
  error(message, ...args) {
    console.error('[ERROR]', message, ...args);
  }
  
  timing(label) {
    if (this.enabled) {
      console.time(label);
      return () => console.timeEnd(label);
    }
    return () => {};
  }
}

const logger = new Logger();

// Usage in tools
async function execute(args) {
  const endTiming = logger.timing('tool-execution');
  logger.debug('Tool called with args:', logSafeArgs(args));
  
  try {
    const result = await doWork(args);
    logger.debug('Tool completed successfully');
    return result;
  } catch (error) {
    logger.error('Tool failed:', error);
    throw error;
  } finally {
    endTiming();
  }
}
```

### Debug Mode

```javascript
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  // Add extra validation
  // Enable verbose logging
  // Include stack traces
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}
```

### Health Check Tool

```javascript
export const healthCheckTool = {
  name: 'health_check',
  description: 'Check extension health and configuration',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  },
  async execute() {
    const health = {
      timestamp: new Date().toISOString(),
      environment: {
        node_version: process.version,
        platform: process.platform,
        memory_usage: process.memoryUsage(),
      },
      configuration: {
        allowed_paths_configured: !!process.env.ALLOWED_PATHS,
        logging_enabled: process.env.ENABLE_LOGGING === 'true',
        // Add other config checks
      },
      tools: Array.from(server.tools.keys()),
    };
    
    return { success: true, health };
  }
};
```

## Performance Optimization

### Memory Management

```javascript
// Use streams for large files
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

async function processLargeFile(filePath) {
  const stream = createReadStream(filePath);
  
  let lineCount = 0;
  const countLines = new Transform({
    transform(chunk, encoding, callback) {
      lineCount += chunk.toString().split('\n').length - 1;
      callback();
    }
  });
  
  await pipeline(stream, countLines);
  return { lineCount };
}
```

### Caching

```javascript
class SimpleCache {
  constructor(ttlMs = 300000) { // 5 minutes default
    this.cache = new Map();
    this.ttl = ttlMs;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  clear() {
    this.cache.clear();
  }
}

const cache = new SimpleCache();

async function cachedOperation(key, operation) {
  let result = cache.get(key);
  
  if (!result) {
    result = await operation();
    cache.set(key, result);
  }
  
  return result;
}
```

### Batch Processing

```javascript
async function processBatch(items, batchSize = 10) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processItem(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

## Cross-Platform Development

### Path Handling

```javascript
import path from 'path';

// Always use path.join() instead of string concatenation
const filePath = path.join(baseDir, 'subdirectory', 'file.txt');

// Normalize paths
const normalizedPath = path.normalize(userInputPath);

// Check for path traversal safely
function isPathSafe(targetPath, baseDir) {
  const resolved = path.resolve(baseDir, targetPath);
  const base = path.resolve(baseDir);
  return resolved.startsWith(base);
}
```

### Environment Variables

```javascript
// Handle different path separators
const paths = process.env.ALLOWED_PATHS?.split(path.delimiter) || [];

// Platform-specific defaults
const getDefaultTempDir = () => {
  switch (process.platform) {
    case 'win32':
      return process.env.TEMP || process.env.TMP || 'C:\\tmp';
    case 'darwin':
    case 'linux':
      return process.env.TMPDIR || '/tmp';
    default:
      return '/tmp';
  }
};
```

### File System Operations

```javascript
import fs from 'fs/promises';

// Use fs/promises for cross-platform async operations
async function readFileOrDirectory(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    
    if (stats.isFile()) {
      return await fs.readFile(targetPath, 'utf8');
    } else if (stats.isDirectory()) {
      return await fs.readdir(targetPath);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Path not found: ${targetPath}`);
    }
    throw error;
  }
}
```

This development guide should help you build robust, secure, and maintainable Claude Desktop Extensions. Remember to test thoroughly across platforms and follow security best practices throughout your development process.