const Sentry = require('@sentry/node');

Sentry.init({
  dsn: 'https://c0313d0ea82c4b1cbd4fd5a4e8b624b4@sentry.io/1299915'
});

const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');

require('./logger');

log.info('Parsing configuration options');

let configPath = process.env.CFGPATH || process.argv[2];
const isDryRun = process.argv.indexOf('--test') !== -1;
let config;

if (!configPath) {
  log.critical('Path to config file is required');
}

if (isDryRun) {
  log.info('Dry run enabled. No data will actually be sent to Fliplet server.');
}

Sentry.configureScope(scope => {
  scope.setTag('version', require('../package').version);
});

Sentry.addBreadcrumb({
  configPath
});

try {
  if (/\.js$/.test(configPath)) {
    log.debug('Parsing Javascript configuration file...');

    // JS configuration file
    try {
      config = require(configPath);
    } catch (e) {
      configPath = path.join(process.cwd(), process.argv[2]);
      config = require(configPath);
      config.path = configPath;
    }
  } else {
    log.debug('Parsing YML configuration file...');
    let doc;

    try {
      doc = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      configPath = path.join(process.cwd(), process.argv[2]);
      doc = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'));
    }

    config = {
      path: configPath,
      config: {
        isDryRun: isDryRun,
        authToken: doc.auth_token,
        syncOnInit: doc.sync_on_init,
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
          timestampColumnName: doc.timestamp_column,
          deleteColumnName: doc.delete_column,
          targetDataSourceId: doc.datasource_id
        });
      }
    };
  }
} catch (e) {
  log.critical(`Cannot read config file. Please check whether the path is correct. (Error: ${e.message})`);
}

if (!config || typeof config.config !== 'object') {
  log.critical('Your config file does not export a configuration via module.exports.config');
}

if (typeof config.setup !== 'function') {
  log.critical('Your config file does not export a setup function via module.exports.setup');
}

module.exports.Agent = require('./agent-runner');
module.exports.config = config;