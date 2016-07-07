function GCodeRenderer() {
  this.parser = new GCodeParser();

  // tracks each command/movement
  // this.gcodes = [];
  this.index = 0;

  // gcode command mapping to vertex number in buffergeometry and to layer num
  this.gcodes = {};
  this.numGCodes = 0;

  // tracks layers based on print order
  this.layers = {}; // maps layer num to index of last gcode in that layer
  this.layerIndex = 0;
  this.currentLayerHeight = 0;

  // tracks layers based on layer height (NOTE: does not include )
  this.layerHeights = {} // maps layer height to array of layer nums
  this.layerHeightSorted = [];

  this.baseObject = new THREE.Object3D();

  this.extrudeMat = new THREE.LineBasicMaterial({
        opacity: 0.8,
        transparent: true,
        linewidth: 2,
        vertexColors: THREE.VertexColors });

  // commands to visualize
  this.vertices = [];
  this.colors = [];
  this.visualizeGeo = new THREE.BufferGeometry();

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
var pink = new THREE.Color(0xff6666);

GCodeRenderer.prototype.absolute = function(v1, v2) {
    return this.relative ? v1 + v2 : v2;
  }

GCodeRenderer.prototype.render = function(gcode) {
  var self = this;

  var lines = gcode.split('\n'),
      i = 0,
      l = lines.length,
      words,
      code;

  // parsing
  for ( ; i < l; i++) {
    words = self.parser.parseLine(lines[i]);    
    code = {};

    if (words.length > 0) {
      code.params = {};

      words.forEach(function(word, i) {
        if (i === 0) {
          code.cmd = word.raw;
        } else {
          code.params[word.letter.toLowerCase()] = parseFloat(word.value);
        }
      });
    
      self.gcodeHandler(code); 
      
    }
  }

  // last layer
  self.layers[self.layerIndex] = self.numGCodes;
  self.currentLayerHeight = self.lastLine.z;

  if (self.currentLayerHeight in self.layerHeights) {
    self.layerHeights[self.currentLayerHeight].push(self.layerIndex);
  } else {
    self.layerHeights[self.currentLayerHeight] = [self.layerIndex];
  }
  self.layerHeightSorted = Object.keys(self.layerHeights).sort(function(a, b) {
    return Number(a) - Number(b);
  });

  // using Float32Array.from() always crashes the browser so copy over
  // array piece by piece...
  var vertices = new Float32Array(self.vertices.length);
  var colors = new Float32Array(self.colors.length);

  var index = 0;
  var range = 10000000;
  while (self.vertices.length > 0) {
    vertices.set(self.vertices.splice(0, range), index);
    index += range;
  }
  index = 0;
  while (self.colors.length > 0) {
    colors.set(self.colors.splice(0, range), index);
    index += range;
  }

  // this.vertices = vertices; // ~extra 200 mb ish

  this.visualizeGeo.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
  this.visualizeGeo.addAttribute('color', new THREE.BufferAttribute(colors, 3));

  var feedLine = new THREE.Line(this.visualizeGeo, new THREE.MultiMaterial([this.extrudeMat]));
  self.baseObject.add(feedLine);

  // Center
  self.visualizeGeo.computeBoundingBox();
  self.bounds = self.visualizeGeo.boundingBox;
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

GCodeRenderer.prototype.gcodeHandler = function(code) {
  switch(code.cmd) {
    // moving and/or extruding
    case "G0": case "G1":
    case "G2": case "G3":
      this.numGCodes += 1;
      this.gcodes[this.numGCodes] = {};
      this.gcodes[this.numGCodes].vertexNum = this.vertices.length/3;
      this.gcodes[this.numGCodes].layerNum = this.layerIndex;
      this.getVertices(code);
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
      this.toolNum = 0;
      break;

    case "T1":
      this.toolNum = 1;
      break;

    // turn solenoid on
    case "M42":
      if (code.params.p === 2) {
        if (code.params.s === 255)
          this.solenoidOn = true;
        else
          this.solenoidOn = false;
      }
      break;

    case "M380":
      this.solenoidOn = true;
      break;

    case "M381":
      this.solenoidOn = false;
      break;

    default:
      // console.log(code.cmd);
      break;
  }
};

GCodeRenderer.prototype.getColor = function(extrude) {
  if (extrude) {
    if (this.toolNum === 0)
      return blue;
    else if (this.toolNum === 1)
      return pink;
  }
  else
    return green;
};

GCodeRenderer.prototype.getVertices = function(code) {
  var self = this;

  var newLine = code.params;
  var extrude = (code.params.e !== undefined);
  var numVerts;

  for (var p in self.lastLine) {
    switch (p) {
      case 'x': case 'y': case 'z':
        if (newLine[p] === undefined)
          newLine[p] = self.lastLine[p];
        else
          newLine[p] = self.absolute(self.lastLine[p], newLine[p]);
        break;

      default:
        if (newLine[p] === undefined) {
          newLine[p] = self.lastLine[p];
        }
        break;
    }
  }

  if ((self.toolNum === 1) && (self.solenoidOn)) {
    extrude = true;
  }

  var color = self.getColor(extrude);

  if ((code.cmd === "G0") || (code.cmd === "G1")) {
    numVerts = 2;
    self.vertices.push(self.lastLine.x);
    self.vertices.push(self.lastLine.y);
    self.vertices.push(self.lastLine.z);
    self.vertices.push(newLine.x);
    self.vertices.push(newLine.y);
    self.vertices.push(newLine.z);

    for (var i = 0; i < numVerts; i++) {
      self.colors.push(color.r);
      self.colors.push(color.g);
      self.colors.push(color.b);
    }
  } else {
    var currentX = self.lastLine['x'];
    var currentY = self.lastLine['y'];
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
      clockwise,            // aClockwise
      0                 // aRotation 
    );

    var points = curve.getPoints(50);
    numVerts = 50;
    points.forEach(function(point) {
      self.vertices.push(point.x);
      self.vertices.push(point.y);
      self.vertices.push(newLine.z);
      self.colors.push(color.r);
      self.colors.push(color.g);
      self.colors.push(color.b);
    });
  }

  // check for new layer
  // if ((extrude) && (newLine.z != self.currentLayerHeight)) { 
  if ((extrude) && (newLine.z != self.currentLayerHeight)) { 
    self.layers[self.layerIndex] = self.numGCodes-1;

    if (self.currentLayerHeight in self.layerHeights) {
      self.layerHeights[self.currentLayerHeight].push(self.layerIndex);
    } else {
      self.layerHeights[self.currentLayerHeight] = [self.layerIndex];
    }

    self.currentLayerHeight = newLine.z;
    self.layerIndex += 1;
  }

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
  } else { // angle = 0
    if ((x - centerX) > 0) {
      angle = 0;
    } else if ((x - centerX) < 0) {
      angle = Math.PI;
    } else {
      if ((y - centerY) < 0) {
        angle = Math.PI * 3/2;
      } else if ((y - centerY) > 0) {
        angle = Math.PI/2;
      }
    }
  }

  return angle;
};

