import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

/**
 * File Processor Tool
 * 
 * Provides file system operations within allowed directories:
 * - Read file contents
 * - List directory contents
 * - Search for files
 * - Get file statistics
 */

const inputSchema = z.object({
  operation: z.enum(['read', 'list', 'search', 'stats']).describe('File operation to perform'),
  path: z.string().describe('File or directory path'),
  pattern: z.string().optional().describe('Search pattern (for search operation)'),
  recursive: z.boolean().default(false).describe('Recursive operation (for list and search)'),
  max_size: z.number().default(1024 * 1024).describe('Maximum file size to read in bytes (1MB default)'),
  encoding: z.enum(['utf8', 'binary', 'base64']).default('utf8').describe('File encoding for read operation'),
});

/**
 * Check if path is within allowed directories
 */
function isPathAllowed(targetPath) {
  const allowedPaths = process.env.ALLOWED_PATHS ? process.env.ALLOWED_PATHS.split(',') : [];
  const resolvedPath = path.resolve(targetPath);
  
  return allowedPaths.some(allowedPath => {
    const resolvedAllowedPath = path.resolve(allowedPath.trim());
    return resolvedPath.startsWith(resolvedAllowedPath);
  });
}

/**
 * Format file size
 */
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Read file operation
 */
async function readFile(filePath, maxSize, encoding) {
  if (!isPathAllowed(filePath)) {
    throw new Error(`Access denied: ${filePath} is not in an allowed directory`);
  }

  const stats = await fs.stat(filePath);
  
  if (!stats.isFile()) {
    throw new Error(`${filePath} is not a file`);
  }
  
  if (stats.size > maxSize) {
    throw new Error(`File size (${formatSize(stats.size)}) exceeds maximum allowed size (${formatSize(maxSize)})`);
  }

  let content;
  if (encoding === 'binary') {
    const buffer = await fs.readFile(filePath);
    content = Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join(' ');
  } else if (encoding === 'base64') {
    const buffer = await fs.readFile(filePath);
    content = buffer.toString('base64');
  } else {
    content = await fs.readFile(filePath, 'utf8');
  }

  return {
    operation: 'read',
    path: filePath,
    size: stats.size,
    size_formatted: formatSize(stats.size),
    encoding,
    content,
    lines: encoding === 'utf8' ? content.split('\n').length : null,
    modified: stats.mtime.toISOString(),
  };
}

/**
 * List directory operation
 */
async function listDirectory(dirPath, recursive) {
  if (!isPathAllowed(dirPath)) {
    throw new Error(`Access denied: ${dirPath} is not in an allowed directory`);
  }

  async function listRecursive(currentPath, depth = 0) {
    if (depth > 10) { // Prevent infinite recursion
      throw new Error('Maximum directory depth exceeded');
    }

    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(dirPath, fullPath);
      
      if (entry.isDirectory()) {
        const dirInfo = {
          name: entry.name,
          path: relativePath,
          type: 'directory',
          depth,
        };
        
        results.push(dirInfo);
        
        if (recursive) {
          const subEntries = await listRecursive(fullPath, depth + 1);
          results.push(...subEntries);
        }
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);
          results.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            size: stats.size,
            size_formatted: formatSize(stats.size),
            modified: stats.mtime.toISOString(),
            extension: path.extname(entry.name),
            depth,
          });
        } catch (error) {
          // Skip files we can't stat
          results.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            error: 'Unable to read file stats',
            depth,
          });
        }
      }
    }

    return results;
  }

  const stats = await fs.stat(dirPath);
  if (!stats.isDirectory()) {
    throw new Error(`${dirPath} is not a directory`);
  }

  const entries = await listRecursive(dirPath);
  
  const summary = {
    total: entries.length,
    files: entries.filter(e => e.type === 'file').length,
    directories: entries.filter(e => e.type === 'directory').length,
    total_size: entries
      .filter(e => e.type === 'file' && e.size)
      .reduce((sum, e) => sum + e.size, 0),
  };

  return {
    operation: 'list',
    path: dirPath,
    recursive,
    entries,
    summary: {
      ...summary,
      total_size_formatted: formatSize(summary.total_size),
    },
  };
}

