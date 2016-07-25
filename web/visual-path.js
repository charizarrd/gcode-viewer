function VisualPath() {
  //All the points traveled to by some tool
  this.polylinePoints = [];

  //Parallel with the polylinePoints array
  //May have many points for one gcode, though, in which
  //case the gcode is repeated. Actually holds line numbers
  //referring to the original gcode file.
  this.commands = [];

  //Parallel with the polylinePoints array (divided by 3)
  //E value from gcode command, needed for tube geometry radius
  this.extrusionValues = [];

  //Parallel with the polylinePoints array (divided by 3)
  //For extrusions only - faces index for tube geometry
  // corresponding to that point
  this.extrusionTubeFacesIndex = [];

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
  this.tubeFaces = [];
  this.numShapePoints = 6;

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
  // this.extendPathPolyline(this.lastPoint, this.extrudedLastTime);
};

VisualPath.prototype.extendPathPolyline = function(newPoint, shouldExtrude, commandIndex) {
  var pointIndex = this.polylinePoints.length;

  this.polylinePoints.push(newPoint.x);
  this.polylinePoints.push(newPoint.y);
  this.polylinePoints.push(newPoint.z);

  this.commands.push(commandIndex);
  this.commands.push(commandIndex);
  this.commands.push(commandIndex);

  this.extrusionValues.push(newPoint.e);
  this.extrusionTubeFacesIndex.push(0);

  if (shouldExtrude) {
    this.updateLayers(newPoint, pointIndex);
  }

  this.updatePolylinePartRanges(pointIndex, shouldExtrude);

  this.lastPoint = newPoint;
  this.extrudedLastTime = shouldExtrude;
};

