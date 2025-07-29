import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exampleTool } from '../server/tools/example-tool.js';
import { fileProcessorTool } from '../server/tools/file-processor-tool.js';
import { systemInfoTool } from '../server/tools/system-info-tool.js';

/**
 * Unit tests for individual tools
 * 
 * These tests verify:
 * - Tool input validation
 * - Tool execution logic
 * - Error handling
 * - Security constraints
 */

describe('Example Tool', () => {
  before(() => {
    process.env.ALLOWED_PATHS = path.join(os.tmpdir(), 'test-extension');
  });

  after(() => {
    delete process.env.ALLOWED_PATHS;
  });

  describe('Greet Action', () => {
    it('should greet with default message', async () => {
      const result = await exampleTool.execute({ action: 'greet' });
      
      assert.ok(result.success);
      assert.equal(result.action, 'greet');
      assert.ok(result.result.greeting.includes('Hello'));
    });

    it('should greet with custom message', async () => {
      const result = await exampleTool.execute({ 
        action: 'greet', 
        message: 'Claude' 
      });
      
      assert.ok(result.success);
      assert.ok(result.result.greeting.includes('Claude'));
    });

    it('should include details when requested', async () => {
      const result = await exampleTool.execute({ 
        action: 'greet', 
        message: 'Test',
        include_details: true 
      });
      
      assert.ok(result.success);
      assert.ok(result.result.details);
      assert.ok(typeof result.result.details.message_length === 'number');
    });
  });

  describe('Echo Action', () => {
    it('should echo message', async () => {
      const testMessage = 'Hello, World!';
      const result = await exampleTool.execute({ 
        action: 'echo', 
        message: testMessage 
      });
      
      assert.ok(result.success);
      assert.equal(result.result.echo, testMessage);
    });

    it('should provide detailed analysis when requested', async () => {
      const result = await exampleTool.execute({ 
        action: 'echo', 
        message: 'Hello World',
        include_details: true 
      });
      
      assert.ok(result.success);
      assert.ok(result.result.details);
      assert.equal(result.result.details.character_count, 11);
      assert.equal(result.result.details.word_count, 2);
    });
  });

  describe('System Info Action', () => {
    it('should return system information', async () => {
      const result = await exampleTool.execute({ action: 'system_info' });
      
      assert.ok(result.success);
      assert.ok(result.result.platform);
      assert.ok(result.result.architecture);
      assert.ok(result.result.node_version);
    });

    it('should include details when requested', async () => {
      const result = await exampleTool.execute({ 
        action: 'system_info',
        include_details: true 
      });
      
      assert.ok(result.success);
      assert.ok(result.result.details);
      assert.ok(result.result.details.hostname);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid action', async () => {
      const result = await exampleTool.execute({ action: 'invalid_action' });
      
      assert.equal(result.success, false);
      assert.ok(result.error);
    });

    it('should handle missing file_path for file_info', async () => {
      const result = await exampleTool.execute({ action: 'file_info' });
      
      assert.equal(result.success, false);
      assert.ok(result.error.message.includes('file_path is required'));
    });
  });

  describe('Metadata', () => {
    it('should include execution metadata', async () => {
      const result = await exampleTool.execute({ action: 'greet' });
      
      assert.ok(result.metadata);
      assert.ok(typeof result.metadata.execution_time_ms === 'number');
      assert.ok(result.metadata.timestamp);
    });
  });
});

