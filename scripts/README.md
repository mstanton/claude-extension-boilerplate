# Claude Desktop Extension Boilerplate

A comprehensive, production-ready boilerplate for creating Claude Desktop Extensions using the Model Context Protocol (MCP). This template provides everything you need to build, test, and distribute powerful extensions that enhance Claude Desktop's capabilities.

## 🚀 Features

- **Complete MCP Server Implementation** - Ready-to-use server with proper protocol handling
- **Example Tools** - Three fully-featured example tools showing best practices
- **Cross-Platform Support** - Works on Windows, macOS, and Linux
- **Development Tools** - Build scripts, validation, testing, and packaging utilities
- **Security Best Practices** - Path validation, input sanitization, and safe file handling
- **Comprehensive Documentation** - Detailed guides and inline code documentation
- **CI/CD Ready** - GitHub Actions workflow included
- **TypeScript Support** - Full TypeScript definitions and validation

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 16+** installed on your system
- **Claude Desktop** (latest version) installed
- **Git** for version control
- **DXT CLI Tools**: Install with `npm install -g @anthropic-ai/dxt`

## 🏗️ Quick Start

### 1. Get the Boilerplate

```bash
# Clone this repository
git clone https://github.com/your-username/claude-extension-boilerplate.git my-claude-extension
cd my-claude-extension

# Install dependencies
npm install
```

### 2. Configure Your Extension

```bash
# Interactive configuration (recommended)
npm run init

# Or manually edit manifest.json
cp manifest.json manifest.json.backup
# Edit manifest.json with your extension details
```

### 3. Customize and Build

```bash
# Develop with auto-reload
npm run dev

# Build the extension
npm run build

# Package for distribution
npm run pack
```

### 4. Test Your Extension

```bash
# Test locally in Claude Desktop
npm run test-local

# Test the packaged .dxt file
npm run test-packed
```

## 📁 Project Structure

```
claude-extension-boilerplate/
├── 📄 manifest.json              # Extension configuration
├── 📦 package.json              # Node.js project configuration
├── 🖼️ icon.png                  # Extension icon (optional)
├── 📖 README.md                 # This file
├── 📝 LICENSE                   # License file
│
├── 🖥️ server/                   # MCP Server implementation
│   ├── 📄 index.js              # Main server entry point
│   └── 🛠️ tools/                # Tool implementations
│       ├── 📄 index.js          # Tools registry
│       ├── 📄 example-tool.js   # Example tool with best practices
│       ├── 📄 file-processor-tool.js # File operations tool
│       └── 📄 system-info-tool.js    # System information tool
│
├── 🔧 scripts/                  # Build and utility scripts
│   ├── 📄 build.js              # Main build script
│   ├── 📄 validate.js           # Manifest validation
│   ├── 📄 test-local.js         # Local testing helper
│   └── 📄 test-packed.js        # Packaged extension testing
│
├── 📚 docs/                     # Documentation
│   ├── 📄 development.md        # Development guide
│   ├── 📄 deployment.md         # Deployment guide
│   └── 📄 api-reference.md      # API documentation
│
├── 🧪 test/                     # Test files
│   ├── 📄 server.test.js        # Server tests
│   └── 📄 tools.test.js         # Tool tests
│
├── 🎨 assets/                   # Static assets
│   └── 📸 screenshots/          # Extension screenshots
│
└── ⚙️ .github/                  # GitHub workflows
    └── 🔄 workflows/
        └── 📄 build.yml         # CI/CD pipeline
```

## 🛠️ Available Tools

This boilerplate includes three example tools that demonstrate different patterns:

### 1. Example Tool (`example_tool`)
Demonstrates comprehensive best practices:
- Input validation with Zod schemas
- Multiple operation modes
- Error handling and logging
- File system operations with security checks
- Structured response formatting

**Usage:**
```javascript
{
  "action": "greet|echo|file_info|system_info",
  "message": "Hello World",
  "file_path": "/path/to/file",
  "include_details": true
}
```

### 2. File Processor Tool (`file_processor`)
Provides secure file system operations:
- Read file contents with encoding options
- List directory contents (recursive support)
- Search for files with patterns
- Get file/directory statistics
- Path validation and security checks

