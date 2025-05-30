const _ = require('lodash');
const fs = require('fs');
const url = require('url');
const path = require('path');
const util = require('util');
const axios = require('axios');
const Sequelize = require('sequelize');
const promiseLimit = require('promise-limit');
const package = require(path.join(__dirname, '../', 'package.json'));
const moment = require('moment');
const mime = require('mime');
const Sentry = require('@sentry/node');
const sprequest = require('sp-request');
const CronJob = require('cron').CronJob;
const readFile = util.promisify(fs.readFile);

const API = require('./api');
const Files = require('./files');
const Crypt = require('./crypt');

const series = promiseLimit(1);
let pendingCommit;

const MAX_RETRIES = 5;
const BATCH_SIZE = 1000;

const agent = function initAgent(config) {

  this.operations = [];

  this.config = _.extend({
    isDryRun: false,
    syncOnInit: true
  }, config);

  if (typeof this.config.database === 'object' && Object.keys(this.config.database).length) {
    log.info('[DB] Initialising connection with source database...');

    // Extend db settings
    this.config.database = _.extend({
      operatorsAliases: false,
      logging(query) {
        log.debug(`[QUERY] ${query}`);
      }
    }, this.config.database);

    // Init connections
    this.db = this.config.database.url
      ? (new Sequelize(this.config.database.url, this.config.database))
      : (new Sequelize(this.config.database));
  }

  this.api = new API(this.config.authToken, this.config.baseURL);
  this.files = new Files(this.api);

  const authenticate = this.db ? this.db.authenticate() : Promise.resolve();
  return authenticate
    .catch(err => {
      log.critical(`[DB] Unable to connect to the source database: ${err.message}`);
    })
    .then(() => {
      log.info('[DB] Connection has been established successfully.');
      log.info('[VERSION] Checking the Fliplet Agent version with the npm registry...');

      // Check whether we're on the latest version
      return axios.get('https://registry.npmjs.org/-/package/fliplet-agent/dist-tags').then(function (response) {
        if (response.data && response.data.latest && response.data.latest !== package.version) {
          log.warn(`[VERSION] Your current version of the Fliplet Agent is ${package.version}, while the latest version available is ${response.data.latest}. We recommend that you upgrade to the latest version by executing the following command: "npm update fliplet-agent -g".`);
        }
      }).catch(function () {
        // nothing
      });
    }).then(() => {
      log.info('[API] Authenticating with Fliplet API...');

      return this.api.authenticate();
    }).then((response) => {
      this.isAuthFailed = response && response.isAuthFailed;
      if(response && !response.isAuthFailed) {
        log.info(`Authentication has been verified successfully. You're logged in as ${response.data.user.fullName}.`);
        Sentry.configureScope((scope) => {
          scope.setUser(_.pick(response.data.user, [
            'id', 'email', 'auth_token', 'firstName', 'lastName'
          ]));
        });
      }
      return this;
    });
};

agent.prototype.runOperation = async function runOperation(operation) {
  log.info(`${operation.description}`);

  if (this.isAuthFailed) {
    await this.api.logFailedRequest(operation.targetDataSourceId);
    log.critical(`Unable to authenticate with Fliplet API`);
    return;
  }

  switch (operation.type) {
    case 'push':
      return this.runPushOperation(operation);
    case 'pull':
      return this.runPullOperation(operation);
    default:
      log.critical(`Operation "${operation.type}" does not exist. We only support "push" operations for the time being.`);
  }
};

