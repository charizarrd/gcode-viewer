function GCodeRenderer() {

  var self = this;

  // tracks each command/movement
  this.gcodes = [];
  this.index = 0;

  // tracks layers
  this.layers = {}; // maps layer num to index of last gcode in that layer
  this.layerIndex = 0;
  this.currentLayerHeight = 0;

  this.baseObject = new THREE.Object3D();

  this.extrudeMat = new THREE.LineBasicMaterial({
        opacity: 0.8,
        transparent: true,
        linewidth: 2,
        vertexColors: THREE.VertexColors });

  // commands to visualize
  this.visualizeGeo = new THREE.Geometry();

  // should always be absolute coordinates stored here
  this.lastLine = {x:0, y:0, z:0, e:0, f:0};
  this.relative = false;
  this.toolNum = 0;
  this.solenoidOn = false;

  // this.renderer = renderer;
  this.bounds = {
    min: { x: 100000, y: 100000, z: 100000 },
    max: { x:-100000, y:-100000, z:-100000 }
  };

};

var green = new THREE.Color(0x22bb22);
var blue = new THREE.Color(0x66ccff);

GCodeRenderer.prototype.absolute = function(v1, v2) {
    return this.relative ? v1 + v2 : v2;
  }

GCodeRenderer.prototype.updateBounds = function(vert) {
  var self = this;
  self.bounds.min.x = Math.min(vert.x, self.bounds.min.x);
  self.bounds.min.y = Math.min(vert.y, self.bounds.min.y);
  self.bounds.min.z = Math.min(vert.z, self.bounds.min.z);
  self.bounds.max.x = Math.max(vert.x, self.bounds.max.x);
  self.bounds.max.y = Math.max(vert.y, self.bounds.max.y);
  self.bounds.max.z = Math.max(vert.z, self.bounds.max.z);
}

GCodeRenderer.prototype.render = function(model) {
  var self = this;
  self.model = model;

  self.model.codes.forEach(function(code, i) {
    self.renderGCode(code);
  });

  // last layer
  self.layers[self.layerIndex] = self.gcodes.length-1;
  self.currentLayerHeight = self.lastLine.z;

  self.setIndex(10);
  self.updateLines();

  // Center
  self.center = new THREE.Vector3(
      self.bounds.min.x + ((self.bounds.max.x - self.bounds.min.x) / 2),
      self.bounds.min.y + ((self.bounds.max.y - self.bounds.min.y) / 2),
      self.bounds.min.z + ((self.bounds.max.z - self.bounds.min.z) / 2));

  var zScale = window.innerHeight / (self.bounds.max.z - self.bounds.min.z),
      yScale = window.innerWidth / (self.bounds.max.y - self.bounds.min.y),
      xScale = window.innerWidth / (self.bounds.max.x - self.bounds.min.x),

      scale = Math.min(zScale, Math.min(xScale, yScale));

  self.baseObject.position = self.center.multiplyScalar(-scale);
  self.baseObject.scale.multiplyScalar(scale);

  return self.baseObject;
};


GCodeRenderer.prototype.renderGCode = function(code) {
  this.geometryHandler(code);

  if(code.vertices.length > 0) {
    this.gcodes.push(code);
  }
};

GCodeRenderer.prototype.geometryHandler = function(code) {
  switch(code.cmd) {
    // moving and/or extruding
    case "G0": case "G1":
      this.lineHandler(code);
      break;

    // arc
    case "G2": case "G3":
      this.arcHandler(code);
      break;

    // use absolute coords
    case "G90":
      this.relative = false;
      break;

    // use relative coords
    case "G91":
      this.relative = true;
      break;

    // switch tool
    case "T0":
      self.toolNum = 0;
      break;

    case "T1":
      self.toolNum = 1;
      break;

    default:
      // console.log(code.cmd);
      break;
  }
};

GCodeRenderer.prototype.lineHandler = function(code) {
  var self = this;

  var newLine = {};
  var extrude = false;

  code.words.forEach(function(word) {
    var p = word.letter.toLowerCase();
    switch(word.letter) {
      case 'X': case 'Y': case 'Z':
        newLine[p] = self.absolute(self.lastLine[p], parseFloat(word.value));
        break;
      case 'E':
        newLine[p] = parseFloat(word.value);
        extrude = true;
        break;
      case 'F':
        newLine[p] = parseFloat(word.value);
        break;
    }
  });

  for (var word in self.lastLine) {
    if (newLine[word] === undefined) {
      newLine[word] = self.lastLine[word];
    }
  }

  var p1 = new THREE.Vector3(self.lastLine.x, self.lastLine.y, self.lastLine.z);
  var p2 = new THREE.Vector3(newLine.x, newLine.y, newLine.z);
  code.vertices.push(p1);
  code.vertices.push(p2);
  self.updateBounds(p2);

  code.extrude = extrude;

  // check for new layer
  if ((extrude) && (newLine.z != self.currentLayerHeight)) { // to accomodate for retracting/unretracting movement...
    self.layers[self.layerIndex] = self.gcodes.length-1;
    self.currentLayerHeight = newLine.z;
    self.layerIndex += 1;
  }
  code.layerNum = self.layerIndex;

  self.lastLine = newLine;
};

