var nconf = require('nconf');

nconf.argv()
    .env()
    .file('account', ABSPATH + '/config/account.json')
    .file('main', ABSPATH + '/config/index.json');

module.exports = nconf;
