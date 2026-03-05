/**
 * Node-RED settings.js Generator
 *
 * Generates a valid Node.js module.exports file for Node-RED's settings.js
 * from the plugin's NodeRedConfig.
 *
 * @see /specs/001-nodered-lifecycle/data-model.md
 */

import type { NodeRedConfig } from '../types';

/**
 * Generate Node-RED settings.js file content from config.
 *
 * Returns a JavaScript string that can be evaluated as a Node.js module
 * (module.exports = { ... }).
 *
 * Mapping from NodeRedConfig to Node-RED settings.js:
 * - uiPort: config.port
 * - uiHost: 'localhost' if config.localhostOnly, else '0.0.0.0'
 * - userDir: config.userDir
 * - flowFile: 'flows.json'
 * - httpAdminRoot: '/'
 * - httpNodeRoot: '/'
 * - functionGlobalContext: {}
 * - logging: { console: { level: 'info', metrics: false, audit: false } }
 * - editorTheme: { projects: { enabled: false } }
 *
 * @param config - NodeRedConfig object
 * @returns JavaScript string for settings.js file
 */
export function generateSettings(config: NodeRedConfig): string {
  const uiHost = config.localhostOnly ? 'localhost' : '0.0.0.0';
  const escapedUserDir = config.userDir.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const hasCredentials = !!(config.editorUsername && config.editorPasswordHash);

  // Validate bcrypt hash format if present
  if (hasCredentials && !/^\$2[aby]\$/.test(config.editorPasswordHash!)) {
    // Malformed hash — treat as unconfigured to prevent broken auth
    return generateSettings({ ...config, editorPasswordHash: undefined });
  }
  const httpAdminRoot = hasCredentials ? "'/'" : 'false';

  let adminAuthBlock = '';
  if (hasCredentials) {
    const escapedUsername = config.editorUsername!.replace(/[\x00-\x1f\x7f]/g, '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedHash = config.editorPasswordHash!.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const tokensBlock = config.editorApiToken
      ? `,\n    tokens: [{ token: '${config.editorApiToken.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}', user: '${escapedUsername}', scope: ['*'] }]`
      : '';
    adminAuthBlock = `,
  adminAuth: {
    type: 'credentials',
    users: [{
      username: '${escapedUsername}',
      password: '${escapedHash}',
      permissions: '*'
    }]${tokensBlock}
  }`;
  }

  return `module.exports = {
  uiPort: ${config.port},
  uiHost: '${uiHost}',
  userDir: '${escapedUserDir}',
  flowFile: 'flows.json',
  httpAdminRoot: ${httpAdminRoot},
  httpNodeRoot: '/',
  functionGlobalContext: {},
  logging: {
    console: {
      level: 'info',
      metrics: false,
      audit: false
    }
  },
  editorTheme: {
    projects: {
      enabled: false
    }
  }${adminAuthBlock}
};`;
}
