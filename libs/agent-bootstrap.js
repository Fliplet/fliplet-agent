const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.TEST ? '' : 'https://c0313d0ea82c4b1cbd4fd5a4e8b624b4@sentry.io/1299915'
});

const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');

require('./logger');

log.debug('[BOOT] Parsing configuration options');

let configPath = process.env.CFGPATH || process.argv[2];
const isDryRun = process.argv.indexOf('--test') !== -1;
let config;

if (!configPath) {
  log.critical('[BOOT] Path to config file is required');
}

if (isDryRun) {
  log.info('[BOOT] Dry run enabled. No data will actually be sent to Fliplet server.');
}

Sentry.configureScope(scope => {
  scope.setTag('version', require('../package').version);
});

Sentry.addBreadcrumb({
  configPath
});

try {
  if (/\.js$/.test(configPath)) {
    log.debug(`[BOOT] Parsing Javascript configuration file at ${configPath}`);

    // JS configuration file
    try {
      config = require(configPath);
    } catch (e) {
      configPath = path.join(process.cwd(), configPath);
      log.debug(`[BOOT] Parsing Javascript configuration file at ${configPath}`);
      config = require(configPath);
    }

    config.path = configPath;
  } else {
    log.debug(`[BOOT] Parsing YML configuration file at ${configPath}`);
    let doc;

    try {
      doc = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      configPath = path.join(process.cwd(), configPath);
      log.debug(`[BOOT] Retrying parsing YML configuration file at ${configPath}`);
      doc = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'));
    }

    config = {
      path: configPath,
      config: {
        isDryRun: isDryRun,
        authToken: doc.auth_token,
        syncOnInit: doc.sync_on_init,
        logVerbosity: doc.log_verbosity,
        database: {
          dialect: doc.database_driver,
          dialectModulePath: doc.database_native_odbc ? 'sequelize-odbc-mssql' : undefined,
          host: doc.database_host,
          username: doc.database_username,
          password: doc.database_password,
          port: doc.database_port,
          database: doc.database_name,
          dialectOptions: {
            domain: doc.database_domain,
            instanceName: doc.database_instance,
            encrypt: doc.database_encrypt
          }
        }
      },
      setup(agent) {
        const operation = doc.type || 'push';

        if (!agent[operation]) {
          log.critical(`Operation ${operation} is not supported.`);
        }

        agent[operation]({
          description: doc.description,
          frequency: doc.frequency,
          sourceQuery: (db) => db.query(doc.query),
          primaryColumnName: doc.primary_column,
          caseInsensitivePrimaryColumn: doc.case_insensitive_primary_column,
          timestampColumnName: doc.timestamp_column,
          deleteColumnName: doc.delete_column,
          mode: doc.mode || 'update',
          runHooks: doc.run_hooks,
          targetDataSourceId: doc.datasource_id,
          files: doc.files,
          concurrency: doc.concurrency,
          encrypt: doc.encrypt,
          merge: doc.merge
        });
      }
    };
  }
} catch (e) {
  log.critical(`[BOOT] Cannot read config file. Please check whether the path is correct. (Error: ${e.message})`);
}

if (!config || typeof config.config !== 'object') {
  log.critical('[BOOT] Your config file does not export a configuration via module.exports.config');
}

if (typeof config.setup !== 'function') {
  log.critical('[BOOT] Your config file does not export a setup function via module.exports.setup');
}

log.setVerbosity(config.config.logVerbosity || 'debug');

module.exports.Agent = require('./agent-runner');
module.exports.config = config;