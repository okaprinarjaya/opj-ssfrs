var cfg = require('./config');
var net = require(!cfg.ssl ? 'net' : 'tls');
var fstream = require('fs');
var crypt = require('crypto');
var svrUtils = require('./server_utils');

var server = null;
var hasLogging = false;

if (!cfg.ssl) {
	server = net.createServer(connectionHandler);
} else {
	server = net.createServer(cfg.sslOptions, connectionHandler);
}

server.on('listening', function () {
	console.log('Server started on %j', server.address());

	if (cfg.ssl) {
		console.log('Secured with SSL');
	}
});

server.on('error', function (err) {
	if (!hasLogging) {
		hasLogging = true;
		svrUtils.writeLog({
			doc_type: "log_receive",
			packet_type: null,
			stuff_type: null,
			src_packet_name: null,
			src_packet_size: 0,
			dst_packet_size: 0,
			src_start_timestamp: null,
			dst_end_timestamp: svrUtils.formatDateSQL(new Date()),
			delivery_status: "failed server error",
			server_status: err.code,
			src_addr: null,
			dst_addr: null
		});
	}
});

server.on('close', function () {
	console.log('Server closed for connections.');
});

server.listen(cfg.portNumber, cfg.ipAddress);

function concat(files, dest, dataHeader, remoteAddress, cb, idx) {
	idx || (idx = 0);

	fstream.exists(cfg.filePath+files[idx], function (exists) {
		if (exists) {
			if (typeof dest === 'string') {
				dest = fstream.createWriteStream(cfg.filePath+dest);
			}

			var rs = fstream.createReadStream(cfg.filePath+files[idx]);

			rs.once('end', function () {
				if (++idx === files.length) {
					dest.close();
					dest.end();
					rs.close();
					rs.unpipe(dest);
					dest = null;

					fstream.exists(cfg.filePath+dataHeader.basefilename, function (exists) {
						if (exists) {
							var arrivalDate = new Date();

							fstream.stat(cfg.filePath+dataHeader.basefilename, function (err, stats) {
								if (stats.size == dataHeader.basefilesize) {
									var theCrypt = crypt.createHash('md5');
									var reader = fstream.createReadStream(cfg.filePath+dataHeader.basefilename);

									reader.on('data', function(data) {
										theCrypt.update(data);
									});

									reader.on('end', function () {
										var cs = theCrypt.digest('base64');

										if (cs == dataHeader.basechecksum) {

											var logDataClient = {
												_id: dataHeader.docNoParent,
												doc_type: "log_sent",
												packet_type: "parent",
												stuff_type: dataHeader.stuff_type,
												totalparts: dataHeader.totalparts,
												src_packet_name: dataHeader.basefilename,
												src_packet_size: dataHeader.basefilesize,
												dst_packet_size: stats.size,
												src_start_timestamp: svrUtils.formatDateSQL(dataHeader.basesentdate),
												dst_end_timestamp: svrUtils.formatDateSQL(arrivalDate),
												delivery_status: "received",
												server_status: "OK_PARTS_RECEIVED_COMPLETE",
												src_addr: remoteAddress,
												dst_addr: server.address().address
											};

											var logDataServer = {
												_id: dataHeader.docNoParent+"XYZ",
												doc_type: "log_receive",
												packet_type: "parent",
												stuff_type: dataHeader.stuff_type,
												totalparts: dataHeader.totalparts,
												src_packet_name: dataHeader.basefilename,
												src_packet_size: dataHeader.basefilesize,
												dst_packet_size: stats.size,
												src_start_timestamp: svrUtils.formatDateSQL(dataHeader.basesentdate),
												dst_end_timestamp: svrUtils.formatDateSQL(arrivalDate),
												delivery_status: "received",
												server_status: "OK_PARTS_RECEIVED_COMPLETE",
												src_addr: remoteAddress,
												dst_addr: server.address().address
											};

											svrUtils.updateClientDb(logDataClient, remoteAddress);
											svrUtils.writeLog(logDataServer);

											// Delete parts that has been concatenated
											files.forEach(function (item) {
												fstream.exists(cfg.filePath+item, function (exists) {
													if (exists) {
														fstream.unlink(cfg.filePath+item, function (err) {
															// console.log(err);
														});
													}
												});
											});

											// Check wether submitting job to gearman job server
											if (cfg.gearmanIntegrate) {
												if (dataHeader.hasOwnProperty('exec_gearman_func')) {
													var dataInfo = {
														filename: dataHeader.basefilename,
														filesize: dataHeader.basefilesize,
														checksum: dataHeader.basechecksum
													};

													svrUtils.gearmanSubmitJob(dataHeader.exec_gearman_func, JSON.stringify(dataInfo));
												}
											} else {
												console.log("There is no gearman func that can be submitted");
											}

											// Next process execution without gearman
											if (dataHeader.hasOwnProperty('exec_func')) {
												console.log('Have exec_func property');

												var exec = require('child_process').exec;

												exec(dataHeader.exec_func, function (err, stdout, stderr) {
													console.log('stdout: '+stdout);
													console.log('stderr: '+stderr);

													if (err !== null) {
														console.log('error: '+err);
													}
												});
											} else {
												console.log('Does not have exec_func property');
											}

											console.log("OK! DATA VALID! GOOD DAY!");

										} else {
											var logDataClient = {
												_id: dataHeader.docNoParent,
												doc_type: "log_sent",
												packet_type: "parent",
												stuff_type: dataHeader.stuff_type,
												totalparts: dataHeader.totalparts,
												src_packet_name: dataHeader.basefilename,
												src_packet_size: dataHeader.basefilesize,
												dst_packet_size: stats.size,
												src_start_timestamp: svrUtils.formatDateSQL(dataHeader.basesentdate),
												dst_end_timestamp: svrUtils.formatDateSQL(arrivalDate),
												delivery_status: "failed",
												server_status: "FAIL_PARTS_RECEIVED_INVALID",
												src_addr: remoteAddress,
												dst_addr: server.address().address
											};

											var logDataServer = {
												_id: dataHeader.docNoParent+"XYZ",
												doc_type: "log_receive",
												packet_type: "parent",
												stuff_type: dataHeader.stuff_type,
												totalparts: dataHeader.totalparts,
												src_packet_name: dataHeader.basefilename,
												src_packet_size: dataHeader.basefilesize,
												dst_packet_size: stats.size,
												src_start_timestamp: svrUtils.formatDateSQL(dataHeader.basesentdate),
												dst_end_timestamp: svrUtils.formatDateSQL(arrivalDate),
												delivery_status: "failed",
												server_status: "FAIL_PARTS_RECEIVED_INVALID",
												src_addr: remoteAddress,
												dst_addr: server.address().address
											};

											svrUtils.updateClientDb(logDataClient, remoteAddress);
											svrUtils.writeLog(logDataServer);

											console.log("CHECKSUM NOT EQUALS!");
										}

										console.log("CHECKSUM = "+cs);
									});

								} else {
									var logDataClient = {
										_id: dataHeader.docNoParent,
										doc_type: "log_sent",
										packet_type: "parent",
										stuff_type: dataHeader.stuff_type,
										totalparts: dataHeader.totalparts,
										src_packet_name: dataHeader.basefilename,
										src_packet_size: dataHeader.basefilesize,
										dst_packet_size: stats.size,
										src_start_timestamp: svrUtils.formatDateSQL(dataHeader.basesentdate),
										dst_end_timestamp: svrUtils.formatDateSQL(arrivalDate),
										delivery_status: "failed",
										server_status: "FAIL_PARTS_RECEIVED_INVALID",
										src_addr: remoteAddress,
										dst_addr: server.address().address
									};

									var logDataServer = {
										_id: dataHeader.docNoParent+"XYZ",
										doc_type: "log_receive",
										packet_type: "parent",
										stuff_type: dataHeader.stuff_type,
										totalparts: dataHeader.totalparts,
										src_packet_name: dataHeader.basefilename,
										src_packet_size: dataHeader.basefilesize,
										dst_packet_size: stats.size,
										src_start_timestamp: svrUtils.formatDateSQL(dataHeader.basesentdate),
										dst_end_timestamp: svrUtils.formatDateSQL(arrivalDate),
										delivery_status: "failed",
										server_status: "FAIL_PARTS_RECEIVED_INVALID",
										src_addr: remoteAddress,
										dst_addr: server.address().address
									};

									svrUtils.updateClientDb(logDataClient, remoteAddress);
									svrUtils.writeLog(logDataServer);

									console.log("SIZE NOT EQUALS");
								}

								console.log("FILESIZE = "+stats.size);
							});

						} else {
							console.log("FILE NOT EXIST");
						}
					});

					return cb();
				} else {
					concat(files, dest, dataHeader, remoteAddress, cb, idx);
				}
			});

			rs.once('error', function (err) {
				console.log(err);
			});

			rs.pipe(dest, {end:false});
			
		}
	});

}

