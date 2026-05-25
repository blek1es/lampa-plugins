(function () {
    'use strict';

    // ─── Конфигурация плагина ────────────────────────────────────────────────────
    var PLUGIN_NAME    = 'Online';
    var PLUGIN_VERSION = '1.0.0';

    // ─── Список источников ───────────────────────────────────────────────────────
    // Каждый источник: { name, api, serial, movie, enabled }
    var SOURCES = [
        // ── Collaps ──────────────────────────────────────────────────────────────
        {
            name:    'Collaps',
            api:     'https://api.collaps.io/v2',
            token:   '',           // вставь свой token если есть
            enabled: true,
            priority: 1,
            check: function (card, callback) {
                var id   = getKpId(card);
                var imdb = getImdbId(card);
                if (!id && !imdb) return callback(null);
                var url  = id
                    ? 'https://api.collaps.io/v2/movie/' + id + '?kp=1'
                    : 'https://api.collaps.io/v2/movie/' + imdb + '?imdb=1';
                fetchJSON(url, function (data) {
                    if (!data || !data.id) return callback(null);
                    callback({
                        source: 'Collaps',
                        iframe: 'https://collaps.io/v/' + data.id,
                        quality: data.quality || '',
                        translation: data.voices || [],
                        seasons: data.seasons || 0
                    });
                });
            }
        },

        // ── Alloha ───────────────────────────────────────────────────────────────
        {
            name:     'Alloha',
            enabled:  true,
            priority: 2,
            check: function (card, callback) {
                var id   = getKpId(card);
                var imdb = getImdbId(card);
                if (!id && !imdb) return callback(null);
                var token = '04941a9a3ca3ecf564b7';   // публичный токен
                var url   = 'https://api.alloha.tv/?token=' + token;
                if (id)   url += '&kp=' + id;
                if (imdb) url += '&imdb=' + imdb;
                fetchJSON(url, function (data) {
                    if (!data || !data.data || !data.data.id) return callback(null);
                    callback({
                        source: 'Alloha',
                        iframe: 'https://alloha.tv/embed/' + data.data.id,
                        quality: data.data.quality || '',
                        translation: data.data.voices || [],
                        seasons: data.data.seasons || 0
                    });
                });
            }
        },

        // ── HDVB ─────────────────────────────────────────────────────────────────
        {
            name:     'HDVB',
            enabled:  true,
            priority: 3,
            check: function (card, callback) {
                var id   = getKpId(card);
                var imdb = getImdbId(card);
                if (!id && !imdb) return callback(null);
                var token = 'e86290a94c4b7a0f9951';   // публичный токен
                var url   = 'https://api.hdvb.ru/v2/token/' + token + '/serial?';
                if (id)   url += 'kp_id=' + id;
                if (imdb) url += '&imdb_id=' + imdb;
                fetchJSON(url, function (data) {
                    if (!data || !data.length) return callback(null);
                    var item = data[0];
                    callback({
                        source: 'HDVB',
                        iframe: item.iframe_url || '',
                        quality: item.quality || '',
                        translation: [],
                        seasons: item.seasons || 0
                    });
                });
            }
        },

        // ── Bazon ────────────────────────────────────────────────────────────────
        {
            name:     'Bazon',
            enabled:  true,
            priority: 4,
            check: function (card, callback) {
                var id   = getKpId(card);
                var imdb = getImdbId(card);
                if (!id && !imdb) return callback(null);
                var token = 'baz0nApiKey1234';          // замените своим
                var url   = 'https://bazon.cc/api/v2/';
                if (id)   url += '?kp=' + id;
                else      url += '?imdb=' + imdb;
                url += '&token=' + token;
                fetchJSON(url, function (data) {
                    if (!data || !data.results || !data.results.length) return callback(null);
                    var item = data.results[0];
                    callback({
                        source: 'Bazon',
                        iframe: item.iframe || '',
                        quality: item.quality || '',
                        translation: item.voices || [],
                        seasons: item.seasons || 0
                    });
                });
            }
        },

        // ── VideoCDN ─────────────────────────────────────────────────────────────
        {
            name:     'VideoCDN',
            enabled:  true,
            priority: 5,
            check: function (card, callback) {
                var id   = getKpId(card);
                var imdb = getImdbId(card);
                if (!id && !imdb) return callback(null);
                var token = 'videocdnToken';             // замените своим
                var url   = 'https://videocdn.tv/api/?';
                if (id)   url += 'kp_id=' + id;
                if (imdb) url += '&imdb_id=' + imdb;
                url += '&api_token=' + token;
                fetchJSON(url, function (data) {
                    if (!data || !data.data || !data.data.length) return callback(null);
                    var item = data.data[0];
                    callback({
                        source: 'VideoCDN',
                        iframe: item.iframe_src || '',
                        quality: item.quality || '',
                        translation: item.voices || [],
                        seasons: item.season_count || 0
                    });
                });
            }
        },

        // ── Kinobox ──────────────────────────────────────────────────────────────
        {
            name:     'Kinobox',
            enabled:  true,
            priority: 6,
            check: function (card, callback) {
                var id   = getKpId(card);
                var imdb = getImdbId(card);
                if (!id && !imdb) return callback(null);
                var token = 'kinoboxApiKey';
                var url   = 'https://kinobox.tv/api/players?';
                if (id)   url += 'kinopoisk=' + id;
                if (imdb) url += '&imdb=' + imdb;
                url += '&token=' + token;
                fetchJSON(url, function (data) {
                    if (!data || !data.length) return callback(null);
                    // Kinobox возвращает список плееров — берём первый доступный
                    var item = data[0];
                    callback({
                        source: 'Kinobox / ' + (item.source || ''),
                        iframe: item.iframeUrl || '',
                        quality: item.quality || '',
                        translation: [],
                        seasons: 0
                    });
                });
            }
        },

        // ── Rezka (через прокси / открытый эндпоинт) ────────────────────────────
        {
            name:     'Rezka',
            enabled:  true,
            priority: 7,
            check: function (card, callback) {
                var id   = getKpId(card);
                var imdb = getImdbId(card);
                if (!id && !imdb) return callback(null);
                // Используем публичный поисковый API Rezka
                var query = encodeURIComponent((card.title || card.name || '') + ' ' + (card.year || ''));
                var url   = 'https://rezka.ag/engine/ajax/search.php?q=' + query;
                fetchJSON(url, function (data) {
                    if (!data || !data.results || !data.results.length) return callback(null);
                    var item = data.results[0];
                    callback({
                        source: 'Rezka',
                        iframe: 'https://rezka.ag/embed/' + item.id,
                        quality: item.quality || '',
                        translation: item.voices || [],
                        seasons: item.seasons || 0
                    });
                });
            }
        }
    ];

    // ─── Утилиты ─────────────────────────────────────────────────────────────────

    function getKpId(card) {
        return (card && (card.kp_id || (card.ids && card.ids.kp))) || '';
    }

    function getImdbId(card) {
        return (card && (card.imdb_id || (card.ids && card.ids.imdb))) || '';
    }

    function fetchJSON(url, cb) {
        try {
            Lampa.Api.externalRequest({
                url: url,
                dataType: 'json',
                timeout: 8000,
                success: function (data) { cb(data); },
                error:   function ()     { cb(null);  }
            });
        } catch (e) {
            cb(null);
        }
    }

    // ─── Основной класс компонента ───────────────────────────────────────────────

    function OnlineComponent(object) {
        var self   = this;
        var card   = object.card || {};
        var results = [];
        var loaded  = 0;
        var total   = 0;
        var scroll, activity, active_source;

        // DOM-элементы
        var html       = Lampa.Template.js('online_list',    {});
        var head       = Lampa.Template.js('online_head',    {});
        var body       = Lampa.Template.js('online_body',    {});
        var empty_elem = Lampa.Template.js('online_empty',   {});
        var loader_el  = Lampa.Template.js('online_loader',  {});

        // ── Инициализация ─────────────────────────────────────────────────────────
        this.initialize = function () {
            scroll = new Lampa.Scroll({ horizontal: false, mask: true });

            html.find('.online__head').append(head);
            html.find('.online__body').append(body);

            self.startSearch();
            return html;
        };

        // ── Поиск по всем источникам ──────────────────────────────────────────────
        this.startSearch = function () {
            results = [];
            loaded  = 0;

            body.empty().append(loader_el);

            var activeSources = SOURCES.filter(function (s) { return s.enabled; });
            total = activeSources.length;

            if (!total) {
                self.showEmpty();
                return;
            }

            activeSources.forEach(function (source) {
                try {
                    source.check(card, function (result) {
                        loaded++;
                        if (result && result.iframe) {
                            results.push(result);
                        }
                        if (loaded >= total) {
                            self.renderResults();
                        }
                    });
                } catch (e) {
                    loaded++;
                    if (loaded >= total) {
                        self.renderResults();
                    }
                }
            });
        };

        // ── Отрисовка результатов ─────────────────────────────────────────────────
        this.renderResults = function () {
            body.empty();

            if (!results.length) {
                self.showEmpty();
                return;
            }

            // Сортируем по приоритету
            results.sort(function (a, b) {
                var pa = self.getPriority(a.source);
                var pb = self.getPriority(b.source);
                return pa - pb;
            });

            results.forEach(function (r) {
                var item = self.buildSourceItem(r);
                body.append(item);
            });

            if (scroll) scroll.reset();
            Lampa.Controller.enable('online');
        };

        // ── Получение приоритета источника ────────────────────────────────────────
        this.getPriority = function (name) {
            for (var i = 0; i < SOURCES.length; i++) {
                if (SOURCES[i].name === name || name.indexOf(SOURCES[i].name) !== -1) {
                    return SOURCES[i].priority;
                }
            }
            return 99;
        };

        // ── Построить элемент источника ───────────────────────────────────────────
        this.buildSourceItem = function (result) {
            var elem = $('<div class="online-source selector"></div>');

            var badge = '';
            if (result.quality) {
                badge = '<span class="online-source__quality">' + result.quality + '</span>';
            }
            var seasons = '';
            if (result.seasons > 0) {
                seasons = '<span class="online-source__seasons">Сезонов: ' + result.seasons + '</span>';
            }
            var voices = '';
            if (result.translation && result.translation.length) {
                voices = '<span class="online-source__voices">' + result.translation.slice(0, 3).join(', ') + '</span>';
            }

            elem.html(
                '<div class="online-source__icon">' +
                    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                        '<polygon points="5 3 19 12 5 21 5 3"></polygon>' +
                    '</svg>' +
                '</div>' +
                '<div class="online-source__info">' +
                    '<div class="online-source__name">' + result.source + '</div>' +
                    '<div class="online-source__meta">' + badge + seasons + voices + '</div>' +
                '</div>'
            );

            elem.on('hover:enter', function () {
                active_source = result;
                self.openPlayer(result);
            });

            return elem;
        };

        // ── Открыть плеер ─────────────────────────────────────────────────────────
        this.openPlayer = function (result) {
            if (!result || !result.iframe) return;
            Lampa.Player.open({
                title:  card.title || card.name || '',
                url:    result.iframe,
                iframe: true
            });
        };

        // ── Пустой результат ──────────────────────────────────────────────────────
        this.showEmpty = function () {
            body.empty().append(empty_elem);
        };

        // ── Lampa lifecycle ───────────────────────────────────────────────────────
        this.start = function () {
            Lampa.Controller.add('online', {
                toggle: function () {
                    Lampa.Controller.collectionSet(body);
                    Lampa.Controller.collectionFocus(false, body);
                },
                up:     function () { Navigator.move('up');   },
                down:   function () { Navigator.move('down'); },
                back:   function () { self.back();            }
            });
            Lampa.Controller.toggle('online');
        };

        this.back   = function () { Lampa.Activity.backward(); };
        this.pause  = function () {};
        this.stop   = function () {};
        this.render = function () { return html; };
        this.destroy = function () {
            if (scroll) scroll.destroy();
        };
    }

    // ─── Шаблоны HTML ────────────────────────────────────────────────────────────

    function registerTemplates() {
        Lampa.Template.add('online_list', '<div class="online"><div class="online__head"></div><div class="online__body"></div></div>');
        Lampa.Template.add('online_head', '<div class="online-head"><div class="online-head__title">Онлайн просмотр</div><div class="online-head__subtitle">Поиск по источникам...</div></div>');
        Lampa.Template.add('online_body', '<div class="online-sources"></div>');
        Lampa.Template.add('online_empty', '<div class="online-empty"><div class="online-empty__icon">⚠</div><div class="online-empty__text">Источники не найдены</div><div class="online-empty__sub">Попробуйте позже или проверьте интернет-соединение</div></div>');
        Lampa.Template.add('online_loader', '<div class="online-loader"><div class="online-loader__spin"></div><div class="online-loader__text">Поиск источников…</div></div>');
    }

    // ─── CSS стили ────────────────────────────────────────────────────────────────

    function injectStyles() {
        var css = [
            /* обёртка */
            '.online { padding: 1em 2em; }',
            '.online-head { margin-bottom: 1.4em; }',
            '.online-head__title { font-size: 1.5em; font-weight: 700; color: #fff; margin-bottom: .3em; }',
            '.online-head__subtitle { font-size: .85em; color: rgba(255,255,255,.5); }',

            /* источник */
            '.online-source { display: flex; align-items: center; gap: 1em;',
                'padding: .8em 1.2em; border-radius: 8px; margin-bottom: .6em;',
                'background: rgba(255,255,255,.06); cursor: pointer;',
                'transition: background .2s, transform .15s; }',
            '.online-source.focus, .online-source:focus { background: rgba(255,255,255,.16); transform: scale(1.02); outline: none; }',

            '.online-source__icon { flex-shrink:0; color: #e5b85f; }',
            '.online-source__info { flex:1; min-width:0; }',
            '.online-source__name { font-size: 1em; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
            '.online-source__meta { display:flex; gap:.5em; margin-top:.25em; flex-wrap:wrap; }',
            '.online-source__quality,.online-source__seasons,.online-source__voices {',
                'font-size:.72em; padding:.15em .5em; border-radius:4px;',
                'background:rgba(255,255,255,.1); color:rgba(255,255,255,.7); }',
            '.online-source__quality { background:#e5b85f22; color:#e5b85f; }',

            /* лоадер */
            '.online-loader { display:flex; flex-direction:column; align-items:center;',
                'justify-content:center; gap:1em; padding:3em; }',
            '.online-loader__spin { width:40px; height:40px; border:3px solid rgba(255,255,255,.15);',
                'border-top-color:#e5b85f; border-radius:50%; animation:spin .8s linear infinite; }',
            '@keyframes spin { to{transform:rotate(360deg)} }',
            '.online-loader__text { color:rgba(255,255,255,.5); font-size:.9em; }',

            /* пусто */
            '.online-empty { text-align:center; padding:3em; color:rgba(255,255,255,.4); }',
            '.online-empty__icon { font-size:2.5em; margin-bottom:.4em; }',
            '.online-empty__text { font-size:1.1em; font-weight:600; color:rgba(255,255,255,.6); }',
            '.online-empty__sub { font-size:.8em; margin-top:.4em; }'
        ].join('\n');

        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ─── Регистрация в Lampa ──────────────────────────────────────────────────────

    function registerPlugin() {
        // Добавляем пункт "Смотреть онлайн" в меню карточки
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                e.object.activity.template().find('.view--online').remove();

                var btn = $('<div class="view selector view--online"><div class="view__icon">' +
                    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                    '<polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>' +
                    '<div class="view__title">Смотреть онлайн</div></div>');

                btn.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url:        '',
                        title:      'Онлайн: ' + (e.object.card.title || e.object.card.name || ''),
                        component:  'online_component',
                        card:       e.object.card,
                        page:       1
                    });
                });

                e.object.activity.template().find('.view--watch').after(btn);
            }
        });

        // Регистрируем компонент
        Lampa.Component.add('online_component', OnlineComponent);
    }

    // ─── Точка входа ─────────────────────────────────────────────────────────────

    function init() {
        if (window.appready) {
            registerTemplates();
            injectStyles();
            registerPlugin();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') {
                    registerTemplates();
                    injectStyles();
                    registerPlugin();
                }
            });
        }
    }

    init();

})();
