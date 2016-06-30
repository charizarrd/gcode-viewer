/*
  Based on https://github.com/grbl/grbl/blob/edge/gcode.c
 */

function GCodeParser() {
  this.model = new GCodeModel();
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

// Parses the next statement and leaves the counter on the first character following
// the statement. Returns 1 if there was a statements, 0 if end of string was reached
// or there was an error (check state.status_code).
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
  // value = parseFloat(word.slice(1));
  // if (isNaN(value)) {
  //   throw new Error('Bad number format: ' + value);
  // }

  return new GWord(letter, value, word);
};

GCodeParser.prototype.parseLine = function(line) {

  var self = this,
      words,
      i = 0,
      l = 0,
      pLine = new GCode(),
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
      pLine.words.push(pWord);
    }
    catch(e) {
      console.log(e.message);
    }

    // var message = words[i] + " code: " + pWord.letter + " val: " + pWord.value + " group: ";
    // console.log(message);
  }
  return pLine;
};

GCodeParser.prototype.parse = function(gcode) {
  var lines = gcode.split('\n'),
      i = 0,
      l = lines.length,
      self = this,
      lineCode,
      current = new GCode();
  for ( ; i < l; i++) {
    // self.model.codes.push(self.parseLine(lines[i]));

    lineCode = self.parseLine(lines[i]);
    // Trying to auto-group words across multiple lines and split single lines
    lineCode.words.forEach(function(word) {
      switch(word.letter) {
        // Detect new code group, add current group to model & start a new group
        case 'G': case 'M': case 'T':
          if(current.words.length > 0) {
            current.cmd = current.words[0].letter+current.words[0].value;
            self.model.codes.push(current);
            current = new GCode();
          }
          break;
      }
      current.words.push(word);
    });
  }
  self.model.codes.push(current);
  return self.model;
};