/**
 * Search files operation
 */
async function searchFiles(searchPath, pattern, recursive) {
  if (!isPathAllowed(searchPath)) {
    throw new Error(`Access denied: ${searchPath} is not in an allowed directory`);
  }

  const regex = new RegExp(pattern, 'i'); // Case-insensitive search
  const matches = [];

  async function searchRecursive(currentPath, depth = 0) {
    if (depth > 10) return;

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(searchPath, fullPath);
        
        if (regex.test(entry.name)) {
          try {
            const stats = await fs.stat(fullPath);
            matches.push({
              name: entry.name,
              path: relativePath,
              full_path: fullPath,
              type: entry.isDirectory() ? 'directory' : 'file',
              size: entry.isFile() ? stats.size : null,
              size_formatted: entry.isFile() ? formatSize(stats.size) : null,
              modified: stats.mtime.toISOString(),
              depth,
            });
          } catch (error) {
            matches.push({
              name: entry.name,
              path: relativePath,
              full_path: fullPath,
              type: entry.isDirectory() ? 'directory' : 'file',
              error: 'Unable to read stats',
              depth,
            });
          }
        }
        
        if (entry.isDirectory() && recursive && depth < 10) {
          await searchRecursive(fullPath, depth + 1);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await searchRecursive(searchPath);

  return {
    operation: 'search',
    path: searchPath,
    pattern,
    recursive,
    matches,
    count: matches.length,
  };
}

/**
 * Get file/directory stats
 */
async function getStats(targetPath) {
  if (!isPathAllowed(targetPath)) {
    throw new Error(`Access denied: ${targetPath} is not in an allowed directory`);
  }

  try {
    const stats = await fs.stat(targetPath);
    const parsedPath = path.parse(targetPath);
    
    return {
      operation: 'stats',
      path: targetPath,
      exists: true,
      name: parsedPath.name,
      extension: parsedPath.ext,
      directory: parsedPath.dir,
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      size_formatted: formatSize(stats.size),
      permissions: {
        mode: stats.mode.toString(8),
        readable: true, // Assume readable since we got stats
      },
      times: {
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
      },
      is_directory: stats.isDirectory(),
      is_file: stats.isFile(),
      is_symlink: stats.isSymbolicLink(),
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        operation: 'stats',
        path: targetPath,
        exists: false,
        error: 'File or directory not found',
      };
    }
    throw error;
  }
}

/**
 * Main execute function
 */
async function execute(args) {
  const validatedArgs = inputSchema.parse(args);
  const { operation, path: targetPath, pattern, recursive, max_size, encoding } = validatedArgs;

  try {
    let result;

    switch (operation) {
      case 'read':
        result = await readFile(targetPath, max_size, encoding);
        break;
        
      case 'list':
        result = await listDirectory(targetPath, recursive);
        break;
        
      case 'search':
        if (!pattern) {
          throw new Error('pattern is required for search operation');
        }
        result = await searchFiles(targetPath, pattern, recursive);
        break;
        
      case 'stats':
        result = await getStats(targetPath);
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    };
    
  } catch (error) {
    return {
      success: false,
      operation,
      path: targetPath,
      error: {
        message: error.message,
        code: error.code,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Tool configuration
 */
export const fileProcessorTool = {
  name: 'file_processor',
  description: 'Process files and directories within allowed paths. Supports read, list, search, and stats operations.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['read', 'list', 'search', 'stats'],
        description: 'File operation to perform',
      },
      path: {
        type: 'string',
        description: 'File or directory path',
      },
      pattern: {
        type: 'string',
        description: 'Search pattern (regex, for search operation)',
      },
      recursive: {
        type: 'boolean',
        default: false,
        description: 'Recursive operation (for list and search)',
      },
      max_size: {
        type: 'number',
        default: 1048576,
        description: 'Maximum file size to read in bytes',
      },
      encoding: {
        type: 'string',
        enum: ['utf8', 'binary', 'base64'],
        default: 'utf8',
        description: 'File encoding for read operation',
      },
    },
    required: ['operation', 'path'],
  },
  execute,
};