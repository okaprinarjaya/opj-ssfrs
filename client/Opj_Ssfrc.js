var fs = require('fs');
var MongoClient = require('mongodb').MongoClient;
var shortId = require('shortid');

function Opj_Ssfrc(host,port) {
	this.host = host;
	this.port = port;
	this.sslOpts = null;
	this.header = null;
	this.strFilePath = null;
	this.docId = null;
	this.docNoParent = null;
	this.chunkSize = 0;
	this.partialTotalParts = 0;

	this.validityInfo = {
		filename: null,
		checksum: null,
		filesize: 0,
		arrivalDate: null
	};

	this.mongoServer = null;
	this.mongoPort = 0;
	this.mongoDatabase = null;

	this.callbacks = null;

	var _this = this;

	function __send_private_method() {
		var net = require(_this.sslOpts == null ? 'net' : 'tls');
		var client = null;
		var hasLogging = false;
		var retStatus = null;

		// Write data log first
		if (_this.header.hasOwnProperty('id') && _this.header.id != null) {
			MongoClient.connect('mongodb://'+_this.mongoServer+':'+_this.mongoPort+'/'+_this.mongoDatabase, function (err, db) {
			    db.collection('logger').find({_id:_this.header.id.toString()}).toArray(function (err, docs) {
			    	if (docs.length > 0) {
			    		_this.docId = docs[0]._id.toString();

			    		if (!_this.header.partial) {
							_writeLog({
								_id: _this.docId,
								doc_type: "log_sent",
								packet_type: "single",
								stuff_type: _this.header.stuff_type,
								src_packet_name: _this.header.filename,
								src_packet_size: _this.header.filesize,
								dst_packet_size: _this.validityInfo.filesize,
								src_start_timestamp: _formatDateSQL(_this.header.sentdate),
								dst_end_timestamp: _this.validityInfo.arrivalDate,
								delivery_status: "process",
								server_status: "process",
								dst_addr: this.host
							}, "update");

						} else {
							_writeLog({
								_id: _this.docId,
								doc_type: "log_sent",
								packet_type: "parts",
								stuff_type: _this.header.stuff_type,
								docno_parent: _this.docNoParent,
								src_packet_name: _this.header.filename,
								src_packet_size: _this.header.filesize,
								dst_packet_size: _this.validityInfo.filesize,
								src_start_timestamp: _formatDateSQL(_this.header.sentdate),
								dst_end_timestamp: _this.validityInfo.arrivalDate,
								delivery_status: "process",
								server_status: "process",
								dst_addr: this.host
							}, "update");
						}

			    	}
			    });
			});

		} else {
			_this.docId = _generateDocId();

			if (!_this.header.partial) {
				_writeLog({
					_id: _this.docId,
					doc_type: "log_sent",
					packet_type: "single",
					stuff_type: _this.header.stuff_type,
					src_packet_name: _this.header.filename,
					src_packet_size: _this.header.filesize,
					dst_packet_size: _this.validityInfo.filesize,
					src_start_timestamp: _formatDateSQL(_this.header.sentdate),
					dst_end_timestamp: _this.validityInfo.arrivalDate,
					delivery_status: "process",
					server_status: "process",
					dst_addr: this.host
				}, "insert");

			} else {
				_writeLog({
					_id: _this.docId,
					doc_type: "log_sent",
					packet_type: "parts",
					stuff_type: _this.header.stuff_type,
					docno_parent: _this.docNoParent,
					src_packet_name: _this.header.filename,
					src_packet_size: _this.header.filesize,
					dst_packet_size: _this.validityInfo.filesize,
					src_start_timestamp: _formatDateSQL(_this.header.sentdate),
					dst_end_timestamp: _this.validityInfo.arrivalDate,
					delivery_status: "process",
					server_status: "process",
					dst_addr: this.host
				}, "insert");
			}
		}


		if (_this.sslOpts == null) {
			client = net.connect({host:_this.host, port:_this.port});
		} else {
			client = net.connect(_this.port, _this.host, _this.sslOpts);
		}

		client.setEncoding('utf8');

		client.on('data', function (data) {
			var replyFromServer = validateReplyForm(data);

			if (replyFromServer.length > 1) {
				for (var resp in replyFromServer) {
					retStatus = replyFromServer[resp].status;

					if (replyFromServer[resp].status == 'OK_DATA_VALID_INFO' || replyFromServer[resp].status == 'FAIL_DATA_INVALID_INFO') {
						_this.validityInfo = parseValidityInfo(replyFromServer[resp].message);
						client.end();
					}

					if (replyFromServer[resp].status == 'OK_AUTHORIZED') {
						client.write(JSON.stringify(_this.header));
					} else if (replyFromServer[resp].status.trim() == 'OK_HEADER_RECEIVED') {
						fs.createReadStream(_this.strFilePath+_this.header.filename).pipe(client);
					}

					console.log(retStatus);
				}

			} else {
				retStatus = replyFromServer[0].status;

				if (replyFromServer[0].status == 'OK_DATA_VALID_INFO' || replyFromServer[0].status == 'FAIL_DATA_INVALID_INFO') {
					_this.validityInfo = parseValidityInfo(replyFromServer[0].message);
					client.end();
				}

				if (replyFromServer[0].status == 'OK_AUTHORIZED') {
					client.write(JSON.stringify(_this.header));
				}

				if (replyFromServer[0].status.trim() == 'OK_HEADER_RECEIVED') {
					fs.createReadStream(_this.strFilePath+_this.header.filename).pipe(client);
				}

				console.log(retStatus);
			}
		});
	
		client.on('end', function () {
			var info = {
				_id: _this.docId,
				src_packet_name: _this.header.filename,
				src_packet_size: _this.header.filesize,
				dst_packet_size: _this.validityInfo.filesize,
				src_start_timestamp: _formatDateSQL(_this.header.sentdate),
				dst_end_timestamp: _this.validityInfo.arrivalDate,
				delivery_status: "delivered",
				server_status: retStatus,
				dst_addr: _this.host
			};

			if (!_this.header.partial) {
				_writeLog({
					_id: _this.docId,
					doc_type: "log_sent",
					packet_type: "single",
					stuff_type: _this.header.stuff_type,
					src_packet_name: _this.header.filename,
					src_packet_size: _this.header.filesize,
					dst_packet_size: _this.validityInfo.filesize,
					src_start_timestamp: _formatDateSQL(_this.header.sentdate),
					dst_end_timestamp: _this.validityInfo.arrivalDate,
					delivery_status: "delivered",
					server_status: retStatus,
					dst_addr: _this.host
				}, "update");
			} else {
				_writeLog({
					_id: _this.docId,
					doc_type: "log_sent",
					packet_type: "parts",
					stuff_type: _this.header.stuff_type,
					docno_parent: _this.docNoParent,
					src_packet_name: _this.header.filename,
					src_packet_size: _this.header.filesize,
					dst_packet_size: _this.validityInfo.filesize,
					src_start_timestamp: _formatDateSQL(_this.header.sentdate),
					dst_end_timestamp: _this.validityInfo.arrivalDate,
					delivery_status: "delivered",
					server_status: retStatus,
					dst_addr: _this.host
				}, "update");
			}

			client.end();
			_this.callbacks.onFinish(info);

		});

		client.on('close', function () {
			client.end();
			console.log('Connection to server fully closed.');
		});

		client.on('error', function (err) {
			var info = {
				_id: _this.docId,
				src_packet_name: _this.header.filename,
				src_packet_size: _this.header.filesize,
				dst_packet_size: _this.validityInfo.filesize,
				src_start_timestamp: _formatDateSQL(_this.header.sentdate),
				dst_end_timestamp: _this.validityInfo.arrivalDate,
				delivery_status: "failed",
				server_status: err.code,
				dst_addr: _this.host
			};

			if (!hasLogging) {
				hasLogging = true;
				if (!_this.header.partial) {
					_writeLog({
						_id: _this.docId,
						doc_type: "log_sent",
						packet_type: "single",
						stuff_type: _this.header.stuff_type,
						src_packet_name: _this.header.filename,
						src_packet_size: _this.header.filesize,
						dst_packet_size: _this.validityInfo.filesize,
						src_start_timestamp: _formatDateSQL(_this.header.sentdate),
						dst_end_timestamp: _this.validityInfo.arrivalDate,
						delivery_status: "failed",
						server_status: err.code,
						dst_addr: _this.host
					}, "update");
				} else {
					_writeLog({
						_id: _this.docId,
						doc_type: "log_sent",
						packet_type: "parts",
						stuff_type: _this.header.stuff_type,
						docno_parent: _this.docNoParent,
						src_packet_name: _this.header.filename,
						src_packet_size: _this.header.filesize,
						dst_packet_size: _this.validityInfo.filesize,
						src_start_timestamp: _formatDateSQL(_this.header.sentdate),
						dst_end_timestamp: _this.validityInfo.arrivalDate,
						delivery_status: "failed",
						server_status: err.code,
						dst_addr: _this.host
					}, "update");
				}

			}

			client.end();
			_this.callbacks.onError(info);
		});
	}

	function _generateDocId () {
		var docId = "LS"+generateYmdStr(new Date())+shortId.generate();
		return docId;
	}

	function _writeLog (logDataObject, type) {
		MongoClient.connect('mongodb://'+_this.mongoServer+':'+_this.mongoPort+'/'+_this.mongoDatabase, function (err, db) {
			var collection = db.collection('logger');

			if (type == "insert") {
				collection.insert(logDataObject, function (err, result) {
					db.close();
				});
			} else if (type == "update") {
				collection.save(logDataObject, function (err, result) {
					db.close();
				});
			}
		});
	}

	function _formatDateSQL (dateObject, withoutTime) {
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
	}

	function generateYmdStr(dateObject) {
		var strMonth = (dateObject.getMonth()+1).toString();
		var strDay = dateObject.getDate().toString();
		var month = strMonth.length == 1 ? "0"+strMonth : strMonth;
		var day = strDay.length == 1 ? "0"+strDay : strDay;

		var strYmd = dateObject.getFullYear()+month+day;
		return strYmd;

	}

	function validateReplyForm(strReply) {
		var patt = /({"\w+":"[A-Za-z0-9 -_]+",?"?:?"?[A-Za-z0-9;/=_.!: -]*"?})({"\w+":"[A-Za-z0-9 -_]+",?"?"?:?"?[A-Za-z0-9;/=_.!: -]*"?})({"\w+":"[A-Za-z0-9 -_]+",?"?"?:?"?[A-Za-z0-9;/=_.!: -]*"?})?"?/gi;
		var matchAndResult = patt.exec(strReply);
		var resp = [];

		if (matchAndResult != null) {
			resp.push(JSON.parse(matchAndResult[1]));
			resp.push(JSON.parse(matchAndResult[2]));

			if (typeof matchAndResult[3] != 'undefined') {
				resp.push(JSON.parse(matchAndResult[3]));
			}

		} else {
			resp.push(JSON.parse(strReply));
		}

		return resp;
	}

	function parseValidityInfo(strValidityInfo) {
		var s = strValidityInfo.split(";");
		return {
			filename: s[0],
			checksum: s[1],
			filesize: s[2],
			arrivalDate: s[3]
		};
	}

	function _cutIntoPieces(baseFile, perPiece) {
		var fd = fs.openSync(_this.strFilePath+baseFile, 'r');
		var selisih = _this.header.filesize % perPiece;
		var parts = (_this.header.filesize - selisih) / perPiece;
		var pieces = [];
		var from = 0;
		var c=1;

		for (var i=1; i<=parts; i++) {
			var buffer = new Buffer(perPiece);
			fs.readSync(fd, buffer, 0, perPiece, from);

			var ws = fs.createWriteStream(_this.strFilePath+baseFile+".part"+i);
			ws.on('error', function () {});
			ws.write(buffer);
			ws.end();

			pieces.push(baseFile+".part"+i);
			from = from + perPiece;
			c++;
		}

		if (selisih > 0) {
			var buff = new Buffer(selisih);
			fs.readSync(fd, buff, 0, selisih, from);

			var ws = fs.createWriteStream(_this.strFilePath+baseFile+".part"+c);
			ws.on('error', function () {});
			ws.write(buff);
			ws.end();

			pieces.push(baseFile+".part"+c);
		}

		fs.closeSync(fd);
		this.partialTotalParts = c;

		// Add some new header information for partial data sending
		_this.header.totalparts = c;
		_this.header.basefilename = baseFile;
		_this.header.basefilesize = _this.header.filesize;
		_this.header.basechecksum = _this.header.checksum;

		return pieces;

	}

	function _getDataInfo(path) {
		var crypt = require('crypto');
		var fsStat = fs.statSync(path);
		var info = {};

		// Get file checksum
		var buffer = new Buffer(fsStat.size);
		var fd = fs.openSync(path, 'r');
		fs.readSync(fd, buffer, 0, fsStat.size, 0);

		info.filesize = fsStat.size;
		info.checksum = crypt.createHash('md5').update(buffer).digest('base64');

		fs.closeSync(fd);

		return info;
	}

	this.__send = function () {
		__send_private_method();
	};

	this.__cutIntoPieces = function (baseFile, perPiece) {
		return _cutIntoPieces(baseFile, perPiece);
	};

	this.__getDataInfo = function (path) {
		return _getDataInfo(path);
	};

	this.__formatDateSQL = function (dateObj) {
		return _formatDateSQL(dateObj);
	};

	this.__generateDocId = function () {
		return _generateDocId();
	};

	this.__writeLog = function (logDataObject, type) {
		_writeLog(logDataObject, type);
	};
}

Opj_Ssfrc.prototype.setSSL = function(sslOpts) {
	this.sslOpts = sslOpts;
};

Opj_Ssfrc.prototype.setHeader = function(headerObject) {
	this.header = headerObject;

	if (!this.header.hasOwnProperty('partial')) {
		this.header.partial = false;
	}
};

Opj_Ssfrc.prototype.setFilePath = function(strPath) {
	this.strFilePath = strPath;
};

Opj_Ssfrc.prototype.setMongoProps = function(propsObject) {
	this.mongoServer = propsObject.server;
	this.mongoPort = propsObject.port;
	this.mongoDatabase = propsObject.db;
};

Opj_Ssfrc.prototype.setChunks = function(chunkSize) {
	this.chunkSize = chunkSize;
};

Opj_Ssfrc.prototype.getDataInfo = function(filePath) {
	var crypt = require('crypto');
	var fsStat = fs.statSync(filePath);
	var info = {};

	// Get file checksum
	var buffer = new Buffer(fsStat.size);
	var fd = fs.openSync(filePath, 'r');
	fs.readSync(fd, buffer, 0, fsStat.size, 0);

	info.filesize = fsStat.size;
	info.checksum = crypt.createHash('md5').update(buffer).digest('base64');

	fs.closeSync(fd);

	return info;
};

Opj_Ssfrc.prototype.setCallbacks = function(cb) {
	this.callbacks = cb;
};

Opj_Ssfrc.prototype.send = function() {
	if (this.chunkSize <= 0 && !this.header.partial) {
		this.__send();

	} else if (this.chunkSize > 0 && this.header.partial) {
		var baseFile = this.header.filename;
		var baseFileSize = this.header.filesize;
		var pieces = this.__cutIntoPieces(baseFile, this.chunkSize);
		var limit = pieces.length;
		var t = 1;

		// Save tracking information to db. We are sending partial data and this is the parent data
		this.docNoParent = this.__generateDocId();
		var _this = this;

		var logDataObject = {
			_id: this.docNoParent,
			doc_type: "log_sent",
			packet_type: "parent",
			stuff_type: _this.header.stuff_type,
			totalparts: this.header.totalparts,
			src_packet_name: baseFile,
			src_packet_size: baseFileSize,
			dst_packet_size: 0,
			src_start_timestamp: this.__formatDateSQL(this.header.sentdate),
			dst_end_timestamp: null,
			delivery_status: "process",
			server_status: null,
			dst_addr: _this.host
		};

		this.__writeLog(logDataObject, "insert");
		// --- End save tracking

		// START! Partial data sending...
		this.header.basesentdate = new Date();

		intv = setInterval(function () {
			if (t <= limit) {
				var rawDataInfo = _this.__getDataInfo(_this.strFilePath+pieces[t-1]);

				// Override and Merge header
				_this.header.sentdate = new Date();
				_this.header.filename = baseFile+".part"+t;
				_this.header.filesize = rawDataInfo.filesize;
				_this.header.checksum = rawDataInfo.checksum;
				_this.header.docNoParent = _this.docNoParent;

				_this.__send();

			} else {
				stopDonk(pieces);
			}

			t++;
			
		}, 3000);

		function stopDonk(thePieces) {
			clearInterval(intv);
			thePieces.forEach(function (item) {
				fs.unlink(_this.strFilePath+item, function (err) {});
			});
		}
	}
};

module.exports = Opj_Ssfrc;