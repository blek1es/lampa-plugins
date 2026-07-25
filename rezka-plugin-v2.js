(function() {
  'use strict';

  // ============================================
  // КОНФИГУРАЦИЯ - Измените под свои нужды
  // ============================================

  var CONFIG = {
    // API для получения данных о фильмах
    API_URL: 'https://api.apbugall.org/',
    API_TOKEN: '04941a9a3ca3ac16e2b4327347bbc1',

    // Варианты CORS-прокси (используется первый рабочий)
    PROXY_SERVERS: [
      'http://localhost:8080/proxy?url=',  // Локальный прокси (cors-proxy-server.js)
      'https://corsproxy.io/?',             // Публичный прокси 1
      'https://api.allorigins.win/raw?url=', // Публичный прокси 2
      ''                                     // Без прокси (может не работать из-за CORS)
    ],

    // Тайм-аут запросов (мс)
    TIMEOUT: 15000,

    // Отладочный режим
    DEBUG: true
  };

  // ============================================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
  // ============================================

  function log() {
    if (CONFIG.DEBUG) {
      console.log.apply(console, ['[Rezka]'].concat(Array.prototype.slice.call(arguments)));
    }
  }

  function getProxy(url) {
    var proxy = CONFIG.PROXY_SERVERS[0];
    return proxy ? proxy + encodeURIComponent(url) : url;
  }

  // ============================================
  // ОСНОВНОЙ КОМПОНЕНТ
  // ============================================

  function component(object) {
    var network = new Lampa.Reguest();
    var scroll = new Lampa.Scroll({mask: true, over: true});
    var last;
    var loaded = false;
    var started = false;

    this.create = function() {
      this.activity = object.activity;
      return this.render();
    };

    this.search = function() {
      if (loaded) {
        log('Already loaded');
        return;
      }
      loaded = true;

      var _this = this;
      log('Searching:', object.movie.title);
      this.loading(true);

      // Формируем URL для API
      var url = CONFIG.API_URL + '?token=' + CONFIG.API_TOKEN;

      if (object.movie.kinopoisk_id) {
        url += '&kp=' + object.movie.kinopoisk_id;
        log('Using Kinopoisk ID:', object.movie.kinopoisk_id);
      } else if (object.movie.imdb_id) {
        url += '&imdb=' + object.movie.imdb_id;
        log('Using IMDB ID:', object.movie.imdb_id);
      } else {
        log('No ID found');
        this.empty('ID фильма не найден');
        return;
      }

      log('Request URL:', url);

      network.clear();
      network.timeout(CONFIG.TIMEOUT);

      network.silent(url,
        function(json) {
          log('Response received:', json);
          _this.loading(false);

          if (json && json.data) {
            _this.build(json.data);
          } else {
            _this.empty('Нет данных');
          }
        },
        function(error, status) {
          log('Error:', error, status);
          _this.loading(false);
          _this.empty('Ошибка загрузки: ' + (status || 'Network error'));
        }
      );
    };

    this.build = function(data) {
      log('Building UI, data:', data);
      scroll.clear();

      if (!data.translation_iframe || Object.keys(data.translation_iframe).length === 0) {
        return this.empty('Нет доступных переводов');
      }

      var is_serial = data.category === 2;
      log('Content type:', is_serial ? 'Serial' : 'Movie');

      if (is_serial) {
        this.showSerialTranslations(data);
      } else {
        this.showMovieTranslations(data);
      }
    };

    // ============================================
    // ФИЛЬМЫ
    // ============================================

    this.showMovieTranslations = function(data) {
      var _this = this;
      var items = [];

      for (var id in data.translation_iframe) {
        var translation = data.translation_iframe[id];
        items.push({
          title: translation.name,
          quality: translation.quality || 'HD',
          iframe_url: translation.iframe,
          translation_id: id
        });
      }

      log('Movie translations:', items.length);

      items.forEach(function(element, index) {
        var html = _this.createItem(
          element.title,
          element.quality,
          ''
        );

        html.on('hover:enter', function() {
          log('Selected movie translation:', element.title);

          if (object.movie.id) {
            Lampa.Favorite.add('history', object.movie, 100);
          }

          _this.loading(true);
          _this.extractAndPlay(element.iframe_url, element.title, false);
        });

        _this.bindHover(html);
        scroll.append(html);
      });

      this.start();
    };

    // ============================================
    // СЕРИАЛЫ
    // ============================================

    this.showSerialTranslations = function(data) {
      var _this = this;
      var items = [];

      for (var id in data.translation_iframe) {
        var translation = data.translation_iframe[id];
        items.push({
          title: translation.name,
          quality: translation.quality || 'HD',
          iframe_url: translation.iframe,
          translation_id: id
        });
      }

      log('Serial translations:', items.length);

      items.forEach(function(element) {
        var html = _this.createItem(
          element.title,
          element.quality + ' • Сериал',
          '→'
        );

        html.on('hover:enter', function() {
          log('Selected serial translation:', element.title);
          _this.loading(true);
          _this.loadSeasonsAndEpisodes(element);
        });

        _this.bindHover(html);
        scroll.append(html);
      });

      this.start();
    };

    this.loadSeasonsAndEpisodes = function(translation) {
      var _this = this;

      // Извлекаем список сезонов/эпизодов из iframe
      _this.extractSeasons(translation.iframe_url, function(seasons) {
        scroll.clear();

        if (!seasons || seasons.length === 0) {
          _this.empty('Эпизоды не найдены');
          return;
        }

        log('Loaded seasons:', seasons.length);

        // Показываем все эпизоды всех сезонов
        seasons.forEach(function(season) {
          season.episodes.forEach(function(episode) {
            var title = 'S' + season.id + 'E' + episode.id;
            if (episode.name) title += ' - ' + episode.name;

            var html = _this.createItem(
              title,
              translation.quality,
              translation.title
            );

            html.on('hover:enter', function() {
              log('Playing episode:', title);

              if (object.movie.id) {
                Lampa.Favorite.add('history', object.movie, 100);
              }

              _this.loading(true);
              var episodeUrl = translation.iframe_url +
                '&season=' + season.id +
                '&episode=' + episode.id;

              _this.extractAndPlay(episodeUrl, title, true);
            });

            _this.bindHover(html);
            scroll.append(html);
          });
        });

        _this.start();
        _this.loading(false);
      });
    };

    // ============================================
    // ИЗВЛЕЧЕНИЕ ССЫЛОК
    // ============================================

    this.extractAndPlay = function(iframeUrl, title, isSerial) {
      var _this = this;
      log('Extracting video from:', iframeUrl);

      var proxyUrl = getProxy(iframeUrl);

      network.clear();
      network.timeout(CONFIG.TIMEOUT);

      network.silent(proxyUrl,
        function(html) {
          _this.loading(false);

          if (typeof html !== 'string') {
            Lampa.Noty.show('Ошибка: получены некорректные данные');
            return;
          }

          // Ищем видео URL в разных форматах
          var videoUrl = null;
          var patterns = [
            /file:"([^"]+\.m3u8[^"]*)"/,
            /src="([^"]+\.m3u8[^"]*)"/,
            /"url":"([^"]+)"/,
            /\[(\d+p)\](https?:\/\/[^\s,\]]+)/g
          ];

          for (var i = 0; i < patterns.length; i++) {
            var match = html.match(patterns[i]);
            if (match && match[1]) {
              videoUrl = match[1].replace(/\\/g, '');
              break;
            }
          }

          if (videoUrl) {
            log('Video URL found:', videoUrl);
            _this.playVideo(videoUrl, title);
          } else {
            log('Video URL not found in HTML');
            Lampa.Noty.show('Не удалось извлечь ссылку на видео');
          }
        },
        function(error, status) {
          _this.loading(false);
          log('Extract error:', error, status);
          Lampa.Noty.show('Ошибка загрузки видео');
        },
        false,
        { dataType: 'text' }
      );
    };

    this.extractSeasons = function(iframeUrl, callback) {
      var proxyUrl = getProxy(iframeUrl);

      network.clear();
      network.timeout(CONFIG.TIMEOUT);

      network.silent(proxyUrl,
        function(html) {
          if (typeof html !== 'string') {
            callback([]);
            return;
          }

          // Парсим сезоны и эпизоды из HTML
          var seasons = [];

          // Пример структуры (нужно адаптировать под реальный HTML)
          var seasonMatches = html.match(/<option[^>]*value="(\d+)"[^>]*>Сезон \1/gi);

          if (seasonMatches) {
            seasonMatches.forEach(function(match) {
              var seasonNum = match.match(/value="(\d+)"/)[1];
              var episodes = [];

              // Ищем эпизоды для этого сезона
              var episodeMatches = html.match(new RegExp('<option[^>]*data-season="' + seasonNum + '"[^>]*value="(\\d+)"', 'gi'));

              if (episodeMatches) {
                episodeMatches.forEach(function(epMatch) {
                  var epNum = epMatch.match(/value="(\d+)"/)[1];
                  episodes.push({
                    id: epNum,
                    name: 'Эпизод ' + epNum
                  });
                });
              } else {
                // Если структура неизвестна, создаем стандартный набор
                for (var i = 1; i <= 10; i++) {
                  episodes.push({
                    id: i,
                    name: 'Эпизод ' + i
                  });
                }
              }

              seasons.push({
                id: seasonNum,
                episodes: episodes
              });
            });
          }

          callback(seasons);
        },
        function() {
          callback([]);
        },
        false,
        { dataType: 'text' }
      );
    };

    // ============================================
    // ВОСПРОИЗВЕДЕНИЕ
    // ============================================

    this.playVideo = function(url, title) {
      log('Playing video:', url);

      var hash = Lampa.Utils.hash([object.movie.id, url].join(''));
      var timeline = Lampa.Timeline.view(hash);

      Lampa.Player.play({
        url: url,
        title: title || object.movie.title,
        timeline: timeline
      });

      Lampa.Player.playlist([{
        url: url,
        title: title || object.movie.title,
        timeline: timeline
      }]);
    };

    // ============================================
    // UI ЭЛЕМЕНТЫ
    // ============================================

    this.createItem = function(title, quality, info) {
      var item = $('<div class="selector" style="padding: 1em; background: rgba(255,255,255,0.08); border-radius: 0.5em; margin-bottom: 0.5em; transition: all 0.3s;">' +
        '<div style="display: flex; justify-content: space-between; align-items: center;">' +
          '<div>' +
            '<div style="font-size: 1.1em; font-weight: 500; margin-bottom: 0.3em;">' + title + '</div>' +
            '<div style="opacity: 0.6; font-size: 0.85em;">' + quality + (info ? ' • ' + info : '') + '</div>' +
          '</div>' +
          '<div style="opacity: 0.4; font-size: 1.5em;">▶</div>' +
        '</div>' +
      '</div>');

      return item;
    };

    this.bindHover = function(element) {
      element.on('hover:focus', function(e) {
        last = e.target;
        scroll.update($(e.target), true);
        $(e.target).css('background', 'rgba(255,255,255,0.15)');
      }).on('hover:blur', function(e) {
        $(e.target).css('background', 'rgba(255,255,255,0.08)');
      });
    };

    this.empty = function(message) {
      scroll.clear();
      var html = $('<div style="padding: 3em; text-align: center;">' +
        '<div style="font-size: 3em; margin-bottom: 0.5em; opacity: 0.3;">😔</div>' +
        '<div style="font-size: 1.3em; margin-bottom: 0.5em;">' + (message || 'Контент не найден') + '</div>' +
        '<div style="opacity: 0.5;">Попробуйте другой источник</div>' +
      '</div>');
      scroll.append(html);
      this.loading(false);
    };

    this.loading = function(status) {
      if (status) {
        this.activity.loader(true);
      } else {
        this.activity.loader(false);
        this.activity.toggle();
      }
    };

    this.start = function() {
      if (started) return;
      started = true;

      var _this = this;

      Lampa.Controller.add('content', {
        toggle: function() {
          Lampa.Controller.collectionSet(scroll.render());
          Lampa.Controller.collectionFocus(last || false, scroll.render());
        },
        up: function() {
          if (Navigator.canmove('up')) Navigator.move('up');
          else Lampa.Controller.toggle('head');
        },
        down: function() {
          Navigator.move('down');
        },
        right: function() {
          Navigator.move('right');
        },
        left: function() {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        back: function() {
          _this.back();
        }
      });

      Lampa.Controller.toggle('content');

      if (!loaded) {
        this.search();
      }
    };

    this.render = function() {
      return scroll.render();
    };

    this.back = function() {
      Lampa.Activity.backward();
    };

    this.pause = function() {};
    this.stop = function() {};
    this.destroy = function() {
      network.clear();
      scroll.destroy();
    };
  }

  // ============================================
  // ИНИЦИАЛИЗАЦИЯ ПЛАГИНА
  // ============================================

  function startPlugin() {
    if (window.rezka_plugin_v2) {
      log('Plugin already loaded');
      return;
    }
    window.rezka_plugin_v2 = true;

    Lampa.Component.add('rezka', component);

    var button = '<div class="full-start__button selector view--rezka" data-subtitle="v2.0">' +
      '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 48 48" width="36" height="36">' +
        '<circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="2.5"/>' +
        '<path d="M19 14 L19 34 L33 24 Z"/>' +
      '</svg>' +
      '<span>Rezka HD</span>' +
    '</div>';

    function addButton(render, movie) {
      if (render.find('.view--rezka').length) {
        log('Button already exists');
        return;
      }

      var btn = $(button);

      btn.on('hover:enter', function() {
        log('Opening Rezka for movie:', movie.title);

        Lampa.Activity.push({
          url: '',
          title: 'Rezka Online',
          component: 'rezka',
          movie: movie,
          page: 1
        });
      });

      var torrentBtn = render.find('.view--torrent');
      if (torrentBtn.length) {
        torrentBtn.after(btn);
      } else {
        render.append(btn);
      }

      log('Button added to interface');
    }

    Lampa.Listener.follow('full', function(e) {
      if (e.type === 'complite') {
        log('Movie card loaded:', e.data.movie.title);
        addButton(e.object.activity.render(), e.data.movie);
      }
    });

    log('🎬 Rezka Plugin v2.0 loaded successfully');
    log('📝 Configuration:', CONFIG);
  }

  if (window.appready) {
    startPlugin();
  } else {
    Lampa.Listener.follow('app', function(e) {
      if (e.type === 'ready') {
        startPlugin();
      }
    });
  }

})();
