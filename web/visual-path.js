function VisualPath() {
  this.layers = [];
  this.tubeVertices = [];
  this.travelPoints = [];

  //I'm just using this for testing;
  //The extrusion points should eventually be divided up among layers,
  //perimeters, and infill
  this.extrusionPoints = [];

  this.layerIndex = 0;
  this.currentLayerHeight = 0;

  this.visibleLayerRangeStart = 0;
  this.visibleLayerRangeEnd = 0;
  this.visibleGcodeIndexStart = 0;
  this.visibleGcodeIndexEnd = 0;
    
  this.visibleTubeVertexRanges = [];

  // should always be absolute coordinates stored here
  this.lastPoint = {x:0, y:0, z:0, e:0, f:0};
  this.meshDataChanged = true;
  this.material = null;
  this.extrusionMesh = null;
  this.travelMovesLine = null;

  //Not sure if this first point should actually be included or not
  //Also, should check whether it's a travel or extrusion
  this.travelPoints.push(this.lastPoint.x);
  this.travelPoints.push(this.lastPoint.y);
  this.travelPoints.push(this.lastPoint.z);
};

VisualPath.prototype.extendPathPolyline = function(newPoint, shouldExtrude) {

  if (shouldExtrude) {
    //Not actually using this yet
    var layer = this.getLayer(this.layerIndex);

    //Eventually we'll place these points into the correct layer
    this.extrusionPoints.push(newPoint.x, newPoint.y, newPoint.z);

    //Check for new layer
    if (newPoint.z != this.currentLayerHeight) { 

      //Not really sure how layers are going to be done yet...
      this.currentLayerHeight = newPoint.z;
      this.layerIndex += 1;

    }    
  } else { //travel move

    this.travelPoints.push(newPoint.x, newPoint.y, newPoint.z);
  }

  this.lastPoint = newPoint;
};

//Only giving back a debug line rendering at the moment
VisualPath.prototype.getVisibleExtrusionMesh = function() {
  var self = this;
  var mesh = this.extrusionMesh;

  if (mesh === null) {
    var geo = new THREE.Geometry();
    
    for (var i = 0; i < this.extrusionPoints.length; i += 3) {
        var vertex = new THREE.Vector3(this.extrusionPoints[i],
                                       this.extrusionPoints[i + 1],
                                       this.extrusionPoints[i + 2])
        geo.vertices.push(vertex);
    }

    mesh = new THREE.Line(geo, new THREE.LineBasicMaterial({color: 0x00AAAA}));
    this.mesh = mesh;
  }

  return mesh;
};

VisualPath.prototype.getTravelMovesVisual = function() {
  var self = this;
  var mesh = this.travelMovesLine;

  if (mesh === null) {
    var geo = new THREE.Geometry();
    
    for (var i = 0; i < this.travelPoints.length; i += 3) {
        var vertex = new THREE.Vector3(this.travelPoints[i],
                                       this.travelPoints[i + 1],
                                       this.travelPoints[i + 2])
        geo.vertices.push(vertex);
    }

    mesh = new THREE.Line(geo, new THREE.LineBasicMaterial({color: 0xFF0000}));
    this.mesh = mesh;
  }

  return mesh;
};

//This does nothing for now
VisualPath.prototype.generateTubeGeometry = function() {
  var color = this.getColor(extrude);

  if (extrude) {
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
  }
};

VisualPath.prototype.getLayer = function(index) {
  var layer = this.layers[index];

  if (layer === null || layer === undefined) {
    layer = new Layer();
    this.layers[index] = layer;
  }

  return layer;
};
