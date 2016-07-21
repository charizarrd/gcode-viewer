function RangeUtil() {};

RangeUtil.unionRanges = function(range1Start, range1End, range2Start, range2End) {
    var range = [];
    range[0] = Math.min(range1Start, range2Start);
    range[1] = Math.max(range1End, range2End);

    return range;
};

RangeUtil.intersectRanges = function(range1Start, range1End, range2Start, range2End) {
    var range = [];

    var limit1 = 0;
    var limit2 = 0;

    if (range1Start >= range2Start && range1Start <= range2End) {
        limit1 = range1Start;
    } else if (range2Start >= range1Start && range2Start <= range1End) {
        limit1 = range2Start;
    }

    if (range1End <= range2End && range1End >= range2Start) {
        limit2 = range1End;
    } if (range2End <= range1End && range2End >= range1Start) {
        limit2 = range2End;
    }

    range[0] = limit1;
    range[1] = limit2;

    return range;
};
