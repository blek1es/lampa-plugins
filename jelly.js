(function () {
    'use strict';

    // =====================================================================
    // 1. НАЛАШТУВАННЯ (ЗАХИСТ ВІД КРЕШІВ - СТРОГІ ПАРАМЕТРИ)
    // =====================================================================
    Lampa.SettingsApi.addComponent({
        component: 'jellyfin_config',
        name: 'Jellyfin',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
    });

    Lampa.SettingsApi.addParam({
        component: 'jellyfin_config',
        param: {
            name: 'jellyfin_nas_server',
            type: 'input',
            placeholder: '',
            values: '', 
            default: ''
        },
        field: {
            name: 'Адреса сервера Jellyfin',
            description: 'Наприклад: http://192.168.0.1:8096'
        }
    });

    Lampa.SettingsApi.addParam({
        component: 'jellyfin_config',
        param: {
            name: 'jellyfin_nas_token',
            type: 'input',
            placeholder: '',
            values: '', 
            default: ''
        },
        field: {
            name: 'API Ключ',
            description: 'Згенеруйте ключ в панелі адміністратора Jellyfin'
        }
    });

    Lampa.SettingsApi.addParam({
        component: 'jellyfin_config',
        param: {
            name: 'jellyfin_nas_check',
            type: 'button'
        },
        field: {
            name: 'Перевірити підключення',
            description: 'Натисніть для тестового запиту до сервера'
        }
    });

    Lampa.Settings.listener.follow('open', function (e) {
        if (e.name == 'jellyfin_config') {
            var checkBtn = e.body.find('[data-name="jellyfin_nas_check"]');
            checkBtn.find('.settings-param__name').css('color', '#00ff00');
            
            checkBtn.off('hover:enter click').on('hover:enter click', function () {
                var url = Lampa.Storage.get('jellyfin_nas_server', '').replace(/\/$/, '').trim();
                var token = Lampa.Storage.get('jellyfin_nas_token', '').trim();

                if (!url || !token) {
                    Lampa.Noty.show('Спочатку введіть адресу та ключ!');
                    return;
                }

                Lampa.Noty.show('З\'єднуємось з сервером...');
                
                $.ajax({
                    url: url + '/System/Info?api_key=' + token,
                    type: 'GET',
                    dataType: 'json',
                    timeout: 10000,
                    success: function (res) {
                        if (res && res.Id) {
                            Lampa.Noty.show('Успіх! Підключено до: ' + (res.ServerName || 'Jellyfin'));
                        } else {
                            Lampa.Noty.show('Помилка: Невірний API Ключ!');
                        }
                    },
                    error: function () {
                        Lampa.Noty.show('Помилка підключення до сервера');
                    }
                });
            });
        }
    });

    // =====================================================================
    // 2. ФУНКЦІЯ ПЛЕЄРА
    // =====================================================================
    function startPlayer(id, title, url, token) {
        // Формуємо строго ваш шаблон: http://192.168.0.1:8096/Items/{Id}/Download?api_key={token}
        var streamUrl = url + '/Items/' + id + '/Download?api_key=' + token;
        
        console.log('Надсилання прямого посилання в плеєр:', streamUrl);
        Lampa.Noty.show('Відкриваємо плеєр...');
        
        var video = {
            title: title,
            url: streamUrl
        };
        
        Lampa.Player.play(video);
        Lampa.Player.playlist([video]);
    }

    // =====================================================================
    // 3. ПОШУК ТА ПЕРЕВІРКА ВІДПОВІДНОСТІ (УНИКНЕННЯ ЗАПУСКУ ОДНОГО ФІЛЬМУ)
    // =====================================================================
    function findAndPlay(movie) {
        var url = Lampa.Storage.get('jellyfin_nas_server', '').replace(/\/$/, '').trim();
        var token = Lampa.Storage.get('jellyfin_nas_token', '').trim();
        if (!url || !token) return Lampa.Noty.show('Налаштуйте Jellyfin у налаштуваннях');

        var tmdbId = movie.id || movie.tmdb_id;
        var targetTitle = (movie.title || movie.name || movie.original_title || '').toLowerCase().trim();
        
        Lampa.Noty.show('Шукаємо відповідний файл...');

        $.ajax({
            url: url + '/Users?api_key=' + token,
            type: 'GET',
            dataType: 'json',
            success: function (users) {
                if (!users || users.length === 0) return Lampa.Noty.show('Користувачів Jellyfin не знайдено');
                var userId = users[0].Id;

                // Запит пошуку
                var searchUrl = url + '/Users/' + userId + '/Items?Recursive=true&IncludeItemTypes=Movie,Series,Episode&AnyProviderIdEquals=tmdb.' + tmdbId + '&Fields=Path&api_key=' + token;

                $.ajax({
                    url: searchUrl,
                    type: 'GET',
                    dataType: 'json',
                    success: function (data) {
                        if (data && data.Items && data.Items.length > 0) {
                            var foundItem = null;

                            for (var i = 0; i < data.Items.length; i++) {
                                var item = data.Items[i];
                                if (item.ProviderIds && item.ProviderIds.Tmdb && String(item.ProviderIds.Tmdb) === String(tmdbId)) {
                                    foundItem = item;
                                    break;
                                }
                            }

                            if (!foundItem) {
                                for (var j = 0; j < data.Items.length; j++) {
                                    var item2 = data.Items[j];
                                    var jTitle = (item2.Name || '').toLowerCase().trim();
                                    if (jTitle === targetTitle) {
                                        foundItem = item2;
                                        break;
                                    }
                                }
                            }

                            if (foundItem) {
                                if (foundItem.Type === 'Series') {
                                    $.ajax({
                                        url: url + '/Shows/' + foundItem.Id + '/Episodes?userId=' + userId + '&Fields=Path&api_key=' + token,
                                        type: 'GET',
                                        dataType: 'json',
                                        success: function (epData) {
                                            if (epData && epData.Items && epData.Items.length > 0) {
                                                var episodes = epData.Items.map(function (ep) {
                                                    return {
                                                        title: 'S' + (ep.ParentIndexNumber || 1) + ' E' + (ep.IndexNumber || 1) + ' - ' + (ep.Name || 'Episode'),
                                                        jellyId: ep.Id 
                                                    };
                                                });

                                                Lampa.Select.show({
                                                    title: 'Оберіть серію',
                                                    items: episodes,
                                                    onSelect: function (sel) {
                                                        startPlayer(sel.jellyId, sel.title, url, token);
                                                    },
                                                    onBack: function () { Lampa.Controller.toggle('full_start'); }
                                                });
                                            } else { Lampa.Noty.show('Серій не знайдено'); }
                                        }
                                    });
                                } else {
                                    startPlayer(foundItem.Id, foundItem.Name, url, token);
                                }
                            } else {
                                Lampa.Noty.show('Цього відео немає у вашій медіатеці Jellyfin');
                            }
                        } else {
                            Lampa.Noty.show('Бібліотека сервера порожня');
                        }
                    },
                    error: function () { Lampa.Noty.show('Помилка пошуку файлів'); }
                });
            },
            error: function () { Lampa.Noty.show('Помилка авторизації на сервері'); }
        });
    }

    // ДОДАВАННЯ КНОПКИ В КАРТКУ
    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complite' || e.type == 'complete') {
            var render = e.object.activity.render();
            
            var btn = render.find('.view--jellyfin');
            if (!btn.length) {
                btn = $('<div class="full-start__button selector view--jellyfin" style="background-color: #8b3ab9;"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span style="color:#fff; margin-left: 8px;">Jellyfin</span></div>');
                
                var target = render.find('.view--torrent');
                if (target.length) target.after(btn);
                else render.find('.full-start__buttons').append(btn);
            }
            
            btn.off('hover:enter click').on('hover:enter click', function () {
                findAndPlay(e.data.movie);
            });
        }
    });

    // =====================================================================
    // 4. ДОДАВАННЯ РОЗДІЛУ В ЛІВЕ МЕНЮ
    // =====================================================================
    function addMenu() {
        if ($('[data-action="jellyfin_catalog"]').length) return;
        var item = $('<li class="menu__item selector" data-action="jellyfin_catalog"><div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div><div class="menu__text">Jellyfin</div></li>');
        item.on('hover:enter click', function () {
            Lampa.Activity.push({ url: '', title: 'Jellyfin Медіа', component: 'jellyfin_catalog', page: 1 });
        });
        $('.menu__list').eq(0).append(item);
    }

    if (window.appready) addMenu();
    Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') addMenu(); });

    // =====================================================================
    // 5. КОМПОНЕНТ КАТАЛОГУ
    // =====================================================================
    function JellyfinCatalog(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        var _this = this;

        this.activity = object.activity;

        this.create = function () {
            var url = Lampa.Storage.get('jellyfin_nas_server', '').replace(/\/$/, '').trim();
            var token = Lampa.Storage.get('jellyfin_nas_token', '').trim();

            if (!url || !token) {
                html.append('<div class="empty">Налаштуйте Jellyfin у налаштуваннях</div>');
                return this.render();
            }

            // Показуємо офіційний лоадер
            _this.activity.loader(true);

            // Запит списку
            var reqUrl = url + '/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds,ProductionYear,CommunityRating&SortBy=DateCreated&SortOrder=Descending&api_key=' + token;
            
            $.ajax({
                url: reqUrl,
                type: 'GET',
                dataType: 'json',
                success: function (data) {
                    _this.activity.loader(false);
                    if (data && data.Items && data.Items.length > 0) {
                        _this.build(data.Items, url, token);
                    } else {
                        html.append('<div class="empty">Бібліотека порожня</div>');
                    }
                },
                error: function () {
                    _this.activity.loader(false);
                    html.append('<div class="empty">Помилка підключення до сервера</div>');
                }
            });

            return this.render();
        };

        this.build = function (items, url, token) {
            html.empty();
            html.append(scroll.render());
            scroll.append(body);

            items.forEach(function (item) {
                var tmdbId = (item.ProviderIds && item.ProviderIds.Tmdb) ? item.ProviderIds.Tmdb : null;
                var type = item.Type === 'Series' ? 'tv' : 'movie';
                var year = item.ProductionYear ? item.ProductionYear + '-01-01' : '';
                
                var card_data = {
                    id: tmdbId || item.Id, 
                    source: tmdbId ? 'tmdb' : 'jellyfin',
                    type: type,
                    title: item.Name,
                    name: item.Name,
                    original_title: item.OriginalTitle || item.Name,
                    release_date: year,
                    first_air_date: year,
                    poster_path: '', 
                    img: '',
                    vote_average: item.CommunityRating || 0
                };

                var card = new Lampa.Card(card_data, { card_category: true });
                card.create(); 
                
                var cardEl = card.render();

                // Примусово знімаємо прелоад для швидкого фокусування пультом
                cardEl.removeClass('card--preload').addClass('card--loaded');

                // Прогресивне завантаження постерів по HTTPS
                if (tmdbId) {
                    var lang = Lampa.Storage.get('language', 'uk');
                    var apiKey = Lampa.TMDB.key();
                    var tmdbUrl = Lampa.TMDB.api(type + '/' + tmdbId + '?api_key=' + apiKey + '&language=' + lang);

                    $.ajax({
                        url: tmdbUrl,
                        type: 'GET',
                        dataType: 'json',
                        timeout: 5000,
                        success: function(res) {
                            if (res && res.poster_path) {
                                var secureImg = Lampa.TMDB.image('t/p/w300' + res.poster_path);
                                card_data.poster_path = res.poster_path;
                                card_data.img = secureImg;
                                cardEl.find('.card__img').attr('src', secureImg);
                                
                                // Якщо картка зараз у фокусі — відразу оновлюємо розмитий фон на екрані
                                if (cardEl.hasClass('focus')) {
                                    Lampa.Background.change(secureImg);
                                }
                            } else {
                                var localUrl = url + '/Items/' + item.Id + '/Images/Primary?api_key=' + token;
                                card_data.img = localUrl;
                                cardEl.find('.card__img').attr('src', localUrl);
                            }
                        },
                        error: function() {
                            var localUrl = url + '/Items/' + item.Id + '/Images/Primary?api_key=' + token;
                            card_data.img = localUrl;
                            cardEl.find('.card__img').attr('src', localUrl);
                        }
                    });
                } else {
                    var localUrl = url + '/Items/' + item.Id + '/Images/Primary?api_key=' + token;
                    card_data.img = localUrl;
                    cardEl.find('.card__img').attr('src', localUrl);
                }

                // ПРЕМІУМ-ФУНКЦІЯ: Гарне розмиття фону при переміщенні пульта
                cardEl.on('hover:focus', function() {
                    if (card_data.img) {
                        Lampa.Background.change(card_data.img);
                    }
                });

                cardEl.on('hover:enter click', function () {
                    Lampa.Activity.push({
                        url: '',
                        component: 'full',
                        id: card_data.id,
                        method: card_data.type,
                        card: card_data,
                        source: card_data.source
                    });
                });

                body.append(cardEl);
                files.push(card);
            });

            // Зв'язуємо прокрутку з нативною видимістю
            scroll.onScroll = function() {
                files.forEach(function(c) {
                    if (c.visible) c.visible();
                });
            };

            setTimeout(function() {
                files.forEach(function(c) {
                    if (c.visible) c.visible();
                });
            }, 100);

            // =====================================================================
            // ВИПРАВЛЕНО: ДОДАНО НАЙВАЖЛИВІШІ ОБРОБНИКИ НАПРЯМКІВ ДЛЯ НАВІГАЦІЇ ПУЛЬТА!
            // =====================================================================
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(files.length ? files[0].render() : false, scroll.render());
                },
                right: function () {
                    Navigator.move('right'); // Дозволяє пультику рухатися вправо!
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left'); // Дозволяє рухатися вліво, або відкриває бічне меню
                    else Lampa.Controller.toggle('menu');
                },
                down: function () {
                    Navigator.move('down'); // Дозволяє рухатися вниз!
                },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up'); // Дозволяє рухатися вгору, або виходить до шапки пошуку
                    else Lampa.Controller.toggle('head');
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('content');
        };

        this.render = function () { return html; };
        this.start = function () { Lampa.Controller.toggle('content'); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { 
            files.forEach(function(card) {
                card.destroy();
            });
            files = []; 
            scroll.destroy(); 
            html.remove(); 
        };
    }

    Lampa.Component.add('jellyfin_catalog', JellyfinCatalog);

})();