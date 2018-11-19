const Service = require('node-windows').Service;

const { Agent, config } = require('./libs/agent-bootstrap');

const operations = [];
config.setup(operations);

if (!operations.length) {
  console.error('No operations have been defined.');
}

const description = operations[0].description;

// Create a new service object
const svc = new Service({
  name: 'Fliplet Agent',
  description,
  script: require('path').join(__dirname, 'fliplet-agent-start.js'),
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

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  svc.start();
});

svc.install();