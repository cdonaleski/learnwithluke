/**
 * Interactive 3D Rubik's cube view (Three.js)
 * Mirrors sticker colors from cubeState — click facelets to paint.
 */
(function (global) {
  "use strict";

  var STICKER_HEX = {
    U: 0xffffff,
    D: 0xffd500,
    F: 0x009b48,
    B: 0x0046ad,
    L: 0xff5800,
    R: 0xb71234,
  };


  function stickerPosition(face, index) {
    var row = Math.floor(index / 3);
    var col = index % 3;
    var x = col - 1;
    var y = 1 - row;
    var z;

    switch (face) {
      case "U":
        return new THREE.Vector3(x, 1.52, row - 1);
      case "D":
        return new THREE.Vector3(x, -1.52, 1 - row);
      case "F":
        return new THREE.Vector3(x, y, 1.52);
      case "B":
        return new THREE.Vector3(1 - col, y, -1.52);
      case "R":
        // Looking at R from outside, the Front face is on your left,
        // so column 0 sits at z = +1.
        return new THREE.Vector3(1.52, y, 1 - col);
      case "L":
        // Looking at L from outside, the Back face is on your left,
        // so column 0 sits at z = -1.
        return new THREE.Vector3(-1.52, y, col - 1);
      default:
        return new THREE.Vector3(0, 0, 0);
    }
  }

  function stickerRotation(face) {
    switch (face) {
      case "U":
        return new THREE.Euler(-Math.PI / 2, 0, 0);
      case "D":
        return new THREE.Euler(Math.PI / 2, 0, 0);
      case "F":
        return new THREE.Euler(0, 0, 0);
      case "B":
        return new THREE.Euler(0, Math.PI, 0);
      case "R":
        return new THREE.Euler(0, Math.PI / 2, 0);
      case "L":
        return new THREE.Euler(0, -Math.PI / 2, 0);
      default:
        return new THREE.Euler(0, 0, 0);
    }
  }

  function Cube3DView(container, options) {
    this.container = container;
    this.onStickerClick = options && options.onStickerClick ? options.onStickerClick : null;
    this.stickerMeshes = {};
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this._animId = null;

    this._initScene();
    this._buildCube();
    this._bindEvents();
    this._animate();
  }

  Cube3DView.prototype._initScene = function () {
    var width = this.container.clientWidth || 320;
    var height = this.container.clientHeight || 320;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    this.camera.position.set(4.2, 3.4, 4.8);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.65;
    this.controls.enablePan = false;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 10;
    this.controls.target.set(0, 0, 0);

    var ambient = new THREE.AmbientLight(0xffffff, 0.72);
    this.scene.add(ambient);

    var key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(5, 8, 6);
    key.castShadow = true;
    this.scene.add(key);

    var fill = new THREE.DirectionalLight(0xbfd7ff, 0.45);
    fill.position.set(-4, 2, -3);
    this.scene.add(fill);

    var rim = new THREE.DirectionalLight(0xfff0cc, 0.35);
    rim.position.set(0, -3, 4);
    this.scene.add(rim);
  };

  Cube3DView.prototype._buildCube = function () {
    this.cubeGroup = new THREE.Group();
    this.scene.add(this.cubeGroup);

    var bodyGeo = new THREE.BoxGeometry(2.88, 2.88, 2.88);
    var bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1f,
      roughness: 0.55,
      metalness: 0.08,
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.receiveShadow = true;
    this.cubeGroup.add(body);

    var stickerGeo = new THREE.PlaneGeometry(0.86, 0.86);
    var faces = ["U", "R", "F", "D", "L", "B"];

    for (var f = 0; f < faces.length; f++) {
      var face = faces[f];
      for (var i = 0; i < 9; i++) {
        var mat = new THREE.MeshStandardMaterial({
          color: STICKER_HEX[face],
          roughness: 0.35,
          metalness: 0.05,
        });
        var mesh = new THREE.Mesh(stickerGeo, mat);
        mesh.position.copy(stickerPosition(face, i));
        mesh.rotation.copy(stickerRotation(face));
        mesh.userData = { face: face, index: i, isCenter: i === 4 };
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.cubeGroup.add(mesh);
        this.stickerMeshes[face + "-" + i] = mesh;
      }
    }

    this.cubeGroup.rotation.y = Math.PI * 0.22;
    this.cubeGroup.rotation.x = Math.PI * 0.12;
  };

  Cube3DView.prototype._bindEvents = function () {
    var self = this;
    var canvas = this.renderer.domElement;

    function onPointerDown(e) {
      self.isDragging = false;
      self.dragStart.x = e.clientX;
      self.dragStart.y = e.clientY;
    }

    function onPointerMove(e) {
      var dx = e.clientX - self.dragStart.x;
      var dy = e.clientY - self.dragStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > 6) {
        self.isDragging = true;
      }
    }

    function onPointerUp(e) {
      if (self.isDragging) return;
      self._handleClick(e.clientX, e.clientY);
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);

    this._resizeHandler = function () {
      self._resize();
    };
    window.addEventListener("resize", this._resizeHandler);
  };

  Cube3DView.prototype._handleClick = function (clientX, clientY) {
    if (!this.onStickerClick) return;

    var rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    var meshes = Object.keys(this.stickerMeshes).map(
      function (key) {
        return this.stickerMeshes[key];
      }.bind(this)
    );
    var hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return;

    var data = hits[0].object.userData;
    if (data.isCenter) return;

    this.onStickerClick(data.face, data.index);
  };

  Cube3DView.prototype._resize = function () {
    var width = this.container.clientWidth;
    var height = this.container.clientHeight;
    if (!width || !height) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  Cube3DView.prototype._animate = function () {
    var self = this;
    function frame() {
      self._animId = requestAnimationFrame(frame);
      self.controls.update();
      self.renderer.render(self.scene, self.camera);
    }
    frame();
  };

  Cube3DView.prototype.updateColors = function (cubeState) {
    var faces = ["U", "R", "F", "D", "L", "B"];
    for (var f = 0; f < faces.length; f++) {
      var face = faces[f];
      var stickers = cubeState[face];
      if (!stickers) continue;
      for (var i = 0; i < 9; i++) {
        var mesh = this.stickerMeshes[face + "-" + i];
        if (!mesh) continue;
        var colorId = stickers[i];
        mesh.material.color.setHex(STICKER_HEX[colorId] || 0x888888);
      }
    }
  };

  Cube3DView.prototype.setVisible = function (visible) {
    this.container.hidden = !visible;
    if (visible) {
      var self = this;
      requestAnimationFrame(function () {
        self._resize();
      });
    }
  };

  Cube3DView.prototype.dispose = function () {
    if (this._animId) cancelAnimationFrame(this._animId);
    window.removeEventListener("resize", this._resizeHandler);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  };

  global.Cube3DView = Cube3DView;
})(window);
