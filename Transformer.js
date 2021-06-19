var text = "applebanana";

// Defining the possible operations or type of operations as constants
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
	return transformed;
}

/**
 * Applies a given operation on a given string
 * @param {string} text The initial text on which the operation is to be performed
 * @param {object} operations The operation which is to be peformed
 * @returns {string} The final string after applying the operation
 */
function apply_transformation(text, operations) {
	var finaltext = "";
	for (var i = 0; i < operations.length; i++) {
		operation = operations[i];
		if (operation[0] == INSERT) {
			finaltext += operation[1];
		} else {
			finaltext += text.slice(operation[1], operation[2] + 1);
		}
	}
	return finaltext;
}

/**
 * Tries different test cases to check performance of transformation
 */
function test_performance() {
	for (var i = 0; i < 10; i++) {
		cases = i;
		if (cases == 0) {
			operations_a = [
				[1, "pqr"],
				[0, 9, 10],
			];
			operations_b = [
				[0, 0, 8],
				[1, "y"],
				[0, 9, 10],
			];
		} else if (cases == 1) {
			operations_a = [
				[0, 0, 8],
				[1, "pqr"],
				[0, 9, 10],
			];
			operations_b = [
				[0, 0, 8],
				[1, "y"],
				[0, 9, 10],
			];
		} else if (cases == 2) {
			operations_a = [
				[0, 0, 8],
				[1, "pqr"],
				[0, 9, 10],
			];
			operations_b = [
				[0, 0, 6],
				[1, "y"],
				[0, 7, 10],
			];
		} else if (cases == 3) {
			operations_a = [
				[0, 0, 8],
				[1, "pqr"],
				[0, 9, 10],
			];
			operations_b = [
				[0, 0, 6],
				[1, "y"],
				[0, 9, 10],
			];
		} else if (cases == 4) {
			operations_a = [[0, 5, 10]];
			operations_b = [
				[0, 0, 3],
				[1, "y"],
				[0, 4, 10],
			];
		} else if (cases == 5) {
			operations_a = [
				[0, 0, 5],
				[1, "pqr"],
				[0, 8, 10],
			];
			operations_b = [
				[0, 0, 8],
				[1, "y"],
			];
		} else if (cases == 6) {
			operations_a = [
				[0, 0, 5],
				[0, 7, 10],
				[1, "xyz"],
			];
			operations_b = [
				[0, 0, 4],
				[0, 6, 8],
				[1, "pqr"],
				[0, 9, 10],
			];
		} else if (cases == 7) {
			operations_a = [
				[1, "xyz"],
				[0, 5, 7],
				[1, "pqr"],
				[0, 8, 10],
			];
			operations_b = [
				[1, "pqr"],
				[0, 7, 10],
			];
		} else if (cases == 8) {
			operations_a = [
				[0, 0, 1],
				[1, "ricot"],
				[0, 5, 10],
			];
			operations_b = [
				[0, 0, 4],
				[1, " "],
				[0, 5, 10],
			];
		} else if (cases == 9) {
			operations_a = [
				[0, 0, 1],
				[1, "hola"],
				[0, 5, 10],
			];
			operations_b = [
				[0, 3, 4],
				[1, " "],
				[0, 5, 10],
			];
		}
		// All these situations are resolved
		else {
			//pass
		}
		console.log("Case: ", i);
		console.log("a: ", operations_a);
		console.log("b: ", operations_b);
		t = merge_transformations2(operations_a, operations_b);
		console.log("merged: ", t);
		console.log(text, " -> ", apply_transformation(text, t));
		console.log();
	}
}

test_performance();
