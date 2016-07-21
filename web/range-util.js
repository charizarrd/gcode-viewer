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
