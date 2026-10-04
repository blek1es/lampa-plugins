(function () {
    'use strict';

    // ─── Защита от двойной загрузки ──────────────────────────────────────────
    if (window.plugin_collaps_online_ready) return;
    window.plugin_collaps_online_ready = true;

    // ─── Источник (только Collaps) ───────────────────────────────────────────
    var COLLAPS_IFRAME = function (movie) {
        var kp = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
        return kp ? 'https://api.delivembd.ws/embed/kp/' + kp : null;
    };

    // ─── Шаблон кнопки ───────────────────────────────────────────────────────
    var BUTTON_HTML = '<div class="full-start__button selector view--collaps-online">'
        + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30.051 30.051" width="512" height="512">'
        + '<path d="M19.982,14.438l-6.24-4.536c-0.229-0.166-0.533-0.191-0.784-0.062'
        + 'c-0.253,0.128-0.411,0.388-0.411,0.669v9.069c0,0.284,0.158,0.543,0.411,0.671'
        + 'c0.107,0.054,0.224,0.081,0.342,0.081c0.154,0,0.31-0.049,0.442-0.146l6.24-4.532'
        + 'c0.197-0.145,0.312-0.369,0.312-0.607C20.295,14.803,20.177,14.58,19.982,14.438z" fill="currentColor"/>'
        + '<path d="M15.026,0.002C6.726,0.002,0,6.728,0,15.028c0,8.297,6.726,15.021,15.026,15.021'
        + 'c8.298,0,15.025-6.725,15.025-15.021C30.052,6.728,23.324,0.002,15.026,0.002z'
        + 'M15.026,27.542c-6.912,0-12.516-5.601-12.516-12.514c0-6.91,5.604-12.518,12.516-12.518'
        + 'c6.911,0,12.514,5.607,12.514,12.518C27.541,21.941,21.937,27.542,15.026,27.542z" fill="currentColor"/>'
        + '</svg>'
        + '<span>Смотреть онлайн</span>'
        + '</div>';

    // ─── CSS (оптимизировано для Smart TV) ──────────────────────────────────
    $('head').append('<style id="collaps-online-style">'
        + '.collaps-wrap{display:-webkit-box;display:-webkit-flex;display:flex;'
        +   '-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;flex-direction:column;'
        +   'width:100%;height:100%;background:#141519}'
        + '.collaps-player{-webkit-box-flex:1;-webkit-flex:1;flex:1;position:relative;background:#000;min-height:0}'
        + '.collaps-iframe{position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;border:none}'
        + '.collaps-loader{position:absolute;top:0;left:0;right:0;bottom:0;display:-webkit-box;display:-webkit-flex;display:flex;'
        +   '-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;flex-direction:column;'
        +   '-webkit-box-align:center;-webkit-align-items:center;align-items:center;'
        +   '-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;'
        +   'background:#141519}'
        + '.collaps-spin{width:2.5em;height:2.5em;margin-bottom:1em;border:.25em solid rgba(255,255,255,.15);'
        +   'border-top-color:#e8a838;border-radius:50%;'
        +   '-webkit-animation:collaps-spin .7s linear infinite;animation:collaps-spin .7s linear infinite}'
        + '.collaps-msg{font-size:.9em;color:rgba(255,255,255,.4);text-align:center;padding:0 2em}'
        + '@-webkit-keyframes collaps-spin{to{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}'
        + '@keyframes collaps-spin{to{-webkit-transform:rotate(360deg);transform:rotate(360deg)}}'
        + '</style>');

    // ─── Компонент ───────────────────────────────────────────────────────────
    function CollapsOnlineComponent(object) {
        var movie     = object.movie || {};
        var iframeUrl = COLLAPS_IFRAME(movie);

        var self      = this;
        var $root     = $('<div class="collaps-wrap"></div>');
        var $iframe   = null;
        var $loader   = null;
        var loadTimer = null;
        var destroyed = false;
        var keyHandler = null;

        // ── Зона плеера ──
        var $player = $('<div class="collaps-player"></div>');
        $loader = $('<div class="collaps-loader"><div class="collaps-spin"></div><div class="collaps-msg">Загрузка...</div></div>');
        $iframe = $('<iframe class="collaps-iframe" allowfullscreen allow="autoplay; fullscreen; encrypted-media" referrerpolicy="no-referrer" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"></iframe>');
        $iframe.hide();
        $player.append($loader, $iframe);
        $root.append($player);

        // ── Обработка клавиш пульта ДУ ──
        keyHandler = function(e) {
            if (destroyed) return;

            // Back / Escape - выход из плеера
            if (e.keyCode === 27 || e.keyCode === 8 || e.keyCode === 10009 || e.keyCode === 461) {
                e.preventDefault();
                e.stopPropagation();
                Lampa.Activity.backward();
                return false;
            }
        };

        // Привязываем обработчик клавиш
        $(document).on('keydown', keyHandler);

        this.load = function () {
            if (destroyed) return;

            if (!iframeUrl) {
                $loader.find('.collaps-msg').text('Нет ID Кинопоиска для этого фильма');
                return;
            }

            // Спиннер
            clearTimeout(loadTimer);
            $loader.find('.collaps-msg').text('Загрузка Collaps...');
            $loader.show();
            $iframe.hide().attr('src', 'about:blank');

            // Загружаем
            setTimeout(function () {
                if (destroyed) return;
                $iframe.attr('src', iframeUrl);
                $iframe.off('load').on('load', function () {
                    clearTimeout(loadTimer);
                    $loader.hide();
                    $iframe.show();
                });
                loadTimer = setTimeout(function () {
                    if (destroyed) return;
                    $loader.find('.collaps-msg').text('Collaps не отвечает');
                    $iframe.hide();
                }, 14000);
            }, 100);
        };

        this.create  = function () {
            setTimeout(function () { self.load(); }, 150);
            return $root;
        };
        this.render  = function () { return $root; };
        this.start   = function () {};
        this.pause   = function () {};
        this.stop    = function () {};
        this.destroy = function () {
            destroyed = true;
            clearTimeout(loadTimer);

            // Отключаем обработчик клавиш
            if (keyHandler) {
                $(document).off('keydown', keyHandler);
                keyHandler = null;
            }

            if ($iframe) $iframe.attr('src', 'about:blank');
        };
    }

    // ─── Регистрация компонента ──────────────────────────────────────────────
    Lampa.Component.add('collaps_online', CollapsOnlineComponent);

    // ─── Добавление кнопки после загрузки Lampa ──────────────────────────────
    function initButton() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var movie  = e.data.movie;
            var render = e.object.activity.render();

            // Проверяем, не добавлена ли уже кнопка
            if (render.find('.view--collaps-online').length) return;

            var $btn = $(BUTTON_HTML);

            // Поддержка событий Lampa (hover:enter) и клавиш пульта
            $btn.on('hover:enter', function () {
                Lampa.Activity.push({
                    url:       '',
                    title:     'Онлайн: ' + (movie.title || movie.name || ''),
                    component: 'collaps_online',
                    movie:     movie,
                    page:      1
                });
            });

            // Добавляем поддержку клика и Enter для Smart TV
            $btn.on('click', function (e) {
                e.preventDefault();
                Lampa.Activity.push({
                    url:       '',
                    title:     'Онлайн: ' + (movie.title || movie.name || ''),
                    component: 'collaps_online',
                    movie:     movie,
                    page:      1
                });
            });

            // Обработка Enter на кнопке
            $btn.on('keydown', function (e) {
                if (e.keyCode === 13) { // Enter
                    e.preventDefault();
                    Lampa.Activity.push({
                        url:       '',
                        title:     'Онлайн: ' + (movie.title || movie.name || ''),
                        component: 'collaps_online',
                        movie:     movie,
                        page:      1
                    });
                }
            });

            // Вставляем после кнопки торрент
            var $torrent = render.find('.view--torrent');
            if ($torrent.length) {
                $torrent.after($btn);
            } else {
                // Нет кнопки торрент — вставляем после первой кнопки
                var $firstBtn = render.find('.full-start__button').first();
                if ($firstBtn.length) {
                    $firstBtn.after($btn);
                }
            }
        });
    }

    // ─── Инициализация ───────────────────────────────────────────────────────
    if (window.Lampa) {
        initButton();
    } else {
        window.addEventListener('DOMContentLoaded', function() {
            if (window.Lampa) initButton();
        });
    }

})();
