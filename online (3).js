(function () {
    'use strict';

    // ─── Языковые строки ─────────────────────────────────────────────────────────
    if (Lampa.Lang) {
        Lampa.Lang.add({
            online_title:        { ru: 'Онлайн',                  en: 'Online',                 uk: 'Онлайн' },
            online_balancer:     { ru: 'Балансер',                 en: 'Balancer',               uk: 'Балансер' },
            online_nolink:       { ru: 'Не удалось получить ссылку', en: 'Failed to get link',   uk: 'Не вдалося отримати посилання' },
            online_empty:        { ru: 'Источники не найдены',     en: 'No sources found',       uk: 'Джерела не знайдено' },
            online_loading:      { ru: 'Поиск источников…',        en: 'Searching sources…',     uk: 'Пошук джерел…' },
            online_proxy:        { ru: 'Прокси для Online',        en: 'Online Proxy',           uk: 'Проксі для Online' },
            online_proxy_ph:     { ru: 'Например: http://proxy.com/', en: 'E.g.: http://proxy.com/', uk: 'Наприклад: http://proxy.com/' },
        });
    }

    // ─── Шаблоны ─────────────────────────────────────────────────────────────────
    function addTemplates() {
        Lampa.Template.add('online_item',
            '<div class="online selector">' +
            '  <div class="online__body">' +
            '    <div class="online__icon">' +
            '      <svg viewBox="0 0 30 30" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '        <circle cx="15" cy="15" r="13" stroke="currentColor" stroke-width="3.5"/>' +
            '        <polygon points="12,9 22,15 12,21" fill="currentColor"/>' +
            '      </svg>' +
            '    </div>' +
            '    <div class="online__title">{title}</div>' +
            '    <div class="online__quality">{quality}</div>' +
            '  </div>' +
            '</div>'
        );
        Lampa.Template.add('online_folder',
            '<div class="online selector">' +
            '  <div class="online__body">' +
            '    <div class="online__icon">' +
            '      <svg viewBox="0 0 30 26" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '        <rect y="5" width="30" height="21" rx="3" fill="currentColor" opacity="0.9"/>' +
            '        <path d="M7 2h8l2 3H0z" fill="currentColor" opacity="0.5"/>' +
            '      </svg>' +
            '    </div>' +
            '    <div class="online__title">{title}</div>' +
            '    <div class="online__quality">{quality}</div>' +
            '  </div>' +
            '</div>'
        );
    }

    // ─── Утилиты ─────────────────────────────────────────────────────────────────
    var t = function (key) {
        return Lampa.Lang && Lampa.Lang.translate ? Lampa.Lang.translate(key) : key;
    };

    function proxy(name) {
        var all  = Lampa.Storage.get('online_proxy_all', '');
        var spec = Lampa.Storage.get('online_proxy_' + name, '');
        var p    = spec || all;
        if (p && p.slice(-1) !== '/') p += '/';
        return p;
    }

    // ─── Источники (балансеры) ───────────────────────────────────────────────────

    // ── VideoCDN / CdnMovies ──────────────────────────────────────────────────────
    function searchVideoCDN(object, network, onDone, onEmpty, onError) {
        var base = proxy('videocdn') + 'http://cdn.svetacdn.in/api/short';
        var url  = base;
        url = Lampa.Utils.addUrlComponent(url, 'api_token=3i40G5TSECmLF77oAqnEgbx61ZWaOYaE');

        if (object.movie.imdb_id) {
            url = Lampa.Utils.addUrlComponent(url, 'imdb_id=' + encodeURIComponent(object.movie.imdb_id));
        } else {
            url = Lampa.Utils.addUrlComponent(url, 'title=' + encodeURIComponent(object.search || object.movie.title || object.movie.name));
        }

        network.timeout(15000);
        network.native(url, function (json) {
            if (json && json.data && json.data.length) {
                onDone(json.data);
            } else {
                onEmpty();
            }
        }, function (a, c) {
            onError(network.errorDecode ? network.errorDecode(a, c) : 'Ошибка сети');
        });
    }

    // ── Collaps ───────────────────────────────────────────────────────────────────
    function searchCollaps(object, network, onDone, onEmpty, onError) {
        var kp = object.movie.kinopoisk_id || object.movie.kp_id || '';
        if (!kp) { onEmpty(); return; }
        var url = proxy('collaps') + 'https://api.bhcesh.me/franchise/details';
        url = Lampa.Utils.addUrlComponent(url, 'token=eedefb541aeba871dcfc756385250ded');
        url = Lampa.Utils.addUrlComponent(url, 'kinopoisk_id=' + kp);
        network.timeout(15000);
        network.native(url, function (json) {
            if (json && (json.iframe_url || json.seasons)) {
                onDone([json]);
            } else {
                onEmpty();
            }
        }, function (a, c) {
            onError(network.errorDecode ? network.errorDecode(a, c) : 'Ошибка сети');
        });
    }

    // ── Alloha ────────────────────────────────────────────────────────────────────
    function searchAlloha(object, network, onDone, onEmpty, onError) {
        var token = '04941a9a3ca3ecf564b7';
        var url = proxy('alloha') + 'https://api.alloha.tv/';
        url = Lampa.Utils.addUrlComponent(url, 'token=' + token);
        if (object.movie.imdb_id) {
            url = Lampa.Utils.addUrlComponent(url, 'imdb=' + object.movie.imdb_id);
        } else if (object.movie.kinopoisk_id) {
            url = Lampa.Utils.addUrlComponent(url, 'kp=' + object.movie.kinopoisk_id);
        } else {
            onEmpty(); return;
        }
        network.timeout(15000);
        network.native(url, function (json) {
            if (json && json.data && json.data.iframe_url) {
                onDone([json.data]);
            } else {
                onEmpty();
            }
        }, function (a, c) {
            onError(network.errorDecode ? network.errorDecode(a, c) : 'Ошибка сети');
        });
    }

    // ── HDVB ─────────────────────────────────────────────────────────────────────
    function searchHDVB(object, network, onDone, onEmpty, onError) {
        var token = 'e86290a94c4b7a0f9951';
        var type  = (object.movie.number_of_seasons || object.movie.seasons) ? 'tv' : 'movie';
        var url = proxy('hdvb') + 'https://api.hdvb.ru/v2/token/' + token + '/' + type;
        if (object.movie.imdb_id) {
            url = Lampa.Utils.addUrlComponent(url, 'imdb_id=' + object.movie.imdb_id);
        } else {
            onEmpty(); return;
        }
        network.timeout(15000);
        network.native(url, function (json) {
            if (json && json.length) {
                onDone(json);
            } else {
                onEmpty();
            }
        }, function (a, c) {
            onError(network.errorDecode ? network.errorDecode(a, c) : 'Ошибка сети');
        });
    }

    // ── Kinobox ───────────────────────────────────────────────────────────────────
    function searchKinobox(object, network, onDone, onEmpty, onError) {
        var url = proxy('kinobox') + 'https://kinobox.tv/api/players';
        if (object.movie.kinopoisk_id) {
            url = Lampa.Utils.addUrlComponent(url, 'kinopoisk=' + object.movie.kinopoisk_id);
        } else if (object.movie.imdb_id) {
            url = Lampa.Utils.addUrlComponent(url, 'imdb=' + object.movie.imdb_id);
        } else {
            onEmpty(); return;
        }
        network.timeout(15000);
        network.native(url, function (json) {
            if (json && json.length) {
                onDone(json);
            } else {
                onEmpty();
            }
        }, function (a, c) {
            onError(network.errorDecode ? network.errorDecode(a, c) : 'Ошибка сети');
        });
    }

    // ─── Список балансеров ────────────────────────────────────────────────────────
    var BALANCERS = [
        {
            key: 'videocdn',
            title: 'VideoCDN',
            search: searchVideoCDN,
            toItems: function (data) {
                return data.map(function (d) {
                    var isSerial = d.iframe_src && d.iframe_src.indexOf('/serial') >= 0;
                    return {
                        title:   (d.ru_title || d.en_title || d.title || '—'),
                        quality: d.max_quality ? d.max_quality + 'p' : '',
                        year:    (d.start_date || d.year || ''),
                        iframe:  'http:' + (d.iframe_src || ''),
                        isSerial: isSerial,
                        raw:     d
                    };
                });
            }
        },
        {
            key: 'collaps',
            title: 'Collaps',
            search: searchCollaps,
            toItems: function (data) {
                return data.map(function (d) {
                    return {
                        title:   'Collaps',
                        quality: '',
                        year:    '',
                        iframe:  d.iframe_url || '',
                        isSerial: !!(d.seasons),
                        raw:     d
                    };
                });
            }
        },
        {
            key: 'alloha',
            title: 'Alloha',
            search: searchAlloha,
            toItems: function (data) {
                return data.map(function (d) {
                    return {
                        title:   'Alloha',
                        quality: d.quality || '',
                        year:    '',
                        iframe:  d.iframe_url || '',
                        isSerial: false,
                        raw:     d
                    };
                });
            }
        },
        {
            key: 'hdvb',
            title: 'HDVB',
            search: searchHDVB,
            toItems: function (data) {
                return data.map(function (d) {
                    return {
                        title:   d.translate || 'HDVB',
                        quality: '',
                        year:    '',
                        iframe:  d.iframe_url || '',
                        isSerial: false,
                        raw:     d
                    };
                });
            }
        },
        {
            key: 'kinobox',
            title: 'Kinobox',
            search: searchKinobox,
            toItems: function (data) {
                return data.map(function (d) {
                    return {
                        title:   d.source || 'Kinobox',
                        quality: '',
                        year:    '',
                        iframe:  d.iframeUrl || '',
                        isSerial: false,
                        raw:     d
                    };
                });
            }
        }
    ];

    // ─── Компонент Online ─────────────────────────────────────────────────────────
    function OnlineComponent(object) {
        var network  = new Lampa.Reguest();
        var scroll   = new Lampa.Scroll({ mask: true, over: true });
        var files    = new Lampa.Files(object);
        var last;

        var saved_bal = Lampa.Storage.get('online_balanser', 'videocdn');
        var bal_cache = Lampa.Storage.cache('online_last_balanser', 200, {});
        var balanser  = bal_cache[object.movie && object.movie.id] || saved_bal;

        // Проверяем что балансер существует
        var bal_keys = BALANCERS.map(function (b) { return b.key; });
        if (bal_keys.indexOf(balanser) < 0) balanser = 'videocdn';

        scroll.body().addClass('torrent-list');

        function getBalancer() {
            for (var i = 0; i < BALANCERS.length; i++) {
                if (BALANCERS[i].key === balanser) return BALANCERS[i];
            }
            return BALANCERS[0];
        }

        // ── Поиск ────────────────────────────────────────────────────────────────
        this.find = function () {
            this.activity.loader(true);
            network.clear();

            var bal = getBalancer();

            bal.search(object, network,
                // onDone
                function (data) {
                    var items = bal.toItems(data);
                    self.renderItems(items);
                    self.loading(false);
                },
                // onEmpty — попробуем через TMDB получить imdb_id и повторить
                function () {
                    if ((!object.movie.imdb_id) && object.movie.id && (object.movie.source === 'tmdb' || object.movie.source === 'cub')) {
                        var type    = object.movie.name ? 'tv' : 'movie';
                        var tmdburl = type + '/' + object.movie.id + '/external_ids?api_key=4ef0d7355d9ffb5151e987764708ce96&language=ru';
                        var baseurl = typeof Lampa.TMDB !== 'undefined'
                            ? Lampa.TMDB.api(tmdburl)
                            : 'http://api.themoviedb.org/' + tmdburl;

                        network.timeout(10000);
                        network.native(baseurl, function (ttid) {
                            if (ttid && ttid.imdb_id) {
                                object.movie.imdb_id = ttid.imdb_id;
                                // повторный поиск с imdb_id
                                bal.search(object, network,
                                    function (data) {
                                        var items = bal.toItems(data);
                                        self.renderItems(items);
                                        self.loading(false);
                                    },
                                    function () { self.empty(); },
                                    function (e) { self.empty(e); }
                                );
                            } else {
                                self.empty();
                            }
                        }, function () { self.empty(); });
                    } else {
                        self.empty();
                    }
                },
                // onError
                function (msg) { self.empty(msg); }
            );
        };

        // ── Отрисовка элементов ───────────────────────────────────────────────────
        this.renderItems = function (items) {
            scroll.clear();
            scroll.append(filter_elem());

            if (!items || !items.length) {
                self.empty();
                return;
            }

            items.forEach(function (item) {
                var quality = item.quality ? item.quality : (item.year ? String(item.year).slice(0, 4) : '');
                var elem    = Lampa.Template.get('online_item', {
                    title:   item.title,
                    quality: quality
                });

                elem.on('hover:focus', function (e) {
                    last = e.target;
                    scroll.update($(e.target), true);
                });

                elem.on('hover:enter', function () {
                    if (!item.iframe) {
                        Lampa.Noty.show(t('online_nolink'));
                        return;
                    }
                    Lampa.Player.play({
                        title: (object.movie.title || object.movie.name || '') + (item.title && item.title !== 'VideoCDN' ? ' — ' + item.title : ''),
                        url:   item.iframe
                    });
                    Lampa.Player.playlist([{ url: item.iframe, title: item.title }]);
                });

                scroll.append(elem);
            });

            self.start();
        };

        // ── Фильтр балансера ──────────────────────────────────────────────────────
        function filter_elem() {
            var f = new Lampa.Filter(object);

            var sort_items = BALANCERS.map(function (b) {
                return { title: b.title, source: b.key, selected: b.key === balanser };
            });

            f.set('sort', sort_items);
            f.render().find('.filter--sort span').text(t('online_balancer'));

            f.onSelect = function (type, a) {
                if (type === 'sort') {
                    balanser = a.source;
                    Lampa.Storage.set('online_balanser', balanser);
                    bal_cache[object.movie.id] = balanser;
                    Lampa.Storage.set('online_last_balanser', bal_cache);
                    self.search();
                    setTimeout(Lampa.Select.close, 10);
                }
            };

            f.onBack = function () { self.start(); };

            return f.render();
        }

        // ── Вспомогательные методы ────────────────────────────────────────────────
        this.search = function () {
            this.activity.loader(true);
            scroll.clear();
            this.find();
        };

        this.empty = function (msg) {
            var empty = Lampa.Template.get('list_empty');
            if (msg) empty.find('.empty__descr').text(msg);
            else      empty.find('.empty__descr').text(t('online_empty'));
            scroll.clear();
            scroll.append(empty);
            this.loading(false);
        };

        this.loading = function (status) {
            if (status) {
                this.activity.loader(true);
            } else {
                this.activity.loader(false);
                this.activity.toggle();
            }
        };

        // ── Lifecycle ─────────────────────────────────────────────────────────────
        var self = this;

        this.create = function () {
            files.append(scroll.render());
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
                down:  function () { Navigator.move('down'); },
                right: function () {
                    if (Navigator.canmove('right')) Navigator.move('right');
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
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
            network = null;
        };
    }

    // ─── Кнопка на карточке фильма ────────────────────────────────────────────────
    var BTN_HTML =
        '<div class="full-start__button selector view--online" data-subtitle="v2.0">' +
        '  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="512" height="512" fill="none">' +
        '    <circle cx="15" cy="15" r="13" stroke="currentColor" stroke-width="3.5"/>' +
        '    <polygon points="12,9 22,15 12,21" fill="currentColor"/>' +
        '  </svg>' +
        '  <span>#{online_title}</span>' +
        '</div>';

    // ─── Настройки: прокси ────────────────────────────────────────────────────────
    function addProxySettings() {
        if (!Lampa.Settings || !Lampa.Settings.main) return;
        if (Lampa.Settings.main().render().find('[data-component="online_proxy"]').length) return;

        Lampa.Template.add('settings_online_proxy',
            '<div>' +
            BALANCERS.map(function (b) {
                return '<div class="settings-param selector" data-type="input" data-name="online_proxy_' + b.key + '" placeholder="#{online_proxy_ph}">' +
                    '<div class="settings-param__name">' + b.title + ' Proxy</div>' +
                    '<div class="settings-param__value"></div>' +
                    '</div>';
            }).join('') +
            '<div class="settings-param selector" data-type="input" data-name="online_proxy_all" placeholder="#{online_proxy_ph}">' +
            '<div class="settings-param__name">#{online_proxy} (все)</div>' +
            '<div class="settings-param__value"></div>' +
            '</div>' +
            '</div>'
        );

        BALANCERS.forEach(function (b) { Lampa.Params.select('online_proxy_' + b.key, '', ''); });
        Lampa.Params.select('online_proxy_all', '', '');

        var field = $('<div class="settings-folder selector" data-component="online_proxy">' +
            '<div class="settings-folder__icon">' +
            '<svg height="46" viewBox="0 0 42 46" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="1.5" y="26.5" width="39" height="18" rx="1.5" stroke="white" stroke-width="3"/>' +
            '<circle cx="9.5" cy="35.5" r="3.5" fill="white"/>' +
            '<circle cx="26.5" cy="35.5" r="2.5" fill="white"/>' +
            '<circle cx="32.5" cy="35.5" r="2.5" fill="white"/>' +
            '<circle cx="21.5" cy="5.5" r="5.5" fill="white"/>' +
            '<rect x="31" y="4" width="11" height="3" rx="1.5" fill="white"/>' +
            '<rect y="4" width="11" height="3" rx="1.5" fill="white"/>' +
            '<rect x="20" y="14" width="3" height="7" rx="1.5" fill="white"/>' +
            '</svg></div>' +
            '<div class="settings-folder__name">#{online_proxy}</div>' +
            '</div>');

        field = $(Lampa.Lang.translate(field[0].outerHTML));
        Lampa.Settings.main().render().find('[data-component="more"]').after(field);
        Lampa.Settings.main().update();
    }

    // ─── Инициализация ────────────────────────────────────────────────────────────
    function init() {
        addTemplates();

        Lampa.Component.add('online', OnlineComponent);

        // Добавляем кнопку на карточку
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            // Удаляем старую кнопку чтобы не дублировать
            e.object.activity.render().find('.view--online').remove();

            var btn = $(Lampa.Lang.translate(BTN_HTML));

            btn.on('hover:enter', function () {
                addTemplates();
                Lampa.Component.add('online', OnlineComponent);

                Lampa.Activity.push({
                    url:        '',
                    title:      t('online_title'),
                    component:  'online',
                    search:     e.data.movie.title || e.data.movie.name,
                    search_one: e.data.movie.title,
                    search_two: e.data.movie.original_title,
                    movie:      e.data.movie,
                    page:       1
                });
            });

            // Вставляем кнопку — пробуем несколько мест
            var inserted = false;
            var anchors  = ['.view--torrent', '.view--trailer', '.view--bookmark', '.full-start__buttons .selector'];
            for (var i = 0; i < anchors.length; i++) {
                var anchor = e.object.activity.render().find(anchors[i]).last();
                if (anchor.length) {
                    anchor.after(btn);
                    inserted = true;
                    break;
                }
            }
            // Если вообще не нашли ничего — добавляем в конец блока кнопок
            if (!inserted) {
                var btns = e.object.activity.render().find('.full-start__buttons');
                if (btns.length) btns.append(btn);
                else e.object.activity.render().append(btn);
            }
        });

        // Настройки прокси
        if (window.appready) {
            addProxySettings();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') addProxySettings();
            });
        }
    }

    init();

})();
