// Access the callback-based API
var amqp = require("amqplib/callback_api");
// THIS SHOULD BE A SECRET
//const CLOUDAMQP_URL = 'amqps://xbxuskpq:RkcS4WW62YPZLE6hPULkqviRShxRAyaI@puffin.rmq2.cloudamqp.com/xbxuskpq';
const CLOUDAMQP_URL = process.env.AMQPURL;
if (CLOUDAMQP_URL == null || CLOUDAMQP_URL.length == 0) {
	console.log("[!] Error: Set AMQPURL environment variable first!");
}
const COMMAND_QUEUE_NAME = "__cge_internal_command_queue";

var receiverChannel = null;

function processQueueWrapper(q) {
	return function (msg) {
		if (msg == null) {
			console.log("[x] Queue removed: " + q);
		} else {
			console.log(
				"[x] Received in '" + q + "': ",
				msg.content.toString()
			);
		}
	};
}

function processCommand(msg) {
	console.log("[x] CommandQueue: " + msg.content.toString());
	var parts = msg.content.toString().split(" ");
	if (parts[0] == "add") {
		receiverChannel.assertQueue(parts[1], { durable: false });
		receiverChannel.consume(parts[1], processQueueWrapper(parts[1]), {
			noAck: true,
		});
	} else if (parts[0] == "remove") {
		receiverChannel.deleteQueue(parts[1]);
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

		receiverChannel = channel;
		channel.consume(COMMAND_QUEUE_NAME, processCommand, { noAck: true });
	});
	// Broadcast Queue
	connection.createChannel(function(error1, channel) {
		if (error1) {
		  throw error1;
		}
		var exchange = 'server_sendingQueue';
		var msg = process.argv.slice(2).join(' ') || 'Hello World!';

		channel.assertExchange(exchange, 'fanout', {
			durable: false
		});
		channel.publish(exchange, '', Buffer.from(msg));
		console.log(" [x] Sent %s", msg);
		send = false;
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
