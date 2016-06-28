function GCodeViewModel(code) {
  this.code = code;
  this.cmd = code.words[0].letter+code.words[0].value;
  this.vertexIndex = 0; // corresponding vertex of extrudeGeo
  this.vertexLength = 0;
  this.layerNum = 0;
}

function GCodeRenderer() {

  var self = this;

  // tracks each command/movement
  this.viewModels = [];
  this.index = 0;

  // tracks layers
  this.layers = {}; // maps layer num to index of last vertice in extrudeGeo in that layer
  this.layerIndex = 0;
  this.currentLayerHeight = 0;

  this.baseObject = new THREE.Object3D();

  this.motionGeo = new THREE.Geometry();
  this.motionMat = new THREE.LineBasicMaterial({
        opacity: 0.8,
        transparent: true,
        linewidth: 1,
        vertexColors: THREE.VertexColors });

  this.extrudeGeo = new THREE.Geometry();
  this.extrudeMat = new THREE.LineBasicMaterial({
        opacity: 0.8,
        transparent: true,
        linewidth: 2,
        vertexColors: THREE.VertexColors });

  // all commands
  this.allGeo = new THREE.Geometry();

  // commands to visualize
  this.visualizeGeo = new THREE.Geometry();

  // should always be absolute coordinates stored here
  this.lastLine = {x:0, y:0, z:0, e:0, f:0};
  this.relative = false;

  // this.renderer = renderer;
  this.bounds = {
    min: { x: 100000, y: 100000, z: 100000 },
    max: { x:-100000, y:-100000, z:-100000 }
  };

  this.materialHandlers = {

    G0: function(viewModel) {
      return this.motionMat;
    },
    G1: function(viewModel) {
      return this.extrudeMat;
    },
    G2: function(viewModel) {
      return this.extrudeMat;
    }

  } // end materialHandlers

};

GCodeRenderer.motionColors = [ new THREE.Color(0x22bb22) ]
GCodeRenderer.extrudeColors = [
                             // new THREE.Color(0xffcc66), // canteloupe
                             new THREE.Color(0x66ccff), // sky
                             new THREE.Color(0x22bb22), // honeydew
                             // new THREE.Color(0xff70cf), // carnation
                             new THREE.Color(0xcc66ff), // lavender
                             new THREE.Color(0xfffe66), // banana
                             new THREE.Color(0xff6666) // salmon
                             // new THREE.Color(0x66ffcc), // spindrift
                             // new THREE.Color(0x66ff66), // flora
                           ]

GCodeRenderer.prototype.absolute = function(v1, v2) {
    return this.relative ? v1 + v2 : v2;
  }

