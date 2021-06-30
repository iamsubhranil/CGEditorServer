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

var send = false;

var pendingChanges = {};

var client = -1;

var receiving_queue = "";
var sending_queue = "";

// 2D array to hold the operations of all the clients in a session
var clientOperations = [];

/**
 * Processes the queues to check if any message is received, if received then
 * push it to corresponding list of pendingChanges
 * @param {string} q Sending Queue name
 * @param {string} rq Receiving Queue name
 * @returns {function} Function to execute after callback
 */
function processQueueWrapper(q, rq) {
	// add to transformer queue
	pendingChanges[rq] = {};
	return function (msg) {
		if (msg == null) {
			console.log("[x] Queue removed: " + q);
		} else {
			console.log(
				"[x] Received in '" + q + "': ",
				msg.content.toString()
			);
			send = true;
			// add to transformer queue
			var received_msg = JSON.parse(msg.content.toString());
			client = received_msg.clientID.toString();
			clientOperations[client] = [];
			//clientOperations[client] = clientOperations[client].concat(
			//	JSON.parse(msg.content.toString()).operation_list
			//);
			//clientOperations[client].push(
			//	JSON.parse(msg.content.toString()).operation_list
			//);
			//pendingChanges[rq][client] = []; // How to concat?
			if (pendingChanges[rq][client] == null) {
				pendingChanges[rq][client] = received_msg.operation_list;
			} else {
				pendingChanges[rq][client].push(
					received_msg.operation_list
				);
			}
			//console.log("clientOperations= ",clientOperations);
			//console.log(pendingChanges[rq]);
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
	receiving_queue = parts[1];
	sending_queue = parts[2];
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
//*************************************************
//--------------------Add transformation codePointAt-----------------------
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

//----------------------------------------------
/*var flag_count = 1;
var op_a, op_b;
var flag = 0;
//var transformed = []; //stores 3d array
//var final_transformed = []; //stores 2d array
var count = 2;
/**
 * Function to perform OT
 */
//function transformChanges() {

//part1
/*	for (var rq in pendingChanges) {
		if (pendingChanges[rq].length > 0)
		{
			transformed.push(pendingChanges[rq]);
			i=i+1;
		}
	}
	console.log("Transformed op = ",transformed);
	for(var i=0; i<transformed.length; i++)
	{
		final_transformed.push(transformed[i]);
	}
	for(var i=0; i<final_transformed.length; i++)
	{
		for(var j=0; j<final_transformed.length; j++)
		{
			console.log("final Transformed op = ",final_transformed[i][j]);
		}
	}*/

//part2
/*	for (var rq in pendingChanges) {
		if (pendingChanges[rq].length < 2) continue;
		if (flag_count == 1) {
			console.log(flag_count);
			op_a = pendingChanges[rq][0];
		} else if (flag_count == 2) {
			console.log(flag_count);
			op_b = pendingChanges[rq][1];
		}

		if (flag_count < 2) {
			console.log("In continue");
			flag_count += 1;
			continue;
		} else {
			if (flag == 0) {
				console.log("flag= ", flag);
				flag_count += 1;
				op_a = merge_transformations2(op_a, op_b);
				flag = 1;
			} /*else {
				console.log("flag= ", flag);
				op_a = merge_transformations2(
					op_a,
					pendingChanges[rq][count++]
				);
			}
		}
	}
	console.log("Transformed op=", op_a);*/

//------------------------------------------------------------------------------
function transformChanges() {
	for (var rq in pendingChanges) {
		console.log("pending_changes = ", pendingChanges[rq]);
		// TRANSFORMATION
		// synchronize the list access
		//if (pendingChanges[rq].length > 0) {
		for (let c in pendingChanges[rq]) {
			var toSend = JSON.stringify(pendingChanges[rq][c]);
			console.log("[x] Sending : ", toSend);
			serverChannel.sendToQueue(rq, Buffer.from(toSend));
		}
		pendingChanges[rq] = [];
		//}
	}
}

setInterval(transformChanges, 1000 * 1);