**Usage:**
```javascript
{
  "operation": "read|list|search|stats",
  "path": "/allowed/path",
  "pattern": "*.js",
  "recursive": true,
  "max_size": 1048576
}
```

### 3. System Info Tool (`system_info`)
Retrieves comprehensive system information:
- OS and hardware details
- Process information
- Environment variables
- Network configuration
- Performance metrics

**Usage:**
```javascript
{
  "category": "overview|hardware|process|environment|network",
  "detailed": false
}
```

## 🔧 Development Workflow

### Daily Development

```bash
# Start development server with auto-reload
npm run dev

# In another terminal, test your changes
npm run test-local

# Validate manifest and code
npm run validate
npm run lint
```

### Building and Testing

```bash
# Full build process
npm run build          # Build the extension
npm run validate       # Validate all configurations
npm run test           # Run unit tests
npm run pack           # Create .dxt package

# Quick test cycle
npm run test-local     # Test current code
npm run test-packed    # Test packaged .dxt file
```

### Debugging

```bash
# Start server with debugging
npm run debug

# Enable detailed logging
ENABLE_LOGGING=true npm run dev

# View server logs
tail -f ~/.claude/logs/extensions/your-extension.log
```

## 📝 Customization Guide

### 1. Update Extension Metadata

Edit `manifest.json`:

```json
{
  "name": "your-extension-name",
  "display_name": "Your Awesome Extension",
  "description": "What your extension does",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  }
}
```

### 2. Configure User Settings

Define user-configurable options:

```json
{
  "user_config": {
    "api_key": {
      "type": "string",
      "title": "API Key",
      "description": "Your service API key",
      "sensitive": true,
      "required": true
    },
    "allowed_paths": {
      "type": "directory",
      "title": "Allowed Directories",
      "multiple": true,
      "required": true
    }
  }
}
```

### 3. Add New Tools

Create a new tool file in `server/tools/`:

```javascript
// server/tools/my-tool.js
import { z } from 'zod';

const inputSchema = z.object({
  // Define your input schema
});

async function execute(args) {
  const validatedArgs = inputSchema.parse(args);
  // Implement your tool logic
  return { success: true, result: "..." };
}

export const myTool = {
  name: 'my_tool',
  description: 'Description of what your tool does',
  inputSchema: {
    type: 'object',
    properties: {
      // JSON Schema for inputs
    },
    required: ['field1', 'field2']
  },
  execute,
};
```

Then register it in `server/tools/index.js`:

```javascript
import { myTool } from './my-tool.js';

export function registerTools() {
  return [
    exampleTool,
    fileProcessorTool,
    systemInfoTool,
    myTool, // Add your tool here
  ];
}
```

### 4. Handle User Configuration

Access user configuration in your tools:

```javascript
// Get user-configured API key
const apiKey = process.env.API_KEY;

// Get allowed directories
const allowedPaths = process.env.ALLOWED_PATHS?.split(',') || [];

// Check boolean settings
const loggingEnabled = process.env.ENABLE_LOGGING === 'true';
```

## 🔒 Security Best Practices

This boilerplate implements several security measures:

### Path Validation
```javascript
function isPathAllowed(targetPath) {
  const allowedPaths = process.env.ALLOWED_PATHS?.split(',') || [];
  const resolvedPath = path.resolve(targetPath);
  
  return allowedPaths.some(allowedPath => {
    const resolvedAllowedPath = path.resolve(allowedPath.trim());
    return resolvedPath.startsWith(resolvedAllowedPath);
  });
}
```

### Input Validation
```javascript
import { z } from 'zod';

const inputSchema = z.object({
  path: z.string().min(1).max(1000),
  size: z.number().min(1).max(100 * 1024 * 1024), // 100MB max
});
```

### Error Handling
```javascript
try {
  // Risky operation
} catch (error) {
  return {
    success: false,
    error: {
      message: error.message,
      code: error.code,
    }
  };
}
```

## 📊 Testing

### Unit Tests

Create tests in the `test/` directory:

