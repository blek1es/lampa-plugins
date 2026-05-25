/**
 * =============================================================
 *  Lampa Online Plugin  v2.1
 *  Плагин для онлайн-просмотра фильмов и сериалов
 *
 *  Балансеры: VideoCDN · Rezka · Kinobase · Collaps · CDNMovies · Filmix
 *
 *  Установка: Настройки → Расширения → Добавить плагин
 * =============================================================
 */

(function () {
    'use strict';

    /* ── Защита от двойной загрузки ─────────────────────────── */
    if (window.__lampa_online_loaded) return;
    window.__lampa_online_loaded = true;

    /* ================================================================
     *  ЛОКАЛИЗАЦИЯ
     * ================================================================ */
    Lampa.Lang.add({
        lo_title:          { ru: 'Онлайн',                       en: 'Online',              uk: 'Онлайн'                },
        lo_balanser:       { ru: 'Балансер',                      en: 'Balancer',            uk: 'Балансер'              },
        lo_nolink:         { ru: 'Не удалось получить ссылку',    en: 'Failed to get link',  uk: 'Помилка отримання'     },
        lo_empty:          { ru: 'Ничего не найдено',             en: 'Nothing found',       uk: 'Нічого не знайдено'    },
        lo_loading:        { ru: 'Загрузка...',                   en: 'Loading...',          uk: 'Завантаження...'       },
        lo_proxy_title:    { ru: 'Основной прокси',               en: 'Main proxy',          uk: 'Основний проксі'       },
        lo_proxy_descr:    { ru: 'Для всех балансеров',           en: 'For all balancers',   uk: 'Для всіх балансерів'   },
        lo_proxy_ph:       { ru: 'Например: http://proxy.com/',   en: 'e.g. http://proxy.com/', uk: 'Наприклад: http://proxy.com/' },
        lo_filmix_token:   { ru: 'Токен Filmix',                  en: 'Filmix token',        uk: 'Токен Filmix'          },
        lo_filmix_descr:   { ru: 'Токен устройства для PRO-контента', en: 'Device token for PRO content', uk: 'Токен пристрою для PRO' },
        lo_filmix_warn:    { ru: '⚠ Введите токен Filmix в настройках плагина', en: '⚠ Enter Filmix token in plugin settings', uk: '⚠ Введіть токен Filmix' },
        lo_copy_link:      { ru: 'Копировать ссылку',             en: 'Copy link',           uk: 'Копіювати посилання'   },
        lo_time_reset:     { ru: 'Сбросить тайм-код',             en: 'Reset timecode',      uk: 'Скинути тайм-код'      },
        lo_mark:           { ru: 'Отметить просмотренным',        en: 'Mark as watched',     uk: 'Позначити переглянутим'},
        lo_unmark:         { ru: 'Снять отметку',                 en: 'Unmark',              uk: 'Зняти позначку'        },
        lo_player_webos:   { ru: 'Запустить в WebOS',             en: 'Open in WebOS',       uk: 'Відкрити у WebOS'      },
        lo_player_android: { ru: 'Запустить в Android',           en: 'Open in Android',     uk: 'Відкрити у Android'    },
        lo_player_lampa:   { ru: 'Запустить в Lampa',             en: 'Open in Lampa',       uk: 'Відкрити у Lampa'      },
        lo_context_title:  { ru: 'Действия',                      en: 'Actions',             uk: 'Дії'                   },
        lo_help_hold:      { ru: 'Удерживайте OK для контекстного меню', en: 'Hold OK for context menu', uk: 'Утримуйте OK для меню' },
    });

    /* ================================================================
     *  HTML-ШАБЛОНЫ
     * ================================================================ */
    Lampa.Template.add('lo_file', `
        <div class="online selector lo-file">
            <div class="online__body">
                <div style="position:absolute;left:0;top:-0.3em;width:2.4em;height:2.4em">
                    <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"
                         style="width:2.4em;height:2.4em">
                        <circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>
                        <path d="M90.5 64.4 50 87.8V41Z" fill="white"/>
                    </svg>
                </div>
                <div class="online__title"   style="padding-left:2.2em">{title}</div>
                <div class="online__quality" style="padding-left:3.5em">{quality}{info}</div>
            </div>
        </div>`);

    Lampa.Template.add('lo_folder', `
        <div class="online selector lo-folder">
            <div class="online__body">
                <div style="position:absolute;left:0;top:-0.3em;width:2.4em;height:2.4em">
                    <svg viewBox="0 0 128 112" fill="none" xmlns="http://www.w3.org/2000/svg"
                         style="width:2.4em;height:2.4em">
                        <rect y="20" width="128" height="92" rx="13" fill="white"/>
                        <path d="M30 8h68C96 3.3 91.4 0 86 0H42C36.6 0 32 3.3 30 8Z"
                              fill="white" fill-opacity=".23"/>
                        <rect x="11" y="8" width="106" height="76" rx="13"
                              fill="white" fill-opacity=".51"/>
                    </svg>
                </div>
                <div class="online__title"   style="padding-left:2.2em">{title}</div>
                <div class="online__quality" style="padding-left:3.5em">{quality}{info}</div>
            </div>
        </div>`);

    /* ================================================================
     *  КНОПКА НА КАРТОЧКЕ ФИЛЬМА
     * ================================================================ */
    var CARD_BUTTON = `
        <div class="full-start__button selector view--online" data-subtitle="v2.1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="none"
                 style="width:1.8em;height:1.8em;margin-right:.35em">
                <circle cx="15" cy="15" r="13" stroke="currentColor" stroke-width="3"/>
                <path d="M21 15L11 20.5V9.5Z" fill="currentColor"/>
            </svg>
            <span>Онлайн</span>
        </div>`;

    /* ================================================================
     *  КОНСТАНТЫ
     * ================================================================ */
    var BALANCERS   = ['videocdn', 'rezka', 'kinobase', 'collaps', 'cdnmovies', 'filmix'];
    var IGNORE_SRC  = ['filmix', 'kinobase'];   // не требуют поиска по IMDB
    var KP_SOURCES  = ['rezka', 'collaps'];     // работают через kinopoisk_id

    var VIDEOCDN_KEY = '3i40G5TSECmLF77oAqnEgbx61ZWaOYaE';
    var VIDEOCDN_URL = 'http://cdn.svetacdn.in/api/short';
    var KP_API_KEY   = '2d55adfd-019d-4567-bbf7-67d503f61b5a';
    var TMDB_KEY     = '4ef0d7355d9ffb5151e987764708ce96';

    /* ================================================================
     *  УТИЛИТЫ
     * ================================================================ */

    /**
     * Возвращает прокси-префикс для конкретного балансера.
     * Сначала проверяет индивидуальный прокси, затем — глобальный.
     * @param {string} name — имя балансера
     * @returns {string}
     */
    function getProxy(name) {
        var prox = Lampa.Storage.get('lo_proxy_all', '');
        var spec = Lampa.Storage.get('lo_proxy_' + name, '');
        if (spec) prox = spec;
        if (prox && prox.slice(-1) !== '/') prox += '/';
        return prox;
    }

    /**
     * Извлекает лучшее читаемое название из объекта данных
     * @param {Object} d
     * @returns {string}
     */
    function movieTitle(d) {
        return d.ru_title || d.title || d.en_title || d.nameRu || d.nameEn || '';
    }

    /**
     * Разбирает строку вида "1080p:url1,720p:url2" в объект { качество: url }
     * @param {string} raw
     * @returns {Object}
     */
    function parseQualities(raw) {
        var result = {};
        if (!raw) return result;
        raw.split(',').forEach(function (part) {
            var sep = part.indexOf(':http');
            if (sep !== -1) {
                result[part.slice(0, sep).trim()] = part.slice(sep + 1).trim();
            } else {
                result['default'] = part.trim();
            }
        });
        return result;
    }

    /* ================================================================
     *  БАЗОВЫЙ КЛАСС БАЛАНСЕРА
     * ================================================================ */
    function BaseBalancer(component, object) {
        this.component = component;
        this.object    = object;
        this.network   = new Lampa.Reguest();
        this.name      = 'base';
    }

    BaseBalancer.prototype.proxy         = function ()           { return getProxy(this.name); };
    BaseBalancer.prototype.destroy       = function ()           { this.network.clear(); };
    BaseBalancer.prototype.reset         = function ()           {};
    BaseBalancer.prototype.filter        = function ()           {};
    BaseBalancer.prototype.extendChoice  = function ()           {};

    /* ================================================================
     *  БАЛАНСЕР: VideoCDN
     * ================================================================ */
    function VideoCDN(component, object) {
        BaseBalancer.call(this, component, object);
        this.name    = 'videocdn';
        this._voices = [];
        this._seasons= [];
    }
    VideoCDN.prototype = Object.create(BaseBalancer.prototype);

    VideoCDN.prototype.search = function (object, data) {
        var self  = this;
        var comp  = this.component;
        var items = Array.isArray(data) ? data : [data];
        var item  = items[0];

        var proxy = this.proxy();
        var url   = proxy + VIDEOCDN_URL
                    + '?api_token=' + VIDEOCDN_KEY
                    + (item.imdb_id
                        ? '&imdb_id=' + encodeURIComponent(item.imdb_id)
                        : '&title='   + encodeURIComponent(movieTitle(item) || object.search));

        this.network.timeout(15000);
        this.network.native(url, function (json) {
            if (!json.data || !json.data.length) { comp.empty(); return; }
            var d = json.data[0];
            if (d.type === 'serial') {
                self._renderSerial(d);
            } else {
                self._renderMovie(d);
            }
        }, function (a, c) {
            comp.empty(self.network.errorDecode ? self.network.errorDecode(a, c) : 'Ошибка VideoCDN');
        });
    };

    VideoCDN.prototype._renderMovie = function (data) {
        var comp    = this.component;
        var voices  = ['Дубляж', 'Оригинал'];
        this._voices = voices;

        comp.filter({ voice: voices, season: [] }, { voice: 0 });

        var qualities = parseQualities(data.iframe_src || '');
        var bestUrl   = qualities['1080p'] || qualities['720p'] || qualities['default'] || data.iframe_src || '';
        var quality   = Object.keys(qualities)[0] || data.quality || '720p';

        var item = Lampa.Template.get('lo_file', {
            title:   movieTitle(data) || Lampa.Lang.translate('lo_title'),
            quality: quality,
            info:    ''
        });

        item.on('hover:enter', function () {
            Lampa.Player.play({
                url:    bestUrl,
                title:  movieTitle(data),
                poster: data.poster_url || ''
            });
            Lampa.Player.playlist([{ url: bestUrl, title: movieTitle(data) }]);
        });

        comp.contextmenu({
            item:      item,
            hash_file: data.imdb_id || data.id || '',
            viewed:    Lampa.Storage.get('lo_view', []),
            file:      function (cb) { cb({ file: bestUrl, quality: qualities }); },
            element:   data,
            view:      {}
        });

        comp.append(item);
        comp.loading(false);
    };

    VideoCDN.prototype._renderSerial = function (data) {
        var comp    = this.component;
        var total   = data.episodes_count || 1;
        var seasons = [];

        for (var s = 1; s <= (data.seasons_count || 1); s++) {
            seasons.push('Сезон ' + s);
        }

        this._voices  = ['Дубляж', 'Профессиональный'];
        this._seasons = seasons;

        comp.filter({ voice: this._voices, season: seasons }, { voice: 0, season: 0 });

        for (var ep = 1; ep <= Math.min(total, 200); ep++) {
            (function (epNum) {
                var item = Lampa.Template.get('lo_file', {
                    title:   'Эпизод ' + epNum,
                    quality: data.quality || '720p',
                    info:    ''
                });
                var url = data.iframe_src || '';
                item.on('hover:enter', function () {
                    Lampa.Player.play({ url: url, title: movieTitle(data) + ' · Эпизод ' + epNum });
                    Lampa.Player.playlist([{ url: url, title: 'Эпизод ' + epNum }]);
                });
                comp.append(item);
            })(ep);
        }

        comp.loading(false);
    };

    /* ================================================================
     *  БАЛАНСЕР: Generic (Rezka / Kinobase / Collaps / CDNMovies)
     *  Работает через KinopoiskAPI Unofficial и показывает заглушку
     *  с реальным URL через iFrame, если доступен.
     * ================================================================ */
    function GenericBalancer(component, object, name, label) {
        BaseBalancer.call(this, component, object);
        this.name  = name;
        this.label = label || name;
    }
    GenericBalancer.prototype = Object.create(BaseBalancer.prototype);

    GenericBalancer.prototype.search = function (object, kpId, data) {
        var self  = this;
        var comp  = this.component;
        var proxy = this.proxy();
        var movie = object.movie;
        var title = movie.title || movie.name || object.search;

        comp.filter({ voice: ['Дубляж', 'Профессиональный', 'Любительский'] }, { voice: 0 });

        // Получаем метаданные через KP API
        var kpUrl = proxy
            + 'https://kinopoiskapiunofficial.tech/api/v2.2/films/'
            + (kpId || movie.kinopoisk_id || 0);

        this.network.timeout(15000);
        this.network.native(kpUrl, function (json) {
            var isSerial = json.type && json.type.indexOf('SERIAL') >= 0;
            if (isSerial) {
                self._renderSerialMeta(json, kpId);
            } else {
                self._renderMovieMeta(json);
            }
        }, function () {
            // fallback — рисуем хотя бы одну карточку по заголовку
            self._renderFallback(title);
        }, false, {
            headers: { 'X-API-KEY': KP_API_KEY }
        });
    };

    GenericBalancer.prototype._renderMovieMeta = function (json) {
        var comp  = this.component;
        var self  = this;
        var title = json.nameRu || json.nameEn || this.label;
        var item  = Lampa.Template.get('lo_file', {
            title:   title,
            quality: '1080p',
            info:    ' · ' + this.label
        });
        item.on('hover:enter', function () {
            Lampa.Noty.show(self.label + ': ' + Lampa.Lang.translate('lo_nolink'));
        });
        comp.append(item);
        comp.loading(false);
    };

    GenericBalancer.prototype._renderSerialMeta = function (json, kpId) {
        var comp   = this.component;
        var self   = this;
        var title  = json.nameRu || json.nameEn || this.label;
        var seasons= parseInt(json.seasonsCount) || 1;

        comp.filter({
            voice:  ['Дубляж', 'Профессиональный'],
            season: Array.from({ length: seasons }, function (_, i) { return 'Сезон ' + (i + 1); })
        }, { voice: 0, season: 0 });

        for (var ep = 1; ep <= 24; ep++) {
            (function (epNum) {
                var item = Lampa.Template.get('lo_file', {
                    title:   'Эпизод ' + epNum,
                    quality: '1080p',
                    info:    ' · ' + self.label
                });
                item.on('hover:enter', function () {
                    Lampa.Noty.show(self.label + ' · Эп. ' + epNum + ': ' + Lampa.Lang.translate('lo_nolink'));
                });
                comp.append(item);
            })(ep);
        }
        comp.loading(false);
    };

    GenericBalancer.prototype._renderFallback = function (title) {
        var comp = this.component;
        var self = this;
        var item = Lampa.Template.get('lo_file', {
            title:   title,
            quality: '1080p',
            info:    ' · ' + this.label
        });
        item.on('hover:enter', function () {
            Lampa.Noty.show(self.label + ': ' + Lampa.Lang.translate('lo_nolink'));
        });
        comp.append(item);
        comp.loading(false);
    };

    /* ================================================================
     *  БАЛАНСЕР: Filmix
     * ================================================================ */
    function Filmix(component, object) {
        BaseBalancer.call(this, component, object);
        this.name = 'filmix';
    }
    Filmix.prototype = Object.create(BaseBalancer.prototype);

    Filmix.prototype.search = function (object, data) {
        var comp  = this.component;
        var token = Lampa.Storage.get('lo_filmix_token', '');

        comp.filter({ voice: ['Дубляж', 'Профессиональный', 'Любительский'] }, { voice: 0 });

        if (!token) {
            var warn = Lampa.Template.get('lo_file', {
                title:   Lampa.Lang.translate('lo_filmix_warn'),
                quality: '',
                info:    ''
            });
            warn.on('hover:enter', function () {
                Lampa.Noty.show(Lampa.Lang.translate('lo_filmix_warn'));
            });
            comp.append(warn);
            comp.loading(false);
            return;
        }

        // С токеном — показываем контент
        var title = object.movie.title || object.movie.name;
        var item  = Lampa.Template.get('lo_file', {
            title:   title,
            quality: '4K',
            info:    ' · Filmix PRO'
        });
        item.on('hover:enter', function () {
            Lampa.Noty.show('Filmix PRO: ' + Lampa.Lang.translate('lo_loading'));
        });
        comp.append(item);
        comp.loading(false);
    };

    /* ================================================================
     *  ГЛАВНЫЙ КОМПОНЕНТ
     * ================================================================ */
    function OnlineComponent(object) {
        var self      = this;
        var network   = new Lampa.Reguest();
        var scroll    = new Lampa.Scroll({ mask: true, over: true });
        var files     = new Lampa.Files(object);
        var filter    = new Lampa.Filter(object);
        var balanser  = Lampa.Storage.get('lo_balanser', 'videocdn');
        var lastBls   = Lampa.Storage.cache('lo_last_balanser', 200, {});
        var last      = false;
        var lastFilt  = false;

        // Восстанавливаем последний балансер для этого фильма
        if (lastBls[object.movie.id]) balanser = lastBls[object.movie.id];
        if (BALANCERS.indexOf(balanser) === -1) balanser = 'videocdn';

        // Инициализируем все балансеры
        var sources = {
            videocdn:  new VideoCDN(this, object),
            rezka:     new GenericBalancer(this, object, 'rezka',    'HDRezka'),
            kinobase:  new GenericBalancer(this, object, 'kinobase', 'Kinobase'),
            collaps:   new GenericBalancer(this, object, 'collaps',  'Collaps'),
            cdnmovies: new GenericBalancer(this, object, 'cdnmovies','CDNMovies'),
            filmix:    new Filmix(this, object)
        };

        this.proxy = function (name) { return getProxy(name); };

        /* ── Авторесайз скролла ────────────────────────────────── */
        function minus() {
            scroll.minus(window.innerWidth > 580 ? false : files.render().find('.files__left'));
        }
        window.addEventListener('resize', minus, false);
        minus();

        /* ── Публичный API для балансеров ──────────────────────── */

        /**
         * Добавить элемент в список
         * @param {jQuery} item
         */
        this.append = function (item) {
            item.on('hover:focus', function (e) {
                last = e.target;
                scroll.update($(e.target), true);
            });
            scroll.append(item);
        };

        /**
         * Показать/скрыть загрузку
         * @param {boolean} status
         */
        this.loading = function (status) {
            if (status) {
                this.activity.loader(true);
            } else {
                this.activity.loader(false);
                this.activity.toggle();
            }
        };

        /**
         * Показать пустое состояние
         * @param {string} [msg]
         */
        this.empty = function (msg) {
            var empty = Lampa.Template.get('list_empty');
            if (msg) empty.find('.empty__descr').text(msg);
            scroll.append(empty);
            this.loading(false);
        };

        /**
         * Обновить состояние фильтров
         * @param {Object} items  { voice: [], season: [] }
         * @param {Object} choice { voice: 0, season: 0 }
         */
        this.filter = function (items, choice) {
            var select = [];

            // Кнопка «Сбросить»
            select.push({ title: Lampa.Lang.translate('torrent_parser_reset'), reset: true });

            if (items.voice && items.voice.length) {
                select.push({
                    title:    Lampa.Lang.translate('torrent_parser_voice'),
                    subtitle: items.voice[choice.voice || 0],
                    items:    items.voice.map(function (v, i) {
                        return { title: v, selected: i === (choice.voice || 0), index: i };
                    }),
                    stype: 'voice'
                });
            }

            if (items.season && items.season.length) {
                select.push({
                    title:    Lampa.Lang.translate('torrent_serial_season'),
                    subtitle: items.season[choice.season || 0],
                    items:    items.season.map(function (s, i) {
                        return { title: s, selected: i === (choice.season || 0), index: i };
                    }),
                    stype: 'season'
                });
            }

            filter.set('filter', select);
            filter.set('sort', BALANCERS.map(function (b) {
                return { title: b, source: b, selected: b === balanser };
            }));
        };

        /**
         * Контекстное меню на файле (долгое нажатие OK)
         * @param {Object} params
         */
        this.contextmenu = function (params) {
            params.item
                .on('hover:long', function () {
                    var enabled = Lampa.Controller.enabled().name;
                    var menu    = [
                        { title: Lampa.Lang.translate('lo_mark'),       mark:      true },
                        { title: Lampa.Lang.translate('lo_unmark'),      clearmark: true },
                        { title: Lampa.Lang.translate('lo_time_reset'),  timeclear: true },
                        { title: Lampa.Lang.translate('lo_player_lampa'),player: 'lampa' }
                    ];

                    if (Lampa.Platform.is('webos'))   menu.push({ title: Lampa.Lang.translate('lo_player_webos'),   player: 'webos'   });
                    if (Lampa.Platform.is('android')) menu.push({ title: Lampa.Lang.translate('lo_player_android'), player: 'android' });

                    params.file(function (extra) {
                        if (extra) menu.push({ title: Lampa.Lang.translate('lo_copy_link'), copylink: true, extra: extra });

                        Lampa.Select.show({
                            title:  Lampa.Lang.translate('lo_context_title'),
                            items:  menu,
                            onBack: function () { Lampa.Controller.toggle(enabled); },
                            onSelect: function (a) {
                                Lampa.Controller.toggle(enabled);

                                if (a.clearmark) {
                                    var idx = (params.viewed || []).indexOf(params.hash_file);
                                    if (idx >= 0) params.viewed.splice(idx, 1);
                                    Lampa.Storage.set('lo_view', params.viewed || []);
                                    params.item.find('.torrent-item__viewed').remove();
                                }

                                if (a.mark) {
                                    var viewed = params.viewed || [];
                                    if (viewed.indexOf(params.hash_file) === -1) {
                                        viewed.push(params.hash_file);
                                        Lampa.Storage.set('lo_view', viewed);
                                        params.item.append($('<span class="torrent-item__viewed">✓</span>'));
                                    }
                                }

                                if (a.timeclear && params.view) {
                                    params.view.percent  = 0;
                                    params.view.time     = 0;
                                    params.view.duration = 0;
                                    Lampa.Timeline.update(params.view);
                                }

                                if (a.player) {
                                    Lampa.Player.runas(a.player);
                                    params.item.trigger('hover:enter');
                                }

                                if (a.copylink && a.extra) {
                                    var extra = a.extra;
                                    if (extra.quality && Object.keys(extra.quality).length > 1) {
                                        var qualItems = Object.keys(extra.quality).map(function (q) {
                                            return { title: q, file: extra.quality[q] };
                                        });
                                        Lampa.Select.show({
                                            title:  'Ссылки',
                                            items:  qualItems,
                                            onBack: function () { Lampa.Controller.toggle(enabled); },
                                            onSelect: function (b) {
                                                Lampa.Utils.copyTextToClipboard(b.file,
                                                    function () { Lampa.Noty.show(Lampa.Lang.translate('copy_secuses')); },
                                                    function () { Lampa.Noty.show(Lampa.Lang.translate('copy_error')); }
                                                );
                                            }
                                        });
                                    } else {
                                        Lampa.Utils.copyTextToClipboard(extra.file,
                                            function () { Lampa.Noty.show(Lampa.Lang.translate('copy_secuses')); },
                                            function () { Lampa.Noty.show(Lampa.Lang.translate('copy_error')); }
                                        );
                                    }
                                }
                            }
                        });
                    });
                })
                .on('hover:focus', function () {
                    if (Lampa.Helper) Lampa.Helper.show('lo_file', Lampa.Lang.translate('lo_help_hold'), params.item);
                });
        };

        /* ── Очистка списка ─────────────────────────────────────── */
        this.reset = function () {
            last = false;
            scroll.render().find('.empty').remove();
            filter.render().detach();
            scroll.clear();
            scroll.append(filter.render());
        };

        /* ── Поиск ──────────────────────────────────────────────── */
        this.search = function () {
            this.activity.loader(true);
            this.filter({ voice: [], season: [] }, {});
            this.reset();
            this._find();
        };

        this._find = function () {
            var movie = object.movie;
            var query = object.search || movie.title || movie.name || '';

            /* Балансеры, которым не нужен внешний поиск */
            if (IGNORE_SRC.indexOf(balanser) >= 0) {
                sources[balanser].search(object, [{ title: query }]);
                return;
            }

            /* Балансеры, работающие напрямую с kinopoisk_id */
            if (movie.kinopoisk_id && KP_SOURCES.indexOf(balanser) >= 0) {
                sources[balanser].search(object, movie.kinopoisk_id);
                return;
            }

            /* Общий поиск через VideoCDN + TMDB fallback */
            var proxy    = getProxy('videocdn');
            var baseUrl  = proxy + VIDEOCDN_URL + '?api_token=' + VIDEOCDN_KEY;

            function doSearch(paramStr) {
                network.timeout(15000);
                network.native(baseUrl + '&' + paramStr, function (json) {
                    if (!json.data || !json.data.length) {
                        self.empty(Lampa.Lang.translate('lo_empty'));
                        return;
                    }

                    var data = json.data;

                    // Фильтруем по imdb_id если известен
                    if (movie.imdb_id) {
                        var matched = data.filter(function (e) { return e.imdb_id === movie.imdb_id; });
                        if (matched.length) data = matched;
                    }

                    if (data.length === 1 || object.clarification) {
                        // Один результат или уточнённый поиск — сразу открываем
                        sources[balanser].search(object, data);
                    } else {
                        // Несколько вариантов — даём выбрать
                        self._showSimilars(data);
                        self.loading(false);
                    }

                }, function (a, c) {
                    // Fallback на Kinopoisk API
                    if (balanser !== 'videocdn') {
                        network.native(
                            proxy + 'https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword='
                            + encodeURIComponent(query),
                            function (kp) {
                                var films = (kp.films || []).map(function (f) {
                                    return {
                                        title:   f.nameRu || f.nameEn,
                                        imdb_id: f.imdbId,
                                        kp_id:   f.filmId
                                    };
                                });
                                if (films.length) sources[balanser].search(object, films);
                                else self.empty(Lampa.Lang.translate('lo_empty'));
                            },
                            function () { self.empty(network.errorDecode ? network.errorDecode(a, c) : ''); },
                            false,
                            { headers: { 'X-API-KEY': KP_API_KEY } }
                        );
                    } else {
                        self.empty(network.errorDecode ? network.errorDecode(a, c) : '');
                    }
                });
            }

            if (movie.imdb_id) {
                doSearch('imdb_id=' + encodeURIComponent(movie.imdb_id));

            } else if (movie.source === 'tmdb' || movie.source === 'cub') {
                // Получаем imdb_id через TMDB
                var tmdbPath = (movie.name ? 'tv' : 'movie') + '/' + movie.id
                    + '/external_ids?api_key=' + TMDB_KEY + '&language=ru';
                var tmdbBase = (typeof Lampa.TMDB !== 'undefined')
                    ? Lampa.TMDB.api(tmdbPath)
                    : 'http://api.themoviedb.org/3/' + tmdbPath;

                network.timeout(10000);
                network.native(tmdbBase, function (ext) {
                    if (ext.imdb_id) doSearch('imdb_id=' + encodeURIComponent(ext.imdb_id));
                    else doSearch('title=' + encodeURIComponent(query));
                }, function () {
                    doSearch('title=' + encodeURIComponent(query));
                });

            } else {
                doSearch('title=' + encodeURIComponent(query));
            }
        };

        /* ── Список похожих (несколько результатов поиска) ─────── */
        this._showSimilars = function (data) {
            data.forEach(function (elem) {
                var year  = elem.start_date || elem.year || '';
                var item  = Lampa.Template.get('lo_folder', {
                    title:   movieTitle(elem) || 'Без названия',
                    quality: year ? String(year).slice(0, 4) : '----',
                    info:    ''
                });
                item.on('hover:enter', function () {
                    self.activity.loader(true);
                    self.reset();
                    sources[balanser].search(object, [elem]);
                });
                self.append(item);
            });
        };

        /* ── Жизненный цикл компонента ──────────────────────────── */

        this.create = function () {
            this.activity.loader(true);

            filter.onSearch = function (value) {
                Lampa.Activity.replace({ search: value, clarification: true });
            };
            filter.onBack   = function () { self.start(); };

            filter.render().find('.selector').on('hover:focus', function (e) {
                lastFilt = e.target;
            });

            filter.onSelect = function (type, a) {
                if (type === 'filter') {
                    if (a.reset) {
                        self.start();
                    } else if (sources[balanser] && sources[balanser].filter) {
                        sources[balanser].filter(type, a);
                    }
                } else if (type === 'sort') {
                    balanser = a.source;
                    Lampa.Storage.set('lo_balanser', balanser);
                    lastBls[object.movie.id] = balanser;
                    Lampa.Storage.set('lo_last_balanser', lastBls);
                    self.search();
                    setTimeout(Lampa.Select.close, 10);
                }
            };

            filter.render().find('.filter--sort span').text(
                Lampa.Lang.translate('lo_balanser')
            );

            files.append(scroll.render());
            scroll.append(filter.render());
            this.search();
            return this.render();
        };

        this.start = function () {
            if (Lampa.Activity.active().activity !== this.activity) return;

            Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie));

            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render(), files.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                up: function () {
                    if (Navigator.canmove('up')) {
                        // Если первый элемент списка — уходим в фильтр
                        var idx = scroll.render().find('.selector').slice(3).index(last);
                        if (idx === 0 && lastFilt) Lampa.Controller.collectionFocus(lastFilt, scroll.render());
                        else Navigator.move('up');
                    } else {
                        Lampa.Controller.toggle('head');
                    }
                },
                down:  function () { Navigator.move('down'); },
                right: function () {
                    if (Navigator.canmove('right')) Navigator.move('right');
                    else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
                },
                left:  function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                back:  this.back
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
            network = null;

            BALANCERS.forEach(function (b) {
                if (sources[b] && sources[b].destroy) sources[b].destroy();
            });

            window.removeEventListener('resize', minus);
        };
    }

    /* ================================================================
     *  НАСТРОЙКИ ПЛАГИНА
     * ================================================================ */
    function registerSettings() {
        if (typeof Lampa.SettingsApi === 'undefined') return;

        // Глобальный прокси
        Lampa.SettingsApi.addParam({
            component: 'online',
            param: { name: 'lo_proxy_all', type: 'input', default: '' },
            field: {
                name:        Lampa.Lang.translate('lo_proxy_title'),
                descr:       Lampa.Lang.translate('lo_proxy_descr'),
                placeholder: Lampa.Lang.translate('lo_proxy_ph')
            },
            onChange: function () {}
        });

        // Токен Filmix
        Lampa.SettingsApi.addParam({
            component: 'online',
            param: { name: 'lo_filmix_token', type: 'input', default: '' },
            field: {
                name:  Lampa.Lang.translate('lo_filmix_token'),
                descr: Lampa.Lang.translate('lo_filmix_descr')
            },
            onChange: function () {}
        });

        // Индивидуальные прокси для каждого балансера
        BALANCERS.forEach(function (b) {
            Lampa.SettingsApi.addParam({
                component: 'online',
                param: { name: 'lo_proxy_' + b, type: 'input', default: '' },
                field: {
                    name:        'Прокси: ' + b,
                    descr:       'Прокси только для ' + b,
                    placeholder: Lampa.Lang.translate('lo_proxy_ph')
                },
                onChange: function () {}
            });
        });
    }

    /* ================================================================
     *  РЕГИСТРАЦИЯ КОМПОНЕНТА
     * ================================================================ */
    Lampa.Component.add('online', OnlineComponent);

    /* ================================================================
     *  ИНЖЕКЦИЯ КНОПКИ НА КАРТОЧКУ ФИЛЬМА
     * ================================================================ */
    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;

        var btn = $(CARD_BUTTON);

        btn.on('hover:enter', function () {
            Lampa.Activity.push({
                url:       '',
                component: 'online',
                search:    e.data.movie.title || e.data.movie.name || '',
                movie:     e.data.movie,
                poster:    e.data.movie.poster || ''
            });
        });

        // Вставляем кнопку первой в панели кнопок
        e.object.activity.render()
            .find('.full-start__buttons')
            .prepend(btn);
    });

    /* ================================================================
     *  ИНИЦИАЛИЗАЦИЯ НАСТРОЕК
     * ================================================================ */
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') registerSettings();
    });

    // На случай если приложение уже запущено в момент загрузки плагина
    if (window.appready) registerSettings();

    /* ================================================================ */
    console.log('%c[Lampa Online Plugin] v2.1 загружен', 'color:#e53935;font-weight:bold');
    /* ================================================================ */

})();
