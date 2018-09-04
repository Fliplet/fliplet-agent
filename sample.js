/*
 * Sample configuration file for Fliplet Agent
 * Usage: fliplet-agent start ./sample.js
 */

module.exports.config = {
  authToken: 'eu--session--123',
  database: {
    url: 'postgres://postgres@localhost:5432/eu',
    dialect: 'postgres'
  }
};

module.exports.setup = (agent) => {
  // Push data from your table to a Fliplet Data Source
  agent.push({
    sourceQuery: (db) => db.query('SELECT a, b, c FROM d WHERE e = 1;'),
    primaryColumnName: 'a',
    timestampColumnName: 'foo',
    targetDataSource: 123
  });
};