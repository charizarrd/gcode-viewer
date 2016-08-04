/*
  Based on https://github.com/grbl/grbl/blob/edge/gcode.c
 */

function GCodeParser() {
}

GCodeParser.prototype.parseComments = function(line) {
  var self = this,
      comments = [];

  function addComments(matches) {
    if( matches ) {
      matches.forEach( function(comment) {
        comments.push(comment);
      });
    }
  }

  // Full line parenthesis style comments
  // addComments(line.match(/\((.*)\)$/g, ''));

  // Inline parenthesis style comments
  // addComments(line.match(/\((.*?)\)/g, ''));

  // Semicolon style comments
  addComments(line.match(/;(.*$)/g, ''));

  return comments;
}


GCodeParser.prototype.parseConfig = function(comment) {
  var self = this,
      config = {};

  var matches = comment.match(/; Config: /g);
  if (matches) {
    matches.forEach(function(match) {
      comment = comment.replace(match, '');
    });

    var json = JSON.parse(comment);

    config.filamentDiameter = json.tools[0].filament_diameter;
    config.extrusionWidth = json.tools[0].extrusion.width;
  }

  return config;
}


GCodeParser.prototype.parseWord = function(word)
{
  if (!word.length) {
    throw new Error('Bad word format: "' + word + '"');
  }

  var letter = word[0].toUpperCase(),
      value;

  if((letter < 'A') || (letter > 'Z')) {
    throw new Error('Unexpected command letter: ' + letter + ' from word: ' + word);
  }

  value = word.slice(1);

  return new GWord(letter, value, word);
};

GCodeParser.prototype.parseLine = function(line) {
  var self = this,
      words,
      i = 0,
      l = 0,
      parsedWords = [],
      pWord;

  var comments = self.parseComments(line);
  comments.forEach( function(comment) {
    // console.log("Removing comment: " +  comment);
    line = line.replace(comment, '');
  });

  words = line.trim().split(' ');
  l = words.length;

  for ( ; i < l; i++) {

    if(!words[i] || words[i].length <= 0) {
      // console.log('skipping blank word');
      continue;
    }

    // console.log('parsing word: "' + words[i] + '"');
    try {
      pWord = this.parseWord(words[i]);
      parsedWords.push(pWord);
    }
    catch(e) {
      console.log(e.message);
    }

    // var message = words[i] + " code: " + pWord.letter + " val: " + pWord.value + " group: ";
    // console.log(message);
  }
  return {
    words: parsedWords,
    comments: comments
  };
};


// this isn't used but leaving just in case
GCodeParser.prototype.parse = function(gcode) {
  var gcodes = [];
  var lines = gcode.split('\n'),
      i = 0,
      l = lines.length,
      self = this,
      words,
      current = new GCode();
  for ( ; i < l; i++) {
    // self.model.codes.push(self.parseLine(lines[i]));

    current = new GCode();
    words = self.parseLine(lines[i]);
    if (words.length > 0) {
      switch(words[0].raw) {
        case "G0": case "G1":
        case "G2": case "G3":    
        case "G90": case "G91":
        case "T0":    
        case "T1":
        case "M42":   
        case "M380":   
        case "M381":
          var params = {};
          words.forEach(function(word, i) {
            if (i === 0) {
              current.cmd = word.raw;
            } else {
              params[word.letter.toLowerCase()] = parseFloat(word.value);
            }
          });
          current.params = params;
          gcodes.push(current);
          break;
      }
    }
  }
  return gcodes;
};
