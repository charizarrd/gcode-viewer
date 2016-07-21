function VisualPath() {
  //All the points traveled to by some tool
  this.polylinePoints = [];

  //Parallel with the polylinePoints array
  //May have many points for one gcode, though, in which
  //case the gcode is repeated
  this.commands = [];

  //Polyline part types
  this.extrusionRanges = [];
  this.travelRanges = [];

  //empty for now
  //also might be better to make these properties of Layers
  this.perimeterRanges = [];
  this.infillRanges = [];

  //The vertices of the tube surrounding the entire polyline
  //(except portions corresponding to travel moves)
  this.tubeVertices = [];

  this.visibleLayerRangeStart = 0;
  this.visibleLayerRangeEnd = 0;
  this.visibleCommandRangeStart = 0;
  this.visibleCommandRangeEnd = 0;

  this.visiblePolylineRanges = [];
  this.visibleTubeRanges = [];

  this.layers = [];
  this.lastLayerIndex = -1;

  // should always be absolute coordinates stored here
  this.extrudedLastTime = false;
  this.lastPoint = {x:0, y:0, z:0, e:0, f:0};
  this.lastLayerHeight = -1;
  this.highestZ = -1;
  this.meshDataChanged = true;
  this.material = null;

  //Three.js scenegraph objects
  this.extrusionMesh = null;
  this.travelMovesLine = null;

  this.AXES = 3;

  //Not sure if this first point should actually be included or not
  //Also, should check whether it's a travel or extrusion
  this.extendPathPolyline(this.lastPoint, this.extrudedLastTime);
};

VisualPath.prototype.extendPathPolyline = function(newPoint, shouldExtrude, commandIndex) {

  var pointIndex = this.polylinePoints.length;

  this.polylinePoints.push(newPoint.x);
  this.polylinePoints.push(newPoint.y);
  this.polylinePoints.push(newPoint.z);

  this.commands.push(commandIndex);
  this.commands.push(commandIndex);
  this.commands.push(commandIndex);

  if (shouldExtrude) {
    this.updateLayers(newPoint, pointIndex);
  }

  this.updatePolylinePartRanges(pointIndex, shouldExtrude);

  this.lastPoint = newPoint;
  this.extrudedLastTime = shouldExtrude;
};

VisualPath.prototype.finishPathPolyline = function(pointIndex) {
  //Finish extrusion/travel ranges
  if (this.extrudedLastTime) {
    this.extrusionRanges.push(pointIndex);
  } else {
    this.travelRanges.push(pointIndex);
  }

  //Finish layers
  if (this.extrudedLastTime) {
    this.layers[this.lastLayerIndex].addRangeEnd(pointIndex);
  }

  this.generateTubeGeometry();
};

//Used to create layers as the polyline is built up
VisualPath.prototype.updateLayers = function(newPoint, pointIndex) {

  var atSameZ = (newPoint.z === this.lastLayerHeight);
  var layerIndex = this.lastLayerIndex;

  if (!atSameZ) { //change layers

    if (this.layers.length > 0) { //We're not creating our first layer

      //close range on previous layer
      var previousLayer = this.layers[this.lastLayerIndex];
      previousLayer.addRangeEnd(pointIndex - this.AXES);
    }

    if (newPoint.z > this.highestZ) { //create new layer
      layerIndex++;
    
      this.addLayer(pointIndex, layerIndex, newPoint.z);

    } else { //find previously created layer

      var layer = null;

      //Traverse layers backwards looking for one with same height
      for (var i = this.layers.length - 1; i > -1; i--) {

        var curLayer = this.layers[i];

        if (curLayer.height === newPoint.z) { //Found an existing layer at same Z
          layer = curLayer;
          layer.addRangeStart(pointIndex);
          layerIndex = i;
          break;

        } else if (newPoint.z > curLayer.height) { //Need to insert a new layer
          
          this.addLayer(pointIndex, i, newPoint.z);
          layerIndex = i;
        }
      }
    }
  }

  this.lastLayerIndex = layerIndex;
  this.lastLayerHeight = this.layers[layerIndex].height;
};

