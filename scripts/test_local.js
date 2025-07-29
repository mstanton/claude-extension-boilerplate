#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Local Testing Helper for Claude Desktop Extension
 * 
 * This script helps test the extension locally by:
 * 1. Building the extension
 * 2. Creating a temporary installation
 * 3. Providing testing instructions
 * 4. Simulating the Claude Desktop environment
 */

class LocalTester {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'claude-extension-test');
    this.manifestPath = path.join(projectRoot, 'manifest.json');
  }

  /**
   * Run local testing setup
   */
  async test() {
    console.log('🧪 Setting up local testing environment...\n');

    try {
      await this.validatePrerequisites();
      const manifest = await this.loadManifest();
      await this.buildExtension();
      await this.setupTestEnvironment(manifest);
      await this.runBasicTests(manifest);
      this.printTestingInstructions(manifest);
      
    } catch (error) {
      console.error('❌ Local testing setup failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate prerequisites for testing
   */
  async validatePrerequisites() {
    console.log('🔍 Validating prerequisites...');

    // Check if Claude Desktop is installed
    const claudePaths = this.getClaudeDesktopPaths();
    let claudeFound = false;

    for (const claudePath of claudePaths) {
      try {
        await fs.access(claudePath);
        claudeFound = true;
        console.log(`  ✓ Claude Desktop found at: ${claudePath}`);
        break;
      } catch (error) {
        // Continue checking other paths
      }
    }

    if (!claudeFound) {
      console.log('  ⚠️  Claude Desktop not found in standard locations');
      console.log('     Please ensure Claude Desktop is installed');
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 16) {
      throw new Error(`Node.js 16+ required, found ${nodeVersion}`);
    }
    
    console.log(`  ✓ Node.js version: ${nodeVersion}`);

    // Check for DXT CLI
    try {
      execSync('dxt --version', { stdio: 'ignore' });
      console.log('  ✓ DXT CLI is available');
    } catch (error) {
      console.log('  ⚠️  DXT CLI not found. Install with: npm install -g @anthropic-ai/dxt');
    }
  }

  /**
   * Get possible Claude Desktop installation paths
   */
  getClaudeDesktopPaths() {
    const platform = process.platform;
    const home = os.homedir();

    switch (platform) {
      case 'darwin':
        return [
          '/Applications/Claude.app',
          path.join(home, 'Applications/Claude.app')
        ];
      case 'win32':
        return [
          path.join(home, 'AppData/Local/Claude/Claude.exe'),
          'C:/Program Files/Claude/Claude.exe',
          'C:/Program Files (x86)/Claude/Claude.exe'
        ];
      case 'linux':
        return [
          '/usr/bin/claude',
          '/usr/local/bin/claude',
          path.join(home, '.local/bin/claude')
        ];
      default:
        return [];
    }
  }

  /**
   * Load and validate manifest
   */
  async loadManifest() {
    console.log('📄 Loading manifest...');

    try {
      const manifestContent = await fs.readFile(this.manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);
      
      console.log(`  ✓ Loaded manifest for: ${manifest.display_name || manifest.name}`);
      console.log(`  ✓ Version: ${manifest.version}`);
      
      return manifest;
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`);
    }
  }

  /**
   * Build the extension
   */
  async buildExtension() {
    console.log('🔨 Building extension...');

    try {
      execSync('npm run build', { 
        cwd: projectRoot, 
        stdio: 'inherit' 
      });
      console.log('  ✓ Extension built successfully');
    } catch (error) {
      throw new Error('Build failed. Please fix build errors and try again.');
    }
  }

  /**
   * Setup temporary testing environment
   */
  async setupTestEnvironment(manifest) {
    console.log('🏗️  Setting up test environment...');

    // Create temp directory
    await fs.mkdir(this.tempDir, { recursive: true });
    console.log(`  ✓ Created test directory: ${this.tempDir}`);

    // Copy built extension
    const buildDir = path.join(projectRoot, 'dist');
    await this.copyDirectory(buildDir, this.tempDir);
    console.log('  ✓ Copied extension files');

    // Create test configuration
    await this.createTestConfig(manifest);
    console.log('  ✓ Created test configuration');

    // Create sample test files
    await this.createTestFiles();
    console.log('  ✓ Created sample test files');
  }

  /**
   * Copy directory recursively
   */
  async copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    
    const entries = await fs.readdir(src, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Create test configuration
   */
  async createTestConfig(manifest) {
    const testDataDir = path.join(this.tempDir, 'test-data');
    await fs.mkdir(testDataDir, { recursive: true });

    // Create environment variables for testing
    const testEnv = {
      NODE_ENV: 'development',
      ENABLE_LOGGING: 'true',
      ALLOWED_PATHS: testDataDir,
    };

    // Add user config defaults
    if (manifest.user_config) {
      for (const [key, config] of Object.entries(manifest.user_config)) {
        if (config.default) {
          const envKey = key.toUpperCase();
          if (config.type === 'directory') {
            testEnv[envKey] = Array.isArray(config.default) 
              ? config.default.join(',') 
              : config.default;
          } else {
            testEnv[envKey] = config.default;
          }
        }
      }
    }

    const envFile = path.join(this.tempDir, 'test.env');
    const envContent = Object.entries(testEnv)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    await fs.writeFile(envFile, envContent);

    // Create a test script
    const testScript = `#!/usr/bin/env node

// Load environment variables
const envContent = require('fs').readFileSync('${envFile}', 'utf8');
envContent.split('\\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key] = value;
  }
});

// Start the extension server
require('./server/index.js');
`;

    await fs.writeFile(path.join(this.tempDir, 'test-server.js'), testScript);
  }

  /**
   * Create sample test files
   */
  async createTestFiles() {
    const testDataDir = path.join(this.tempDir, 'test-data');
    
    // Create sample text file
    await fs.writeFile(
      path.join(testDataDir, 'sample.txt'),
      'Hello, Claude Desktop Extension!\nThis is a sample file for testing.'
    );

    // Create sample JSON file
    const sampleData = {
      name: 'Test Data',
      version: '1.0.0',
      description: 'Sample data for testing the extension',
      items: [
        { id: 1, name: 'Item 1', value: 100 },
        { id: 2, name: 'Item 2', value: 200 },
        { id: 3, name: 'Item 3', value: 300 }
      ]
    };
    
    await fs.writeFile(
      path.join(testDataDir, 'sample.json'),
      JSON.stringify(sampleData, null, 2)
    );

    // Create a subdirectory with more files
    const subDir = path.join(testDataDir, 'subdirectory');
    await fs.mkdir(subDir, { recursive: true });
    
    await fs.writeFile(
      path.join(subDir, 'nested-file.txt'),
      'This file is in a subdirectory for testing recursive operations.'
    );
  }

  /**
   * Run basic functionality tests
   */
  async runBasicTests(manifest) {
    console.log('🧪 Running basic tests...');

    try {
      // Test manifest validation
      execSync('npm run validate', { 
        cwd: projectRoot, 
        stdio: 'pipe' 
      });
      console.log('  ✓ Manifest validation passed');

      // Test server can start (quick test)
      const testEnv = {
        ...process.env,
        ALLOWED_PATHS: path.join(this.tempDir, 'test-data'),
        ENABLE_LOGGING: 'false'
      };

      // Simple syntax check
      const serverPath = path.join(this.tempDir, 'server/index.js');
      execSync(`node --check "${serverPath}"`, { 
        env: testEnv,
        stdio: 'pipe' 
      });
      console.log('  ✓ Server syntax check passed');

    } catch (error) {
      console.log('  ⚠️  Some basic tests failed - check the extension carefully');
      console.log(`     Error: ${error.message}`);
    }
  }

  /**
   * Print testing instructions
   */
  printTestingInstructions(manifest) {
    console.log('\n🎯 Local Testing Instructions:');
    console.log('='.repeat(50));
    
    console.log('\n📁 Test Environment:');
    console.log(`   Location: ${this.tempDir}`);
    console.log(`   Test Data: ${path.join(this.tempDir, 'test-data')}`);
    console.log(`   Configuration: ${path.join(this.tempDir, 'test.env')}`);

    console.log('\n🔧 Manual Testing:');
    console.log('1. Start the server manually:');
    console.log(`   cd "${this.tempDir}"`);
    console.log('   node test-server.js');
    
    console.log('\n2. Test individual tools:');
    if (manifest.tools) {
      manifest.tools.forEach(tool => {
        console.log(`   • ${tool.name}: ${tool.description}`);
      });
    }

    console.log('\n📦 Claude Desktop Testing:');
    console.log('1. Package the extension:');
    console.log('   npm run pack');
    
    console.log('\n2. Install in Claude Desktop:');
    console.log('   • Open Claude Desktop Settings');
    console.log('   • Go to Extensions section');
    console.log('   • Drag and drop the .dxt file');
    console.log('   • Configure required settings');
    
    console.log('\n3. Test the extension:');
    console.log('   • Try each tool with sample data');
    console.log('   • Test error conditions');
    console.log('   • Verify security constraints');

    console.log('\n🐛 Debugging:');
    console.log('   • Check logs in Claude Desktop Settings');
    console.log('   • Enable logging in extension config');
    console.log('   • Use the test server for debugging');

    console.log('\n🧹 Cleanup:');
    console.log(`   rm -rf "${this.tempDir}"`);
    
    console.log('\n✅ Happy testing! 🚀');
  }

  /**
   * Cleanup test environment
   */
  async cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      console.log('🧹 Cleaned up test environment');
    } catch (error) {
      console.log('⚠️  Failed to cleanup test environment:', error.message);
    }
  }
}

// Run local testing if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new LocalTester();
  
  // Handle cleanup on exit
  process.on('SIGINT', async () => {
    console.log('\n🛑 Interrupted, cleaning up...');
    await tester.cleanup();
    process.exit(0);
  });

  tester.test().catch((error) => {
    console.error('Local testing failed:', error);
    process.exit(1);
  });
}

export { LocalTester };