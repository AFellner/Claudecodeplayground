// Oberfläche: Farbeingabe, Prüfung, Lösung abspielen.
(function () {
  'use strict';

  var M = window.CubeModel;
  var COLOR_ORDER = ['W', 'Y', 'G', 'B', 'R', 'O'];
  var SPEEDS = [800, 500, 320, 190, 100];
  var FACE_NAMES = { U: 'obere', D: 'untere', R: 'rechte', L: 'linke', F: 'vordere', B: 'hintere' };
  var ROTATION_LIKE = { x: 'R', y: 'U', z: 'F' };

  var $ = function (id) { return document.getElementById(id); };
  var inputState = M.solvedState();
  var selectedColor = 'W';
  var kociembaReady = false;

  var player = { steps: [], states: [], phases: [], index: 0, playing: false, busy: false };

  var view = new window.CubeView($('cube'), { onStickerClick: onStickerClick });

  // ---------- Eingabe ----------

  function buildPalette() {
    var pal = $('palette');
    COLOR_ORDER.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'swatch';
      b.dataset.color = c;
      b.innerHTML = '<span class="chip" style="background:' + M.COLORS[c].hex + '"></span>' +
        '<span>' + M.COLORS[c].name + '</span><span class="count"></span>';
      b.addEventListener('click', function () { selectedColor = c; updatePalette(); });
      pal.appendChild(b);
    });
    updatePalette();
  }

  function updatePalette() {
    var counts = {};
    inputState.forEach(function (c) { if (c) counts[c] = (counts[c] || 0) + 1; });
    Array.prototype.forEach.call(document.querySelectorAll('.swatch'), function (b) {
      var c = b.dataset.color, n = counts[c] || 0;
      b.classList.toggle('selected', c === selectedColor);
      var el = b.querySelector('.count');
      el.textContent = n + '/9';
      el.className = 'count' + (n === 9 ? ' full' : n > 9 ? ' over' : '');
    });
  }

  function onStickerClick(index) {
    if (!$('solution-panel').classList.contains('hidden')) return;
    if (index % 9 === 4) {
      showMessages([{ type: 'error', text: 'Die Mittelsteine sind fest: Weiß oben, Grün vorne, Rot rechts.' }]);
      return;
    }
    inputState[index] = inputState[index] === selectedColor ? null : selectedColor;
    view.setHighlight([]);
    view.setState(inputState);
    updatePalette();
    showMessages([]);
  }

  function showMessages(list) {
    var box = $('messages');
    box.innerHTML = '';
    list.forEach(function (m) {
      var d = document.createElement('div');
      d.className = 'msg ' + m.type;
      if (m.items) {
        d.textContent = m.text;
        var ul = document.createElement('ul');
        m.items.forEach(function (t) {
          var li = document.createElement('li');
          li.textContent = t;
          ul.appendChild(li);
        });
        d.appendChild(ul);
      } else {
        d.textContent = m.text;
      }
      box.appendChild(d);
    });
    if (list.length && box.scrollIntoView) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  $('btn-solved').addEventListener('click', function () {
    inputState = M.solvedState();
    view.setHighlight([]);
    view.setState(inputState);
    updatePalette();
    showMessages([]);
  });

  $('btn-clear').addEventListener('click', function () {
    inputState = inputState.map(function (c, i) { return i % 9 === 4 ? c : null; });
    view.setHighlight([]);
    view.setState(inputState);
    updatePalette();
    showMessages([]);
  });

  $('btn-solve').addEventListener('click', function () {
    var result = M.validate(inputState);
    view.setHighlight(result.highlight);
    if (!result.ok) {
      showMessages([{ type: 'error', text: 'Diese Eingabe ist nicht möglich:', items: result.errors }]);
      return;
    }
    if (M.isSolved(inputState)) {
      showMessages([{ type: 'ok', text: 'Der Würfel ist bereits gelöst. Gib die Farben deines verdrehten Würfels ein.' }]);
      return;
    }
    var method = document.querySelector('input[name=method]:checked').value;
    if (method === 'short') {
      if (!kociembaReady) {
        showMessages([{ type: 'ok', text: 'Eingabe ist gültig. Lösungstabellen werden einmalig berechnet …' }]);
        $('btn-solve').disabled = true;
        setTimeout(function () {
          window.Cube.initSolver();
          kociembaReady = true;
          $('btn-solve').disabled = false;
          startSolution(shortSolution());
        }, 50);
        return;
      }
      startSolution(shortSolution());
    } else {
      startSolution(window.BeginnerSolver.solve(inputState).phases);
    }
  });

  function shortSolution() {
    var str = window.Cube.fromString(M.toFaceletString(inputState)).solve();
    var moves = str.trim() ? str.trim().split(/\s+/) : [];
    return [{
      name: 'Kürzeste Lösung',
      description: 'Diese Zugfolge wurde vom Kociemba-Algorithmus berechnet. Sie ist sehr kurz, folgt aber keinem für Menschen gedachten Schema. Halte Weiß oben und Grün vorne.',
      moves: moves
    }];
  }

  // ---------- Lösung abspielen ----------

  function startSolution(phases) {
    showMessages([]);
    player.phases = phases;
    player.steps = [];
    phases.forEach(function (p, pi) {
      p.start = player.steps.length;
      p.moves.forEach(function (m, mi) { player.steps.push({ move: m, phase: pi, inPhase: mi }); });
    });
    player.states = [inputState.slice()];
    player.steps.forEach(function (s, i) { player.states.push(M.applyMove(player.states[i], s.move)); });
    player.index = 0;
    player.playing = false;

    var list = $('phase-list');
    list.innerHTML = '';
    phases.forEach(function (p, pi) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.innerHTML = p.name + ' <small>(' + (p.moves.length === 1 ? '1 Zug' : p.moves.length ? p.moves.length + ' Züge' : 'schon erledigt') + ')</small>';
      b.addEventListener('click', function () { jumpTo(p.start); });
      li.appendChild(b);
      list.appendChild(li);
    });

    $('input-panel').classList.add('hidden');
    $('solution-panel').classList.remove('hidden');
    view.setHighlight([]);
    view.setState(player.states[0]);
    render();
  }

  function currentPhaseIndex() {
    var i = player.index;
    if (i >= player.steps.length) return player.phases.length - 1;
    return player.steps[i].phase;
  }

  function describeMove(token) {
    var m = M.parseMove(token);
    var dir = m.turns === 2 ? 'halbe Drehung (180°)' : m.turns === 3 ? 'gegen den Uhrzeigersinn' : 'im Uhrzeigersinn';
    if (ROTATION_LIKE[m.base]) {
      return 'Ganzen Würfel drehen wie ' + ROTATION_LIKE[m.base] + ' – ' + dir;
    }
    return 'Die ' + FACE_NAMES[m.base] + ' Seite ' + dir + ' drehen (von dieser Seite aus gesehen)';
  }

  function render() {
    var n = player.steps.length, i = player.index;
    var pi = currentPhaseIndex();
    var phase = player.phases[pi];
    $('progress').textContent = i >= n
      ? 'Fertig! Gelöst in ' + n + ' Zügen.'
      : 'Zug ' + (i + 1) + ' von ' + n + ' · Phase ' + (pi + 1) + ' von ' + player.phases.length;
    $('phase-name').textContent = phase.name;
    $('phase-desc').textContent = phase.description;

    var next = player.steps[i];
    $('current-move').textContent = next ? next.move : '✓';
    $('current-move-desc').textContent = next ? 'Nächster Zug: ' + describeMove(next.move) : 'Der Würfel ist gelöst.';

    var box = $('phase-moves');
    box.innerHTML = '';
    phase.moves.forEach(function (m, mi) {
      var s = document.createElement('span');
      s.textContent = m;
      var global = phase.start + mi;
      if (global < i) s.className = 'done';
      else if (global === i) s.className = 'now';
      box.appendChild(s);
    });
    var now = box.querySelector('.now');
    if (now) box.scrollTop = now.offsetTop - box.offsetTop - 30;

    Array.prototype.forEach.call($('phase-list').children, function (li, k) {
      var p = player.phases[k];
      li.classList.toggle('active', k === pi && i < n);
      li.classList.toggle('finished', i >= p.start + p.moves.length && (k !== pi || i >= n));
    });

    $('btn-play').textContent = player.playing ? '⏸' : '▶';
    $('btn-prev').disabled = $('btn-first').disabled = i === 0;
    $('btn-next').disabled = $('btn-last').disabled = i >= n;
    $('btn-play').disabled = i >= n && !player.playing;
  }

  function duration() { return SPEEDS[$('speed').value - 1]; }

  function stepForward() {
    if (player.busy || player.index >= player.steps.length) return Promise.resolve(false);
    player.busy = true;
    var move = player.steps[player.index].move;
    return view.animateMove(move, duration()).then(function () {
      player.index++;
      player.busy = false;
      render();
      return true;
    });
  }

  function stepBack() {
    if (player.busy || player.index === 0) return Promise.resolve(false);
    player.busy = true;
    player.index--;
    render();
    return view.animateMove(M.invertMove(player.steps[player.index].move), duration()).then(function () {
      player.busy = false;
      render();
      return true;
    });
  }

  function jumpTo(index) {
    player.playing = false;
    if (player.busy) return;
    player.index = index;
    view.setState(player.states[index]);
    render();
  }

  function play() {
    if (player.index >= player.steps.length) player.index = player.steps.length;
    player.playing = true;
    render();
    (function loop() {
      if (!player.playing) return;
      if (player.index >= player.steps.length) { player.playing = false; render(); return; }
      stepForward().then(function () { setTimeout(loop, duration() * 0.25); });
    })();
  }

  $('btn-play').addEventListener('click', function () {
    if (player.playing) { player.playing = false; render(); } else play();
  });
  $('btn-next').addEventListener('click', function () { player.playing = false; stepForward(); render(); });
  $('btn-prev').addEventListener('click', function () { player.playing = false; stepBack(); });
  $('btn-first').addEventListener('click', function () { jumpTo(0); });
  $('btn-last').addEventListener('click', function () { jumpTo(player.steps.length); });
  $('btn-back').addEventListener('click', function () {
    player.playing = false;
    if (player.busy) return;
    $('solution-panel').classList.add('hidden');
    $('input-panel').classList.remove('hidden');
    view.setState(inputState);
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-view]'), function (b) {
    b.addEventListener('click', function () {
      var v = b.dataset.view;
      if (v === 'reset') { view._viewTarget = null; view.resetView(); }
      else if (v === 'left') view.turnView(-1, 0);
      else if (v === 'right') view.turnView(1, 0);
      else if (v === 'up') view.turnView(0, -1);
      else if (v === 'down') view.turnView(0, 1);
    });
  });

  document.addEventListener('keydown', function (ev) {
    if ($('solution-panel').classList.contains('hidden')) return;
    if (ev.key === 'ArrowRight') { player.playing = false; stepForward(); }
    else if (ev.key === 'ArrowLeft') { player.playing = false; stepBack(); }
    else if (ev.key === ' ') { ev.preventDefault(); $('btn-play').click(); }
  });

  // Optional: Zustand aus der URL übernehmen, z. B. #WWWWWWWWWRRR… (54 Farbbuchstaben).
  var fromHash = location.hash.replace('#', '').toUpperCase();
  if (/^[WYGBRO_]{54}$/.test(fromHash)) {
    inputState = fromHash.split('').map(function (c, i) {
      return i % 9 === 4 ? inputState[i] : (c === '_' ? null : c);
    });
  }

  buildPalette();
  view.setState(inputState);
})();
