function RangeUtil() {};

RangeUtil.unionRanges = function(range1Start, range1End, range2Start, range2End) {
    var range = [];
    range[0] = Math.min(range1Start, range2Start);
    range[1] = Math.max(range1End, range2End);

    return range;
};

RangeUtil.intersectRanges = function(range1Start, range1End, range2Start, range2End) {
    var range = [0, 0];

    var start = Math.max(range1Start, range2Start);
    var end = Math.min(range1End, range2End);

    if (end < start) { return range; }

    range[0] = start;
    range[1] = end;

    return range;
};

RangeUtil.intersectRangeSets = function(set1, set2) {

    var set1Index = 0;
    var set2Index = 0;

    //As we iterate both sets, these track whether we have hit the start
    //of a range from one set or the other, or both, without hitting the end yet
    var inSet1Range = false;
    var inSet2Range = false;
    var inSet1AndSet2Ranges = false;

    var intersectedRangeSet = [];

    //Traverse all the points from both sets in increasing order,
    //e.g. with set1 = [3,3,5] and set2 = [2,4,8], the traversal order
    //is 2,3,3,4,5,8.
    while (set1Index < set1.length && set2Index < set2.length) {
        var set1Element = set1[set1Index];
        var set2Element = set2[set2Index];
        var element; //will hold either set1Element or set2Element
        
        if (set1Element <= set2Element) {
            element = set1Element;

            //If the index is even, it's a range start value; 
            //otherwise it's a range end
            inSet1Range = set1Index % 2 === 0;
            set1Index++;
        } else {
            element = set2Element;
            inSet2Range = set2Index % 2 === 0;
            set2Index++;
        }

        if (inSet1Range && inSet2Range && !inSet1AndSet2Ranges) {
            intersectedRangeSet.push(element);
            inSet1AndSet2Ranges = true;
        } else if ((!inSet1Range || !inSet2Range) && inSet1AndSet2Ranges) {
            intersectedRangeSet.push(element);
            inSet1AndSet2Ranges = false;
        }
    }

    return intersectedRangeSet;
};

RangeUtil.unionRangeSets = function(set1, set2) {
    var totalRanges = set1.concat(set2);

    // sort based on start value
    totalRanges = totalRanges.map(function(element, index, array) {
        if (index % 2 === 1)
            return null;
        else
            return {
              end: array[index + 1],
              start: element
            };
    })
    .filter(function(element) {
        return element != null;
    })
    .sort(function(a, b) {
        if (a.start === b.start)
            return a.end - b.end;
        else
            return a.start - b.start;
    })
    .reduce(function(array, element) {
        array.push(element.start, element.end);
        return array;
      }, []);

    var ranges = [];
    ranges.push(totalRanges[0]);
    var endValue = totalRanges[1];

    for (var i = 2; i < totalRanges.length; i+=2) {
        var startValue = totalRanges[i];
        if (startValue > endValue) {
            ranges.push(endValue);
            ranges.push(startValue);
        }

        endValue = totalRanges[i+1];
    }

    ranges.push(endValue);

    return ranges;
};





