function VisualPath() {
  this.layers = [];
  this.tubeVertices = [];

  this.visibleLayerRangeStart = 0;
  this.visibleLayerRangeEnd = 0;
  this.visibleGcodeIndexStart = 0;
  this.visibleGcodeIndexEnd = 0;
    
  this.visibleTubeVertexRanges = [];

  this.meshDataChanged = true;
  this.material = null;
}
