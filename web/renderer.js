var camera, controls, renderer, composer;
function createScene(container) {

  var containerWidth  = window.innerWidth || 2, //container.offsetWidth,
      containerHeight = window.innerHeight || 2; //container.offsetHeight;

  var autoRotate = false;


  init();
  animate();

  function init() {

    var i;


    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer( { clearColor: 0x000000, clearAlpha: 1, antialias: false } );
    renderer.autoClear = false;

    container.appendChild( renderer.domElement );

    // Lights...
    // [[ 0, 0, 1, 0xFFFFCC],
    //  [ 0, 1, 0, 0xFFCCFF],
    //  [ 1, 0, 0, 0xCCFFFF],
    //  [ 0, 0,-1, 0xCCCCFF],
    //  [ 0,-1, 0, 0xCCFFCC],
    //  [-1, 0, 0, 0xFFCCCC]].forEach(function(position) {
    //   var light = new THREE.DirectionalLight(position[3]);
    //   light.position.set(position[0], position[1], position[2]).normalize();
    //   scene.add(light);
    // });

    // Camera...
    var fov    = 45,
        aspect = containerWidth / containerHeight,
        near   = 1,
        far    = 10000;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.z = 300;

    scene.add(camera);

    controls = new THREE.TrackballControls( camera, renderer.domElement);
    controls.rotateSpeed = 1.0;
    controls.noZoom = false;
    controls.noPan = false;

    setSize(containerWidth, containerHeight);

    // Fix coordinates up if window is resized.
    window.addEventListener( 'resize', function() {
      setSize(window.innerWidth, window.innerHeight)
    }, false );
    window.addEventListener( 'keydown', keydown, false );

  }

  function animate() {
    requestAnimationFrame( animate);
    render();

  }

  function render() {

    var time = Date.now() * 0.0005;

    for ( var i = 0; i < scene.children.length; i ++ ) {

      var object = scene.children[ i ];

      if(autoRotate) {
        if ( object instanceof THREE.Object3D ) {
          object.rotation.y = object.rotation.y + 0.015;
        }
      }
    }

    if( guiParameters && gr ) {
      if (guiParameters.updateGcodeIndex)
      {
        var layerNum = gr.setIndex(guiParameters.gcodeIndex);
        guiParameters.updateGcodeIndex = false;

        if (layerNum !== undefined)
          guiParameters.layerIndex = layerNum;

        guiParameters.layerHeight = 0;
      } else if (guiParameters.updateLayer) {
        var vertexIndex = gr.setLayer(guiParameters.layerIndex);   
        guiParameters.updateLayer = false;

        if (vertexIndex !== undefined)
          guiParameters.gcodeIndex = vertexIndex;
        
        guiParameters.layerHeight = 0;
      }
      else if (guiParameters.updateLayerHeight) {
        gr.setLayerHeight(guiParameters.layerHeight);

        guiParameters.gcodeIndex = 0;
        guiParameters.layerIndex = 0;
      }
    }

    controls.update();

    renderer.clear();
    renderer.render(scene, camera);

  }

  function setSize(width, height) {

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);

    controls.handleResize();

  }

  function keydown(event) {

    if( event.keyCode == 32 ) { // 32 == spacebar
      autoRotate = !autoRotate;
    }
  }

  return scene;
}