describe('File Processor Tool', () => {
  let testDir;
  let testFile;

  before(async () => {
    // Create test directory and file
    testDir = path.join(os.tmpdir(), 'test-extension-files');
    await fs.mkdir(testDir, { recursive: true });
    
    testFile = path.join(testDir, 'test.txt');
    await fs.writeFile(testFile, 'Hello, World!\nThis is a test file.');
    
    process.env.ALLOWED_PATHS = testDir;
  });

  after(async () => {
    // Cleanup
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    delete process.env.ALLOWED_PATHS;
  });

  describe('Read Operation', () => {
    it('should read file contents', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'read',
        path: testFile
      });
      
      assert.ok(result.success);
      assert.ok(result.content.includes('Hello, World!'));
      assert.equal(result.encoding, 'utf8');
    });

    it('should respect max_size limit', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'read',
        path: testFile,
        max_size: 10 // Very small limit
      });
      
      assert.equal(result.success, false);
      assert.ok(result.error.message.includes('exceeds maximum'));
    });

    it('should handle non-existent files', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'read',
        path: path.join(testDir, 'nonexistent.txt')
      });
      
      assert.equal(result.success, false);
    });
  });

  describe('List Operation', () => {
    it('should list directory contents', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'list',
        path: testDir
      });
      
      assert.ok(result.success);
      assert.ok(Array.isArray(result.entries));
      assert.ok(result.entries.some(entry => entry.name === 'test.txt'));
    });

    it('should provide summary information', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'list',
        path: testDir
      });
      
      assert.ok(result.success);
      assert.ok(result.summary);
      assert.ok(typeof result.summary.total === 'number');
      assert.ok(typeof result.summary.files === 'number');
    });
  });

  describe('Search Operation', () => {
    it('should search for files by pattern', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'search',
        path: testDir,
        pattern: '.*\\.txt'
      });
      
      assert.ok(result.success);
      assert.ok(Array.isArray(result.matches));
      assert.ok(result.matches.some(match => match.name === 'test.txt'));
    });

    it('should require pattern for search', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'search',
        path: testDir
      });
      
      assert.equal(result.success, false);
      assert.ok(result.error.message.includes('pattern is required'));
    });
  });

  describe('Stats Operation', () => {
    it('should get file statistics', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'stats',
        path: testFile
      });
      
      assert.ok(result.success);
      assert.equal(result.exists, true);
      assert.equal(result.is_file, true);
      assert.ok(result.size_bytes > 0);
    });

    it('should handle non-existent files', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'stats',
        path: path.join(testDir, 'nonexistent.txt')
      });
      
      assert.ok(result.success);
      assert.equal(result.exists, false);
    });
  });

  describe('Security', () => {
    it('should reject access outside allowed paths', async () => {
      const result = await fileProcessorTool.execute({
        operation: 'read',
        path: '/etc/passwd' // Should be outside allowed paths
      });
      
      assert.equal(result.success, false);
      assert.ok(result.error.message.includes('Access denied'));
    });
  });
});

describe('System Info Tool', () => {
  describe('Overview Category', () => {
    it('should return system overview', async () => {
      const result = await systemInfoTool.execute({ category: 'overview' });
      
      assert.ok(result.success);
      assert.ok(result.data.platform);
      assert.ok(result.data.architecture);
      assert.ok(result.data.node_version);
    });

    it('should include detailed info when requested', async () => {
      const result = await systemInfoTool.execute({ 
        category: 'overview',
        detailed: true 
      });
      
      assert.ok(result.success);
      assert.ok(result.data.detailed);
    });
  });

  describe('Hardware Category', () => {
    it('should return hardware information', async () => {
      const result = await systemInfoTool.execute({ category: 'hardware' });
      
      assert.ok(result.success);
      assert.ok(result.data.cpu);
      assert.ok(result.data.memory);
      assert.ok(typeof result.data.cpu.cores === 'number');
    });
  });

  describe('Process Category', () => {
    it('should return process information', async () => {
      const result = await systemInfoTool.execute({ category: 'process' });
      
      assert.ok(result.success);
      assert.ok(typeof result.data.pid === 'number');
      assert.ok(result.data.memory_usage);
    });
  });

  describe('Environment Category', () => {
    it('should return environment information', async () => {
      const result = await systemInfoTool.execute({ category: 'environment' });
      
      assert.ok(result.success);
      assert.ok(typeof result.data.variable_count === 'number');
      assert.ok(result.data.variables);
    });

    it('should filter sensitive variables', async () => {
      const result = await systemInfoTool.execute({ 
        category: 'environment',
        detailed: true 
      });
      
      assert.ok(result.success);
      // Should not contain passwords or secrets in safe variables
      const safeVarsStr = JSON.stringify(result.data.variables);
      assert.ok(!safeVarsStr.toLowerCase().includes('password'));
    });
  });

  describe('Network Category', () => {
    it('should return network information', async () => {
      const result = await systemInfoTool.execute({ category: 'network' });
      
      assert.ok(result.success);
      assert.ok(typeof result.data.interface_count === 'number');
      assert.ok(Array.isArray(result.data.interface_names));
    });
  });

  describe('Input Validation', () => {
    it('should handle invalid category', async () => {
      const result = await systemInfoTool.execute({ category: 'invalid' });
      
      assert.equal(result.success, false);
      assert.ok(result.error);
    });

    it('should use default category when none provided', async () => {
      const result = await systemInfoTool.execute({});
      
      assert.ok(result.success);
      assert.equal(result.category, 'overview');
    });
  });
});