```javascript
// test/my-tool.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { myTool } from '../server/tools/my-tool.js';

describe('My Tool', () => {
  it('should handle valid input', async () => {
    const result = await myTool.execute({ param: 'value' });
    assert.strictEqual(result.success, true);
  });
});
```

Run tests:
```bash
npm test
```

### Integration Testing

Test with Claude Desktop:

```bash
# Build and install locally
npm run build
npm run pack
npm run test-local

# The extension will be installed in Claude Desktop for testing
```

## 📦 Distribution

### Packaging

```bash
# Create distributable .dxt file
npm run pack

# This creates: your-extension-name-1.0.0.dxt
```

### Submission to Extension Directory

1. **Prepare for submission:**
   ```bash
   npm run build
   npm run validate
   npm run test
   npm run pack
   ```

2. **Test on multiple platforms:**
   - Windows
   - macOS  
   - Linux (if applicable)

3. **Submit via the form:**
   [Extension Submission Form](https://docs.google.com/forms/d/14_Dmcig4z8NeRMB_e7TOyrKzuZ88-BLYdLvS6LPhiZU/edit)

### Private Distribution

For private/internal extensions:

```bash
# Share the .dxt file directly
# Users can install by dragging to Claude Desktop Settings
```

## 🌐 Cross-Platform Support

This boilerplate supports platform-specific configurations:

```json
{
  "server": {
    "mcp_config": {
      "platforms": {
        "win32": {
          "command": "node.exe",
          "env": {
            "TEMP_DIR": "${TEMP}"
          }
        },
        "darwin": {
          "env": {
            "TEMP_DIR": "${TMPDIR}"
          }
        },
        "linux": {
          "env": {
            "TEMP_DIR": "/tmp"
          }
        }
      }
    }
  }
}
```

## 🤖 Using Claude Code

You can use Claude Code to build extensions based on this boilerplate:

```bash
# In your project directory
claude-code "Create a new tool for my Claude extension that can analyze CSV files and provide statistics"
```

Provide this context to Claude Code:

> I want to build this as a Desktop Extension, abbreviated as "DXT". Please follow these steps:
> 
> 1. **Read the specifications thoroughly:**
>    - https://github.com/anthropics/dxt/blob/main/README.md
>    - https://github.com/anthropics/dxt/blob/main/MANIFEST.md  
>    - https://github.com/anthropics/dxt/tree/main/examples
> 
> 2. **Create a proper extension structure** following the boilerplate patterns
> 3. **Follow best development practices** with proper error handling
> 4. **Test considerations** ensuring all tools work correctly

## 🆘 Troubleshooting

### Common Issues

**Extension won't install:**
- Check manifest.json syntax with `npm run validate`
- Ensure all required fields are present
- Verify entry_point file exists

**Tools not working:**
- Check allowed directories in user config
- Verify input schema matches tool expectations
- Enable logging: `ENABLE_LOGGING=true`

**Build failures:**
- Run `npm install` to ensure dependencies
- Check Node.js version (16+ required)
- Validate project structure with `npm run build`

### Getting Help

1. **Check the logs:**
   ```bash
   # Extension logs
   tail -f ~/.claude/logs/extensions/

   # Development logs
   ENABLE_LOGGING=true npm run dev
   ```

2. **Validate configuration:**
   ```bash
   npm run validate
   dxt validate
   ```

3. **Test incrementally:**
   ```bash
   npm run test
   npm run test-local
   ```

## 🤝 Contributing

We welcome contributions! Please:

1. Fork this repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Resources

- [Claude Desktop Extensions Official Docs](https://www.anthropic.com/engineering/desktop-extensions)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [DXT Specification](https://github.com/anthropics/dxt)
- [Extension Examples](https://github.com/anthropics/dxt/tree/main/examples)
- [Claude Desktop Support](https://support.anthropic.com)

## 🏷️ Tags

`claude` `desktop-extension` `mcp` `ai` `automation` `boilerplate` `template` `nodejs` `anthropic`

---

**Ready to build something amazing?** Start customizing this boilerplate and create your first Claude Desktop Extension! 🚀