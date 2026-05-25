(function () {
    'use strict';

    // ─── Переводы ─────────────────────────────────────────────────────────────────
    if (Lampa.Lang) {
        Lampa.Lang.add({
            online_title:     { ru: 'Онлайн',                       en: 'Online',               uk: 'Онлайн' },
            online_balancer:  { ru: 'Балансер',                      en: 'Balancer',             uk: 'Балансер' },
            online_nolink:    { ru: 'Не удалось получить ссылку',    en: 'Failed to get link',   uk: 'Не вдалося отримати посилання' },
            online_waitlink:  { ru: 'Извлекаем ссылку, подождите…', en: 'Getting link, wait…',  uk: 'Отримуємо посилання…' },
            online_empty:     { ru: 'Источники не найдены',          en: 'No sources found',     uk: 'Джерела не знайдено' },
            online_query_start: { ru: 'По запросу',                  en: 'Query',                uk: 'За запитом' },
            online_query_end:   { ru: 'нет результатов',             en: 'no results',           uk: 'немає результатів' },
            online_proxy:     { ru: 'Прокси Online',                 en: 'Online Proxy',         uk: 'Проксі Online' },
            online_proxy_ph:  { ru: 'http://proxy.com/',             en: 'http://proxy.com/',    uk: 'http://proxy.com/' },
        });
    }

    var T = function (k) { return Lampa.Lang && Lampa.Lang.translate ? Lampa.Lang.translate(k) : k; };

    // ─── Шаблоны ─────────────────────────────────────────────────────────────────
    function addTemplates() {
        Lampa.Template.add('online',
            '<div class="online selector">' +
            '<div class="online__body">' +
            '<div style="position:absolute;left:0;top:-.3em;width:2.4em;height:2.4em">' +
            '<svg style="height:2.4em;width:2.4em" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>' +
            '<path d="M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z" fill="white"/>' +
            '</svg></div>' +
            '<div class="online__title" style="padding-left:2.1em">{title}</div>' +
            '<div class="online__quality" style="padding-left:3.4em">{quality}{info}</div>' +
            '</div></div>'
        );
        Lampa.Template.add('online_folder',
            '<div class="online selector">' +
            '<div class="online__body">' +
            '<div style="position:absolute;left:0;top:-.3em;width:2.4em;height:2.4em">' +
            '<svg style="height:2.4em;width:2.4em" viewBox="0 0 128 112" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<rect y="20" width="128" height="92" rx="13" fill="white"/>' +
            '<path d="M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z" fill="white" fill-opacity=".23"/>' +
            '<rect x="11" y="8" width="106" height="76" rx="13" fill="white" fill-opacity=".51"/>' +
            '</svg></div>' +
            '<div class="online__title" style="padding-left:2.1em">{title}</div>' +
            '<div class="online__quality" style="padding-left:3.4em">{quality}{info}</div>' +
            '</div></div>'
        );
    }

    // ─── Прокси ───────────────────────────────────────────────────────────────────
    function getProxy(name) {
        var p = Lampa.Storage.get('online_proxy_' + name, '') || Lampa.Storage.get('online_proxy_all', '');
        if (p && p.slice(-1) !== '/') p += '/';
        return p;
    }

    // ─── Парсеры источников ───────────────────────────────────────────────────────

    // Общая функция для открытия файла в плеере
    function openInPlayer(object, element, items) {
        if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
        if (!element.file) { Lampa.Noty.show(T('online_nolink')); return; }

        var viewed   = Lampa.Storage.cache('online_view', 5000, []);
        var hash     = Lampa.Utils.hash(
            element.season
                ? [element.season, element.episode, object.movie.original_title, element.voice || ''].join('')
                : (object.movie.original_title || '') + (element.title || '')
        );
        var timeline = Lampa.Timeline.view(hash);

        var first = {
            url:      element.file,
            title:    element.season
                        ? (element.title || '')
                        : ((object.movie.title || object.movie.name || '') + (element.title ? ' / ' + element.title : '')),
            timeline: timeline,
            quality:  element.quality || false,
            subtitles: element.subtitles || false
        };

        var playlist = [];
        if (element.season && items && items.length) {
            items.forEach(function (e) {
                playlist.push({ title: e.title, url: e.file, timeline: Lampa.Timeline.view(
                    Lampa.Utils.hash([e.season, e.episode, object.movie.original_title, e.voice || ''].join(''))
                ), subtitles: e.subtitles || false });
            });
        } else {
            playlist.push(first);
        }

        if (playlist.length > 1) first.playlist = playlist;

        Lampa.Player.play(first);
        Lampa.Player.playlist(playlist);
    }

    // ── 1. Collaps ────────────────────────────────────────────────────────────────
    // Парсим embed-страницу и достаём HLS-потоки
    function CollapsSource(comp, object) {
        var network = new Lampa.Reguest();
        var embed   = getProxy('collaps') + 'https://api.delivembd.ws/embed/';
        var extract = {};
        var filter_items = { season: [], voice: [] };
        var choice  = { season: 0, voice: 0 };
        var items_cache = [];

        this.search = function (kp_id) {
            var url = embed + 'kp/' + kp_id;
            network.silent(url, function (str) {
                if (str) parse(str);
                else      comp.emptyForQuery(object.movie.title);
                comp.loading(false);
            }, function (a, c) {
                comp.empty(network.errorDecode ? network.errorDecode(a, c) : '');
            }, false, { dataType: 'text' });
        };

        this.filter  = function (type, a, b) { choice[a.stype] = b.index; comp.reset(); doFilter(); appendItems(filtred()); comp.saveChoice(choice); };
        this.reset   = function ()            { comp.reset(); choice = { season: 0, voice: 0 }; doFilter(); appendItems(filtred()); comp.saveChoice(choice); };
        this.destroy = function ()            { network.clear(); };
        this.extendChoice = function (s)      { Lampa.Arrays.extend(choice, s, true); };

        function parse(str) {
            str = str.replace(/\n/g, '');
            var find = str.match(/makePlayer\(\{(.*?)\}\);/);
            if (find) {
                try { extract = eval('({' + find[1] + '})'); } catch (e) {}
                if (extract) { doFilter(); appendItems(filtred()); } else comp.emptyForQuery(object.movie.title);
            } else comp.emptyForQuery(object.movie.title);
        }

        function doFilter() {
            filter_items = { season: [], voice: [] };
            if (extract.playlist && extract.playlist.seasons) {
                extract.playlist.seasons.forEach(function (s) {
                    filter_items.season.push(T('torrent_serial_season') + ' ' + s.season);
                });
            }
            comp.filter(filter_items, choice);
        }

        function filtred() {
            var out = [];
            var fd  = Lampa.Storage.get('online_filter', '{}');
            if (extract.playlist && extract.playlist.seasons) {
                extract.playlist.seasons.forEach(function (season, i) {
                    if (i == (fd.season || 0)) {
                        season.episodes.forEach(function (ep) {
                            out.push({
                                file:     ep.hls,
                                episode:  parseInt(ep.episode),
                                season:   season.season,
                                title:    ep.title || (T('torrent_serial_season') + ' ' + season.season + ' ' + ep.episode),
                                quality:  '',
                                info:     ep.audio && ep.audio.names ? ep.audio.names.slice(0, 5).join(', ') : '',
                                subtitles: ep.cc ? ep.cc.map(function (c) { return { label: c.name, url: c.url }; }) : false
                            });
                        });
                    }
                });
            } else if (extract.source) {
                out.push({
                    file:     extract.source.hls,
                    title:    extract.title || 'Collaps',
                    quality:  '',
                    info:     extract.source.audio && extract.source.audio.names ? extract.source.audio.names.slice(0, 5).join(', ') : '',
                    subtitles: extract.source.cc ? extract.source.cc.map(function (c) { return { label: c.name, url: c.url }; }) : false
                });
            }
            items_cache = out;
            return out;
        }

        function appendItems(items) {
            comp.reset();
            var viewed = Lampa.Storage.cache('online_view', 5000, []);
            items.forEach(function (element) {
                var hash_file = Lampa.Utils.hash(element.season
                    ? [element.season, element.episode, object.movie.original_title, 'collaps'].join('')
                    : (object.movie.original_title || '') + 'collaps');
                var view = Lampa.Timeline.view(hash_file);
                var item = Lampa.Template.get('online', element);
                element.timeline = view;
                item.append(Lampa.Timeline.render(view));
                if (Lampa.Timeline.details) item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
                if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                item.on('hover:enter', function () {
                    openInPlayer(object, element, items_cache);
                    if (viewed.indexOf(hash_file) === -1) {
                        viewed.push(hash_file);
                        item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                        Lampa.Storage.set('online_view', viewed);
                    }
                });
                comp.append(item);
            });
            comp.start(true);
        }
    }

    // ── 2. VideoCDN ───────────────────────────────────────────────────────────────
    // Ищем по API, потом парсим iframe для mp4
    function VideoCDNSource(comp, object) {
        var network  = new Lampa.Reguest();
        var base_api = 'http://cdn.svetacdn.in/api/';
        var extract  = {};
        var results  = [];
        var filter_items = { season: [], voice: [] };
        var choice   = { season: 0, voice: 0, voice_name: '', voice_id: 0 };
        var items_cache = [];
        var get_links_wait = false;

        this.search = function (_object, data) {
            object = _object;
            get_links_wait = true;
            var itm  = data[0];
            var type = itm.iframe_src.split('/').slice(-2)[0];
            if (type === 'movie') type = 'movies';
            var url = getProxy('videocdn') + base_api + type;
            url = Lampa.Utils.addUrlComponent(url, 'api_token=3i40G5TSECmLF77oAqnEgbx61ZWaOYaE');
            url = Lampa.Utils.addUrlComponent(url, itm.imdb_id ? 'imdb_id=' + encodeURIComponent(itm.imdb_id) : 'title=' + encodeURIComponent(itm.title));
            url = Lampa.Utils.addUrlComponent(url, 'field=global');
            network.silent(url, function (found) {
                results = (found.data || []).filter(function (e) { return e.id === itm.id; });
                if (results.length) { extractData(results); }
                else { comp.loading(false); comp.emptyForQuery(object.movie.title || object.search); }
            }, function (a, c) { comp.empty(network.errorDecode ? network.errorDecode(a, c) : ''); });
        };

        this.filter  = function (type, a, b) { choice[a.stype] = b.index; if (a.stype === 'voice') { choice.voice_name = filter_items.voice[b.index]; } comp.reset(); doFilter(); appendItems(filtred()); comp.saveChoice(choice); };
        this.reset   = function ()            { comp.reset(); choice = { season: 0, voice: 0, voice_name: '', voice_id: 0 }; doFilter(); appendItems(filtred()); comp.saveChoice(choice); };
        this.destroy = function ()            { network.clear(); results = null; };
        this.extendChoice = function (s)      { Lampa.Arrays.extend(choice, s, true); };

        function extractItems(str, max_q) {
            try {
                return str.split(',').map(function (item) {
                    return {
                        quality: parseInt(item.match(/\[(\d+)p\]/)[1]),
                        file: 'http:' + item.replace(/\[\d+p\]/, '').split(' or ')[0]
                    };
                }).filter(function (i) { return i.quality <= (max_q || 1080); })
                 .sort(function (a, b) { return b.quality - a.quality; });
            } catch (e) { return []; }
        }

        function extractData(res) {
            var movie = res[0];
            if (!movie) return;
            var src = 'http:' + movie.iframe_src;
            network.native(src, function (raw) {
                get_links_wait = false;
                comp.render().find('.broadcast__scan').remove();
                var math = raw.replace(/\n/g, '').match(/id="files" value="(.*?)"/);
                if (math) {
                    var json = Lampa.Arrays.decodeJson(math[1].replace(/&quot;/g, '"'), {});
                    var text = document.createElement('textarea');
                    extract  = {};
                    for (var i in json) {
                        if (i - 0 === 0) continue;
                        text.innerHTML = json[i];
                        var max_q = (movie.media && movie.media.filter(function (o) { return o.translation_id === (i - 0); })[0] || {}).max_quality
                                 || (movie.translations && movie.translations.filter(function (o) { return o.id === (i - 0); })[0] || {}).max_quality;
                        extract[i] = {
                            json:  Lampa.Arrays.decodeJson(text.value, {}),
                            items: extractItems(json[i], max_q)
                        };
                    }
                }
                doFilter();
                appendItems(filtred());
                comp.loading(false);
            }, function () { comp.loading(false); comp.emptyForQuery(object.movie.title || object.search); }, false, { dataType: 'text' });
        }

        function getBestFile(el) {
            var translat = extract[el.translation];
            if (!translat) return { file: '', quality: false };
            var items = [];
            if (el.season) {
                var id = el.season + '_' + el.episode;
                for (var k in translat.json) {
                    var elem = translat.json[k];
                    if (elem.folder) {
                        for (var f in elem.folder) {
                            if (elem.folder[f].id === id) { items = elem.folder[f].items || []; break; }
                        }
                    } else if (elem.id === id) { items = elem.items || []; break; }
                }
            } else {
                items = translat.items || [];
            }
            var quality  = {};
            var file     = '';
            var pref_q   = (Lampa.Storage.get('video_quality_default', '1080') - 0);
            var mass     = [1080, 720, 480, 360];
            var start    = Math.max(0, mass.indexOf(pref_q));
            mass.slice(start).forEach(function (n) {
                var ex = items.find ? items.find(function (a) { return a.quality === n; }) : null;
                if (!ex) { for (var ii = 0; ii < items.length; ii++) { if (items[ii].quality === n) { ex = items[ii]; break; } } }
                if (ex) { if (!file) file = ex.file; quality[n + 'p'] = ex.file; }
            });
            return { file: file, quality: file ? quality : false };
        }

        function doFilter() {
            filter_items = { season: [], voice: [], voice_info: [] };
            var movie = (results || [])[0];
            if (!movie) return;
            if (movie.translations) {
                movie.translations.forEach(function (v) {
                    filter_items.voice.push(v.title);
                    filter_items.voice_info.push(v);
                });
            }
            if (movie.iframe_src && movie.iframe_src.indexOf('/serial/') >= 0 && movie.content_season_count) {
                for (var i = 1; i <= movie.content_season_count; i++) {
                    filter_items.season.push(T('torrent_serial_season') + ' ' + i);
                }
            }
            comp.filter(filter_items, choice);
        }

        function filtred() {
            var out  = [];
            var fd   = Lampa.Storage.get('online_filter', '{}');
            var movie = (results || [])[0];
            if (!movie) return out;
            var voice_idx = fd.voice || choice.voice || 0;
            var trans_ids = [];
            if (movie.translations) {
                movie.translations.forEach(function (v, i) { trans_ids.push({ id: String(v.id), title: v.title, index: i }); });
            }
            var active_trans = trans_ids.filter(function (v) { return v.index === (voice_idx - 0); });
            var tid_keys = active_trans.length ? [active_trans[0].id] : Object.keys(extract);

            var isSerial = movie.iframe_src && movie.iframe_src.indexOf('/serial/') >= 0;
            var cur_season = (fd.season || choice.season || 0) - 0 + 1;

            if (isSerial) {
                tid_keys.forEach(function (tid) {
                    var tr = extract[tid];
                    if (!tr || !tr.json) return;
                    var voice_title = (movie.translations && movie.translations.filter(function (v) { return String(v.id) === tid; })[0] || {}).title || ('Voice ' + tid);
                    for (var k in tr.json) {
                        var elem = tr.json[k];
                        if (elem.folder) {
                            for (var f in elem.folder) {
                                var folder = elem.folder[f];
                                var parts  = (folder.id || '').split('_');
                                var s_num  = parseInt(parts[0]);
                                if (s_num !== cur_season) continue;
                                out.push({ file: '', translation: tid, season: s_num, episode: parseInt(parts[1]), title: folder.title || ('S' + s_num + 'E' + parts[1]), voice: voice_title, quality: '', info: voice_title });
                            }
                        }
                    }
                });
            } else {
                tid_keys.forEach(function (tid) {
                    var voice_title = (movie.translations && movie.translations.filter(function (v) { return String(v.id) === tid; })[0] || {}).title || ('Voice ' + tid);
                    var res = getBestFile({ translation: tid });
                    if (res.file) {
                        out.push({ file: res.file, translation: tid, title: voice_title, quality: res.quality ? Object.keys(res.quality).join(' / ') : '', info: voice_title });
                    }
                });
            }
            items_cache = out;
            return out;
        }

        function appendItems(items) {
            comp.reset();
            if (!items.length) { comp.loading(false); comp.emptyForQuery(object.movie.title || object.search); return; }
            if (get_links_wait) comp.render().find('.broadcast__scan').length || comp.render().append('<div class="broadcast__scan"><div></div></div>');
            var viewed = Lampa.Storage.cache('online_view', 5000, []);
            items.forEach(function (element) {
                var hash_file = Lampa.Utils.hash(element.season
                    ? [element.season, element.episode, object.movie.original_title, filter_items.voice[choice.voice] || ''].join('')
                    : (object.movie.original_title || '') + (element.title || ''));
                var view = Lampa.Timeline.view(hash_file);
                var item = Lampa.Template.get('online', { title: element.title, quality: element.quality, info: element.info ? ' / ' + element.info : '' });
                element.timeline = view;
                item.append(Lampa.Timeline.render(view));
                if (Lampa.Timeline.details) item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
                if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                item.on('hover:enter', function () {
                    var extra = element.season ? getBestFile(element) : { file: element.file, quality: element.quality };
                    if (!extra.file && get_links_wait) { Lampa.Noty.show(T('online_waitlink')); return; }
                    if (!extra.file) { Lampa.Noty.show(T('online_nolink')); return; }
                    var el2 = Object.assign({}, element, extra);
                    openInPlayer(object, el2, items_cache.map(function (e) {
                        var r = e.season ? getBestFile(e) : { file: e.file };
                        return Object.assign({}, e, r);
                    }));
                    if (viewed.indexOf(hash_file) === -1) {
                        viewed.push(hash_file);
                        item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                        Lampa.Storage.set('online_view', viewed);
                    }
                });
                comp.append(item);
                comp.contextmenu && comp.contextmenu({ item: item, view: view, viewed: viewed, hash_file: hash_file, element: element, file: function (call) { call(getBestFile(element)); } });
            });
            comp.start(true);
        }
    }

    // ── 3. Alloha (embed iframe → HLS) ───────────────────────────────────────────
    function AllohaSource(comp, object) {
        var network = new Lampa.Reguest();
        var token   = '04941a9a3ca3ecf564b7';

        this.search = function () {
            var url = getProxy('alloha') + 'https://api.alloha.tv/';
            if (object.movie.imdb_id)          url = Lampa.Utils.addUrlComponent(url, 'imdb=' + object.movie.imdb_id);
            else if (object.movie.kinopoisk_id) url = Lampa.Utils.addUrlComponent(url, 'kp=' + object.movie.kinopoisk_id);
            else { comp.loading(false); comp.emptyForQuery(object.movie.title); return; }
            url = Lampa.Utils.addUrlComponent(url, 'token=' + token);

            network.silent(url, function (json) {
                if (json && json.data && json.data.iframe_url) {
                    parseEmbed(json.data.iframe_url);
                } else { comp.loading(false); comp.emptyForQuery(object.movie.title); }
            }, function (a, c) { comp.empty(network.errorDecode ? network.errorDecode(a, c) : ''); });
        };

        this.filter  = function () {};
        this.reset   = function () { comp.reset(); };
        this.destroy = function () { network.clear(); };
        this.extendChoice = function () {};

        function parseEmbed(iframe_url) {
            network.native(iframe_url, function (html) {
                // Alloha embed содержит JSON с потоками в window.MOVIE_INFO или подобном
                var items = [];
                // Ищем m3u8 или mp4 ссылки прямо в HTML
                var hls_match = html.match(/(https?:[^"' ]+\.m3u8[^"' ]*)/g);
                var mp4_match = html.match(/(https?:[^"' ]+\.mp4[^"' ]*)/g);
                var links = (hls_match || []).concat(mp4_match || []);
                // Убираем дубли
                links = links.filter(function (v, i, a) { return a.indexOf(v) === i; });

                if (links.length) {
                    // Пытаемся найти переводы
                    var voice_match = html.match(/"translation"\s*:\s*"([^"]+)"/g);
                    links.forEach(function (url, i) {
                        var voice = voice_match && voice_match[i] ? voice_match[i].replace(/"translation"\s*:\s*"/, '').replace('"', '') : 'Перевод ' + (i + 1);
                        items.push({ file: url, title: voice, quality: url.indexOf('.m3u8') >= 0 ? 'HLS' : 'MP4', info: '' });
                    });
                } else {
                    // Fallback: возвращаем сам iframe_url как ссылку
                    items.push({ file: iframe_url, title: 'Alloha', quality: '', info: '' });
                }

                appendItems(items);
                comp.loading(false);
            }, function () { comp.loading(false); comp.emptyForQuery(object.movie.title); }, false, { dataType: 'text' });
        }

        function appendItems(items) {
            comp.reset();
            var viewed = Lampa.Storage.cache('online_view', 5000, []);
            items.forEach(function (element) {
                var hash_file = Lampa.Utils.hash((object.movie.original_title || '') + 'alloha' + (element.title || ''));
                var view = Lampa.Timeline.view(hash_file);
                var item = Lampa.Template.get('online', element);
                element.timeline = view;
                item.append(Lampa.Timeline.render(view));
                item.on('hover:enter', function () {
                    openInPlayer(object, element, items);
                    if (viewed.indexOf(hash_file) === -1) { viewed.push(hash_file); Lampa.Storage.set('online_view', viewed); }
                });
                comp.append(item);
            });
            comp.start(true);
        }
    }

    // ── 4. HDVB ───────────────────────────────────────────────────────────────────
    function HDVBSource(comp, object) {
        var network = new Lampa.Reguest();
        var token   = 'e86290a94c4b7a0f9951';

        this.search = function () {
            if (!object.movie.imdb_id) { comp.loading(false); comp.emptyForQuery(object.movie.title); return; }
            var type = (object.movie.number_of_seasons || object.movie.seasons) ? 'tv' : 'movie';
            var url  = getProxy('hdvb') + 'https://api.hdvb.ru/v2/token/' + token + '/' + type;
            url = Lampa.Utils.addUrlComponent(url, 'imdb_id=' + object.movie.imdb_id);
            network.silent(url, function (json) {
                if (json && json.length) parseItems(json);
                else { comp.loading(false); comp.emptyForQuery(object.movie.title); }
            }, function (a, c) { comp.empty(network.errorDecode ? network.errorDecode(a, c) : ''); });
        };

        this.filter  = function () {};
        this.reset   = function () { comp.reset(); };
        this.destroy = function () { network.clear(); };
        this.extendChoice = function () {};

        function parseItems(json) {
            // HDVB возвращает список переводов с iframe_url
            // Загружаем первый iframe чтобы вытащить реальные ссылки
            var items = json.map(function (d) {
                return { file: '', iframe: d.iframe_url, title: d.translate || 'HDVB', quality: '', info: d.translate || '' };
            });
            // Загружаем потоки для каждого
            var done = 0;
            items.forEach(function (el, idx) {
                network.native(el.iframe, function (html) {
                    var hls = (html.match(/(https?:[^"' ]+\.m3u8[^"' ]*)/g) || []);
                    var mp4 = (html.match(/(https?:[^"' ]+\.mp4[^"' ]*)/g) || []);
                    var link = (hls[0] || mp4[0] || '');
                    items[idx].file = link;
                    done++;
                    if (done >= items.length) finish();
                }, function () { done++; if (done >= items.length) finish(); }, false, { dataType: 'text' });
            });

            function finish() {
                var valid = items.filter(function (i) { return i.file; });
                if (valid.length) appendItems(valid);
                else { comp.loading(false); comp.emptyForQuery(object.movie.title); }
            }
        }

        function appendItems(items) {
            comp.reset();
            var viewed = Lampa.Storage.cache('online_view', 5000, []);
            items.forEach(function (element) {
                var hash_file = Lampa.Utils.hash((object.movie.original_title || '') + 'hdvb' + (element.title || ''));
                var view = Lampa.Timeline.view(hash_file);
                var item = Lampa.Template.get('online', element);
                element.timeline = view;
                item.append(Lampa.Timeline.render(view));
                item.on('hover:enter', function () {
                    openInPlayer(object, element, items);
                    if (viewed.indexOf(hash_file) === -1) { viewed.push(hash_file); Lampa.Storage.set('online_view', viewed); }
                });
                comp.append(item);
            });
            comp.loading(false);
            comp.start(true);
        }
    }

    // ─── Главный компонент ────────────────────────────────────────────────────────
    var BALANCERS = [
        { key: 'collaps',  title: 'Collaps',  Source: CollapsSource,  needKP: true  },
        { key: 'videocdn', title: 'VideoCDN', Source: VideoCDNSource, needKP: false },
        { key: 'alloha',   title: 'Alloha',   Source: AllohaSource,   needKP: false },
        { key: 'hdvb',     title: 'HDVB',     Source: HDVBSource,     needKP: false },
    ];

    function OnlineComponent(object) {
        var network  = new Lampa.Reguest();
        var scroll   = new Lampa.Scroll({ mask: true, over: true });
        var files    = new Lampa.Files(object);
        var filter   = new Lampa.Filter(object);
        var last;
        var source_inst;

        var bal_cache = Lampa.Storage.cache('online_last_balanser', 200, {});
        var balanser  = bal_cache[object.movie && object.movie.id] || Lampa.Storage.get('online_balanser', 'collaps');
        if (!BALANCERS.some(function (b) { return b.key === balanser; })) balanser = 'collaps';

        scroll.body().addClass('torrent-list');

        function getBalDef() {
            for (var i = 0; i < BALANCERS.length; i++) { if (BALANCERS[i].key === balanser) return BALANCERS[i]; }
            return BALANCERS[0];
        }

        // Компонент-интерфейс (передаётся в источник)
        var comp = {
            proxy:       getProxy,
            render:      function () { return files.render(); },
            reset:       function () { scroll.render().find('.empty').remove(); filter.render().detach(); scroll.clear(); scroll.append(filter.render()); },
            append:      function (item) { item.on('hover:focus', function (e) { last = e.target; scroll.update($(e.target), true); }); scroll.append(item); },
            loading:     function (s) { if (s) self.activity.loader(true); else { self.activity.loader(false); self.activity.toggle(); } },
            empty:       function (msg) { var e = Lampa.Template.get('list_empty'); if (msg) e.find('.empty__descr').text(msg); scroll.clear(); scroll.append(e); self.activity.loader(false); self.activity.toggle(); },
            emptyForQuery: function (q) { var e = Lampa.Template.get('list_empty'); e.find('.empty__descr').text(T('online_query_start') + ' (' + (q||'') + ') ' + T('online_query_end')); scroll.clear(); scroll.append(e); self.activity.loader(false); self.activity.toggle(); },
            filter:      function (fi, ch) { /* настраивает filter */ buildFilter(fi, ch); },
            saveChoice:  function (c) { var d = Lampa.Storage.cache('online_choice_' + balanser, 500, {}); d[object.movie.id] = c; Lampa.Storage.set('online_choice_' + balanser, d); },
            start:       function (first) { self.start(first); },
            contextmenu: function (p) { /* опционально */ }
        };

        function buildFilter(fi, ch) {
            var select = [];
            ['voice', 'season'].forEach(function (type) {
                if (!fi[type] || !fi[type].length) return;
                var need  = Lampa.Storage.get('online_filter', '{}');
                var items = fi[type];
                var subs  = items.map(function (name, i) { return { title: name, selected: (need[type] || 0) == i, index: i }; });
                select.push({ title: type === 'voice' ? T('torrent_parser_voice') : T('torrent_serial_season'), subtitle: items[need[type] || 0], items: subs, stype: type });
            });
            select.unshift({ title: T('torrent_parser_reset'), reset: true });
            Lampa.Storage.set('online_filter', ch);

            filter.set('filter', select);
            filter.set('sort', BALANCERS.map(function (b) { return { title: b.title, source: b.key, selected: b.key === balanser }; }));
            filter.render().find('.filter--sort span').text(T('online_balancer'));
        }

        var self = this;

        this.create = function () {
            this.activity.loader(true);

            filter.onBack   = function () { self.start(); };
            filter.onSearch = function (v) { Lampa.Activity.replace({ search: v, clarification: true }); };
            filter.render().find('.selector').on('hover:focus', function (e) { /* last_filter = e.target */ });
            filter.onSelect = function (type, a, b) {
                if (type === 'filter') {
                    if (a.reset) self.search();
                    else if (source_inst && source_inst.filter) source_inst.filter(type, a, b);
                } else if (type === 'sort') {
                    balanser = a.source;
                    Lampa.Storage.set('online_balanser', balanser);
                    bal_cache[object.movie.id] = balanser;
                    Lampa.Storage.set('online_last_balanser', bal_cache);
                    self.search();
                    setTimeout(Lampa.Select.close, 10);
                }
            };

            files.append(scroll.render());
            scroll.append(filter.render());

            this.search();
            return this.render();
        };

        this.search = function () {
            this.activity.loader(true);
            Lampa.Storage.set('online_filter', '{}');

            if (source_inst && source_inst.destroy) source_inst.destroy();
            network.clear();

            var bal = getBalDef();
            source_inst = new bal.Source(comp, object);

            var saved = Lampa.Storage.cache('online_choice_' + balanser, 500, {})[object.movie.id] || {};
            if (source_inst.extendChoice) source_inst.extendChoice(saved);

            // Сбрасываем фильтр
            scroll.clear();
            scroll.append(filter.render());

            // Инициируем поиск — для Collaps нужен kp_id, для остальных — данные из TMDB/поиска
            if (bal.needKP && object.movie.kinopoisk_id) {
                source_inst.search(object.movie.kinopoisk_id);
            } else if (bal.needKP) {
                // Пытаемся получить kp_id через внешний поиск
                network.timeout(15000);
                network.native(
                    'https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=' + encodeURIComponent(object.search || object.movie.title || object.movie.name),
                    function (json) {
                        var film = json && json.films && json.films[0];
                        if (film) {
                            object.movie.kinopoisk_id = film.filmId;
                            source_inst.search(film.filmId);
                        } else {
                            comp.emptyForQuery(object.search || object.movie.title);
                        }
                    },
                    function () { comp.emptyForQuery(object.search || object.movie.title); },
                    false, { headers: { 'X-API-KEY': '2d55adfd-019d-4567-bbf7-67d503f61b5a' } }
                );
            } else if (!bal.needKP) {
                // Для VideoCDN — поиск по API, затем передаём данные
                if (balanser === 'videocdn') {
                    var vurl = getProxy('videocdn') + 'http://cdn.svetacdn.in/api/short';
                    vurl = Lampa.Utils.addUrlComponent(vurl, 'api_token=3i40G5TSECmLF77oAqnEgbx61ZWaOYaE');
                    if (object.movie.imdb_id) {
                        vurl = Lampa.Utils.addUrlComponent(vurl, 'imdb_id=' + encodeURIComponent(object.movie.imdb_id));
                    } else {
                        vurl = Lampa.Utils.addUrlComponent(vurl, 'title=' + encodeURIComponent(object.search || object.movie.title || object.movie.name));
                    }
                    network.timeout(15000);
                    network.native(vurl, function (json) {
                        if (json && json.data && json.data.length) {
                            if (json.data.length === 1 || object.clarification) {
                                source_inst.search(object, json.data);
                            } else {
                                showSimilars(json.data);
                            }
                        } else {
                            // Попробуем по названию
                            if (object.movie.imdb_id) {
                                var vurl2 = getProxy('videocdn') + 'http://cdn.svetacdn.in/api/short';
                                vurl2 = Lampa.Utils.addUrlComponent(vurl2, 'api_token=3i40G5TSECmLF77oAqnEgbx61ZWaOYaE');
                                vurl2 = Lampa.Utils.addUrlComponent(vurl2, 'title=' + encodeURIComponent(object.search || object.movie.title || ''));
                                network.native(vurl2, function (j2) {
                                    if (j2 && j2.data && j2.data.length) source_inst.search(object, j2.data);
                                    else comp.emptyForQuery(object.movie.title);
                                }, function () { comp.emptyForQuery(object.movie.title); });
                            } else {
                                comp.emptyForQuery(object.movie.title);
                            }
                        }
                    }, function (a, c) {
                        // fallback через KP API
                        network.native(
                            'https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=' + encodeURIComponent(object.search || object.movie.title || ''),
                            function (kp) {
                                var data = kp && kp.films && kp.films.map(function (f) {
                                    return { title: f.nameRu || f.nameEn, ru_title: f.nameRu, en_title: f.nameEn, imdb_id: f.imdbId, iframe_src: '//cdn.svetacdn.in/filmId/' + f.filmId };
                                });
                                if (data && data.length) source_inst.search(object, data);
                                else comp.emptyForQuery(object.movie.title);
                            },
                            function () { comp.emptyForQuery(object.movie.title); },
                            false, { headers: { 'X-API-KEY': '2d55adfd-019d-4567-bbf7-67d503f61b5a' } }
                        );
                    });
                } else {
                    // Alloha / HDVB — нужен imdb_id. Если нет — получаем через TMDB
                    if (!object.movie.imdb_id && object.movie.id && (object.movie.source === 'tmdb' || object.movie.source === 'cub')) {
                        var type    = object.movie.name ? 'tv' : 'movie';
                        var turl    = type + '/' + object.movie.id + '/external_ids?api_key=4ef0d7355d9ffb5151e987764708ce96&language=ru';
                        var baseurl = typeof Lampa.TMDB !== 'undefined' ? Lampa.TMDB.api(turl) : 'http://api.themoviedb.org/3/' + turl;
                        network.timeout(10000);
                        network.native(baseurl, function (ttid) {
                            if (ttid && ttid.imdb_id) { object.movie.imdb_id = ttid.imdb_id; }
                            source_inst.search();
                        }, function () { source_inst.search(); });
                    } else {
                        source_inst.search();
                    }
                }
            }
        };

        function showSimilars(json) {
            scroll.clear();
            scroll.append(filter.render());
            json.forEach(function (elem) {
                elem.title   = elem.title || elem.ru_title || elem.en_title || '';
                elem.quality = ((elem.start_date || elem.year || '') + '').slice(0, 4) || '----';
                elem.info    = '';
                var item = Lampa.Template.get('online_folder', elem);
                item.on('hover:enter', function () {
                    self.activity.loader(true);
                    scroll.clear();
                    scroll.append(filter.render());
                    object.clarification = true;
                    source_inst.search(object, [elem]);
                });
                item.on('hover:focus', function (e) { last = e.target; scroll.update($(e.target), true); });
                scroll.append(item);
            });
            self.activity.loader(false);
            self.activity.toggle();
            self.start();
        }

        this.start = function (first_select) {
            if (Lampa.Activity.active().activity !== this.activity) return;
            if (first_select) { last = scroll.render().find('.selector').eq(3)[0] || last; }
            Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie));
            Lampa.Controller.add('content', {
                toggle: function () { Lampa.Controller.collectionSet(scroll.render(), files.render()); Lampa.Controller.collectionFocus(last || false, scroll.render()); },
                up:    function () { if (Navigator.canmove('up')) Navigator.move('up'); else Lampa.Controller.toggle('head'); },
                down:  function () { Navigator.move('down'); },
                right: function () { if (Navigator.canmove('right')) Navigator.move('right'); else filter.show(T('title_filter'), 'filter'); },
                left:  function () { if (Navigator.canmove('left')) Navigator.move('left'); else Lampa.Controller.toggle('menu'); },
                back:  self.back
            });
            Lampa.Controller.toggle('content');
        };

        this.render  = function () { return files.render(); };
        this.back    = function () { Lampa.Activity.backward(); };
        this.pause   = function () {};
        this.stop    = function () {};
        this.destroy = function () {
            if (source_inst && source_inst.destroy) source_inst.destroy();
            network.clear();
            files.destroy();
            scroll.destroy();
            filter.destroy && filter.destroy();
        };
    }

    // ─── Кнопка на карточке ───────────────────────────────────────────────────────
    var BTN = '<div class="full-start__button selector view--online" data-subtitle="v3.0">' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30.051 30.051" width="512" height="512">' +
        '<path d="M19.982,14.438l-6.24-4.536c-.229-.166-.533-.191-.784-.062-.253.128-.411.388-.411.669v9.069c0,.284.158.543.411.671.107.054.224.081.342.081.154,0,.31-.049.442-.146l6.24-4.532c.197-.145.312-.369.312-.607C20.295,14.803,20.177,14.58,19.982,14.438z" fill="currentColor"/>' +
        '<path d="M15.026,0.002C6.726.002,0,6.728,0,15.028c0,8.297,6.726,15.021,15.026,15.021c8.298,0,15.025-6.725,15.025-15.021C30.052,6.728,23.324.002,15.026.002zM15.026,27.542c-6.912,0-12.516-5.601-12.516-12.514c0-6.91,5.604-12.518,12.516-12.518c6.911,0,12.514,5.607,12.514,12.518C27.541,21.941,21.937,27.542,15.026,27.542z" fill="currentColor"/>' +
        '</svg><span>#{online_title}</span></div>';

    // ─── Инициализация ────────────────────────────────────────────────────────────
    function init() {
        addTemplates();
        Lampa.Component.add('online', OnlineComponent);

        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;
            e.object.activity.render().find('.view--online').remove();

            var btn = $(Lampa.Lang.translate(BTN));
            btn.on('hover:enter', function () {
                addTemplates();
                Lampa.Component.add('online', OnlineComponent);
                Lampa.Activity.push({
                    url:        '',
                    title:      T('online_title'),
                    component:  'online',
                    search:     e.data.movie.title || e.data.movie.name,
                    search_one: e.data.movie.title,
                    search_two: e.data.movie.original_title,
                    movie:      e.data.movie,
                    page:       1
                });
            });

            // Вставляем после .view--torrent, если нет — после последней кнопки
            var anchor = e.object.activity.render().find('.view--torrent');
            if (anchor.length) anchor.after(btn);
            else {
                anchor = e.object.activity.render().find('.full-start__buttons .selector').last();
                if (anchor.length) anchor.after(btn);
                else e.object.activity.render().find('.full-start__buttons').append(btn);
            }
        });
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') init(); });

})();
