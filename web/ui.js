
var config = {
  lastImportedKey: 'last-imported',
  notFirstVisitKey: 'not-first-visit',
  defaultFilePath: 'examples/octocat.gcode'
}


var scene = null,
    object = null,
    guiParameters,
    stats;

function about() {
  $('#aboutModal').modal();
}

function openDialog() {
  $('#openModal').modal();
}


var gr;

function onGCodeLoaded(gcode) {
      gr = new GCodeRenderer();
      var gcodeObj = gr.render(gcode);

      camera.position.z = 500;
      camera.position.y = -1500;
      camera.lookAt( gr.center );


  // var gcodeObj = createObjectFromGCode(gcode);

  // // var gcodeModel = OldGCodeParser.parse(gcode);

  // localStorage.removeItem(config.lastImportedKey);
  // try {
  //   localStorage.setItem(config.lastImportedKey, gcode);
  // }
  // catch(e) {
  //   // localstorage error - probably out of space
  // }

  $('#openModal').modal('hide');
  if (object) {
    object.children.forEach(function(child) {
      if (child instanceof THREE.Line) {
        child.geometry.dispose();

        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        } else if (child.material instanceof THREE.MultiMaterial) {
          child.material.materials.forEach(function(mat) {
            mat.dispose();
          });
        }
      }
    });

    scene.remove(object);
  }



  object = gcodeObj;

  // reset gcodeindex slider to proper max
  guiControllers.gcodeIndex.max(gr.numGCodes);
  guiControllers.layerIndex.max(gr.layerIndex);
  guiControllers.layerHeight.max(gr.layerHeightSorted.length);
  guiControllers.gcodeIndex.updateDisplay();
  guiControllers.layerIndex.updateDisplay();
  guiControllers.layerHeight.updateDisplay();

  scene.add(object);

}

$(function() {

  // if (!Modernizr.webgl) {
  //   alert("Sorry, you need a WebGL capable browser to use this.\n\nGet the latest Chrome or FireFox.");
  //   return;
  // }

  // if (!Modernizr.localstorage) {
  //   alert("This app uses local storage to save settings, but your browser doesn't support it.\n\nGet the latest Chrome or FireFox.");
  //   return;
  // }

  // Show 'About' dialog for first time visits.
  if (!localStorage.getItem(config.notFirstVisitKey)) {
    localStorage.setItem(config.notFirstVisitKey, true);
    setTimeout(about, 500);
  }

  $('.gcode_examples a').on('click', function(event) {
    GCodeImporter.importPath($(this).attr('href'), onGCodeLoaded);
    return false;
  })

  // Drop files from desktop onto main page to import them.
  $('body').on('dragover', function(event) {

    event.stopPropagation();
    event.preventDefault();
    event.originalEvent.dataTransfer.dropEffect = 'copy';

  }).on('drop', function(event) {

    event.stopPropagation();
    event.preventDefault();

    FileIO.load(event.originalEvent.dataTransfer.files, function(gcode) {
      GCodeImporter.importText(gcode, onGCodeLoaded);
    });

  });

  scene = createScene($('#renderArea')[0]);

  var lastImported = localStorage.getItem(config.lastImportedKey);
  if (lastImported) {
    GCodeImporter.importText(lastImported, onGCodeLoaded);
  }
  // else {
  //   GCodeImporter.importPath(config.defaultFilePath, onGCodeLoaded);
  // }

  setupGui();
});


var guiControllers = {
  gcodeIndex: undefined,
  layerIndex: undefined,
  layerHeight: undefined,
};

function setupGui() {

  var gui = new dat.GUI();

  $('.dg.main').mousedown(function(event) {
    event.stopPropagation();
  });

  guiParameters = {

    gcodeIndex:   0,
    layerIndex: 0,
    layerHeight: 0,
    updateLayer: false,
    updateGcodeIndex: false,
    updateLayerHeight: false,
  };

  guiControllers.gcodeIndex = gui.add(guiParameters, "gcodeIndex").min(0).max(200000).step(1).listen();
  guiControllers.layerIndex = gui.add(guiParameters, "layerIndex").min(0).max(10000).step(1).listen();
  guiControllers.layerHeight = gui.add(guiParameters, "layerHeight").min(0).max(1000).step(1).listen();


  guiControllers.gcodeIndex.onChange(function(value) {
    guiParameters.updateLayer = false;
    guiParameters.updateGcodeIndex = true;
    guiParameters.updateLayerHeight = false;
  });

  guiControllers.layerIndex.onChange(function(value) {
    guiParameters.updateLayer = true;
    guiParameters.updateGcodeIndex = false;
    guiParameters.updateLayerHeight = false;
  });

  guiControllers.layerHeight.onChange(function(value) {
    guiParameters.updateLayer = false;
    guiParameters.updateGcodeIndex = false;
    guiParameters.updateLayerHeight = true;
  });
};

