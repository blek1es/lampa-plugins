(function () {
    'use strict';

    // Публичные источники без токенов
    var SOURCES = {
        hdvb: {
            name: 'HDVB',
            host: 'https://hdvb.tv',
            search: '/api/videos.json',
            embed: '/embed/'
        },
        collaps: {
            name: 'Collaps',
            host: 'https://collaps.tv',
            iframe: '/iframe/'
        },
        alloha: {
            name: 'Alloha',
            host: 'https://alloha.tv',
            iframe: '/?kp='
        }
    };

    function OnlinePlugin() {
        var network = new Lampa.Reguest();

        // Поиск через HDVB (публичный API)
        this.search = function (object, success, error) {
            var title = object.search || object.movie.title || object.movie.original_title;
            var kp_id = object.movie.kinopoisk_id || '';
            var imdb_id = object.movie.imdb_id || '';

            var results = [];

            // HDVB
            if (kp_id) {
                results.push({
                    source: 'hdvb',
                    title: 'HDVB',
                    kp_id: kp_id,
                    imdb_id: imdb_id
                });
            }

            // Collaps
            if (kp_id) {
                results.push({
                    source: 'collaps',
                    title: 'Collaps',
                    kp_id: kp_id
                });
            }

            // Alloha
            if (kp_id) {
                results.push({
                    source: 'alloha',
                    title: 'Alloha',
                    kp_id: kp_id
                });
            }

            if (results.length > 0) {
                success(results);
            } else {
                error();
            }
        };

        // Получение iframe ссылок
        this.getIframe = function (source, kp_id, imdb_id) {
            var src = SOURCES[source];
            if (!src) return '';

            switch (source) {
                case 'hdvb':
                    return src.host + src.embed + (kp_id || imdb_id);
                case 'collaps':
                    return src.host + src.iframe + kp_id;
                case 'alloha':
                    return src.host + src.iframe + kp_id;
                default:
                    return '';
            }
        };

        // Парсинг плейлиста из iframe
        this.parseIframe = function (url, success, error) {
            network.silent(url, function (html) {
                try {
                    // Ищем JSON с данными плеера
                    var match = html.match(/playerObject\s*=\s*({[\s\S]*?});/);
                    if (match) {
                        var data = JSON.parse(match[1]);
                        success(data);
                    } else {
                        error();
                    }
                } catch (e) {
                    console.error('Parse error:', e);
                    error();
                }
            }, error);
        };
    }

    function startPlugin() {
        window.online_watch_plugin = new OnlinePlugin();

        Lampa.Component.add('online_watch', component);

        function component(object) {
            var network = new Lampa.Reguest();
            var scroll = new Lampa.Scroll({
                mask: true,
                over: true
            });
            var files = new Lampa.Explorer(object);
            var filter = new Lampa.Filter(object);

            var active = 0;
            var selected = {};
            var sources = [];
            var loading = false;

            this.create = function () {
                var _this = this;

                this.activity.loader(true);

                filter.onSearch = function (value) {
                    Lampa.Activity.replace({
                        search: value,
                        clarification: true
                    });
                };

                filter.onBack = function () {
                    _this.start();
                };

                filter.render().appendTo(scroll.render());
                scroll.append(files.render());

                this.search();

                return this.render();
            };

            this.search = function () {
                var _this = this;

                if (loading) return;
                loading = true;

                window.online_watch_plugin.search(object, function (results) {
                    loading = false;
                    _this.activity.loader(false);

                    if (results.length) {
                        sources = results;
                        _this.buildSources(results);
                    } else {
                        _this.empty('Не найден Kinopoisk ID');
                    }
                }, function () {
                    loading = false;
                    _this.activity.loader(false);
                    _this.empty('Ошибка поиска');
                });
            };

            this.buildSources = function (results) {
                var _this = this;

                files.clear();

                results.forEach(function (item, index) {
                    var element = Lampa.Template.get('online_source', {
                        title: item.title,
                        source: item.source
                    });

                    element.on('hover:focus', function () {
                        active = index;
                        selected = item;
                    });

                    element.on('hover:enter', function () {
                        _this.start();
                    });

                    files.append(element);
                });

                files.update();
            };

            this.start = function () {
                if (selected.source) {
                    var iframe_url = window.online_watch_plugin.getIframe(
                        selected.source,
                        selected.kp_id,
                        selected.imdb_id
                    );

                    if (iframe_url) {
                        // Открываем iframe плеер
                        Lampa.Player.play({
                            url: iframe_url,
                            title: object.movie.title || object.movie.original_title,
                            player: 'iframe'
                        });

                        // Альтернатива: открыть в новом окне
                        // window.open(iframe_url, '_blank');
                    }
                }
            };

            this.empty = function (message) {
                var empty = Lampa.Template.get('online_empty', {
                    title: 'Ничего не найдено',
                    text: message || 'По данному запросу нет результатов'
                });
                files.append(empty);
                this.start = function () {};
            };

            this.render = function () {
                return scroll.render();
            };

            this.destroy = function () {
                network.clear();
                scroll.destroy();
                files.destroy();
                filter.destroy();
            };
        }

        // Шаблоны
        Lampa.Template.add('online_source', '<div class="online-file selector">\
            <div class="online-file__title">{{title}}</div>\
            <div class="online-file__source">Источник: {{source}}</div>\
        </div>');

        Lampa.Template.add('online_empty', '<div class="online-empty">\
            <div class="online-empty__title">{{title}}</div>\
            <div class="online-empty__text">{{text}}</div>\
        </div>');

        // Регистрация в меню
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var button = $('<div class="full-start__button selector">\
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">\
                        <circle cx="9" cy="9" r="8" stroke="white" stroke-width="2"/>\
                        <path d="M7 6L12 9L7 12V6Z" fill="white"/>\
                    </svg>\
                    <span>Онлайн</span>\
                </div>');

                button.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'Онлайн просмотр',
                        component: 'online_watch',
                        movie: e.data.movie,
                        page: 1
                    });
                });

                e.object.activity.render().find('.view--online').append(button);
            }
        });
    }

    if (window.Lampa) {
        startPlugin();
    } else {
        window.addEventListener('lampa:ready', startPlugin);
    }

})();
