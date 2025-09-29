/* Billcast sender — adapted for BTFW overlay bar */
$(document).ready(function () {
  var session = null;
  var castPlayer = null;
  var CHECK_INTERVAL = 120000; // Sync every 120 seconds
  var SYNC_THRESHOLD = 20;     // Sync if time difference > 20 seconds
  var player = null;
  var castAvailable = false;
  var syncInterval = null;

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
          display: 'flex',
          gap: '6px',
          'pointer-events': 'auto',
          'z-index': 1000
        })
        .appendTo($ov);
      return $b;
    }
    return $(); // overlay not there yet
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
    if ($('#ytapiplayer').length) {
      player = videojs('ytapiplayer');
      attachPlayerEventListeners();
      updateCastButtonVisibility();
    } else {
      setTimeout(initializePlayer, 500);
    }
  }

  function attachPlayerEventListeners() {
    if (!player) return;

    player.on('play', function () {
      if (session && castPlayer && castPlayer.playerState !== chrome.cast.media.PlayerState.PLAYING) {
        castPlayer.play(
          function () { console.log('Cast player resumed'); },
          function (error) { console.error('Error playing cast player:', error); }
        );
      }
    });

    player.on('pause', function () {
      if (session && castPlayer && castPlayer.playerState !== chrome.cast.media.PlayerState.PAUSED) {
        castPlayer.pause(function (error) {
          console.error('Error pausing cast player:', error);
        });
      }
    });

    player.on('seeked', function () {
      if (session && castPlayer) {
        var currentTime = player.currentTime();
        if (castPlayer && castPlayer.sessionId === session.getSessionId()) {
          var seekRequest = new chrome.cast.media.SeekRequest();
          seekRequest.currentTime = currentTime;
          castPlayer.seek(seekRequest,
            function () { console.log('Cast player synced after seek'); },
            function (error) { console.error('Error syncing cast player after seek:', error); }
          );
        } else {
          console.error('Cannot seek: Invalid cast player session.');
        }
      }
    });

    player.on('loadstart', function () {
      stopSync();
    });

    player.on('loadeddata', function () {
      startSync();
      if (session) castCurrentVideo(0);
      updateCastButtonVisibility();
    });
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
        'title="Cast to device" data-btfw-overlay="1" data-btfw-vo-align="left">' +
        '<span class="glyphicon glyphicon-signal"></span>' +
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
        'title="Casting not available" data-btfw-overlay="1" data-btfw-vo-align="left">' +
        '<span class="glyphicon glyphicon-info-sign"></span>' +
      '</button>'
    );

    $btn.on('click', function () {
      alert('Casting is not available in this browser. Please use Google Chrome for casting.');
    });

    return $btn;
  }

  function initializeCastButton() {
    var $bar = $voBar();
    if (!$bar.length) { whenVoBarReady(initializeCastButton); return; }

    // Remove any previous instance to avoid duplicates when re-running
    $('#btfw-vo-cast, #btfw-vo-cast-fallback').remove();

    var $btn = castAvailable ? createCastButton() : createFallbackButton();
    if (!$btn || !$btn.length) return;

    $bar.append($btn);
    updateCastButtonVisibility();
  }

  function updateCastButtonVisibility() {
    var videoSrc = getCurrentVideoSrc();
    var isYouTubeVideo = videoSrc ? videoSrc.toLowerCase().includes('youtube') : false;

    if (isYouTubeVideo) {
      $('#btfw-vo-cast, #btfw-vo-cast-fallback').hide();
      if (session) stopSync();
    } else if (castAvailable) {
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
        session = cast.framework.CastContext.getInstance().getCurrentSession();
        if (session) castPlayer = session.getMediaSession();

        waitForPlayer(function () {
          var t = (player && typeof player.currentTime === 'function') ? player.currentTime() : 0;
          castCurrentVideo(t);
        });
        startSync();
        break;
      }
      case cast.framework.SessionState.SESSION_ENDED:
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

  function castCurrentVideo(currentTime) {
    if (!session) return;

    var videoSrc = getCurrentVideoSrc();
    if (!videoSrc) { console.error('Cannot cast: no video src'); return; }

    // Skip YouTube (receiver app doesn’t handle YT embeds here)
    if (videoSrc.toLowerCase().includes('youtube')) return;

    var mimeType = getMimeType(videoSrc);
    var mediaInfo = new chrome.cast.media.MediaInfo(videoSrc, mimeType);

    var videoName = $('#currenttitle').text() || 'Unknown Title';
    var fullTitle = 'BillTube Cast: ' + videoName;

    var metadata = new chrome.cast.media.GenericMediaMetadata();
    metadata.title = fullTitle;
    mediaInfo.metadata = metadata;

    var request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.currentTime = currentTime || 0;
    request.autoplay = true;

    session.loadMedia(request).then(
      function () {
        castPlayer = session.getMediaSession();
        updateCastButtonVisibility();
      },
      function (error) {
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
    if (session && castPlayer && player && typeof player.currentTime === 'function') {
      var localTime = player.currentTime();
      var startTime = Date.now();
      castPlayer.getStatus(null, function (status) {
        var endTime = Date.now();
        var latency = (endTime - startTime) / 2000; // → seconds
        var castTime = status.currentTime + latency;

        if (Math.abs(localTime - castTime) > SYNC_THRESHOLD) {
          if (castPlayer && castPlayer.sessionId === session.getSessionId()) {
            var seekRequest = new chrome.cast.media.SeekRequest();
            seekRequest.currentTime = localTime;
            castPlayer.seek(seekRequest,
              function () { console.log('Cast synced to local'); },
              function (error) { console.error('Cast sync error:', error); }
            );
          } else {
            console.error('Invalid cast session; stopping sync.');
            stopSync();
          }
        }
      });
    } else {
      stopSync();
    }
  }

  /* ----------------------------- Socket hooks --------------------------------- */
  if (window.socket && typeof window.socket.on === 'function') {
    socket.on("changeMedia", function () {
      waitForYtapiplayer(function () {
        initializePlayer();
        if (player && typeof player.ready === 'function') {
          player.ready(function () {
            if (session) castCurrentVideo(0);
            updateCastButtonVisibility();
          });
        }
      });
    });
  }

  function waitForYtapiplayer(cb) {
    if ($('#ytapiplayer').length > 0) cb();
    else setTimeout(function () { waitForYtapiplayer(cb); }, 500);
  }

  /* ------------------------ Load Google Cast framework ------------------------ */
  var castScript = document.createElement('script');
  castScript.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  document.head.appendChild(castScript);

  window['__onGCastApiAvailable'] = function (isAvailable) {
    if (isAvailable) initializeCastApi();
    else { castAvailable = false; whenVoBarReady(initializeCastButton); }
  };

  // Cleanup on unload
  $(window).on('beforeunload', function () {
    if (session) session.endSession(true);
  });

  /* --------------------------------- Boot ------------------------------------- */
  initializePlayer();
  whenVoBarReady(initializeCastButton);
});
