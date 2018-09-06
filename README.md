# Fliplet Agent (Data Integration Service)

Fliplet Agent is a command line utility to synchronize data to and from Fliplet Servers.

---

## Install

Please install [node.js](http://nodejs.org/) and [npm](http://npmjs.com) to get started. Then, run this simple command to install the agent on your machine:

```bash
npm install fliplet-agent -g
```

You can now use the command `fliplet-agent` from the command line. Just type `fliplet-agent` to see the available options and their example usage.

---

## Get started

Running the Fliplet Agent requires you to create a configuration file written in JavaScript with the following required details:

1. **Fliplet authToken**: The authorisation token generated via Fliplet Studio.
2. **Database connection details**: Username, password, host, port and database name to connect to your database server.
3. A list of **operations** to run: each operation defines how data is pushed, pulled or synced between your database and Fliplet servers.

Here's a sample configuration file to give you an idea on its structure:

```js
module.exports.config = {
  // Fliplet authorisation token from Fliplet Studio
  authToken: 'eu--123456789',

  // Database connection settings (using Sequelize format)
  database: {
    url: 'postgres://user@host:port/dbName',
    dialect: 'postgres'
  }
};

module.exports.setup = (agent) => {

  // Push data from your table to a Fliplet Data Source
  agent.push({
    // Description of your operation (will be printed out in the logs)
    description: 'Pushes data from my table to Fliplet',

    // Frequency of running using unix cronjob syntax
    frequency: '* * * * *',

    // The query to run to fetch the data from your database
    sourceQuery: (db) => db.query('SELECT id, email, "updatedAt" FROM users order by id asc;'),

    // Define which column should be used as primary key
    // to understand whether a record already exists on the Fliplet Data Source
    primaryColumnName: 'id',

    // Define which column should be used to compare whether
    // the record has been updated on your database since it got inserted
    // to the Fliplet Data Source hence might require updating
    timestampColumnName: 'updatedAt',

    // The ID of the Fliplet Data Source where data should be inserted to
    targetDataSourceId: 123
  });

  // You can define any other operation similar to the above here using "agent.push()"

};
```

Once you have a configuration file on your system, starting the agent is as simple as running the following command from your shell:

```bash
fliplet-agent start ./path/to/configurationFile.js
```