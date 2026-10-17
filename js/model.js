// Würfelmodell: 54 Felder (Facelets) in der Reihenfolge U R F D L B,
// je Seite zeilenweise 0..8 – identisch zur Kociemba-Notation.
(function (root) {
  'use strict';

  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  var U = 0, R = 1, F = 2, D = 3, L = 4, B = 5;

  var COLORS = {
    W: { name: 'Weiß', hex: '#f4f4f4' },
    Y: { name: 'Gelb', hex: '#ffd500' },
    G: { name: 'Grün', hex: '#009b48' },
    B: { name: 'Blau', hex: '#0046ad' },
    R: { name: 'Rot', hex: '#c41e3a' },
    O: { name: 'Orange', hex: '#ff5800' }
  };
  // Westliches Farbschema, Weiß oben, Grün vorne.
  var SCHEME = { U: 'W', R: 'R', F: 'G', D: 'Y', L: 'O', B: 'B' };

  var CORNER_FACELETS = [
    [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
    [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]
  ];
  var CORNER_FACES = [
    [U, R, F], [U, F, L], [U, L, B], [U, B, R],
    [D, F, R], [D, L, F], [D, B, L], [D, R, B]
  ];
  var EDGE_FACELETS = [
    [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
    [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14]
  ];
  var EDGE_FACES = [
    [U, R], [U, F], [U, L], [U, B], [D, R], [D, F],
    [D, L], [D, B], [F, R], [F, L], [B, L], [B, R]
  ];

  // Räumliche Lage jedes Feldes: x nach rechts, y nach oben, z nach vorne.
  function faceletGeometry(face, r, c) {
    switch (face) {
      case U: return { pos: [c - 1, 1, r - 1], normal: [0, 1, 0] };
      case R: return { pos: [1, 1 - r, 1 - c], normal: [1, 0, 0] };
      case F: return { pos: [c - 1, 1 - r, 1], normal: [0, 0, 1] };
      case D: return { pos: [c - 1, -1, 1 - r], normal: [0, -1, 0] };
      case L: return { pos: [-1, 1 - r, c - 1], normal: [-1, 0, 0] };
      case B: return { pos: [1 - c, 1 - r, -1], normal: [0, 0, -1] };
    }
  }

  var STICKERS = [];
  var lookup = {};
  function key(p, n) { return p.join(',') + '|' + n.join(','); }
  for (var f = 0; f < 6; f++) {
    for (var i = 0; i < 9; i++) {
      var g = faceletGeometry(f, Math.floor(i / 3), i % 3);
      var s = { index: f * 9 + i, face: f, pos: g.pos, normal: g.normal };
      STICKERS.push(s);
      lookup[key(g.pos, g.normal)] = s.index;
    }
  }

  // Dreht v um die Achse a um 90° im Uhrzeigersinn (von a aus gesehen).
  function rotate(v, a) {
    var cx = a[1] * v[2] - a[2] * v[1];
    var cy = a[2] * v[0] - a[0] * v[2];
    var cz = a[0] * v[1] - a[1] * v[0];
    var d = a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
    return [-cx + a[0] * d, -cy + a[1] * d, -cz + a[2] * d];
  }

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  // Achse und betroffene Ebene je Grunddrehung.
  var MOVE_DEFS = {
    U: { axis: [0, 1, 0], layer: true },
    D: { axis: [0, -1, 0], layer: true },
    R: { axis: [1, 0, 0], layer: true },
    L: { axis: [-1, 0, 0], layer: true },
    F: { axis: [0, 0, 1], layer: true },
    B: { axis: [0, 0, -1], layer: true },
    x: { axis: [1, 0, 0], layer: false },
    y: { axis: [0, 1, 0], layer: false },
    z: { axis: [0, 0, 1], layer: false }
  };

  function inLayer(def, pos) { return !def.layer || dot(pos, def.axis) > 0.5; }

  function quarterPerm(def) {
    var perm = new Array(54);
    STICKERS.forEach(function (s) {
      if (inLayer(def, s.pos)) {
        perm[s.index] = lookup[key(rotate(s.pos, def.axis), rotate(s.normal, def.axis))];
      } else {
        perm[s.index] = s.index;
      }
    });
    return perm;
  }

  function composePerm(p, q) { // erst p, dann q
    return p.map(function (t) { return q[t]; });
  }

  var PERMS = {};
  Object.keys(MOVE_DEFS).forEach(function (m) {
    var p1 = quarterPerm(MOVE_DEFS[m]);
    var p2 = composePerm(p1, p1);
    PERMS[m] = p1;
    PERMS[m + '2'] = p2;
    PERMS[m + "'"] = composePerm(p2, p1);
  });

  function parseMove(token) {
    var base = token[0];
    var suffix = token.slice(1);
    var turns = suffix === '2' ? 2 : suffix === "'" ? 3 : 1;
    return { base: base, turns: turns, def: MOVE_DEFS[base] };
  }

  function applyMove(state, token) {
    var perm = PERMS[token];
    if (!perm) throw new Error('Unbekannter Zug: ' + token);
    var out = new Array(54);
    for (var i = 0; i < 54; i++) out[perm[i]] = state[i];
    return out;
  }

  function applyMoves(state, tokens) {
    return tokens.reduce(applyMove, state);
  }

  function invertMove(token) {
    if (token.length > 1 && token[1] === '2') return token;
    if (token.length > 1 && token[1] === "'") return token[0];
    return token + "'";
  }

  function invertMoves(tokens) { return tokens.slice().reverse().map(invertMove); }

  function tokenFor(base, turns) {
    turns = ((turns % 4) + 4) % 4;
    if (turns === 0) return null;
    return base + (turns === 1 ? '' : turns === 2 ? '2' : "'");
  }

  // Fasst direkt aufeinanderfolgende Drehungen derselben Seite zusammen.
  function simplify(tokens) {
    var out = [];
    tokens.forEach(function (t) {
      var m = parseMove(t);
      var last = out[out.length - 1];
      if (last && last[0] === m.base) {
        out.pop();
        var merged = tokenFor(m.base, parseMove(last).turns + m.turns);
        if (merged) out.push(merged);
      } else {
        out.push(t);
      }
    });
    return out;
  }

  function solvedState() {
    var s = [];
    FACES.forEach(function (f) { for (var i = 0; i < 9; i++) s.push(SCHEME[f]); });
    return s;
  }

  function isSolved(state) {
    for (var f = 0; f < 6; f++) {
      for (var i = 0; i < 9; i++) {
        if (state[f * 9 + i] !== state[f * 9 + 4]) return false;
      }
    }
    return true;
  }

  function colorName(c) { return COLORS[c] ? COLORS[c].name : '?'; }
  function pieceName(colors) { return colors.map(colorName).join('-'); }

  function permParity(p) {
    var parity = 0;
    for (var i = 0; i < p.length; i++) {
      for (var j = i + 1; j < p.length; j++) if (p[i] > p[j]) parity ^= 1;
    }
    return parity;
  }

  // Prüft, ob die eingegebenen Farben einen echten, lösbaren Würfel ergeben.
  function validate(state) {
    var errors = [];
    var highlight = {};
    function mark(list) { list.forEach(function (i) { highlight[i] = true; }); }
    function result() {
      return { ok: errors.length === 0, errors: errors, highlight: Object.keys(highlight).map(Number) };
    }

    var empty = [];
    state.forEach(function (c, i) { if (!c) empty.push(i); });
    if (empty.length) {
      errors.push(empty.length === 1
        ? 'Ein Feld ist noch nicht gefärbt.'
        : empty.length + ' Felder sind noch nicht gefärbt.');
      mark(empty);
      return result();
    }

    Object.keys(COLORS).forEach(function (c) {
      var n = state.filter(function (x) { return x === c; }).length;
      if (n !== 9) {
        errors.push(colorName(c) + ' kommt ' + n + '× vor, es müssen genau 9 sein.');
        if (n > 9) state.forEach(function (x, i) { if (x === c && i % 9 !== 4) highlight[i] = true; });
      }
    });
    if (errors.length) return result();

    var faceOfColor = {};
    for (var f = 0; f < 6; f++) faceOfColor[state[f * 9 + 4]] = f;
    if (Object.keys(faceOfColor).length !== 6) {
      errors.push('Die sechs Mittelsteine müssen sechs verschiedene Farben haben.');
      return result();
    }
    function faceAt(i) { return faceOfColor[state[i]]; }
    function centerColor(face) { return state[face * 9 + 4]; }

    var cp = [], co = [], ep = [], eo = [];
    var cornerSeen = {}, edgeSeen = {};

    for (var i = 0; i < 8; i++) {
      var fl = CORNER_FACELETS[i];
      var colors = fl.map(function (x) { return state[x]; });
      var faces = fl.map(faceAt);
      var ori = -1;
      for (var o = 0; o < 3; o++) if (faces[o] === U || faces[o] === D) { ori = o; break; }
      var found = -1;
      if (ori >= 0) {
        var f1 = faces[(ori + 1) % 3], f2 = faces[(ori + 2) % 3];
        for (var j = 0; j < 8; j++) {
          if (CORNER_FACES[j][1] === f1 && CORNER_FACES[j][2] === f2 && CORNER_FACES[j][0] === faces[ori]) found = j;
        }
      }
      if (found < 0) {
        var mirrored = false;
        if (ori >= 0) {
          var g1 = faces[(ori + 2) % 3], g2 = faces[(ori + 1) % 3];
          for (var k = 0; k < 8; k++) {
            if (CORNER_FACES[k][0] === faces[ori] && CORNER_FACES[k][1] === g1 && CORNER_FACES[k][2] === g2) mirrored = true;
          }
        }
        errors.push('Die Ecke ' + pieceName(colors) + (mirrored
          ? ' ist spiegelverkehrt – zwei ihrer Farben sind vertauscht.'
          : ' gibt es auf einem echten Würfel nicht.'));
        mark(fl);
        continue;
      }
      if (cornerSeen[found] !== undefined) {
        errors.push('Die Ecke ' + pieceName(CORNER_FACES[found].map(centerColor)) + ' kommt doppelt vor.');
        mark(fl);
        mark(CORNER_FACELETS[cornerSeen[found]]);
      }
      cornerSeen[found] = i;
      cp[i] = found;
      co[i] = ori;
    }

    for (var e = 0; e < 12; e++) {
      var efl = EDGE_FACELETS[e];
      var ecolors = efl.map(function (x) { return state[x]; });
      var a = faceAt(efl[0]), b = faceAt(efl[1]);
      var efound = -1, eori = 0;
      for (var m = 0; m < 12; m++) {
        if (EDGE_FACES[m][0] === a && EDGE_FACES[m][1] === b) { efound = m; eori = 0; }
        if (EDGE_FACES[m][0] === b && EDGE_FACES[m][1] === a) { efound = m; eori = 1; }
      }
      if (efound < 0) {
        errors.push('Die Kante ' + pieceName(ecolors) + (a === b
          ? ' hat zweimal dieselbe Farbe.'
          : ' gibt es nicht – diese Farben liegen auf gegenüberliegenden Seiten.'));
        mark(efl);
        continue;
      }
      if (edgeSeen[efound] !== undefined) {
        errors.push('Die Kante ' + pieceName(EDGE_FACES[efound].map(centerColor)) + ' kommt doppelt vor.');
        mark(efl);
        mark(EDGE_FACELETS[edgeSeen[efound]]);
      }
      edgeSeen[efound] = e;
      ep[e] = efound;
      eo[e] = eori;
    }

    if (errors.length) return result();

    var twist = co.reduce(function (s, x) { return s + x; }, 0) % 3;
    if (twist !== 0) {
      errors.push('Eine Ecke ist verdreht (' + (twist === 1 ? 'im' : 'gegen den') +
        ' Uhrzeigersinn). Das passiert z. B., wenn eine Ecke falsch eingesetzt wurde – prüfe die Farben der Ecken.');
    }
    var flip = eo.reduce(function (s, x) { return s + x; }, 0) % 2;
    if (flip !== 0) {
      errors.push('Eine Kante ist gekippt (ihre beiden Farben sind vertauscht). Prüfe die Farben der Kanten.');
    }
    if (permParity(cp) !== permParity(ep)) {
      errors.push('Zwei Teile sind vertauscht (Paritätsfehler). Prüfe, ob zwei Kanten oder zwei Ecken die Plätze getauscht haben.');
    }
    return result();
  }

  function toFaceletString(state) {
    var faceOfColor = {};
    for (var f = 0; f < 6; f++) faceOfColor[state[f * 9 + 4]] = FACES[f];
    return state.map(function (c) { return faceOfColor[c]; }).join('');
  }

  var Model = {
    FACES: FACES, COLORS: COLORS, SCHEME: SCHEME,
    CORNER_FACELETS: CORNER_FACELETS, EDGE_FACELETS: EDGE_FACELETS,
    STICKERS: STICKERS, MOVE_DEFS: MOVE_DEFS, PERMS: PERMS,
    parseMove: parseMove, applyMove: applyMove, applyMoves: applyMoves,
    invertMove: invertMove, invertMoves: invertMoves, simplify: simplify,
    solvedState: solvedState, isSolved: isSolved, validate: validate,
    toFaceletString: toFaceletString, inLayer: inLayer, colorName: colorName
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Model;
  else root.CubeModel = Model;
})(this);
