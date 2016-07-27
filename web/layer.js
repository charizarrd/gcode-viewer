function Layer() {
	this.extrusionPointIndexRanges = [];
	this.travelPointIndexRanges = [];
	this.height = -1;
};

Layer.prototype.addRangeStart = function(index, extrude) {
	var range;

	if (extrude)
		range = this.extrusionPointIndexRanges;
	else
		range = this.travelPointIndexRanges;

	range.push(index);
};
	
Layer.prototype.addRangeEnd = function(index, extrude) {
	var range;

	if (extrude)
		range = this.extrusionPointIndexRanges;
	else
		range = this.travelPointIndexRanges;

	range.push(index);
};
