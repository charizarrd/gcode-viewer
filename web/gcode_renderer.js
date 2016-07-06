function Line() {

}

function GCodeRenderer() {

  var self = this;

  // tracks each command/movement
  // this.gcodes = [];
  this.index = 0;

  this.gcodes = {}; // gcode command mapping

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
  // this.visualizeGeo = new THREE.BufferGeometry();
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

GCodeRenderer.prototype.render = function(gcodes) {
  var self = this;

  var vertices = [];
  var colors = [];
  var num = 0;
  console.log(gcodes.length);

  // while (gcodes.length > 0) {
  //   code = gcodes.shift();
  gcodes.forEach(function(code, i) {
    self.renderGCode(code);

    // if (i > 995000)
    //   console.log(i);

    if(code.vertices.length > 0) {
      // self.gcodes[num] = {arrayIndex: vertices.length/3};
      self.gcodes[num] = vertices.length/3;
      num += 1;

      var verts = code.vertices;
      var color;
      if (code.extrude) {
        if (code.toolNum === 0)
          color = blue;
        else if (code.toolNum === 1)
          color = pink;
      }
      else
        color = green;

      vertices.push.apply(vertices, verts);

      for (var j = 0; j < verts.length/3; j++) {
        colors.push(color.r);
        colors.push(color.g);
        colors.push(color.b);
      }
    }

    // to free up space
    gcodes[i] = null;
  });
  // }

  console.log('hi');


  vertices = Float32Array.from(vertices);
  colors = Float32Array.from(colors);

  console.log('asdf');

  this.visualizeGeo.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
  this.visualizeGeo.addAttribute('color', new THREE.BufferAttribute(colors, 3));

  var feedLine = new THREE.Line(this.visualizeGeo, this.extrudeMat);
  self.baseObject.add(feedLine);

  // last layer
  self.layers[self.layerIndex] = self.gcodes.length-1;
  self.currentLayerHeight = self.lastLine.z;

  // self.visualizeGeo.
  // self.setIndex(100000);

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

  // self.baseObject.position = self.center.multiplyScalar(-scale);
  self.baseObject.scale.multiplyScalar(scale);

  console.log('hi');
  return self.baseObject;
};


GCodeRenderer.prototype.renderGCode = function(code) {
  this.geometryHandler(code);
};

GCodeRenderer.prototype.geometryHandler = function(code) {
  switch(code.cmd) {
    // moving and/or extruding
    case "G0": case "G1":
    case "G2": case "G3":
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

GCodeRenderer.prototype.getVertices = function(code) {
  var self = this;

  var newLine = code.params;
  var extrude = (code.params.e !== undefined);

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

  if ((code.cmd === "G0") || (code.cmd === "G1")) {
    code.vertices.push(self.lastLine.x);
    code.vertices.push(self.lastLine.y);
    code.vertices.push(self.lastLine.z);
    code.vertices.push(newLine.x);
    code.vertices.push(newLine.y);
    code.vertices.push(newLine.z);

    // var p1 = new THREE.Vector3(self.lastLine.x, self.lastLine.y, self.lastLine.z);
    // var p2 = new THREE.Vector3(newLine.x, newLine.y, newLine.z);
    // code.vertices.push(p1);
    // code.vertices.push(p2);
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

    points.forEach(function(point) {
      code.vertices.push(point.x);
      code.vertices.push(point.y);
      code.vertices.push(newLine.z);
      // var p2 = new THREE.Vector3(point.x, point.y, newLine.z);
      // code.vertices.push(p2);
    });
  }

  code.extrude = extrude;
  code.toolNum = self.toolNum;

  // check for new layer
  if ((extrude) && (newLine.z != self.currentLayerHeight)) { 
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
  if( index < 0 || index >= this.gcodes.length ) {
    throw new Error("invalid index");
  }

  var arrayIndex = this.gcodes[index];
  this.visualizeGeo.setDrawRange(0, arrayIndex);
  
  this.index = index;
  // this.visualizeGeo.attributes.color.needsUpdate = true;
  // this.updateLines();

  // return this.gcodes[index].layerNum;
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
