#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Build script for Claude Desktop Extension
 * 
 * This script:
 * 1. Validates the project structure
 * 2. Checks the manifest file
 * 3. Installs dependencies if needed
 * 4. Runs tests
 * 5. Creates a distribution build
 */

class ExtensionBuilder {
  constructor() {
    this.buildDir = path.join(projectRoot, 'dist');
    this.manifestPath = path.join(projectRoot, 'manifest.json');
    this.packagePath = path.join(projectRoot, 'package.json');
  }

  /**
   * Run the complete build process
   */
  async build() {
    console.log('🔨 Starting Claude Desktop Extension build...\n');

    try {
      await this.validateProject();
      await this.checkDependencies();
      await this.validateManifest();
      await this.runTests();
      await this.createBuild();
      await this.validateBuild();
      
      console.log('\n✅ Build completed successfully!');
      console.log(`📦 Build output: ${this.buildDir}`);
      console.log('\n🚀 Next steps:');
      console.log('  npm run pack    # Package as .dxt file');
      console.log('  npm run test-local # Test in Claude Desktop');
      
    } catch (error) {
      console.error('\n❌ Build failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate project structure
   */
  async validateProject() {
    console.log('📋 Validating project structure...');

    const requiredFiles = [
      'manifest.json',
      'package.json',
      'server/index.js',
      'server/tools/index.js',
    ];

    const requiredDirs = [
      'server',
      'server/tools',
    ];

    // Check required directories
    for (const dir of requiredDirs) {
      const dirPath = path.join(projectRoot, dir);
      try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
          throw new Error(`${dir} is not a directory`);
        }
      } catch (error) {
        throw new Error(`Required directory missing: ${dir}`);
      }
    }

    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(projectRoot, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    console.log('  ✓ Project structure is valid');
  }

  /**
   * Check and install dependencies
   */
  async checkDependencies() {
    console.log('📦 Checking dependencies...');

    try {
      // Check if node_modules exists
      const nodeModulesPath = path.join(projectRoot, 'node_modules');
      await fs.access(nodeModulesPath);
      console.log('  ✓ Dependencies are installed');
    } catch (error) {
      console.log('  📥 Installing dependencies...');
      try {
        execSync('npm install', { 
          cwd: projectRoot, 
          stdio: 'inherit' 
        });
        console.log('  ✓ Dependencies installed successfully');
      } catch (installError) {
        throw new Error('Failed to install dependencies');
      }
    }
  }

  /**
   * Validate manifest file
   */
  async validateManifest() {
    console.log('📄 Validating manifest...');

    try {
      const manifestContent = await fs.readFile(this.manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      // Required fields
      const requiredFields = ['dxt_version', 'name', 'version', 'description', 'author', 'server'];
      
      for (const field of requiredFields) {
        if (!manifest[field]) {
          throw new Error(`Manifest missing required field: ${field}`);
        }
      }

      // Validate server configuration
      if (!manifest.server.type) {
        throw new Error('Manifest server.type is required');
      }

      if (!manifest.server.entry_point) {
        throw new Error('Manifest server.entry_point is required');
      }

      // Check if entry point exists
      const entryPointPath = path.join(projectRoot, manifest.server.entry_point);
      await fs.access(entryPointPath);

      // Validate DXT version
      if (manifest.dxt_version !== '0.1') {
        console.warn(`  ⚠️  DXT version ${manifest.dxt_version} may not be supported`);
      }

      console.log(`  ✓ Manifest is valid (v${manifest.version})`);
      return manifest;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('manifest.json not found');
      } else if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in manifest.json: ${error.message}`);
      } else {
        throw new Error(`Manifest validation failed: ${error.message}`);
      }
    }
  }

  /**
   * Run tests
   */
  async runTests() {
    console.log('🧪 Running tests...');

    try {
      // Check if test directory exists
      const testPath = path.join(projectRoot, 'test');
      try {
        await fs.access(testPath);
        execSync('npm test', { 
          cwd: projectRoot, 
          stdio: 'inherit' 
        });
        console.log('  ✓ All tests passed');
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.log('  ⚠️  No tests found, skipping...');
        } else {
          throw error;
        }
      }
    } catch (error) {
      throw new Error('Tests failed');
    }
  }

  /**
   * Create build distribution
   */
  async createBuild() {
    console.log('🏗️  Creating build...');

    // Clean existing build
    try {
      await fs.rm(this.buildDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }

    // Create build directory
    await fs.mkdir(this.buildDir, { recursive: true });

    // Copy essential files
    const filesToCopy = [
      'manifest.json',
      'package.json',
      'README.md',
      'LICENSE',
    ];

    for (const file of filesToCopy) {
      const srcPath = path.join(projectRoot, file);
      const destPath = path.join(this.buildDir, file);
      
      try {
        await fs.copyFile(srcPath, destPath);
        console.log(`  ✓ Copied ${file}`);
      } catch (error) {
        if (file === 'LICENSE' || file === 'README.md') {
          console.log(`  ⚠️  ${file} not found, skipping...`);
        } else {
          throw new Error(`Failed to copy ${file}: ${error.message}`);
        }
      }
    }

    // Copy directories
    const dirsToCopy = [
      'server',
      'assets',
      'docs',
    ];

    for (const dir of dirsToCopy) {
      const srcPath = path.join(projectRoot, dir);
      const destPath = path.join(this.buildDir, dir);
      
      try {
        await this.copyDirectory(srcPath, destPath);
        console.log(`  ✓ Copied ${dir}/`);
      } catch (error) {
        if (dir === 'assets' || dir === 'docs') {
          console.log(`  ⚠️  ${dir}/ not found, skipping...`);
        } else {
          throw new Error(`Failed to copy ${dir}: ${error.message}`);
        }
      }
    }

    // Copy icon if it exists
    const iconFiles = ['icon.png', 'icon.svg', 'icon.ico'];
    for (const iconFile of iconFiles) {
      const srcPath = path.join(projectRoot, iconFile);
      const destPath = path.join(this.buildDir, iconFile);
      
      try {
        await fs.copyFile(srcPath, destPath);
        console.log(`  ✓ Copied ${iconFile}`);
        break; // Only copy the first icon found
      } catch (error) {
        // Continue to next icon file
      }
    }

    // Create build info
    const buildInfo = {
      built_at: new Date().toISOString(),
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
    };
    
    await fs.writeFile(
      path.join(this.buildDir, 'build-info.json'),
      JSON.stringify(buildInfo, null, 2)
    );

    console.log('  ✓ Build created successfully');
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
   * Validate the created build
   */
  async validateBuild() {
    console.log('🔍 Validating build...');

    // Check that required files exist in build
    const requiredInBuild = [
      'manifest.json',
      'server/index.js',
      'build-info.json',
    ];

    for (const file of requiredInBuild) {
      const filePath = path.join(this.buildDir, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new Error(`Build validation failed: ${file} missing from build`);
      }
    }

    // Validate that the manifest in build is valid JSON
    try {
      const manifestContent = await fs.readFile(path.join(this.buildDir, 'manifest.json'), 'utf8');
      JSON.parse(manifestContent);
    } catch (error) {
      throw new Error('Build validation failed: Invalid manifest.json in build');
    }

    console.log('  ✓ Build validation passed');
  }
}

// Run the build if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const builder = new ExtensionBuilder();
  builder.build().catch((error) => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

export { ExtensionBuilder };