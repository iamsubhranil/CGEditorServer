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

/**
 * Processes the queues to check if any message is received, if received then
 * push it to corresponding list of pendingChanges
 * @param {string} q Sending Queue name
 * @param {string} rq Receiving Queue name
 * @returns {function} Function to execute after callback
 */
function processQueueWrapper(q, rq) {
	// add to transformer queue
	pendingChanges[rq] = [];
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
			pendingChanges[rq] = pendingChanges[rq].concat(
				JSON.parse(msg.content.toString()).operation_list
			);
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

/**
 * Function to perform OT
 */
function transformChanges() {
	for (var rq in pendingChanges) {
		// TRANSFORMATION
		// synchronize the list access
		if (pendingChanges[rq].length > 0) {
			var toSend = JSON.stringify({ changesToUpdate: pendingChanges[rq] });
			console.log("[x] Sending : ", pendingChanges[rq]);
			serverChannel.sendToQueue(
				rq,
				Buffer.from(toSend)
			);
		}
		pendingChanges[rq] = [];
	}
}

setInterval(transformChanges, 1000 * 10);
