/*
 * Sample configuration file for Fliplet Agent
 * Usage: fliplet-agent start ./sample.js
 */

module.exports.config = {
  // Fliplet authorisation token from Fliplet Studio
  authToken: 'eu--123456789',

  // Set to true to test the integration without sending any data to Fliplet servers
  isDryRun: false,

  // If set to true, operations will run when the script starts.
  // Otherwise, they will just run according to their frequency.
  syncOnInit: true
};

module.exports.setup = (agent) => {
  // Push data from your API to a Fliplet Data Source
  agent.push({
    description: 'Pushes data from my table to Fliplet',
    frequency: '* * * * *',
    source: (rest) => rest.get('https://jsonplaceholder.typicode.com/todos'),
    primaryColumnName: 'id',
    timestampColumnName: 'updatedAt',
    targetDataSourceId: 123,
    encrypt: {
      fields: ['title']
    },
    merge: true
  });

  // Pull data from a Fliplet Data Source
  agent.pull({
    description: 'Pull data from a Fliplet data source to my database',
    frequency: '* * * * *',
    targetDataSourceId: 456,
    where: {
      'Foo': 'Bar'
    },
    action: (entries, db) => {
      console.log(entries)
    },
  });
};