#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Comprehensive validation script for Claude Desktop Extension
 * 
 * Validates:
 * - Manifest structure and content
 * - Project file structure
 * - Tool definitions
 * - Cross-platform compatibility
 * - Security configurations
 */

class ExtensionValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.manifestPath = path.join(projectRoot, 'manifest.json');
    this.packagePath = path.join(projectRoot, 'package.json');
  }

  /**
   * Run all validations
   */
  async validate() {
    console.log('🔍 Validating Claude Desktop Extension...\n');

    try {
      await this.validateProjectStructure();
      const manifest = await this.validateManifest();
      await this.validatePackageJson();
      await this.validateTools(manifest);
      await this.validateSecurity(manifest);
      await this.validateCompatibility(manifest);
      
      this.printResults();
      
      if (this.errors.length > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Add error to the list
   */
  addError(message) {
    this.errors.push(message);
  }

  /**
   * Add warning to the list
   */
  addWarning(message) {
    this.warnings.push(message);
  }

  /**
   * Validate project file structure
   */
  async validateProjectStructure() {
    console.log('📁 Validating project structure...');

    const requiredFiles = [
      'manifest.json',
      'package.json',
      'server/index.js',
      'README.md'
    ];

    const requiredDirectories = [
      'server',
      'server/tools'
    ];

    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(projectRoot, file);
      try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
          this.addError(`${file} exists but is not a file`);
        }
      } catch (error) {
        this.addError(`Required file missing: ${file}`);
      }
    }

    // Check required directories
    for (const dir of requiredDirectories) {
      const dirPath = path.join(projectRoot, dir);
      try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
          this.addError(`${dir} exists but is not a directory`);
        }
      } catch (error) {
        this.addError(`Required directory missing: ${dir}`);
      }
    }

    // Check optional but recommended files
    const recommendedFiles = ['LICENSE', 'icon.png', '.gitignore'];
    for (const file of recommendedFiles) {
      const filePath = path.join(projectRoot, file);
      try {
        await fs.access(filePath);
      } catch (error) {
        this.addWarning(`Recommended file missing: ${file}`);
      }
    }

    console.log('  ✓ Project structure validation complete');
  }

  /**
   * Validate manifest.json
   */
  async validateManifest() {
    console.log('📄 Validating manifest.json...');

    let manifest;
    try {
      const manifestContent = await fs.readFile(this.manifestPath, 'utf8');
      manifest = JSON.parse(manifestContent);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.addError('manifest.json not found');
        return null;
      } else if (error instanceof SyntaxError) {
        this.addError(`Invalid JSON in manifest.json: ${error.message}`);
        return null;
      } else {
        this.addError(`Could not read manifest.json: ${error.message}`);
        return null;
      }
    }

    // Validate required fields
    const requiredFields = [
      'dxt_version',
      'name', 
      'version',
      'description',
      'author',
      'server'
    ];

    for (const field of requiredFields) {
      if (!manifest[field]) {
        this.addError(`Manifest missing required field: ${field}`);
      }
    }

    // Validate DXT version
    if (manifest.dxt_version !== '0.1') {
      this.addWarning(`DXT version ${manifest.dxt_version} may not be fully supported`);
    }

    // Validate name format
    if (manifest.name && !/^[a-z0-9-_]+$/.test(manifest.name)) {
      this.addError('Manifest name must contain only lowercase letters, numbers, hyphens, and underscores');
    }

    // Validate version format (semver)
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      this.addError('Manifest version must follow semantic versioning (e.g., 1.0.0)');
    }

    // Validate author structure
    if (manifest.author) {
      if (typeof manifest.author === 'string') {
        this.addWarning('Author should be an object with name, email, and url fields');
      } else if (typeof manifest.author === 'object') {
        if (!manifest.author.name) {
          this.addError('Author object must have a name field');
        }
        if (manifest.author.email && !this.isValidEmail(manifest.author.email)) {
          this.addError('Author email is not valid');
        }
      }
    }

    // Validate server configuration
    if (manifest.server) {
      if (!manifest.server.type) {
        this.addError('Server type is required');
      } else if (!['node', 'python', 'binary'].includes(manifest.server.type)) {
        this.addError('Server type must be "node", "python", or "binary"');
      }

      if (!manifest.server.entry_point) {
        this.addError('Server entry_point is required');
      } else {
        // Check if entry point file exists
        const entryPath = path.join(projectRoot, manifest.server.entry_point);
        try {
          await fs.access(entryPath);
        } catch (error) {
          this.addError(`Server entry_point file does not exist: ${manifest.server.entry_point}`);
        }
      }

      // Validate MCP config
      if (!manifest.server.mcp_config) {
        this.addError('Server mcp_config is required');
      } else {
        const mcpConfig = manifest.server.mcp_config;
        if (!mcpConfig.command) {
          this.addError('MCP config command is required');
        }
        if (!mcpConfig.args || !Array.isArray(mcpConfig.args)) {
          this.addError('MCP config args must be an array');
        }
      }
    }

    // Validate tools array
    if (manifest.tools && Array.isArray(manifest.tools)) {
      for (const [index, tool] of manifest.tools.entries()) {
        if (!tool.name) {
          this.addError(`Tool at index ${index} missing name`);
        }
        if (!tool.description) {
          this.addError(`Tool at index ${index} missing description`);
        }
      }
    }

    // Validate user config
    if (manifest.user_config) {
      for (const [key, config] of Object.entries(manifest.user_config)) {
        if (!config.type) {
          this.addError(`User config "${key}" missing type`);
        }
        if (!config.title) {
          this.addWarning(`User config "${key}" missing title`);
        }
        if (!config.description) {
          this.addWarning(`User config "${key}" missing description`);
        }
        
        // Validate type-specific properties
        if (config.type === 'string' && config.enum && !Array.isArray(config.enum)) {
          this.addError(`User config "${key}" enum must be an array`);
        }
        if (config.type === 'number') {
          if (config.min !== undefined && typeof config.min !== 'number') {
            this.addError(`User config "${key}" min must be a number`);
          }
          if (config.max !== undefined && typeof config.max !== 'number') {
            this.addError(`User config "${key}" max must be a number`);
          }
        }
      }
    }

    console.log('  ✓ Manifest validation complete');
    return manifest;
  }

  /**
   * Validate package.json
   */
  async validatePackageJson() {
    console.log('📦 Validating package.json...');

    let packageJson;
    try {
      const packageContent = await fs.readFile(this.packagePath, 'utf8');
      packageJson = JSON.parse(packageContent);
    } catch (error) {
      this.addError(`Could not read or parse package.json: ${error.message}`);
      return;
    }

    // Check for required scripts
    const requiredScripts = ['build', 'pack', 'validate'];
    if (packageJson.scripts) {
      for (const script of requiredScripts) {
        if (!packageJson.scripts[script]) {
          this.addWarning(`Missing recommended script: ${script}`);
        }
      }
    } else {
      this.addWarning('No scripts defined in package.json');
    }

    // Check for MCP SDK dependency
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (!dependencies['@modelcontextprotocol/sdk']) {
      this.addError('Missing required dependency: @modelcontextprotocol/sdk');
    }

    // Check Node.js version requirement
    if (packageJson.engines && packageJson.engines.node) {
      const nodeVersion = packageJson.engines.node;
      if (!nodeVersion.includes('16')) {
        this.addWarning('Consider requiring Node.js 16+ for better compatibility');
      }
    } else {
      this.addWarning('Consider specifying Node.js version in engines field');
    }

    console.log('  ✓ Package.json validation complete');
  }

  /**
   * Validate tool implementations
   */
  async validateTools(manifest) {
    console.log('🛠️  Validating tools...');

    if (!manifest) return;

    try {
      // Try to import and validate tools registry
      const toolsIndexPath = path.join(projectRoot, 'server/tools/index.js');
      await fs.access(toolsIndexPath);

      // For now, just check that the file exists and can be read
      const toolsContent = await fs.readFile(toolsIndexPath, 'utf8');
      
      if (!toolsContent.includes('registerTools')) {
        this.addError('Tools index.js must export a registerTools function');
      }

      if (!toolsContent.includes('export')) {
        this.addError('Tools index.js must use ES modules (export statements)');
      }

      // Check that manifest tools match available tool files
      if (manifest.tools) {
        for (const tool of manifest.tools) {
          const toolFileName = `${tool.name.replace(/_/g, '-')}-tool.js`;
          const toolFilePath = path.join(projectRoot, 'server/tools', toolFileName);
          
          try {
            await fs.access(toolFilePath);
          } catch (error) {
            this.addWarning(`Tool file not found for "${tool.name}": expected ${toolFileName}`);
          }
        }
      }

    } catch (error) {
      this.addError('Could not validate tools: server/tools/index.js not found or not readable');
    }

    console.log('  ✓ Tools validation complete');
  }

  /**
   * Validate security configurations
   */
  async validateSecurity(manifest) {
    console.log('🔒 Validating security configuration...');

    if (!manifest) return;

    // Check for sensitive data in manifest
    const manifestStr = JSON.stringify(manifest, null, 2);
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /api[_-]?key/i,
      /token/i,
      /credential/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(manifestStr)) {
        this.addWarning('Manifest may contain sensitive data - ensure secrets are in user_config with "sensitive": true');
      }
    }

    // Check user config for proper sensitive field marking
    if (manifest.user_config) {
      for (const [key, config] of Object.entries(manifest.user_config)) {
        const keyLower = key.toLowerCase();
        const titleLower = (config.title || '').toLowerCase();
        const descLower = (config.description || '').toLowerCase();
        
        const isSensitive = sensitivePatterns.some(pattern => 
          pattern.test(keyLower) || pattern.test(titleLower) || pattern.test(descLower)
        );
        
        if (isSensitive && !config.sensitive) {
          this.addWarning(`User config "${key}" appears to be sensitive but "sensitive": true is not set`);
        }
      }
    }

    // Check for file system access configuration
    if (manifest.user_config) {
      let hasDirectoryConfig = false;
      for (const config of Object.values(manifest.user_config)) {
        if (config.type === 'directory') {
          hasDirectoryConfig = true;
          break;
        }
      }
      
      if (!hasDirectoryConfig) {
        this.addWarning('Consider adding directory configuration for file system access');
      }
    }

    console.log('  ✓ Security validation complete');
  }

  /**
   * Validate cross-platform compatibility
   */
  async validateCompatibility(manifest) {
    console.log('🌐 Validating cross-platform compatibility...');

    if (!manifest || !manifest.server) return;

    const mcpConfig = manifest.server.mcp_config;
    if (!mcpConfig) return;

    // Check for platform-specific configurations
    if (mcpConfig.platforms) {
      const supportedPlatforms = ['win32', 'darwin', 'linux'];
      const configuredPlatforms = Object.keys(mcpConfig.platforms);
      
      for (const platform of configuredPlatforms) {
        if (!supportedPlatforms.includes(platform)) {
          this.addWarning(`Unknown platform in config: ${platform}`);
        }
      }

      // Check Windows-specific config
      if (mcpConfig.platforms.win32) {
        const winConfig = mcpConfig.platforms.win32;
        if (manifest.server.type === 'node' && !winConfig.command?.includes('.exe')) {
          this.addWarning('Windows Node.js command should typically use node.exe');
        }
      }
    } else {
      this.addWarning('Consider adding platform-specific configurations for better compatibility');
    }

    // Check compatibility declaration
    if (manifest.compatibility) {
      if (manifest.compatibility.platforms) {
        const declaredPlatforms = manifest.compatibility.platforms;
        if (!Array.isArray(declaredPlatforms)) {
          this.addError('Compatibility platforms must be an array');
        } else if (declaredPlatforms.length === 0) {
          this.addWarning('No platforms declared in compatibility');
        }
      }

      if (manifest.compatibility.runtimes) {
        const runtimes = manifest.compatibility.runtimes;
        if (manifest.server.type === 'node' && !runtimes.node) {
          this.addWarning('Node.js runtime version not specified in compatibility');
        }
        if (manifest.server.type === 'python' && !runtimes.python) {
          this.addWarning('Python runtime version not specified in compatibility');
        }
      }
    } else {
      this.addWarning('Consider adding compatibility information');
    }

    console.log('  ✓ Compatibility validation complete');
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('\n📊 Validation Results:');
    console.log('='.repeat(50));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All validations passed! Your extension looks great.');
      return;
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ Errors (${this.errors.length}):`);
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${this.warnings.length}):`);
      this.warnings.forEach((warning, index) => {
        console.log(`  ${index + 1}. ${warning}`);
      });
    }

    console.log('\n' + '='.repeat(50));
    
    if (this.errors.length > 0) {
      console.log('❌ Validation failed. Please fix the errors above.');
    } else {
      console.log('✅ Validation passed with warnings. Consider addressing them for better quality.');
    }
  }
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ExtensionValidator();
  validator.validate().catch((error) => {
    console.error('Validation error:', error);
    process.exit(1);
  });
}

export { ExtensionValidator };