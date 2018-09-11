/*
 * Sample configuration file for Fliplet Agent
 * Usage: fliplet-agent start ./sample.js
 */

module.exports.config = {
  authToken: 'eu--861380a0d7edbc3f87c6023e64950a57-213-508-2112',
  database: {
    url: 'postgres://postgres@localhost:5432/eu',
    dialect: 'postgres'
  }
};

module.exports.setup = (agent) => {
  // Push data from your table to a Fliplet Data Source
  agent.push({
    description: 'Pushes data from my table to Fliplet',
    frequency: '* * * * *',
    sourceQuery: (db) => db.query('SELECT id, email, "updatedAt" FROM users order by id asc;'),
    primaryColumnName: 'id',
    timestampColumnName: 'updatedAt',
    targetDataSourceId: 825
  });
};