VisualPath.prototype.finishPathPolyline = function() {
  var pointIndex = this.polylinePoints.length - this.AXES;

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

  this.setVisibleLayerRange(0, this.layers.length - 1);
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

    var startIndex = pointIndex - this.AXES; // needs to include last location
    if (newPoint.z > this.highestZ) { //create new layer
      layerIndex++;
      this.highestZ = newPoint.z;
    
      this.addLayer(startIndex, layerIndex, newPoint.z);

    } else { //find previously created layer

      var layer = null;

      //Traverse layers backwards looking for one with same height
      for (var i = this.layers.length - 1; i > -1; i--) {

        var curLayer = this.layers[i];

        if (curLayer.height === newPoint.z) { //Found an existing layer at same Z
          layer = curLayer;
          layer.addRangeStart(startIndex);
          layerIndex = i;
          console.log(layerIndex);
          break;

        } else if (newPoint.z > curLayer.height) { //Need to insert a new layer
          
          this.addLayer(startIndex, i, newPoint.z);
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
    if (pointIndex === 0)
      this.travelRanges.push(pointIndex);
    else
      this.travelRanges.push(pointIndex - this.AXES); // needs to include last location
  } else if (startingExtrusion) {
    if (pointIndex === 0)
      this.extrusionRanges.push(pointIndex);
    else
      this.extrusionRanges.push(pointIndex - this.AXES); // needs to include last location
  }

  if (endingTravel) {
    this.travelRanges.push(pointIndex - this.AXES);
  } else if (endingExtrusion) {
    this.extrusionRanges.push(pointIndex - this.AXES);
  }
};

VisualPath.prototype.addLayer = function(pointIndex, layerIndex, height) {

  var newLayer = new Layer();

  newLayer.addRangeStart(pointIndex);
  newLayer.height = height;

  if (layerIndex === this.layers.length) { //add to end
    this.layers[layerIndex] = newLayer;
  } else { //insert
    this.layers.splice(layerIndex, 0, newLayer);
  }

  return newLayer;
};

VisualPath.prototype.updateVisibleTubeRanges = function() {
  var ranges = this.visiblePolylineRanges;
  var geo = this.extrusionMesh.geometry;

  // clear groups
  geo.clearGroups();

  for (var i = 0; i < ranges.length; i += 2) {
    var start = ranges[i];
    var end = ranges[i + 1];


  }
  // clear visibleTubeVertexRanges
  // for each visiblePolylineRange
       // tubeRange = tubeIndexRangeForPolylineIndexRange(infillRange)
       // visibleTubeVertexRanges.push(tubeRange);
  // rebuild geometry 'groups' based on visibleTubeVertexRanges
};

VisualPath.prototype.updateVisiblePolylineRanges = function() {
  var pointRangeStart = this.firstIndexOfCommand(this.visibleCommandRangeStart);
  var pointRangeEnd = this.lastIndexOfCommand(this.visibleCommandRangeEnd);
  var commandRange = [pointRangeStart, pointRangeEnd];

  var layerRanges = [];
  for (var i = this.visibleLayerRangeStart; i <=  this.visibleLayerRangeEnd; i++) {
    var layer = this.layers[i];
    if (layerRanges.length > 0) {
      layerRanges = RangeUtil.unionRangeSets(layerRanges, layer.pointIndexRanges);
    }
  }

  this.visiblePolylineRanges = RangeUtil.intersectRangeSets(commandRange, layerRanges);
};

VisualPath.prototype.setVisibleLayerRange = function(first, last) {
  this.visibleCommandRangeStart = this.commands[0];
  this.visibleCommandRangeEnd = this.commands[this.commands.length - 1];

  this.visibleLayerRangeStart = first;
  this.visibleLayerRangeEnd = last;

  this.updateVisiblePolylineRanges();

  if (this.extrusionMesh)
    this.updateVisibleTubeRanges();
};

VisualPath.prototype.setVisibleCommandRange = function(first, last) {
  this.visibleLayerRangeStart = 0;
  this.visibleLayerRangeEnd = this.layers.length - 1;

  this.visibleCommandRangeStart = this.commands[first];
  this.visibleCommandRangeEnd = this.commands[last];

  this.updateVisiblePolylineRanges();

  if (this.extrusionMesh)
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

VisualPath.prototype.iteratePolylineSegments = function(ranges, func) {
  var polyline = this.polylinePoints;

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

VisualPath.prototype.iteratePolylinePoints = function(ranges, func) {
  var polyline = this.polylinePoints;

  for (var i = 0; i < ranges.length; i += 2) {
    var start = ranges[i];
    var end = ranges[i + 1];

    for (var j = start; j <= end; j += 3) {
        var x = polyline[j];
        var y = polyline[j + 1];
        var z = polyline[j + 2];

        // var isRangeEnd = i % 2 !== 0;
        var isRangeEnd = (j == end);
        func(x, y, z, j, isRangeEnd);
    }
  }
}

//Only giving back a debug line rendering at the moment
//NOTE: the debug line rendering also has an issue: since we're
//making only one THREE.Line, whenever there's a gap (because a 
//travel move took place), the line is just extended across the gap.
// charz: I think I fixed this but leaving this comment just in case...
VisualPath.prototype.getVisibleExtrusionMesh = function() {
  var self = this;
  var mesh = this.extrusionMesh;

  if (mesh === null) {

    // var geo = new THREE.Geometry();
    var geo = new THREE.BufferGeometry();

    var numExtrudeVertices = 0;
    for (var i = 0; i < this.extrusionRanges.length; i += 2) {
      var start = this.extrusionRanges[i];
      var end = this.extrusionRanges[i + 1];

      numExtrudeVertices += (end + 3 - start);
    }

    var numTubeVertices = 2*self.numShapePoints * numExtrudeVertices;
    var numFaces = 2*numTubeVertices;

    geo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(numTubeVertices), 3));
    this.tubeVertices = geo.attributes.position.array;

    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(numFaces), 1));
    this.tubeFaces = geo.getIndex().array;
    // this.tubeFaces = [];
    this.generateTubeGeometry();

    geo.computeVertexNormals();

    var extrudeMat = new THREE.MeshStandardMaterial({
      color: 0x00AAAA,
      metalness: 0.5,
      roughness: 0.5
    });

    mesh = new THREE.Mesh(geo, extrudeMat);
    // mesh = new THREE.Mesh(geo, new THREE.MultiMaterial([extrudeMat]));
    this.extrusionMesh = mesh;
  }

  // set mesh groups based on visiblePolylineRanges
  var visibleExtrusionRanges = RangeUtil.intersectRangeSets(this.extrusionRanges, this.visiblePolylineRanges);

    // geo.addGroup(0, this.tubeFaces.length, 0);

  return mesh;
};

