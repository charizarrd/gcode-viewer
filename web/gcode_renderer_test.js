// testing dynamically generating tube geometries

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

  this.baseObject = new THREE.Object3D();

  this.extrudeMat = new THREE.MeshStandardMaterial({
    vertexColors: THREE.VertexColors,
    metalness: 0.5,
    roughness: 0.5
  });

  // this.extrudeMat = new THREE.LineBasicMaterial({
  //       opacity: 0.8,
  //       transparent: true,
  //       linewidth: 2,
  //       vertexColors: THREE.VertexColors });

  this.motionVertices = [];
  this.mIndex = 0;
  this.extrudeVertices = [];
  this.eIndex = 0;

  this.visualizeGeo = new THREE.BufferGeometry();
  this.vertices;
  this.colors;

  this.faces = [];
  this.numFaces = 0;

  // should always be absolute coordinates stored here
  this.lastLine = {x:0, y:0, z:0, e:0, f:0};
  this.relative = false;
  this.toolNum = 0;
  this.solenoidOn = false;

  // this.renderer = renderer;
  // this.bounds = {
  //   min: { x: 100000, y: 100000, z: 100000 },
  //   max: { x:-100000, y:-100000, z:-100000 }
  // };

  this.bounds = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(120.98686981201172, 136.32655334472656, 18.20800018310547));


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

  console.log(l);
  // l = 50000;
  // parsing
  for ( ; i < l; i++) {
    if ((i % 100000) == 0)
      console.log(i);

    if (i > 500000)
      break;

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
  // this.gcodes[this.numGCodes].vertexNum = this.faces.length;
  this.gcodes[this.numGCodes].layerNum = this.layerIndex;

  self.layers[self.layerIndex] = self.numGCodes;
  self.currentLayerHeight = self.lastLine.z;


  // size must be multiple of 3
  // this.visualizeGeo.addAttribute('position', new THREE.BufferAttribute(Float32Array.from(self.extrudeVertices), 3));
  // this.vertices = this.visualizeGeo.attributes.position.array;

  this.visualizeGeo.addAttribute('color', new THREE.BufferAttribute(new Float32Array(60*l).fill(1), 3));
  this.colors = this.visualizeGeo.attributes.color.array;
  this.visualizeGeo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(60*l).fill(0), 3));
  this.vertices = this.visualizeGeo.attributes.position.array;


  // using Float32Array.from() always crashes the browser so copy over
  // array piece by piece...
  // var l = self.faces.length;
  // var faces = new Uint32Array(l);

  // var index = 0;
  // var range = 1000000;
  // while (self.faces.length > 0) {
  //   faces.set(self.faces.splice(0, range), index);
  //   index += range;
  // }

  // this.visualizeGeo.setIndex(new THREE.BufferAttribute(faces, 1));
  // this.visualizeGeo.computeVertexNormals();

  var feedLine = new THREE.Mesh(this.visualizeGeo, this.extrudeMat);
  // var feedLine = new THREE.Line(this.visualizeGeo, new THREE.MultiMaterial([this.extrudeMat]));
  // var feedLine = new THREE.Line(this.visualizeGeo, this.extrudeMat);
  self.baseObject.add(feedLine);

  // this.visualizeGeo.addGroup(0, l, 0);

  // Center
  // self.visualizeGeo.computeBoundingBox();
  // self.bounds = self.visualizeGeo.boundingBox;
  self.visualizeGeo.boundingBox = self.bounds;
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
      this.gcodes[this.numGCodes].mIndex = this.motionVertices.length;
      this.gcodes[this.numGCodes].eIndex = this.extrudeVertices.length;
      this.gcodes[this.numGCodes].layerNum = this.layerIndex;
      this.gcodes[this.numGCodes].toolNum = this.toolNum;
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

GCodeRenderer.prototype.getVertices = function(code) {
  var self = this;

  var newLine = Object.assign({}, code.params);
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

  var verts;
  if (path.getLength() !== 0) {
    if (extrude)
      verts = self.extrudeVertices;
    else
      verts = self.motionVertices;

    var tangent = new THREE.Vector3();
    var axis = new THREE.Vector3();
    path.getPoints(total).forEach(function(p) {
      verts.push(p.x);
      verts.push(p.y);
      // if (p instanceof THREE.Vector2)
      //   verts.push(newLine.z);
      // else 
        verts.push(p.z);
    });

    // check for new layer
    if (newLine.z != self.currentLayerHeight) { 
      self.layers[self.layerIndex] = self.numGCodes-1;
      self.currentLayerHeight = newLine.z;
      self.layerIndex += 1;
    }
  }

  self.lastLine = newLine;
};

