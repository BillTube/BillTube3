/* Billcast sender — adapted for BTFW overlay bar */
$(document).ready(function () {
  var session = null;
  var castPlayer = null;
  var CHECK_INTERVAL = 10000;
  var SYNC_THRESHOLD = 5;
  var player = null;
  var castAvailable = false;
  var syncInterval = null;
  var boundPlayer = null;
  var roomKey = currentMediaKey();
  var roomSample = null;
  var awaitingRoom = false;
  var sourceReady = true;
  var castKey = null;
  var pendingLoad = null;
  var generation = 0;
  var statusPending = false;

  function mediaKey(media) {
    if (!media || !media.type || media.id == null) return null;
    return String(media.type).toLowerCase() + ':' + String(media.id);
  }

  function currentMediaKey() {
    return window.PLAYER && mediaKey({ type: window.PLAYER.mediaType, id: window.PLAYER.mediaId });
  }

  function validTime(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  function playbackTarget() {
    if (window.socket && (window.socket.connected === false || awaitingRoom)) return null;
    if (!isDirectMedia()) return null;
    if (roomKey && currentMediaKey() && roomKey !== currentMediaKey()) return null;
    if (roomSample) {
      var age = (Date.now() - roomSample.at) / 1000;
      if (age > 30) return null; // Never seek using a stale room clock.
      return { time: roomSample.time + (roomSample.paused ? 0 : age), paused: roomSample.paused };
    }
    // Until the first room sample, a ready local player can seed a new session.
    if (window.socket && castPlayer) return null;
    if (sourceReady && player && typeof player.readyState === 'function' && player.readyState() >= 2) {
      var time = player.currentTime();
      if (validTime(time)) return { time: time, paused: player.paused() };
    }
    return null;
  }

  function getMediaType() {
    try {
      return window.PLAYER && window.PLAYER.mediaType || null;
    } catch (err) {
      return null;
    }
  }

  function isDirectMedia() {
    var type = getMediaType();
    if (typeof type === 'string') {
      type = type.toLowerCase();
      if (type === 'fi' || type === 'gd') return true;
      if (type) return false;
    }

    if (typeof getCurrentVideoSrc === 'function') {
      var src = getCurrentVideoSrc();
      if (typeof src === 'string' && src.length) {
        var lower = src.toLowerCase();
        if (lower.indexOf('youtube.com') !== -1 || lower.indexOf('youtu.be') !== -1) {
          return false;
        }
        return /(\.mp4|\.webm|\.ogg|\.ogv|\.mov)([#?]|$)/.test(lower);
      }
    }

    return false;
  }

  /* --------------------------- Overlay / Bar helpers --------------------------- */
  function $overlay() {
    var $o = $('#btfw-video-overlay'); // new theme overlay
    if ($o.length) return $o;

    $o = $('#VideoOverlay');           // legacy overlay
    if ($o.length) return $o;

    // Last resort: create an overlay so buttons have a home
    var $vw = $('#videowrap');
    if ($vw.length) {
      $o = $('<div id="btfw-video-overlay" class="btfw-video-overlay"></div>')
        .css({ position: 'absolute', inset: 0, 'pointer-events': 'none' })
        .appendTo($vw);
      return $o;
    }
    return $(); // none yet
  }

  function $voBar() {
    var $b = $('#btfw-vo-bar');
    if ($b.length) return $b;

    // Create a minimal bar if overlay exists but bar doesn't
    var $ov = $overlay();
    if ($ov.length) {
      $b = $('<div id="btfw-vo-bar" class="btfw-vo-bar"></div>')
        .css({
          position: 'absolute',
          top: '8px',
          right: '8px',
          left: '8px',
          display: 'flex',
          'justify-content': 'space-between',
          gap: '6px',
          'pointer-events': 'none',
          'z-index': 1000
        })
        .appendTo($ov);
      return $b;
    }
    return $(); // overlay not there yet
  }

  function $voSection(side) {
    var id = side === 'left' ? 'btfw-vo-left' : 'btfw-vo-right';
    var cls = 'btfw-vo-section btfw-vo-section--' + side;
    var $section = $('#' + id);
    if ($section.length) return $section;

    var $bar = $voBar();
    if (!$bar.length) return $();

    $section = $('<div></div>')
      .attr('id', id)
      .addClass(cls)
      .css({ display: 'flex', 'pointer-events': 'auto', gap: '6px', 'flex-wrap': 'wrap' });

    if (side === 'left') {
      $bar.prepend($section);
    } else {
      $bar.append($section);
    }

    $bar.attr('data-left-section', '#btfw-vo-left');
    $bar.attr('data-right-section', '#btfw-vo-right');

    return $section;
  }

  function whenVoBarReady(fn) {
    if ($voBar().length) return fn();
    var mo = new MutationObserver(function () {
      if ($voBar().length) { mo.disconnect(); fn(); }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  /* ------------------------------ Player wiring ------------------------------- */
  function initializePlayer() {
    if ($('#ytapiplayer').length && typeof videojs === 'function') {
      player = videojs('ytapiplayer');
      if (player !== boundPlayer && typeof player.readyState === 'function' && player.readyState() >= 2) {
        sourceReady = true;
      }
      attachPlayerEventListeners();
      updateCastButtonVisibility();
    } else {
      setTimeout(initializePlayer, 500);
    }
  }

  function attachPlayerEventListeners() {
    if (!player || player === boundPlayer) return;
    if (boundPlayer && typeof boundPlayer.off === 'function') {
      boundPlayer.off('play', syncPlaybackTime);
      boundPlayer.off('pause', syncPlaybackTime);
      boundPlayer.off('seeked', syncPlaybackTime);
      boundPlayer.off('loadstart', onLocalLoadStart);
      boundPlayer.off('loadeddata', onLocalLoaded);
    }
    boundPlayer = player;
    player.on('play', syncPlaybackTime);
    player.on('pause', syncPlaybackTime);
    player.on('seeked', syncPlaybackTime);
    player.on('loadstart', onLocalLoadStart);
    player.on('loadeddata', onLocalLoaded);
  }

  function onLocalLoadStart() {
    sourceReady = false;
  }

  function onLocalLoaded() {
    sourceReady = true;
    startSync();
    castCurrentVideo();
    syncPlaybackTime();
    updateCastButtonVisibility();
  }

  /* ------------------------------ Cast controls ------------------------------- */
  function createCastButton() {
    // return a jQuery element (don’t append here)
    if ($('#btfw-vo-cast').length) return $('#btfw-vo-cast');

    // Use the same overlay styling as other buttons
    // Glyphicons exist via Bootswatch Slate; if you prefer FA, swap the inner <span>.
    var $btn = $(
      '<button id="btfw-vo-cast" ' +
        'class="btn btn-sm btn-default btfw-vo-adopted" ' +
        'title="Cast to device" data-btfw-overlay="1">' +
        '<i class="fa-brands fa-chromecast"></i>' +
      '</button>'
    );

    $btn.on('click', function () {
      try {
        cast.framework.CastContext.getInstance().requestSession();
      } catch (e) {
        alert('Cast framework not ready.');
      }
    });

    return $btn;
  }

  function createFallbackButton() {
    if ($('#btfw-vo-cast-fallback').length) return $('#btfw-vo-cast-fallback');

    var $btn = $(
      '<button id="btfw-vo-cast-fallback" ' +
        'class="btn btn-sm btn-default btfw-vo-adopted" ' +
        'title="Casting not available" data-btfw-overlay="1">' +
        '<i class="fa-solid fa-circle-info"></i>' +
      '</button>'
    );

    $btn.on('click', function () {
      alert('Casting is not available in this browser. Please use Google Chrome for casting.');
    });

    return $btn;
  }

  function initializeCastButton() {
    var $left = $voSection('left');
    if (!$left.length) { whenVoBarReady(initializeCastButton); return; }

    // Remove any previous instance to avoid duplicates when re-running
    $('#btfw-vo-cast, #btfw-vo-cast-fallback').remove();

    var $btn = castAvailable ? createCastButton() : createFallbackButton();
    if (!$btn || !$btn.length) return;

    $left.append($btn);
    updateCastButtonVisibility();
  }

  function updateCastButtonVisibility() {
    if (!isDirectMedia()) {
      $('#btfw-vo-cast, #btfw-vo-cast-fallback').hide();
      if (session) stopSync();
      return;
    }

    if (castAvailable) {
      $('#btfw-vo-cast').show();
      $('#btfw-vo-cast-fallback').hide();
      if (session && !syncInterval) startSync();
    } else {
      $('#btfw-vo-cast').hide();
      $('#btfw-vo-cast-fallback').show();
    }
  }

  /* --------------------------- Cast framework wiring -------------------------- */
  function initializeCastApi() {
    castAvailable = true;
    var context = cast.framework.CastContext.getInstance();
    context.setOptions({
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    });

    context.addEventListener(
      cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
      sessionStateChanged
    );

    whenVoBarReady(initializeCastButton);
  }

  function sessionStateChanged(event) {
    switch (event.sessionState) {
      case cast.framework.SessionState.SESSION_STARTED:
      case cast.framework.SessionState.SESSION_RESUMED: {
        generation++;
        pendingLoad = null;
        statusPending = false;
        session = cast.framework.CastContext.getInstance().getCurrentSession();
        castPlayer = session ? session.getMediaSession() : null;
        castKey = castPlayer && castPlayer.media && castPlayer.media.customData
          ? castPlayer.media.customData.billcastMediaKey : null;
        if (!castKey && castPlayer && castPlayer.media && castPlayer.media.contentId === getCurrentVideoSrc()) {
          castKey = roomKey || currentMediaKey();
        }

        waitForPlayer(function () {
          castCurrentVideo();
          syncPlaybackTime();
        });
        startSync();
        break;
      }
      case cast.framework.SessionState.SESSION_ENDED:
        generation++;
        pendingLoad = null;
        statusPending = false;
        castKey = null;
        session = null;
        castPlayer = null;
        stopSync();
        break;
    }
  }

  /* --------------------------------- Casting --------------------------------- */
  function waitForPlayer(cb) {
    if (player) { cb(); }
    else { setTimeout(function () { waitForPlayer(cb); }, 500); }
  }

  function getCurrentVideoSrc() {
    var $v = $('#ytapiplayer video');
    var $i = $('#ytapiplayer iframe');
    var src = null;

    if ($v.length > 0) {
      src = $v.attr('src');
      if (!src) {
        $v.find('source').each(function () {
          var s = $(this).attr('src');
          if (s) { src = s; return false; }
        });
      }
      if (!src) src = $v.attr('data-src');
    }
    if (!src && $i.length > 0) src = $i.attr('src');
    return src;
  }

  function castCurrentVideo() {
    if (!session || pendingLoad) return;

    var target = playbackTarget();
    if (!target) return;

    var videoSrc = getCurrentVideoSrc();
    if (!videoSrc) { console.error('Cannot cast: no video src'); return; }

    if (!isDirectMedia()) return;
    var key = roomKey || currentMediaKey() || videoSrc;
    if (castPlayer && castPlayer.media && castPlayer.sessionId === session.getSessionId()) {
      // Local reloads and reconnect snapshots do not replace an already playing movie.
      var receiverFailed = castPlayer.playerState === chrome.cast.media.PlayerState.IDLE
        && castPlayer.idleReason === chrome.cast.media.IdleReason.ERROR;
      if (!receiverFailed && (castKey === key || (!castKey && castPlayer.media.contentId === videoSrc))) {
        castKey = key;
        return;
      }
    }
    if (!sourceReady) return;

    var mimeType = getMimeType(videoSrc);
    var mediaInfo = new chrome.cast.media.MediaInfo(videoSrc, mimeType);
    mediaInfo.customData = { billcastMediaKey: key };

    var videoName = $('#currenttitle').text() || 'Unknown Title';
    var fullTitle = 'BillTube Cast: ' + videoName;

    var metadata = new chrome.cast.media.GenericMediaMetadata();
    metadata.title = fullTitle;
    mediaInfo.metadata = metadata;

    var request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.currentTime = target.time;
    request.autoplay = !target.paused;
    var loadingSession = session;
    var loadGeneration = generation;
    var token = {};
    pendingLoad = token;

    loadingSession.loadMedia(request).then(
      function () {
        if (pendingLoad === token) pendingLoad = null;
        if (session !== loadingSession || generation !== loadGeneration) {
          castCurrentVideo();
          return;
        }
        castPlayer = loadingSession.getMediaSession();
        castKey = key;
        updateCastButtonVisibility();
        syncPlaybackTime();
      },
      function (error) {
        if (pendingLoad === token) pendingLoad = null;
        console.error('Error loading media:', error);
      }
    );
  }

  function getMimeType(url) {
    var ext = url.split('.').pop().split(/\#|\?/)[0].toLowerCase();
    switch (ext) {
      case 'mp4':  return 'video/mp4';
      case 'webm': return 'video/webm';
      case 'ogg':
      case 'ogv':  return 'video/ogg';
      case 'mov':  return 'video/quicktime';
      default:
        console.warn('Unknown extension; defaulting to video/mp4');
        return 'video/mp4';
    }
  }

  /* ------------------------------- Time sync ---------------------------------- */
  function startSync() {
    if (!syncInterval) syncInterval = setInterval(syncPlaybackTime, CHECK_INTERVAL);
  }
  function stopSync() {
    if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
  }
  function syncPlaybackTime() {
    if (!session || !playbackTarget()) return;
    castCurrentVideo();
    if (pendingLoad || !castPlayer || statusPending) return;
    if (castPlayer.sessionId !== session.getSessionId()) return;
    if (castKey !== (roomKey || currentMediaKey() || getCurrentVideoSrc())) return;
    var media = castPlayer;
    var syncingSession = session;
    var syncGeneration = generation;
    statusPending = true;
    media.getStatus(null, function () {
      if (generation !== syncGeneration || session !== syncingSession || castPlayer !== media) return;
      statusPending = false;
      var target = playbackTarget(); // Read again after the asynchronous status request.
      if (!target || pendingLoad) return;
      var castTime = media.getEstimatedTime();
      if (validTime(castTime) && Math.abs(target.time - castTime) > SYNC_THRESHOLD) {
        var seekRequest = new chrome.cast.media.SeekRequest();
        seekRequest.currentTime = target.time;
        media.seek(seekRequest, function () {}, function (error) {
          console.error('Cast sync error:', error);
        });
      }
      var states = chrome.cast.media.PlayerState;
      if (target.paused && media.playerState === states.PLAYING) {
        media.pause(null, function () {}, logControlError);
      } else if (!target.paused && media.playerState === states.PAUSED) {
        media.play(null, function () {}, logControlError);
      }
    }, function (error) {
      if (generation === syncGeneration) statusPending = false;
      console.warn('Cast status unavailable; will retry:', error);
    });
  }

  function logControlError(error) { console.warn('Cast playback control failed:', error); }

  /* ----------------------------- Socket hooks --------------------------------- */
  if (window.socket && typeof window.socket.on === 'function') {
    socket.on('disconnect', function () {
      awaitingRoom = true;
      roomSample = null;
      generation++;
      statusPending = false;
    });
    socket.on('connect', function () {
      awaitingRoom = true;
      roomSample = null;
    });
    socket.on('changeMedia', function (data) {
      var key = mediaKey(data);
      if (key && key !== (roomKey || currentMediaKey())) {
        generation++;
        statusPending = false;
        roomSample = null;
        sourceReady = false;
      }
      if (key) roomKey = key;
      updateRoomSample(data);
      // CyTube replaces its player asynchronously. Do not cast the old DOM source here.
      setTimeout(function () {
        initializePlayer();
        updateCastButtonVisibility();
        syncPlaybackTime();
      }, 0);
    });
    socket.on('mediaUpdate', function (data) {
      updateRoomSample(data);
      syncPlaybackTime();
    });
  }

  function updateRoomSample(data) {
    if (!data || !validTime(data.currentTime)) return;
    var key = mediaKey(data);
    if (key && roomKey && key !== roomKey) return;
    if (!roomKey) roomKey = key || currentMediaKey();
    roomSample = { time: data.currentTime, paused: data.paused === true, at: Date.now() };
    awaitingRoom = false;
  }

  /* ------------------------ Load Google Cast framework ------------------------ */
  var castScript = document.createElement('script');
  castScript.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  window['__onGCastApiAvailable'] = function (isAvailable) {
    if (isAvailable) initializeCastApi();
    else { castAvailable = false; whenVoBarReady(initializeCastButton); }
  };
  document.head.appendChild(castScript);

  // Cleanup on unload
  $(window).on('beforeunload', function () {
    if (session) session.endSession(true);
  });

  /* --------------------------------- Boot ------------------------------------- */
  initializePlayer();
  whenVoBarReady(initializeCastButton);
});