VisualPath.prototype.getTravelMovesVisual = function() {
  var self = this;
  var mesh = this.travelMovesLine;

  if (mesh === null) {
    // var geo = new THREE.Geometry();
    var geo = new THREE.BufferGeometry();

    var numTravelVertices = 0;
    for (var i = 0; i < this.travelRanges.length; i += 2) {
      var start = this.travelRanges[i];
      var end = this.travelRanges[i + 1];

      numTravelVertices += (end + 3 - start);
    }

    geo.addAttribute('position', new THREE.BufferAttribute(new Float32Array(2*numTravelVertices), 3));
    var travelVertices = geo.attributes.position.array;
    var vertIndex = 0;

    var lastVertex = null;
    this.iteratePolylinePoints(this.travelRanges, function(x, y, z, pointIndex, isRangeEnd) {
      var vertex = new THREE.Vector3(x, y, z);

      if ((lastVertex !== null) && !(lastVertex.equals(vertex))) {
        travelVertices[vertIndex] = lastVertex.x;
        travelVertices[vertIndex+1] = lastVertex.y;
        travelVertices[vertIndex+2] = lastVertex.z;
        vertIndex += 3;

        travelVertices[vertIndex] = vertex.x;
        travelVertices[vertIndex+1] = vertex.y;
        travelVertices[vertIndex+2] = vertex.z;
        vertIndex += 3;
      }

      if (isRangeEnd)
        lastVertex = null;
      else
        lastVertex = vertex.clone();      
    });

    mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({color: 0xFF0000}));
    this.travelMovesLine = mesh;
  }

  return mesh;
};

// TODO: should probably be passed in 
VisualPath.prototype.calculateExtrusionHeight = function(extrusionValue, pathLength) {
  var extrusionWidth = 0.35;
  var filamentDiameter = 1.75;
  var volume = extrusionValue * Math.PI * Math.pow((filamentDiameter/2), 2);
  var crossArea = volume / pathLength;
  var a = (Math.PI/4 - 1);
  var b = extrusionWidth;
  var c = -crossArea;
  var root1 = (-b + Math.sqrt(Math.pow(b,2) - 4*a*c)) / (2*a);
  var root2 = (-b - Math.sqrt(Math.pow(b,2) - 4*a*c)) / (2*a);
  return Math.min(root1, root2);
}

