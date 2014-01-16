var Opj_Ssfrc = require('./Opj_Ssfrc');

// Prepare file information
var filePath = 'C:\\Users\\oka\\Documents\\ASUS\\';
var fname = process.argv[2];

// Instance object client
var client = new Opj_Ssfrc('10.1.1.213', 8124);

client.setSSL(null);
client.setMongoProps({server:'10.8.8.12',port:27017,db:'transporter'});
client.setFilePath(filePath);

var rawDataInfo = client.getDataInfo(filePath+fname);

client.setHeader({
	partial: false,
	stuff_type: "JT",
	sentdate: new Date(),
	filename: fname,
	filesize: rawDataInfo.filesize,
	checksum: rawDataInfo.checksum,
	exec_func: "php -v",
	exec_gearman_func: "awesomeFunction",
	createfile: true
});

client.setCallbacks({
	onFinish: function (data) {
		console.log('callback on finish');
	},

	onError: function (data) {
		console.log('function on error executed!');
	}
});

client.send();