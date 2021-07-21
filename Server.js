// Access the callback-based API
var amqp = require("amqplib/callback_api");
// THIS SHOULD BE A SECRET
//const CLOUDAMQP_URL = "amqps://xbxuskpq:RkcS4WW62YPZLE6hPULkqviRShxRAyaI@puffin.rmq2.cloudamqp.com/xbxuskpq";
const CLOUDAMQP_URL = process.env.AMQPURL;

if (CLOUDAMQP_URL == null || CLOUDAMQP_URL.length == 0) {
	console.log("[!] Error: Set AMQPURL environment variable first!");
}
const COMMAND_QUEUE_NAME = "__cge_internal_command_queue";

var serverChannel = null;

var pendingChanges = {};
var fileMap = {}; // maps a filename to a receiving queue
var contentMap = {}; // maps filecontent to filename

/**
 * Processes the queues to check if any message is received, if received then
 * push it to corresponding list of pendingChanges
 * @param {string} q Sending Queue name
 * @param {string} rq Receiving Queue name
 * @returns {function} Function to execute after callback
 */
function processQueueWrapper(q, rq) {
	// add to transformer queue
	global_recceiving = rq;
	pendingChanges[rq] = {};
	return function (msg) {
		if (msg == null) {
			console.log("[x] Queue removed: " + q);
			fileMap[rq] = null;
		} else {
			console.log(
				"[x] Received in '" + q + "': ",
				msg.content.toString()
			);
			send = true;
			// add to transformer queue
			var received_msg = JSON.parse(msg.content.toString());
			var client = received_msg.clientID.toString();
			console.log("[x] client_ID: ", client);
			console.log("[x] received_msg: ", received_msg.operation_list);

			if (pendingChanges[rq][client] == null) {
				pendingChanges[rq][client] = received_msg.operation_list;
				//	console.log("hi 1");
			} else {
				//	console.log("hi 2");
				pendingChanges[rq][client].push(...received_msg.operation_list);
			}
		}
	};
}

/**
 * Identifies the operation of adding or removing queues for each client
 * @param {JSON} msg The operation message received from client
 */
function processCommand(msg) {
	console.log("[x] CommandQueue: " + msg.content.toString());
	var parts = msg.content.toString().split(" ");
	var receiving_queue = parts[1];
	var sending_queue = parts[2];
	//console.log(parts[3]);
	if (parts[0] == "add") {
		serverChannel.assertQueue(sending_queue, { durable: false });
		serverChannel.assertQueue(receiving_queue, { durable: false });

		serverChannel.consume(
			receiving_queue,
			processQueueWrapper(parts[1], parts[2]),
			{
				noAck: true,
			}
		);
	} else if (parts[0] == "remove") {
		serverChannel.deleteQueue(receiving_queue);
		serverChannel.deleteQueue(sending_queue);
	} else {
		console.log("Invalid command '" + parts[0] + "'!");
	}
	if (parts[3] != "") {
		/*
		for (var a in fileMap) {
			if (fileMap[a] == parts[3]) {
				return;
			}
		}
		// If file name is unique then add to fileMap
		// otherwise should send an error, but YOLO!
		*/
		fileMap[sending_queue] = parts[3];
		// Handling of existing file name is not done yet
		// Blank File name is also not handled.
		// Unique File name must be provided at the start of a new session
		console.log(contentMap);
		if (parts[3] in contentMap) {
			console.log("Found");
			serverChannel.sendToQueue(
				sending_queue,
				Buffer.from(JSON.stringify([[1, contentMap[parts[3]]]]))
			);
		} else {
			contentMap[parts[3]] = "";
		}
	} else {
		fileMap[sending_queue] = null;
	}
}

amqp.connect(CLOUDAMQP_URL, function (error0, connection) {
	if (error0) {
		throw error0;
	}
	// Receiving Queue
	connection.createChannel(function (error1, channel) {
		if (error1) {
			throw error1;
		}

		channel.assertQueue(COMMAND_QUEUE_NAME, {
			durable: false,
		});

		console.log(
			" [*] Waiting for messages in '%s'. To exit press CTRL+C",
			COMMAND_QUEUE_NAME
		);

		serverChannel = channel;
		channel.consume(COMMAND_QUEUE_NAME, processCommand, { noAck: true });
		//send = true;
	});
});

