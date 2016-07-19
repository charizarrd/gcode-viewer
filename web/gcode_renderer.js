// with indexed buffergeometry

function GCodeRenderer() {
  this.relative = false;
  this.toolNum = 0;
  this.solenoidOn = false;

  this.parser = new GCodeParser();
  this.visualToolPaths = []; //one for each tool

  // gcode command mapping to vertex number in buffergeometry and to layer num
  this.gcodes = {};
  this.numGCodes = 0;

  var shape = [];
  var radius = 0.05;
  var numPoints = 6;
  for ( var i = 0; i < numPoints; i ++ ) {
    var a = (i % numPoints) / numPoints * 2*Math.PI;
    shape.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
  }
  var geometry = new THREE.Geometry();
  geometry.vertices = shape;
  this.shape = new THREE.Line(geometry, new THREE.LineBasicMaterial());

  this.up = new THREE.Vector3(0, 0, 1);

  // tracks layers based on print order
  this.layers = {}; // maps layer num to index of last gcode in that layer

  // tracks layers based on layer height (NOTE: does not include )
  // this.layerHeights = {} // maps layer height to array of layer nums
  // this.layerHeightSorted = [];

  this.baseObject = new THREE.Object3D();

  this.extrudeMat = new THREE.MeshStandardMaterial({
    vertexColors: THREE.VertexColors,
    metalness: 0.6,
    roughness: 0.15
  });

  // commands to visualize
  this.index = 0;
  // this.vertices = [];
  this.numVertices = 0;
  this.faces = [];

  this.visualizeGeo = new THREE.BufferGeometry();
  this.vertices;
  this.vIndex = 0;
  this.colors;

  // this.renderer = renderer;
  this.bounds = {
    min: { x: 100000, y: 100000, z: 100000 },
    max: { x:-100000, y:-100000, z:-100000 }
  };

};

var green = new THREE.Color(0x22bb22);
var blue = new THREE.Color(0x66ccff);
var pink = new THREE.Color(0xff6666);

GCodeRenderer.prototype.render = function(gcode) {
  var self = this;

  var lines = gcode.split('\n'),
      i = 0,
      l = lines.length,
      words,
      code;

  // size must be multiple of 3
  this.visualizeGeo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(60*l), 3));
  this.vertices = this.visualizeGeo.attributes.position.array;

  this.visualizeGeo.addAttribute('color', new THREE.BufferAttribute(new Uint8Array(60*l), 3));
  this.colors = this.visualizeGeo.attributes.color.array

  console.log(l);
  // l = 50000;
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
  // this.gcodes[this.numGCodes].vertexNum = this.faces.length;
  // this.gcodes[this.numGCodes].layerNum = this.layerIndex;

  // self.layers[self.layerIndex] = self.numGCodes;
  // self.currentLayerHeight = self.lastLine.z;

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

  // var feedLine = new THREE.Mesh(this.visualizeGeo, new THREE.MultiMaterial([this.extrudeMat]));
  // self.baseObject.add(feedLine);

  // this.visualizeGeo.addGroup(0, l, 0);

  this.visualToolPaths.forEach(function(visualPath) {
    self.baseObject.add(visualPath.getVisibleExtrusionMesh());
    self.baseObject.add(visualPath.getTravelMovesVisual());
  });

  // Center
  var geo = this.visualToolPaths[0].getVisibleExtrusionMesh().geometry;
  geo.computeBoundingBox();
  self.bounds = geo.boundingBox;
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
      this.gcodes[this.numGCodes].vertexNum = this.faces.length;
      this.gcodes[this.numGCodes].layerNum = this.layerIndex;

      this.moveTool(code);

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

GCodeRenderer.prototype.moveTool = function(code) {
  var self = this;

  var visualPath = this.visualPathForToolNumber(this.toolNum);
  var shouldExtrude = this.shouldExtrude(code);

  var lastPoint = visualPath.lastPoint;
  var newPoint = this.getNewPoint(code.params, lastPoint);
  
  if ((code.cmd === "G2") || (code.cmd === "G3")) { //arc command
    var clockwise = false;
    if (code.cmd === "G2") clockwise = true;
    
    var points = this.getArcPoints(lastPoint, newPoint, clockwise);

    points.forEach(function(point) {
      visualPath.extendPathPolyline(point, shouldExtrude);
    });

  } else { //straight line

    visualPath.extendPathPolyline(newPoint, shouldExtrude);
  }
};

GCodeRenderer.prototype.getNewPoint = function(codeParams, lastPoint) {
  var newPoint = codeParams;

  for (var p in lastPoint) {
    switch (p) {
      case 'x': case 'y': case 'z':
        if (newPoint[p] === undefined)
          newPoint[p] = lastPoint[p];
        else
          newPoint[p] = this.absolute(lastPoint[p], newPoint[p]);
        break;

      default:
        if (newPoint[p] === undefined) {
          newPoint[p] = lastPoint[p];
        }
        break;
    }
  }

  return newPoint;
};

GCodeRenderer.prototype.getArcPoints = function(lastPoint, newPoint, clockwise) {
  var points = [];
  var currentX = lastPoint['x'];
  var currentY = lastPoint['y'];
  var centerX = currentX + newPoint.i;
  var centerY = currentY + newPoint.j;
  var radius = Math.sqrt(Math.pow(newPoint.i, 2) + Math.pow(newPoint.j, 2));

  var startAngle = this.getAngle(currentX, currentY, centerX, centerY, radius);
  var endAngle = this.getAngle(newPoint.x, newPoint.y, centerX, centerY, radius);

  var curve = new THREE.EllipseCurve(
    centerX, centerY,            // aX, always
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

  curve.getPoints(2*x).forEach(function(p) {
    points.push({x: p.x, y: p.y, z: newPoint.z});
  });

  return points;
};

GCodeRenderer.prototype.visualPathForToolNumber = function(toolNumber) {
  var visualPath = this.visualToolPaths[toolNumber];

  if (visualPath === null || visualPath === undefined) {
    visualPath = new VisualPath();
    this.visualToolPaths[toolNumber] = visualPath;
  }

  return visualPath;
}

GCodeRenderer.prototype.shouldExtrude = function(code) {
  var extrude = (code.params.e !== undefined);

  if ((this.toolNum === 1) && (this.solenoidOn)) {
    extrude = true;
  }

  return extrude;
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

GCodeRenderer.prototype.absolute = function(v1, v2) {
    return this.relative ? v1 + v2 : v2;
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

  this.visualizeGeo.clearGroups();
  this.visualizeGeo.addGroup(0, arrayIndex, 0);
  
  this.index = index;
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
