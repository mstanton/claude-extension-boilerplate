#!/usr/bin/env python3
"""
Python MCP Server Example for Claude Desktop Extensions

This demonstrates how to create a Python-based MCP server that can be
packaged as a Claude Desktop Extension. It includes:
- Proper MCP protocol implementation
- Input validation and error handling
- File system operations
- Environment variable configuration
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import mcp
from mcp.server import Server
from mcp.server.stdio import stdio_server


# Configure logging
logging.basicConfig(
    level=logging.INFO if os.getenv('ENABLE_LOGGING', 'false').lower() == 'true' else logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PythonExtensionServer:
    """Python MCP Server for Claude Desktop Extension"""
    
    def __init__(self):
        self.server = Server("python-extension-example")
        self.allowed_paths = self._get_allowed_paths()
        self.setup_tools()
    
    def _get_allowed_paths(self) -> List[Path]:
        """Get allowed directory paths from environment"""
        paths_env = os.getenv('ALLOWED_PATHS', '')
        if not paths_env:
            logger.warning("No ALLOWED_PATHS configured, using current directory")
            return [Path.cwd()]
        
        paths = []
        for path_str in paths_env.split(','):
            path_str = path_str.strip()
            if path_str:
                paths.append(Path(path_str).resolve())
        
        return paths
    
    def _is_path_allowed(self, target_path: Path) -> bool:
        """Check if a path is within allowed directories"""
        target_resolved = target_path.resolve()
        
        for allowed_path in self.allowed_paths:
            try:
                target_resolved.relative_to(allowed_path)
                return True
            except ValueError:
                continue
        
        return False
    
    def setup_tools(self):
        """Register all available tools"""
        
        @self.server.list_tools()
        async def list_tools() -> List[mcp.types.Tool]:
            """List all available tools"""
            return [
                mcp.types.Tool(
                    name="python_hello",
                    description="A simple greeting tool implemented in Python",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Name to greet",
                                "default": "World"
                            },
                            "language": {
                                "type": "string",
                                "enum": ["en", "es", "fr", "de"],
                                "description": "Language for greeting",
                                "default": "en"
                            }
                        },
                        "required": []
                    }
                ),
                mcp.types.Tool(
                    name="python_file_analyzer",
                    description="Analyze files in allowed directories",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": "Path to file to analyze"
                            },
                            "analysis_type": {
                                "type": "string",
                                "enum": ["basic", "detailed", "content"],
                                "description": "Type of analysis to perform",
                                "default": "basic"
                            }
                        },
                        "required": ["file_path"]
                    }
                ),
                mcp.types.Tool(
                    name="python_system_info",
                    description="Get Python and system information",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "enum": ["python", "system", "environment"],
                                "description": "Information category",
                                "default": "python"
                            }
                        },
                        "required": []
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[mcp.types.TextContent]:
            """Handle tool calls"""
            try:
                if name == "python_hello":
                    result = await self._handle_hello(arguments)
                elif name == "python_file_analyzer":
                    result = await self._handle_file_analyzer(arguments)
                elif name == "python_system_info":
                    result = await self._handle_system_info(arguments)
                else:
                    raise ValueError(f"Unknown tool: {name}")
                
                return [mcp.types.TextContent(
                    type="text",
                    text=json.dumps(result, indent=2, default=str)
                )]
                
            except Exception as e:
                logger.error(f"Tool {name} failed: {e}")
                error_result = {
                    "success": False,
                    "error": {
                        "message": str(e),
                        "type": type(e).__name__
                    },
                    "tool": name
                }
                return [mcp.types.TextContent(
                    type="text", 
                    text=json.dumps(error_result, indent=2)
                )]
    
    async def _handle_hello(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle hello tool"""
        name = args.get('name', 'World')
        language = args.get('language', 'en')
        
        greetings = {
            'en': f'Hello, {name}!',
            'es': f'¡Hola, {name}!',
            'fr': f'Bonjour, {name}!',
            'de': f'Hallo, {name}!'
        }
        
        greeting = greetings.get(language, greetings['en'])
        
        return {
            "success": True,
            "greeting": greeting,
            "language": language,
            "python_version": sys.version,
            "server_info": {
                "name": self.server.name,
                "allowed_paths": [str(p) for p in self.allowed_paths]
            }
        }
    
    async def _handle_file_analyzer(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle file analyzer tool"""
        file_path_str = args.get('file_path')
        analysis_type = args.get('analysis_type', 'basic')
        
        if not file_path_str:
            raise ValueError("file_path is required")
        
        file_path = Path(file_path_str)
        
        if not self._is_path_allowed(file_path):
            raise PermissionError(f"Access denied: {file_path} is not in allowed directories")
        
        if not file_path.exists():
            return {
                "success": False,
                "error": "File does not exist",
                "path": str(file_path)
            }
        
        # Basic analysis
        stat = file_path.stat()
        result = {
            "success": True,
            "path": str(file_path),
            "name": file_path.name,
            "exists": True,
            "is_file": file_path.is_file(),
            "is_directory": file_path.is_dir(),
            "size_bytes": stat.st_size if file_path.is_file() else None,
            "modified": stat.st_mtime,
            "analysis_type": analysis_type
        }
        
        if analysis_type == "detailed" and file_path.is_file():
            result.update({
                "extension": file_path.suffix,
                "parent": str(file_path.parent),
                "permissions": oct(stat.st_mode),
                "size_human": self._format_bytes(stat.st_size)
            })
        
        if analysis_type == "content" and file_path.is_file():
            try:
                # Only read text files and limit size
                if stat.st_size > 1024 * 1024:  # 1MB limit
                    result["content_error"] = "File too large to read"
                else:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        result.update({
                            "content_preview": content[:1000] + "..." if len(content) > 1000 else content,
                            "line_count": len(content.splitlines()),
                            "char_count": len(content)
                        })
            except Exception as e:
                result["content_error"] = f"Could not read file: {e}"
        
        return result
    
    async def _handle_system_info(self, args: Dict[str, Any]) -> Dict[str, Any]:
        """Handle system info tool"""
        category = args.get('category', 'python')
        
        result = {
            "success": True,
            "category": category
        }
        
        if category == "python":
            result.update({
                "python_version": sys.version,
                "python_executable": sys.executable,
                "python_path": sys.path[:5],  # First 5 entries
                "platform": sys.platform,
                "modules_count": len(sys.modules)
            })
        
        elif category == "system":
            import platform
            result.update({
                "platform": platform.platform(),
                "system": platform.system(),
                "release": platform.release(),
                "version": platform.version(),
                "machine": platform.machine(),
                "processor": platform.processor()
            })
        
        elif category == "environment":
            env_vars = dict(os.environ)
            # Filter out sensitive variables
            safe_vars = {k: v for k, v in env_vars.items() 
                        if not any(sensitive in k.lower() 
                                 for sensitive in ['password', 'secret', 'key', 'token'])}
            
            result.update({
                "environment_count": len(env_vars),
                "allowed_paths": [str(p) for p in self.allowed_paths],
                "current_directory": str(Path.cwd()),
                "safe_environment": dict(list(safe_vars.items())[:10])  # First 10 safe vars
            })
        
        return result
    
    def _format_bytes(self, bytes_count: int) -> str:
        """Format bytes in human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_count < 1024.0:
                return f"{bytes_count:.2f} {unit}"
            bytes_count /= 1024.0
        return f"{bytes_count:.2f} TB"
    
    async def run(self):
        """Run the MCP server"""
        logger.info(f"Starting Python MCP server: {self.server.name}")
        logger.info(f"Allowed paths: {[str(p) for p in self.allowed_paths]}")
        
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options()
            )


async def main():
    """Main entry point"""
    try:
        server = PythonExtensionServer()
        await server.run()
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())