(function () {
  'use strict';

  // ─── Конфигурация ──────────────────────────────────────────────────────────
  var Defined = {
    api:       'lampac',
    localhost: 'http://localhost/',
    apn:       ''
  };

  var BALANSER_NAME = 'collaps';
  var BALANSER_URL  = Defined.localhost + 'lite/collaps';

  // ─── Уникальный ID устройства ────────────────────────────────────────────
  var unic_id = Lampa.Storage.get('lampac_unic_id', '');
  if (!unic_id) {
    unic_id = Lampa.Utils.uid(8).toLowerCase();
    Lampa.Storage.set('lampac_unic_id', unic_id);
  }

  // ─── RCH (Remote Client Handler) ─────────────────────────────────────────
  var hostkey = 'http://localhost'.replace('http://', '').replace('https://', '');

  function getAndroidVersion() {
    if (Lampa.Platform.is('android')) {
      try { return parseInt(AndroidJS.appVersion().split('-').pop()); }
      catch (e) { return 0; }
    }
    return 0;
  }

  if (!window.rch_nws) window.rch_nws = {};
  if (!window.rch_nws[hostkey]) {
    window.rch_nws[hostkey] = {
      type:             Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : undefined,
      startTypeInvoke:  false,
      rchRegistry:      false,
      apkVersion:       getAndroidVersion()
    };
  }

  window.rch_nws[hostkey].typeInvoke = function (host, call) {
    if (!window.rch_nws[hostkey].startTypeInvoke) {
      window.rch_nws[hostkey].startTypeInvoke = true;
      var check = function (good) {
        window.rch_nws[hostkey].type = Lampa.Platform.is('android') ? 'apk' : good ? 'cors' : 'web';
        call();
      };
      if (Lampa.Platform.is('android') || Lampa.Platform.is('tizen')) check(true);
      else {
        var net = new Lampa.Reguest();
        net.silent(
          'http://localhost'.indexOf(location.host) >= 0 ? 'https://github.com/' : host + '/cors/check',
          function () { check(true); },
          function () { check(false); },
          false, { dataType: 'text' }
        );
      }
    } else call();
  };

  window.rch_nws[hostkey].Registry = function (client, startConnection) {
    window.rch_nws[hostkey].typeInvoke('http://localhost', function () {
      client.invoke('RchRegistry', {
        host:       location.host,
        rchtype:    Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : (window.rch_nws[hostkey].type || 'web'),
        apkVersion: Lampa.Platform.is('android') ? (window.rch_nws[hostkey].apkVersion || 0) : 0,
        player:     Lampa.Storage.field('player')
      });

      if (window.rch_nws[hostkey].rchRegistry) return;
      window.rch_nws[hostkey].rchRegistry = true;

      var handled = false;
      client.on('RchRegistry', function () {
        if (startConnection && !handled) { handled = true; startConnection(); }
      });

      client.on('RchClient', function (rchId, url, data, headers, returnHeaders) {
        var network = new Lampa.Reguest();

        function sendResult(uri, html) {
          $.ajax({
            url: 'http://localhost/rch/' + uri + '?id=' + rchId,
            type: 'POST', data: html, async: true, cache: false,
            contentType: false, processData: false,
            success: function () {},
            error:   function () { client.invoke('RchResult', rchId, ''); }
          });
        }

        function result(html) {
          if (Lampa.Arrays.isObject(html) || Lampa.Arrays.isArray(html)) html = JSON.stringify(html);
          if (typeof CompressionStream !== 'undefined' && html && html.length > 1000) {
            var cs = new CompressionStream('gzip');
            var enc = new TextEncoder();
            var rs = new ReadableStream({ start: function (c) { c.enqueue(enc.encode(html)); c.close(); } });
            new Response(rs.pipeThrough(cs)).arrayBuffer().then(function (buf) {
              var arr = new Uint8Array(buf);
              sendResult(arr.length > html.length ? 'result' : 'gzresult', arr.length > html.length ? html : arr);
            }).catch(function () { sendResult('result', html); });
          } else sendResult('result', html);
        }

        if (url === 'eval')    { console.log('RCH', url, data); result(eval(data)); }
        else if (url === 'evalrun') { console.log('RCH', url, data); eval(data); }
        else if (url === 'ping') { result('pong'); }
        else {
          console.log('RCH', url);
          network['native'](url, result, function (e) { console.log('RCH', 'empty', e.status); result(''); },
            data, { dataType: 'text', timeout: 8000, headers: headers, returnHeaders: returnHeaders });
        }
      });

      client.on('Connected', function (cid) { console.log('RCH connected:', cid); window.rch_nws[hostkey].connectionId = cid; });
      client.on('Closed',    function ()    { console.log('RCH closed'); });
      client.on('Error',     function (e)   { console.log('RCH error:', e); });
    });
  };

  window.rch_nws[hostkey].typeInvoke('http://localhost', function () {});

  function rchInvoke(json, call) {
    if (!window.nwsClient) window.nwsClient = {};
    var client = window.nwsClient[hostkey];
    if (client && client.connectionId != null) { call(); }
    else if (client) { client.reconnect(function () { call(); }); }
    else {
      window.nwsClient[hostkey] = new NativeWsClient(json.nws, { autoReconnect: true });
      window.nwsClient[hostkey].on('Connected', function () {
        window.rch_nws[hostkey].Registry(window.nwsClient[hostkey], function () { call(); });
      });
      window.nwsClient[hostkey].connect();
    }
  }

  function rchRun(json, call) {
    if (typeof NativeWsClient === 'undefined') {
      Lampa.Utils.putScript(['http://localhost/js/nws-client-es5.js?v21042026'],
        function () {}, false, function () { rchInvoke(json, call); }, true);
    } else rchInvoke(json, call);
  }

  // ─── Утилиты ─────────────────────────────────────────────────────────────
  function account(url) {
    url = url + '';
    var email = Lampa.Storage.get('account_email');
    if (email && url.indexOf('account_email=') === -1)
      url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
    var uid = Lampa.Storage.get('lampac_unic_id', '');
    if (uid && url.indexOf('uid=') === -1)
      url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));
    var nws_id = Lampa.Storage.get('lampac_nws_id', '');
    if (nws_id && url.indexOf('nws_id=') === -1)
      url = Lampa.Utils.addUrlComponent(url, 'nws_id=' + encodeURIComponent(nws_id));
    return url;
  }

  function addHeaders() {
    var k = Lampa.Storage.get('kit_aesgcmkey', '');
    return k ? { 'X-Kit-AesGcm': k } : {};
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ─── Основной компонент ───────────────────────────────────────────────────
  function component(object) {
    var network  = new Lampa.Reguest();
    var scroll   = new Lampa.Scroll({ mask: true, over: true });
    var files    = new Lampa.Explorer(object);
    var filter   = new Lampa.Filter(object);

    var last, initialized;
    var images = [];
    var balanser_timer;
    var filter_find = { season: [], voice: [] };
    var filter_translate = {
      season: Lampa.Lang.translate('torrent_serial_season'),
      voice:  Lampa.Lang.translate('torrent_parser_voice')
    };

    // ── helpers ──
    function requestParams(url) {
      var q = [];
      q.push('id='               + encodeURIComponent(object.movie.id));
      if (object.movie.imdb_id)        q.push('imdb_id='        + object.movie.imdb_id);
      if (object.movie.kinopoisk_id)   q.push('kinopoisk_id='   + object.movie.kinopoisk_id);
      if (object.movie.tmdb_id)        q.push('tmdb_id='        + object.movie.tmdb_id);
      q.push('title='            + encodeURIComponent(object.clarification ? object.search : object.movie.title || object.movie.name));
      q.push('original_title='   + encodeURIComponent(object.movie.original_title || object.movie.original_name));
      q.push('serial='           + (object.movie.name ? 1 : 0));
      q.push('original_language='+ (object.movie.original_language || ''));
      q.push('year='             + ((object.movie.release_date || object.movie.first_air_date || '0000') + '').slice(0, 4));
      q.push('source='           + (object.movie.source || 'tmdb'));
      q.push('clarification='    + (object.clarification ? 1 : 0));
      q.push('similar='          + (object.similar ? true : false));
      q.push('rchtype='          + ((window.rch_nws && window.rch_nws[hostkey] ? window.rch_nws[hostkey].type : '') || ''));
      if (Lampa.Storage.get('account_email', ''))
        q.push('cub_id=' + Lampa.Utils.hash(Lampa.Storage.get('account_email', '')));
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + q.join('&');
    }

    function getChoice() {
      var data = Lampa.Storage.cache('online_choice_' + BALANSER_NAME, 3000, {});
      var save = data[object.movie.id] || {};
      Lampa.Arrays.extend(save, { season: 0, voice: 0, voice_name: '', voice_id: 0, episodes_view: {}, movie_view: '' });
      return save;
    }

    function saveChoice(choice) {
      var data = Lampa.Storage.cache('online_choice_' + BALANSER_NAME, 3000, {});
      data[object.movie.id] = choice;
      Lampa.Storage.set('online_choice_' + BALANSER_NAME, data);
    }

    function replaceChoice(choice) {
      var to = getChoice();
      Lampa.Arrays.extend(to, choice, true);
      saveChoice(to);
    }

    function clearImages() {
      images.forEach(function (img) { img.onerror = img.onload = function () {}; img.src = ''; });
      images = [];
    }

    function resetView() {
      last = false;
      clearInterval(balanser_timer);
      network.clear();
      clearImages();
      scroll.render().find('.empty').remove();
      scroll.clear();
      scroll.reset();
      scroll.body().append(Lampa.Template.get('collaps_loading', {}));
    }

    function doRequest(url) {
      network['native'](account(url), _this.parse.bind(_this), _this.empty.bind(_this), false, {
        dataType: 'text', headers: addHeaders()
      });
    }

    // ── RCH bridge ──
    var _this = this;

    this.rch = function (json, noreset) {
      rchRun(json, function () {
        if (!noreset) _this.find();
        else noreset();
      });
    };

    // ── externalids ──
    this.externalids = function () {
      return new Promise(function (resolve) {
        if (!object.movie.imdb_id || !object.movie.kinopoisk_id) {
          var q = ['id=' + encodeURIComponent(object.movie.id), 'serial=' + (object.movie.name ? 1 : 0)];
          if (object.movie.imdb_id)      q.push('imdb_id='      + object.movie.imdb_id);
          if (object.movie.kinopoisk_id) q.push('kinopoisk_id=' + object.movie.kinopoisk_id);
          network.timeout(10000);
          network.silent(account(Defined.localhost + 'externalids?' + q.join('&')), function (json) {
            for (var k in json) object.movie[k] = json[k];
            resolve();
          }, resolve, false, { headers: addHeaders() });
        } else resolve();
      });
    };

    // ── parse ──
    this.parse = function (str) {
      var json = Lampa.Arrays.decodeJson(str, {});
      if (Lampa.Arrays.isObject(str) && str.rch) json = str;
      if (json.rch) return this.rch(json);

      try {
        var items   = parseJsonDate(str, '.videos__item');
        var buttons = parseJsonDate(str, '.videos__button');

        // одна ссылка-редирект
        if (items.length === 1 && items[0].method === 'link' && !items[0].similar) {
          filter_find.season = items.map(function (s) { return { title: s.text, url: s.url }; });
          replaceChoice({ season: 0 });
          doRequest(items[0].url);
          return;
        }

        this.activity.loader(false);

        var videos  = items.filter(function (v) { return v.method === 'play' || v.method === 'call'; });
        var similar = items.filter(function (v) { return v.similar; });

        if (videos.length) {
          if (buttons.length) {
            filter_find.voice = buttons.map(function (b) { return { title: b.text, url: b.url }; });
            var ch = getChoice();
            var byUrl  = buttons.find(function (v) { return v.url === ch.voice_url; });
            var byName = buttons.find(function (v) { return v.text === ch.voice_name; });
            var active = buttons.find(function (v) { return v.active; });

            if (byUrl && !byUrl.active) {
              replaceChoice({ voice: buttons.indexOf(byUrl), voice_name: byUrl.text });
              doRequest(byUrl.url);
            } else if (byName && !byName.active) {
              replaceChoice({ voice: buttons.indexOf(byName), voice_name: byName.text });
              doRequest(byName.url);
            } else {
              if (active) replaceChoice({ voice: buttons.indexOf(active), voice_name: active.text });
              this.display(videos);
            }
          } else {
            replaceChoice({ voice: 0, voice_url: '', voice_name: '' });
            this.display(videos);
          }
        } else if (similar.length) {
          this.similars(similar);
        } else if (items.length) {
          filter_find.season = items.map(function (s) { return { title: s.text, url: s.url }; });
          var sel = getChoice().season;
          var season = filter_find.season[sel] || filter_find.season[0];
          doRequest(season.url);
        } else {
          this.empty();
        }
      } catch (e) {
        this.empty();
      }
    };

    function parseJsonDate(str, name) {
      try {
        var html  = $('<div>' + str + '</div>');
        var elems = [];
        html.find(name).each(function () {
          var item = $(this);
          var data = JSON.parse(item.attr('data-json'));
          var s = item.attr('s'), e = item.attr('e'), text = item.text();
          if (!object.movie.name) {
            if (text.match(/\d+p/i)) { if (!data.quality) { data.quality = {}; data.quality[text] = data.url; } text = object.movie.title; }
            if (text === 'По умолчанию') text = object.movie.title;
          }
          if (e) data.episode = parseInt(e);
          if (s) data.season  = parseInt(s);
          if (text) data.text = text;
          data.active = item.hasClass('active');
          elems.push(data);
        });
        return elems;
      } catch (e) { return []; }
    }

    // ── display ──
    this.display = function (videos) {
      this.draw(videos, {
        onEnter: function (item, html) {
          getFileUrl(item, function (json, json_call) {
            if (json && json.url) {
              var playlist = [];
              var first = toPlayElement(item);
              first.url     = json.url;
              first.headers = json_call.headers || json.headers;
              first.quality = json_call.quality || item.qualitys;
              first.segments = json_call.segments || item.segments;
              first.hls_manifest_timeout = json_call.hls_manifest_timeout || json.hls_manifest_timeout;
              first.subtitles = json.subtitles;
              first.subtitles_call = json_call.subtitles_call || json.subtitles_call;
              orUrlReserve(first);
              setDefaultQuality(first);

              if (item.season) {
                videos.forEach(function (elem) {
                  var cell = toPlayElement(elem);
                  if (elem === item) { cell.url = json.url; }
                  else if (elem.method === 'call') {
                    if (Lampa.Storage.field('player') !== 'inner') {
                      cell.url = elem.stream;
                      delete cell.quality;
                    } else {
                      cell.url = function (call) {
                        getFileUrl(elem, function (s, sj) {
                          if (s.url) {
                            cell.url      = s.url;
                            cell.quality  = sj.quality || elem.qualitys;
                            cell.segments = sj.segments || elem.segments;
                            cell.subtitles = s.subtitles;
                            orUrlReserve(cell); setDefaultQuality(cell); elem.mark();
                          } else { cell.url = ''; Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink')); }
                          call();
                        }, function () { cell.url = ''; call(); });
                      };
                    }
                  } else { cell.url = elem.url; }
                  orUrlReserve(cell); setDefaultQuality(cell);
                  playlist.push(cell);
                });
              } else { playlist.push(first); }

              if (playlist.length > 1) first.playlist = playlist;
              if (first.url) {
                first.isonline = true;
                Lampa.Player.play(first);
                Lampa.Player.playlist(playlist);
                if (first.subtitles_call) loadSubtitles(first.subtitles_call);
                item.mark();
              } else { Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink')); }
            } else { Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink')); }
          }, true);
        },
        onContextMenu: function (item, html, data, call) {
          getFileUrl(item, function (stream) { call({ file: stream.url, quality: item.qualitys }); }, true);
        }
      });

      updateFilter();
    };

    function loadSubtitles(link) {
      network.silent(account(link), function (subs) { Lampa.Player.subtitles(subs); },
        function () {}, false, { headers: addHeaders() });
    }

    function toPlayElement(file) {
      return {
        title:     file.title,
        url:       file.url,
        quality:   file.qualitys,
        timeline:  file.timeline,
        subtitles: file.subtitles,
        segments:  file.segments,
        callback:  file.mark,
        season:    file.season,
        episode:   file.episode,
        voice_name: file.voice_name,
        thumbnail: file.thumbnail
      };
    }

    function orUrlReserve(data) {
      if (data.url && typeof data.url === 'string' && data.url.indexOf(' or ') !== -1) {
        var parts = data.url.split(' or ');
        data.url = parts[0]; data.url_reserve = parts[1];
      }
    }

    function setDefaultQuality(data) {
      if (Lampa.Arrays.getKeys(data.quality || {}).length) {
        for (var q in data.quality) {
          if (parseInt(q) === Lampa.Storage.field('video_quality_default')) {
            data.url = data.quality[q]; orUrlReserve(data);
          }
          if (data.quality[q].indexOf(' or ') !== -1) data.quality[q] = data.quality[q].split(' or ')[0];
        }
      }
    }

    function getFileUrl(file, call, waiting_rch) {
      if (Lampa.Storage.field('player') !== 'inner' && file.stream && Lampa.Platform.is('apple')) {
        var f = Lampa.Arrays.clone(file); f.method = 'play'; f.url = file.stream; call(f, {}); return;
      }
      if (file.method === 'play') { call(file, {}); return; }

      Lampa.Loading.start(function () { Lampa.Loading.stop(); Lampa.Controller.toggle('content'); network.clear(); });
      network['native'](account(file.url), function (json) {
        if (json.rch) {
          if (waiting_rch) { waiting_rch = false; Lampa.Loading.stop(); call(false, {}); }
          else {
            _this.rch(json, function () {
              Lampa.Loading.stop();
              getFileUrl(file, call, true);
            });
          }
        } else { Lampa.Loading.stop(); call(json, json); }
      }, function () { Lampa.Loading.stop(); call(false, {}); }, false, { headers: addHeaders() });
    }

    // ── similars ──
    this.similars = function (json) {
      scroll.clear();
      json.forEach(function (elem) {
        elem.title = elem.text; elem.info = '';
        var year = ((elem.start_date || elem.year || object.movie.release_date || object.movie.first_air_date || '') + '').slice(0, 4);
        var info = [];
        if (year) info.push(year);
        if (elem.details) info.push(elem.details);
        elem.info = info.join('<span class="collaps-split">●</span>');
        elem.time = elem.time || '';
        var item = Lampa.Template.get('collaps_folder', elem);
        if (elem.img) {
          var img = $('<img style="height:7em;width:7em;border-radius:.3em"/>');
          item.find('.collaps-folder__icon').empty().append(img);
          if (elem.img.charAt(0) === '/') elem.img = Defined.localhost + elem.img.substring(1);
          if (elem.img.indexOf('/proxyimg') !== -1) elem.img = account(elem.img);
          Lampa.Utils.imgLoad(img, elem.img);
        }
        item.on('hover:enter', function () { resetView(); doRequest(elem.url); })
            .on('hover:focus', function (e) { last = e.target; scroll.update($(e.target), true); });
        scroll.append(item);
      });
      updateFilter();
      Lampa.Controller.enable('content');
    };

    // ── watched ──
    this.watched = function (set) {
      var fid = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
      var w = Lampa.Storage.cache('online_watched_last', 5000, {});
      if (set) {
        if (!w[fid]) w[fid] = {};
        Lampa.Arrays.extend(w[fid], set, true);
        Lampa.Storage.set('online_watched_last', w);
        updateWatched();
      } else return w[fid];
    };

    function updateWatched() {
      var w = _this.watched();
      var body = scroll.body().find('.collaps-watched .collaps-watched__body').empty();
      if (w) {
        var line = [];
        if (w.voice_name) line.push(w.voice_name);
        if (w.season)     line.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + w.season);
        if (w.episode)    line.push(Lampa.Lang.translate('torrent_serial_episode') + ' ' + w.episode);
        line.forEach(function (n) { body.append('<span>' + n + '</span>'); });
      } else body.append('<span>' + Lampa.Lang.translate('collaps_no_history') + '</span>');
    }

    // ── draw ──
    this.draw = function (items, params) {
      if (!items.length) { this.empty(); return; }
      params = params || {};
      scroll.clear();
      scroll.append(Lampa.Template.get('collaps_watched', {}));
      updateWatched();

      getEpisodes(items[0].season, function (episodes) {
        var viewed      = Lampa.Storage.cache('online_view', 5000, []);
        var serial      = !!object.movie.name;
        var choice      = getChoice();
        var fully       = window.innerWidth > 480;
        var scroll_to   = false, scroll_mark = false;

        items.forEach(function (element, index) {
          var episode     = serial && episodes.length ? episodes.find(function (e) { return e.episode_number === element.episode; }) : false;
          var episode_num = element.episode || index + 1;
          var episode_last = choice.episodes_view[element.season];
          var voice_name  = choice.voice_name || (filter_find.voice[0] ? filter_find.voice[0].title : false) || element.voice_name || (serial ? 'Неизвестно' : element.text) || 'Неизвестно';

          if (element.quality) { element.qualitys = element.quality; element.quality = Lampa.Arrays.getKeys(element.quality)[0]; }

          Lampa.Arrays.extend(element, {
            voice_name: voice_name,
            info:       voice_name.length > 60 ? voice_name.substr(0, 60) + '...' : voice_name,
            quality:    '',
            time:       Lampa.Utils.secondsToTime((episode ? episode.runtime : object.movie.runtime) * 60, true)
          });

          var hash_tl = Lampa.Utils.hash(element.season
            ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('')
            : object.movie.original_title);
          var hash_bh = Lampa.Utils.hash(element.season
            ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.voice_name].join('')
            : object.movie.original_title + element.voice_name);

          if (element.season) {
            element.translate_episode_end = getLastEpisode(items);
            element.translate_voice = element.voice_name;
          }
          if (element.text && !episode) element.title = element.text;
          element.timeline = Lampa.Timeline.view(hash_tl);

          var info = [];
          if (episode) {
            element.title = episode.name;
            if (element.info.length < 30 && episode.vote_average)
              info.push(Lampa.Template.get('collaps_rate', { rate: parseFloat(episode.vote_average + '').toFixed(1) }, true));
            if (episode.air_date && fully) info.push(Lampa.Utils.parseTime(episode.air_date).full);
          } else if (object.movie.release_date && fully) {
            info.push(Lampa.Utils.parseTime(object.movie.release_date).full);
          }
          if (!serial && object.movie.tagline && element.info.length < 30) info.push(object.movie.tagline);
          if (element.info) info.push(element.info);
          if (info.length) element.info = info.map(function (i) { return '<span>' + i + '</span>'; }).join('<span class="collaps-split">●</span>');

          var html   = Lampa.Template.get('collaps_item', element);
          var loader = html.find('.collaps-item__loader');
          var image  = html.find('.collaps-item__img');

          if (!serial) {
            if (choice.movie_view === hash_bh) scroll_to = html;
          } else if (typeof episode_last !== 'undefined' && episode_last === episode_num) {
            scroll_to = html;
          }

          if (serial && !episode) {
            image.append('<div class="collaps-item__num">' + pad2(element.episode || index + 1) + '</div>');
            loader.remove();
          } else {
            var img = html.find('img')[0];
            img.onerror = function () { img.src = './img/img_broken.svg'; };
            img.onload  = function () {
              image.addClass('collaps-item__img--loaded');
              loader.remove();
              if (serial) image.append('<div class="collaps-item__num">' + pad2(element.episode || index + 1) + '</div>');
            };
            img.src = Lampa.TMDB.image('t/p/w300' + (episode ? episode.still_path : object.movie.backdrop_path));
            images.push(img);
            element.thumbnail = img.src;
          }

          html.find('.collaps-item__timeline').append(Lampa.Timeline.render(element.timeline));

          if (viewed.indexOf(hash_bh) !== -1) {
            scroll_mark = html;
            html.find('.collaps-item__img').append('<div class="collaps-viewed">' + Lampa.Template.get('icon_viewed', {}, true) + '</div>');
          }

          element.mark = function () {
            viewed = Lampa.Storage.cache('online_view', 5000, []);
            if (viewed.indexOf(hash_bh) === -1) {
              viewed.push(hash_bh);
              Lampa.Storage.set('online_view', viewed);
              if (!html.find('.collaps-viewed').length)
                html.find('.collaps-item__img').append('<div class="collaps-viewed">' + Lampa.Template.get('icon_viewed', {}, true) + '</div>');
            }
            choice = getChoice();
            if (!serial) choice.movie_view = hash_bh;
            else choice.episodes_view[element.season] = episode_num;
            saveChoice(choice);

            var vn = choice.voice_name || element.voice_name || element.title;
            if (vn.length > 30) vn = vn.slice(0, 30) + '...';
            _this.watched({ balanser: BALANSER_NAME, balanser_name: 'Collaps', voice_id: choice.voice_id, voice_name: vn, episode: element.episode, season: element.season });
          };
          element.unmark = function () {
            viewed = Lampa.Storage.cache('online_view', 5000, []);
            if (viewed.indexOf(hash_bh) !== -1) {
              Lampa.Arrays.remove(viewed, hash_bh);
              Lampa.Storage.set('online_view', viewed);
              html.find('.collaps-viewed').remove();
            }
          };
          element.timeclear = function () {
            element.timeline.percent = element.timeline.time = element.timeline.duration = 0;
            Lampa.Timeline.update(element.timeline);
          };

          html.on('hover:enter', function () {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            if (params.onEnter) params.onEnter(element, html, { hash_timeline: hash_tl, hash_behold: hash_bh });
          }).on('hover:focus', function (e) {
            last = e.target;
            scroll.update($(e.target), true);
          });

          contextMenu({ html: html, element: element,
            onFile: function (call) { if (params.onContextMenu) params.onContextMenu(element, html, {}, call); },
            onClearAllMark: function () { items.forEach(function (el) { el.unmark(); }); },
            onClearAllTime: function () { items.forEach(function (el) { el.timeclear(); }); }
          });

          scroll.append(html);
        }); // end items.forEach

        // ещё не вышедшие серии
        if (serial && episodes.length > items.length) {
          episodes.slice(items.length).forEach(function (ep) {
            var info = [];
            if (ep.vote_average) info.push(Lampa.Template.get('collaps_rate', { rate: parseFloat(ep.vote_average + '').toFixed(1) }, true));
            if (ep.air_date) info.push(Lampa.Utils.parseTime(ep.air_date).full);
            var air = new Date((ep.air_date + '').replace(/-/g, '/')), day = Math.round((air.getTime() - Date.now()) / 86400000);
            var html = Lampa.Template.get('collaps_item', {
              time:    Lampa.Utils.secondsToTime((ep.runtime || object.movie.runtime) * 60, true),
              info:    info.length ? info.map(function (i) { return '<span>' + i + '</span>'; }).join('<span class="collaps-split">●</span>') : '',
              title:   ep.name,
              quality: day > 0 ? Lampa.Lang.translate('full_episode_days_left') + ': ' + day : ''
            });
            var loader = html.find('.collaps-item__loader'), image = html.find('.collaps-item__img');
            var season = items[0] ? items[0].season : 1;
            html.find('.collaps-item__timeline').append(Lampa.Timeline.render(Lampa.Timeline.view(Lampa.Utils.hash([season, ep.episode_number, object.movie.original_title].join('')))));
            var img = html.find('img')[0];
            if (ep.still_path) {
              img.onerror = function () { img.src = './img/img_broken.svg'; };
              img.onload  = function () { image.addClass('collaps-item__img--loaded'); loader.remove(); image.append('<div class="collaps-item__num">' + pad2(ep.episode_number) + '</div>'); };
              img.src = Lampa.TMDB.image('t/p/w300' + ep.still_path);
              images.push(img);
            } else { loader.remove(); image.append('<div class="collaps-item__num">' + pad2(ep.episode_number) + '</div>'); }
            html.on('hover:focus', function (e) { last = e.target; scroll.update($(e.target), true); });
            html.css('opacity', '0.5');
            scroll.append(html);
          });
        }

        last = scroll_to ? scroll_to[0] : scroll_mark ? scroll_mark[0] : false;
        Lampa.Controller.enable('content');
      });
    };

    function getEpisodes(season, call) {
      var tmdb_id = object.movie.id;
      if (['cub', 'tmdb'].indexOf(object.movie.source || 'tmdb') === -1) tmdb_id = object.movie.tmdb_id;
      if (typeof tmdb_id === 'number' && object.movie.name) {
        Lampa.Api.sources.tmdb.get('tv/' + tmdb_id + '/season/' + season, {}, function (d) { call(d.episodes || []); }, function () { call([]); });
      } else call([]);
    }

    function getLastEpisode(items) {
      var n = 0; items.forEach(function (e) { if (typeof e.episode !== 'undefined') n = Math.max(n, parseInt(e.episode)); }); return n;
    }

    // ── filter ──
    function updateFilter() {
      var select = [];
      select.push({ title: Lampa.Lang.translate('torrent_parser_reset'), reset: true });
      var ch = getChoice();

      function addFilterItem(type, title) {
        var arr = filter_find[type];
        if (!arr.length) return;
        select.push({
          title: title,
          subtitle: arr[ch[type]] ? arr[ch[type]].title : '',
          items: arr.map(function (n, i) { return { title: n.title, selected: ch[type] === i, index: i }; }),
          stype: type
        });
      }

      addFilterItem('voice',  Lampa.Lang.translate('torrent_parser_voice'));
      addFilterItem('season', Lampa.Lang.translate('torrent_serial_season'));
      filter.set('filter', select);

      var chosen = [];
      ['voice','season'].forEach(function (t) {
        if (filter_find[t].length) {
          var lbl = t === 'voice' ? filter_translate.voice : filter_translate.season;
          chosen.push(lbl + ': ' + (filter_find[t][ch[t]] ? filter_find[t][ch[t]].title : ''));
        }
      });
      filter.chosen('filter', chosen);
      filter.set('sort', [{ title: 'Collaps', source: BALANSER_NAME, selected: true }]);
      filter.chosen('sort', ['Collaps']);
    }

    // ── context menu ──
    function contextMenu(params) {
      params.html.on('hover:long', function () {
        function show(extra) {
          var enabled = Lampa.Controller.enabled().name;
          var menu = [];
          if (Lampa.Platform.is('webos'))   menu.push({ title: Lampa.Lang.translate('player_lauch') + ' - Webos',   player: 'webos'   });
          if (Lampa.Platform.is('android')) menu.push({ title: Lampa.Lang.translate('player_lauch') + ' - Android', player: 'android' });
          menu.push({ title: Lampa.Lang.translate('player_lauch') + ' - Lampa', player: 'lampa' });
          menu.push({ title: Lampa.Lang.translate('lampac_video'), separator: true });
          menu.push({ title: Lampa.Lang.translate('torrent_parser_label_title'),        mark:        true });
          menu.push({ title: Lampa.Lang.translate('torrent_parser_label_cancel_title'), unmark:      true });
          menu.push({ title: Lampa.Lang.translate('time_reset'),                        timeclear:   true });
          if (extra && extra.file) menu.push({ title: Lampa.Lang.translate('copy_link'), copylink: true });
          menu.push({ title: Lampa.Lang.translate('more'), separator: true });
          menu.push({ title: Lampa.Lang.translate('lampac_clear_all_marks'),     clearallmark: true });
          menu.push({ title: Lampa.Lang.translate('lampac_clear_all_timecodes'), timeclearall: true });

          Lampa.Select.show({
            title: Lampa.Lang.translate('title_action'),
            items: menu,
            onBack: function () { Lampa.Controller.toggle(enabled); },
            onSelect: function (a) {
              if (a.mark)         params.element.mark();
              if (a.unmark)       params.element.unmark();
              if (a.timeclear)    params.element.timeclear();
              if (a.clearallmark) params.onClearAllMark();
              if (a.timeclearall) params.onClearAllTime();
              Lampa.Controller.toggle(enabled);
              if (a.player) { Lampa.Player.runas(a.player); params.html.trigger('hover:enter'); }
              if (a.copylink && extra) {
                if (extra.quality) {
                  var qual = [];
                  for (var q in extra.quality) qual.push({ title: q, file: extra.quality[q] });
                  Lampa.Select.show({
                    title: Lampa.Lang.translate('settings_server_links'),
                    items: qual,
                    onBack: function () { Lampa.Controller.toggle(enabled); },
                    onSelect: function (b) {
                      Lampa.Utils.copyTextToClipboard(b.file,
                        function () { Lampa.Noty.show(Lampa.Lang.translate('copy_secuses')); },
                        function () { Lampa.Noty.show(Lampa.Lang.translate('copy_error')); });
                    }
                  });
                } else {
                  Lampa.Utils.copyTextToClipboard(extra.file,
                    function () { Lampa.Noty.show(Lampa.Lang.translate('copy_secuses')); },
                    function () { Lampa.Noty.show(Lampa.Lang.translate('copy_error')); });
                }
              }
            }
          });
        }
        params.onFile(show);
      }).on('hover:focus', function () {
        if (Lampa.Helper) Lampa.Helper.show('online_file', Lampa.Lang.translate('helper_online_file'), params.html);
      });
    }

    // ── empty / error ──
    this.empty = function () {
      var html = Lampa.Template.get('collaps_empty', {});
      scroll.clear();
      scroll.append(html);
      this.activity.loader(false);
    };

    // ── filter events ──
    filter.onSearch = function (value) {
      Lampa.Activity.replace({ search: value, clarification: true, similar: true });
    };
    filter.onBack = function () { _this.start(); };
    filter.render().find('.selector').on('hover:enter', function () { clearInterval(balanser_timer); });
    filter.render().find('.filter--search').appendTo(filter.render().find('.torrent-filter'));
    filter.onSelect = function (type, a, b) {
      if (type !== 'filter') return;
      if (a.reset) {
        replaceChoice({ season: 0, voice: 0, voice_url: '', voice_name: '' });
        setTimeout(function () { Lampa.Select.close(); Lampa.Activity.replace({ clarification: 0, similar: 0 }); }, 10);
      } else {
        var url = filter_find[a.stype][b.index].url;
        var ch = getChoice();
        if (a.stype === 'voice') { ch.voice_name = filter_find.voice[b.index].title; ch.voice_url = url; }
        ch[a.stype] = b.index;
        saveChoice(ch);
        resetView();
        doRequest(url);
        setTimeout(Lampa.Select.close, 10);
      }
    };

    // ── lifecycle ──
    this.initialize = function () {
      this.loading(true);
      if (filter.addButtonBack) filter.addButtonBack();
      filter.render().find('.filter--sort span').text('Collaps');
      scroll.body().addClass('torrent-list');
      files.appendFiles(scroll.render());
      files.appendHead(filter.render());
      scroll.minus(files.render().find('.explorer__files-head'));
      scroll.body().append(Lampa.Template.get('collaps_loading', {}));
      Lampa.Controller.enable('content');
      this.loading(false);

      this.externalids().then(function () {
        return new Promise(function (resolve, reject) {
          var url = requestParams(BALANSER_URL);
          network.timeout(15000);
          network.silent(account(url), resolve, reject, false, { headers: addHeaders() });
        });
      }).then(function (json) {
        // если сервер вернул json сразу — обрабатываем
        _this.parse(json);
        filter.render().find('.filter--search').removeClass('hide');
      })['catch'](function () { _this.empty(); });
    };

    this.find = function () { doRequest(requestParams(BALANSER_URL)); };

    this.create  = function () { return this.render(); };
    this.render  = function () { return files.render(); };
    this.back    = function () { Lampa.Activity.backward(); };
    this.pause   = function () {};
    this.stop    = function () {};

    this.loading = function (status) {
      if (status) this.activity.loader(true);
      else { this.activity.loader(false); this.activity.toggle(); }
    };

    this.start = function () {
      if (Lampa.Activity.active().activity !== this.activity) return;
      if (!initialized) { initialized = true; this.initialize(); }
      Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(object.movie));
      Lampa.Controller.add('content', {
        toggle: function () { Lampa.Controller.collectionSet(scroll.render(), files.render()); Lampa.Controller.collectionFocus(last || false, scroll.render()); },
        gone:   function () { clearTimeout(balanser_timer); },
        up:     function () { if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
        down:   function () { Navigator.move('down'); },
        right:  function () { if (Navigator.canmove('right')) Navigator.move('right'); else filter.show(Lampa.Lang.translate('title_filter'), 'filter'); },
        left:   function () { if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
        back:   _this.back.bind(_this)
      });
      Lampa.Controller.toggle('content');
    };

    this.destroy = function () {
      network.clear();
      clearImages();
      files.destroy();
      scroll.destroy();
      clearInterval(balanser_timer);
    };
  }

  // ─── Инициализация плагина ────────────────────────────────────────────────
  function startPlugin() {
    window.collaps_plugin = true;

    // Локализация
    Lampa.Lang.add({
      collaps_watch: {
        ru: 'Смотреть (Collaps)', uk: 'Дивитися (Collaps)',
        en: 'Watch (Collaps)',   zh: '观看 (Collaps)'
      },
      collaps_no_history: {
        ru: 'Нет истории просмотра', uk: 'Немає історії перегляду',
        en: 'No watch history',      zh: '没有观看历史'
      },
      lampac_nolink:       { ru: 'Не удалось извлечь ссылку', uk: 'Неможливо отримати посилання', en: 'Failed to fetch link', zh: '获取链接失败' },
      lampac_video:        { ru: 'Видео',   uk: 'Відео',   en: 'Video',   zh: '视频' },
      lampac_clear_all_marks:     { ru: 'Очистить все метки',     uk: 'Очистити всі мітки',     en: 'Clear all labels',     zh: '清除所有标签' },
      lampac_clear_all_timecodes: { ru: 'Очистить все тайм-коды', uk: 'Очистити всі тайм-коди', en: 'Clear all timecodes',  zh: '清除所有时间代码' },
      helper_online_file:  { ru: 'Удерживайте "ОК" для контекстного меню', uk: 'Утримуйте "ОК" для контекстного меню', en: 'Hold "OK" for context menu', zh: '按住"确定"调出菜单' },
      title_online:        { ru: 'Онлайн', uk: 'Онлайн', en: 'Online', zh: '在线' }
    });

    // CSS
    Lampa.Template.add('collaps_css', "<style>\n.collaps-item{position:relative;border-radius:.3em;background:rgba(0,0,0,.3);display:flex;margin-bottom:1.5em}\n.collaps-item__img{position:relative;width:13em;flex-shrink:0;min-height:8.2em;border-radius:.3em .0 .3em 0;overflow:hidden}\n.collaps-item__img>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:.3em;opacity:0;transition:opacity .3s}\n.collaps-item__img--loaded>img{opacity:1}\n@media(max-width:480px){.collaps-item__img{width:7em;min-height:6em}}\n.collaps-item__loader{position:absolute;top:50%;left:50%;width:2em;height:2em;margin:-1em 0 0 -1em;background:url(./img/loader.svg) no-repeat center/contain}\n.collaps-item__body{padding:1.2em;flex-grow:1;line-height:1.3}\n@media(max-width:480px){.collaps-item__body{padding:.8em 1.2em}}\n.collaps-item__head,.collaps-item__foot{display:flex;justify-content:space-between;align-items:center}\n.collaps-item__title{font-size:1.7em;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}\n@media(max-width:480px){.collaps-item__title{font-size:1.4em}}\n.collaps-item__time{padding-left:2em}\n.collaps-item__info{display:flex;align-items:center;overflow:hidden;text-overflow:ellipsis}\n.collaps-item__quality{padding-left:1em;white-space:nowrap}\n.collaps-item__timeline{margin:.8em 0}\n.collaps-item__timeline>.time-line{display:block!important}\n.collaps-item__num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2em}\n.collaps-item.focus::after{content:'';position:absolute;top:-.6em;left:-.6em;right:-.6em;bottom:-.6em;border-radius:.7em;border:solid .3em #fff;z-index:-1;pointer-events:none}\n.collaps-viewed{position:absolute;top:1em;left:1em;background:rgba(0,0,0,.45);border-radius:100%;padding:.25em;font-size:.76em}\n.collaps-viewed>svg{width:1.5em!important;height:1.5em!important}\n.collaps-folder{position:relative;border-radius:.3em;background:rgba(0,0,0,.3);display:flex;margin-bottom:1.5em}\n.collaps-folder__icon{padding:1em;flex-shrink:0}\n.collaps-folder__icon>svg{width:4.4em!important;height:4.4em!important}\n.collaps-folder__body{padding:1.2em;flex-grow:1;line-height:1.3}\n.collaps-folder.focus::after{content:'';position:absolute;top:-.6em;left:-.6em;right:-.6em;bottom:-.6em;border-radius:.7em;border:solid .3em #fff;z-index:-1;pointer-events:none}\n.collaps-watched{padding:1em;display:flex;align-items:center}\n.collaps-watched__icon>svg{width:1.5em;height:1.5em}\n.collaps-watched__body{padding-left:1em;display:flex;flex-wrap:wrap}\n.collaps-watched__body>span+span::before{content:' ● ';display:inline-block;margin:0 .5em}\n.collaps-rate{display:inline-flex;align-items:center}\n.collaps-rate>svg{width:1.3em!important;height:1.3em!important}\n.collaps-rate>span{font-weight:600;font-size:1.1em;padding-left:.7em}\n.collaps-split{font-size:.8em;margin:0 1em;flex-shrink:0}\n.collaps-empty{padding:2em;line-height:1.5}\n.collaps-empty__title{font-size:1.8em;margin-bottom:.3em}\n.collaps-empty__body{font-size:1.2em;font-weight:300}\n.collaps-loading{padding:2em}\n.collaps-loading .broadcast__scan{margin-bottom:1em}\n</style>");
    $('body').append(Lampa.Template.get('collaps_css', {}, true));

    function setupTemplates() {
      Lampa.Template.add('collaps_item',
        '<div class="collaps-item selector">' +
          '<div class="collaps-item__img"><img alt=""><div class="collaps-item__loader"></div></div>' +
          '<div class="collaps-item__body">' +
            '<div class="collaps-item__head"><div class="collaps-item__title">{title}</div><div class="collaps-item__time">{time}</div></div>' +
            '<div class="collaps-item__timeline"></div>' +
            '<div class="collaps-item__foot"><div class="collaps-item__info">{info}</div><div class="collaps-item__quality">{quality}</div></div>' +
          '</div>' +
        '</div>');

      Lampa.Template.add('collaps_folder',
        '<div class="collaps-folder selector">' +
          '<div class="collaps-folder__icon">' +
            '<svg viewBox="0 0 128 112" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<rect y="20" width="128" height="92" rx="13" fill="white"/>' +
              '<path d="M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z" fill="white" fill-opacity=".23"/>' +
              '<rect x="11" y="8" width="106" height="76" rx="13" fill="white" fill-opacity=".51"/>' +
            '</svg>' +
          '</div>' +
          '<div class="collaps-folder__body">' +
            '<div class="collaps-item__head"><div class="collaps-item__title">{title}</div><div class="collaps-item__time">{time}</div></div>' +
            '<div class="collaps-item__foot"><div class="collaps-item__info">{info}</div></div>' +
          '</div>' +
        '</div>');

      Lampa.Template.add('collaps_watched',
        '<div class="collaps-watched selector">' +
          '<div class="collaps-watched__icon">' +
            '<svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<circle cx="10.5" cy="10.5" r="9" stroke="currentColor" stroke-width="3"/>' +
              '<path d="M14.8477 10.5628L8.20312 14.399L8.20313 6.72656L14.8477 10.5628Z" fill="currentColor"/>' +
            '</svg>' +
          '</div>' +
          '<div class="collaps-watched__body"></div>' +
        '</div>');

      Lampa.Template.add('collaps_rate',
        '<div class="collaps-rate">' +
          '<svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M8.39409 0.192139L10.99 5.30994L16.7882 6.20387L12.5475 10.4277L13.5819 15.9311L8.39409 13.2425L3.20626 15.9311L4.24065 10.4277L0 6.20387L5.79819 5.30994L8.39409 0.192139Z" fill="#fff"/>' +
          '</svg>' +
          '<span>{rate}</span>' +
        '</div>');

      Lampa.Template.add('collaps_loading',
        '<div class="collaps-loading">' +
          '<div class="broadcast__scan"><div></div></div>' +
        '</div>');

      Lampa.Template.add('collaps_empty',
        '<div class="collaps-empty">' +
          '<div class="collaps-empty__title">#{empty_title_two}</div>' +
          '<div class="collaps-empty__body">#{empty_text}</div>' +
        '</div>');
    }

    Lampa.Component.add('collaps', component);
    setupTemplates();

    // ── Кнопка на карточке ──
    var BUTTON_HTML =
      '<div class="full-start__button selector view--online collaps--btn" data-subtitle="Collaps">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 392.697 392.697">' +
          '<path d="M21.837,83.419l36.496,16.678L227.72,19.886c1.229-0.592,2.002-1.846,1.98-3.209c-0.021-1.365-0.834-2.592-2.082-3.145L197.766,0.3c-0.903-0.4-1.933-0.4-2.837,0L21.873,77.036c-1.259,0.559-2.073,1.803-2.081,3.18C19.784,81.593,20.584,82.847,21.837,83.419z" fill="currentColor"/>' +
          '<path d="M185.689,177.261l-64.988-30.01v91.617c0,0.856-0.44,1.655-1.167,2.114c-0.406,0.257-0.869,0.386-1.333,0.386c-0.368,0-0.736-0.082-1.079-0.244l-68.874-32.625c-0.869-0.416-1.421-1.293-1.421-2.256v-92.229L6.804,95.5c-1.083-0.496-2.344-0.406-3.347,0.238c-1.002,0.645-1.608,1.754-1.608,2.944v208.744c0,1.371,0.799,2.615,2.045,3.185l178.886,81.768c0.464,0.211,0.96,0.315,1.455,0.315c0.661,0,1.318-0.188,1.892-0.555c1.002-0.645,1.608-1.754,1.608-2.945V180.445C187.735,179.076,186.936,177.831,185.689,177.261z" fill="currentColor"/>' +
          '<path d="M389.24,95.74c-1.002-0.644-2.264-0.732-3.347-0.238l-178.876,81.76c-1.246,0.57-2.045,1.814-2.045,3.185v208.751c0,1.191,0.606,2.302,1.608,2.945c0.572,0.367,1.23,0.555,1.892,0.555c0.495,0,0.991-0.104,1.455-0.315l178.876-81.768c1.246-0.568,2.045-1.813,2.045-3.185V98.685C390.849,97.494,390.242,96.384,389.24,95.74z" fill="currentColor"/>' +
          '<path d="M372.915,80.216c-0.009-1.377-0.823-2.621-2.082-3.18l-60.182-26.681c-0.938-0.418-2.013-0.399-2.938,0.045l-173.755,82.992l60.933,29.117c0.462,0.211,0.958,0.316,1.455,0.316s0.993-0.105,1.455-0.316l173.066-79.092C372.122,82.847,372.923,81.593,372.915,80.216z" fill="currentColor"/>' +
        '</svg>' +
        '<span>Collaps</span>' +
      '</div>';

    function addButton(e) {
      if (e.render.find('.collaps--btn').length) return;
      var btn = $(BUTTON_HTML);
      btn.on('hover:enter', function () {
        setupTemplates();
        Lampa.Component.add('collaps', component);
        Lampa.Activity.push({
          url:        '',
          title:      'Collaps — ' + (e.movie.title || e.movie.name),
          component:  'collaps',
          search:     e.movie.title || e.movie.name,
          search_one: e.movie.title,
          search_two: e.movie.original_title,
          movie:      e.movie,
          page:       1
        });
      });
      e.render.after(btn);
    }

    Lampa.Listener.follow('full', function (e) {
      if (e.type === 'complite') {
        addButton({
          render: e.object.activity.render().find('.view--torrent'),
          movie:  e.data.movie
        });
      }
    });

    try {
      if (Lampa.Activity.active().component === 'full') {
        addButton({
          render: Lampa.Activity.active().activity.render().find('.view--torrent'),
          movie:  Lampa.Activity.active().card
        });
      }
    } catch (e) {}

    // Синхронизация выбора через аккаунт
    if (Lampa.Manifest.app_digital >= 177) {
      Lampa.Storage.sync('online_choice_' + BALANSER_NAME, 'object_object');
      Lampa.Storage.sync('online_watched_last', 'object_object');
    }
  }

  if (!window.collaps_plugin) startPlugin();

})();