//Used to mark off travel moves and extrusion for now, but might expand
//to track ranges for infill/perimeters also
VisualPath.prototype.updatePolylinePartRanges = function(pointIndex, extruding) {

  var startingTravel = (this.extrudedLastTime || pointIndex === 0) && !extruding;
  var startingExtrusion = (!this.extrudedLastTime || pointIndex === 0) && extruding;
  var endingExtrusion = startingTravel && pointIndex > 0;
  var endingTravel = startingExtrusion && pointIndex > 0;

  if (startingTravel) {
    this.travelRanges.push(pointIndex);
  } else if (startingExtrusion) {
    this.extrusionRanges.push(pointIndex);
  }

  if (endingTravel) {
    this.travelRanges.push(pointIndex - this.AXES);
  } else if (endingExtrusion) {
    this.extrusionRanges.push(pointIndex - this.AXES);
  }
};

VisualPath.prototype.addLayer = function(pointIndex, layerIndex, height) {

  var newLayer = new Layer()

  newLayer.addRangeStart(pointIndex);
  newLayer.height = height;

  if (layerIndex === this.layers.length) { //add to end
    this.layers[layerIndex] = newLayer;
  } else { //insert
    this.layers.splice(layerIndex, 0, newLayer);
  }

  return newLayer;
};

VisualPath.prototype.udpateVisibleTubeRanges = function() {
  // clear visibleTubeVertexRanges
  // for each visiblePolylineRange
       // tubeRange = tubeIndexRangeForPolylineIndexRange(infillRange)
       // visibleTubeVertexRanges.push(tubeRange);
  // rebuild geometry 'groups' based on visibleTubeVertexRanges
};

VisualPath.prototype.updateVisiblePolylineRanges = function() {
  var pointRangeStart = this.firstIndexOfCommand(this.visibleCommandRangeStart);
  var pointRangeEnd = this.lastIndexOfCommand(this.visibleCommandRangeEnd);

  var layerRangeStart = this.layers[this.visibleLayerRangeStart].getFirstRangeStart();
  var layerRangeEnd = this.layers[this.visibleLayerRangeEnd].getLastRangeEnd();

  this.visiblePolylineRanges = RangeUtil.unionRanges(pointRangeStart, pointRangeEnd, layerRangeStart, layerRangeEnd);
};

VisualPath.prototype.setVisibleLayerRange = function(first, last) {
  this.visibleCommandRangeStart = 0;
  this.visibleCommandRangeEnd = this.commands.length - 1;

  this.visibleLayerRangeStart = first;
  this.visibleLayerRangeEnd = last;

  this.updateVisiblePolylineRanges();
  this.updateVisibleTubeRanges();
};

VisualPath.prototype.setVisibleCommandRange = function(first, last) {
  this.visibleLayerRangeStart = 0;
  this.visibleLayerRangeEnd = this.layers.length - 1;

  this.visibleCommandRangeStart = first;
  this.visibleCommandRangeEnd = last;

  this.updateVisiblePolylineRanges();
  this.updateVisibleTubeRanges();
};

VisualPath.prototype.firstIndexOfCommand = function(command) {
  var index = 0;
  while (index < this.commands.length && this.commands[index] !== command) {
    index++;
  }
  return index;
},

VisualPath.prototype.lastIndexOfCommand = function(command) {
  var index = this.commands.length - 1;
  while (index > -1 && this.commands[index] !== command) {
    index--;
  }
  return index;
},

VisualPath.prototype.iteratePolylineSegments = function(polyline, ranges, func) {
  for (var i = 0; i < ranges.length; i += 2) {
    var start = ranges[i];
    var end = ranges[i + 1];

    for (var j = start; j <= end; j += 6) {
        var p1x = polyline[j];
        var p1y = polyline[j + 1];
        var p1z = polyline[j + 2];

        var p2x = polyline[j + 3];
        var p2y = polyline[j + 4];
        var p2z = polyline[j + 5];

        func(p1x, p1y, p1z, p2x, p2y, p2z, j);
    }
  }
}

