function GCodeRenderer() {
  this.relative = false;
  this.toolNum = 0;
  this.solenoidOn = false;

  this.parser = new GCodeParser();
  this.visualToolPaths = []; //one for each tool

  this.currentCommandIndex = 0;

  this.baseObject = new THREE.Object3D();

  this.bounds = {
    min: { x: 100000, y: 100000, z: 100000 },
    max: { x:-100000, y:-100000, z:-100000 }
  };

  this.config = {};

  this.layers = [];
  this.numLayers = 0;
};

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

    parsedLine = self.parser.parseLine(lines[i]);    
    code = {};  

    if (parsedLine.words.length > 0) {
      code.params = {};

      parsedLine.words.forEach(function(word, i) {
        if (i === 0) {
          code.cmd = word.raw;
        } else {
          code.params[word.letter.toLowerCase()] = parseFloat(word.value);
        }
      });

      self.gcodeHandler(code); 
      
    }
    else if (parsedLine.comments.length > 0 && Object.keys(self.config).length === 0) {
      parsedLine.comments.forEach(function(comment) {
        var config = self.parser.parseConfig(comment);

        if (Object.keys(config).length > 0) {
          self.config = config;
        }
      });
    }
  }

  console.log('done parsing');

  this.visualToolPaths.forEach(function(visualPath) {
    visualPath.finishPathPolyline();
  });  

  this.visualToolPaths.forEach(function(visualPath) {
    self.baseObject.add(visualPath.getVisibleExtrusionMesh());
    self.baseObject.add(visualPath.getTravelMovesVisual());
  });

  console.log('here');

  //count total layers
  this.visualToolPaths.forEach(function(visualPath) {
    // console.log(visualPath.layers.length);

    if (self.layers.length === 0) {
      visualPath.layers.forEach(function(layer) {
        self.layers.push(layer.height);
      });
      self.numLayers = self.layers.length;
    } else {
      visualPath.layers.forEach(function(layer) {
        var targetHeight = layer.height;

        var start = 0;
        var end = self.numLayers;
        while ((end - start) > 0) {
          var index = Math.round((end + start) / 2);
          var guessHeight = self.layers[index];

          if (guessHeight === targetHeight)
            break;

          if ((end - start) === 1) {
            var index;
            if (guessHeight > targetHeight)
              index = end;
            else
              index = end+1;

            self.layers.splice(index, 0, targetHeight);
            // console.log(targetHeight);
            break;
          }
          else if (guessHeight > targetHeight)
            end = index-1;
          else if (guessHeight < targetHeight)
            start = index+1;
        }
      });
    }
  });


  console.log('hi');

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

      this.moveTool(code);
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

  this.currentCommandIndex++;
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
      visualPath.extendPathPolyline(point, shouldExtrude, this.currentCommandIndex);
    });

  } else { //straight line

    visualPath.extendPathPolyline(newPoint, shouldExtrude, this.currentCommandIndex);
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

  var samples = 2*x;

  curve.getPoints(samples).forEach(function(p) {
    points.push({
      x: Math.round(p.x * 1000) / 1000, // round to 3 decimal places
      y: Math.round(p.y * 1000) / 1000,
      z: newPoint.z,
      e: newPoint.e/samples
    });
  });

  return points;
};

GCodeRenderer.prototype.visualPathForToolNumber = function(toolNumber) {
  var visualPath = this.visualToolPaths[toolNumber];

  if (visualPath === null || visualPath === undefined) {
    visualPath = new VisualPath(this.config);
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

GCodeRenderer.prototype.setVisibleLayerRange = function(layerIndex) {
  //calls 'setVisibleLayerRange' on each VisualPath

  // this.visualToolPaths.forEach(function(visualPath) {
  //   visualPath.setVisibleLayerRange(layerIndex-1, layerIndex);
  // });  
};

GCodeRenderer.prototype.setVisibleCommandRange = function(layerIndex) {
  //calls 'setVisibleCommandRange' on each VisualPath


  // var geo = this.visualToolPaths[0].getVisibleExtrusionMesh().geometry;
};
