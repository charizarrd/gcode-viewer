function RangeUtil() {};

RangeUtil.ORRanges = function(range1Start, range1End, range2Start, range2End) {
    var range = [];
    range[0] = Math.min(range1Start, range2Start);
    range[1] = Math.max(range1End, range2End);

    return range;
};