function connectionHandler(socket) {
	var remoteAddress = socket.remoteAddress;

	socket.write(svrUtils.createResponseStatus('OK_SERVER_ACTIVE'));
	console.log('Incoming connection from: '+remoteAddress);

	var securityCheckPassed = false;

	if (cfg.ssl == true || cfg.registeredIp.length != 0) {
		if (!securityCheckPassed) {
			svrUtils.secureItPleaseBro(socket);
			securityCheckPassed = true;
		}
		
	} else {
		socket.write(svrUtils.createResponseStatus('OK_AUTHORIZED'));
	}

	/*
	*********************************
	* On data received              *
	* *******************************
	*/
	var listData = [];
	var totalDataLength = 0;
	var dataHeaderPassed = true;
	var dataHeader = null;

	socket.on('data', function (chunk) {
		console.log('Received data chunk. Length: '+chunk.length);

		if (dataHeaderPassed) {
			console.log('Reading data header.');

			// Initiate and save data header
			dataHeader = svrUtils.setupDataHeader(
				socket,
				chunk,
				remoteAddress,
				server.address().address
			);

			if (dataHeader != null) {
				dataHeaderPassed = false;
			}

		} else {

			// Populate data chunk into an array list
			listData.push(chunk);
			totalDataLength += chunk.length;

			// Check if received file size (length) equals to original size of the source file
			if (totalDataLength == parseInt(dataHeader.filesize)) {
				socket.write(svrUtils.createResponseStatus('DATA_RECEIVE_FINISH'));

				// Then process all received chunks
				var proc = svrUtils.processCompletelyReceivedChunks(
					listData,
					dataHeader,
					remoteAddress,
					server.address().address
				);

				socket.write(proc);

				// IS THIS A PARTIAL DATA SENDING??
				if (dataHeader.partial) {

					var dataParts = [];
					for (var u=1; u<=dataHeader.totalparts; u++) {
						dataParts.push(dataHeader.basefilename+'.part'+u);
					}

					concat(dataParts, dataHeader.basefilename, dataHeader, remoteAddress, function () {
						console.log("Done!");
					});

					socket.end();

				} else {
					socket.end();

					// Check wether submitting job to gearman job server
					if (cfg.gearmanIntegrate) {
						if (dataHeader.hasOwnProperty('exec_gearman_func')) {
							var dataInfo = {
								filename: dataHeader.filename,
								filesize: dataHeader.filesize,
								checksum: dataHeader.checksum
							};

							svrUtils.gearmanSubmitJob(dataHeader.exec_gearman_func, JSON.stringify(dataInfo));
						}
					} else {
						console.log("There is no gearman func that can be submitted");
					}
					
					// Next process execution without gearman
					if (dataHeader.hasOwnProperty('exec_func')) {
						console.log('Have exec_func property');

					    var exec = require('child_process').exec;
						
						exec(dataHeader.exec_func, function (err, stdout, stderr) {
						    console.log('stdout: '+stdout);
							console.log('stderr: '+stderr);
							
							if (err !== null) {
							    console.log('error: '+err);
							}
						});
					} else {
						console.log('Does not have exec_func property');
					}
				}
			}
		}

	});
	// --- End on data received --- //

	/*
	***********************************
	* On all process completely done! *
	* *********************************
	*/
	socket.on('end', function () {
		console.log('Total filesize received: '+totalDataLength);
		console.log('Client disconnecting.');
	});
	// --- End On all process completely done! --- //

	/*
	*************************************************************
	* Emitted once the socket is fully closed.                  *
	* The argument had_error is a boolean which says            *
	* if the socket was closed due to a transmission error.     *
	* ***********************************************************
	*/
	socket.on('close', function (had_error) {
		if (had_error) {
			if (dataHeader != null) {
				if (!dataHeader.partial) {
					svrUtils.writeLog({
						doc_type: "log_receive",
						packet_type: "single",
						stuff_type: dataHeader.stuff_type,
						src_packet_name: dataHeader.filename,
						src_packet_size: dataHeader.filesize,
						dst_packet_size: totalDataLength,
						src_start_timestamp: svrUtils.formatDateSQL(dataHeader.sentdate),
						dst_end_timestamp: svrUtils.formatDateSQL(new Date()),
						delivery_status: 'FAIL_TRANSMISSION_ERROR',
						server_status: 'FAIL_TRANSMISSION_ERROR',
						src_addr: remoteAddress,
						dst_addr: server.address().address
					});
				} else {
					svrUtils.writeLog({
						doc_type: "log_receive",
						packet_type: "parts",
						stuff_type: dataHeader.stuff_type,
						docno_parent: dataHeader.docNoParent,
						src_packet_name: dataHeader.filename,
						src_packet_size: dataHeader.filesize,
						dst_packet_size: totalDataLength,
						src_start_timestamp: svrUtils.formatDateSQL(dataHeader.sentdate),
						dst_end_timestamp: svrUtils.formatDateSQL(new Date()),
						delivery_status: 'FAIL_TRANSMISSION_ERROR',
						server_status: 'FAIL_TRANSMISSION_ERROR',
						src_addr: remoteAddress,
						dst_addr: server.address().address
					});
				}
			}

			console.log('The socket was fully closed due to a transmission error.');
		}

		socket.end();
		console.log('Close.');
	});
	// --- End on close --- //

	socket.on('error', function (err) {
		if (dataHeader != null) {
			if (!hasLogging) {
				hasLogging = true;
				if (!dataHeader.partial) {
					svrUtils.writeLog({
						doc_type: "log_receive",
						packet_type: "single",
						stuff_type: dataHeader.stuff_type,
						src_packet_name: dataHeader.filename,
						src_packet_size: dataHeader.filesize,
						dst_packet_size: totalDataLength,
						src_start_timestamp: svrUtils.formatDateSQL(dataHeader.sentdate),
						dst_end_timestamp: svrUtils.formatDateSQL(new Date()),
						delivery_status: "failed",
						server_status: err.code,
						src_addr: remoteAddress,
						dst_addr: server.address().address
					});
				} else {
					svrUtils.writeLog({
						doc_type: "log_receive",
						packet_type: "parts",
						stuff_type: dataHeader.stuff_type,
						docno_parent: dataHeader.docNoParent,
						src_packet_name: dataHeader.filename,
						src_packet_size: dataHeader.filesize,
						dst_packet_size: totalDataLength,
						src_start_timestamp: svrUtils.formatDateSQL(dataHeader.sentdate),
						dst_end_timestamp: svrUtils.formatDateSQL(new Date()),
						delivery_status: "failed",
						server_status: err.code,
						src_addr: remoteAddress,
						dst_addr: server.address().address
					});
				}
			}
		}

		console.log(err);
	});
}