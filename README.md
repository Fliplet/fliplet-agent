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

Create a simple file with with `.yml` extension (or grab a [sample copy here](https://raw.githubusercontent.com/Fliplet/fliplet-agent/master/sample.yml)) with the following configuration details and replace with your own settings where appropriate:

```yml
# Fliplet API authorisation token taken from Fliplet Studio
auth_token: eu--123456789

# Database connection settings
database_driver: postgres
database_host: localhost
database_username: postgres
database_password: 123456
database_port: 5432
database_name: eu

# Description of your operation (will be printed out in the logs)
description: Push my users to Fliplet

# Frequency of running using unix cronjob syntax
frequency: '*/15 * * * *'

# The query to run to fetch the data to be pushed to Fliplet
query: SELECT id, email, fullName, updatedAt FROM users;

# Define which column should be used as primary key
# to understand whether a record already exists on the Fliplet Data Source.
# If you don't define this, every time the script runs rows will be appended
# to the Fliplet Data Source without running a comparison on whether the row
# has already been added.
primary_column: id

# Define which (optional) column should be used to compare whether
# the record has been updated on your database since it got inserted
# to the Fliplet Data Source hence might require updating
timestamp_column: updatedAt

# Define the ID of the target Fliplet Data Source
datasource_id: 123
```

Once you have a configuration file like the one above saved on disk, starting the agent is as simple as running the following command from your shell:

```bash
fliplet-agent start ./path/to/configurationFile.yml
```

Sample output below:

![sample](https://user-images.githubusercontent.com/574210/45174672-c12aeb80-b20b-11e8-806e-bda5f0e521b0.png)

---

## Advanced use (requires a JavaScript config file)

**Note: this documentation only applies to users using a JavaScript configuration file instead of the simpler YML (YAML) approach.**

Running the Fliplet Agent in advanced mode requires you to create a configuration file written in JavaScript (instead of YML) with the following required details:

1. **Fliplet authToken**: The authorisation token generated via Fliplet Studio.
2. **Database connection details**: Username, password, host, port and database name to connect to your database server.
3. A list of **operations** to run: each operation defines how data is pushed, pulled or synced between your database and Fliplet servers.

Here's a sample configuration file to give you an idea on its structure:

```js
// Save this into a file and run using "fliplet-agent start ./path/to/file.js"

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

    // The query (or operation) to run to fetch the data to be pushed to Fliplet.
    // You should define a function returning a promise with the data.
    // In our example, we fetch the data using a SQL query from the local database.
    sourceQuery: (db) => db.query('SELECT id, email, "updatedAt" FROM users order by id asc;'),

    // Define which column should be used as primary key
    // to understand whether a record already exists on the Fliplet Data Source
    primaryColumnName: 'id',

    // Define which (optional) column should be used to compare whether
    // the record has been updated on your database since it got inserted
    // to the Fliplet Data Source hence might require updating
    timestampColumnName: 'updatedAt',

    // The ID of the Fliplet Data Source where data should be inserted to
    targetDataSourceId: 123
  });

  // You can define any other operation similar to the above here using "agent.push()"

};
```

You can define as many push operations as you want inside a single configuration file. **They will be run in series and scheduled for future running according to the frequency set**.

Once you have a configuration file like the one above saved on disk, starting the agent is as simple as running the following command from your shell:

```bash
fliplet-agent start ./path/to/configurationFile.js
```

---

In the future, support for pulling data and a two-ways data sync will be made available.
