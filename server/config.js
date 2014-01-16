var fs = require('fs');

var config = {};

/**
 * 
 * Server Identity
 * 
 */
config.ipAddress = '127.0.0.1';
config.portNumber = 8124;
config.filePath = 'D:\\temp\\opj_ssfrs_received\\';

/**
 * 
 * Server use SSL ?
 * 
 */
config.ssl = false;
// config.sslOptions = {
	// key: fs.readFileSync('server/server-key.pem'),
	// cert: fs.readFileSync('server/server-cert.pem'),
	// ca: [fs.readFileSync('server/client-cert.pem')],
	// requestCert: true,
	// rejectUnauthorized: false
// };

/**
 * 
 * Server trust
 * Example: config.registeredIp = ['10.1.1.213', '10.8.8.12', '10.8.8.14'];
 * 
 */
config.registeredIp = [];

/**
 * 
 * Mongo database server identity
 * 
 */
config.mongoServer = '127.0.0.1';
config.mongoPort = 27017;
config.mongoDatabase = 'transporter';

/**
 * 
 * Gearman job server identity
 * 
 */
config.gearmanIntegrate = false;
config.gearmanServerAddress = '127.0.0.1';
config.gearmanServerPort = 4730;

module.exports = config;