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
var clientIDkeep = ['0'];
var receive_op = [];
var arr = [];
var temp = [];

/**
 * Processes the queues to check if any message is received, if received then
 * push it to corresponding list of pendingChanges
 * @param {string} q Sending Queue name
 * @param {string} rq Receiving Queue name
 * @returns {function} Function to execute after callback
 */
 
 function include(clientIDkeep, obj) {
  for (var i = 0; i < clientIDkeep.length; i++) {
    if (clientIDkeep[i] == obj) return true;
  }
  return false;
}
function processQueueWrapper(q, rq) {
	// add to transformer queue
	global_recceiving = rq;
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
			console.log("***********client_ID = ",client);
			console.log("*********received_msg = ",received_msg.operation_list);
			
		//	arr[client][i].push(received_msg.operation_list);
			
			
			if( (include(clientIDkeep, client)) == false ) // true
			{
				clientIDkeep.push(client);
			}
		
			arr[client] = received_msg.operation_list;
		//	arr[client] = received_msg.operation_list;
		//	console.log("********arr = ",arr);
			
		/*	for(var i=0;i<clientIDkeep.length;i++)
			{
				console.log("*******arr[i] = ", arr[i]);
			}*/
			
			if (pendingChanges[rq][client] == null) {
				pendingChanges[rq][client] = received_msg.operation_list;
			//	console.log("hi 1");
			} else {
			//	console.log("hi 2");
				pendingChanges[rq][client].push(
					received_msg.operation_list
				);
			}
			
			
		/*	temp.push(Object.values(pendingChanges[rq][client]));
			console.log("*********temp = ",temp);
			console.log("*********temp_length = ",temp.length);*/
			
		//	console.log("*****************receive_op = ",receive_op[0][1]);
			
		/*	for(var i=0;i<clientIDkeep.length;i++)
			{
				console.log("*****************pendingChanges[rq][i] = ",pendingChanges[rq][i]);
			}
			console.log("*****************pendingChanges = ",pendingChanges[rq]);
			console.log("*****************pendingChanges_length = ",pendingChanges[rq].length);*/
		
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
	console.log("operations1 = ",operations1);
	console.log("operations2 = ",operations2);
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

var transformed = []; //stores 3d array
var final_transformed = []; //stores 2d array
var op_a = [];
/**
 * Function to perform OT
 */
 
function transformChanges() {
	//try1
/*	console.log("**********In transform************");
	for(var i=0;i<clientIDkeep.length;i++)
	{
		console.log("*******arr[i] = ", arr[i]);
	}*/
	
	if(clientIDkeep.length>=2)
	{
		op_a = arr[0];
		for(var i=1; i<clientIDkeep.length;i++)
		{
			op_a = merge_transformations2(op_a, arr[i]);
		}
		console.log("********final Transformed op = ",op_a);
	}
	
	
//	console.log("******pendingChanges = ",pendingChanges);
	//try2
/*	if(clientIDkeep.length>=2)
	{
		for (var rq in pendingChanges)
		{
			for (var i=0;pendingChanges[rq].length;i++)
			{
				
				if(i==0)
				{
					console.log("hi 1");
					op_a = pendingChanges[rq][i];
					console.log("------------",op_a)
				}
				else{
					console.log("hi 2");
					console.log("------------",pendingChanges[rq][i]);
					op_a = merge_transformations2(op_a,pendingChanges[rq][i]);
				}
			}
		}
		console.log("********final Transformed op = ",op_a);
	}*/

	//try3
	
/*	for (var rq in pendingChanges)
	{
		for(var i=0; i<pendingChanges[rq].length; i++)
		{
			console.log("---------");
			console.log("pending_changes = ", pendingChanges[rq][i]);
			transformed.push(transformed[i]);
		}
	}
	console.log("********Transformed op = ",transformed);*/
/*	for(var i=0; i<final_transformed.length; i++)
	{
		for(var j=0; j<final_transformed.length; j++)
		{
			console.log("********final Transformed op = ",final_transformed[i][j]);
		}
	}*/
	
	
	
/*	for (var rq in pendingChanges) {
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
	}*/
}

setInterval(transformChanges, 1000 * 1);
