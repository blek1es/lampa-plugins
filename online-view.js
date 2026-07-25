(function () {
    'use strict';

    // ─── Защита от двойной загрузки ──────────────────────────────────────────
    if (window.plugin_online_view_ready) return;
    window.plugin_online_view_ready = true;

    // ─── Источники ───────────────────────────────────────────────────────────
    var SOURCES = [
        {
            name: 'Collaps',
            iframe: function (movie) {
                var kp = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
                return kp ? 'https://api.delivembd.ws/embed/kp/' + kp : null;
            }
        },
        {
            name: 'Alloha',
            iframe: function (movie) {
                var kp   = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
                var imdb = movie.imdb_id      || (movie.ids && movie.ids.imdb);
                if (kp)   return 'https://p.alloha.tv/iframe?kp='   + kp   + '&token=04941a9a3ca3ac16e2b4327347bbc1';
                if (imdb) return 'https://p.alloha.tv/iframe?imdb=' + imdb + '&token=04941a9a3ca3ac16e2b4327347bbc1';
                return null;
            }
        },
        {
            name: 'HDVB',
            iframe: function (movie) {
                var kp   = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
                var imdb = movie.imdb_id      || (movie.ids && movie.ids.imdb);
                if (kp)   return 'https://apivb.info/api/embed.php?kp_id='   + kp;
                if (imdb) return 'https://apivb.info/api/embed.php?imdb_id=' + imdb;
                return null;
            }
        },
        {
            name: 'Bazon',
            iframe: function (movie) {
                var kp = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
                return kp ? 'https://bazon.cc/kp/' + kp : null;
            }
        }
    ];

    // ─── Шаблон кнопки (точно как в online.js) ───────────────────────────────
    var BUTTON_HTML = '<div class="full-start__button selector view--online-view">'
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

    // ─── CSS ─────────────────────────────────────────────────────────────────
    $('head').append('<style id="ov-style">'
        + '.ov-wrap{display:flex;flex-direction:column;width:100%;height:100%;background:#141519}'
        + '.ov-tabs{display:flex;gap:.5em;padding:.6em 1em;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}'
        + '.ov-tab{padding:.4em 1.2em;border-radius:2em;font-size:.85em;font-weight:600;cursor:pointer;'
        +   'background:rgba(255,255,255,.08);border:none;color:rgba(255,255,255,.5);transition:.15s}'
        + '.ov-tab.focus,.ov-tab:hover{background:rgba(255,255,255,.2);color:#fff}'
        + '.ov-tab.ov-active{background:#e8a838;color:#000}'
        + '.ov-player{flex:1;position:relative;background:#000;min-height:0}'
        + '.ov-iframe{position:absolute;inset:0;width:100%;height:100%;border:none}'
        + '.ov-loader{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;'
        +   'justify-content:center;gap:1em;background:#141519}'
        + '.ov-spin{width:2.5em;height:2.5em;border:.25em solid rgba(255,255,255,.15);'
        +   'border-top-color:#e8a838;border-radius:50%;animation:ov-spin .7s linear infinite}'
        + '.ov-msg{font-size:.9em;color:rgba(255,255,255,.4)}'
        + '@keyframes ov-spin{to{transform:rotate(360deg)}}'
        + '</style>');

    // ─── Компонент ───────────────────────────────────────────────────────────
    function OnlineViewComponent(object) {
        var movie     = object.movie || {};
        var available = SOURCES.filter(function (s) { return !!s.iframe(movie); });

        var self      = this;
        var $root     = $('<div class="ov-wrap"></div>');
        var $iframe   = null;
        var $loader   = null;
        var loadTimer = null;
        var destroyed = false;
        var curIdx    = -1;

        // ── Вкладки источников ──
        if (available.length > 1) {
            var $tabs = $('<div class="ov-tabs"></div>');
            available.forEach(function (src, i) {
                var $t = $('<button class="ov-tab selector">' + src.name + '</button>');
                $t.on('hover:enter', function () { self.load(i); });
                $tabs.append($t);
            });
            $root.append($tabs);
        }

        // ── Зона плеера ──
        var $player = $('<div class="ov-player"></div>');
        $loader = $('<div class="ov-loader"><div class="ov-spin"></div><div class="ov-msg">Загрузка...</div></div>');
        $iframe = $('<iframe class="ov-iframe" allowfullscreen allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>');
        $iframe.hide();
        $player.append($loader, $iframe);
        $root.append($player);

        this.load = function (idx) {
            if (destroyed || !available[idx] || idx === curIdx) return;
            curIdx = idx;

            // Активная вкладка
            $root.find('.ov-tab').removeClass('ov-active');
            $root.find('.ov-tab').eq(idx).addClass('ov-active');

            // Спиннер
            clearTimeout(loadTimer);
            $loader.find('.ov-msg').text('Загрузка ' + available[idx].name + '...');
            $loader.show();
            $iframe.hide().attr('src', 'about:blank');

            // Загружаем
            setTimeout(function () {
                if (destroyed) return;
                $iframe.attr('src', available[idx].iframe(movie));
                $iframe.off('load').on('load', function () {
                    $loader.hide();
                    $iframe.show();
                });
                loadTimer = setTimeout(function () {
                    if (destroyed) return;
                    $loader.find('.ov-msg').text(available[idx].name + ' не отвечает. Попробуй другой источник.');
                    $iframe.hide();
                }, 14000);
            }, 100);
        };

        this.create  = function () {
            if (available.length) setTimeout(function () { self.load(0); }, 150);
            else $loader.find('.ov-msg').text('Нет источников для этого фильма');
            return $root;
        };
        this.render  = function () { return $root; };
        this.start   = function () {};
        this.pause   = function () {};
        this.stop    = function () {};
        this.destroy = function () {
            destroyed = true;
            clearTimeout(loadTimer);
            $iframe.attr('src', 'about:blank');
        };
    }

    // ─── Регистрация компонента — сразу, до appready ──────────────────────────
    Lampa.Component.add('online_view_iframe', OnlineViewComponent);

    // ─── Кнопка в карточке фильма ─────────────────────────────────────────────
    Lampa.Listener.follow('full', function (e) {
        if (e.type !== 'complite') return;

        var movie  = e.data.movie;
        var render = e.object.activity.render();

        var $btn = $(BUTTON_HTML);

        $btn.on('hover:enter', function () {
            Lampa.Activity.push({
                url:       '',
                title:     'Онлайн: ' + (movie.title || movie.name || ''),
                component: 'online_view_iframe',
                movie:     movie,
                page:      1
            });
        });

        // Вставляем после кнопки торрент (точно как online.js после .view--online)
        var $torrent = render.find('.view--torrent');
        if ($torrent.length) {
            $torrent.after($btn);
        } else {
            // Нет кнопки торрент — вставляем после первой кнопки
            render.find('.full-start__button').first().after($btn);
        }
    });

})();