GCodeRenderer.prototype.render = function(model) {
  var self = this;
  self.model = model;

  self.model.codes.forEach(function(code) {
    self.renderGCode(code);
  });

  self.updateLines();

  // Center
  self.extrudeGeo.computeBoundingBox();
  self.bounds = self.extrudeGeo.boundingBox;

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


/* returns THREE.Object3D */
GCodeRenderer.prototype.renderGCode = function(code) {
  var viewModel = new GCodeViewModel(code);

  this.geometryHandler(viewModel);

  var materialHandler = this.materialHandlers[viewModel.cmd] || this.materialHandlers['default'];
  if (materialHandler) {
    materialHandler(viewModel);
  }

  if(viewModel.vertexLength > 0) {
    this.viewModels.push(viewModel);
  }
};

GCodeRenderer.prototype.geometryHandler = function(viewModel) {
  switch(viewModel.cmd) {
    // moving and/or extruding
    case "G0": case "G1":
      this.lineHandler(viewModel);
      break;

    // arc
    case "G2": case "G3":
      this.arcHandler(viewModel);
      break;

    // use absolute coords
    case "G90":
      this.relative = false;
      break;

    // use relative coords
    case "G91":
      this.relative = true;
      break;

    default:
      // console.log(viewModel.cmd);
      break;
  }
};

GCodeRenderer.prototype.lineHandler = function(viewModel) {
  var self = this;

  var newLine = {};
  var extrude = false;

  viewModel.code.words.forEach(function(word) {
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
  var geometry, color;

  viewModel.vertexIndex = self.allGeo.vertices.length;

  if (extrude) {
    geometry = self.extrudeGeo;
    color = GCodeRenderer.extrudeColors[0];
  } else {
    geometry = self.motionGeo;
    color = GCodeRenderer.motionColors[0];
  }

  geometry.vertices.push(p1);
  geometry.vertices.push(p2);
  geometry.colors.push(color);
  geometry.colors.push(color);

  self.allGeo.vertices.push(p1);
  self.allGeo.vertices.push(p2);
  self.allGeo.colors.push(color);
  self.allGeo.colors.push(color);

  viewModel.vertexLength = self.allGeo.vertices.length - viewModel.vertexIndex;

  // check for new layer
  if ((extrude) && (newLine.z > self.currentLayerHeight)) {
    // console.log(newLine.z, self.currentLayerHeight);
    self.layers[self.layerIndex] = viewModel.vertexIndex;
    self.currentLayerHeight = newLine.z;
    self.layerIndex += 1;
  }
  viewModel.layerNum = self.layerIndex;

  self.lastLine = newLine;
};

GCodeRenderer.prototype.getAngle = function(x, y, centerX, centerY, radius) {
  var value = Math.max(0, Math.min(1, Number((x - centerX).toFixed(5)) / Math.abs(radius)));
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

GCodeRenderer.prototype.arcHandler = function(viewModel) {
  var self = this;

  var newLine = {};
  var extrude = false;

  var currentX = self.lastLine['x'];
  var currentY = self.lastLine['y']

  viewModel.code.words.forEach(function(word) {
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
  if (viewModel.cmd === "G2")
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
  var geometry, color;

  if (extrude) {
    geometry = self.extrudeGeo;
    color = GCodeRenderer.extrudeColors[0];
  } else {
    geometry = self.motionGeo;
    color = GCodeRenderer.motionColors[0];
  }

  viewModel.vertexIndex = self.allGeo.vertices.length;

  var p1 = new THREE.Vector3(self.lastLine.x, self.lastLine.y, self.lastLine.z);
  points.forEach(function(point) {
    var p2 = new THREE.Vector3(point.x, point.y, newLine.z);
    // console.log(p2);
    geometry.vertices.push(p1);
    geometry.vertices.push(p2);
    geometry.colors.push(color);
    geometry.colors.push(color);

    self.allGeo.vertices.push(p1);
    self.allGeo.vertices.push(p2);
    self.allGeo.colors.push(color);
    self.allGeo.colors.push(color);

    p1 = p2;
  });

  viewModel.vertexLength = self.allGeo.vertices.length - viewModel.vertexIndex;

  self.lastLine = newLine;
};


GCodeRenderer.prototype.updateLines = function() {
  var self = this;

  while( self.baseObject.children.length > 0 ) {
    self.baseObject.remove(self.baseObject.children[0]);
  }

  // var motionLine = new THREE.Line(this.motionGeo, this.motionMat, THREE.LinePieces);
  var feedLine = new THREE.Line(this.visualizeGeo, this.extrudeMat, THREE.LinePieces);
  // self.baseObject.add(motionLine);
  self.baseObject.add(feedLine);

};

GCodeRenderer.prototype.setIndex = function(index) {
  index = Math.floor(index);
  if( this.index == index ) { return; }
  if( index < 0 || index >= this.viewModels.length ) {
    throw new Error("invalid index");
  }

  var vm = this.viewModels[index];

  var geometry = new THREE.Geometry();

  var vertices = this.allGeo.vertices.slice(0, vm.vertexIndex + vm.vertexLength);
  vertices.forEach(function(v) {
    geometry.vertices.push(v);
  });
  // Array.prototype.push.apply( this.visualizeGeo.vertices, vertices );

  var colors = this.allGeo.colors.slice(0, vm.vertexIndex + vm.vertexLength);
  colors.forEach(function(c) {
    geometry.colors.push(c);
  });
  // Array.prototype.push.apply( this.visualizeGeo.colors, colors );

  this.visualizeGeo = geometry;
  this.index = index;
  this.updateLines();

  return vm.layerNum;
};

GCodeRenderer.prototype.setLayer = function(index) {
  index = Math.floor(index);
  if( this.index == index ) { return; }
  if( index < 0 || index > this.layerIndex ) {
    throw new Error("invalid index");
  }

  var vertexIndex = this.layers[index];
  var geometry = new THREE.Geometry();

  var vertices = this.allGeo.vertices.slice(0, vertexIndex);
  vertices.forEach(function(v) {
    geometry.vertices.push(v);
  });

  var colors = this.allGeo.colors.slice(0, vertexIndex);
  colors.forEach(function(c) {
    geometry.colors.push(c);
  });

  this.visualizeGeo = geometry;
  this.index = index;
  this.updateLines();

  return vertexIndex;
};
