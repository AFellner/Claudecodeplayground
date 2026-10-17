// Löser nach der Anfängermethode (Schicht für Schicht).
// Jede Phase liefert eine Zugfolge und eine kurze Erklärung.
(function (root) {
  'use strict';

  var M = (typeof module !== 'undefined' && module.exports) ? require('./model.js') : root.CubeModel;

  var CF = M.CORNER_FACELETS, EF = M.EDGE_FACELETS;
  // Seitenflächen im Uhrzeigersinn von oben gesehen und die jeweils rechte Nachbarseite.
  var RIGHT_OF = { F: 'R', R: 'B', B: 'L', L: 'F' };
  var LEFT_OF = { F: 'L', L: 'B', B: 'R', R: 'F' };
  var ALL_MOVES = [];
  'URFDLB'.split('').forEach(function (f) { ALL_MOVES.push(f, f + "'", f + '2'); });
  var OPPOSITE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

  function pieceSolved(state, facelets) {
    for (var i = 0; i < facelets.length; i++) {
      var x = facelets[i];
      if (state[x] !== state[x - (x % 9) + 4]) return false;
    }
    return true;
  }

  function allSolved(state, pieces) {
    for (var i = 0; i < pieces.length; i++) if (!pieceSolved(state, pieces[i])) return false;
    return true;
  }

  // Iterative Tiefensuche über "Makros" (Einzelzüge oder ganze Algorithmen).
  function searchMacros(state, macros, goal, maxDepth) {
    if (goal(state)) return [];
    for (var depth = 1; depth <= maxDepth; depth++) {
      var path = [];
      var found = (function dfs(s, d, last) {
        for (var i = 0; i < macros.length; i++) {
          var mac = macros[i];
          if (last && mac.group && mac.group === last.group) continue;
          var next = M.applyMoves(s, mac.moves);
          path.push(mac);
          if (d === 1 ? goal(next) : dfs(next, d - 1, mac)) return true;
          path.pop();
        }
        return false;
      })(state, depth, null);
      if (found) {
        var moves = [];
        path.forEach(function (m) { moves = moves.concat(m.moves); });
        return moves;
      }
    }
    return null;
  }

  // Schnelle Suche nach Einzelzügen, die nur die Lage bestimmter Felder verfolgt.
  function searchTracked(sources, targets, maxDepth) {
    var n = sources.length;
    function done(pos) {
      for (var i = 0; i < n; i++) if (pos[i] !== targets[i]) return false;
      return true;
    }
    if (done(sources)) return [];
    for (var depth = 1; depth <= maxDepth; depth++) {
      var path = [];
      var ok = (function dfs(pos, d, lastFace) {
        for (var i = 0; i < ALL_MOVES.length; i++) {
          var mv = ALL_MOVES[i], face = mv[0];
          if (face === lastFace) continue;
          if (lastFace && OPPOSITE[face] === lastFace && face < lastFace) continue;
          var perm = M.PERMS[mv];
          var next = new Array(n);
          for (var k = 0; k < n; k++) next[k] = perm[pos[k]];
          path.push(mv);
          if (d === 1 ? done(next) : dfs(next, d - 1, face)) return true;
          path.pop();
        }
        return false;
      })(sources, depth, null);
      if (ok) return path;
    }
    return null;
  }

  function center(state, face) { return state['URFDLB'.indexOf(face) * 9 + 4]; }

  function findEdge(state, c1, c2) {
    for (var i = 0; i < 12; i++) {
      var a = state[EF[i][0]], b = state[EF[i][1]];
      if (a === c1 && b === c2) return [EF[i][0], EF[i][1]];
      if (a === c2 && b === c1) return [EF[i][1], EF[i][0]];
    }
    return null;
  }

  function findCorner(state, colors) {
    for (var i = 0; i < 8; i++) {
      var cs = CF[i].map(function (x) { return state[x]; });
      if (colors.every(function (c) { return cs.indexOf(c) >= 0; })) return i;
    }
    return -1;
  }

  // Stellen der unteren Schicht: Ecke, Kante, Vorderseite, rechte Seite, darüberliegende U-Ecke.
  var SLOTS = [
    { corner: 4, edge: 8, front: 'F', right: 'R', above: 0 },
    { corner: 7, edge: 11, front: 'R', right: 'B', above: 3 },
    { corner: 6, edge: 10, front: 'B', right: 'L', above: 2 },
    { corner: 5, edge: 9, front: 'L', right: 'F', above: 1 }
  ];
  var CROSS_EDGES = [5, 4, 7, 6]; // DF, DR, DB, DL
  var CROSS_SIDE = { 5: 'F', 4: 'R', 7: 'B', 6: 'L' };

  function sexy(right) { return [right, 'U', right + "'", "U'"]; }

  function solve(input) {
    var state = input.slice();
    var phases = [];
    function phase(name, description, moves) {
      moves = M.simplify(moves);
      state = M.applyMoves(state, moves);
      phases.push({ name: name, description: description, moves: moves });
    }

    // 0) Würfel drehen, damit Weiß unten liegt.
    phase('Würfel umdrehen',
      'Drehe den ganzen Würfel um die Vorderseite, sodass Weiß unten und Gelb oben liegt. Grün bleibt vorne.',
      ['z2']);

    var white = center(state, 'D');
    var yellow = center(state, 'U');

    // 1) Weißes Kreuz.
    var crossMoves = [];
    var solvedEdges = [];
    var remaining = CROSS_EDGES.slice();
    while (remaining.length) {
      var best = null;
      remaining.forEach(function (pos) {
        var sideFacelet = EF[pos][1];
        var target = [EF[pos][0], sideFacelet];
        var sources = [], targets = [];
        solvedEdges.forEach(function (p) {
          sources.push(EF[p][0], EF[p][1]);
          targets.push(EF[p][0], EF[p][1]);
        });
        var loc = findEdge(state, white, center(state, CROSS_SIDE[pos]));
        sources.push(loc[0], loc[1]);
        targets.push(target[0], target[1]);
        var sol = searchTracked(sources, targets, 8);
        if (sol && (!best || sol.length < best.moves.length)) best = { pos: pos, moves: sol };
      });
      state = M.applyMoves(state, best.moves);
      crossMoves = crossMoves.concat(best.moves);
      solvedEdges.push(best.pos);
      remaining.splice(remaining.indexOf(best.pos), 1);
    }
    state = M.applyMoves(state, M.invertMoves(crossMoves));
    phase('Weißes Kreuz',
      'Bringe die vier weißen Kanten nach unten, sodass ihre zweite Farbe zum Mittelstein der Seite passt.',
      crossMoves);

    var crossPieces = CROSS_EDGES.map(function (p) { return EF[p]; });

    // 2) Weiße Ecken.
    var cornerMoves = [];
    function doC(moves) { state = M.applyMoves(state, moves); cornerMoves = cornerMoves.concat(moves); }
    SLOTS.forEach(function (slot) {
      var colors = [white, center(state, slot.front), center(state, slot.right)];
      var pos = findCorner(state, colors);
      if (pos === slot.corner && pieceSolved(state, CF[pos])) return;
      if (pos >= 4) {
        var from = SLOTS.filter(function (s) { return s.corner === pos; })[0];
        doC(sexy(from.right));
        pos = findCorner(state, colors);
      }
      var k = (slot.above - pos + 4) % 4;
      if (k) doC([k === 1 ? 'U' : k === 2 ? 'U2' : "U'"]);
      for (var guard = 0; guard < 6 && !pieceSolved(state, CF[slot.corner]); guard++) doC(sexy(slot.right));
    });
    state = M.applyMoves(state, M.invertMoves(cornerMoves));
    phase('Weiße Ecken',
      'Stelle jede weiße Ecke über ihren Platz und wiederhole „R U R\' U\'“ (an der passenden Seite), bis sie richtig sitzt.',
      cornerMoves);

    var firstLayer = crossPieces.concat(SLOTS.map(function (s) { return CF[s.corner]; }));

    // 3) Mittlere Ebene.
    var uMacros = [
      { moves: ['U'], group: 'U' }, { moves: ["U'"], group: 'U' }, { moves: ['U2'], group: 'U' }
    ];
    var insertMacros = uMacros.slice();
    ['F', 'R', 'B', 'L'].forEach(function (f) {
      var r = RIGHT_OF[f], l = LEFT_OF[f];
      insertMacros.push({ moves: ['U', r, "U'", r + "'", "U'", f + "'", 'U', f] });
      insertMacros.push({ moves: ["U'", l + "'", 'U', l, 'U', f, "U'", f + "'"] });
    });
    var middleMoves = [];
    var done = firstLayer.slice();
    SLOTS.forEach(function (slot) {
      var need = done.concat([EF[slot.edge]]);
      var sol = searchMacros(state, insertMacros, function (s) { return allSolved(s, need); }, 4);
      state = M.applyMoves(state, sol);
      middleMoves = middleMoves.concat(sol);
      done = need;
    });
    state = M.applyMoves(state, M.invertMoves(middleMoves));
    phase('Mittlere Ebene',
      'Suche oben eine Kante ohne Gelb, drehe sie über ihre Farbe und setze sie mit „U R U\' R\' U\' F\' U F“ (rechts) bzw. spiegelbildlich (links) ein.',
      middleMoves);
    var f2l = done;

    // 4) Gelbes Kreuz.
    var crossMacros = uMacros.concat([{ moves: ['F', 'R', 'U', "R'", "U'", "F'"] }]);
    var topEdges = [1, 3, 5, 7];
    phase('Gelbes Kreuz',
      'Erzeuge oben ein gelbes Kreuz mit „F R U R\' U\' F\'“: aus Punkt wird Winkel, aus Winkel Linie, aus Linie Kreuz.',
      searchMacros(state, crossMacros, function (s) {
        return topEdges.every(function (i) { return s[i] === yellow; }) && allSolved(s, f2l);
      }, 6));

    // 5) Gelbe Kanten an die richtige Stelle.
    var suneMacros = uMacros.slice();
    ['F', 'R', 'B', 'L'].forEach(function (f) {
      var r = RIGHT_OF[f];
      suneMacros.push({ moves: [r, 'U', r + "'", 'U', r, 'U2', r + "'"] });
    });
    var lastEdges = [0, 1, 2, 3].map(function (i) { return EF[i]; });
    phase('Gelbe Kanten ausrichten',
      'Tausche die oberen Kanten mit „R U R\' U R U2 R\'“, bis jede Kante zu ihrer Seitenfarbe passt.',
      searchMacros(state, suneMacros, function (s) {
        return allSolved(s, f2l.concat(lastEdges));
      }, 6));
    var withEdges = f2l.concat(lastEdges);

    // 6) Gelbe Ecken an die richtige Stelle (Ausrichtung egal).
    function cornerPlaced(s, i) {
      var want = CF[i].map(function (x) { return s[x - (x % 9) + 4]; }).sort().join();
      var have = CF[i].map(function (x) { return s[x]; }).sort().join();
      return want === have;
    }
    var niklas = [];
    ['F', 'R', 'B', 'L'].forEach(function (f) {
      var r = RIGHT_OF[f], l = LEFT_OF[f];
      niklas.push({ moves: ['U', r, "U'", l + "'", 'U', r + "'", "U'", l] });
    });
    phase('Gelbe Ecken platzieren',
      'Vertausche drei Ecken mit „U R U\' L\' U R\' U\' L“, bis jede Ecke an ihrem Platz sitzt (verdreht ist noch erlaubt).',
      searchMacros(state, niklas, function (s) {
        return [0, 1, 2, 3].every(function (i) { return cornerPlaced(s, i); }) && allSolved(s, withEdges);
      }, 3));

    // 7) Gelbe Ecken drehen.
    var twistMoves = [];
    for (var c = 0; c < 4; c++) {
      for (var g = 0; g < 6 && state[8] !== yellow; g++) {
        state = M.applyMoves(state, ["R'", "D'", 'R', 'D']);
        twistMoves.push("R'", "D'", 'R', 'D');
      }
      state = M.applyMove(state, 'U');
      twistMoves.push('U');
    }
    state = M.applyMoves(state, M.invertMoves(twistMoves));
    phase('Gelbe Ecken drehen',
      'Halte die Ecke vorne rechts oben und wiederhole „R\' D\' R D“, bis Gelb oben ist. Dann nur U drehen und mit der nächsten Ecke weitermachen. Die untere Schicht ordnet sich am Ende von selbst.',
      twistMoves);

    return { phases: phases, solved: M.isSolved(state) };
  }

  var Beginner = { solve: solve };
  if (typeof module !== 'undefined' && module.exports) module.exports = Beginner;
  else root.BeginnerSolver = Beginner;
})(this);
