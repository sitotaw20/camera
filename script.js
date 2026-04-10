(function() {
  'use strict';

  // --- State Management ---
  const state = {
    mode: 'photo',
    filter: 'filter-none',
    mirrored: true,
    facingMode: 'user',
    timer: 0,
    timerOptions: [0, 3, 10],
    timerIndex: 0,
    recording: false,
    recorder: null,
    recordedChunks: [],
    recStartTime: 0,
    recInterval: null,
    zoom: 1,
    gallery: [],
    previewIndex: -1,
    stream: null,
    track: null,
  };

  // --- DOM Elements ---
  const video = document.getElementById('video');
  const viewport = document.getElementById('viewport');
  const permScreen = document.getElementById('permScreen');
  const permBtn = document.getElementById('permBtn');
  const shutterBtn = document.getElementById('shutterBtn');
  const shutterFlash = document.getElementById('shutterFlash');
  const flipBtn = document.getElementById('flipBtn');
  const mirrorBtn = document.getElementById('mirrorBtn');
  const timerBtn = document.getElementById('timerBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const filterStrip = document.getElementById('filterStrip');
  const recIndicator = document.getElementById('recIndicator');
  const recTimer = document.getElementById('recTimer');
  const zoomIndicator = document.getElementById('zoomIndicator');
  const thumbWrap = document.getElementById('thumbWrap');
  const galleryOverlay = document.getElementById('galleryOverlay');
  const galleryClose = document.getElementById('galleryClose');
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryEmpty = document.getElementById('galleryEmpty');
  const previewOverlay = document.getElementById('previewOverlay');
  const previewClose = document.getElementById('previewClose');
  const previewContent = document.getElementById('previewContent');
  const previewDownload = document.getElementById('previewDownload');
  const previewDelete = document.getElementById('previewDelete');
  const previewBack = document.getElementById('previewBack');
  const captureCanvas = document.getElementById('captureCanvas');
  const toastContainer = document.getElementById('toastContainer');

  // --- Utility: Toast Notification ---
  function showToast(msg, icon = 'fa-circle-check') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<i class="fas ${icon}"></i> ${msg}`;
    toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // --- Camera Core ---
  async function initCamera() {
    try {
      if (state.stream) {
        state.stream.getTracks().forEach(t => t.stop());
      }
      const constraints = {
        video: {
          facingMode: state.facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      };
      state.stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = state.stream;
      state.track = state.stream.getVideoTracks()[0];
      video.classList.toggle('mirrored', state.mirrored && state.facingMode === 'user');
      permScreen.classList.add('hidden');
      showToast('Camera ready', 'fa-camera');
    } catch (err) {
      console.error(err);
      showToast('Camera access denied', 'fa-triangle-exclamation');
    }
  }

  // --- Event Listeners ---
  permBtn.addEventListener('click', initCamera);

  flipBtn.addEventListener('click', () => {
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    if (state.facingMode === 'environment') state.mirrored = false;
    initCamera();
  });

  mirrorBtn.addEventListener('click', () => {
    state.mirrored = !state.mirrored;
    mirrorBtn.classList.toggle('active', state.mirrored);
    video.classList.toggle('mirrored', state.mirrored && state.facingMode === 'user');
    showToast(state.mirrored ? 'Mirror on' : 'Mirror off', 'fa-arrows-left-right');
  });

  timerBtn.addEventListener('click', () => {
    state.timerIndex = (state.timerIndex + 1) % state.timerOptions.length;
    state.timer = state.timerOptions[state.timerIndex];
    timerBtn.classList.toggle('active', state.timer > 0);
    showToast(state.timer > 0 ? `Timer: ${state.timer}s` : 'Timer off', 'fa-clock');
  });

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      fullscreenBtn.querySelector('i').className = 'fas fa-compress';
    } else {
      document.exitFullscreen().catch(() => {});
      fullscreenBtn.querySelector('i').className = 'fas fa-expand';
    }
  });

  filterStrip.addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    filterStrip.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.filter = chip.dataset.filter;
    video.className = '';
    video.classList.add(state.filter);
    video.classList.toggle('mirrored', state.mirrored && state.facingMode === 'user');
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.recording) return;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mode = btn.dataset.mode;
    });
  });

  // --- Capture Logic ---
  function triggerFlash() {
    shutterFlash.classList.remove('active');
    void shutterFlash.offsetWidth;
    shutterFlash.classList.add('active');
    setTimeout(() => shutterFlash.classList.remove('active'), 350);
  }

  function capturePhoto() {
    const canvas = captureCanvas;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');

    const filterMap = {
      'filter-none': 'none',
      'filter-grayscale': 'grayscale(1)',
      'filter-sepia': 'sepia(0.8) saturate(1.2)',
      'filter-contrast': 'contrast(1.5) brightness(1.05)',
      'filter-warm': 'saturate(1.4) hue-rotate(-10deg) brightness(1.05)',
      'filter-cool': 'saturate(0.9) hue-rotate(20deg) brightness(1.05)',
      'filter-vintage': 'sepia(0.4) contrast(1.1) brightness(0.95) saturate(0.8)',
      'filter-noir': 'grayscale(1) contrast(1.4) brightness(0.9)',
    };
    ctx.filter = filterMap[state.filter] || 'none';

    if (state.mirrored && state.facingMode === 'user') {
      ctx.translate(vw, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, vw, vh);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      state.gallery.unshift({ type: 'photo', data: url, blob, timestamp: Date.now() });
      updateThumbnail();
      triggerFlash();
      showToast('Photo captured', 'fa-image');
    }, 'image/jpeg', 0.92);
  }

  // --- Video Logic ---
  function startRecording() {
    if (!state.stream) return;
    state.recordedChunks = [];
    const recCanvas = document.createElement('canvas');
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    recCanvas.width = vw;
    recCanvas.height = vh;
    const recCtx = recCanvas.getContext('2d');

    let drawFrame;
    function drawLoop() {
      if (state.mirrored && state.facingMode === 'user') {
        recCtx.translate(vw, 0); recCtx.scale(-1, 1);
      }
      recCtx.drawImage(video, 0, 0, vw, vh);
      recCtx.setTransform(1, 0, 0, 1, 0, 0);
      drawFrame = requestAnimationFrame(drawLoop);
    }
    drawLoop();

    const canvasStream = recCanvas.captureStream(30);
    const audioTracks = state.stream.getAudioTracks();
    if (audioTracks.length > 0) canvasStream.addTrack(audioTracks[0]);

    state.recorder = new MediaRecorder(canvasStream);
    state.recorder.ondataavailable = (e) => state.recordedChunks.push(e.data);
    state.recorder.onstop = () => {
      cancelAnimationFrame(drawFrame);
      const blob = new Blob(state.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      state.gallery.unshift({ type: 'video', data: url, blob, timestamp: Date.now() });
      updateThumbnail();
      showToast('Video saved', 'fa-video');
    };

    state.recorder.start(100);
    state.recording = true;
    state.recStartTime = Date.now();
    shutterBtn.classList.add('recording');
    recIndicator.classList.add('visible');
    state.recInterval = setInterval(() => {
      const elapsed = Date.now() - state.recStartTime;
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      recTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 200);
  }

  function stopRecording() {
    if (state.recorder && state.recording) {
      state.recorder.stop();
      state.recording = false;
      shutterBtn.classList.remove('recording');
      recIndicator.classList.remove('visible');
      clearInterval(state.recInterval);
    }
  }

  // --- Shutter Button ---
  shutterBtn.addEventListener('click', () => {
    if (!state.stream) return showToast('Camera not ready', 'fa-triangle-exclamation');
    
    const action = () => {
      if (state.mode === 'video') {
        state.recording ? stopRecording() : startRecording();
      } else if (state.mode === 'burst') {
        let count = 0;
        const int = setInterval(() => { capturePhoto(); count++; if(count>=5) clearInterval(int); }, 200);
      } else {
        capturePhoto();
      }
    };

    if (state.timer > 0) {
      let rem = state.timer;
      showToast(`${rem}...`, 'fa-hourglass-half');
      const int = setInterval(() => {
        rem--;
        if (rem > 0) showToast(`${rem}...`, 'fa-hourglass-half');
        else { clearInterval(int); action(); }
      }, 1000);
    } else {
      action();
    }
  });

  // --- Gallery & Preview UI ---
  function updateThumbnail() {
    if (state.gallery.length === 0) return;
    const item = state.gallery[0];
    thumbWrap.innerHTML = item.type === 'photo' 
        ? `<img src="${item.data}">` 
        : `<div class="placeholder"><i class="fas fa-video" style="color:var(--accent)"></i></div>`;
  }

  thumbWrap.addEventListener('click', () => {
    galleryOverlay.classList.add('open');
    renderGallery();
  });

  galleryClose.addEventListener('click', () => galleryOverlay.classList.remove('open'));

  function renderGallery() {
    galleryGrid.innerHTML = '';
    galleryEmpty.style.display = state.gallery.length === 0 ? 'flex' : 'none';
    state.gallery.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'gallery-item';
      div.innerHTML = item.type === 'photo' 
        ? `<img src="${item.data}">` 
        : `<video src="${item.data}" muted></video>`;
      div.addEventListener('click', () => openPreview(idx));
      galleryGrid.appendChild(div);
    });
  }

  function openPreview(idx) {
    state.previewIndex = idx;
    const item = state.gallery[idx];
    previewContent.innerHTML = item.type === 'photo' 
        ? `<img src="${item.data}">` 
        : `<video src="${item.data}" controls autoplay></video>`;
    previewOverlay.classList.add('open');
  }

  previewClose.addEventListener('click', () => previewOverlay.classList.remove('open'));

  // --- Init ---
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    initCamera();
  }

})();