// bind to a port, otherwise heroku kills us,
// and also producer needs to wake us
var http = require("http");
var server = http.createServer(function (req, res) {
	res.writeHead(200, { "Content-Type": "text/plain" });
	res.write("[x] Server is awake!");
	console.log("[x] Server is woke up by ping!");
});
const PORT = process.env.PORT;
if (PORT == null || PORT.length == 0) {
	console.log("[!] Error: Set PORT environment variable first!");
}
server.listen(PORT);

// *************************************
// 			Transformations
// *************************************
const COPY = 0;
const INSERT = 1;
const EQUAL = 2;
const NO_INTERSECT = 3;
const SUBSET = 4;
const INTERSECT = 5;

const OP_STRINGS = [
	"COPY",
	"INSERT",
	"EQUAL",
	"NO_INTERSECT",
	"SUBSET",
	"INTERSECT",
];

/**
 * returns numerically ordered ranges and their relation
 * first, second, relation, increment in i, increment in j
 * @param {object} range1 The first range
 * @param {object} range2 The second range
 * @returns {object} Ordered operations with their nature and increment values for i, j
 */
function order_ranges(range1, range2) {
	var i_increment = -1;
	var j_increment = -1;
	var rtype = -1;
	if (range1[1] == range2[1] && range1[2] == range2[2]) {
		//console.log(range1, range2);
		i_increment = 1;
		j_increment = 1;
		rtype = EQUAL;
		first = range1;
		second = range2;
		return { first, second, rtype, i_increment, j_increment };
	} else if (range1[1] <= range2[1] && range1[2] < range2[1]) {
		i_increment = 1;
		j_increment = 0;
		rtype = NO_INTERSECT;
		first = range1;
		second = range2;
		return { first, second, rtype, i_increment, j_increment };
	} else if (range2[1] <= range1[1] && range2[2] < range1[1]) {
		i_increment = 0;
		j_increment = 1;
		rtype = NO_INTERSECT;
		first = range2;
		second = range1;
		return { second, first, rtype, i_increment, j_increment };
	} else if (range1[1] <= range2[1] && range1[2] >= range2[2]) {
		i_increment = 0;
		j_increment = 1;
		rtype = SUBSET;
		first = range1;
		second = range2;
		return { first, second, rtype, i_increment, j_increment };
	} else if (range2[1] <= range1[1] && range2[2] >= range1[2]) {
		i_increment = 1;
		j_increment = 0;
		rtype = SUBSET;
		first = range2;
		second = range1;
		return { second, first, rtype, i_increment, j_increment };
	} else if (range2[1] <= range1[1]) {
		i_increment = 0;
		j_increment = 1;
		rtype = INTERSECT;
		first = range2;
		second = range1;
		return { second, first, rtype, i_increment, j_increment };
	} else {
		i_increment = 1;
		j_increment = 0;
		rtype = INTERSECT;
		first = range1;
		second = range2;
		return { first, second, rtype, i_increment, j_increment };
	}
}

/**
 * Merges 2 given operations
 * @param {object} operations1 The first operation
 * @param {object} operations2 The second operation
 * @returns {object} The merged operation equivalent of the 2 operations given
 */