agent.prototype.runPushOperation = async function runPushOperation(operation) {
  const agent = this;
  const primaryKey = operation.primaryColumnName;
  const timestampKey = operation.timestampColumnName;
  let encryptionKey;
  let ids = [];

  if (operation.caseInsensitivePrimaryColumn) {
    log.info('[✓] The primary key has been set to be case-insensitive.');
  } else {
    log.info('[!] The primary key has been set to be case-sensitive.');
  }

  if (pendingCommit) {
    clearTimeout(pendingCommit);
    pendingCommit = null;
  }

  // Cleanup
  agent.files.resetState();

  if (!primaryKey) {
    log.error('Warning: A primary key has not been set, which means rows will always be appended to the data source whenever this script runs. To allow updating rows, please define a primary key to be used for the comparison.');
  }

  if (operation.encrypt) {
    if (!_.get(operation, 'encrypt.fields', []).length) {
      log.critical('[ENCRYPTION] You need to define a list of fields to encrypt.');
    }

    if (operation.encrypt.fields.indexOf(primaryKey) !== -1) {
      log.critical('[ENCRYPTION] You cannot encrypt the Primary Key.');
    }

    log.info(`[ENCRYPTION] Encryption is enabled for the following fields: ${operation.encrypt.fields.join(', ')}`);

    if (operation.encrypt.key) {
      log.debug('[ENCRYPTION] A key has been defined by the operation.');
      encryptionKey = operation.encrypt.key;
    } else {
      log.debug('[ENCRYPTION] A key has not been defined. Fetching the key from Fliplet servers...');

      let keySalt = operation.encrypt.salt;
      let organizationId;

      encryptionKey = await this.api.request({
        url: `v1/data-sources?type=keystore`
      }).then(async (response) => {
        let dataSource;

        if (!response.data.dataSources.length) {
          log.debug('[ENCRYPTION] Generating new keystore...');

          const organizations = await this.api.request({
            url: 'v1/organizations'
          }).then((response) => response.data.organizations);

          const organization = _.first(organizations);

          organizationId = organization.id;

          log.debug(`Fetched organization ${organization.name}`);

          const result = await this.api.request({
            method: 'POST',
            url: 'v1/data-sources',
            data: {
              name: 'Keystore',
              type: 'keystore',
              organizationId
            }
          });

          dataSource = result.data.dataSource;
        } else {
          dataSource = _.first(response.data.dataSources);
          organizationId = dataSource.organizationId;

          log.info('[ENCRYPTION] Keystore found.');
        }

        if (!keySalt) {
          keySalt = organizationId + '-' + dataSource.id;
        }

        const entry = await this.api.request({
          url: `v1/data-sources/${dataSource.id}/data`,
          method: 'GET'
        }).then((response) => {
          return _.first(response.data.entries);
        });

        if (entry && entry.data.content) {
          log.info('[ENCRYPTION] Key found. Decrypting key...');

          const key = Crypt.salt(keySalt).decrypt(entry.data.content);

          if (key) {
            return key;
          }

          log.critical('The salt provided for the key decryption is incorrect');
        }

        log.info('[ENCRYPTION] Generating new key...');

        // Create new key
        const key = Crypt.generateKey();
        const encryptedKey = Crypt.salt(keySalt).encrypt(key);

        log.info('[ENCRYPTION] Uploading key to Fliplet APIs...');

        await this.api.request({
          url: `v1/data-sources/${dataSource.id}/data`,
          method: 'PUT',
          data: {
            createdAt: moment().unix(),
            source: 'Fliplet Agent',
            content: encryptedKey
          }
        });

        return key;
      });
    }
  }

  log.info('[PUSH] Fetching data via Fliplet API...');

  if (Array.isArray(operation.files) && operation.files.length) {
    log.info(`${operation.files.length} column(s) marked as files: ${_.map(operation.files, 'column').join(', ')}.`);
  }

  if (operation.mode === 'replace') {
    log.info(`Remote entries not found in the local dataset will be deleted ("mode" is set to "replace").`);
  } else {
    log.info(`Remote entries not found in the local dataset will be kept ("mode" is set to "update").`);
  }

  return this.api.request({
    url: `v1/data-sources/${operation.targetDataSourceId}/data`
  }).then((response) => {
    let fetchData;
    const entries = response.data.entries;
    log.debug(`Fetched ${entries.length} entries from the data source.`);

    if (typeof operation.sourceQuery === 'function') {
      log.info('Fetching data from the database...');
      fetchData = operation.sourceQuery(this.db);
    } else if (typeof operation.source === 'function') {
      log.info('Fetching data from manual source...');
      fetchData = operation.source(axios);
    } else {
      log.critical('Source query or operation is not defined');
    }

    return fetchData.then(async (result) => {
      let rows;

      log.debug('Successfully fetched data from the source.');

      if (this.db) {
        rows = result[0];
        log.debug(`Fetched ${rows.length} rows from the database.`);
      } else {
        if (result.data) {
          result = result.data;
        }

        if (Array.isArray(result)) {
          rows = result;
          log.debug(`Fetched ${rows.length} rows from manual source.`);
        } else {
          rows = [];
          log.error(`Response from source did not return an array of entries.`);
        }
      }

      if (operation.deleteColumnName) {
        log.debug(`Delete mode is enabled for rows having "${operation.deleteColumnName}" not null.`);
      }

      if (Array.isArray(operation.runHooks) && operation.runHooks.length) {
        log.debug(`Post-sync hooks enabled: ${operation.runHooks.join(', ')}`);
      } else {
        log.debug(`No post-sync hooks have been enabled`);
      }

      const concurrency = parseInt(operation.concurrency || 1, 10);
      const limit = promiseLimit(concurrency);
      const localDataMap = new Map();
      let toDelete = [];

      // Create map of local data to optimize matching logic between local and server's data
      for (const localData of rows) {
        const key = operation.caseInsensitivePrimaryColumn
          ? (typeof localData[primaryKey] === 'string' ? localData[primaryKey].toLowerCase() : localData[primaryKey])
          : localData[primaryKey];
        localDataMap.set(key, localData);
      }

      // Check for the rows which are deleted from local database.
      // Add deleted rows in toDelete array to remove it from server's dataSource
      for (const dsEntry of entries) {
        const key = operation.caseInsensitivePrimaryColumn
          ? (typeof dsEntry.data[primaryKey] === 'string' ? dsEntry.data[primaryKey].toLowerCase() : dsEntry.data[primaryKey])
          : dsEntry.data[primaryKey];

        if (!localDataMap.get(key) && operation.mode !== 'update') {
          log.debug(`Remote entry with ID ${dsEntry.id} has been marked for deletion as it doesn't exist in the local dataset.`);
          toDelete.push(dsEntry.id);
        }
      }

      log.debug(`Concurrency has been set to ${concurrency}.`);
      const batchSize = operation.mode === 'update' ? rows.length : (this.config.batchSize || BATCH_SIZE);
      for (let record = 0; record < rows.length; record += batchSize) {
        // Initialize commits array for each batch
        const commits = [];
        const batchRows = rows.slice(record, record + batchSize);
        log.debug(`Processing records from ${record} to ${record + batchSize}`);

        await Promise.all(batchRows.map((row, index) => {
          if (!row) {
            log.warn(`Skipping null row at index ${index}: ${row}`);
            return;
          }

          return limit(async function () {
            async function syncFiles(entryId) {
              if (Array.isArray(operation.files) && operation.files.length) {
                await Promise.all(operation.files.map(function (definition) {
                  let fileUrl = row[definition.column];

                  if (!fileUrl) {
                    return;
                  }

                  let operation;

                  switch (definition.type) {
                    case 'remote':
                      log.debug(`[FILES] Requesting remote file: ${fileUrl}`);
                      operation = axios.request({
                        url: fileUrl,
                        responseType: 'arraybuffer',
                        headers: definition.headers
                      }).then((response) => {
                        const parsedUrl = url.parse(fileUrl);
                        const contentType = response.headers['content-type'];
                        const extension = mime.getExtension(contentType);

                        return {
                          body: response.data,
                          name: `${path.basename(parsedUrl.pathname)}${extension ? `.${extension}` : ''}`
                        };
                      });
                      break;
                    case 'local':
                      if (definition.directory) {
                        fileUrl = path.join(definition.directory, fileUrl);
                      }

                      log.debug(`[FILES] Requesting local file: ${fileUrl}`);
                      operation = readFile(fileUrl).then((response) => {
                        return {
                          body: response,
                          name: path.basename(fileUrl)
                        };
                      });
                      break;
                    case 'sharepoint':
                      const credentialOptions = { username: definition.username, password: definition.password };
                      const spr = sprequest.create(credentialOptions);

                      operation = spr.get(fileUrl, {
                        encoding: null
                      }).then(function (response) {
                        return {
                          body: response.body,
                          name: definition.fileType === 'inherit'
                            ? _.first(path.basename(fileUrl).split('?'))
                            : 'file.jpg'
                        };
                      });
                      break;
                  }

                  return operation.catch((err) => {
                    log.error(`[FILES] Cannot fetch file: ${fileUrl} - Error: ${err}`);
                  }).then(function uploadFile(file) {
                    if (!file) {
                      delete row[definition.column];
                      return;
                    }

                    if (entryId) {
                      file.name = `${entryId}-${file.name}`;
                    }

                    return agent.files.upload({
                      url: fileUrl,
                      operation,
                      row,
                      file
                    }).then(function (file) {
                      row[definition.column] = file.url;
                      row[`${definition.column}MediaFileId`] = file.id;
                    });
                  }).catch(function onFileUploadError(err) {
                    log.error(`Cannot upload file: ${err}`);
                    return Promise.resolve();
                  });
                }));
              }
            }

            if (!primaryKey) {
              log.debug(`A row has been marked for inserting since we don't have a primary key for the comparison. Please use a primary key whenever possible.`);

              await syncFiles();
              return commits.push({
                data: row
              });
            }

            const id = row[primaryKey];
            const normalizedPrimaryKey = operation.caseInsensitivePrimaryColumn
              ? (typeof row[primaryKey] === 'string' ? row[primaryKey].toLowerCase() : row[primaryKey])
              : id;

            const isDeleted = operation.deleteColumnName && row[operation.deleteColumnName];

            if (!id) {
              log.error(`A row is missing its primary key value from the database. Skipping: ${JSON.stringify(row)}`);
              return Promise.resolve();
            }

            if (ids.indexOf(normalizedPrimaryKey) !== -1) {
              log.error(`A duplicate row has been found for the same primary key. Skipping: ${JSON.stringify(row)}`);
              return Promise.resolve();
            }

            ids.push(normalizedPrimaryKey);

            const entry = _.find(entries, (e) => {
              if (operation.caseInsensitivePrimaryColumn) {
                const remoteKey = typeof e.data[primaryKey] === 'string' ? e.data[primaryKey].toLowerCase() : e.data[primaryKey];

                return normalizedPrimaryKey === remoteKey;
              }

              return e.data[primaryKey] === id;
            });

            if (!entry) {
              if (isDeleted) {
                log.debug(`Row #${id} is not present on Fliplet servers and it's locally marked as deleted. Skipping...`);
                return;
              }

              log.debug(`Row #${id} has been marked for inserting.`);

              await syncFiles(id);
              return commits.push({
                data: row
              });
            }

            if (!timestampKey) {
              log.debug(`Row #${id} already exists on Fliplet servers with ID ${entry.id}.`);
            }

            if (isDeleted) {
              log.debug(`Row #${id} has been marked for deletion on Fliplet servers with ID ${entry.id}.`);
              return toDelete.push(entry.id);
            }

            const sourceTimestamp = row[timestampKey];
            const targetTimestamp = entry.data[timestampKey];

            const diff = moment(sourceTimestamp).diff(moment(targetTimestamp), 'seconds');

            if (!diff && operation.mode !== 'replace') {
              return log.debug(`Row #${id} already exists on Fliplet servers with ID ${entry.id} and does not require updating.`);
            }

            log.debug(`Row #${id} has been marked for updating.`);

            await syncFiles(id);
            return commits.push({
              id: entry.id,
              data: row
            });
          });
        }));

        toDelete = _.compact(_.uniq(toDelete));

        if (!commits.length && !toDelete.length) {
          log.info('Nothing to commit.');

          if (typeof operation.onSync === 'function') {
            operation.onSync({
              commits: []
            });
          }

          return Promise.resolve();
        }

        if (this.config.isDryRun) {
          log.info('Dry run mode is enabled. Here\'s a dump of the commit log we would have been sent to the Fliplet API:');
          log.info(JSON.stringify(commits, null, 2));

          if (toDelete.length) {
            log.info('Entries to delete: ' + JSON.stringify(toDelete, null, 2));
          }

          log.info('[!] If you don\'t know what the above means, please get in touch with us! We\'re here to help.');
          return;
        }

        if (encryptionKey && commits.length) {
          log.info('[ENCRYPTION] Encrypting data before it\'s committed...');

          commits.forEach((entry) => {
            operation.encrypt.fields.forEach((field) => {
              if (!_.get(entry.data, field)) {
                return;
              }

              entry.data[field] = Crypt.salt(encryptionKey).encrypt(entry.data[field]);
            });
          });

          log.info('[ENCRYPTION] All data have been encrypted.');
        }

        let retry = 0;

        async function scheduleSync() {
          return agent.api.request({
            method: 'POST',
            url: `v1/data-sources/${operation.targetDataSourceId}/commit`,
            data: {
              append: true,
              entries: commits,
              delete: toDelete && toDelete.length ? toDelete : undefined,
              runHooks: operation.runHooks || [],
              extend: operation.merge
            }
          }).then((res) => {
            log.info(`Sync finished. ${res.data.entries.length} data source entries have been affected.`);

            if (typeof operation.onSync === 'function') {
              operation.onSync({
                commits
              });
            }
          }).catch((err) => {
            retry++;

            log.error(`Cannot sync data to Fliplet servers. The error message returned is "${err.message}". Records to sync: ${commits.length}. Data Source ID: ${operation.targetDataSourceId}. Size of the payload: ${JSON.stringify(commits).length} characters. Operation merge type: ${operation.merge}.`);

            if (retry >= MAX_RETRIES) {
              log.critical(`The sync operation has failed ${MAX_RETRIES} times. Please check your internet connection and try again later.`);
            }

            log.info(`Retrying in 1 minute (retry ${retry} of ${MAX_RETRIES})...`);

            pendingCommit = setTimeout(() => {
              scheduleSync();
            }, 1000 * 60 * 1);
          });
        }

        await scheduleSync();
      }
    }).catch((err) => {
      log.critical(err);
    });
  }).catch((err) => {
    if (!err.response) {
      return log.critical(err);
    }

    if (err.response.status) {
      return log.critical(`You don't have access to the dataSource ${operation.targetDataSourceId}. Please check the permissions of your Fliplet user.`);
    }

    return Promise.reject(err);
  });
};

