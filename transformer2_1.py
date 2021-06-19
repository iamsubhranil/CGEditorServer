text = "applebanana"

EQUAL = 2
NO_INTERSECT = 3
SUBSET = 4
INTERSECT = 5

# returns numerically ordered ranges and their relation
# first, second, relation, increment in i, increment in j


def order_ranges(first, second):
    if first == second:
        return first, second, EQUAL, 1, 1
    if first[1] <= second[1] and first[2] < second[1]:
        return first, second, NO_INTERSECT, 1, 0
    if second[1] <= first[1] and second[2] < first[1]:
        return second, first, NO_INTERSECT, 0, 1
    if first[1] <= second[1] and first[2] >= second[2]:
        return first, second, SUBSET, 0, 1
    if second[1] <= first[1] and second[2] >= first[2]:
        return second, first, SUBSET, 1, 0
    if second[1] <= first[1]:
        return second, first, INTERSECT, 0, 1
    return first, second, INTERSECT, 1, 0


COPY = 0
INSERT = 1

OP_STRINGS = ["COPY", "INSERT", "EQUAL", "NO_INTERSECT", "SUBSET", "INTERSECT"]

# insert, copy, insert
# insert, copy, insert


def merge_transformations2(operations1, operations2):
    i = 0
    j = 0
    transformed = []
    while i < len(operations1) and j < len(operations2):
        t1 = operations1[i]
        t2 = operations2[j]
        #print(i, j, t1, t2)
        if t1[0] == COPY and t2[0] == COPY:
            first, second, rtype, add_i, add_j = order_ranges(t1, t2)
            if rtype == EQUAL:
                transformed.append(first)
            elif rtype == NO_INTERSECT:
                # transformed.append(second)
                # Both operations are to be skipped as each range is to be deleted in the other operation
                pass
            elif rtype == SUBSET:
                #print(first, second, rtype, add_i, add_j)
                transformed.append(second)
                first[1] = second[2] + 1
            elif rtype == INTERSECT:
                transformed.append([COPY, second[1], first[2]])
                second[1] = first[2] + 1
            i += add_i
            j += add_j
        elif t1[0] == INSERT and t2[0] == INSERT:
            # both insert
            # find out the starting position of both of them
            start1 = 0
            if i != 0:
                start1 = operations1[i - 1][2]
            start2 = 0
            if j != 0:
                start2 = operations2[j - 1][2]
            if start1 == start2:
                # both of them starts at the same position
                # we're giving preference to t1 for now
                transformed.append(t1)
                transformed.append(t2)
                i += 1
                j += 1
            # whoever is being inserted first, insert them
            elif start1 > start2:
                print("[Error]: SHOULD NOT BE REACHABLE")
                # transformed.append(t2)
                # j += 1
                #operations2[j][2] = operations1[i - 1][2]
        elif t1[0] == INSERT and t2[0] == COPY:
            transformed.append(t1)
            i += 1
        elif t2[0] == INSERT and t1[0] == COPY:
            transformed.append(t2)
            j += 1

    while i < len(operations1):
        if operations1[i][0] == INSERT:
            transformed.append(operations1[i])
        i += 1
    while j < len(operations2):
        if operations2[j][0] == INSERT:
            transformed.append(operations2[j])
        j += 1
    return transformed


def apply_transformation(text, operations):
    finaltext = ""
    for operation in operations:
        if operation[0] == INSERT:
            finaltext += operation[1]
        else:
            finaltext += text[operation[1]:operation[2] + 1]
    return finaltext


def main():
    for i in range(10):
        cases = i
        if cases == 0:
            operations_a = [[1, 'pqr'],  [0, 9, 10]]
            operations_b = [[0, 0, 8], [1, 'y'], [0, 9, 10]]
        elif cases == 1:
            operations_a = [[0, 0, 8], [1, 'pqr'], [0, 9, 10]]
            operations_b = [[0, 0, 8], [1, 'y'], [0, 9, 10]]
        elif cases == 2:
            operations_a = [[0, 0, 8], [1, 'pqr'], [0, 9, 10]]
            operations_b = [[0, 0, 6], [1, 'y'], [0, 7, 10]]
        elif cases == 3:
            operations_a = [[0, 0, 8], [1, 'pqr'], [0, 9, 10]]
            operations_b = [[0, 0, 6], [1, 'y'], [0, 9, 10]]
        elif cases == 4:
            operations_a = [[0, 5, 10]]
            operations_b = [[0, 0, 3], [1, 'y'], [0, 4, 10]]
        elif cases == 5:
            operations_a = [[0, 0, 5], [1, 'pqr'], [0, 8, 10]]
            # not performing potential deletion
            operations_b = [[0, 0, 8], [1, 'y']]
        elif cases == 6:
            operations_a = [[0, 0, 5], [0, 7, 10], [1, 'xyz']]
            operations_b = [[0, 0, 4], [0, 6, 8], [1, 'pqr'], [0, 9, 10]]
        elif cases == 7:
            operations_b = [[1, 'xyz'], [0, 5, 7], [1, 'pqr'], [0, 8, 10]]
            operations_a = [[1, 'pqr'], [0, 7, 10]]
        elif cases == 8:
            operations_a = [[0, 0, 1], [1, 'ricot'], [0, 5, 10]]
            operations_b = [[0, 0, 4], [1, ' '], [0, 5, 10]]
        elif cases == 9:
            operations_a = [[0, 0, 1], [1, 'hola'], [0, 5, 10]]
            operations_b = [[0, 3, 4], [1, ' '], [0, 5, 10]]
        # All these situations are resolved            
        else:
            pass
        print("Case: ", i)
        print("a: ", operations_a)
        print("b: ", operations_b)
        t = merge_transformations2(operations_a, operations_b)
        print("merged: ", t)
        print(text, " -> ", apply_transformation(text, t))
        print()


if __name__ == "__main__":
    main()
