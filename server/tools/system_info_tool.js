import { z } from 'zod';
import os from 'os';
import fs from 'fs/promises';
import { execSync } from 'child_process';

/**
 * System Info Tool
 * 
 * Provides comprehensive system information including:
 * - OS details
 * - Hardware information
 * - Process information
 * - Environment details
 */

const inputSchema = z.object({
  category: z.enum(['overview', 'hardware', 'process', 'environment', 'network']).default('overview').describe('Information category to retrieve'),
  detailed: z.boolean().default(false).describe('Include detailed information'),
});

/**
 * Get system overview
 */
function getSystemOverview(detailed) {
  const uptime = os.uptime();
  const loadAvg = os.loadavg();
  
  const overview = {
    hostname: os.hostname(),
    platform: os.platform(),
    architecture: os.arch(),
    os_type: os.type(),
    os_release: os.release(),
    node_version: process.version,
    uptime_seconds: Math.floor(uptime),
    uptime_formatted: formatUptime(uptime),
    load_average: {
      '1min': loadAvg[0].toFixed(2),
      '5min': loadAvg[1].toFixed(2),
      '15min': loadAvg[2].toFixed(2),
    },
  };

  if (detailed) {
    overview.detailed = {
      os_endianness: os.endianness(),
      home_directory: os.homedir(),
      temp_directory: os.tmpdir(),
      shell: process.env.SHELL || process.env.COMSPEC || 'unknown',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
    };
  }

  return overview;
}

/**
 * Get hardware information
 */
function getHardwareInfo(detailed) {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const hardware = {
    cpu: {
      model: cpus[0]?.model || 'Unknown',
      cores: cpus.length,
      speed_mhz: cpus[0]?.speed || 0,
    },
    memory: {
      total: formatBytes(totalMem),
      free: formatBytes(freeMem),
      used: formatBytes(usedMem),
      usage_percent: ((usedMem / totalMem) * 100).toFixed(1),
      total_bytes: totalMem,
      free_bytes: freeMem,
      used_bytes: usedMem,
    },
  };

  if (detailed) {
    hardware.detailed = {
      cpu_info: cpus.map((cpu, index) => ({
        core: index,
        model: cpu.model,
        speed: cpu.speed,
        times: cpu.times,
      })),
      constants: {
        page_size: os.constants?.PAGE_SIZE || 'unknown',
        max_path_length: os.constants?.PATH_MAX || 'unknown',
      },
    };
  }

  return hardware;
}

/**
 * Get process information
 */
function getProcessInfo(detailed) {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const processInfo = {
    pid: process.pid,
    ppid: process.ppid || 'unknown',
    node_version: process.version,
    uptime_seconds: Math.floor(process.uptime()),
    uptime_formatted: formatUptime(process.uptime()),
    working_directory: process.cwd(),
    memory_usage: {
      rss: formatBytes(memUsage.rss),
      heap_total: formatBytes(memUsage.heapTotal),
      heap_used: formatBytes(memUsage.heapUsed),
      external: formatBytes(memUsage.external),
      array_buffers: formatBytes(memUsage.arrayBuffers || 0),
    },
    cpu_usage: {
      user_microseconds: cpuUsage.user,
      system_microseconds: cpuUsage.system,
    },
  };

  if (detailed) {
    processInfo.detailed = {
      versions: process.versions,
      features: process.features || {},
      argv: process.argv,
      exec_path: process.execPath,
      exec_argv: process.execArgv,
      platform: process.platform,
      arch: process.arch,
      title: process.title,
      gid: typeof process.getgid === 'function' ? process.getgid() : 'unknown',
      uid: typeof process.getuid === 'function' ? process.getuid() : 'unknown',
      groups: typeof process.getgroups === 'function' ? process.getgroups() : 'unknown',
    };
  }

  return processInfo;
}

/**
 * Get environment information
 */
function getEnvironmentInfo(detailed) {
  const envVars = process.env;
  const envCount = Object.keys(envVars).length;
  
  // Safe environment variables to show
  const safeEnvVars = {
    NODE_ENV: envVars.NODE_ENV,
    PATH: detailed ? envVars.PATH : `${envVars.PATH?.substring(0, 100)}...`,
    HOME: envVars.HOME,
    USER: envVars.USER || envVars.USERNAME,
    SHELL: envVars.SHELL,
    LANG: envVars.LANG,
    TZ: envVars.TZ,
  };

  const environment = {
    variable_count: envCount,
    variables: Object.fromEntries(
      Object.entries(safeEnvVars).filter(([, value]) => value !== undefined)
    ),
  };

  if (detailed) {
    // Include extension-specific environment variables
    const extensionVars = Object.fromEntries(
      Object.entries(envVars).filter(([key]) => 
        key.startsWith('EXTENSION_') || 
        key.startsWith('ALLOWED_') ||
        key.startsWith('API_') ||
        key.startsWith('ENABLE_')
      )
    );

    environment.detailed = {
      extension_variables: extensionVars,
      node_options: envVars.NODE_OPTIONS,
      npm_config_prefix: envVars.npm_config_prefix,
      npm_config_cache: envVars.npm_config_cache,
    };
  }

  return environment;
}

/**
 * Get network information
 */
function getNetworkInfo(detailed) {
  const interfaces = os.networkInterfaces();
  const interfaceNames = Object.keys(interfaces);
  
  const network = {
    interface_count: interfaceNames.length,
    interface_names: interfaceNames,
  };

  if (detailed) {
    const detailedInterfaces = {};
    
    for (const [name, addresses] of Object.entries(interfaces)) {
      detailedInterfaces[name] = addresses.map(addr => ({
        address: addr.address,
        netmask: addr.netmask,
        family: addr.family,
        mac: addr.mac,
        internal: addr.internal,
        cidr: addr.cidr,
      }));
    }
    
    network.detailed = {
      interfaces: detailedInterfaces,
      hostname: os.hostname(),
    };
  }

  return network;
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
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
 * Format uptime to human readable format
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);
  
  return parts.join(' ') || '0s';
}

/**
 * Execute the system info tool
 */
async function execute(args) {
  const validatedArgs = inputSchema.parse(args);
  const { category, detailed } = validatedArgs;

  try {
    let result;

    switch (category) {
      case 'overview':
        result = getSystemOverview(detailed);
        break;
        
      case 'hardware':
        result = getHardwareInfo(detailed);
        break;
        
      case 'process':
        result = getProcessInfo(detailed);
        break;
        
      case 'environment':
        result = getEnvironmentInfo(detailed);
        break;
        
      case 'network':
        result = getNetworkInfo(detailed);
        break;
        
      default:
        throw new Error(`Unknown category: ${category}`);
    }

    return {
      success: true,
      category,
      detailed,
      data: result,
      timestamp: new Date().toISOString(),
      collected_in_ms: 0, // This is fast enough to not need timing
    };
    
  } catch (error) {
    return {
      success: false,
      category,
      error: {
        message: error.message,
        type: error.constructor.name,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Tool configuration
 */
export const systemInfoTool = {
  name: 'system_info',
  description: 'Get comprehensive system information including OS details, hardware specs, process info, environment variables, and network configuration.',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['overview', 'hardware', 'process', 'environment', 'network'],
        default: 'overview',
        description: 'Information category to retrieve',
      },
      detailed: {
        type: 'boolean',
        default: false,
        description: 'Include detailed information (may contain sensitive data)',
      },
    },
    required: [],
  },
  execute,
};