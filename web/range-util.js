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

    var length = Math.max(set1.length, set2.length);
    for (var i = 0; i < length; i++) {
        var element = 
    }

    var set1Index = 0;
    var set2Index = 0;
    var inSet1 = false;
    var inSet2 = false;
    var inBothSets = false;

    var intersectedRangeSet = [];

    while (set1Index < set1.length && set2Index < set2.length) {
        var set1Element = set1[set1Index];
        var set2Element = set2[set2Index];
        var element;
        
        if (set1Element <= set2Element) {
            element = set1Element;
            inSet1 = set1Index % 2 === 0;
            set1Index++;
        } else {
            element = set2Element;
            inSet2 = set2Index % 2 === 0;
            set2Index++;
        }

        if (inSet1 && inSet2 && !inBothSets) {
            intersectedRangeSet.push(element);
            inBothSets = true;
        } else if ((!inSet1 || !inSet2) && inBothSets) {
            intersectedRangeSet.push(element);
            inBothSets = false;
        }
    }

    return intersectedRangeSet;
};
