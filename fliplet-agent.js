#!/usr/bin/env node

const path = require('path');
const package = require(path.join(__dirname, 'package.json'));
const program = require('commander');

program
  .version(package.version)
  .command('start [path/to/config.js] [--test]', 'Start the agent. Use the --test command to perform a dry run and avoid writing data to Fliplet servers.')
  .parse(process.argv);