VisualPath.prototype.iteratePolylinePoints = function(polyline, ranges, func) {
  for (var i = 0; i < ranges.length; i += 2) {
    var start = ranges[i];
    var end = ranges[i + 1];

    for (var j = start; j <= end; j += 3) {
        var x = polyline[j];
        var y = polyline[j + 1];
        var z = polyline[j + 2];

        var isRangeEnd = i % 2 !== 0;
        func(x, y, z, j, isRangeEnd);
    }
  }
}

//Only giving back a debug line rendering at the moment
//NOTE: the debug line rendering also has an issue: since we're
//making only one THREE.Line, whenever there's a gap (because a 
//travel move took place), the line is just extended across the gap.
VisualPath.prototype.getVisibleExtrusionMesh = function() {
  var self = this;
  var mesh = this.extrusionMesh;

  if (mesh === null) {

    var geo = new THREE.Geometry();

    //uncomment to test visible layer ranges
    // var minLayer = 300;
    // var maxLayer = 301;
    // var minPointIndex = this.layers[minLayer].getFirstRangeStart();
    // var maxPointIndex = this.layers[maxLayer].getLastRangeEnd();

    this.iteratePolylinePoints(this.polylinePoints, this.extrusionRanges, function(x, y, z, pointIndex) {
      // if (pointIndex >= minPointIndex && pointIndex <= maxPointIndex) {
        var vertex = new THREE.Vector3(x, y, z);
        geo.vertices.push(vertex);
      // }
    });

    mesh = new THREE.Line(geo, new THREE.LineBasicMaterial({color: 0x00AAAA}));
    this.extrusionMesh = mesh;
  }

  return mesh;
};

VisualPath.prototype.getTravelMovesVisual = function() {
  var self = this;
  var mesh = this.travelMovesLine;

  if (mesh === null) {
    var geo = new THREE.Geometry();

    this.iteratePolylinePoints(this.polylinePoints, this.travelRanges, function(x, y, z) {
      var vertex = new THREE.Vector3(x, y, z);
      geo.vertices.push(vertex);
    });

    mesh = new THREE.Line(geo, new THREE.LineBasicMaterial({color: 0xFF0000}));
    this.travelMovesLine = mesh;
  }

  return mesh;
};

//Should fill this.tubeVertices with the vertices of tubes following
//all the extrusion portions of the path polyline
VisualPath.prototype.generateTubeGeometry = function() {
  // var color = this.getColor(extrude);

  // var counter = 0;
  // var tangent = new THREE.Vector3();
  // var axis = new THREE.Vector3();
  // while (counter <= 1) {
  //     self.shape.position.copy( path.getPointAt(counter) );

  //     tangent = path.getTangentAt(counter).normalize();

  //     axis.crossVectors(self.up, tangent).normalize();

  //     var radians = Math.acos(self.up.dot(tangent));

  //     self.shape.quaternion.setFromAxisAngle(axis, radians);

  //     self.shape.updateMatrix();

  //     var verts = [];
  //     self.shape.geometry.vertices.forEach(function(v) {
  //       verts.push(v.clone().applyMatrix4(self.shape.matrix));
  //     });
  //     var l = verts.length;

  //     for (var i = 0; i < l; i++) {
  //       var v = verts[i];
  //       self.vertices[self.vIndex] = v.x;
  //       self.vertices[self.vIndex+1] = v.y;
  //       self.vertices[self.vIndex+2] = v.z;
  //       self.colors[self.vIndex] = color.r;
  //       self.colors[self.vIndex+1] = color.g;
  //       self.colors[self.vIndex+2] = color.b;

  //       self.vIndex += 3;

  //       // for triangles, verts should be in CCW order
  //       // if (self.vIndex >= l) {
  //       if (counter > 0) {
  //         var j = (i+1) % l;

  //         self.faces.push(self.numVertices + j);
  //         self.faces.push(self.numVertices + i);
  //         self.faces.push(self.numVertices - l + i);

  //         self.faces.push(self.numVertices + j);
  //         self.faces.push(self.numVertices - l + i);
  //         self.faces.push(self.numVertices - l + j)
  //       }

  //     }

  //     self.numVertices += l;
  //     counter += 1/total;
  // } 
};
