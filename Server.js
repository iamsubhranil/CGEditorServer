// Access the callback-based API
var amqp = require("amqplib/callback_api");
// THIS SHOULD BE A SECRET
const CLOUDAMQP_URL =
	"amqp://xbxuskpq:wKNXtDdOJvkF5kxAb98yCf9eMfYE3EW8@puffin.rmq2.cloudamqp.com/xbxuskpq";
const COMMAND_QUEUE_NAME = "__cge_internal_command_queue";

var receiverChannel = null;
var amqp = require("amqplib/callback_api");

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
});
