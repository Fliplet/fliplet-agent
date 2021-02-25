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
  syncOnInit: true,

  // Define the log verbosity, between "debug", "info" and "critical".
  logVerbosity: 'debug',

  // Database connection settings (using Sequelize format)
  // http://docs.sequelizejs.com/
  database: {
    dialect: 'mssql',
    host: 'localhost',
    username: 'foo',
    password: 'bar',
    port: 1234,
    database: 'myDatabaseName',

    // MSSQL Server only
    dialectOptions: {
      domain: 'myDomain',
      instanceName: 'myInstanceName',
      encrypt: false
    }
  }
};

// module.exports.setup = (agent) => {
//   // Push data from your table to a Fliplet Data Source
//   agent.push({
//     description: 'Pushes data from my table to Fliplet',
//     frequency: '* * * * *',
//     sourceQuery: (db) => db.query('SELECT id, email, "updatedAt" FROM users order by id asc;'),
//     primaryColumnName: 'id',
//     caseInsensitivePrimaryColumn: true,
//     timestampColumnName: 'updatedAt',
//     targetDataSourceId: 123,
//     runHooks: [],
//     merge: true
//   });
// };


module.exports.setup = (agent) => {
  agent.createNotification({
    description: 'Creates notification',
    frequency: '*/15 * * * *',
    title: 'Demo Notification',
    topic: 'Demo Topic',
    payload: {
      title: 'Demo Payload Title',
      body: 'hello world'
    },
    status: 'draft',
    subscriptionIds: [1, 2, 3, 4],
    action: (db) => {
      db.query(`
        INSERT INTO [Fliplet].[Notifications] ([RecipientId],[NotificationText],[Status],[CreatedDateTime],[SentDateTime])) VALUES (?, ?, ?, ?, ?);`, {
        replacements: [
          uuidv4(),
          payload.body,
          1,
          Date.now(),
          Date.now()
        ]
      });
    }
  });
};

/*
this.db.query(`
        INSERT INTO [LDC].[Fliplet].[Notifications] ([RecipientId],[NotificationText],[Status],[CreatedDateTime],[SentDateTime])) VALUES (?, ?, ?, ?, ?);`, {
                replacements: [
                    uuidv4(),
                    payload.body,
                    1,
                    Date.now(),
                    Date.now()
                ]
*/