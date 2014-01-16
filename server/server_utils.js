var fstream = require('fs');
var cfg = require('./config');
var crypt = require('crypto');
var MongoClient = require('mongodb').MongoClient;
var hasLogging = false;

module.exports = {
	/*
	***************************************************************
	* Function for merging populated data chunk into buffer.      *
	* This function also decide wether the data is valid or not.  *
	* Return: Plain JSON string                                   *
	***************************************************************
	*/
	processCompletelyReceivedChunks: function (allReceivedChunk, dataHeader, remoteAddr, serverAddr) {
		var oriFilesize = parseInt(dataHeader.filesize);
		var buff = new Buffer(oriFilesize);
		var listDataLength = allReceivedChunk.length;
		var pos = 0;

		for (var i=0; i<listDataLength; i++) {
			allReceivedChunk[i].copy(buff, pos);
			pos += allReceivedChunk[i].length;
		}

		// Compare received data with source data header.
		var myChecksum = this.hashFile(buff);
		var responseToSrcAddr = null;

		if (buff.length == oriFilesize && myChecksum == dataHeader.checksum) {
			var arrivalDate = new Date();
			var _this = this;

			// Write the buffer to file
			if (dataHeader.createfile) {
				var ws = fstream.createWriteStream(cfg.filePath+dataHeader.filename);

				ws.on('error', function (err) {
					if (!hasLogging) {
						hasLogging = true;
						if (!dataHeader.partial) {
							_this.writeLog({
								doc_type: "log_receive",
								packet_type: "single",
								stuff_type: dataHeader.stuff_type,
								src_packet_name: dataHeader.filename,
								src_packet_size: oriFilesize,
								dst_packet_size: buff.length,
								src_start_timestamp: _this.formatDateSQL(dataHeader.sentdate),
								dst_end_timestamp: _this.formatDateSQL(new Date()),
								delivery_status: "failed to write file",
								server_status: err.code,
								src_addr: remoteAddr,
								dst_addr: serverAddr
							});
						} else {
							_this.writeLog({
								doc_type: "log_receive",
								packet_type: "parts",
								stuff_type: dataHeader.stuff_type,
								docno_parent: dataHeader.docNoParent,
								src_packet_name: dataHeader.filename,
								src_packet_size: oriFilesize,
								dst_packet_size: buff.length,
								src_start_timestamp: _this.formatDateSQL(dataHeader.sentdate),
								dst_end_timestamp: _this.formatDateSQL(new Date()),
								delivery_status: "failed to write file",
								server_status: err.code,
								src_addr: remoteAddr,
								dst_addr: serverAddr
							});
						}
					}
				});

				ws.write(buff);
				ws.end();
			}
			
			responseToSrcAddr = this.createResponseStatus(
				'OK_DATA_VALID_INFO',
				dataHeader.filename+';'+myChecksum+';'+buff.length+';'+this.formatDateSQL(arrivalDate)
			);

			if (!dataHeader.partial) {
				this.writeLog({
					doc_type: "log_receive",
					packet_type: "single",
					stuff_type: dataHeader.stuff_type,
					src_packet_name: dataHeader.filename,
					src_packet_size: oriFilesize,
					dst_packet_size: buff.length,
					src_start_timestamp: this.formatDateSQL(dataHeader.sentdate),
					dst_end_timestamp: this.formatDateSQL(arrivalDate),
					delivery_status: "received",
					server_status: "OK_DATA_VALID_INFO",
					src_addr: remoteAddr,
					dst_addr: serverAddr
				});
			} else {
				this.writeLog({
					doc_type: "log_receive",
					packet_type: "parts",
					stuff_type: dataHeader.stuff_type,
					docno_parent: dataHeader.docNoParent,
					src_packet_name: dataHeader.filename,
					src_packet_size: oriFilesize,
					dst_packet_size: buff.length,
					src_start_timestamp: this.formatDateSQL(dataHeader.sentdate),
					dst_end_timestamp: this.formatDateSQL(arrivalDate),
					delivery_status: "received",
					server_status: "OK_DATA_VALID_INFO",
					src_addr: remoteAddr,
					dst_addr: serverAddr
				});
			}

		} else {
			var arrivalDate = new Date();

			responseToSrcAddr = this.createResponseStatus(
				'FAIL_DATA_INVALID_INFO',
				dataHeader.filename+';'+myChecksum+';'+buff.length+';'+this.formatDateSQL(arrivalDate)
			);

			if (!dataHeader.partial) {
				this.writeLog({
					doc_type: "log_receive",
					packet_type: "single",
					stuff_type: dataHeader.stuff_type,
					src_packet_name: dataHeader.filename,
					src_packet_size: oriFilesize,
					dst_packet_size: buff.length,
					src_start_timestamp: this.formatDateSQL(dataHeader.sentdate),
					dst_end_timestamp: this.formatDateSQL(arrivalDate),
					delivery_status: "failed",
					server_status: "FAIL_DATA_INVALID_INFO",
					src_addr: remoteAddr,
					dst_addr: serverAddr
				});
			} else {
				this.writeLog({
					doc_type: "log_receive",
					packet_type: "parts",
					stuff_type: dataHeader.stuff_type,
					docno_parent: dataHeader.docNoParent,
					src_packet_name: dataHeader.filename,
					src_packet_size: oriFilesize,
					dst_packet_size: buff.length,
					src_start_timestamp: this.formatDateSQL(dataHeader.sentdate),
					dst_end_timestamp: this.formatDateSQL(arrivalDate),
					delivery_status: "failed",
					server_status: "FAIL_DATA_INVALID_INFO",
					src_addr: remoteAddr,
					dst_addr: serverAddr
				});
			}
		}

		return responseToSrcAddr;
	},

	setupDataHeader: function (socket, chunkHeader, remoteAddr, serverAddr) {
		var _this = this;

		socket.on('error', function (err) {
			if (!hasLogging) {
				hasLogging = true;
				_this.writeLog({
					doc_type: "log_receive",
					packet_type: null,
					stuff_type: null,
					src_packet_name: null,
					src_packet_size: 0,
					dst_packet_size: 0,
					src_start_timestamp: null,
					dst_end_timestamp: _this.formatDateSQL(new Date()),
					delivery_status: "failed when parsing header",
					server_status: err.code,
					src_addr: remoteAddr,
					dst_addr: serverAddr
				});
			}

			socket.end();
		});

		var info = null;
		var header = {};

		if (chunkHeader.length != 0 && chunkHeader != null && chunkHeader != "" && chunkHeader != '""') {
			try {
				info = JSON.parse(chunkHeader);

				if (info.hasOwnProperty('partial')) {
					header.partial = info.partial;
				} else {
					header.partial = false;
				}

				header.stuff_type = info.stuff_type;

				if (header.partial) {
					header.totalparts = info.totalparts;
					header.basefilename = info.basefilename;
					header.basefilesize = info.basefilesize;
					header.basechecksum = info.basechecksum;
					header.basesentdate = new Date(info.basesentdate);
					header.docNoParent = info.docNoParent;

					header.sentdate = new Date(info.sentdate);
					header.filename = info.filename;
					header.filesize = info.filesize;
					header.checksum = info.checksum;
					header.createfile = info.createfile;

				} else {
					header.sentdate = new Date(info.sentdate);
					header.filename = info.filename;
					header.filesize = info.filesize;
					header.checksum = info.checksum;
					header.createfile = info.createfile;
				}

				if (info.hasOwnProperty('exec_gearman_func')) {
					header.exec_gearman_func = info.exec_gearman_func;
				}

				if (info.hasOwnProperty('exec_func')) {
					header.exec_func = info.exec_func;
				}

				socket.write(this.createResponseStatus('OK_HEADER_RECEIVED'));

			} catch (e) {
				socket.write(this.createResponseStatus('FAIL_HEADER_NOT_VALID'));
				socket.end();
			}

		} else {
			socket.write(this.createResponseStatus('FAIL_HEADER_NOT_AVAILABLE'));
			socket.end();
		}

		return header;
	},

	secureItPleaseBro: function (socket) {
		var _this = this;

		socket.on('error', function (err) {
			console.log(err.toString());

			if (!hasLogging) {
				hasLogging = true;
				_this.writeLog({
					doc_type: "log_receive",
					packet_type: null,
					stuff_type: null,
					src_packet_name: null,
					src_packet_size: 0,
					dst_packet_size: 0,
					src_start_timestamp: null,
					dst_end_timestamp: _this.formatDateSQL(new Date()),
					delivery_status: "failed",
					server_status: err.code,
					src_addr: socket.remoteAddress,
					dst_addr: null
				});
			}

			socket.end();
		});

		var byPassIpAddress = false;

		if (cfg.registeredIp.length != 0) {
			for (var ip in cfg.registeredIp) {
				if (socket.remoteAddress == cfg.registeredIp[ip]) {
					byPassIpAddress = true;
					break;
				}
			}

		} else {
			byPassIpAddress = true;
		}

		if (!byPassIpAddress) {
			socket.write(this.createResponseStatus('FAIL_NOT_AUTHORIZED'));
			socket.end();
		} else {
			if (cfg.ssl) {
				if (socket.authorized) {
					socket.write(this.createResponseStatus('OK_AUTHORIZED'));
				} else {
					socket.write(this.createResponseStatus('FAIL_NOT_AUTHORIZED'));
					socket.end();
				}
			} else {
				socket.write(this.createResponseStatus('OK_AUTHORIZED'));
			}
		}
	},

	writeLog: function (logDataObject) {
		MongoClient.connect('mongodb://'+cfg.mongoServer+':'+cfg.mongoPort+'/'+cfg.mongoDatabase, function (err, db) {
			var collection = db.collection('logger');

			collection.insert(logDataObject, function (err, result) {
				if (err) {
					console.log(err);
				}

				db.close();
			});
		});
	},

	updateClientDb: function (logDataObject, clientHost) {
		MongoClient.connect('mongodb://'+clientHost+':'+cfg.mongoPort+'/'+cfg.mongoDatabase, function (err, db) {
			var collection = db.collection('logger');

			collection.save(logDataObject, function (err, result) {
				db.close();
			});
		});
	},

	formatDateSQL: function (dateObject, withoutTime) {
		if (typeof(withoutTime) === 'undefined') withoutTime = false;

		var strMonth = (dateObject.getMonth()+1).toString();
		var strDay = dateObject.getDate().toString();
		var month = strMonth.length == 1 ? "0"+strMonth : strMonth;
		var day = strDay.length == 1 ? "0"+strDay : strDay;
		var hours = dateObject.getHours().toString().length == 1 ? "0"+dateObject.getHours().toString() : dateObject.getHours().toString();
		var minutes = dateObject.getMinutes().toString().length == 1 ? "0"+dateObject.getMinutes().toString() : dateObject.getMinutes().toString();
		var secs = dateObject.getSeconds().toString().length == 1 ? "0"+dateObject.getSeconds().toString() : dateObject.getSeconds().toString();

		var strDate = dateObject.getFullYear()+"-"+month+"-"+day+" "+hours+":"+minutes+":"+secs;
		if (withoutTime) {
			strDate = dateObject.getFullYear()+"-"+month+"-"+day;
		}

		return strDate;
	},

	createResponseStatus: function (statusCode, messageStr) {
		if (typeof(messageStr) === 'undefined') messageStr = null;

		var response = {status:statusCode};
		if (messageStr != null) {
			response.message = messageStr; 
		}

		return JSON.stringify(response);
	},

	gearmanSubmitJob: function (funcName, data) {
		var Gearman = require('gearman-js').Gearman;
		var gearmanClient = new Gearman(cfg.gearmanServerAddress, cfg.gearmanServerPort, {timeout:3000});
		var _this = this;

		gearmanClient.connect(function () {
			gearmanClient.submitJob(funcName, data);

			_this.writeLog({
				doc_type: "log_gearman",
				created: _this.formatDateSQL(new Date()),
				mesage: 'Job: '+funcName+' - queued.'
			});
		});

		gearmanClient.on('timeout', function () {
			_this.writeLog({
				doc_type: "log_gearman",
				created: _this.formatDateSQL(new Date()),
				mesage: 'Timeout occured. There is a problem with gearman worker daemon'
			});

			gearmanClient.close();
		});

		gearmanClient.on('WORK_COMPLETE', function (job) {
			_this.writeLog({
				doc_type: "log_gearman",
				created: _this.formatDateSQL(new Date()),
				mesage: 'Job: '+funcName+' - complete.'
			});

			gearmanClient.close();
		});

		gearmanClient.on('error', function (err) {
			_this.writeLog({
				doc_type: "log_gearman",
				created: _this.formatDateSQL(new Date()),
				mesage: "ERROR GEARMAN: "+err.code
			});

			gearmanClient.close();
		});
	},

	hashFile: function (data) {
		var hash = crypt.createHash('md5')
		 .update(data)
		 .digest('base64');

		return hash;
	}
};