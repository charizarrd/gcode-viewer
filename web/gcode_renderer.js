// with indexed buffergeometry

function GCodeRenderer() {
  this.parser = new GCodeParser();

  var shape = [];
  var numPoints = 6;
  for ( var i = 0; i < numPoints; i ++ ) {
    var a = (i % numPoints) / numPoints * 2*Math.PI;
    shape.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  var geometry = new THREE.Geometry();
  geometry.vertices = shape;
  this.shape = new THREE.Line(geometry, new THREE.LineBasicMaterial());

  this.up = new THREE.Vector3(0, 0, 1);

  // gcode command mapping to vertex number in buffergeometry and to layer num
  this.gcodes = {};
  this.numGCodes = 0;

  // tracks layers based on print order
  this.layers = {}; // maps layer num to index of last gcode in that layer
  this.layerIndex = 0;
  this.currentLayerHeight = 0;

  // tracks layers based on layer height (NOTE: does not include )
  // this.layerHeights = {} // maps layer height to array of layer nums
  // this.layerHeightSorted = [];

  this.baseObject = new THREE.Object3D();

  this.extrudeMat = new THREE.MeshStandardMaterial({
    vertexColors: THREE.VertexColors,
    metalness: 0.5,
    roughness: 0.5
  });

  // commands to visualize
  this.index = 0;

  // this geometry is only extrusions
  this.extrudeGeo = new THREE.BufferGeometry();
  this.extrudeVertices;
  this.extrudeColors;

  // index into buffergeometry vector3
  this.numVertices = 0;
  // index into buffergeometry float arrays
  this.vIndex = 0;

  this.faces = [];
  this.fIndex = 0;

  // this geometry is only for movement
  this.motionGeo = new THREE.BufferGeometry();
  this.motionVertices = [];
  this.mIndex = 0;

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

  // size must be multiple of 3
  this.extrudeGeo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(60*l), 3));
  this.extrudeVertices = this.extrudeGeo.attributes.position.array;

  this.extrudeGeo.addAttribute('color', new THREE.BufferAttribute(new Float32Array(60*l), 3));
  this.extrudeColors = this.extrudeGeo.attributes.color.array

  console.log(l);
  // parsing
  for ( ; i < l; i++) {
    if ((i % 100000) == 0)
      console.log(i, self.numVertices);

    // if (i > 500000)
    //   break;

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
  console.log('hi');

  // last layer
  this.gcodes[this.numGCodes] = {};
  this.gcodes[this.numGCodes].mIndex = this.mIndex;
  this.gcodes[this.numGCodes].facesIndex = this.fIndex;
  this.gcodes[this.numGCodes].layerNum = this.layerIndex;

  self.layers[self.layerIndex] = self.numGCodes;
  self.currentLayerHeight = self.lastLine.z;

  // creating extrusion object
  // using Float32Array.from() always crashes the browser so copy over
  // array piece by piece...
  var l = self.fIndex;
  var faces = new Uint32Array(l*3);

  var index = 0;
  var range = 1000000;
  while (self.faces.length > 0) {
    faces.set(self.faces.splice(0, range), index);
    index += range;
  }

  this.extrudeGeo.setIndex(new THREE.BufferAttribute(faces, 1));
  this.extrudeGeo.computeVertexNormals();

  var extrusions = new THREE.Mesh(this.extrudeGeo, new THREE.MultiMaterial([this.extrudeMat]));
  self.baseObject.add(extrusions);
  this.extrudeGeo.addGroup(0, l, 0);

  // creating motion object
  var verts = new Float32Array(self.mIndex*3);
  index = 0;
  while (self.motionVertices.length > 0) {
    verts.set(self.motionVertices.splice(0, range), index);
    index += range;
  }

  this.motionGeo.addAttribute('position', new THREE.BufferAttribute(verts, 3));
  this.motionVertices = this.motionGeo.attributes.position.array;

  var motion = new THREE.LineSegments(this.motionGeo, new THREE.LineBasicMaterial({color: green}));
  self.baseObject.add(motion);
  this.motionGeo.setDrawRange(0, this.mIndex);

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

GCodeRenderer.prototype.gcodeHandler = function(code) {
  switch(code.cmd) {
    // moving and/or extruding
    case "G0": case "G1":
    case "G2": case "G3":
      this.gcodes[this.numGCodes] = {};
      this.gcodes[this.numGCodes].mIndex = this.mIndex;
      this.gcodes[this.numGCodes].facesIndex = this.fIndex;
      this.gcodes[this.numGCodes].layerNum = this.layerIndex;
      this.getVertices(code);
      this.numGCodes += 1;
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

  var newLine = Object.assign({}, code.params);
  var extrude = (code.params.e !== undefined);
  var tubeRadius;


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
  var path;
  var total;

  if ((code.cmd === "G0") || (code.cmd === "G1")) {
    path = new THREE.LineCurve3(
      new THREE.Vector3(self.lastLine.x, self.lastLine.y, self.lastLine.z),
      new THREE.Vector3(newLine.x, newLine.y, newLine.z)
    );
    total = 1;
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

    var theta;
    if (clockwise) {
      if (startAngle < endAngle)
        theta = startAngle + (2*Math.PI - endAngle);
      else
        theta = startAngle - endAngle;
    } else {
      if (startAngle > endAngle)
        theta = endAngle + (2*Math.PI - startAngle);
      else
        theta = endAngle - startAngle;
    }
    var x = Math.max(1, Math.round(theta / (Math.PI/8)));

    total = 2*x;

    var verts = [];
    curve.getPoints(50).forEach(function(p) {
      verts.push(new THREE.Vector3(p.x, p.y, newLine.z));
    });

    path = new THREE.CatmullRomCurve3(verts);
  }

  if (path.getLength() !== 0) {
    if (extrude) {
      if (self.toolNum === 0) {
        // tubeRadius = 0.35;
        var magicMultiplier = 8;
        tubeRadius = newLine.e / path.getLength() * magicMultiplier;
      } else {
        tubeRadius = 0.25;
      }

      var counter = 0;
      var tangent = new THREE.Vector3();
      var axis = new THREE.Vector3();
      while (counter <= 1) {
          self.shape.position.copy( path.getPointAt(counter) );

          tangent = path.getTangentAt(counter).normalize();

          axis.crossVectors(self.up, tangent).normalize();

          var radians = Math.acos(self.up.dot(tangent));

          self.shape.quaternion.setFromAxisAngle(axis, radians);

          self.shape.updateMatrix();

          var verts = [];
          self.shape.geometry.vertices.forEach(function(v) {
            verts.push(v.clone().multiplyScalar(tubeRadius).applyMatrix4(self.shape.matrix));
          });
          var l = verts.length;
          // console.log(self.vIndex);

          for (var i = 0; i < l; i++) {
            var v = verts[i];
            self.extrudeVertices[self.vIndex] = v.x;
            self.extrudeVertices[self.vIndex+1] = v.y;
            self.extrudeVertices[self.vIndex+2] = v.z;
            self.extrudeColors[self.vIndex] = color.r;
            self.extrudeColors[self.vIndex+1] = color.g;
            self.extrudeColors[self.vIndex+2] = color.b;

            self.vIndex += 3;
    
            // for triangles, verts should be in CCW order
            // if (self.vIndex >= l) {
            if (counter > 0) {
              var j = (i+1) % l;

              self.faces.push(self.numVertices + j);
              self.faces.push(self.numVertices + i);
              self.faces.push(self.numVertices - l + i);

              self.faces.push(self.numVertices + j);
              self.faces.push(self.numVertices - l + i);
              self.faces.push(self.numVertices - l + j)

              self.fIndex += 6;
            }

          }

          self.numVertices += l;
          counter += 1/total;
      }

      // check for new layer
      if (newLine.z != self.currentLayerHeight) { 
        self.layers[self.layerIndex] = self.numGCodes-1;

        self.currentLayerHeight = newLine.z;
        self.layerIndex += 1;
      }
    } else {
      var verts = self.motionVertices;
      path.getPoints(total).forEach(function(p) {
        verts.push(p.x);
        verts.push(p.y);
        verts.push(p.z);
        self.mIndex += 1;
      });
    }
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

  this.extrudeGeo.clearGroups();
  this.motionGeo.setDrawRange(0,0);
  if (index > 0) {
    var facesIndex = this.gcodes[index].facesIndex;
    var motionIndex = this.gcodes[index].mIndex;

    this.extrudeGeo.addGroup(0, facesIndex, 0);
    this.motionGeo.setDrawRange(0, motionIndex);
  }
  
  this.index = index;
};

GCodeRenderer.prototype.setLayer = function(layerIndex) {
  layerIndex = Math.floor(layerIndex);

  if (layerIndex < 0 || layerIndex > this.layerIndex) {
    throw new Error("invalid layer index");
  }

  this.extrudeGeo.clearGroups();
  this.motionGeo.setDrawRange(0,0);

  var startIndex = 0, endIndex = 0;
  if (layerIndex > 0) {
    endIndex = this.gcodes[this.layers[layerIndex]].facesIndex;
    startIndex = this.gcodes[this.layers[layerIndex-1]].facesIndex;
    this.extrudeGeo.addGroup(startIndex, endIndex - startIndex, 0);

    endIndex = this.gcodes[this.layers[layerIndex]].mIndex;
    startIndex = this.gcodes[this.layers[layerIndex-1]].mIndex;
    this.motionGeo.setDrawRange(startIndex, endIndex - startIndex);   
  }

  // this.setIndex(index);

};


