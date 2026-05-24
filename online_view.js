(function () {
    'use strict';

    // ─── Конфигурация ────────────────────────────────────────────────────────
    var PLUGIN_ID      = 'online_view';
    var PLUGIN_TITLE   = 'Онлайн';
    var PLUGIN_VERSION = '2.0.0';

    // Источники — только iframe-совместимые
    // Добавляй новые сюда: { name, color, iframe(card) }
    var SOURCES = [
        {
            name: 'Collaps',
            color: '#e8a838',
            iframe: function (card) {
                var kp = card.kinopoisk_id || (card.ids && card.ids.kinopoisk);
                if (kp) return 'https://api.delivembd.ws/embed/kp/' + kp;
                return null;
            }
        },
        {
            name: 'Alloha',
            color: '#4e90e8',
            iframe: function (card) {
                var kp   = card.kinopoisk_id || (card.ids && card.ids.kinopoisk);
                var imdb = card.imdb_id      || (card.ids && card.ids.imdb);
                if (kp)   return 'https://p.alloha.tv/iframe?kp='   + kp   + '&token=04941a9a3ca3ac16e2b4327347bbc1';
                if (imdb) return 'https://p.alloha.tv/iframe?imdb=' + imdb + '&token=04941a9a3ca3ac16e2b4327347bbc1';
                return null;
            }
        },
        {
            name: 'HDVB',
            color: '#5dbf72',
            iframe: function (card) {
                var kp   = card.kinopoisk_id || (card.ids && card.ids.kinopoisk);
                var imdb = card.imdb_id      || (card.ids && card.ids.imdb);
                if (kp)   return 'https://apivb.info/api/embed.php?kp_id='   + kp;
                if (imdb) return 'https://apivb.info/api/embed.php?imdb_id=' + imdb;
                return null;
            }
        },
        {
            name: 'Bazon',
            color: '#b06ee8',
            iframe: function (card) {
                var kp = card.kinopoisk_id || (card.ids && card.ids.kinopoisk);
                if (kp) return 'https://bazon.cc/kp/' + kp;
                return null;
            }
        }
    ];

    // ─── CSS (один раз) ──────────────────────────────────────────────────────
    function injectCSS() {
        if (document.getElementById('ov-style')) return;
        var s = document.createElement('style');
        s.id  = 'ov-style';
        s.textContent = [
            /* Обёртка экрана — занимает весь activity-slot Lampa */
            '.ov-screen{display:flex;flex-direction:column;width:100%;height:100%;background:#0d0f14;color:#f0f2f7;font-family:inherit}',

            /* Шапка */
            '.ov-header{display:flex;align-items:center;gap:16px;padding:18px 28px 14px;border-bottom:1px solid #1e2130;flex-shrink:0}',
            '.ov-header-back{width:36px;height:36px;border-radius:8px;background:#1e2130;border:1px solid #2e3140;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}',
            '.ov-header-back svg{width:18px;height:18px;fill:#c8cdd8}',
            '.ov-header-info{flex:1;min-width:0}',
            '.ov-header-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#4e5470;margin-bottom:2px}',
            '.ov-header-title{font-size:17px;font-weight:600;color:#f0f2f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
            '.ov-header-src{font-size:12px;color:#6c7080;margin-top:1px}',

            /* Строка источников */
            '.ov-sources{display:flex;align-items:center;gap:8px;padding:10px 28px;border-bottom:1px solid #1e2130;flex-shrink:0;overflow-x:auto}',
            '.ov-sources::-webkit-scrollbar{display:none}',
            '.ov-src-btn{padding:6px 16px;border-radius:20px;border:1px solid #2e3140;background:#1e2130;color:#8892a8;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .15s;outline:none;flex-shrink:0}',
            '.ov-src-btn.active{border-color:var(--ov-src-color,#4e90e8);background:var(--ov-src-color,#4e90e8);color:#fff}',
            '.ov-src-btn.selector:focus,.ov-src-btn:hover{border-color:#4e90e8;color:#fff}',
            '.ov-src-btn:disabled{opacity:.35;cursor:default}',

            /* Плеер */
            '.ov-player{flex:1;position:relative;background:#000;min-height:0}',
            '.ov-iframe{width:100%;height:100%;border:none;display:block}',

            /* Заглушка / статус */
            '.ov-status{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0d0f14;z-index:5}',
            '.ov-status-icon{font-size:40px;opacity:.4}',
            '.ov-status-text{font-size:15px;color:#6c7080;text-align:center;line-height:1.6;max-width:320px}',
            '.ov-spinner{width:32px;height:32px;border:3px solid #2e3140;border-top-color:#4e90e8;border-radius:50%;animation:ov-spin .7s linear infinite}',
            '@keyframes ov-spin{to{transform:rotate(360deg)}}',

            /* Фокус пульта — подсветка */
            '.ov-focused{outline:2px solid #4e90e8 !important;outline-offset:2px}'
        ].join('');
        document.head.appendChild(s);
    }

    // ─── Компонент экрана просмотра ──────────────────────────────────────────
    function OnlineViewComponent(object) {
        var card    = object.card || {};
        var title   = card.name || card.title || card.original_name || 'Без названия';
        var sources = SOURCES.filter(function (s) { return !!s.iframe(card); });

        var _this      = this;
        var _rendered  = false;
        var _dom       = null;
        var _iframe    = null;
        var _status    = null;
        var _activeIdx = 0;

        this.create = function () {
            injectCSS();
            _dom = $('<div class="ov-screen"></div>');

            // ── Шапка ──
            var header = $(
                '<div class="ov-header">' +
                    '<div class="ov-header-back selector" id="ov-back">' +
                        '<svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>' +
                    '</div>' +
                    '<div class="ov-header-info">' +
                        '<div class="ov-header-label">Онлайн просмотр</div>' +
                        '<div class="ov-header-title">' + $('<span>').text(title).html() + '</div>' +
                        '<div class="ov-header-src" id="ov-src-label">Выбери источник</div>' +
                    '</div>' +
                '</div>'
            );
            _dom.append(header);

            // ── Список источников ──
            var srcRow = $('<div class="ov-sources" id="ov-sources"></div>');
            if (sources.length === 0) {
                srcRow.html('<span style="color:#4e5470;font-size:13px">Нет доступных источников для этого фильма</span>');
            } else {
                sources.forEach(function (src, i) {
                    var btn = $('<button class="ov-src-btn selector">'
                        + src.name + '</button>');
                    btn.css('--ov-src-color', src.color);
                    if (i === 0) btn.addClass('active');
                    btn.on('hover:enter click', function () {
                        _this.loadSource(i);
                    });
                    srcRow.append(btn);
                });
            }
            _dom.append(srcRow);

            // ── Зона плеера ──
            var playerWrap = $('<div class="ov-player"></div>');
            _status = $('<div class="ov-status">'
                + '<div class="ov-status-icon">▶</div>'
                + '<div class="ov-status-text">Выбери источник выше<br>для начала просмотра</div>'
                + '</div>');
            _iframe = $('<iframe class="ov-iframe" allowfullscreen allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>');
            _iframe.hide();
            playerWrap.append(_status, _iframe);
            _dom.append(playerWrap);

            // Кнопка назад
            header.find('#ov-back').on('hover:enter click', function () {
                Lampa.Activity.back();
            });

            _rendered = true;

            // Автозагрузка первого источника
            if (sources.length > 0) {
                setTimeout(function () { _this.loadSource(0); }, 300);
            }

            return _dom;
        };

        this.loadSource = function (idx) {
            if (!sources[idx]) return;
            _activeIdx = idx;
            var src = sources[idx];
            var url = src.iframe(card);

            // Обновляем активную кнопку
            _dom.find('.ov-src-btn').each(function (i, el) {
                $(el).toggleClass('active', i === idx);
            });

            // Показываем спиннер
            _status.html('<div class="ov-spinner"></div>'
                + '<div class="ov-status-text">Загрузка ' + src.name + '…</div>').show();
            _iframe.hide().attr('src', '');

            // Задержка чтоб браузер сбросил старый iframe
            setTimeout(function () {
                _iframe.attr('src', url);
                _iframe.off('load').on('load', function () {
                    _status.fadeOut(200);
                    _iframe.show();
                });
                // Таймаут — если за 12 сек не загрузился
                clearTimeout(_this._loadTimer);
                _this._loadTimer = setTimeout(function () {
                    if (_iframe.is(':hidden')) {
                        _status.html('<div class="ov-status-icon">⚠</div>'
                            + '<div class="ov-status-text">'
                            + src.name + ' не отвечает.<br>'
                            + 'Попробуй другой источник.</div>').show();
                    }
                }, 12000);
            }, 100);

            // Обновляем подпись
            _dom.find('#ov-src-label').text('Источник: ' + src.name);
        };

        this.render  = function () { return _dom; };
        this.pause   = function () {};
        this.resume  = function () {};
        this.stop    = function () {
            clearTimeout(_this._loadTimer);
            if (_iframe) _iframe.attr('src', '');
        };
        this.destroy = function () {
            _this.stop();
            _dom.remove();
        };
    }

    // ─── Регистрация компонента ───────────────────────────────────────────────
    function registerComponent() {
        Lampa.Component.add(PLUGIN_ID, OnlineViewComponent);
    }

    // ─── Открыть экран просмотра ─────────────────────────────────────────────
    function openOnlineView(card) {
        Lampa.Activity.push({
            url:       '',
            title:     PLUGIN_TITLE + ': ' + (card.name || card.title || ''),
            component: PLUGIN_ID,
            card:      card,
            page:      1
        });
    }

    // ─── Встройка кнопки в карточку ──────────────────────────────────────────
    function hookFullCard() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var card = e.data.movie || e.data.card || e.data || {};

            // Проверяем, есть ли хоть один рабочий источник
            var hasSrc = SOURCES.some(function (s) { return !!s.iframe(card); });

            var btn = $('<div class="full-start__button selector">'
                + '<div class="full-start__icon">'
                + '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">'
                + '<path d="M8 5v14l11-7z"/></svg>'
                + '</div>'
                + '<div class="full-start__text">Смотреть онлайн</div>'
                + '</div>');

            if (!hasSrc) {
                btn.css('opacity', '.45').attr('title', 'Нет доступных источников');
            } else {
                btn.on('hover:enter', function () { openOnlineView(card); });
            }

            // Вставляем первой кнопкой в блок действий
            var actions = e.object.activity.render().find('.full-start__buttons,.full-start__actions');
            if (actions.length) {
                actions.prepend(btn);
            } else {
                e.object.activity.render().find('.full-start').append(btn);
            }
        });
    }

    // ─── Контекстное меню ────────────────────────────────────────────────────
    function hookContextMenu() {
        Lampa.Listener.follow('menu', function (e) {
            if (e.type !== 'show') return;
            var card = e.data.movie || e.data.card || e.data || {};
            e.menu.push({
                title:    'Смотреть онлайн',
                subtitle: 'Выбор источника',
                icon:     'play',
                action:   function () { openOnlineView(card); }
            });
        });
    }

    // ─── Точка входа ─────────────────────────────────────────────────────────
    function init() {
        registerComponent();
        hookFullCard();
        hookContextMenu();
        console.log('[OnlineView] v' + PLUGIN_VERSION + ' инициализирован');
    }

    if (window.Lampa) {
        if (typeof Lampa.Activity !== 'undefined' && typeof Lampa.Component !== 'undefined') {
            init();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'start') init();
            });
        }
    }

})();