GCodeRenderer.prototype.getTubeGeometry = function(startIndex, endIndex, toolNum) {
  var self = this;
  var color;

  if (this.toolNum === 0)
    color = blue;
  else if (this.toolNum === 1)
    color = pink;

  // TODO: FIX LATER
  var tubeRadius = 0.2;
  // var tubeRadius;  
  // if (self.toolNum === 0) {
  //   // tubeRadius = 0.35;
  //   var magicMultiplier = 8;
  //   tubeRadius = newLine.e / path.getLength() * magicMultiplier;
  // } else {
  //   tubeRadius = 0.25;
  // }

  var tangent = new THREE.Vector3();
  var axis = new THREE.Vector3();
  var verts = self.extrudeVertices;

  // index into buffergeometry float arrays
  var vIndex = 0;
  // index into buffergeometry vector3
  var numVertices = 0;

  for (var k = startIndex+1; k < endIndex+1; k++) {
    // index into extrudeVertices
    var eIndex = self.gcodes[k-1].eIndex;
    var lastPosition = undefined;

    while (eIndex < self.gcodes[k].eIndex) {
      var currentPosition = new THREE.Vector3(verts[eIndex], verts[eIndex+1], verts[eIndex+2]);

      // self.vertices.push(currentPosition.x);
      // self.vertices.push(currentPosition.y);
      // self.vertices.push(currentPosition.z);
      // self.colors.push(color.r);
      // self.colors.push(color.g);
      // self.colors.push(color.b);
      self.shape.position.copy(currentPosition);

      if (lastPosition === undefined) {
        var temp = new THREE.Vector3(verts[eIndex+3], verts[eIndex+4], verts[eIndex+5]);
        tangent = temp.sub(currentPosition).normalize();
      } else {
        tangent = currentPosition.clone().sub(lastPosition).normalize();
      }

      axis.crossVectors(self.up, tangent).normalize();

      var radians = Math.acos(self.up.dot(tangent));

      self.shape.quaternion.setFromAxisAngle(axis, radians);

      self.shape.updateMatrix();

      var shapeVerts = [];
      self.shape.geometry.vertices.forEach(function(v) {
        shapeVerts.push(v.clone().multiplyScalar(tubeRadius).applyMatrix4(self.shape.matrix));
      });
      var l = shapeVerts.length;

      for (var i = 0; i < l; i++) {
        var v = shapeVerts[i];
        self.vertices[vIndex] = v.x;
        self.vertices[vIndex+1] = v.y;
        self.vertices[vIndex+2] = v.z;
        self.colors[vIndex] = color.r;
        self.colors[vIndex+1] = color.g;
        self.colors[vIndex+2] = color.b;

        vIndex += 3;

        // for triangles, verts should be in CCW order
        if (lastPosition !== undefined) {
          var j = (i+1) % l;

          self.faces.push(numVertices + j);
          self.faces.push(numVertices + i);
          self.faces.push(numVertices - l + i);

          self.faces.push(numVertices + j);
          self.faces.push(numVertices - l + i);
          self.faces.push(numVertices - l + j)
        }

      }

      lastPosition = currentPosition;
      eIndex += 3;
      numVertices += l;
    }
  }

  if (vIndex > self.vertices.length)
    console.log(vIndex);
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
  index = Math.floor(index);
  if( index < 0 || index > this.numGCodes ) {
    throw new Error("invalid index");
  }

  this.vertices.fill(0);
  this.colors.fill(0.5);
  this.faces = [];
  // this.vertices = [];
  // this.colors = [];
  this.visualizeGeo.clearGroups();

  var mIndex= 0;
  var eIndex = 0;
  var layerNum = 0;
  if ((index > 0)) {//} && (index < 1000)) {
    mIndex = this.gcodes[index].mIndex;
    eIndex = this.gcodes[index].eIndex;
    layerNum = this.gcodes[index].layerNum;
    toolNum = this.gcodes[index].toolNum;

    this.getTubeGeometry(0, index, toolNum);

    // var verts = new Float32Array(this.visualizeGeo.attributes.position.array.length);
    // for (var i = 0; i < this.visualizeGeo.attributes.position.array.length; i+=3) {
    //   verts[i] = this.visualizeGeo.attributes.position.array[i] + 5;
    //   verts[i+1] = this.visualizeGeo.attributes.position.array[i+1] + 5;
    //   verts[i+2] = this.visualizeGeo.attributes.position.array[i+2];
    // }

    // this.visualizeGeo.removeAttribute('color');
    // this.visualizeGeo.removeAttribute('position');
    // this.visualizeGeo.removeAttribute('normal');
    // this.visualizeGeo.addAttribute('position', new THREE.BufferAttribute(Float32Array.from(this.vertices), 3));
    // this.visualizeGeo.addAttribute('color', new THREE.BufferAttribute(Float32Array.from(this.colors), 3));
    // this.visualizeGeo.addAttribute('color', new THREE.BufferAttribute(new Float32Array(this.vertices.length).fill(1), 3));


    // this.visualizeGeo.setIndex(new THREE.BufferAttribute(faces, 1));
    // this.visualizeGeo.computeVertexNormals();

    // this.visualizeGeo.clearGroups();
    // this.visualizeGeo.addGroup(0, this.vertices.length/3, 0);
    // this.getMotionGeometry(0, mIndex);

  }    
  var l = this.faces.length;
  var faces = new Uint32Array(l);

  var index = 0;
  var range = 1000000;
  while (this.faces.length > 0) {
    faces.set(this.faces.splice(0, range), index);
    index += range;
  }

  this.visualizeGeo.setIndex(new THREE.BufferAttribute(faces, 1));
  this.visualizeGeo.computeVertexNormals();

  this.visualizeGeo.attributes.position.needsUpdate = true;
  this.visualizeGeo.attributes.color.needsUpdate = true;
  this.visualizeGeo.attributes.normal.needsUpdate = true;
    
  this.visualizeGeo.addGroup(0, l, 0);
};

GCodeRenderer.prototype.setLayer = function(layerIndex) {
  layerIndex = Math.floor(layerIndex);

  if (layerIndex < 0 || layerIndex > this.layerIndex) {
    throw new Error("invalid layer index");
  }

  var startIndex = 0, endIndex = 0;
  if (layerIndex > 0) {
    endIndex = this.gcodes[this.layers[layerIndex]].vertexNum;
    startIndex = this.gcodes[this.layers[layerIndex-1]].vertexNum;
  }

  // this.setIndex(index);

  // this.visualizeGeo.setDrawRange();
  this.visualizeGeo.clearGroups();
  this.visualizeGeo.addGroup(startIndex, endIndex - startIndex, 0);
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

