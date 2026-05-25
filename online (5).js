(function () {
    'use strict';

    // ─── Переводы ─────────────────────────────────────────────────────────────────
    Lampa.Lang.add({
        online_title:       { ru: 'Онлайн',              en: 'Online',          uk: 'Онлайн' },
        online_balanser:    { ru: 'Балансер',             en: 'Balancer',        uk: 'Балансер' },
        online_nolink:      { ru: 'Нет ссылки',          en: 'No link',         uk: 'Немає посилання' },
        online_waitlink:    { ru: 'Ожидайте ссылку',     en: 'Wait for link',   uk: 'Очікуйте посилання' },
        online_empty:       { ru: 'Нет источников',      en: 'No sources',      uk: 'Немає джерел' },
        online_query_start: { ru: 'По запросу',           en: 'For query',       uk: 'За запитом' },
        online_query_end:   { ru: 'ничего не найдено',   en: 'nothing found',   uk: 'нічого не знайдено' },
        online_proxy:       { ru: 'Прокси Online',       en: 'Online Proxy',    uk: 'Проксі Online' },
        online_voice_subscribe: { ru: 'Подписаться на озвучку', en: 'Subscribe to voice', uk: 'Підписатися на озвучку' },
        online_voice_success:   { ru: 'Подписка оформлена',     en: 'Subscribed',          uk: 'Підписку оформлено' },
        online_voice_error:     { ru: 'Ошибка подписки',        en: 'Subscribe error',     uk: 'Помилка підписки' },
    });

    // ─── Шаблоны ─────────────────────────────────────────────────────────────────
    function addTemplates() {
        Lampa.Template.add('online',
            '<div class="online selector">' +
            '<div class="online__body">' +
            '<div class="online__info"><div class="online__title">{title}</div><div class="online__quality">{quality}{info}</div></div>' +
            '</div></div>'
        );
        Lampa.Template.add('online_folder',
            '<div class="online selector">' +
            '<div class="online__body">' +
            '<div class="online__info"><div class="online__title">{title}</div><div class="online__quality">{quality}{info}</div></div>' +
            '</div></div>'
        );
    }

    // ─── Источник: Collaps ────────────────────────────────────────────────────────
    function collaps(component, _object) {
        var network    = new Lampa.Reguest();
        var extract    = {};
        var object     = _object;
        var select_title = '';
        var filter_items = {};
        var choice = { season: 0, voice: 0 };

        this.search = function (_object, kinopoisk_id) {
            object       = _object;
            select_title = object.movie.title;
            var embed    = (component.proxy('collaps') || '') + 'https://api.delivembd.ws/embed/';
            var url      = embed + 'kp/' + kinopoisk_id;

            network.silent(url, function (str) {
                if (str) parse(str);
                else component.emptyForQuery(select_title);
                component.loading(false);
            }, function (a, c) {
                component.empty(network.errorDecode(a, c));
            }, false, { dataType: 'text' });
        };

        this.extendChoice = function (saved) { Lampa.Arrays.extend(choice, saved, true); };

        this.reset = function () {
            component.reset();
            choice = { season: 0, voice: 0 };
            filter();
            append(filtred());
            component.saveChoice(choice);
        };

        this.filter = function (type, a, b) {
            choice[a.stype] = b.index;
            component.reset();
            filter();
            append(filtred());
            component.saveChoice(choice);
        };

        this.destroy = function () { network.clear(); extract = null; };

        function parse(str) {
            str = str.replace(/\n/g, '');
            var find = str.match(/makePlayer\(\{(.*?)\}\);/);
            if (find) {
                var json;
                try { json = eval('({' + find[1] + '})'); } catch (e) {}
                if (json) { extract = json; filter(); append(filtred()); }
                else component.emptyForQuery(select_title);
            } else component.emptyForQuery(select_title);
        }

        function filter() {
            filter_items = { season: [], voice: [], quality: [] };
            if (extract.playlist && extract.playlist.seasons) {
                extract.playlist.seasons.forEach(function (season) {
                    filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + season.season);
                });
            }
            component.filter(filter_items, choice);
        }

        function filtred() {
            var out = [];
            var fd  = Lampa.Storage.get('online_filter', '{}');

            if (extract.playlist && extract.playlist.seasons) {
                extract.playlist.seasons.forEach(function (season, i) {
                    if (i == fd.season) {
                        season.episodes.forEach(function (episode) {
                            out.push({
                                file:      episode.hls,
                                episode:   parseInt(episode.episode),
                                season:    season.season,
                                title:     episode.title,
                                quality:   '',
                                info:      episode.audio && episode.audio.names ? episode.audio.names.slice(0, 5).join(', ') : '',
                                subtitles: episode.cc ? episode.cc.map(function (c) { return { label: c.name, url: c.url }; }) : false
                            });
                        });
                    }
                });
            } else if (extract.source) {
                var resolution  = extract.qualityByWidth ? Lampa.Arrays.getKeys(extract.qualityByWidth).pop() : '';
                var max_quality = extract.qualityByWidth ? (extract.qualityByWidth[resolution] || 0) : 0;
                out.push({
                    file:      extract.source.hls,
                    title:     extract.title || object.movie.title,
                    quality:   max_quality ? max_quality + 'p / ' : '',
                    info:      extract.source.audio && extract.source.audio.names ? extract.source.audio.names.slice(0, 5).join(', ') : '',
                    subtitles: extract.source.cc ? extract.source.cc.map(function (c) { return { label: c.name, url: c.url }; }) : false
                });
            }
            return out;
        }

        function append(items) {
            component.reset();
            var viewed = Lampa.Storage.cache('online_view', 5000, []);

            items.forEach(function (element) {
                var hash      = Lampa.Utils.hash(element.season ? [element.season, element.episode, object.movie.original_title].join('') : object.movie.original_title);
                var view      = Lampa.Timeline.view(hash);
                var item      = Lampa.Template.get('online', element);
                var hash_file = Lampa.Utils.hash(element.season ? [element.season, element.episode, object.movie.original_title, element.title].join('') : object.movie.original_title + 'collaps');

                element.timeline = view;
                item.append(Lampa.Timeline.render(view));
                if (Lampa.Timeline.details) item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
                if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');

                item.on('hover:enter', function () {
                    if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
                    if (!element.file) { Lampa.Noty.show(Lampa.Lang.translate('online_nolink')); return; }

                    var playlist = [];
                    var first    = { url: element.file, timeline: view, title: element.season ? element.title : (element.voice ? object.movie.title + ' / ' + element.title : element.title), subtitles: element.subtitles };

                    if (element.season) {
                        items.forEach(function (elem) {
                            playlist.push({ title: elem.title, url: elem.file, timeline: elem.timeline, subtitles: elem.subtitles });
                        });
                    } else { playlist.push(first); }

                    if (playlist.length > 1) first.playlist = playlist;
                    Lampa.Player.play(first);
                    Lampa.Player.playlist(playlist);

                    if (viewed.indexOf(hash_file) === -1) {
                        viewed.push(hash_file);
                        item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                        Lampa.Storage.set('online_view', viewed);
                    }
                });

                component.append(item);
                component.contextmenu({ item: item, view: view, viewed: viewed, hash_file: hash_file, element: element, file: function (call) { call({ file: element.file }); } });
            });

            component.start(true);
        }
    }

    // ─── Источник: VideoCDN ───────────────────────────────────────────────────────
    function videocdn(component, _object) {
        var network       = new Lampa.Reguest();
        var extract       = {};
        var object        = _object;
        var results       = [];
        var filter_items  = {};
        var get_links_wait = false;
        var choice = { season: 0, voice: 0, voice_name: '', voice_id: 0 };

        this.search = function (_object, data) {
            object = _object;
            get_links_wait = true;
            results        = data;

            var itm  = data[0];
            var type = (itm.iframe_src || '').split('/').slice(-2)[0];
            if (type === 'movie') type = 'movies';

            var url = (component.proxy('videocdn') || '') + 'http://cdn.svetacdn.in/api/' + type;
            url = Lampa.Utils.addUrlComponent(url, 'api_token=3i40G5TSECmLF77oAqnEgbx61ZWaOYaE');
            url = Lampa.Utils.addUrlComponent(url, itm.imdb_id ? 'imdb_id=' + encodeURIComponent(itm.imdb_id) : 'title=' + encodeURIComponent(itm.title || object.movie.title));
            url = Lampa.Utils.addUrlComponent(url, 'field=global');

            network.silent(url, function (found) {
                var list = (found.data || []).filter(function (e) { return e.id === itm.id; });
                if (!list.length) list = found.data || [];
                if (list.length) { results = list; getLinks(list); }
                else { component.loading(false); component.emptyForQuery(object.movie.title || object.search); }
            }, function (a, c) {
                component.empty(network.errorDecode(a, c));
            });
        };

        this.extendChoice = function (saved) { Lampa.Arrays.extend(choice, saved, true); };

        this.reset = function () {
            component.reset();
            choice = { season: 0, voice: 0, voice_name: '', voice_id: 0 };
            doFilter();
            append(filtred());
            component.saveChoice(choice);
        };

        this.filter = function (type, a, b) {
            choice[a.stype] = b.index;
            if (a.stype === 'voice') choice.voice_name = (filter_items.voice || [])[b.index] || '';
            component.reset();
            doFilter();
            append(filtred());
            component.saveChoice(choice);
        };

        this.destroy = function () { network.clear(); results = null; };

        function extractItems(str, max_q) {
            if (!str) return [];
            try {
                return str.split(',').map(function (item) {
                    var qm = item.match(/\[(\d+)p\]/);
                    return { quality: qm ? parseInt(qm[1]) : 0, file: 'http:' + item.replace(/\[\d+p\]/, '').split(' or ')[0] };
                }).filter(function (i) { return i.quality && i.quality <= (max_q || 1080); })
                  .sort(function (a, b) { return b.quality - a.quality; });
            } catch (e) { return []; }
        }

        function getLinks(list) {
            var movie = list[0];
            if (!movie) return;

            var src = 'http:' + movie.iframe_src;
            network.native(src, function (raw) {
                get_links_wait = false;
                component.render().find('.broadcast__scan').remove();

                var math = raw.replace(/\n/g, '').match(/id="files" value="(.*?)"/);
                if (math) {
                    var json = Lampa.Arrays.decodeJson(math[1].replace(/&quot;/g, '"'), {});
                    var text = document.createElement('textarea');
                    extract  = {};

                    for (var i in json) {
                        if ((i - 0) === 0) continue;
                        text.innerHTML = json[i];
                        var max_q = 0;
                        if (movie.media)       { var m1 = movie.media.filter(function (o) { return o.translation_id === (i - 0); })[0]; if (m1) max_q = m1.max_quality; }
                        if (!max_q && movie.translations) { var m2 = movie.translations.filter(function (o) { return o.id === (i - 0); })[0]; if (m2) max_q = m2.max_quality; }
                        extract[i] = { json: Lampa.Arrays.decodeJson(text.value, {}), items: extractItems(json[i], max_q) };
                    }
                }
                doFilter();
                append(filtred());
                component.loading(false);
            }, function () {
                component.loading(false);
                component.emptyForQuery(object.movie.title || object.search);
            }, false, { dataType: 'text' });
        }

        function getBestFile(element) {
            var translat = extract[element.translation];
            if (!translat) return { file: '', quality: false };

            var items = [];
            if (element.season) {
                var id = element.season + '_' + element.episode;
                for (var k in translat.json) {
                    var elem = translat.json[k];
                    if (elem.folder) {
                        for (var f in elem.folder) { if (elem.folder[f].id === id) { items = elem.folder[f].items || []; break; } }
                    } else if (elem.id === id) { items = elem.items || []; break; }
                }
            } else { items = translat.items || []; }

            var quality  = {};
            var file     = '';
            var pref_q   = parseInt(Lampa.Storage.get('video_quality_default', '1080'));
            var mass     = [1080, 720, 480, 360];
            mass.slice(Math.max(0, mass.indexOf(pref_q))).forEach(function (n) {
                var ex = null;
                for (var ii = 0; ii < items.length; ii++) { if (items[ii].quality === n) { ex = items[ii]; break; } }
                if (ex) { if (!file) file = ex.file; quality[n + 'p'] = ex.file; }
            });
            return { file: file, quality: file ? quality : false };
        }

        function doFilter() {
            filter_items = { season: [], voice: [] };
            var movie    = (results || [])[0];
            if (!movie) return;

            if (movie.translations) {
                movie.translations.forEach(function (v) { filter_items.voice.push(v.title); });
            }
            if ((movie.iframe_src || '').indexOf('/serial/') >= 0 && movie.content_season_count) {
                for (var i = 1; i <= movie.content_season_count; i++) {
                    filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + i);
                }
            }
            component.filter(filter_items, choice);
        }

        function filtred() {
            var out   = [];
            var fd    = Lampa.Storage.get('online_filter', '{}');
            var movie = (results || [])[0];
            if (!movie) return out;

            var voice_idx = parseInt(fd.voice || choice.voice || 0);
            var isSerial  = (movie.iframe_src || '').indexOf('/serial/') >= 0;
            var cur_s     = parseInt(fd.season || choice.season || 0) + 1;

            var trans_ids = [];
            if (movie.translations) {
                movie.translations.forEach(function (v, i) { trans_ids.push({ id: String(v.id), title: v.title, index: i }); });
            }

            var active = trans_ids.filter(function (v) { return v.index === voice_idx; });
            var keys   = active.length ? [active[0].id] : Object.keys(extract);

            if (isSerial) {
                keys.forEach(function (tid) {
                    var tr = extract[tid];
                    if (!tr || !tr.json) return;
                    var vtitle = '';
                    if (movie.translations) { var vt = movie.translations.filter(function (v) { return String(v.id) === tid; })[0]; if (vt) vtitle = vt.title; }
                    for (var k in tr.json) {
                        var e = tr.json[k];
                        if (e.folder) {
                            for (var f in e.folder) {
                                var folder = e.folder[f];
                                var parts  = (folder.id || '').split('_');
                                if (parseInt(parts[0]) !== cur_s) continue;
                                out.push({ translation: tid, season: parseInt(parts[0]), episode: parseInt(parts[1]), title: folder.title || ('S' + parts[0] + 'E' + parts[1]), voice: vtitle, quality: folder.max_quality ? folder.max_quality + 'p' : '', info: vtitle ? ' / ' + vtitle : '' });
                            }
                        }
                    }
                });
            } else {
                keys.forEach(function (tid) {
                    var vtitle = '';
                    if (movie.translations) { var vt = movie.translations.filter(function (v) { return String(v.id) === tid; })[0]; if (vt) vtitle = vt.title; }
                    var res = getBestFile({ translation: tid });
                    if (res.file) out.push({ translation: tid, file: res.file, quality: res.quality ? Object.keys(res.quality).join(' / ') : '', title: vtitle || object.movie.title, info: vtitle ? ' / ' + vtitle : '' });
                });
            }
            return out;
        }

        function append(items) {
            component.reset();
            if (!items.length) { component.loading(false); component.emptyForQuery(object.movie.title || object.search); return; }

            if (get_links_wait) {
                if (!component.render().find('.broadcast__scan').length) component.render().append('<div class="broadcast__scan"><div></div></div>');
            }

            var viewed = Lampa.Storage.cache('online_view', 5000, []);

            items.forEach(function (element) {
                var hash_file = Lampa.Utils.hash(element.season
                    ? [element.season, element.episode, object.movie.original_title, element.voice || ''].join('')
                    : (object.movie.original_title || '') + (element.title || ''));
                var view = Lampa.Timeline.view(hash_file);
                var item = Lampa.Template.get('online', { title: element.title, quality: element.quality || '', info: element.info || '' });

                element.timeline = view;
                item.append(Lampa.Timeline.render(view));
                if (Lampa.Timeline.details) item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
                if (viewed.indexOf(hash_file) !== -1) item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');

                item.on('hover:enter', function () {
                    if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);

                    var extra = element.season ? getBestFile(element) : { file: element.file, quality: element.quality };

                    if (!extra.file && get_links_wait) { Lampa.Noty.show(Lampa.Lang.translate('online_waitlink')); return; }
                    if (!extra.file)                   { Lampa.Noty.show(Lampa.Lang.translate('online_nolink'));   return; }

                    var first    = { url: extra.file, quality: extra.quality || false, timeline: view, title: element.season ? element.title : (object.movie.title + (element.title ? ' / ' + element.title : '')) };
                    var playlist = [];

                    if (element.season) {
                        items.forEach(function (e) {
                            var r = getBestFile(e);
                            playlist.push({ title: e.title, url: r.file, quality: r.quality || false, timeline: e.timeline });
                        });
                    } else { playlist.push(first); }

                    if (playlist.length > 1) first.playlist = playlist;
                    Lampa.Player.play(first);
                    Lampa.Player.playlist(playlist);

                    if (viewed.indexOf(hash_file) === -1) {
                        viewed.push(hash_file);
                        item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>');
                        Lampa.Storage.set('online_view', viewed);
                    }
                });

                component.append(item);
                component.contextmenu({ item: item, view: view, viewed: viewed, hash_file: hash_file, element: element, file: function (call) { var e = element; call(e.season ? getBestFile(e) : { file: e.file, quality: e.quality }); } });
            });

            component.start(true);
        }
    }

    // ─── Главный компонент ────────────────────────────────────────────────────────
    function OnlineComponent(object) {
        var network    = new Lampa.Reguest();
        var scroll     = new Lampa.Scroll({ mask: true, over: true });
        var files      = new Lampa.Files(object);
        var filter     = new Lampa.Filter(object);
        var last, last_filter, extended, selected_id;

        var balanser   = Lampa.Storage.get('online_balanser', 'collaps');
        var last_bls   = Lampa.Storage.cache('online_last_balanser', 200, {});

        if (last_bls[object.movie.id]) balanser = last_bls[object.movie.id];

        var filter_sources  = ['collaps', 'videocdn'];
        var kiposk_sources  = ['collaps'];

        if (filter_sources.indexOf(balanser) === -1) balanser = 'collaps';

        var sources = {
            collaps:  new collaps(this, object),
            videocdn: new videocdn(this, object)
        };

        scroll.body().addClass('torrent-list');

        this.proxy = function (name) {
            var prox = Lampa.Storage.get('online_proxy_all', '');
            var need = Lampa.Storage.get('online_proxy_' + name, '');
            if (need) prox = need;
            if (prox && prox.slice(-1) !== '/') prox += '/';
            return prox;
        };

        var self = this;

        this.create = function () {
            this.activity.loader(true);

            filter.onSearch = function (value) { Lampa.Activity.replace({ search: value, clarification: true }); };
            filter.onBack   = function ()      { self.start(); };

            filter.render().find('.selector').on('hover:focus', function (e) { last_filter = e.target; });

            filter.onSelect = function (type, a, b) {
                if (type === 'filter') {
                    if (a.reset) { if (extended) sources[balanser].reset(); else self.start(); }
                    else         { sources[balanser].filter(type, a, b); }
                } else if (type === 'sort') {
                    balanser = a.source;
                    Lampa.Storage.set('online_balanser', balanser);
                    last_bls[object.movie.id] = balanser;
                    Lampa.Storage.set('online_last_balanser', last_bls);
                    self.search();
                    setTimeout(Lampa.Select.close, 10);
                }
            };

            filter.render().find('.filter--sort span').text(Lampa.Lang.translate('online_balanser'));

            files.append(scroll.render());
            scroll.append(filter.render());

            this.search();
            return this.render();
        };

        this.search = function () {
            this.activity.loader(true);
            this.filter({ source: filter_sources }, { source: 0 });
            this.reset();
            this.find();
        };

        this.find = function () {
            var url   = (this.proxy('videocdn') || '') + 'http://cdn.svetacdn.in/api/short';
            var query = object.search;

            url = Lampa.Utils.addUrlComponent(url, 'api_token=3i40G5TSECmLF77oAqnEgbx61ZWaOYaE');

            var display = function (json) {
                if (object.movie.imdb_id) {
                    var imdb = (json.data || []).filter(function (elem) { return elem.imdb_id === object.movie.imdb_id; });
                    if (imdb.length) json.data = imdb;
                }

                if (json.data && json.data.length) {
                    if (json.data.length === 1 || object.clarification) {
                        self.extendChoice();
                        if (balanser === 'videocdn') sources[balanser].search(object, json.data);
                        else                         sources[balanser].search(object, json.data[0].kp_id || json.data[0].filmId, json.data);
                    } else {
                        self.similars(json.data);
                        self.loading(false);
                    }
                } else {
                    self.emptyForQuery(query);
                }
            };

            var pillow = function (a, c) {
                if (balanser !== 'videocdn') {
                    // Fallback через KP API — нужен kp_id для collaps
                    network.timeout(15000);
                    network.native(
                        'https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=' + encodeURIComponent(query),
                        function (json) { json.data = json.films; display(json); },
                        function (a2, c2) { self.empty(network.errorDecode(a2, c2)); },
                        false,
                        { headers: { 'X-API-KEY': '2d55adfd-019d-4567-bbf7-67d503f61b5a' } }
                    );
                } else {
                    self.empty(network.errorDecode(a, c));
                }
            };

            var letgo = function (imdb_id) {
                var url_end = Lampa.Utils.addUrlComponent(url, imdb_id ? 'imdb_id=' + encodeURIComponent(imdb_id) : 'title=' + encodeURIComponent(query));
                network.timeout(15000);
                network.native(url_end, function (json) {
                    if (json.data && json.data.length) display(json);
                    else network.native(Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(query)), display, pillow);
                }, pillow);
            };

            network.clear();
            network.timeout(15000);

            // Для collaps — если уже есть kinopoisk_id, идём напрямую
            if (object.movie.kinopoisk_id && kiposk_sources.indexOf(balanser) >= 0) {
                self.extendChoice();
                sources[balanser].search(object, object.movie.kinopoisk_id);
            } else if (object.movie.imdb_id) {
                letgo(object.movie.imdb_id);
            } else if (object.movie.source === 'tmdb' || object.movie.source === 'cub') {
                var tmdburl = (object.movie.name ? 'tv' : 'movie') + '/' + object.movie.id + '/external_ids?api_key=4ef0d7355d9ffb5151e987764708ce96&language=ru';
                var baseurl = typeof Lampa.TMDB !== 'undefined' ? Lampa.TMDB.api(tmdburl) : 'http://api.themoviedb.org/3/' + tmdburl;
                network.native(baseurl, function (ttid) {
                    letgo(ttid.imdb_id);
                }, function (a, c) { self.empty(network.errorDecode(a, c)); });
            } else {
                letgo();
            }
        };

        this.extendChoice = function () {
            var data  = Lampa.Storage.cache('online_choice_' + balanser, 500, {});
            var save  = data[selected_id || object.movie.id] || {};
            extended  = true;
            sources[balanser].extendChoice(save);
        };

        this.saveChoice = function (choice) {
            var data = Lampa.Storage.cache('online_choice_' + balanser, 500, {});
            data[selected_id || object.movie.id] = choice;
            Lampa.Storage.set('online_choice_' + balanser, data);
        };

        this.similars = function (json) {
            json.forEach(function (elem) {
                var year     = elem.start_date || elem.year || '';
                elem.title   = elem.title || elem.ru_title || elem.en_title || elem.nameRu || elem.nameEn || '';
                elem.quality = year ? (year + '').slice(0, 4) : '----';
                elem.info    = '';

                var item = Lampa.Template.get('online_folder', elem);
                item.on('hover:enter', function () {
                    self.activity.loader(true);
                    self.reset();
                    object.search_date = year;
                    selected_id        = elem.id;
                    self.extendChoice();
                    if (balanser === 'videocdn') sources[balanser].search(object, [elem]);
                    else                         sources[balanser].search(object, elem.kp_id || elem.filmId, [elem]);
                });
                self.append(item);
            });
        };

        this.reset = function () {
            last = false;
            scroll.render().find('.empty').remove();
            filter.render().detach();
            scroll.clear();
            scroll.append(filter.render());
        };

        this.loading = function (status) {
            if (status) this.activity.loader(true);
            else { this.activity.loader(false); this.activity.toggle(); }
        };

        this.filter = function (filter_items, choice) {
            var select = [];

            var add = function (type, title) {
                var need     = Lampa.Storage.get('online_filter', '{}');
                var items    = filter_items[type];
                var subitems = [];
                var value    = need[type];
                items.forEach(function (name, i) {
                    subitems.push({ title: name, selected: value == i, index: i });
                });
                select.push({ title: title, subtitle: items[value], items: subitems, stype: type });
            };

            filter_items.source  = filter_sources;
            choice.source        = filter_sources.indexOf(balanser);

            select.push({ title: Lampa.Lang.translate('torrent_parser_reset'), reset: true });
            Lampa.Storage.set('online_filter', choice);

            if (filter_items.voice  && filter_items.voice.length)  add('voice',  Lampa.Lang.translate('torrent_parser_voice'));
            if (filter_items.season && filter_items.season.length) add('season', Lampa.Lang.translate('torrent_serial_season'));

            filter.set('filter', select);
            filter.set('sort', filter_sources.map(function (e) { return { title: e, source: e, selected: e === balanser }; }));
            this.selected(filter_items);
        };

        this.selected = function (filter_items) {
            var need   = Lampa.Storage.get('online_filter', '{}');
            var select = [];
            var translate = {
                season: Lampa.Lang.translate('torrent_serial_season'),
                voice:  Lampa.Lang.translate('torrent_parser_voice')
            };

            for (var i in need) {
                if (filter_items[i] && filter_items[i].length) {
                    if (i === 'voice')  select.push(translate[i] + ': ' + filter_items[i][need[i]]);
                    else if (i !== 'source' && filter_items.season && filter_items.season.length >= 1) {
                        select.push(translate.season + ': ' + filter_items[i][need[i]]);
                    }
                }
            }

            filter.chosen('filter', select);
            filter.chosen('sort', [balanser]);
        };

        this.append = function (item) {
            item.on('hover:focus', function (e) { last = e.target; scroll.update($(e.target), true); });
            scroll.append(item);
        };

        this.contextmenu = function (params) {
            params.item.on('hover:long', function () {
                var enabled = Lampa.Controller.enabled().name;
                var menu    = [
                    { title: Lampa.Lang.translate('torrent_parser_label_title'),        mark:      true },
                    { title: Lampa.Lang.translate('torrent_parser_label_cancel_title'), clearmark: true },
                    { title: Lampa.Lang.translate('time_reset'),                        timeclear: true },
                    { title: Lampa.Lang.translate('copy_link'),                         copylink:  true },
                    { title: Lampa.Lang.translate('player_lauch') + ' - Lampa',         player:    'lampa' }
                ];

                if (Lampa.Platform.is('webos'))    menu.push({ title: Lampa.Lang.translate('player_lauch') + ' - Webos',   player: 'webos' });
                if (Lampa.Platform.is('android'))  menu.push({ title: Lampa.Lang.translate('player_lauch') + ' - Android', player: 'android' });

                Lampa.Select.show({
                    title: Lampa.Lang.translate('title_action'),
                    items: menu,
                    onBack: function () { Lampa.Controller.toggle(enabled); },
                    onSelect: function (a) {
                        if (a.clearmark)  { Lampa.Arrays.remove(params.viewed, params.hash_file); Lampa.Storage.set('online_view', params.viewed); params.item.find('.torrent-item__viewed').remove(); }
                        if (a.mark)       { if (params.viewed.indexOf(params.hash_file) === -1) { params.viewed.push(params.hash_file); params.item.append('<div class="torrent-item__viewed">' + Lampa.Template.get('icon_star', {}, true) + '</div>'); Lampa.Storage.set('online_view', params.viewed); } }
                        if (a.timeclear)  { params.view.percent = 0; params.view.time = 0; params.view.duration = 0; Lampa.Timeline.update(params.view); }
                        Lampa.Controller.toggle(enabled);
                        if (a.player)    { Lampa.Player.runas(a.player); params.item.trigger('hover:enter'); }
                        if (a.copylink)  { params.file(function (extra) { if (extra && extra.quality) { var qual = []; for (var qi in extra.quality) qual.push({ title: qi, file: extra.quality[qi] }); Lampa.Select.show({ title: 'Ссылки', items: qual, onBack: function () { Lampa.Controller.toggle(enabled); }, onSelect: function (b) { Lampa.Utils.copyTextToClipboard(b.file, function () { Lampa.Noty.show(Lampa.Lang.translate('copy_secuses')); }, function () { Lampa.Noty.show(Lampa.Lang.translate('copy_error')); }); } }); } else if (extra && extra.file) { Lampa.Utils.copyTextToClipboard(extra.file, function () { Lampa.Noty.show(Lampa.Lang.translate('copy_secuses')); }, function () { Lampa.Noty.show(Lampa.Lang.translate('copy_error')); }); } }); }
                    }
                });
            }).on('hover:focus', function () {
                if (Lampa.Helper) Lampa.Helper.show('online_file', Lampa.Lang.translate('helper_online_file'), params.item);
            });
        };

        this.empty = function (msg) {
            var empty = Lampa.Template.get('list_empty');
            if (msg) empty.find('.empty__descr').text(msg);
            scroll.append(empty);
            this.loading(false);
        };

        this.emptyForQuery = function (query) {
            this.empty(Lampa.Lang.translate('online_query_start') + ' (' + query + ') ' + Lampa.Lang.translate('online_query_end'));
        };

        this.start = function (first_select) {
            if (Lampa.Activity.active().activity !== this.activity) return;

            if (first_select) {
                var last_views = scroll.render().find('.selector.online').find('.torrent-item__viewed').parent().last();
                if (object.movie.number_of_seasons && last_views.length) last = last_views.eq(0)[0];
                else last = scroll.render().find('.selector').eq(3)[0];
            }

            Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie));

            Lampa.Controller.add('content', {
                toggle: function () { Lampa.Controller.collectionSet(scroll.render(), files.render()); Lampa.Controller.collectionFocus(last || false, scroll.render()); },
                up:    function () { if (Navigator.canmove('up')) { if (scroll.render().find('.selector').slice(3).index(last) === 0 && last_filter) Lampa.Controller.collectionFocus(last_filter, scroll.render()); else Navigator.move('up'); } else Lampa.Controller.toggle('head'); },
                down:  function () { Navigator.move('down'); },
                right: function () { if (Navigator.canmove('right')) Navigator.move('right'); else filter.show(Lampa.Lang.translate('title_filter'), 'filter'); },
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
            network.clear();
            files.destroy();
            scroll.destroy();
            sources.collaps.destroy();
            sources.videocdn.destroy();
            network = null;
        };
    }

    // ─── Кнопка на карточке ───────────────────────────────────────────────────────
    function addButton(e) {
        var body  = e.body;
        var movie = e.data && e.data.movie;
        if (!body || !movie) return;

        body.find('.view--online').remove();

        var btn = $(
            '<div class="full-start__button selector view--online">' +
            '<svg viewBox="0 0 30.051 30.051" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M19.982,14.438l-6.24-4.536c-.229-.166-.533-.191-.784-.062-.253.128-.411.388-.411.669v9.069c0,.284.158.543.411.671.107.054.224.081.342.081.154,0,.31-.049.442-.146l6.24-4.532c.197-.145.312-.369.312-.607,0-.242-.118-.465-.312-.607z" fill="currentColor"/>' +
            '<path d="M15.026,0C6.726,0,0,6.728,0,15.028c0,8.297,6.726,15.021,15.026,15.021c8.298,0,15.025-6.725,15.025-15.021C30.052,6.728,23.324,0,15.026,0zM15.026,27.542c-6.912,0-12.516-5.601-12.516-12.514c0-6.91,5.604-12.518,12.516-12.518c6.911,0,12.514,5.607,12.514,12.518C27.541,21.941,21.937,27.542,15.026,27.542z" fill="currentColor"/>' +
            '</svg>' +
            '<span>' + Lampa.Lang.translate('online_title') + '</span>' +
            '</div>'
        );

        btn.on('hover:enter', function () {
            Lampa.Activity.push({
                url:        '',
                title:      Lampa.Lang.translate('online_title'),
                component:  'online',
                search:     movie.title || movie.name,
                search_one: movie.title,
                search_two: movie.original_title,
                movie:      movie,
                page:       1
            });
        });

        // Вставляем в .buttons--container рядом с .view--trailer и .view--torrent
        var container = body.find('.buttons--container');
        if (container.length) {
            var trailer = container.find('.view--trailer');
            if (trailer.length) trailer.before(btn);
            else container.append(btn);
        } else {
            // Fallback для старых версий Lampa
            var trailer2 = body.find('.view--trailer');
            if (trailer2.length) trailer2.before(btn);
            else body.find('.full-start-new__buttons, .full-start__buttons').append(btn);
        }
    }

    // ─── Инициализация ────────────────────────────────────────────────────────────
    function init() {
        addTemplates();
        Lampa.Component.add('online', OnlineComponent);
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') addButton(e);
        });
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') init(); });

})();
