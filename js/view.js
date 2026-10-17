// 3D-Darstellung mit Three.js: Würfel anzeigen, drehen, Felder anklicken, Züge animieren.
(function (root) {
  'use strict';

  var M = root.CubeModel;
  var EMPTY_COLOR = '#5a5f6b';

  function CubeView(container, options) {
    this.container = container;
    this.onStickerClick = options.onStickerClick || function () {};
    this.state = M.solvedState();
    this.highlight = {};
    this.animating = false;

    var scene = this.scene = new THREE.Scene();
    var camera = this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 11);

    var renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    var light = new THREE.DirectionalLight(0xffffff, 0.45);
    light.position.set(4, 6, 8);
    scene.add(light);

    this.root = new THREE.Group();
    scene.add(this.root);
    this.resetView();

    this._buildCubies();
    this._bindPointer();
    this._resize();
    var self = this;
    if (window.ResizeObserver) new ResizeObserver(function () { self._resize(); }).observe(container);
    else window.addEventListener('resize', function () { self._resize(); });

    (function loop(t) {
      self._tick(t);
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    })(0);
  }

  CubeView.prototype.resetView = function () {
    this.root.quaternion.setFromEuler(new THREE.Euler(0.5, -0.65, 0, 'XYZ'));
  };

  // Ganze Ansicht um 90° drehen (für Touch-Bedienung ohne Ziehen).
  CubeView.prototype.turnView = function (dx, dy) {
    var q = new THREE.Quaternion();
    if (dx) q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * Math.PI / 2);
    else q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * Math.PI / 2);
    this._viewTarget = q.multiply(this.root.quaternion.clone());
  };

  CubeView.prototype._buildCubies = function () {
    var self = this;
    var body = new THREE.BoxGeometry(0.96, 0.96, 0.96);
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    var stickerGeo = roundedSquare(0.84, 0.12);
    this.cubies = {};
    this.stickerMeshes = [];

    M.STICKERS.forEach(function (s) {
      var k = s.pos.join(',');
      var cubie = self.cubies[k];
      if (!cubie) {
        cubie = new THREE.Group();
        cubie.userData.home = new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]);
        cubie.position.copy(cubie.userData.home);
        cubie.add(new THREE.Mesh(body, bodyMat));
        self.root.add(cubie);
        self.cubies[k] = cubie;
      }
      var mat = new THREE.MeshLambertMaterial({ color: EMPTY_COLOR, side: THREE.DoubleSide });
      var mesh = new THREE.Mesh(stickerGeo, mat);
      var n = new THREE.Vector3(s.normal[0], s.normal[1], s.normal[2]);
      mesh.position.copy(n.clone().multiplyScalar(0.485));
      mesh.lookAt(n.clone().multiplyScalar(2));
      mesh.userData.index = s.index;
      cubie.add(mesh);
      self.stickerMeshes[s.index] = mesh;
    });
    // Innerer Würfel, damit man während Drehungen nicht hineinschaut.
    this.root.add(new THREE.Mesh(new THREE.BoxGeometry(2.9, 2.9, 2.9), bodyMat));
    this.setState(this.state);
  };

  function roundedSquare(size, radius) {
    var h = size / 2, r = radius, shape = new THREE.Shape();
    shape.moveTo(-h + r, -h);
    shape.lineTo(h - r, -h); shape.quadraticCurveTo(h, -h, h, -h + r);
    shape.lineTo(h, h - r); shape.quadraticCurveTo(h, h, h - r, h);
    shape.lineTo(-h + r, h); shape.quadraticCurveTo(-h, h, -h, h - r);
    shape.lineTo(-h, -h + r); shape.quadraticCurveTo(-h, -h, -h + r, -h);
    return new THREE.ShapeGeometry(shape);
  }

  CubeView.prototype.setState = function (state) {
    this.state = state.slice();
    for (var i = 0; i < 54; i++) {
      var c = state[i];
      this.stickerMeshes[i].material.color.set(c ? M.COLORS[c].hex : EMPTY_COLOR);
      this.stickerMeshes[i].material.emissive.set(0x000000);
    }
  };

  CubeView.prototype.setHighlight = function (indices) {
    var h = {};
    (indices || []).forEach(function (i) { h[i] = true; });
    this.highlight = h;
    if (!indices || !indices.length) {
      this.stickerMeshes.forEach(function (m) { m.material.emissive.set(0x000000); });
    }
  };

  CubeView.prototype._tick = function (t) {
    if (this._viewTarget) {
      this.root.quaternion.slerp(this._viewTarget, 0.18);
      if (this.root.quaternion.angleTo(this._viewTarget) < 0.002) {
        this.root.quaternion.copy(this._viewTarget);
        this._viewTarget = null;
      }
    }
    var keys = Object.keys(this.highlight);
    if (keys.length) {
      var pulse = 0.25 + 0.25 * Math.sin(t / 160);
      for (var i = 0; i < keys.length; i++) {
        this.stickerMeshes[keys[i]].material.emissive.setRGB(pulse, 0, pulse * 0.6);
      }
    }
    if (this._anim) this._stepAnimation(t);
  };

  // Spielt einen Zug animiert ab und färbt danach anhand des neuen Zustands neu ein.
  CubeView.prototype.animateMove = function (token, duration) {
    var self = this;
    return new Promise(function (resolve) {
      var mv = M.parseMove(token);
      var axis = new THREE.Vector3(mv.def.axis[0], mv.def.axis[1], mv.def.axis[2]);
      var pivot = new THREE.Group();
      self.root.add(pivot);
      Object.keys(self.cubies).forEach(function (k) {
        var c = self.cubies[k];
        var h = c.userData.home;
        if (M.inLayer(mv.def, [h.x, h.y, h.z])) pivot.add(c);
      });
      var angle = -(mv.turns === 3 ? -1 : mv.turns) * Math.PI / 2;
      self.animating = true;
      self._anim = {
        pivot: pivot, axis: axis, angle: angle, start: null,
        duration: Math.max(1, duration * (mv.turns === 2 ? 1.4 : 1)),
        done: function () {
          pivot.children.slice().forEach(function (c) {
            self.root.add(c);
            c.position.copy(c.userData.home);
            c.rotation.set(0, 0, 0);
          });
          self.root.remove(pivot);
          self.setState(M.applyMove(self.state, token));
          self.animating = false;
          resolve();
        }
      };
    });
  };

  CubeView.prototype._stepAnimation = function (t) {
    var a = this._anim;
    if (a.start === null) a.start = t;
    var p = Math.min(1, (t - a.start) / a.duration);
    var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    a.pivot.quaternion.setFromAxisAngle(a.axis, a.angle * e);
    if (p >= 1) {
      this._anim = null;
      a.done();
    }
  };

  CubeView.prototype._resize = function () {
    var w = this.container.clientWidth || 300, h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.position.z = w < h ? 11 * h / w * 0.85 : 11;
    this.camera.updateProjectionMatrix();
  };

  CubeView.prototype._bindPointer = function () {
    var self = this, el = this.renderer.domElement;
    var down = null, raycaster = new THREE.Raycaster();
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', function (ev) {
      down = { x: ev.clientX, y: ev.clientY, lastX: ev.clientX, lastY: ev.clientY, drag: false };
      el.setPointerCapture(ev.pointerId);
    });
    el.addEventListener('pointermove', function (ev) {
      if (!down) return;
      var dx = ev.clientX - down.lastX, dy = ev.clientY - down.lastY;
      if (!down.drag && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 6) down.drag = true;
      if (down.drag) {
        self._viewTarget = null;
        var q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.01);
        self.root.quaternion.premultiply(q);
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.01);
        self.root.quaternion.premultiply(q);
      }
      down.lastX = ev.clientX;
      down.lastY = ev.clientY;
    });
    el.addEventListener('pointerup', function (ev) {
      if (down && !down.drag) {
        var rect = el.getBoundingClientRect();
        var v = new THREE.Vector2(
          ((ev.clientX - rect.left) / rect.width) * 2 - 1,
          -((ev.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(v, self.camera);
        var hits = raycaster.intersectObjects(self.stickerMeshes, false);
        if (hits.length && !self.animating) self.onStickerClick(hits[0].object.userData.index);
      }
      down = null;
    });
    el.addEventListener('pointercancel', function () { down = null; });
  };

  root.CubeView = CubeView;
})(this);
