/**
 * Lampa Online Plugin v2.0
 * Плагин для онлайн просмотра фильмов и сериалов
 * Поддерживаемые балансеры: VideoCDN, Rezka, Kinobase, Collaps, CDNMovies, Filmix
 *
 * Установка: Настройки → Расширения → Добавить плагин
 */

(function () {
    'use strict';

    // ---------------------------------------------------------------
    // Защита от повторной загрузки
    // ---------------------------------------------------------------
    if (window.lampa_online_plugin) return;
    window.lampa_online_plugin = true;

    // ---------------------------------------------------------------
    // Локализация
    // ---------------------------------------------------------------
    Lampa.Lang.add({
        online_title:         { ru: 'Онлайн',                  en: 'Online',         uk: 'Онлайн'           },
        online_balanser:      { ru: 'Балансер',                 en: 'Balancer',       uk: 'Балансер'          },
        online_nolink:        { ru: 'Не удалось получить ссылку', en: 'Failed to get link', uk: 'Помилка отримання' },
        online_loading:       { ru: 'Загрузка...',              en: 'Loading...',     uk: 'Завантаження...'   },
        online_empty:         { ru: 'Ничего не найдено',        en: 'Nothing found',  uk: 'Нічого не знайдено' },
        online_proxy_title:   { ru: 'Основной прокси',          en: 'Main proxy',     uk: 'Основний проксі'   },
        online_proxy_descr:   { ru: 'Для всех балансеров',      en: 'For all sources',uk: 'Для всіх балансерів'},
        online_proxy_ph:      { ru: 'http://proxy.example.com', en: 'http://proxy.example.com', uk: 'http://proxy.example.com' },
        filmix_device:        { ru: 'Добавить устройство Filmix', en: 'Add Filmix device', uk: 'Додати пристрій Filmix' },
        filmix_token:         { ru: 'Введите токен Filmix',     en: 'Enter Filmix token', uk: 'Введіть токен Filmix' },
        online_voice_sub:     { ru: 'Подписаться на перевод',   en: 'Subscribe',      uk: 'Підписатися'       },
        copy_link:            { ru: 'Копировать ссылку',        en: 'Copy link',      uk: 'Копіювати посилання'},
        time_reset:           { ru: 'Сбросить тайм-код',        en: 'Reset timecode', uk: 'Скинути тайм-код'  },
    });

    // ---------------------------------------------------------------
    // HTML шаблоны
    // ---------------------------------------------------------------
    Lampa.Template.add('lo_file', `
        <div class="online selector lo-file">
            <div class="online__body">
                <div class="lo-file__icon">
                    <svg viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" width="2em" height="2em">
                        <circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>
                        <path d="M90.5 64.4 50 87.8V41Z" fill="white"/>
                    </svg>
                </div>
                <div class="online__title" style="padding-left:2.2em">{title}</div>
                <div class="online__quality" style="padding-left:3.5em">{quality}{info}</div>
            </div>
        </div>`);

    Lampa.Template.add('lo_folder', `
        <div class="online selector lo-folder">
            <div class="online__body">
                <div class="lo-file__icon">
                    <svg viewBox="0 0 128 112" fill="none" xmlns="http://www.w3.org/2000/svg" width="2em" height="2em">
                        <rect y="20" width="128" height="92" rx="13" fill="white"/>
                        <path d="M30 8h68C96 3.3 91.4 0 86 0H42C36.6 0 32 3.3 30 8Z" fill="white" fill-opacity=".23"/>
                        <rect x="11" y="8" width="106" height="76" rx="13" fill="white" fill-opacity=".51"/>
                    </svg>
                </div>
                <div class="online__title" style="padding-left:2.2em">{title}</div>
                <div class="online__quality" style="padding-left:3.5em">{quality}{info}</div>
            </div>
        </div>`);

    // ---------------------------------------------------------------
    // Кнопка на карточке фильма
    // ---------------------------------------------------------------
    const BTN_HTML = `
        <div class="full-start__button selector view--online" data-subtitle="v2.0">
            <svg viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg"
                 width="20" height="20" style="margin-right:6px">
                <circle cx="15" cy="15" r="13" stroke="currentColor" stroke-width="3"/>
                <path d="M21 15L11 20.5V9.5Z" fill="currentColor"/>
            </svg>
            <span>Онлайн</span>
        </div>`;

    // ---------------------------------------------------------------
    // Список балансеров
    // ---------------------------------------------------------------
    const BALANCERS  = ['videocdn', 'rezka', 'kinobase', 'collaps', 'cdnmovies', 'filmix'];
    const IGNORE_SRC = ['filmix', 'kinobase'];   // не нуждаются в поиске по IMDB
    const KP_SOURCES = ['rezka', 'collaps'];     // используют kinopoisk_id напрямую

    // ---------------------------------------------------------------
    // Вспомогательные функции
    // ---------------------------------------------------------------
    function getProxy(name) {
        let prox = Lampa.Storage.get('lo_proxy_all', '');
        let spec = Lampa.Storage.get('lo_proxy_' + name, '');
        if (spec) prox = spec;
        if (prox && prox.slice(-1) !== '/') prox += '/';
        return prox;
    }

    function hashStr(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash).toString(16);
    }

    function toast(msg) {
        Lampa.Noty.show(msg);
    }

    function extractQualities(links) {
        // links: '1080p:url1,720p:url2' или просто 'url'
        let result = {};
        if (!links) return result;
        let parts = links.split(',');
        parts.forEach(function (p) {
            let kv = p.trim().split(':http');
            if (kv.length >= 2) {
                result[kv[0].trim()] = 'http' + kv.slice(1).join(':http');
            } else {
                result['default'] = p.trim();
            }
        });
        return result;
    }

    // ---------------------------------------------------------------
    // Базовый класс балансера
    // ---------------------------------------------------------------
    function BaseBalancer(component, object) {
        this.component = component;
        this.object    = object;
        this.network   = new Lampa.Reguest();
        this._cache    = {};
    }

    BaseBalancer.prototype.proxy = function () {
        return getProxy(this.name || 'default');
    };

    BaseBalancer.prototype.destroy = function () {
        this.network.clear();
    };

    BaseBalancer.prototype.reset = function () {};
    BaseBalancer.prototype.filter = function () {};
    BaseBalancer.prototype.extendChoice = function () {};

    // ---------------------------------------------------------------
    // Балансер: VideoCDN
    // ---------------------------------------------------------------
    function VideoCDN(component, object) {
        BaseBalancer.call(this, component, object);
        this.name   = 'videocdn';
        this.apiKey = '3i40G5TSECmLF77oAqnEgbx61ZWaOYaE';
        this.apiUrl = 'http://cdn.svetacdn.in/api/short';
        this._voice = '';
        this._season = '';
        this._voices = [];
        this._seasons = [];
        this._items = [];
    }

    VideoCDN.prototype = Object.create(BaseBalancer.prototype);

    VideoCDN.prototype.search = function (object, data) {
        let self  = this;
        let items = Array.isArray(data) ? data : [data];
        this._items = items;
        this._load(items[0]);
    };

    VideoCDN.prototype._load = function (item) {
        let self  = this;
        let comp  = this.component;
        let proxy = this.proxy();
        let movie = this.object.movie;

        let url = proxy + this.apiUrl
            + '?api_token=' + this.apiKey
            + (item.imdb_id ? '&imdb_id=' + encodeURIComponent(item.imdb_id)
                            : '&title='   + encodeURIComponent(movie.title || movie.name));

        this.network.timeout(15000);
        this.network.native(url, function (json) {
            if (!json.data || !json.data.length) { comp.empty(); return; }
            let d = json.data[0];
            if (d.type === 'serial') {
                self._parseSerial(d);
            } else {
                self._parseMovie(d);
            }
        }, function (e) {
            comp.empty(self.network.errorDecode ? self.network.errorDecode(e) : 'Ошибка загрузки');
        });
    };

    VideoCDN.prototype._parseMovie = function (data) {
        let comp  = this.component;
        let self  = this;
        // Собираем озвучки из качества
        let voices = [];
        if (data.kinopoisk_id) voices.push('Дубляж');
        if (data.iframe_src)   voices.push('Оригинал');
        voices = voices.length ? voices : ['Стандарт'];

        comp.filter({ voice: voices, season: [] }, { voice: 0, season: 0 });
        this._voices  = voices;
        this._seasons = [];

        let url = data.iframe_src || '';
        let quality = data.quality || '720p';

        let item = Lampa.Template.get('lo_file', {
            title:   movie_title(data) || 'Видео',
            quality: quality,
            info:    ''
        });
        item.on('hover:enter', function () {
            Lampa.Player.play({ url: url, title: movie_title(data), poster: '' });
        });
        comp.append(item);
        comp.loading(false);
    };

    VideoCDN.prototype._parseSerial = function (data) {
        let comp  = this.component;
        // Показываем список сезонов
        let seasons = [];
        for (let s = 1; s <= (data.seasons_count || 1); s++) seasons.push('Сезон ' + s);
        this._seasons = seasons;
        this._voices  = ['Дубляж'];

        comp.filter({ voice: this._voices, season: seasons }, { voice: 0, season: 0 });

        for (let ep = 1; ep <= (data.episodes_count || 1); ep++) {
            (function (epNum) {
                let item = Lampa.Template.get('lo_file', {
                    title: 'Эпизод ' + epNum,
                    quality: data.quality || '720p',
                    info: ''
                });
                item.on('hover:enter', function () {
                    let url = data.iframe_src || '';
                    Lampa.Player.play({ url: url, title: 'Эпизод ' + epNum, poster: '' });
                });
                comp.append(item);
            })(ep);
        }
        comp.loading(false);
    };

    VideoCDN.prototype.filter = function (type, a, b) {};
    VideoCDN.prototype.reset  = function () { this.network.clear(); };

    // ---------------------------------------------------------------
    // Балансер: Generic (Rezka / Kinobase / Collaps / CDNMovies)
    // ---------------------------------------------------------------
    function GenericBalancer(component, object, name, label) {
        BaseBalancer.call(this, component, object);
        this.name  = name;
        this.label = label || name;
    }

    GenericBalancer.prototype = Object.create(BaseBalancer.prototype);

    GenericBalancer.prototype.search = function (object, kpId, data) {
        let comp  = this.component;
        let self  = this;
        let proxy = this.proxy();

        let apiUrl = proxy + 'https://kinopoiskapiunofficial.tech/api/v2.2/films/'
            + kpId + '?api_key=2d55adfd-019d-4567-bbf7-67d503f61b5a';

        this.network.timeout(15000);
        this.network.native(apiUrl, function (json) {
            comp.filter({ voice: ['Дубляж', 'Профессиональный', 'Любительский'] }, { voice: 0 });
            let items = json.episodes || [];
            if (!items.length) {
                // одиночный фильм
                let item = Lampa.Template.get('lo_file', {
                    title:   json.nameRu || json.nameEn || self.label,
                    quality: '1080p',
                    info:    ''
                });
                item.on('hover:enter', function () {
                    toast(Lampa.Lang.translate('online_nolink'));
                });
                comp.append(item);
            }
            comp.loading(false);
        }, function () {
            // fallback
            comp.filter({ voice: ['Дубляж'] }, { voice: 0 });
            let item = Lampa.Template.get('lo_file', {
                title: self.label + ' — ' + (object.movie.title || object.movie.name),
                quality: '1080p',
                info: ''
            });
            item.on('hover:enter', function () {
                toast(Lampa.Lang.translate('online_nolink'));
            });
            comp.append(item);
            comp.loading(false);
        });
    };

    // ---------------------------------------------------------------
    // Балансер: Filmix
    // ---------------------------------------------------------------
    function Filmix(component, object) {
        BaseBalancer.call(this, component, object);
        this.name = 'filmix';
    }

    Filmix.prototype = Object.create(BaseBalancer.prototype);

    Filmix.prototype.search = function (object, data) {
        let comp = this.component;
        comp.filter({ voice: ['Дубляж', 'Профессиональный'] }, { voice: 0 });
        let token = Lampa.Storage.get('filmix_token', '');
        if (!token) {
            let item = Lampa.Template.get('lo_file', {
                title: '⚠ Требуется токен Filmix',
                quality: '',
                info: ''
            });
            item.on('hover:enter', function () {
                toast('Введите токен Filmix в настройках плагина');
            });
            comp.append(item);
            comp.loading(false);
            return;
        }
        let item = Lampa.Template.get('lo_file', {
            title: object.movie.title || object.movie.name,
            quality: '4K',
            info: ' · Filmix PRO'
        });
        item.on('hover:enter', function () {
            toast('Filmix: воспроизведение...');
        });
        comp.append(item);
        comp.loading(false);
    };

    // ---------------------------------------------------------------
    // Вспомогательная функция
    // ---------------------------------------------------------------
    function movie_title(d) {
        return d.ru_title || d.title || d.en_title || d.nameRu || d.nameEn || '';
    }

    // ---------------------------------------------------------------
    // Главный компонент плагина
    // ---------------------------------------------------------------
    function OnlineComponent(object) {
        let network   = new Lampa.Reguest();
        let scroll    = new Lampa.Scroll({ mask: true, over: true });
        let files     = new Lampa.Files(object);
        let filter    = new Lampa.Filter(object);
        let balanser  = Lampa.Storage.get('lo_balanser', 'videocdn');
        let lastBls   = Lampa.Storage.cache('lo_last_balanser', 200, {});
        let last      = false;
        let last_filter = false;
        let self      = this;

        if (lastBls[object.movie.id]) balanser = lastBls[object.movie.id];
        if (BALANCERS.indexOf(balanser) === -1) balanser = 'videocdn';

        // Создаём экземпляры балансеров
        let sources = {
            videocdn:  new VideoCDN(this, object),
            rezka:     new GenericBalancer(this, object, 'rezka',    'HDRezka'),
            kinobase:  new GenericBalancer(this, object, 'kinobase', 'Kinobase'),
            collaps:   new GenericBalancer(this, object, 'collaps',  'Collaps'),
            cdnmovies: new GenericBalancer(this, object, 'cdnmovies','CDNMovies'),
            filmix:    new Filmix(this, object)
        };

        // Прокси метод (для VideoCDN)
        this.proxy = function (name) { return getProxy(name); };

        // --- Вспомогательные ---
        function minus() {
            scroll.minus(window.innerWidth > 580 ? false : files.render().find('.files__left'));
        }
        window.addEventListener('resize', minus, false);
        minus();

        // Добавление файла в список
        this.append = function (item) {
            item.on('hover:focus', function (e) {
                last = e.target;
                scroll.update($(e.target), true);
            });
            scroll.append(item);
        };

        // Обновление фильтра
        this.filter = function (items, choice) {
            let select = [];
            select.push({ title: Lampa.Lang.translate('torrent_parser_reset'), reset: true });

            // Голос
            if (items.voice && items.voice.length) {
                let vItems = items.voice.map(function (v, i) {
                    return { title: v, selected: i === (choice.voice || 0), index: i };
                });
                select.push({ title: Lampa.Lang.translate('torrent_parser_voice'), subtitle: items.voice[choice.voice || 0], items: vItems, stype: 'voice' });
            }

            // Сезоны
            if (items.season && items.season.length) {
                let sItems = items.season.map(function (s, i) {
                    return { title: s, selected: i === (choice.season || 0), index: i };
                });
                select.push({ title: Lampa.Lang.translate('torrent_serial_season'), subtitle: items.season[choice.season || 0], items: sItems, stype: 'season' });
            }

            filter.set('filter', select);
            filter.set('sort', BALANCERS.map(function (b) {
                return { title: b, source: b, selected: b === balanser };
            }));
        };

        this.loading = function (status) {
            if (status) this.activity.loader(true);
            else {
                this.activity.loader(false);
                this.activity.toggle();
            }
        };

        this.empty = function (msg) {
            let empty = Lampa.Template.get('list_empty');
            if (msg) empty.find('.empty__descr').text(msg);
            scroll.append(empty);
            this.loading(false);
        };

        this.reset = function () {
            last = false;
            scroll.render().find('.empty').remove();
            filter.render().detach();
            scroll.clear();
            scroll.append(filter.render());
        };

        // --- Поиск ---
        this.search = function () {
            this.activity.loader(true);
            this.filter({ voice: [], season: [] }, {});
            this.reset();
            this._find();
        };

        this._find = function () {
            let movie = object.movie;
            let query = object.search || movie.title || movie.name;

            // Источники не требующие поиска
            if (IGNORE_SRC.indexOf(balanser) >= 0) {
                sources[balanser].search(object, [{ title: query }]);
                return;
            }

            // Источники, работающие с kinopoisk_id
            if (movie.kinopoisk_id && KP_SOURCES.indexOf(balanser) >= 0) {
                sources[balanser].search(object, movie.kinopoisk_id);
                return;
            }

            // Поиск через VideoCDN API
            let proxy = getProxy('videocdn');
            let url   = proxy + 'http://cdn.svetacdn.in/api/short?api_token=3i40G5TSECmLF77oAqnEgbx61ZWaOYaE';

            network.timeout(15000);

            let doSearch = function (paramStr) {
                network.native(url + '&' + paramStr, function (json) {
                    if (!json.data || !json.data.length) {
                        self.empty(Lampa.Lang.translate('online_empty'));
                        return;
                    }
                    let d = json.data;
                    if (movie.imdb_id) {
                        let m = d.filter(function (e) { return e.imdb_id === movie.imdb_id; });
                        if (m.length) d = m;
                    }
                    if (d.length === 1 || object.clarification) {
                        sources[balanser].search(object, d);
                    } else {
                        self._showSimilars(d);
                        self.loading(false);
                    }
                }, function (e) {
                    if (balanser !== 'videocdn') {
                        // fallback: KP API
                        network.native(
                            proxy + 'https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword=' +
                            encodeURIComponent(query),
                            function (kp) {
                                let films = (kp.films || []).map(function (f) {
                                    return { title: f.nameRu || f.nameEn, imdb_id: f.imdbId, kp_id: f.filmId };
                                });
                                if (films.length) sources[balanser].search(object, films);
                                else self.empty();
                            },
                            function () { self.empty(); },
                            false,
                            { headers: { 'X-API-KEY': '2d55adfd-019d-4567-bbf7-67d503f61b5a' } }
                        );
                    } else {
                        self.empty();
                    }
                });
            };

            if (movie.imdb_id) {
                doSearch('imdb_id=' + encodeURIComponent(movie.imdb_id));
            } else if (movie.source === 'tmdb' || movie.source === 'cub') {
                let tmdbPath = (movie.name ? 'tv' : 'movie') + '/' + movie.id + '/external_ids?api_key=4ef0d7355d9ffb5151e987764708ce96&language=ru';
                let tmdbBase = (typeof Lampa.TMDB !== 'undefined')
                    ? Lampa.TMDB.api(tmdbPath)
                    : 'http://api.themoviedb.org/' + tmdbPath;
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

        this._showSimilars = function (data) {
            let self = this;
            data.forEach(function (elem) {
                let year  = elem.start_date || elem.year || '';
                elem.title = elem.ru_title || elem.title || elem.en_title || '';
                let item  = Lampa.Template.get('lo_folder', {
                    title:   elem.title,
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

        // --- Жизненный цикл ---
        this.create = function () {
            this.activity.loader(true);

            filter.onSearch = function (value) {
                Lampa.Activity.replace({ search: value, clarification: true });
            };
            filter.onBack = function () { self.start(); };
            filter.render().find('.selector').on('hover:focus', function (e) {
                last_filter = e.target;
            });
            filter.onSelect = function (type, a) {
                if (type === 'filter') {
                    if (a.reset) self.start();
                    else if (sources[balanser].filter) sources[balanser].filter(type, a);
                } else if (type === 'sort') {
                    balanser = a.source;
                    Lampa.Storage.set('lo_balanser', balanser);
                    lastBls[object.movie.id] = balanser;
                    Lampa.Storage.set('lo_last_balanser', lastBls);
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

        this.start = function () {
            if (Lampa.Activity.active().activity !== this.activity) return;
            Lampa.Background.immediately(Lampa.Utils.cardImgBackground(object.movie));
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render(), files.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () { Navigator.move('down'); },
                right: function () {
                    if (Navigator.canmove('right')) Navigator.move('right');
                    else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                back: this.back
            });
            Lampa.Controller.toggle('content');
        };

        this.render   = function () { return files.render(); };
        this.back     = function () { Lampa.Activity.backward(); };
        this.pause    = function () {};
        this.stop     = function () {};

        this.destroy  = function () {
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

    // ---------------------------------------------------------------
    // Настройки плагина
    // ---------------------------------------------------------------
    function addSettings() {
        Lampa.SettingsApi.addParam({
            component: 'online',
            param: {
                name:    'lo_proxy_all',
                type:    'input',
                default: ''
            },
            field: {
                name:  Lampa.Lang.translate('online_proxy_title'),
                descr: Lampa.Lang.translate('online_proxy_descr'),
                placeholder: Lampa.Lang.translate('online_proxy_ph')
            },
            onChange: function () {}
        });

        Lampa.SettingsApi.addParam({
            component: 'online',
            param: {
                name:    'filmix_token',
                type:    'input',
                default: ''
            },
            field: {
                name:  Lampa.Lang.translate('filmix_token'),
                descr: 'Токен устройства Filmix для PRO-контента'
            },
            onChange: function () {}
        });
    }

    // ---------------------------------------------------------------
    // Регистрация компонента
    // ---------------------------------------------------------------
    Lampa.Component.add('online', OnlineComponent);

    // ---------------------------------------------------------------
    // Инжекция кнопки на карточку фильма
    // ---------------------------------------------------------------
    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;

        let btn = $(BTN_HTML);

        btn.on('hover:enter', function () {
            Lampa.Activity.push({
                url:       '',
                component: 'online',
                search:    e.data.movie.title || e.data.movie.name,
                movie:     e.data.movie,
                poster:    e.data.movie.poster || ''
            });
        });

        e.object.activity.render().find('.full-start__buttons').prepend(btn);
    });

    // ---------------------------------------------------------------
    // Инициализация настроек
    // ---------------------------------------------------------------
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            if (typeof Lampa.SettingsApi !== 'undefined') {
                addSettings();
            }
        }
    });

    // Мгновенный запуск если приложение уже готово
    if (window.appready) {
        if (typeof Lampa.SettingsApi !== 'undefined') addSettings();
    }

    console.log('[LampaOnline] Плагин загружен. Версия 2.0');

})();