function merge_transformations2(operations1, operations2) {
	console.log("operations1 = ", operations1);
	console.log("operations2 = ", operations2);
	var i = 0;
	var j = 0;
	var transformed = [];
	while (i < operations1.length && j < operations2.length) {
		t1 = operations1[i];
		t2 = operations2[j];
		if (t1[0] == COPY && t2[0] == COPY) {
			let { first, second, rtype, i_increment, j_increment } =
				order_ranges(t1, t2);
			if (rtype == EQUAL) {
				transformed.push(first);
			} else if (rtype == NO_INTERSECT) {
				//transformed.push(second)
				// Both operations are to be skipped as each range is to be deleted in the other operation
				//pass
			} else if (rtype == SUBSET) {
				transformed.push(second);
				first[1] = second[2] + 1;
			} else if (rtype == INTERSECT) {
				transformed.push([COPY, second[1], first[2]]);
				second[1] = first[2] + 1;
			}
			i += i_increment;
			j += j_increment;
		} else if (t1[0] == INSERT && t2[0] == INSERT) {
			// both insert
			// find out the starting position of both of them
			start1 = 0;
			if (i != 0) {
				start1 = operations1[i - 1][2];
			}
			start2 = 0;
			if (j != 0) {
				start2 = operations2[j - 1][2];
			}
			if (start1 == start2) {
				// both of them starts at the same position
				// we're giving preference to t1 for now
				transformed.push(t1);
				transformed.push(t2);
				i += 1;
				j += 1;
			}
			// whoever is being inserted first, insert them
			else if (start1 > start2) {
				console.log("[Error]: SHOULD NOT BE REACHABLE");
				// transformed.push(t2)
				// j += 1
				// operations2[j][2] = operations1[i - 1][2]
			}
		} else if (t1[0] == INSERT && t2[0] == COPY) {
			transformed.push(t1);
			i += 1;
		} else if (t2[0] == INSERT && t1[0] == COPY) {
			transformed.push(t2);
			j += 1;
		}
	}
	// Append remaining suboperations of unfinished operation
	while (i < operations1.length) {
		if (operations1[i][0] == INSERT) {
			transformed.push(operations1[i]);
		}
		i += 1;
	}
	while (j < operations2.length) {
		if (operations2[j][0] == INSERT) {
			transformed.push(operations2[j]);
		}
		j += 1;
	}
	console.log("Called transformed");
	return transformed;
}

/**
 * Function to perform OT
 */
function transformChanges() {
	for (var rq in pendingChanges) {
		var allOperations = pendingChanges[rq]; // {clientID: operation_list}
		// console.log("pending_changes = ", allOperations);
		var mergedOperations = null;
		for (var client in allOperations) {
			if (mergedOperations == null)
				mergedOperations = allOperations[client];
			else
				mergedOperations = merge_transformations2(
					mergedOperations,
					allOperations[client]
				);
		}
		if (mergedOperations == null) continue;
		console.log("[x] Sending : ", mergedOperations);
		serverChannel.sendToQueue(
			rq,
			Buffer.from(JSON.stringify(mergedOperations))
		);
		// apply to local copy of the document
		// anirban: I don't think this is correct. We should not be applying the operations to the local copy.
		// 			We should be applying them to the document.
		// subhranil: I agree.
		// 			I'm not sure if this is the correct place to do this. I think it should be done in the
		// 			onMessage callback. But I'm not sure where to do it.
		// anubhab: I agree.
		// 			I think it should be done in the onMessage callback.
		if (fileMap[rq] != null) {
			var localCopy = applyTransformation(
				mergedOperations,
				contentMap[fileMap[rq]]
			);
			contentMap[fileMap[rq]] = localCopy;
		}
		console.log(contentMap);
		pendingChanges[rq] = {};
	}
}

/**
 * Applies the operation list on the given text
 */
function applyTransformation(operations, text) {
	var finaltext = "";
	for (var i = 0; i < operations.length; i++) {
		// we sent multiple flushes, since each flush resets our
		// operation array, a new range starting with 0 denotes
		// it is part of a later flush.
		if (
			i > 0 &&
			operations[i][0] == 0 &&
			operations[i][1] == 0 &&
			operations[i][2] <= finaltext.length
		) {
			text = finaltext;
			finaltext = "";
		} //Insertion at beginning was wrongly handled by this block
		op = operations[i];
		if (op[0] == 1) {
			finaltext += op[1];
		} else {
			finaltext += text.slice(op[1], op[2]);
		}
	}
	return finaltext;
}

setInterval(transformChanges, 1000 * 1);
