(function () {
    'use strict';

    // Источники для онлайн просмотра
    var sources = [
        { name: 'HDVB', url: 'https://hdvb.tv/embed/' },
        { name: 'Collaps', url: 'https://collaps.tv/iframe/' },
        { name: 'Alloha', url: 'https://alloha.tv/?kp=' },
        { name: 'Videocdn', url: 'https://videocdn.tv/embed/' }
    ];

    function component(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var items = [];
        var html = $('<div></div>');

        this.create = function () {
            var _this = this;

            scroll.render().addClass('online-watch-component');

            var kp_id = object.movie.kinopoisk_id;
            var imdb_id = object.movie.imdb_id;

            if (!kp_id && !imdb_id) {
                html.append('<div style="padding: 20px; color: white;">Не найден Kinopoisk ID или IMDB ID</div>');
                scroll.append(html);
                return this.render();
            }

            var title = $('<div style="padding: 20px; font-size: 18px; color: white;">Выберите источник:</div>');
            html.append(title);

            sources.forEach(function (source) {
                var item = $('<div class="selector" style="padding: 15px; margin: 10px 20px; background: rgba(255,255,255,0.1); border-radius: 5px; cursor: pointer;">\
                    <div style="font-size: 16px; color: white;">' + source.name + '</div>\
                </div>');

                item.on('hover:enter', function () {
                    var video_url = source.url + (kp_id || imdb_id);

                    Lampa.Player.play({
                        url: video_url,
                        title: object.movie.title || object.movie.original_title
                    });

                    Lampa.Player.playlist([{
                        title: object.movie.title || object.movie.original_title,
                        url: video_url
                    }]);
                });

                html.append(item);
                items.push(item);
            });

            scroll.append(html);

            return this.render();
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(items.length ? items[0] : false, scroll.render());
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    Navigator.move('down');
                },
                right: function () {
                    Navigator.move('right');
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};
        this.stop = function () {};
        this.render = function () {
            return scroll.render();
        };
        this.destroy = function () {
            scroll.destroy();
            html.remove();
        };
    }

    function init() {
        // Регистрируем компонент
        Lampa.Component.add('online_watch', component);

        // Добавляем в контекстное меню карточки
        Lampa.Listener.follow('contextmenu', function (e) {
            if (e.type == 'open' && e.item && e.item.id) {
                e.items.push({
                    title: 'Онлайн просмотр',
                    subtitle: 'Смотреть онлайн',
                    separator: true,
                    onEnter: function () {
                        Lampa.Activity.push({
                            url: '',
                            title: 'Онлайн просмотр',
                            component: 'online_watch',
                            movie: e.item,
                            page: 1
                        });
                    }
                });
            }
        });

        // Добавляем кнопку на странице фильма
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                setTimeout(function () {
                    var btn = $('<div class="full-start__button selector">\
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">\
                            <circle cx="10" cy="10" r="9" stroke="white" stroke-width="1.5"/>\
                            <path d="M8 6L14 10L8 14V6Z" fill="white"/>\
                        </svg>\
                        <span>Онлайн</span>\
                    </div>');

                    btn.on('hover:enter', function () {
                        Lampa.Activity.push({
                            url: '',
                            title: 'Онлайн просмотр',
                            component: 'online_watch',
                            movie: e.data.movie,
                            page: 1
                        });
                    });

                    $('.full-start__buttons').append(btn);
                }, 300);
            }
        });

        console.log('Online Watch Plugin loaded');
    }

    if (window.Lampa) {
        init();
    } else {
        window.addEventListener('lampa:ready', init);
    }

})();
