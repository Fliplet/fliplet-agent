const path = require('path');
const Service = require('node-windows').Service;

const { Agent, config } = require('./libs/agent-bootstrap');

const operations = [];
config.setup(operations);

if (!operations.length) {
  console.error('No operations have been defined.');
}

const fileName = path.basename(config.path).split('.')[0];
const description = operations[0].description;

// Create a new service object
const svc = new Service({
  name: `Fliplet Agent (${fileName})`,
  description,
  script: require('path').join(__dirname, 'fliplet-agent-start.js'),
  workingdirectory: require('path').join(__dirname, 'fliplet-agent-start.js'),
  env: [
    {
      name: 'CFGPATH',
      value: config.path
    },
    {
      name: 'SERVICE',
      value: true
    }
  ],
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

svc.on('error', console.error);

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  console.log('The agent has been installed successfully. You can see the logs in the Event Viewer under "Windows Logs" > "Application" for the source "flipletagent.exe"');
  svc.start();
});

svc.install();