agent.prototype.runPullOperation = function runPullOperation(operation) {
  log.info('[PULL] Fetching data via Fliplet API...');

  return this.api.request({
    url: `v1/data-sources/${operation.targetDataSourceId}/data/query`,
    method: 'POST',
    data: _.pick(operation, [
      'where', 'attributes', 'join', 'distinct'
    ])
  }).then((response) => {
    const entries = response.data.entries;
    log.info(`Fetched ${entries.length} entries from the data source.`);

    let action = operation.action(entries, this.db);

    if (!(action instanceof Promise)) {
      action = Promise.resolve();
    }

    return action.then(function () {
      log.info(`Sync finished.`);
    });
  }).catch((err) => {
    if (!err.response) {
      return log.critical(err);
    }

    if (err.response.status) {
      return log.critical(`You don't have access to the dataSource ${operation.targetDataSourceId}. Please check the permissions of your Fliplet user.`);
    }

    return Promise.reject(err);
  });
};

agent.prototype.run = function runOperations() {
  const initRun = this.config.syncOnInit
    ? Promise.all(this.operations.map((operation) => {
      return series(() => this.runOperation(operation))
    })).then(() => {
      if (this.operations.length > 1) {
        log.info('Finished to run all operations.');
      }
    })
    : Promise.resolve();

  initRun.then(() => {
    const withFrequency = _.filter(this.operations, (o) => !!o.frequency);

    if (!withFrequency.length) {
      return process.exit();
    }

    if (this.config.isDryRun) {
      log.info('Dry run finished. Aborting process.');
      return process.exit();
    }

    log.info(`Scheduling ${this.operations.length} operation(s) to run with their set frequency...`);

    withFrequency.forEach((operation) => {
      new CronJob(
        operation.frequency,
        () => {
          this.runOperation(operation)
        },
        null, // onComplete
        true, // start
        null, // timezone
        null, // context
        null  // runOnInit
      );
    });

    log.info(`Scheduling complete. Keep this process alive and you're good to go!`);
  });
};

agent.prototype.push = function pushData(config) {
  config.type = 'push';
  this.operations.push(config);
  log.info(`Configured push to dataSource ${config.targetDataSourceId}.`);
  return this;
};

agent.prototype.pull = function pullData(config) {
  config.type = 'pull';
  this.operations.push(config);
  log.info(`Configured pull from dataSource ${config.targetDataSourceId}.`);
  return this;
};

agent.prototype.start = function startAgent() {
  log.info('Agent started successfully. Press Ctrl+C to quit.');
  log.info('-------------------------------------------------');
  process.stdin.resume();
  return this.run();
  return this;
};

module.exports = agent;