//Should fill this.tubeVertices with the vertices of tubes following
//all the extrusion portions of the path polyline
VisualPath.prototype.generateTubeGeometry = function() {
  var self = this;

  // Create circle shape to trace around polyline path
  var shapeVerts = [];
  var numShapePoints = this.numShapePoints;
  for ( var i = 0; i < numShapePoints; i ++ ) {
    var a = (i % numShapePoints) / numShapePoints * 2*Math.PI;
    shapeVerts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  var geometry = new THREE.Geometry();
  geometry.vertices = shapeVerts;
  var shape = new THREE.Line(geometry, new THREE.LineBasicMaterial());

  var tangent = new THREE.Vector3();
  var axis = new THREE.Vector3();
  var up = new THREE.Vector3(0, 0, 1);

  var numTubeVertices = 0;
  var tubeVerticesIndex = 0;
  var tubeFacesIndex = 0;
  var lastPoint = null;
  var lastNormal = null;

  this.iteratePolylinePoints(this.extrusionRanges, function(x, y, z, pointIndex, isRangeEnd) {
      var currentPoint = new THREE.Vector3(x, y, z);

      if ((lastPoint !== null) && !(lastPoint.equals(currentPoint))) {
        // connect currentPoint to lastPoint and generate tube

        tangent = currentPoint.clone().sub(lastPoint).normalize();
        axis.crossVectors(up, tangent).normalize();
        var radians = Math.acos(up.dot(tangent));
        shape.quaternion.setFromAxisAngle(axis, radians);

        var extrusionValue = self.extrusionValues[pointIndex/3];
        var pathLength = lastPoint.distanceTo(currentPoint);
        // var tubeRadius = self.calculateExtrusionHeight(extrusionValue, pathLength);
        var tubeRadius = 0.2;
        shape.scale.x = tubeRadius;
        shape.scale.y = tubeRadius;
        shape.scale.z = tubeRadius;

        // add shape at lastPoint
        shape.position.copy(lastPoint);
        shape.updateMatrix();

        shapeVerts = [];
        shape.geometry.vertices.forEach(function(v) {
          shapeVerts.push(v.clone().applyMatrix4(shape.matrix));
        });

        for (var i = 0; i < numShapePoints; i++) {
          var v = shapeVerts[i];
          self.tubeVertices[tubeVerticesIndex] = v.x;
          self.tubeVertices[tubeVerticesIndex+1] = v.y;
          self.tubeVertices[tubeVerticesIndex+2] = v.z;

          tubeVerticesIndex += 3;
        }
        numTubeVertices += numShapePoints;

        // add shape at currentPoint
        shape.position.copy(currentPoint);
        shape.updateMatrix();

        shapeVerts = [];
        shape.geometry.vertices.forEach(function(v) {
          shapeVerts.push(v.clone().applyMatrix4(shape.matrix));
        });
        for (var i = 0; i < numShapePoints; i++) {
          var v = shapeVerts[i];
          self.tubeVertices[tubeVerticesIndex] = v.x;
          self.tubeVertices[tubeVerticesIndex+1] = v.y;
          self.tubeVertices[tubeVerticesIndex+2] = v.z;

          if (isNaN(v.x) || isNaN(v.y) || isNaN(v.z))
            console.log(v);

          tubeVerticesIndex += 3;
  
          // verts should be in CCW order
          var j = (i+1) % numShapePoints;

          self.tubeFaces[tubeFacesIndex] = numTubeVertices + j;
          self.tubeFaces[tubeFacesIndex+1] = numTubeVertices + i;
          self.tubeFaces[tubeFacesIndex+2] = numTubeVertices - numShapePoints + i;

          self.tubeFaces[tubeFacesIndex+3] = numTubeVertices + j;
          self.tubeFaces[tubeFacesIndex+4] = numTubeVertices - numShapePoints + i;
          self.tubeFaces[tubeFacesIndex+5] = numTubeVertices - numShapePoints + j;

          tubeFacesIndex += 6;
        }
        numTubeVertices += numShapePoints;

        // Add faces to connect start of next tube to end of last tube
        if (lastNormal !== null) {
          var oldIndex = (numTubeVertices - 3*numShapePoints)*3; // index into self.tubeVertices of end of last tube
          var newIndex = (numTubeVertices - 2*numShapePoints)*3; // index into self.tubeVertices of start of current tube
          
          var direction = lastNormal.clone().add(tangent).normalize();
          var maxDot = 0;
          var offset;

          for (var i = 0; i < numShapePoints*3; i+=3) {
            var v1 = new THREE.Vector3();
            v1.x = self.tubeVertices[newIndex + i];
            v1.y = self.tubeVertices[newIndex + i + 1];
            v1.z = self.tubeVertices[newIndex + i + 2];
            for (var j = 0; j < numShapePoints*3; j+= 3) {
              var v2 = new THREE.Vector3();
              v2.x = self.tubeVertices[oldIndex + j];
              v2.y = self.tubeVertices[oldIndex + j + 1];
              v2.z = self.tubeVertices[oldIndex + j + 2];

              var diff = v2.sub(v1).normalize();
              var val = Math.abs(diff.dot(direction));
              
              if (val > maxDot) {
                maxDot = val;
                offset = j/3 - i/3;
              }
            }
          }

          if (offset !== undefined) {
            if (offset < 0)
              offset += numShapePoints;

            newIndex = newIndex/3; // index of start vertex of current tube
            oldIndex = oldIndex/3;          // index of end vertex of last tube

            for (var i = 0; i < numShapePoints; i++) {
              var j = (i+1) % numShapePoints;
              var k = (i + offset) % numShapePoints;
              var m = (i + offset + 1) % numShapePoints;

              self.tubeFaces[tubeFacesIndex] = newIndex + j;
              self.tubeFaces[tubeFacesIndex+1] = newIndex + i;
              self.tubeFaces[tubeFacesIndex+2] = oldIndex + k;

              self.tubeFaces[tubeFacesIndex+3] = newIndex + j;
              self.tubeFaces[tubeFacesIndex+4] = oldIndex + k;
              self.tubeFaces[tubeFacesIndex+5] = oldIndex + m;

              tubeFacesIndex += 6;
            }
          }
        }
        lastNormal = tangent.clone();
      }

      self.extrusionTubeFacesIndex[pointIndex/3] = tubeFacesIndex;

      if (isRangeEnd) {
        lastPoint = null; //reset to null to indicate it's a new extrusion
        lastNormal = null;
      }
      else
        lastPoint = currentPoint;
  });
};