GCodeRenderer.prototype.setIndex = function(index) {
  var self = this;
  index = Math.floor(index);
  if( this.index == index ) { return; }
  if( index < 0 || index > this.numGCodes ) {
    throw new Error("invalid index");
  }

  var arrayIndex = 0;
  var layerNum = 0;
  if (index > 0) {
    arrayIndex = this.gcodes[index].vertexNum;
    layerNum = this.gcodes[index].layerNum;
  }

  // this.visualizeGeo.setDrawRange();
  this.visualizeGeo.clearGroups();
  this.visualizeGeo.addGroup(0, arrayIndex, 0);
  
  this.index = index;

  return layerNum;
};

GCodeRenderer.prototype.setLayer = function(layerIndex) {
  layerIndex = Math.floor(layerIndex);

  var index = this.layers[layerIndex];

  this.setIndex(index);

  return index;
};

GCodeRenderer.prototype.setLayerHeight = function(heightIndex) {
  var self = this;
  heightIndex = Math.floor(heightIndex);
  if( heightIndex < 0 || heightIndex > this.layerHeightSorted.length ) {
    throw new Error("invalid index");
  }

  this.visualizeGeo.clearGroups();

  if (heightIndex === 0) {
    self.visualizeGeo.addGroup(0, 0, 0);
  } else {
    heightIndex -= 1;
    var layers = this.layerHeights[this.layerHeightSorted[heightIndex]];

    layers.forEach(function(layerNum) {
      var startIndex = 0;
      if (layerNum > 0)
        startIndex = self.gcodes[self.layers[layerNum-1]].vertexNum;
      var endIndex = self.gcodes[self.layers[layerNum]].vertexNum;
      self.visualizeGeo.addGroup(startIndex, endIndex - startIndex, 0);
    });
  }
};

