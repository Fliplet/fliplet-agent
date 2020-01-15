#!/usr/bin/env node

// Allow self-signed certificates
process.env.NODE_NO_WARNINGS = 1;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const path = require('path');
const package = require(path.join(__dirname, 'package.json'));
const program = require('commander');

program
  .version(package.version)
  .command('start [path/to/config.js] [--test]', 'Start the agent in foregroud mode. Use the --test command to perform a dry run and avoid writing data to Fliplet servers.')
  .command('install [path/to/config.js]', 'Install a config file to run as a background service (Windows only).')
  .command('uninstall [path/to/config.js]', 'Uninstall a background service.')
  .on('command:*', function (command) {
    const firstCommand = command[0];

    if (!this.commands.find(c => c._name == firstCommand)) {
      console.error('Invalid command: %s\n', program.args.join(' '));
      this.help();
      process.exit(1);
    }
  })
  .parse(process.argv);