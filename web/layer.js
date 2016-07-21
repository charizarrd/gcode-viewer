function Layer() {
  this.pointIndexRanges = [];
  this.height = -1;
};

Layer.prototype.addRangeStart = function(index) {
  this.pointIndexRanges.push(index);
};
  
Layer.prototype.addRangeEnd = function(index) {
  this.pointIndexRanges.push(index);
};

Layer.prototype.getFirstRangeStart = function() {
  return this.pointIndexRanges[0];
};

Layer.prototype.getLastRangeEnd = function() {
  return this.pointIndexRanges[this.pointIndexRanges.length - 1];
};
