function GCode() {
  this.params = {};
  this.cmd = "";

  this.vertices = [];
  this.arrayIndex = 0;
  this.layerNum = 0;
  this.extrude = false;
  this.toolNum = 0;

};

GCode.prototype.toString = function() {
  var self = this,
      output = "";

  output += this.cmd.toString() + " ";
  for (var p in self.params) {
    output += p.toString() + self.params[p].toString() + " ";
  }

  return output;
};

function GWord(letter, value, raw) {
  this.letter = letter;
  this.value = value;
  this.raw = raw;
};

GWord.prototype.toString = function() {
  return this.letter + ":" + this.value + " (" + this.raw + ")";
};
