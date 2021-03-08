const config = require('./config');

/*
  Sample configuration file
  for Fliplet Agent *
  Usage: fliplet - agent start. / sample.js
*/

module.exports.config = config;

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
    agent.notify({
        description: 'Creates notification',
        frequency: '*/15 * * * * ',
        id: 1234,
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
                    uuid(),
                    'Hello world',
                    1,
                    new Date().toISOString(),
                    new Date().toISOString(),
                ]
            });
        }
    });
};