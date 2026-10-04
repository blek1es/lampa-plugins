(function () {
    'use strict';

    // ─── Защита от двойной загрузки ──────────────────────────────────────────
    if (window.collaps_lampa_plugin) return;
    window.collaps_lampa_plugin = true;

    // ─── Источник Collaps ────────────────────────────────────────────────────
    function getCollapsUrl(movie) {
        var kp = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
        return kp ? 'https://api.delivembd.ws/embed/kp/' + kp : null;
    }

    // ─── Компонент плеера ────────────────────────────────────────────────────
    function CollapsPlayer(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({
            mask: true,
            over: true
        });

        var html, iframe, loader;
        var movie = object.movie;
        var iframeUrl = getCollapsUrl(movie);
        var loaded = false;

        this.create = function () {
            html = $('<div></div>');

            // Контейнер для iframe
            var player = $('<div class="collaps-player"></div>');
            player.css({
                'width': '100%',
                'height': '100%',
                'position': 'relative',
                'background': '#000'
            });

            // Лоадер
            loader = $('<div class="collaps-loader"></div>');
            loader.css({
                'position': 'absolute',
                'top': '50%',
                'left': '50%',
                'transform': 'translate(-50%, -50%)',
                'text-align': 'center',
                'color': '#fff'
            });

            if (!iframeUrl) {
                loader.html('<div style="padding:2em">Нет ID Кинопоиска</div>');
                player.append(loader);
                html.append(player);
                return html;
            }

            loader.html('<div class="broadcast__scan"><div></div></div><div style="margin-top:1em">Загрузка Collaps...</div>');

            // Iframe
            iframe = $('<iframe></iframe>');
            iframe.attr({
                'src': iframeUrl,
                'frameborder': '0',
                'allowfullscreen': 'true',
                'allow': 'autoplay; fullscreen; encrypted-media',
                'referrerpolicy': 'no-referrer',
                'sandbox': 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals'
            });
            iframe.css({
                'width': '100%',
                'height': '100%',
                'border': 'none',
                'display': 'none'
            });

            iframe.on('load', function () {
                loaded = true;
                loader.hide();
                iframe.show();
            });

            // Таймаут на загрузку
            setTimeout(function () {
                if (!loaded) {
                    loader.html('<div style="padding:2em;color:#ff6b6b">Collaps не отвечает<br><small>Попробуйте позже</small></div>');
                    iframe.hide();
                }
            }, 15000);

            player.append(loader, iframe);
            html.append(player);

            return html;
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(false, scroll.render());
                },
                back: this.back
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function () {};
        this.stop = function () {};
        this.render = function () {
            return html;
        };

        this.back = function () {
            Lampa.Activity.backward();
        };

        this.destroy = function () {
            network.clear();
            if (iframe) {
                iframe.attr('src', 'about:blank');
                iframe.remove();
            }
            if (html) html.remove();
            html = null;
            iframe = null;
            loader = null;
        };
    }

    // ─── Регистрация компонента ──────────────────────────────────────────────
    Lampa.Component.add('collaps_player', CollapsPlayer);

    // ─── Добавление кнопки в карточку ────────────────────────────────────────
    function addButton() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var movie = e.data.movie;
            var buttons = e.object.activity.render().find('.full-start__buttons');

            // Проверяем, есть ли уже кнопка
            if (buttons.find('.collaps-button').length) return;

            // Проверяем наличие kinopoisk_id
            var kp = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
            if (!kp) return;

            // Создаём кнопку в стиле Lampa
            var btn = $('<div class="full-start__button selector collaps-button"><svg width="17" height="20" viewBox="0 0 17 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M1.5 0.5L16.5 10L1.5 19.5V0.5Z"/></svg><span>Смотреть онлайн</span></div>');

            btn.on('hover:enter', function () {
                Lampa.Activity.push({
                    url: '',
                    title: 'Онлайн: ' + (movie.title || movie.name || ''),
                    component: 'collaps_player',
                    movie: movie,
                    page: 1
                });
            });

            // Вставляем после кнопки торрент или в конец
            var torrentBtn = buttons.find('.view--torrent');
            if (torrentBtn.length) {
                torrentBtn.after(btn);
            } else {
                buttons.append(btn);
            }

            // Обновляем контроллер
            Lampa.Controller.toggle('content');
        });
    }

    // ─── Инициализация ───────────────────────────────────────────────────────
    if (window.Lampa) {
        addButton();
    }

})();
