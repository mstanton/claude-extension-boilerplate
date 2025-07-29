# Claude Desktop Extension Boilerplate

## Project Structure
```
claude-extension-boilerplate/
├── README.md                    # Project documentation
├── package.json                 # Node.js dependencies and scripts
├── manifest.json               # Extension manifest (required)
├── icon.png                    # Extension icon (optional)
├── server/
│   ├── index.js                # Main MCP server entry point
│   └── tools/
│       ├── example-tool.js     # Example tool implementation
│       └── index.js            # Tools registry
├── examples/
│   ├── python/                 # Python server example
│   │   ├── manifest.json
│   │   ├── requirements.txt
│   │   └── server/
│       │   └── main.py
│   └── binary/                 # Binary server example
│       ├── manifest.json
│       └── server/
│           └── main.go
├── scripts/
│   ├── build.js               # Build script
│   └── validate.js            # Manifest validation
├── docs/
│   ├── development.md         # Development guide
│   └── deployment.md          # Deployment guide
└── .github/
    └── workflows/
        └── build.yml          # CI/CD workflow
```

## Quick Start

### Prerequisites
- Node.js 16+ installed
- Claude Desktop (latest version)
- DXT CLI tools: `npm install -g @anthropic-ai/dxt`

### Setup
```bash
# Clone this boilerplate
git clone <your-repo-url> my-claude-extension
cd my-claude-extension

# Install dependencies
npm install

# Initialize manifest (interactive)
npm run init

# Or copy from template
cp manifest.template.json manifest.json

# Build the extension
npm run build

# Test locally
npm run test-local
```

### Development Workflow
```bash
# Start development server with auto-reload
npm run dev

# Validate manifest
npm run validate

# Package for distribution
npm run pack

# Test the packed extension
npm run test-packed
```

## Package.json Scripts
The following scripts are available:

- `npm run init` - Initialize manifest interactively
- `npm run dev` - Start development server
- `npm run build` - Build the extension
- `npm run pack` - Package into .dxt file
- `npm run validate` - Validate manifest
- `npm run test-local` - Test in local Claude Desktop
- `npm run clean` - Clean build artifacts

## File Templates
All template files are included in this boilerplate:
- `manifest.json` - Complete manifest template
- `server/index.js` - MCP server implementation
- `README.template.md` - Documentation template
- Example implementations for Node.js, Python, and binary servers

## Customization Guide
1. Update `manifest.json` with your extension details
2. Implement your tools in `server/tools/`
3. Add user configuration if needed
4. Test thoroughly across platforms
5. Package and distribute

## Submission Checklist
- [ ] Manifest validates successfully
- [ ] Works on Windows and macOS
- [ ] Proper error handling implemented
- [ ] Documentation complete
- [ ] Security considerations addressed
- [ ] Follows Claude Desktop Extension guidelines