GCodeRenderer.prototype.getAngle = function(x, y, centerX, centerY, radius) {
  // clamp to be within -1 and 1
  var value = Math.max(-1, Math.min(1, (x - centerX) / Math.abs(radius)));
  var angle = Math.acos(value);

  // check which quadrant it's in
  if (angle > 0) {
    if ((y - centerY) < 0) {
      var diff = Math.PI - angle;
      angle = Math.PI + diff;
    }
  } else {
    if ((y - centerY) < 0) {
      angle = Math.PI / 2;
    } else if ((y - centerY) > 0) {
      angle = Math.PI * 3/2;
    }
  }

  return angle;
};

GCodeRenderer.prototype.arcHandler = function(code) {
  var self = this;

  var newLine = {};
  var extrude = false;

  var currentX = self.lastLine['x'];
  var currentY = self.lastLine['y']

  code.words.forEach(function(word) {
    var p = word.letter.toLowerCase();
    switch(word.letter) {
      case 'X': case 'Y': case 'Z':
        newLine[p] = self.absolute(self.lastLine[p], parseFloat(word.value));
        break;
      case 'E':
        newLine[p] = parseFloat(word.value);
        extrude = true;
        break;
      case 'F': case 'I': case 'J':
        newLine[p] = parseFloat(word.value);
        break;
    }
  });

  for (var word in self.lastLine) {
    if (newLine[word] === undefined) {
      newLine[word] = self.lastLine[word];
    }
  }

  var centerX = currentX + newLine.i;
  var centerY = currentY + newLine.j;
  var radius = Math.sqrt(Math.pow(newLine.i, 2) + Math.pow(newLine.j, 2));

  var startAngle = self.getAngle(currentX, currentY, centerX, centerY, radius);
  var endAngle = self.getAngle(newLine.x, newLine.y, centerX, centerY, radius);

  var clockwise = false;
  if (code.cmd === "G2")
    clockwise = true;

  var curve = new THREE.EllipseCurve(
    centerX, centerY,            // aX, aY
    radius, radius,         // xRadius, yRadius
    startAngle, endAngle,  // aStartAngle, aEndAngle
    // 0, startAngle,
    clockwise,            // aClockwise
    0                 // aRotation 
  );

  var points = curve.getPoints(50);
  code.extrude = extrude;

  var p1 = new THREE.Vector3(self.lastLine.x, self.lastLine.y, self.lastLine.z);
  points.forEach(function(point) {
    var p2 = new THREE.Vector3(point.x, point.y, newLine.z);
    code.vertices.push(p1);
    code.vertices.push(p2);
    self.updateBounds(p2);

    p1 = p2;
  });

  // check for new layer
  if ((extrude) && (newLine.z > self.currentLayerHeight)) {
    // console.log(newLine.z, self.currentLayerHeight);
    self.layers[self.layerIndex] = self.gcodes.length-1;
    self.currentLayerHeight = newLine.z;
    self.layerIndex += 1;
  }
  code.layerNum = self.layerIndex;

  self.lastLine = newLine;
};


GCodeRenderer.prototype.updateLines = function() {
  var self = this;

  while( self.baseObject.children.length > 0 ) {
    if (self.baseObject.children[0] instanceof THREE.Line) {
      self.baseObject.children[0].geometry.dispose();
      self.baseObject.children[0].material.dispose();
    }
    self.baseObject.remove(self.baseObject.children[0]);
  }

  var feedLine = new THREE.Line(this.visualizeGeo, this.extrudeMat);
  self.baseObject.add(feedLine);

};

GCodeRenderer.prototype.setIndex = function(index) {
  index = Math.floor(index);
  if( this.index == index ) { return; }
  if( index < 0 || index >= this.gcodes.length ) {
    throw new Error("invalid index");
  }

  var geometry = new THREE.Geometry();

  for (var i = 0; i < index; i++) {
    var verts = this.gcodes[i].vertices;
    var color;
    if (this.gcodes[i].extrude)
      color = blue;
    else
      color = green;

    verts.forEach(function(v) {
      geometry.vertices.push(v);
      geometry.colors.push(color);
    });
  }

  this.visualizeGeo.dispose();
  this.visualizeGeo = geometry;
  geometry.dispose();
  this.index = index;
  this.updateLines();

  return this.gcodes[index].layerNum;
};

GCodeRenderer.prototype.setLayer = function(layerIndex) {
  layerIndex = Math.floor(layerIndex);

  var index = this.layers[layerIndex];
  if( this.index == index ) { return; }
  if( index < 0 || index >= this.gcodes.length ) {
    throw new Error("invalid index");
  }

  this.setIndex(index);

  return index;
};
