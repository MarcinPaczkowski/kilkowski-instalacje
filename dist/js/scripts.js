/*!
	Colorbox 1.5.14
	license: MIT
	http://www.jacklmoore.com/colorbox
*/
(function ($, document, window) {
	var
	// Default settings object.
	// See http://jacklmoore.com/colorbox for details.
	defaults = {
		// data sources
		html: false,
		photo: false,
		iframe: false,
		inline: false,

		// behavior and appearance
		transition: "elastic",
		speed: 300,
		fadeOut: 300,
		width: false,
		initialWidth: "600",
		innerWidth: false,
		maxWidth: false,
		height: false,
		initialHeight: "450",
		innerHeight: false,
		maxHeight: false,
		scalePhotos: true,
		scrolling: true,
		opacity: 0.9,
		preloading: true,
		className: false,
		overlayClose: true,
		escKey: true,
		arrowKey: true,
		top: false,
		bottom: false,
		left: false,
		right: false,
		fixed: false,
		data: undefined,
		closeButton: true,
		fastIframe: true,
		open: false,
		reposition: true,
		loop: true,
		slideshow: false,
		slideshowAuto: true,
		slideshowSpeed: 2500,
		slideshowStart: "start slideshow",
		slideshowStop: "stop slideshow",
		photoRegex: /\.(gif|png|jp(e|g|eg)|bmp|ico|webp|jxr|svg)((#|\?).*)?$/i,

		// alternate image paths for high-res displays
		retinaImage: false,
		retinaUrl: false,
		retinaSuffix: '@2x.$1',

		// internationalization
		current: "image {current} of {total}",
		previous: "previous",
		next: "next",
		close: "close",
		xhrError: "This content failed to load.",
		imgError: "This image failed to load.",

		// accessbility
		returnFocus: true,
		trapFocus: true,

		// callbacks
		onOpen: false,
		onLoad: false,
		onComplete: false,
		onCleanup: false,
		onClosed: false,

		rel: function() {
			return this.rel;
		},
		href: function() {
			// using this.href would give the absolute url, when the href may have been inteded as a selector (e.g. '#container')
			return $(this).attr('href');
		},
		title: function() {
			return this.title;
		}
	},

	// Abstracting the HTML and event identifiers for easy rebranding
	colorbox = 'colorbox',
	prefix = 'cbox',
	boxElement = prefix + 'Element',
	
	// Events
	event_open = prefix + '_open',
	event_load = prefix + '_load',
	event_complete = prefix + '_complete',
	event_cleanup = prefix + '_cleanup',
	event_closed = prefix + '_closed',
	event_purge = prefix + '_purge',

	// Cached jQuery Object Variables
	$overlay,
	$box,
	$wrap,
	$content,
	$topBorder,
	$leftBorder,
	$rightBorder,
	$bottomBorder,
	$related,
	$window,
	$loaded,
	$loadingBay,
	$loadingOverlay,
	$title,
	$current,
	$slideshow,
	$next,
	$prev,
	$close,
	$groupControls,
	$events = $('<a/>'), // $({}) would be prefered, but there is an issue with jQuery 1.4.2
	
	// Variables for cached values or use across multiple functions
	settings,
	interfaceHeight,
	interfaceWidth,
	loadedHeight,
	loadedWidth,
	index,
	photo,
	open,
	active,
	closing,
	loadingTimer,
	publicMethod,
	div = "div",
	requests = 0,
	previousCSS = {},
	init;

	// ****************
	// HELPER FUNCTIONS
	// ****************
	
	// Convenience function for creating new jQuery objects
	function $tag(tag, id, css) {
		var element = document.createElement(tag);

		if (id) {
			element.id = prefix + id;
		}

		if (css) {
			element.style.cssText = css;
		}

		return $(element);
	}
	
	// Get the window height using innerHeight when available to avoid an issue with iOS
	// http://bugs.jquery.com/ticket/6724
	function winheight() {
		return window.innerHeight ? window.innerHeight : $(window).height();
	}

	function Settings(element, options) {
		if (options !== Object(options)) {
			options = {};
		}

		this.cache = {};
		this.el = element;

		this.value = function(key) {
			var dataAttr;

			if (this.cache[key] === undefined) {
				dataAttr = $(this.el).attr('data-cbox-'+key);

				if (dataAttr !== undefined) {
					this.cache[key] = dataAttr;
				} else if (options[key] !== undefined) {
					this.cache[key] = options[key];
				} else if (defaults[key] !== undefined) {
					this.cache[key] = defaults[key];
				}
			}

			return this.cache[key];
		};

		this.get = function(key) {
			var value = this.value(key);
			return $.isFunction(value) ? value.call(this.el, this) : value;
		};
	}

	// Determine the next and previous members in a group.
	function getIndex(increment) {
		var
		max = $related.length,
		newIndex = (index + increment) % max;
		
		return (newIndex < 0) ? max + newIndex : newIndex;
	}

	// Convert '%' and 'px' values to integers
	function setSize(size, dimension) {
		return Math.round((/%/.test(size) ? ((dimension === 'x' ? $window.width() : winheight()) / 100) : 1) * parseInt(size, 10));
	}
	
	// Checks an href to see if it is a photo.
	// There is a force photo option (photo: true) for hrefs that cannot be matched by the regex.
	function isImage(settings, url) {
		return settings.get('photo') || settings.get('photoRegex').test(url);
	}

	function retinaUrl(settings, url) {
		return settings.get('retinaUrl') && window.devicePixelRatio > 1 ? url.replace(settings.get('photoRegex'), settings.get('retinaSuffix')) : url;
	}

	function trapFocus(e) {
		if ('contains' in $box[0] && !$box[0].contains(e.target) && e.target !== $overlay[0]) {
			e.stopPropagation();
			$box.focus();
		}
	}

	function setClass(str) {
		if (setClass.str !== str) {
			$box.add($overlay).removeClass(setClass.str).addClass(str);
			setClass.str = str;
		}
	}

	function getRelated(rel) {
		index = 0;
		
		if (rel && rel !== false && rel !== 'nofollow') {
			$related = $('.' + boxElement).filter(function () {
				var options = $.data(this, colorbox);
				var settings = new Settings(this, options);
				return (settings.get('rel') === rel);
			});
			index = $related.index(settings.el);
			
			// Check direct calls to Colorbox.
			if (index === -1) {
				$related = $related.add(settings.el);
				index = $related.length - 1;
			}
		} else {
			$related = $(settings.el);
		}
	}

	function trigger(event) {
		// for external use
		$(document).trigger(event);
		// for internal use
		$events.triggerHandler(event);
	}

	var slideshow = (function(){
		var active,
			className = prefix + "Slideshow_",
			click = "click." + prefix,
			timeOut;

		function clear () {
			clearTimeout(timeOut);
		}

		function set() {
			if (settings.get('loop') || $related[index + 1]) {
				clear();
				timeOut = setTimeout(publicMethod.next, settings.get('slideshowSpeed'));
			}
		}

		function start() {
			$slideshow
				.html(settings.get('slideshowStop'))
				.unbind(click)
				.one(click, stop);

			$events
				.bind(event_complete, set)
				.bind(event_load, clear);

			$box.removeClass(className + "off").addClass(className + "on");
		}

		function stop() {
			clear();
			
			$events
				.unbind(event_complete, set)
				.unbind(event_load, clear);

			$slideshow
				.html(settings.get('slideshowStart'))
				.unbind(click)
				.one(click, function () {
					publicMethod.next();
					start();
				});

			$box.removeClass(className + "on").addClass(className + "off");
		}

		function reset() {
			active = false;
			$slideshow.hide();
			clear();
			$events
				.unbind(event_complete, set)
				.unbind(event_load, clear);
			$box.removeClass(className + "off " + className + "on");
		}

		return function(){
			if (active) {
				if (!settings.get('slideshow')) {
					$events.unbind(event_cleanup, reset);
					reset();
				}
			} else {
				if (settings.get('slideshow') && $related[1]) {
					active = true;
					$events.one(event_cleanup, reset);
					if (settings.get('slideshowAuto')) {
						start();
					} else {
						stop();
					}
					$slideshow.show();
				}
			}
		};

	}());


	function launch(element) {
		var options;

		if (!closing) {

			options = $(element).data(colorbox);

			settings = new Settings(element, options);
			
			getRelated(settings.get('rel'));

			if (!open) {
				open = active = true; // Prevents the page-change action from queuing up if the visitor holds down the left or right keys.

				setClass(settings.get('className'));
				
				// Show colorbox so the sizes can be calculated in older versions of jQuery
				$box.css({visibility:'hidden', display:'block', opacity:''});
				
				$loaded = $tag(div, 'LoadedContent', 'width:0; height:0; overflow:hidden; visibility:hidden');
				$content.css({width:'', height:''}).append($loaded);

				// Cache values needed for size calculations
				interfaceHeight = $topBorder.height() + $bottomBorder.height() + $content.outerHeight(true) - $content.height();
				interfaceWidth = $leftBorder.width() + $rightBorder.width() + $content.outerWidth(true) - $content.width();
				loadedHeight = $loaded.outerHeight(true);
				loadedWidth = $loaded.outerWidth(true);

				// Opens inital empty Colorbox prior to content being loaded.
				var initialWidth = setSize(settings.get('initialWidth'), 'x');
				var initialHeight = setSize(settings.get('initialHeight'), 'y');
				var maxWidth = settings.get('maxWidth');
				var maxHeight = settings.get('maxHeight');

				settings.w = (maxWidth !== false ? Math.min(initialWidth, setSize(maxWidth, 'x')) : initialWidth) - loadedWidth - interfaceWidth;
				settings.h = (maxHeight !== false ? Math.min(initialHeight, setSize(maxHeight, 'y')) : initialHeight) - loadedHeight - interfaceHeight;

				$loaded.css({width:'', height:settings.h});
				publicMethod.position();

				trigger(event_open);
				settings.get('onOpen');

				$groupControls.add($title).hide();

				$box.focus();
				
				if (settings.get('trapFocus')) {
					// Confine focus to the modal
					// Uses event capturing that is not supported in IE8-
					if (document.addEventListener) {

						document.addEventListener('focus', trapFocus, true);
						
						$events.one(event_closed, function () {
							document.removeEventListener('focus', trapFocus, true);
						});
					}
				}

				// Return focus on closing
				if (settings.get('returnFocus')) {
					$events.one(event_closed, function () {
						$(settings.el).focus();
					});
				}
			}

			var opacity = parseFloat(settings.get('opacity'));
			$overlay.css({
				opacity: opacity === opacity ? opacity : '',
				cursor: settings.get('overlayClose') ? 'pointer' : '',
				visibility: 'visible'
			}).show();
			
			if (settings.get('closeButton')) {
				$close.html(settings.get('close')).appendTo($content);
			} else {
				$close.appendTo('<div/>'); // replace with .detach() when dropping jQuery < 1.4
			}

			load();
		}
	}

	// Colorbox's markup needs to be added to the DOM prior to being called
	// so that the browser will go ahead and load the CSS background images.
	function appendHTML() {
		if (!$box) {
			init = false;
			$window = $(window);
			$box = $tag(div).attr({
				id: colorbox,
				'class': $.support.opacity === false ? prefix + 'IE' : '', // class for optional IE8 & lower targeted CSS.
				role: 'dialog',
				tabindex: '-1'
			}).hide();
			$overlay = $tag(div, "Overlay").hide();
			$loadingOverlay = $([$tag(div, "LoadingOverlay")[0],$tag(div, "LoadingGraphic")[0]]);
			$wrap = $tag(div, "Wrapper");
			$content = $tag(div, "Content").append(
				$title = $tag(div, "Title"),
				$current = $tag(div, "Current"),
				$prev = $('<button type="button"/>').attr({id:prefix+'Previous'}),
				$next = $('<button type="button"/>').attr({id:prefix+'Next'}),
				$slideshow = $tag('button', "Slideshow"),
				$loadingOverlay
			);

			$close = $('<button type="button"/>').attr({id:prefix+'Close'});
			
			$wrap.append( // The 3x3 Grid that makes up Colorbox
				$tag(div).append(
					$tag(div, "TopLeft"),
					$topBorder = $tag(div, "TopCenter"),
					$tag(div, "TopRight")
				),
				$tag(div, false, 'clear:left').append(
					$leftBorder = $tag(div, "MiddleLeft"),
					$content,
					$rightBorder = $tag(div, "MiddleRight")
				),
				$tag(div, false, 'clear:left').append(
					$tag(div, "BottomLeft"),
					$bottomBorder = $tag(div, "BottomCenter"),
					$tag(div, "BottomRight")
				)
			).find('div div').css({'float': 'left'});
			
			$loadingBay = $tag(div, false, 'position:absolute; width:9999px; visibility:hidden; display:none; max-width:none;');
			
			$groupControls = $next.add($prev).add($current).add($slideshow);
		}
		if (document.body && !$box.parent().length) {
			$(document.body).append($overlay, $box.append($wrap, $loadingBay));
		}
	}

	// Add Colorbox's event bindings
	function addBindings() {
		function clickHandler(e) {
			// ignore non-left-mouse-clicks and clicks modified with ctrl / command, shift, or alt.
			// See: http://jacklmoore.com/notes/click-events/
			if (!(e.which > 1 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				launch(this);
			}
		}

		if ($box) {
			if (!init) {
				init = true;

				// Anonymous functions here keep the public method from being cached, thereby allowing them to be redefined on the fly.
				$next.click(function () {
					publicMethod.next();
				});
				$prev.click(function () {
					publicMethod.prev();
				});
				$close.click(function () {
					publicMethod.close();
				});
				$overlay.click(function () {
					if (settings.get('overlayClose')) {
						publicMethod.close();
					}
				});
				
				// Key Bindings
				$(document).bind('keydown.' + prefix, function (e) {
					var key = e.keyCode;
					if (open && settings.get('escKey') && key === 27) {
						e.preventDefault();
						publicMethod.close();
					}
					if (open && settings.get('arrowKey') && $related[1] && !e.altKey) {
						if (key === 37) {
							e.preventDefault();
							$prev.click();
						} else if (key === 39) {
							e.preventDefault();
							$next.click();
						}
					}
				});

				if ($.isFunction($.fn.on)) {
					// For jQuery 1.7+
					$(document).on('click.'+prefix, '.'+boxElement, clickHandler);
				} else {
					// For jQuery 1.3.x -> 1.6.x
					// This code is never reached in jQuery 1.9, so do not contact me about 'live' being removed.
					// This is not here for jQuery 1.9, it's here for legacy users.
					$('.'+boxElement).live('click.'+prefix, clickHandler);
				}
			}
			return true;
		}
		return false;
	}

	// Don't do anything if Colorbox already exists.
	if ($[colorbox]) {
		return;
	}

	// Append the HTML when the DOM loads
	$(appendHTML);


	// ****************
	// PUBLIC FUNCTIONS
	// Usage format: $.colorbox.close();
	// Usage from within an iframe: parent.jQuery.colorbox.close();
	// ****************
	
	publicMethod = $.fn[colorbox] = $[colorbox] = function (options, callback) {
		var settings;
		var $obj = this;

		options = options || {};

		if ($.isFunction($obj)) { // assume a call to $.colorbox
			$obj = $('<a/>');
			options.open = true;
		} else if (!$obj[0]) { // colorbox being applied to empty collection
			return $obj;
		}


		if (!$obj[0]) { // colorbox being applied to empty collection
			return $obj;
		}
		
		appendHTML();

		if (addBindings()) {

			if (callback) {
				options.onComplete = callback;
			}

			$obj.each(function () {
				var old = $.data(this, colorbox) || {};
				$.data(this, colorbox, $.extend(old, options));
			}).addClass(boxElement);

			settings = new Settings($obj[0], options);
			
			if (settings.get('open')) {
				launch($obj[0]);
			}
		}
		
		return $obj;
	};

	publicMethod.position = function (speed, loadedCallback) {
		var
		css,
		top = 0,
		left = 0,
		offset = $box.offset(),
		scrollTop,
		scrollLeft;
		
		$window.unbind('resize.' + prefix);

		// remove the modal so that it doesn't influence the document width/height
		$box.css({top: -9e4, left: -9e4});

		scrollTop = $window.scrollTop();
		scrollLeft = $window.scrollLeft();

		if (settings.get('fixed')) {
			offset.top -= scrollTop;
			offset.left -= scrollLeft;
			$box.css({position: 'fixed'});
		} else {
			top = scrollTop;
			left = scrollLeft;
			$box.css({position: 'absolute'});
		}

		// keeps the top and left positions within the browser's viewport.
		if (settings.get('right') !== false) {
			left += Math.max($window.width() - settings.w - loadedWidth - interfaceWidth - setSize(settings.get('right'), 'x'), 0);
		} else if (settings.get('left') !== false) {
			left += setSize(settings.get('left'), 'x');
		} else {
			left += Math.round(Math.max($window.width() - settings.w - loadedWidth - interfaceWidth, 0) / 2);
		}
		
		if (settings.get('bottom') !== false) {
			top += Math.max(winheight() - settings.h - loadedHeight - interfaceHeight - setSize(settings.get('bottom'), 'y'), 0);
		} else if (settings.get('top') !== false) {
			top += setSize(settings.get('top'), 'y');
		} else {
			top += Math.round(Math.max(winheight() - settings.h - loadedHeight - interfaceHeight, 0) / 2);
		}

		$box.css({top: offset.top, left: offset.left, visibility:'visible'});
		
		// this gives the wrapper plenty of breathing room so it's floated contents can move around smoothly,
		// but it has to be shrank down around the size of div#colorbox when it's done.  If not,
		// it can invoke an obscure IE bug when using iframes.
		$wrap[0].style.width = $wrap[0].style.height = "9999px";
		
		function modalDimensions() {
			$topBorder[0].style.width = $bottomBorder[0].style.width = $content[0].style.width = (parseInt($box[0].style.width,10) - interfaceWidth)+'px';
			$content[0].style.height = $leftBorder[0].style.height = $rightBorder[0].style.height = (parseInt($box[0].style.height,10) - interfaceHeight)+'px';
		}

		css = {width: settings.w + loadedWidth + interfaceWidth, height: settings.h + loadedHeight + interfaceHeight, top: top, left: left};

		// setting the speed to 0 if the content hasn't changed size or position
		if (speed) {
			var tempSpeed = 0;
			$.each(css, function(i){
				if (css[i] !== previousCSS[i]) {
					tempSpeed = speed;
					return;
				}
			});
			speed = tempSpeed;
		}

		previousCSS = css;

		if (!speed) {
			$box.css(css);
		}

		$box.dequeue().animate(css, {
			duration: speed || 0,
			complete: function () {
				modalDimensions();
				
				active = false;
				
				// shrink the wrapper down to exactly the size of colorbox to avoid a bug in IE's iframe implementation.
				$wrap[0].style.width = (settings.w + loadedWidth + interfaceWidth) + "px";
				$wrap[0].style.height = (settings.h + loadedHeight + interfaceHeight) + "px";
				
				if (settings.get('reposition')) {
					setTimeout(function () {  // small delay before binding onresize due to an IE8 bug.
						$window.bind('resize.' + prefix, publicMethod.position);
					}, 1);
				}

				if ($.isFunction(loadedCallback)) {
					loadedCallback();
				}
			},
			step: modalDimensions
		});
	};

	publicMethod.resize = function (options) {
		var scrolltop;
		
		if (open) {
			options = options || {};
			
			if (options.width) {
				settings.w = setSize(options.width, 'x') - loadedWidth - interfaceWidth;
			}

			if (options.innerWidth) {
				settings.w = setSize(options.innerWidth, 'x');
			}

			$loaded.css({width: settings.w});
			
			if (options.height) {
				settings.h = setSize(options.height, 'y') - loadedHeight - interfaceHeight;
			}

			if (options.innerHeight) {
				settings.h = setSize(options.innerHeight, 'y');
			}

			if (!options.innerHeight && !options.height) {
				scrolltop = $loaded.scrollTop();
				$loaded.css({height: "auto"});
				settings.h = $loaded.height();
			}

			$loaded.css({height: settings.h});

			if(scrolltop) {
				$loaded.scrollTop(scrolltop);
			}
			
			publicMethod.position(settings.get('transition') === "none" ? 0 : settings.get('speed'));
		}
	};

	publicMethod.prep = function (object) {
		if (!open) {
			return;
		}
		
		var callback, speed = settings.get('transition') === "none" ? 0 : settings.get('speed');

		$loaded.remove();

		$loaded = $tag(div, 'LoadedContent').append(object);
		
		function getWidth() {
			settings.w = settings.w || $loaded.width();
			settings.w = settings.mw && settings.mw < settings.w ? settings.mw : settings.w;
			return settings.w;
		}
		function getHeight() {
			settings.h = settings.h || $loaded.height();
			settings.h = settings.mh && settings.mh < settings.h ? settings.mh : settings.h;
			return settings.h;
		}
		
		$loaded.hide()
		.appendTo($loadingBay.show())// content has to be appended to the DOM for accurate size calculations.
		.css({width: getWidth(), overflow: settings.get('scrolling') ? 'auto' : 'hidden'})
		.css({height: getHeight()})// sets the height independently from the width in case the new width influences the value of height.
		.prependTo($content);
		
		$loadingBay.hide();
		
		// floating the IMG removes the bottom line-height and fixed a problem where IE miscalculates the width of the parent element as 100% of the document width.
		
		$(photo).css({'float': 'none'});

		setClass(settings.get('className'));

		callback = function () {
			var total = $related.length,
				iframe,
				complete;
			
			if (!open) {
				return;
			}
			
			function removeFilter() { // Needed for IE8 in versions of jQuery prior to 1.7.2
				if ($.support.opacity === false) {
					$box[0].style.removeAttribute('filter');
				}
			}
			
			complete = function () {
				clearTimeout(loadingTimer);
				$loadingOverlay.hide();
				trigger(event_complete);
				settings.get('onComplete');
			};

			
			$title.html(settings.get('title')).show();
			$loaded.show();
			
			if (total > 1) { // handle grouping
				if (typeof settings.get('current') === "string") {
					$current.html(settings.get('current').replace('{current}', index + 1).replace('{total}', total)).show();
				}
				
				$next[(settings.get('loop') || index < total - 1) ? "show" : "hide"]().html(settings.get('next'));
				$prev[(settings.get('loop') || index) ? "show" : "hide"]().html(settings.get('previous'));
				
				slideshow();
				
				// Preloads images within a rel group
				if (settings.get('preloading')) {
					$.each([getIndex(-1), getIndex(1)], function(){
						var img,
							i = $related[this],
							settings = new Settings(i, $.data(i, colorbox)),
							src = settings.get('href');

						if (src && isImage(settings, src)) {
							src = retinaUrl(settings, src);
							img = document.createElement('img');
							img.src = src;
						}
					});
				}
			} else {
				$groupControls.hide();
			}
			
			if (settings.get('iframe')) {
				iframe = document.createElement('iframe');
				
				if ('frameBorder' in iframe) {
					iframe.frameBorder = 0;
				}
				
				if ('allowTransparency' in iframe) {
					iframe.allowTransparency = "true";
				}

				if (!settings.get('scrolling')) {
					iframe.scrolling = "no";
				}
				
				$(iframe)
					.attr({
						src: settings.get('href'),
						name: (new Date()).getTime(), // give the iframe a unique name to prevent caching
						'class': prefix + 'Iframe',
						allowFullScreen : true // allow HTML5 video to go fullscreen
					})
					.one('load', complete)
					.appendTo($loaded);
				
				$events.one(event_purge, function () {
					iframe.src = "//about:blank";
				});

				if (settings.get('fastIframe')) {
					$(iframe).trigger('load');
				}
			} else {
				complete();
			}
			
			if (settings.get('transition') === 'fade') {
				$box.fadeTo(speed, 1, removeFilter);
			} else {
				removeFilter();
			}
		};
		
		if (settings.get('transition') === 'fade') {
			$box.fadeTo(speed, 0, function () {
				publicMethod.position(0, callback);
			});
		} else {
			publicMethod.position(speed, callback);
		}
	};

	function load () {
		var href, setResize, prep = publicMethod.prep, $inline, request = ++requests;
		
		active = true;
		
		photo = false;
		
		trigger(event_purge);
		trigger(event_load);
		settings.get('onLoad');
		
		settings.h = settings.get('height') ?
				setSize(settings.get('height'), 'y') - loadedHeight - interfaceHeight :
				settings.get('innerHeight') && setSize(settings.get('innerHeight'), 'y');
		
		settings.w = settings.get('width') ?
				setSize(settings.get('width'), 'x') - loadedWidth - interfaceWidth :
				settings.get('innerWidth') && setSize(settings.get('innerWidth'), 'x');
		
		// Sets the minimum dimensions for use in image scaling
		settings.mw = settings.w;
		settings.mh = settings.h;
		
		// Re-evaluate the minimum width and height based on maxWidth and maxHeight values.
		// If the width or height exceed the maxWidth or maxHeight, use the maximum values instead.
		if (settings.get('maxWidth')) {
			settings.mw = setSize(settings.get('maxWidth'), 'x') - loadedWidth - interfaceWidth;
			settings.mw = settings.w && settings.w < settings.mw ? settings.w : settings.mw;
		}
		if (settings.get('maxHeight')) {
			settings.mh = setSize(settings.get('maxHeight'), 'y') - loadedHeight - interfaceHeight;
			settings.mh = settings.h && settings.h < settings.mh ? settings.h : settings.mh;
		}
		
		href = settings.get('href');
		
		loadingTimer = setTimeout(function () {
			$loadingOverlay.show();
		}, 100);
		
		if (settings.get('inline')) {
			var $target = $(href);
			// Inserts an empty placeholder where inline content is being pulled from.
			// An event is bound to put inline content back when Colorbox closes or loads new content.
			$inline = $('<div>').hide().insertBefore($target);

			$events.one(event_purge, function () {
				$inline.replaceWith($target);
			});

			prep($target);
		} else if (settings.get('iframe')) {
			// IFrame element won't be added to the DOM until it is ready to be displayed,
			// to avoid problems with DOM-ready JS that might be trying to run in that iframe.
			prep(" ");
		} else if (settings.get('html')) {
			prep(settings.get('html'));
		} else if (isImage(settings, href)) {

			href = retinaUrl(settings, href);

			photo = new Image();

			$(photo)
			.addClass(prefix + 'Photo')
			.bind('error',function () {
				prep($tag(div, 'Error').html(settings.get('imgError')));
			})
			.one('load', function () {
				if (request !== requests) {
					return;
				}

				// A small pause because some browsers will occassionaly report a 
				// img.width and img.height of zero immediately after the img.onload fires
				setTimeout(function(){
					var percent;

					$.each(['alt', 'longdesc', 'aria-describedby'], function(i,val){
						var attr = $(settings.el).attr(val) || $(settings.el).attr('data-'+val);
						if (attr) {
							photo.setAttribute(val, attr);
						}
					});

					if (settings.get('retinaImage') && window.devicePixelRatio > 1) {
						photo.height = photo.height / window.devicePixelRatio;
						photo.width = photo.width / window.devicePixelRatio;
					}

					if (settings.get('scalePhotos')) {
						setResize = function () {
							photo.height -= photo.height * percent;
							photo.width -= photo.width * percent;
						};
						if (settings.mw && photo.width > settings.mw) {
							percent = (photo.width - settings.mw) / photo.width;
							setResize();
						}
						if (settings.mh && photo.height > settings.mh) {
							percent = (photo.height - settings.mh) / photo.height;
							setResize();
						}
					}
					
					if (settings.h) {
						photo.style.marginTop = Math.max(settings.mh - photo.height, 0) / 2 + 'px';
					}
					
					if ($related[1] && (settings.get('loop') || $related[index + 1])) {
						photo.style.cursor = 'pointer';
						photo.onclick = function () {
							publicMethod.next();
						};
					}

					photo.style.width = photo.width + 'px';
					photo.style.height = photo.height + 'px';
					prep(photo);
				}, 1);
			});
			
			photo.src = href;

		} else if (href) {
			$loadingBay.load(href, settings.get('data'), function (data, status) {
				if (request === requests) {
					prep(status === 'error' ? $tag(div, 'Error').html(settings.get('xhrError')) : $(this).contents());
				}
			});
		}
	}
		
	// Navigates to the next page/image in a set.
	publicMethod.next = function () {
		if (!active && $related[1] && (settings.get('loop') || $related[index + 1])) {
			index = getIndex(1);
			launch($related[index]);
		}
	};
	
	publicMethod.prev = function () {
		if (!active && $related[1] && (settings.get('loop') || index)) {
			index = getIndex(-1);
			launch($related[index]);
		}
	};

	// Note: to use this within an iframe use the following format: parent.jQuery.colorbox.close();
	publicMethod.close = function () {
		if (open && !closing) {
			
			closing = true;
			open = false;
			trigger(event_cleanup);
			settings.get('onCleanup');
			$window.unbind('.' + prefix);
			$overlay.fadeTo(settings.get('fadeOut') || 0, 0);
			
			$box.stop().fadeTo(settings.get('fadeOut') || 0, 0, function () {
				$box.hide();
				$overlay.hide();
				trigger(event_purge);
				$loaded.remove();
				
				setTimeout(function () {
					closing = false;
					trigger(event_closed);
					settings.get('onClosed');
				}, 1);
			});
		}
	};

	// Removes changes Colorbox made to the document, but does not remove the plugin.
	publicMethod.remove = function () {
		if (!$box) { return; }

		$box.stop();
		$[colorbox].close();
		$box.stop(false, true).remove();
		$overlay.remove();
		closing = false;
		$box = null;
		$('.' + boxElement)
			.removeData(colorbox)
			.removeClass(boxElement);

		$(document).unbind('click.'+prefix).unbind('keydown.'+prefix);
	};

	// A method for fetching the current element Colorbox is referencing.
	// returns a jQuery object.
	publicMethod.element = function () {
		return $(settings.el);
	};

	publicMethod.settings = defaults;

}(jQuery, document, window));
;/*
ScrollMagic v1.2.3
The jQuery plugin for doing magical scroll interactions.
(c) 2014 Jan Paepke (@janpaepke)
License & Info: http://janpaepke.github.io/ScrollMagic
	
Inspired by and partially based on SUPERSCROLLORAMA by John Polacek (@johnpolacek)
http://johnpolacek.github.com/superscrollorama/

Powered by the Greensock Tweening Platform (GSAP): http://www.greensock.com/js
Greensock License info at http://www.greensock.com/licensing/
*/
/**
@overview	##Info
@version	1.2.3
@license	Dual licensed under MIT license and GPL.
@author		Jan Paepke - e-mail@janpaepke.de

@todo: enhancement: remove dependencies and move to plugins -> 2.0
@todo: bug: when cascading pins (pinning one element multiple times) and later removing them without reset, positioning errors occur.
@todo: bug: having multiple scroll directions with cascaded pins doesn't work (one scroll vertical, one horizontal)
@todo: feature: optimize performance on debug plugin (huge drawbacks, when using many scenes)
*/
(function(root) {
	
	"use strict";

	var define = root.define, ScrollMagic, ScrollScene;
  ScrollScene = ScrollMagic = function () {};
  if (typeof define !== 'function' || !define.amd) {
  	// No AMD loader -> Provide custom method to to register browser globals instead
  	define = function (moduleName, dependencies, factory) {
  		for (var x = 0, dependency; x<dependencies.length; x++) {
  			dependency = dependencies[x];
  			if (dependency === 'jquery') { // lowercase with require, but camel case as global
  				dependency = 'jQuery';
  			}
  			dependencies[x] = root[dependency];
  		}
  		root[moduleName] = factory.apply(root, dependencies);
  	};
  }

define('ScrollMagic', ['jquery', 'TweenMax', 'TimelineMax'], function ($, TweenMax, TimelineMax) {
	/**
	 * The main class that is needed once per scroll container.
	 *
	 * @class
	 * @global
	 *
	 * @example
	 * // basic initialization
	 * var controller = new ScrollMagic();
	 *
	 * // passing options
	 * var controller = new ScrollMagic({container: "#myContainer", loglevel: 3});
	 *
	 * @param {object} [options] - An object containing one or more options for the controller.
	 * @param {(string|object)} [options.container=window] - A selector, DOM object or a jQuery object that references the main container for scrolling.
	 * @param {boolean} [options.vertical=true] - Sets the scroll mode to vertical (`true`) or horizontal (`false`) scrolling.
	 * @param {object} [options.globalSceneOptions={}] - These options will be passed to every Scene that is added to the controller using the addScene method. For more information on Scene options see {@link ScrollScene}.
	 * @param {number} [options.loglevel=2] Loglevel for debugging. Note that logging is disabled in the minified version of ScrollMagic.
											 ** `0` => silent
											 ** `1` => errors
											 ** `2` => errors, warnings
											 ** `3` => errors, warnings, debuginfo
	 * @param {boolean} [options.refreshInterval=100] - Some changes don't call events by default, like changing the container size or moving a scene trigger element.  
	 																										 This interval polls these parameters to fire the necessary events.  
	 																										 If you don't use custom containers, trigger elements or have static layouts, where the positions of the trigger elements don't change, you can set this to 0 disable interval checking and improve performance.
	 *
	 */
	ScrollMagic = function(options) {

		/*
		 * ----------------------------------------------------------------
		 * settings
		 * ----------------------------------------------------------------
		 */
		var
			NAMESPACE = "ScrollMagic",
			DEFAULT_OPTIONS = {
				container: window,
				vertical: true,
				globalSceneOptions: {},
				loglevel: 2,
				refreshInterval: 100
			};

		/*
		 * ----------------------------------------------------------------
		 * private vars
		 * ----------------------------------------------------------------
		 */

		var
			ScrollMagic = this,
			_options = $.extend({}, DEFAULT_OPTIONS, options),
			_sceneObjects = [],
			_updateScenesOnNextCycle = false,		// can be boolean (true => all scenes) or an array of scenes to be updated
			_scrollPos = 0,
			_scrollDirection = "PAUSED",
			_isDocument = true,
			_viewPortSize = 0,
			_enabled = true,
			_updateCycle,
			_refreshInterval;

		/*
		 * ----------------------------------------------------------------
		 * private functions
		 * ----------------------------------------------------------------
		 */

		/**
		 * Internal constructor function of ScrollMagic
		 * @private
		 */
		var construct = function () {
			ScrollMagic.version = ScrollMagic.constructor.version;
			$.each(_options, function (key, value) {
				if (!DEFAULT_OPTIONS.hasOwnProperty(key)) {
					log(2, "WARNING: Unknown option \"" + key + "\"");
					delete _options[key];
				}
			});
			_options.container = $(_options.container).first();
			// check ScrollContainer
			if (_options.container.length === 0) {
				log(1, "ERROR creating object " + NAMESPACE + ": No valid scroll container supplied");
				throw NAMESPACE + " init failed."; // cancel
			}
			_isDocument = !$.contains(document, _options.container.get(0));
			// prevent bubbling of fake resize event to window
			if (!_isDocument) {
				_options.container.on('resize', function ( e ) {
          e.stopPropagation();
        });
			}
			// update container size immediately
			_viewPortSize = _options.vertical ? _options.container.height() : _options.container.width();
			// set event handlers
			_options.container.on("scroll resize", onChange);

			_options.refreshInterval = parseInt(_options.refreshInterval);
			if (_options.refreshInterval > 0) {
				_refreshInterval = window.setInterval(refresh, _options.refreshInterval);
			}

			// start checking for changes
			_updateCycle = animationFrameCallback(updateScenes);
			log(3, "added new " + NAMESPACE + " controller (v" + ScrollMagic.version + ")");
		};

		/**
		* Default function to get scroll pos - overwriteable using `ScrollMagic.scrollPos(newFunction)`
		* @private
		*/
		var getScrollPos = function () {
			return _options.vertical ? _options.container.scrollTop() : _options.container.scrollLeft();
		};
		/**
		* Default function to set scroll pos - overwriteable using `ScrollMagic.scrollTo(newFunction)`
		* @private
		*/
		var setScrollPos = function (pos) {
			if (_options.vertical) {
				_options.container.scrollTop(pos);
			} else {
				_options.container.scrollLeft(pos);
			}
		};

		/**
		* Handle updates in cycles instead of on scroll (performance)
		* @private
		*/
		var updateScenes = function () {
			_updateCycle = animationFrameCallback(updateScenes);
			if (_enabled && _updateScenesOnNextCycle) {
				var
					scenesToUpdate = $.isArray(_updateScenesOnNextCycle) ? _updateScenesOnNextCycle : _sceneObjects.slice(0),
					oldScrollPos = _scrollPos;
				// update scroll pos & direction
				_scrollPos = ScrollMagic.scrollPos();
				var deltaScroll = _scrollPos - oldScrollPos;
				_scrollDirection = (deltaScroll === 0) ? "PAUSED" : (deltaScroll > 0) ? "FORWARD" : "REVERSE";
				if (deltaScroll < 0) { // reverse order if scrolling reverse
					scenesToUpdate.reverse();
				}
				// update scenes
				$.each(scenesToUpdate, function (index, scene) {
					log(3, "updating Scene " + (index + 1) + "/" + scenesToUpdate.length + " (" + _sceneObjects.length + " total)");
					scene.update(true);
				});
				if (scenesToUpdate.length === 0 && _options.loglevel >= 3) {
					log(3, "updating 0 Scenes (nothing added to controller)");
				}
				_updateScenesOnNextCycle = false;
			}
		};
		
		/**
		* Handles Container changes
		* @private
		*/
		var onChange = function (e) {
			if (e.type == "resize") {
				_viewPortSize = _options.vertical ? _options.container.height() : _options.container.width();
			}
			_updateScenesOnNextCycle = true;
		};

		var refresh = function () {
			if (!_isDocument) {
				// simulate resize event. Only works for viewport relevant param
				if (_viewPortSize != (_options.vertical ? _options.container.height() : _options.container.width())) {
					_options.container.trigger("resize");
				}
			}
			$.each(_sceneObjects, function (index, scene) {// refresh all scenes
				scene.refresh();
			});
		};

		/**
		 * Send a debug message to the console.
		 * @private
		 *
		 * @param {number} loglevel - The loglevel required to initiate output for the message.
		 * @param {...mixed} output - One or more variables that should be passed to the console.
		 */
		var log = function (loglevel, output) {
			if (_options.loglevel >= loglevel) {
				var
					prefix = "(" + NAMESPACE + ") ->",
					args = Array.prototype.splice.call(arguments, 1);
				args.unshift(loglevel, prefix);
				debug.apply(window, args);
			}
		};

		/**
		 * Sort scenes in ascending order of their start offset.
		 * @private
		 *
		 * @param {array} ScrollScenesArray - an array of ScrollScenes that should be sorted
		 * @return {array} The sorted array of ScrollScenes.
		 */
		var sortScenes = function (ScrollScenesArray) {
			if (ScrollScenesArray.length <= 1) {
				return ScrollScenesArray;
			} else {
				var scenes = ScrollScenesArray.slice(0);
				scenes.sort(function(a, b) {
					return a.scrollOffset() > b.scrollOffset() ? 1 : -1;
				});
				return scenes;
			}
		};

		/*
		 * ----------------------------------------------------------------
		 * public functions
		 * ----------------------------------------------------------------
		 */

		/**
		 * Add one ore more scene(s) to the controller.  
		 * This is the equivalent to `ScrollScene.addTo(controller)`.
		 * @public
		 * @example
		 * // with a previously defined scene
		 * controller.addScene(scene);
		 *
	 	 * // with a newly created scene.
		 * controller.addScene(new ScrollScene({duration : 0}));
		 *
	 	 * // adding multiple scenes
		 * controller.addScene([scene, scene2, new ScrollScene({duration : 0})]);
		 *
		 * @param {(ScrollScene|array)} ScrollScene - ScrollScene or Array of ScrollScenes to be added to the controller.
		 * @return {ScrollMagic} Parent object for chaining.
		 */
		this.addScene = function (newScene) {
			if ($.isArray(newScene)) {
				$.each(newScene, function (index, scene) {
					ScrollMagic.addScene(scene);
				});
			} else if (newScene instanceof ScrollScene) {
				if (newScene.parent() != ScrollMagic) {
					newScene.addTo(ScrollMagic);
				} else if ($.inArray(newScene, _sceneObjects) < 0){
					// new scene
					_sceneObjects.push(newScene); // add to array
					_sceneObjects = sortScenes(_sceneObjects); // sort
					newScene.on("shift." + NAMESPACE + "_sort", function() { // resort whenever scene moves
						_sceneObjects = sortScenes(_sceneObjects);
					});
					// insert Global defaults.
					$.each(_options.globalSceneOptions, function (key, value) {
						if (newScene[key]) {
							newScene[key].call(newScene, value);
						}
					});
					log(3, "added Scene (" + _sceneObjects.length + " total)");
				}
			} else {
				log(1, "ERROR: invalid argument supplied for '.addScene()'");
			}
			return ScrollMagic;
		};

		/**
		 * Remove one ore more scene(s) from the controller.  
		 * This is the equivalent to `ScrollScene.remove()`.
		 * @public
		 * @example
		 * // remove a scene from the controller
		 * controller.removeScene(scene);
		 *
		 * // remove multiple scenes from the controller
		 * controller.removeScene([scene, scene2, scene3]);
		 *
		 * @param {(ScrollScene|array)} ScrollScene - ScrollScene or Array of ScrollScenes to be removed from the controller.
		 * @returns {ScrollMagic} Parent object for chaining.
		 */
		this.removeScene = function (ScrollScene) {
			if ($.isArray(ScrollScene)) {
				$.each(ScrollScene, function (index, scene) {
					ScrollMagic.removeScene(scene);
				});
			} else {
				var index = $.inArray(ScrollScene, _sceneObjects);
				if (index > -1) {
					ScrollScene.off("shift." + NAMESPACE + "_sort");
					_sceneObjects.splice(index, 1);
					ScrollScene.remove();
					log(3, "removed Scene (" + _sceneObjects.length + " total)");
				}
			}
			return ScrollMagic;
		};

		/**
		 * Update one ore more scene(s) according to the scroll position of the container.  
		 * This is the equivalent to `ScrollScene.update()`.  
		 * The update method calculates the scene's start and end position (based on the trigger element, trigger hook, duration and offset) and checks it against the current scroll position of the container.  
		 * It then updates the current scene state accordingly (or does nothing, if the state is already correct) – Pins will be set to their correct position and tweens will be updated to their correct progress.  
		 * _**Note:** This method gets called constantly whenever ScrollMagic detects a change. The only application for you is if you change something outside of the realm of ScrollMagic, like moving the trigger or changing tween parameters._
		 * @public
		 * @example
		 * // update a specific scene on next cycle
	 	 * controller.updateScene(scene);
	 	 *
		 * // update a specific scene immediately
		 * controller.updateScene(scene, true);
	 	 *
		 * // update multiple scenes scene on next cycle
		 * controller.updateScene([scene1, scene2, scene3]);
		 *
		 * @param {ScrollScene} ScrollScene - ScrollScene or Array of ScrollScenes that is/are supposed to be updated.
		 * @param {boolean} [immediately=false] - If `true` the update will be instant, if `false` it will wait until next update cycle.  
		 										  This is useful when changing multiple properties of the scene - this way it will only be updated once all new properties are set (updateScenes).
		 * @return {ScrollMagic} Parent object for chaining.
		 */
		this.updateScene = function (ScrollScene, immediately) {
			if ($.isArray(ScrollScene)) {
				$.each(ScrollScene, function (index, scene) {
					ScrollMagic.updateScene(scene, immediately);
				});
			} else {
				if (immediately) {
					ScrollScene.update(true);
				} else {
					// prep array for next update cycle
					if (!$.isArray(_updateScenesOnNextCycle)) {
						_updateScenesOnNextCycle = [];
					}
					if ($.inArray(ScrollScene, _updateScenesOnNextCycle) == -1) {
						_updateScenesOnNextCycle.push(ScrollScene);	
					}
					_updateScenesOnNextCycle = sortScenes(_updateScenesOnNextCycle); // sort
				}
			}
			return ScrollMagic;
		};

		/**
		 * Updates the controller params and calls updateScene on every scene, that is attached to the controller.  
		 * See `ScrollMagic.updateScene()` for more information about what this means.  
		 * In most cases you will not need this function, as it is called constantly, whenever ScrollMagic detects a state change event, like resize or scroll.  
		 * The only application for this method is when ScrollMagic fails to detect these events.  
		 * One application is with some external scroll libraries (like iScroll) that move an internal container to a negative offset instead of actually scrolling. In this case the update on the controller needs to be called whenever the child container's position changes.
		 * For this case there will also be the need to provide a custom function to calculate the correct scroll position. See `ScrollMagic.scrollPos()` for details.
		 * @public
		 * @example
		 * // update the controller on next cycle (saves performance due to elimination of redundant updates)
		 * controller.update();
		 *
	 	 * // update the controller immediately
		 * controller.update(true);
		 *
		 * @param {boolean} [immediately=false] - If `true` the update will be instant, if `false` it will wait until next update cycle (better performance)
		 * @return {ScrollMagic} Parent object for chaining.
		 */
		this.update = function (immediately) {
			onChange({type: "resize"}); // will update size and set _updateScenesOnNextCycle to true
			if (immediately) {
				updateScenes();
			}
			return ScrollMagic;
		};

		/**
		 * Scroll to a numeric scroll offset, a DOM element, the start of a scene or provide an alternate method for scrolling.  
		 * For vertical controllers it will change the top scroll offset and for horizontal applications it will change the left offset.
		 * @public
		 *
		 * @since 1.1.0
		 * @example
		 * // scroll to an offset of 100
		 * controller.scrollTo(100);
		 *
		 * // scroll to a DOM element
		 * controller.scrollTo("#anchor");
		 *
		 * // scroll to the beginning of a scene
		 * var scene = new ScrollScene({offset: 200});
		 * controller.scrollTo(scene);
		 *
	 	 * // define a new scroll position modification function (animate instead of jump)
		 * controller.scrollTo(function (newScrollPos) {
		 *	$("body").animate({scrollTop: newScrollPos});
		 * });
		 *
		 * @param {mixed} [scrollTarget] - The supplied argument can be one of these types:
		 * 1. `number` -> The container will scroll to this new scroll offset.
		 * 2. `string` or `object` -> Can be a selector, a DOM object or a jQuery element.  
		 *  The container will scroll to the position of this element.
		 * 3. `ScrollScene` -> The container will scroll to the start of this scene.
		 * 4. `function` -> This function will be used as a callback for future scroll position modifications.  
		 *  This provides a way for you to change the behaviour of scrolling and adding new behaviour like animation. The callback receives the new scroll position as a parameter and a reference to the container element using `this`.  
		 *  _**NOTE:** All other options will still work as expected, using the new function to scroll._
		 * @returns {ScrollMagic} Parent object for chaining.
		 */
		this.scrollTo = function (scrollTarget) {
			if (scrollTarget instanceof ScrollScene) {
				if (scrollTarget.parent() === ScrollMagic) { // check if this controller is the parent
					ScrollMagic.scrollTo(scrollTarget.scrollOffset());
				} else {
					log (2, "scrollTo(): The supplied scene does not belong to this controller. Scroll cancelled.", scrollTarget);
				}
			} else if ($.type(scrollTarget) === "string" || isDomElement(scrollTarget) || scrollTarget instanceof $) {
				var $elm = $(scrollTarget).first();
				if ($elm[0]) {
					var
						param = _options.vertical ? "top" : "left", // which param is of interest ?
						containerOffset = getOffset(_options.container), // container position is needed because element offset is returned in relation to document, not in relation to container.
						elementOffset = getOffset($elm);

					if (!_isDocument) { // container is not the document root, so substract scroll Position to get correct trigger element position relative to scrollcontent
						containerOffset[param] -= ScrollMagic.scrollPos();
					}

					ScrollMagic.scrollTo(elementOffset[param] - containerOffset[param]);
				} else {
					log (2, "scrollTo(): The supplied element could not be found. Scroll cancelled.", scrollTarget);
				}
			} else if ($.isFunction(scrollTarget)) {
				setScrollPos = scrollTarget;
			} else {
				setScrollPos.call(_options.container[0], scrollTarget);
			}
			return ScrollMagic;
		};

		/**
		 * **Get** the current scrollPosition or **Set** a new method to calculate it.  
		 * -> **GET**:
		 * When used as a getter this function will return the current scroll position.  
		 * To get a cached value use ScrollMagic.info("scrollPos"), which will be updated in the update cycle.  
		 * For vertical controllers it will return the top scroll offset and for horizontal applications it will return the left offset.
		 *
		 * -> **SET**:
		 * When used as a setter this method prodes a way to permanently overwrite the controller's scroll position calculation.  
		 * A typical usecase is when the scroll position is not reflected by the containers scrollTop or scrollLeft values, but for example by the inner offset of a child container.  
		 * Moving a child container inside a parent is a commonly used method for several scrolling frameworks, including iScroll.  
		 * By providing an alternate calculation function you can make sure ScrollMagic receives the correct scroll position.  
		 * Please also bear in mind that your function should return y values for vertical scrolls an x for horizontals.
		 *
		 * To change the current scroll position please use `ScrollMagic.scrollTo()`.
		 * @public
		 *
		 * @example
		 * // get the current scroll Position
		 * var scrollPos = controller.scrollPos();
		 *
	 	 * // set a new scroll position calculation method
		 * controller.scrollPos(function () {
		 *	return this.info("vertical") ? -$mychildcontainer.y : -$mychildcontainer.x
		 * });
		 *
		 * @param {function} [scrollPosMethod] - The function to be used for the scroll position calculation of the container.
		 * @returns {(number|ScrollMagic)} Current scroll position or parent object for chaining.
		 */
		this.scrollPos = function (scrollPosMethod) {
			if (!arguments.length) { // get
				return getScrollPos.call(ScrollMagic);
			} else { // set
				if ($.isFunction(scrollPosMethod)) {
					getScrollPos = scrollPosMethod;
				} else {
					log(2, "Provided value for method 'scrollPos' is not a function. To change the current scroll position use 'scrollTo()'.");
				}
			}
			return ScrollMagic;
		};

		/**
		 * **Get** all infos or one in particular about the controller.
		 * @public
		 * @example
		 * // returns the current scroll position (number)
		 * var scrollPos = controller.info("scrollPos");
		 *
		 * // returns all infos as an object
		 * var infos = controller.info();
		 *
		 * @param {string} [about] - If passed only this info will be returned instead of an object containing all.  
		 							 Valid options are:
		 							 ** `"size"` => the current viewport size of the container
		 							 ** `"vertical"` => true if vertical scrolling, otherwise false
		 							 ** `"scrollPos"` => the current scroll position
		 							 ** `"scrollDirection"` => the last known direction of the scroll
		 							 ** `"container"` => the container element
		 							 ** `"isDocument"` => true if container element is the document.
		 * @returns {(mixed|object)} The requested info(s).
		 */
		this.info = function (about) {
			var values = {
				size: _viewPortSize, // contains height or width (in regard to orientation);
				vertical: _options.vertical,
				scrollPos: _scrollPos,
				scrollDirection: _scrollDirection,
				container: _options.container,
				isDocument: _isDocument
			};
			if (!arguments.length) { // get all as an object
				return values;
			} else if (values[about] !== undefined) {
				return values[about];
			} else {
				log(1, "ERROR: option \"" + about + "\" is not available");
				return;
			}
		};

		/**
		 * **Get** or **Set** the current loglevel option value.
		 * @public
		 *
		 * @example
		 * // get the current value
		 * var loglevel = controller.loglevel();
		 *
	 	 * // set a new value
		 * controller.loglevel(3);
		 *
		 * @param {number} [newLoglevel] - The new loglevel setting of the ScrollMagic controller. `[0-3]`
		 * @returns {(number|ScrollMagic)} Current loglevel or parent object for chaining.
		 */
		this.loglevel = function (newLoglevel) {
			if (!arguments.length) { // get
				return _options.loglevel;
			} else if (_options.loglevel != newLoglevel) { // set
				_options.loglevel = newLoglevel;
			}
			return ScrollMagic;
		};

		/**
		 * **Get** or **Set** the current enabled state of the controller.  
		 * This can be used to disable all Scenes connected to the controller without destroying or removing them.
		 * @public
		 *
		 * @example
		 * // get the current value
		 * var enabled = controller.enabled();
		 *
	 	 * // disable the controller
		 * controller.enabled(false);
		 *
		 * @param {boolean} [newState] - The new enabled state of the controller `true` or `false`.
		 * @returns {(boolean|ScrollMagic)} Current enabled state or parent object for chaining.
		 */
		this.enabled = function (newState) {
			if (!arguments.length) { // get
				return _enabled;
			} else if (_enabled != newState) { // set
				_enabled = !!newState;
				ScrollMagic.updateScene(_sceneObjects, true);
			}
			return ScrollMagic;
		};
		
		/**
		 * Destroy the Controller, all Scenes and everything.
		 * @public
		 *
		 * @example
		 * // without resetting the scenes
		 * controller = controller.destroy();
		 *
	 	 * // with scene reset
		 * controller = controller.destroy(true);
		 *
		 * @param {boolean} [resetScenes=false] - If `true` the pins and tweens (if existent) of all scenes will be reset.
		 * @returns {null} Null to unset handler variables.
		 */
		this.destroy = function (resetScenes) {
			window.clearTimeout(_refreshInterval);
			var i = _sceneObjects.length;
			while (i--) {
				_sceneObjects[i].destroy(resetScenes);
			}
			_options.container.off("scroll resize", onChange);
			animationFrameCancelCallback(_updateCycle);
			log(3, "destroyed " + NAMESPACE + " (reset: " + (resetScenes ? "true" : "false") + ")");
			return null;
		};

		// INIT
		construct();
		return ScrollMagic;
	};
	ScrollMagic.version = "1.2.3"; // version number for browser global
	return ScrollMagic;
});

define('ScrollScene', ['jquery', 'TweenMax', 'TimelineMax'], function ($, TweenMax, TimelineMax) {
	/**
	 * A ScrollScene defines where the controller should react and how.
	 *
	 * @class
	 * @global
	 *
	 * @example
	 * // create a standard scene and add it to a controller
	 * new ScrollScene()
	 *		.addTo(controller);
	 *
	 * // create a scene with custom options and assign a handler to it.
	 * var scene = new ScrollScene({
	 * 		duration: 100,
	 *		offset: 200,
	 *		triggerHook: "onEnter",
	 *		reverse: false
	 * });
	 *
	 * @param {object} [options] - Options for the Scene. The options can be updated at any time.  
	 							   Instead of setting the options for each scene individually you can also set them globally in the controller as the controllers `globalSceneOptions` option. The object accepts the same properties as the ones below.  
	 							   When a scene is added to the controller the options defined using the ScrollScene constructor will be overwritten by those set in `globalSceneOptions`.
	 * @param {(number|function)} [options.duration=0] - The duration of the scene. 
	 										  If `0` tweens will auto-play when reaching the scene start point, pins will be pinned indefinetly starting at the start position.  
	 										  A function retuning the duration value is also supported. Please see `ScrollScene.duration()` for details.
	 * @param {number} [options.offset=0] - Offset Value for the Trigger Position. If no triggerElement is defined this will be the scroll distance from the start of the page, after which the scene will start.
	 * @param {(string|object)} [options.triggerElement=null] - Selector, DOM object or jQuery Object that defines the start of the scene. If undefined the scene will start right at the start of the page (unless an offset is set).
	 * @param {(number|string)} [options.triggerHook="onCenter"] - Can be a number between 0 and 1 defining the position of the trigger Hook in relation to the viewport.  
	 															  Can also be defined using a string:
	 															  ** `"onEnter"` => `1`
	 															  ** `"onCenter"` => `0.5`
	 															  ** `"onLeave"` => `0`
	 * @param {boolean} [options.reverse=true] - Should the scene reverse, when scrolling up?
	 * @param {boolean} [options.tweenChanges=false] - Tweens Animation to the progress target instead of setting it.  
	 												   Does not affect animations where duration is `0`.
	 * @param {number} [options.loglevel=2] - Loglevel for debugging. Note that logging is disabled in the minified version of ScrollMagic.
	 										  ** `0` => silent
	 										  ** `1` => errors
	 										  ** `2` => errors, warnings
	 										  ** `3` => errors, warnings, debuginfo
	 * 
	 */
	ScrollScene = function (options) {

		/*
		 * ----------------------------------------------------------------
		 * settings
		 * ----------------------------------------------------------------
		 */

		var
			TRIGGER_HOOK_VALUES = {"onCenter" : 0.5, "onEnter" : 1, "onLeave" : 0},
			NAMESPACE = "ScrollScene",
			DEFAULT_OPTIONS = {
				duration: 0,
				offset: 0,
				triggerElement: null,
				triggerHook: "onCenter",
				reverse: true,
				tweenChanges: false,
				loglevel: 2
			};

		/*
		 * ----------------------------------------------------------------
		 * private vars
		 * ----------------------------------------------------------------
		 */

		var
			ScrollScene = this,
			_options = $.extend({}, DEFAULT_OPTIONS, options),
			_state = 'BEFORE',
			_progress = 0,
			_scrollOffset = {start: 0, end: 0}, // reflects the parent's scroll position for the start and end of the scene respectively
			_triggerPos = 0,
			_enabled = true,
			_durationUpdateMethod,
			_parent,
			_tween,
			_pin,
			_pinOptions,
			_cssClasses,
			_cssClassElm;

		// object containing validator functions for various options
		var _validate = {
			"unknownOptionSupplied" : function () {
					$.each(_options, function (key, value) {
					if (!DEFAULT_OPTIONS.hasOwnProperty(key)) {
						log(2, "WARNING: Unknown option \"" + key + "\"");
						delete _options[key];
					}
				});
			},
			"duration" : function () {
				if ($.isFunction(_options.duration)) {
					_durationUpdateMethod = _options.duration;
					try {
						_options.duration = parseFloat(_durationUpdateMethod());
					} catch (e) {
						log(1, "ERROR: Invalid return value of supplied function for option \"duration\":", _options.duration);
						_durationUpdateMethod = undefined;
						_options.duration = DEFAULT_OPTIONS.duration;
					}
				} else {
					_options.duration = parseFloat(_options.duration);
					if (!$.isNumeric(_options.duration) || _options.duration < 0) {
						log(1, "ERROR: Invalid value for option \"duration\":", _options.duration);
						_options.duration = DEFAULT_OPTIONS.duration;
					}
				}
			},
			"offset" : function () {
				_options.offset = parseFloat(_options.offset);
				if (!$.isNumeric(_options.offset)) {
					log(1, "ERROR: Invalid value for option \"offset\":", _options.offset);
					_options.offset = DEFAULT_OPTIONS.offset;
				}
			},
			"triggerElement" : function () {
				if (_options.triggerElement !== null && $(_options.triggerElement).length === 0) {
					log(1, "ERROR: Element defined in option \"triggerElement\" was not found:", _options.triggerElement);
					_options.triggerElement = DEFAULT_OPTIONS.triggerElement;
				}
			},
			"triggerHook" : function () {
				if (!(_options.triggerHook in TRIGGER_HOOK_VALUES)) {
					if ($.isNumeric(_options.triggerHook)) {
						_options.triggerHook = Math.max(0, Math.min(parseFloat(_options.triggerHook), 1)); //  make sure its betweeen 0 and 1
					} else {
						log(1, "ERROR: Invalid value for option \"triggerHook\": ", _options.triggerHook);
						_options.triggerHook = DEFAULT_OPTIONS.triggerHook;
					}
				}
			},
			"reverse" : function () {
				_options.reverse = !!_options.reverse; // force boolean
			},
			"tweenChanges" : function () {
				_options.tweenChanges = !!_options.tweenChanges; // force boolean
			},
			"loglevel" : function () {
				_options.loglevel = parseInt(_options.loglevel);
				if (!$.isNumeric(_options.loglevel) || _options.loglevel < 0 || _options.loglevel > 3) {
					var wrongval = _options.loglevel;
					_options.loglevel = DEFAULT_OPTIONS.loglevel;
					log(1, "ERROR: Invalid value for option \"loglevel\":", wrongval);
				}
			},
		};

		/*
		 * ----------------------------------------------------------------
		 * private functions
		 * ----------------------------------------------------------------
		 */

		/**
		 * Internal constructor function of ScrollMagic
		 * @private
		 */
		var construct = function () {
			validateOption();

			// event listeners
			ScrollScene
				.on("change.internal", function (e) {
					if (e.what !== "loglevel" && e.what !== "tweenChanges") { // no need for a scene update scene with these options...
						if (e.what === "triggerElement") {
							updateTriggerElementPosition();
						} else if (e.what === "reverse") { // the only property left that may have an impact on the current scene state. Everything else is handled by the shift event.
							ScrollScene.update();
						}
					}
				})
				.on("shift.internal", function (e) {
					updateScrollOffset();
					ScrollScene.update(); // update scene to reflect new position
					if ((_state === "AFTER" && e.reason === "duration") || (_state === 'DURING' && _options.duration === 0)) {
						// if [duration changed after a scene (inside scene progress updates pin position)] or [duration is 0, we are in pin phase and some other value changed].
						updatePinState();
					}
				})
				.on("progress.internal", function (e) {
					updateTweenProgress();
					updatePinState();
				})
				.on("destroy", function (e) {
					e.preventDefault(); // otherwise jQuery would call target.destroy() by default.
				});
		};
		
		/**
		 * Send a debug message to the console.
		 * @private
		 *
		 * @param {number} loglevel - The loglevel required to initiate output for the message.
		 * @param {...mixed} output - One or more variables that should be passed to the console.
		 */
		var log = function (loglevel, output) {
			if (_options.loglevel >= loglevel) {
				var
					prefix = "(" + NAMESPACE + ") ->",
					args = Array.prototype.splice.call(arguments, 1);
				args.unshift(loglevel, prefix);
				debug.apply(window, args);
			}
		};

		/**
		 * Checks the validity of a specific or all options and reset to default if neccessary.
		 * @private
		 */
		var validateOption = function (check) {
			if (!arguments.length) {
				check = [];
				for (var key in _validate){
					check.push(key);
				}
			} else if (!$.isArray(check)) {
				check = [check];
			}
			$.each(check, function (key, value) {
				if (_validate[value]) {
					_validate[value]();
				}
			});
		};

		/**
		 * Helper used by the setter/getters for scene options
		 * @private
		 */
		var changeOption = function(varname, newval) {
			var
				changed = false,
				oldval = _options[varname];
			if (_options[varname] != newval) {
				_options[varname] = newval;
				validateOption(varname); // resets to default if necessary
				changed = oldval != _options[varname];
			}
			return changed;
		};

		/**
		 * Update the start and end scrollOffset of the container.
		 * The positions reflect what the parent's scroll position will be at the start and end respectively.
		 * Is called, when:
		 *   - ScrollScene event "change" is called with: offset, triggerHook, duration 
		 *   - scroll container event "resize" is called
		 *   - the position of the triggerElement changes
		 *   - the parent changes -> addTo()
		 * @private
		 */
		var updateScrollOffset = function () {
			_scrollOffset = {start: _triggerPos + _options.offset};
			if (_parent && _options.triggerElement) {
				// take away triggerHook portion to get relative to top
				_scrollOffset.start -= _parent.info("size") * ScrollScene.triggerHook();
			}
			_scrollOffset.end = _scrollOffset.start + _options.duration;
		};

		/**
		 * Updates the duration if set to a dynamic function.
		 * This method is called when the scene is added to a controller and in regular intervals from the controller through scene.refresh().
		 * 
		 * @fires {@link ScrollScene.change}, if the duration changed
		 * @fires {@link ScrollScene.shift}, if the duration changed
		 *
		 * @param {boolean} [suppressEvents=false] - If true the shift event will be suppressed.
		 * @private
		 */
		var updateDuration = function (suppressEvents) {
			// update duration
			if (_durationUpdateMethod) {
				var varname = "duration";
				if (changeOption(varname, _durationUpdateMethod.call(ScrollScene)) && !suppressEvents) { // set
					ScrollScene.trigger("change", {what: varname, newval: _options[varname]});
					ScrollScene.trigger("shift", {reason: varname});
				}
			}
		};

		/**
		 * Updates the position of the triggerElement, if present.
		 * This method is called ...
		 *  - ... when the triggerElement is changed
		 *  - ... when the scene is added to a (new) controller
		 *  - ... in regular intervals from the controller through scene.refresh().
		 * 
		 * @fires {@link ScrollScene.shift}, if the position changed
		 *
		 * @param {boolean} [suppressEvents=false] - If true the shift event will be suppressed.
		 * @private
		 */
		var updateTriggerElementPosition = function (suppressEvents) {
			var elementPos = 0;
			if (_parent && _options.triggerElement) {
				var
					element = $(_options.triggerElement).first(),
					controllerInfo = _parent.info(),
					containerOffset = getOffset(controllerInfo.container), // container position is needed because element offset is returned in relation to document, not in relation to container.
					param = controllerInfo.vertical ? "top" : "left"; // which param is of interest ?
					
				// if parent is spacer, use spacer position instead so correct start position is returned for pinned elements.
				while (element.parent().data("ScrollMagicPinSpacer")) {
					element = element.parent();
				}

				var elementOffset = getOffset(element);

				if (!controllerInfo.isDocument) { // container is not the document root, so substract scroll Position to get correct trigger element position relative to scrollcontent
					containerOffset[param] -= _parent.scrollPos();
				}

				elementPos = elementOffset[param] - containerOffset[param];
			}
			var changed = elementPos != _triggerPos;
			_triggerPos = elementPos;
			if (changed && !suppressEvents) {
				ScrollScene.trigger("shift", {reason: "triggerElementPosition"});
			}
		};

		/**
		 * Update the tween progress.
		 * @private
		 *
		 * @param {number} [to] - If not set the scene Progress will be used. (most cases)
		 * @return {boolean} true if the Tween was updated. 
		 */
		var updateTweenProgress = function (to) {
			if (_tween) {
				var progress = (to >= 0 && to <= 1) ? to : _progress;
				if (_tween.repeat() === -1) {
					// infinite loop, so not in relation to progress
					if (_state === "DURING" && _tween.paused()) {
						_tween.play();
					} else if (_state !== "DURING" && !_tween.paused()) {
						_tween.pause();
					} else {
						return false;
					}
				} else if (progress != _tween.progress()) { // do we even need to update the progress?
					// no infinite loop - so should we just play or go to a specific point in time?
					if (_options.duration === 0) {
						// play the animation
						if (_state === "DURING") { // play from 0 to 1
							_tween.play();
						} else { // play from 1 to 0
							_tween.reverse();
						}
					} else {
						// go to a specific point in time
						if (_options.tweenChanges) {
							// go smooth
							_tween.tweenTo(progress * _tween.duration());
						} else {
							// just hard set it
							_tween.progress(progress).pause();
						}
					}
				} else {
					return false;
				}
				return true;
			} else {
				return false;
			}
		};

		/**
		 * Update the pin state.
		 * @private
		 */
		var updatePinState = function (forceUnpin) {
			if (_pin && _parent) {
				var 
					containerInfo = _parent.info();

				if (!forceUnpin && _state === "DURING") { // during scene or if duration is 0 and we are past the trigger
					// pinned state
					if (_pin.css("position") != "fixed") {
						// change state before updating pin spacer (position changes due to fixed collapsing might occur.)
						_pin.css("position", "fixed");
						// update pin spacer
						updatePinSpacerSize();
						// add pinned class
						_pin.addClass(_pinOptions.pinnedClass);
					}

					var
						fixedPos = getOffset(_pinOptions.spacer, true), // get viewport position of spacer
 						scrollDistance = _options.reverse || _options.duration === 0 ?
 										 	 containerInfo.scrollPos - _scrollOffset.start // quicker
 										 : Math.round(_progress * _options.duration * 10)/10; // if no reverse and during pin the position needs to be recalculated using the progress
 					
 					// remove spacer margin to get real position (in case marginCollapse mode)
 					fixedPos.top -= parseFloat(_pinOptions.spacer.css("margin-top"));

 					// add scrollDistance
 					fixedPos[containerInfo.vertical ? "top" : "left"] += scrollDistance;

					// set new values
					_pin.css({
						top: fixedPos.top,
						left: fixedPos.left
					});
				} else {
					// unpinned state
					var
						newCSS = {
							position: _pinOptions.inFlow ? "relative" : "absolute",
							top:  0,
							left: 0
						},
						change = _pin.css("position") != newCSS.position;
					
					if (!_pinOptions.pushFollowers) {
						newCSS[containerInfo.vertical ? "top" : "left"] = _options.duration * _progress;
					} else if (_options.duration > 0) { // only concerns scenes with duration
						if (_state === "AFTER" && parseFloat(_pinOptions.spacer.css("padding-top")) === 0) {
							change = true; // if in after state but havent updated spacer yet (jumped past pin)
						} else if (_state === "BEFORE" && parseFloat(_pinOptions.spacer.css("padding-bottom")) === 0) { // before
							change = true; // jumped past fixed state upward direction
						}
					}
					// set new values
					_pin.css(newCSS);
					if (change) {
						// remove pinned class
						_pin.removeClass(_pinOptions.pinnedClass);
						// update pin spacer if state changed
						updatePinSpacerSize();
					}
				}
			}
		};

		/**
		 * Update the pin spacer size.
		 * The size of the spacer needs to be updated whenever the duration of the scene changes, if it is to push down following elements.
		 * @private
		 */
		var updatePinSpacerSize = function () {
			if (_pin && _parent && _pinOptions.inFlow) { // no spacerresize, if original position is absolute
				var
					after = (_state === "AFTER"),
					before = (_state === "BEFORE"),
					during = (_state === "DURING"),
					pinned = (_pin.css("position") == "fixed"),
					vertical = _parent.info("vertical"),
					$spacercontent = _pinOptions.spacer.children().first(), // usually the pined element but can also be another spacer (cascaded pins)
					marginCollapse = isMarginCollapseType(_pinOptions.spacer.css("display")),
					css = {};

				if (marginCollapse) {
					css["margin-top"] = before || (during && pinned) ? _pin.css("margin-top") : "auto";
					css["margin-bottom"] = after || (during && pinned) ? _pin.css("margin-bottom") : "auto";
				} else {
					css["margin-top"] = css["margin-bottom"] = "auto";
				}

				// set new size
				// if relsize: spacer -> pin | else: pin -> spacer
				if (_pinOptions.relSize.width || _pinOptions.relSize.autoFullWidth) {
					if (pinned) {
						if ($(window).width() == _pinOptions.spacer.parent().width()) {
							// relative to body
							_pin.css("width", _pinOptions.relSize.autoFullWidth ? "100%" : "inherit");
						} else {
							// not relative to body -> need to calculate
							_pin.css("width", _pinOptions.spacer.width());
						}
					} else {
						_pin.css("width", "100%");
					}
				} else {
					// minwidth is needed for cascading pins.
					// margin is only included if it's a cascaded pin to resolve an IE9 bug
					css["min-width"] = $spacercontent.outerWidth(!$spacercontent.is(_pin));
					css.width = pinned ? css["min-width"] : "auto";
				}
				if (_pinOptions.relSize.height) {
					if (pinned) {
						if ($(window).height() == _pinOptions.spacer.parent().height()) {
							// relative to body
							_pin.css("height", "inherit");
						} else {
							// not relative to body -> need to calculate
							_pin.css("height", _pinOptions.spacer.height());
						}
					} else {
						_pin.css("height", "100%");
					}
				} else {
					css["min-height"] = $spacercontent.outerHeight(!marginCollapse); // needed for cascading pins
					css.height = pinned ? css["min-height"] : "auto";
				}

				// add space for duration if pushFollowers is true
				if (_pinOptions.pushFollowers) {
					css["padding" + (vertical ? "Top" : "Left")] = _options.duration * _progress;
					css["padding" + (vertical ? "Bottom" : "Right")] = _options.duration * (1 - _progress);
				}
				_pinOptions.spacer.css(css);
			}
		};

		/**
		 * Updates the Pin state (in certain scenarios)
		 * If the controller container is not the document and we are mid-pin-phase scrolling or resizing the main document can result to wrong pin positions.
		 * So this function is called on resize and scroll of the document.
		 * @private
		 */
		var updatePinInContainer = function () {
			if (_parent && _pin && _state === "DURING" && !_parent.info("isDocument")) {
				updatePinState();
			}
		};

		/**
		 * Updates the Pin spacer size state (in certain scenarios)
		 * If container is resized during pin and relatively sized the size of the pin might need to be updated...
		 * So this function is called on resize of the container.
		 * @private
		 */
		var updateRelativePinSpacer = function () {
			if ( _parent && _pin && // well, duh
					_state === "DURING" && // element in pinned state?
					( // is width or height relatively sized, but not in relation to body? then we need to recalc.
						((_pinOptions.relSize.width || _pinOptions.relSize.autoFullWidth) && $(window).width() != _pinOptions.spacer.parent().width()) ||
						(_pinOptions.relSize.height && $(window).height() != _pinOptions.spacer.parent().height())
					)
			) {
				updatePinSpacerSize();
			}
		};

		/**
		 * Is called, when the mousewhel is used while over a pinned element inside a div container.
		 * If the scene is in fixed state scroll events would be counted towards the body. This forwards the event to the scroll container.
		 * @private
		 */
		var onMousewheelOverPin = function (e) {
			if (_parent && _pin && _state === "DURING" && !_parent.info("isDocument")) { // in pin state
				e.preventDefault();
				_parent.scrollTo(_parent.info("scrollPos") - (e.originalEvent.wheelDelta/3 || -e.originalEvent.detail*30));
			}
		};


		/*
		 * ----------------------------------------------------------------
		 * public functions (getters/setters)
		 * ----------------------------------------------------------------
		 */

		/**
		 * **Get** the parent controller.
		 * @public
		 * @example
		 * // get the parent controller of a scene
		 * var controller = scene.parent();
		 *
		 * @returns {ScrollMagic} Parent controller or `undefined`
		 */
		this.parent = function () {
			return _parent;
		};


		/**
		 * **Get** or **Set** the duration option value.
		 * As a setter it also accepts a function returning a numeric value.  
		 * This is particularly useful for responsive setups.
		 *
		 * The duration is updated using the supplied function every time `ScrollScene.refresh()` is called, which happens periodically from the controller (see ScrollMagic option `refreshInterval`).  
		 * _**NOTE:** Be aware that it's an easy way to kill performance, if you supply a function that has high CPU demand.  
		 * Even for size and position calculations it is recommended to use a variable to cache the value. (see example)  
		 * This counts double if you use the same function for multiple scenes._
		 *
		 * @public
		 * @example
		 * // get the current duration value
		 * var duration = scene.duration();
		 *
	 	 * // set a new duration
		 * scene.duration(300);
		 *
		 * // use a function to automatically adjust the duration to the window height.
		 * var durationValueCache;
		 * function getDuration () {
		 *   return durationValueCache;
		 * }
		 * function updateDuration (e) {
		 *   durationValueCache = $(window).innerHeight();
		 * }
		 * $(window).on("resize", updateDuration); // update the duration when the window size changes
		 * $(window).triggerHandler("resize"); // set to initial value
		 * scene.duration(getDuration); // supply duration method
		 *
		 * @fires {@link ScrollScene.change}, when used as setter
		 * @fires {@link ScrollScene.shift}, when used as setter
		 * @param {(number|function)} [newDuration] - The new duration of the scene.
		 * @returns {number} `get` -  Current scene duration.
		 * @returns {ScrollScene} `set` -  Parent object for chaining.
		 */
		this.duration = function (newDuration) {
			var varname = "duration";
			if (!arguments.length) { // get
				return _options[varname];
			} else {
				if (!$.isFunction(newDuration)) {
					_durationUpdateMethod = undefined;
				}
				if (changeOption(varname, newDuration)) { // set
					ScrollScene.trigger("change", {what: varname, newval: _options[varname]});
					ScrollScene.trigger("shift", {reason: varname});
				}
			}
			return ScrollScene;
		};

		/**
		 * **Get** or **Set** the offset option value.
		 * @public
		 * @example
		 * // get the current offset
		 * var offset = scene.offset();
		 *
	 	 * // set a new offset
		 * scene.offset(100);
		 *
		 * @fires {@link ScrollScene.change}, when used as setter
		 * @fires {@link ScrollScene.shift}, when used as setter
		 * @param {number} [newOffset] - The new offset of the scene.
		 * @returns {number} `get` -  Current scene offset.
		 * @returns {ScrollScene} `set` -  Parent object for chaining.
		 */
		this.offset = function (newOffset) {
			var varname = "offset";
			if (!arguments.length) { // get
				return _options[varname];
			} else if (changeOption(varname, newOffset)) { // set
				ScrollScene.trigger("change", {what: varname, newval: _options[varname]});
				ScrollScene.trigger("shift", {reason: varname});
			}
			return ScrollScene;
		};

		/**
		 * **Get** or **Set** the triggerElement option value.
		 * Does **not** fire `ScrollScene.shift`, because changing the trigger Element doesn't necessarily mean the start position changes. This will be determined in `ScrollScene.refresh()`, which is automatically triggered.
		 * @public
		 * @example
		 * // get the current triggerElement
		 * var triggerElement = scene.triggerElement();
		 *
	 	 * // set a new triggerElement using a selector
		 * scene.triggerElement("#trigger");
	 	 * // set a new triggerElement using a jQuery Object
		 * scene.triggerElement($("#trigger"));
	 	 * // set a new triggerElement using a DOM object
		 * scene.triggerElement(document.getElementById("trigger"));
		 *
		 * @fires {@link ScrollScene.change}, when used as setter
		 * @param {(string|object)} [newTriggerElement] - The new trigger element for the scene.
		 * @returns {(string|object)} `get` -  Current triggerElement.
		 * @returns {ScrollScene} `set` -  Parent object for chaining.
		 */
		this.triggerElement = function (newTriggerElement) {
			var varname = "triggerElement";
			if (!arguments.length) { // get
				return _options[varname];
			} else if (changeOption(varname, newTriggerElement)) { // set
				ScrollScene.trigger("change", {what: varname, newval: _options[varname]});
			}
			return ScrollScene;
		};

		/**
		 * **Get** or **Set** the triggerHook option value.
		 * @public
		 * @example
		 * // get the current triggerHook value
		 * var triggerHook = scene.triggerHook();
		 *
	 	 * // set a new triggerHook using a string
		 * scene.triggerHook("onLeave");
	 	 * // set a new triggerHook using a number
		 * scene.triggerHook(0.7);
		 *
		 * @fires {@link ScrollScene.change}, when used as setter
		 * @fires {@link ScrollScene.shift}, when used as setter
		 * @param {(number|string)} [newTriggerHook] - The new triggerHook of the scene. See {@link ScrollScene} parameter description for value options.
		 * @returns {number} `get` -  Current triggerHook (ALWAYS numerical).
		 * @returns {ScrollScene} `set` -  Parent object for chaining.
		 */
		this.triggerHook = function (newTriggerHook) {
			var varname = "triggerHook";
			if (!arguments.length) { // get
				return $.isNumeric(_options[varname]) ? _options[varname] : TRIGGER_HOOK_VALUES[_options[varname]];
			} else if (changeOption(varname, newTriggerHook)) { // set
				ScrollScene.trigger("change", {what: varname, newval: _options[varname]});
				ScrollScene.trigger("shift", {reason: varname});
			}
			return ScrollScene;
		};

		/**
		 * **Get** or **Set** the reverse option value.
		 * @public
		 * @example
		 * // get the current reverse option
		 * var reverse = scene.reverse();
		 *
	 	 * // set new reverse option
		 * scene.reverse(false);
		 *
		 * @fires {@link ScrollScene.change}, when used as setter
		 * @param {boolean} [newReverse] - The new reverse setting of the scene.
		 * @returns {boolean} `get` -  Current reverse option value.
		 * @returns {ScrollScene} `set` -  Parent object for chaining.
		 */
		this.reverse = function (newReverse) {
			var varname = "reverse";
			if (!arguments.length) { // get
				return _options[varname];
			} else if (changeOption(varname, newReverse)) { // set
				ScrollScene.trigger("change", {what: varname, newval: _options[varname]});
			}
			return ScrollScene;
		};

		/**
		 * **Get** or **Set** the tweenChanges option value.
		 * @public
		 * @example
		 * // get the current tweenChanges option
		 * var tweenChanges = scene.tweenChanges();
		 *
	 	 * // set new tweenChanges option
		 * scene.tweenChanges(true);
		 *
		 * @fires {@link ScrollScene.change}, when used as setter
		 * @param {boolean} [newTweenChanges] - The new tweenChanges setting of the scene.
		 * @returns {boolean} `get` -  Current tweenChanges option value.
		 * @returns {ScrollScene} `set` -  Parent object for chaining.
		 */
		this.tweenChanges = function (newTweenChanges) {
			var varname = "tweenChanges";
			if (!arguments.length) { // get
				return _options[varname];
			} else if (changeOption(varname, newTweenChanges)) { // set
				ScrollScene.trigger("change", {what: varname, newval: _options[varname]});
			}
			return ScrollScene;
		};

		/**
		 * **Get** or **Set** the loglevel option value.
		 * @public
		 * @example
		 * // get the current loglevel
		 * var loglevel = scene.loglevel();
		 *
	 	 * // set new loglevel
		 * scene.loglevel(3);
		 *
		 * @fires {@link ScrollScene.change}, when used as setter
		 * @param {number} [newLoglevel] - The new loglevel setting of the scene. `[0-3]`
		 * @returns {number} `get` -  Current loglevel.
		 * @returns {ScrollScene} `set` -  Parent object for chaining.
		 */
		this.loglevel = function (newLoglevel) {
			var varname = "loglevel";
			if (!arguments.length) { // get
				return _options[varname];
			} else if (changeOption(varname, newLoglevel)) { // set
				ScrollScene.trigger("change", {what: varname, newval: _options[varname]});
			}
			return ScrollScene;
		};
		
		/**
		 * **Get** the current state.
		 * @public
		 * @example
		 * // get the current state
		 * var state = scene.state();
		 *
		 * @returns {string} `"BEFORE"`, `"DURING"` or `"AFTER"`
		 */
		this.state = function () {
			return _state;
		};

		/**
		 * **Get** the trigger position of the scene (including the value of the `offset` option).  
		 * @public
		 * @example
		 * // get the scene's trigger position
		 * var triggerPosition = scene.triggerPosition();
		 *
		 * @returns {number} Start position of the scene. Top position value for vertical and left position value for horizontal scrolls.
		 */
		this.triggerPosition = function () {
			var pos = _options.offset; // the offset is the basis
			if (_parent) {
				// get the trigger position
				if (_options.triggerElement) {
					// Element as trigger
					pos += _triggerPos;
				} else {
					// return the height of the triggerHook to start at the beginning
					pos += _parent.info("size") * ScrollScene.triggerHook();
				}
			}
			return pos;
		};

		/**
		 * **Get** the trigger offset of the scene (including the value of the `offset` option).  
		 * @public
		 * @deprecated Method is deprecated since 1.1.0. You should now use {@link ScrollScene.triggerPosition}
		 */
		this.triggerOffset = function () {
			return ScrollScene.triggerPosition();
		};

		/**
		 * **Get** the current scroll offset for the start of the scene.  
		 * Mind, that the scrollOffset is related to the size of the container, if `triggerHook` is bigger than `0` (or `"onLeave"`).  
		 * This means, that resizing the container or changing the `triggerHook` will influence the scene's start offset.
		 * @public
		 * @example
		 * // get the current scroll offset for the start and end of the scene.
		 * var start = scene.scrollOffset();
		 * var end = scene.scrollOffset() + scene.duration();
		 * console.log("the scene starts at", start, "and ends at", end);
		 *
		 * @returns {number} The scroll offset (of the container) at which the scene will trigger. Y value for vertical and X value for horizontal scrolls.
		 */
		this.scrollOffset = function () {
			return _scrollOffset.start;
		};

		/*
		 * ----------------------------------------------------------------
		 * public functions (scene modification)
		 * ----------------------------------------------------------------
		 */

		/**
		 * Updates the Scene in the parent Controller to reflect the current state.  
		 * This is the equivalent to `ScrollMagic.updateScene(scene, immediately)`.  
		 * The update method calculates the scene's start and end position (based on the trigger element, trigger hook, duration and offset) and checks it against the current scroll position of the container.  
		 * It then updates the current scene state accordingly (or does nothing, if the state is already correct) – Pins will be set to their correct position and tweens will be updated to their correct progress.
		 * This means an update doesn't necessarily result in a progress change. The `progress` event will be fired if the progress has indeed changed between this update and the last.  
		 * _**NOTE:** This method gets called constantly whenever ScrollMagic detects a change. The only application for you is if you change something outside of the realm of ScrollMagic, like moving the trigger or changing tween parameters._
		 * @public
		 * @example
		 * // update the scene on next tick
		 * scene.update();
		 *
		 * // update the scene immediately
		 * scene.update(true);
		 *
		 * @fires ScrollScene.update
		 *
		 * @param {boolean} [immediately=false] - If `true` the update will be instant, if `false` it will wait until next update cycle (better performance).
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.update = function (immediately) {
			if (_parent) {
				if (immediately) {
					if (_parent.enabled() && _enabled) {
						var
							scrollPos = _parent.info("scrollPos"),
							newProgress;

						if (_options.duration > 0) {
							newProgress = (scrollPos - _scrollOffset.start)/(_scrollOffset.end - _scrollOffset.start);
						} else {
							newProgress = scrollPos >= _scrollOffset.start ? 1 : 0;
						}

						ScrollScene.trigger("update", {startPos: _scrollOffset.start, endPos: _scrollOffset.end, scrollPos: scrollPos});

						ScrollScene.progress(newProgress);
					} else if (_pin && _state === "DURING") {
						updatePinState(true); // unpin in position
					}
				} else {
					_parent.updateScene(ScrollScene, false);
				}
			}
			return ScrollScene;
		};

		/**
		 * Updates dynamic scene variables like the trigger element position or the duration.
		 * This method is automatically called in regular intervals from the controller. See {@link ScrollMagic} option `refreshInterval`.
		 * 
		 * You can call it to minimize lag, for example when you intentionally change the position of the triggerElement.
		 * If you don't it will simply be updated in the next refresh interval of the container, which is usually sufficient.
		 *
		 * @public
		 * @since 1.1.0
		 * @example
		 * scene = new ScrollScene({triggerElement: "#trigger"});
		 * 
		 * // change the position of the trigger
		 * $("#trigger").css("top", 500);
		 * // immediately let the scene know of this change
		 * scene.refresh();
		 *
		 * @fires {@link ScrollScene.shift}, if the trigger element position or the duration changed
		 * @fires {@link ScrollScene.change}, if the duration changed
		 *
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.refresh = function () {
			updateDuration();
			updateTriggerElementPosition();
			// update trigger element position
			return ScrollScene;
		};

		/**
		 * **Get** or **Set** the scene's progress.  
		 * Usually it shouldn't be necessary to use this as a setter, as it is set automatically by scene.update().  
		 * The order in which the events are fired depends on the duration of the scene:
		 *  1. Scenes with `duration == 0`:  
		 *  Scenes that have no duration by definition have no ending. Thus the `end` event will never be fired.  
		 *  When the trigger position of the scene is passed the events are always fired in this order:  
		 *  `enter`, `start`, `progress` when scrolling forward  
		 *  and  
		 *  `progress`, `start`, `leave` when scrolling in reverse
		 *  2. Scenes with `duration > 0`:  
		 *  Scenes with a set duration have a defined start and end point.  
		 *  When scrolling past the start position of the scene it will fire these events in this order:  
		 *  `enter`, `start`, `progress`  
		 *  When continuing to scroll and passing the end point it will fire these events:  
		 *  `progress`, `end`, `leave`  
		 *  When reversing through the end point these events are fired:  
		 *  `enter`, `end`, `progress`  
		 *  And when continuing to scroll past the start position in reverse it will fire:  
		 *  `progress`, `start`, `leave`  
		 *  In between start and end the `progress` event will be called constantly, whenever the progress changes.
		 * 
		 * In short:  
		 * `enter` events will always trigger **before** the progress update and `leave` envents will trigger **after** the progress update.  
		 * `start` and `end` will always trigger at their respective position.
		 * 
		 * Please review the event descriptions for details on the events and the event object that is passed to the callback.
		 * 
		 * @public
		 * @example
		 * // get the current scene progress
		 * var progress = scene.progress();
		 *
	 	 * // set new scene progress
		 * scene.progress(0.3);
		 *
		 * @fires {@link ScrollScene.enter}, when used as setter
		 * @fires {@link ScrollScene.start}, when used as setter
		 * @fires {@link ScrollScene.progress}, when used as setter
		 * @fires {@link ScrollScene.end}, when used as setter
		 * @fires {@link ScrollScene.leave}, when used as setter
		 *
		 * @param {number} [progress] - The new progress value of the scene `[0-1]`.
		 * @returns {number} `get` -  Current scene progress.
		 * @returns {ScrollScene} `set` -  Parent object for chaining.
		 */
		this.progress = function (progress) {
			if (!arguments.length) { // get
				return _progress;
			} else { // set
				var
					doUpdate = false,
					oldState = _state,
					scrollDirection = _parent ? _parent.info("scrollDirection") : 'PAUSED',
					reverseOrForward = _options.reverse || progress >= _progress;
				if (_options.duration === 0) {
					// zero duration scenes
					doUpdate = _progress != progress;
					_progress = progress < 1 && reverseOrForward ? 0 : 1;
					_state = _progress === 0 ? 'BEFORE' : 'DURING';
				} else {
					// scenes with start and end
					if (progress <= 0 && _state !== 'BEFORE' && reverseOrForward) {
						// go back to initial state
						_progress = 0;
						_state = 'BEFORE';
						doUpdate = true;
					} else if (progress > 0 && progress < 1 && reverseOrForward) {
						_progress = progress;
						_state = 'DURING';
						doUpdate = true;
					} else if (progress >= 1 && _state !== 'AFTER') {
						_progress = 1;
						_state = 'AFTER';
						doUpdate = true;
					} else if (_state === 'DURING' && !reverseOrForward) {
						updatePinState(); // in case we scrolled backwards mid-scene and reverse is disabled => update the pin position, so it doesn't move back as well.
					}
				}
				if (doUpdate) {
					// fire events
					var
						eventVars = {progress: _progress, state: _state, scrollDirection: scrollDirection},
						stateChanged = _state != oldState;

					var trigger = function (eventName) { // tmp helper to simplify code
						ScrollScene.trigger(eventName, eventVars);
					};

					if (stateChanged) { // enter events
						if (oldState !== 'DURING') {
							trigger("enter");
							trigger(oldState === 'BEFORE' ? "start" : "end");
						}
					}
					trigger("progress");
					if (stateChanged) { // leave events
						if (_state !== 'DURING') {
							trigger(_state === 'BEFORE' ? "start" : "end");
							trigger("leave");
						}
					}
				}

				return ScrollScene;
			}
		};

		/**
		 * Add a tween to the scene.  
		 * If you want to add multiple tweens, wrap them into one TimelineMax object and add it.  
		 * The duration of the tween is streched to the scroll duration of the scene, unless the scene has a duration of `0`.
		 * @public
		 * @example
		 * // add a single tween
		 * scene.setTween(TweenMax.to("obj"), 1, {x: 100});
		 *
		 * // add multiple tweens, wrapped in a timeline.
		 * var timeline = new TimelineMax();
		 * var tween1 = TweenMax.from("obj1", 1, {x: 100});
		 * var tween2 = TweenMax.to("obj2", 1, {y: 100});
		 * timeline
		 *		.add(tween1)
		 *		.add(tween2);
		 * scene.addTween(timeline);
		 *
		 * @param {object} TweenObject - A TweenMax, TweenLite, TimelineMax or TimelineLite object that should be animated in the scene.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.setTween = function (TweenObject) {
			if (!TimelineMax) {
				log(1, "ERROR: TimelineMax wasn't found. Please make sure GSAP is loaded before ScrollMagic or use asynchronous loading.");
				return ScrollScene;
			}
			if (_tween) { // kill old tween?
				ScrollScene.removeTween();
			}
			try {
				// wrap Tween into a TimelineMax Object to include delay and repeats in the duration and standardize methods.
				_tween = new TimelineMax({smoothChildTiming: true})
					.add(TweenObject)
					.pause();
			} catch (e) {
				log(1, "ERROR calling method 'setTween()': Supplied argument is not a valid TweenObject");
			} finally {
				// some properties need to be transferred it to the wrapper, otherwise they would get lost.
				if (TweenObject.repeat && TweenObject.repeat() === -1) {// TweenMax or TimelineMax Object?
					_tween.repeat(-1);
					_tween.yoyo(TweenObject.yoyo());
				}
			}
			// Some tween validations and debugging helpers

			// check if there are position tweens defined for the trigger and warn about it :)
			if (_tween && _parent  && _options.triggerElement && _options.loglevel >= 2) {// parent is needed to know scroll direction.
				var
					triggerTweens = _tween.getTweensOf($(_options.triggerElement)),
					vertical = _parent.info("vertical");
				$.each(triggerTweens, function (index, value) {
					var
						tweenvars = value.vars.css || value.vars,
						condition = vertical ? (tweenvars.top !== undefined || tweenvars.bottom !== undefined) : (tweenvars.left !== undefined || tweenvars.right !== undefined);
					if (condition) {
						log(2, "WARNING: Tweening the position of the trigger element affects the scene timing and should be avoided!");
						return false;
					}
				});
			}

			// warn about tween overwrites, when an element is tweened multiple times
			if (parseFloat(TweenLite.version) >= 1.14) { // onOverwrite only present since GSAP v1.14.0
				var
					list = _tween.getChildren(true, true, false), // get all nested tween objects
					newCallback = function () {
						log(2, "WARNING: tween was overwritten by another. To learn how to avoid this issue see here: https://github.com/janpaepke/ScrollMagic/wiki/WARNING:-tween-was-overwritten-by-another");
					};
				for (var i=0, thisTween, oldCallback; i<list.length; i++) {
					/*jshint loopfunc: true */
					thisTween = list[i];
					if (oldCallback !== newCallback) { // if tweens is added more than once
						oldCallback = thisTween.vars.onOverwrite;
						thisTween.vars.onOverwrite = function () {
							if (oldCallback) {
								oldCallback.apply(this, arguments);
							}
							newCallback.apply(this, arguments);
						};
					}
				}
			}
			log(3, "added tween");
			updateTweenProgress();
			return ScrollScene;
		};

		/**
		 * Remove the tween from the scene.
		 * @public
		 * @example
		 * // remove the tween from the scene without resetting it
		 * scene.removeTween();
		 *
		 * // remove the tween from the scene and reset it to initial position
		 * scene.removeTween(true);
		 *
		 * @param {boolean} [reset=false] - If `true` the tween will be reset to its initial values.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.removeTween = function (reset) {
			if (_tween) {
				if (reset) {
					updateTweenProgress(0);
				}
				_tween.kill();
				_tween = undefined;
				log(3, "removed tween (reset: " + (reset ? "true" : "false") + ")");
			}
			return ScrollScene;
		};

		/**
		 * Pin an element for the duration of the tween.  
		 * If the scene duration is 0 the element will only be unpinned, if the user scrolls back past the start position.  
		 * _**NOTE:** The option `pushFollowers` has no effect, when the scene duration is 0._
		 * @public
		 * @example
		 * // pin element and push all following elements down by the amount of the pin duration.
		 * scene.setPin("#pin");
		 *
		 * // pin element and keeping all following elements in their place. The pinned element will move past them.
		 * scene.setPin("#pin", {pushFollowers: false});
		 *
		 * @param {(string|object)} element - A Selector targeting an element, a DOM object or a jQuery object that is supposed to be pinned.
		 * @param {object} [settings] - settings for the pin
		 * @param {boolean} [settings.pushFollowers=true] - If `true` following elements will be "pushed" down for the duration of the pin, if `false` the pinned element will just scroll past them.  
		 												   Ignored, when duration is `0`.
		 * @param {string} [settings.spacerClass="scrollmagic-pin-spacer"] - Classname of the pin spacer element, which is used to replace the element.  
		 * @param {string} [settings.pinnedClass=""] - Classname that should be added to the pinned element during pin phase (and removed after).
		 *
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.setPin = function (element, settings) {
			var
				defaultSettings = {
					pushFollowers: true,
					spacerClass: "scrollmagic-pin-spacer",
					pinnedClass: ""
				};
			settings = $.extend({}, defaultSettings, settings);

			// validate Element
			element = $(element).first();
			if (element.length === 0) {
				log(1, "ERROR calling method 'setPin()': Invalid pin element supplied.");
				return ScrollScene; // cancel
			} else if (element.css("position") == "fixed") {
				log(1, "ERROR calling method 'setPin()': Pin does not work with elements that are positioned 'fixed'.");
				return ScrollScene; // cancel
			}

			if (_pin) { // preexisting pin?
				if (_pin === element) {
					// same pin we already have -> do nothing
					return ScrollScene; // cancel
				} else {
					// kill old pin
					ScrollScene.removePin();
				}
				
			}
			_pin = element;
			
			_pin.parent().hide(); // hack start to force jQuery css to return stylesheet values instead of calculated px values.
			var
				inFlow = _pin.css("position") != "absolute",
				pinCSS = _pin.css(["display", "top", "left", "bottom", "right"]),
				sizeCSS = _pin.css(["width", "height"]);
			_pin.parent().show(); // hack end.

			if (sizeCSS.width === "0px" &&  inFlow && isMarginCollapseType(pinCSS.display)) {
				// log (2, "WARNING: Your pinned element probably needs a defined width or it might collapse during pin.");
			}
			if (!inFlow && settings.pushFollowers) {
				log(2, "WARNING: If the pinned element is positioned absolutely pushFollowers is disabled.");
				settings.pushFollowers = false;
			}

			// create spacer
			var spacer = $("<div></div>")
					.addClass(settings.spacerClass)
					.css(pinCSS)
					.data("ScrollMagicPinSpacer", true)
					.css({
						position: inFlow ? "relative" : "absolute",
						"margin-left": "auto",
						"margin-right": "auto",
						"box-sizing": "content-box"
					});

			// set the pin Options
			var pinInlineCSS = _pin[0].style;
			_pinOptions = {
				spacer: spacer,
				relSize: { // save if size is defined using % values. if so, handle spacer resize differently...
					width: sizeCSS.width.slice(-1) === "%",
					height: sizeCSS.height.slice(-1) === "%",
					autoFullWidth: sizeCSS.width === "0px" &&  inFlow && isMarginCollapseType(pinCSS.display)
				},
				pushFollowers: settings.pushFollowers,
				inFlow: inFlow, // stores if the element takes up space in the document flow
				origStyle: {
					width: pinInlineCSS.width || "",
					position: pinInlineCSS.position || "",
					top: pinInlineCSS.top || "",
					left: pinInlineCSS.left || "",
					bottom: pinInlineCSS.bottom || "",
					right: pinInlineCSS.right || "",
					"box-sizing": pinInlineCSS["box-sizing"] || "",
					"-moz-box-sizing": pinInlineCSS["-moz-box-sizing"] || "",
					"-webkit-box-sizing": pinInlineCSS["-webkit-box-sizing"] || ""
				}, // save old styles (for reset)
				pinnedClass: settings.pinnedClass // the class that should be added to the element when pinned
			};

			// if relative size, transfer it to spacer and make pin calculate it...
			if (_pinOptions.relSize.width) {
				spacer.css("width", sizeCSS.width);
			}
			if (_pinOptions.relSize.height) {
				spacer.css("height", sizeCSS.height);
			}

			// now place the pin element inside the spacer	
			_pin.before(spacer)
					.appendTo(spacer)
					// and set new css
					.css({
						position: inFlow ? "relative" : "absolute",
						top: "auto",
						left: "auto",
						bottom: "auto",
						right: "auto"
					});
			
			if (_pinOptions.relSize.width || _pinOptions.relSize.autoFullWidth) {
				_pin.css("box-sizing", "border-box");
			}

			// add listener to document to update pin position in case controller is not the document.
			$(window).on("scroll." + NAMESPACE + "_pin resize." + NAMESPACE + "_pin", updatePinInContainer);
			// add mousewheel listener to catch scrolls over fixed elements
			_pin.on("mousewheel DOMMouseScroll", onMousewheelOverPin);

			log(3, "added pin");

			// finally update the pin to init
			updatePinState();

			return ScrollScene;
		};

		/**
		 * Remove the pin from the scene.
		 * @public
		 * @example
		 * // remove the pin from the scene without resetting it (the spacer is not removed)
		 * scene.removePin();
		 *
		 * // remove the pin from the scene and reset the pin element to its initial position (spacer is removed)
		 * scene.removePin(true);
		 *
		 * @param {boolean} [reset=false] - If `false` the spacer will not be removed and the element's position will not be reset.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.removePin = function (reset) {
			if (_pin) {
				if (reset || !_parent) { // if there's no parent no progress was made anyway...
					_pin.insertBefore(_pinOptions.spacer)
						.css(_pinOptions.origStyle);
					_pinOptions.spacer.remove();
				} else {
					if (_state === "DURING") {
						updatePinState(true); // force unpin at position
					}
				}
				$(window).off("scroll." + NAMESPACE + "_pin resize." + NAMESPACE + "_pin");
				_pin.off("mousewheel DOMMouseScroll", onMousewheelOverPin);
				_pin = undefined;
				log(3, "removed pin (reset: " + (reset ? "true" : "false") + ")");
			}
			return ScrollScene;
		};

		/**
		 * Define a css class modification while the scene is active.  
		 * When the scene triggers the classes will be added to the supplied element and removed, when the scene is over.
		 * If the scene duration is 0 the classes will only be removed if the user scrolls back past the start position.
		 * @public
		 * @example
		 * // add the class 'myclass' to the element with the id 'my-elem' for the duration of the scene
		 * scene.setClassToggle("#my-elem", "myclass");
		 *
		 * // add multiple classes to multiple elements defined by the selector '.classChange'
		 * scene.setClassToggle(".classChange", "class1 class2 class3");
		 *
		 * @param {(string|object)} element - A Selector targeting one or more elements, a DOM object or a jQuery object that is supposed to be modified.
		 * @param {string} classes - One or more Classnames (separated by space) that should be added to the element during the scene.
		 *
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.setClassToggle = function (element, classes) {
			var $elm = $(element);
			if ($elm.length === 0 || $.type(classes) !== "string") {
				log(1, "ERROR calling method 'setClassToggle()': Invalid " + ($elm.length === 0 ? "element" : "classes") + " supplied.");
				return ScrollScene;
			}
			_cssClasses = classes;
			_cssClassElm = $elm;
			ScrollScene.on("enter.internal_class leave.internal_class", function (e) {
				_cssClassElm.toggleClass(_cssClasses, e.type === "enter");
			});
			return ScrollScene;
		};

		/**
		 * Remove the class binding from the scene.
		 * @public
		 * @example
		 * // remove class binding from the scene without reset
		 * scene.removeClassToggle();
		 *
		 * // remove class binding and remove the changes it caused
		 * scene.removeClassToggle(true);
		 *
		 * @param {boolean} [reset=false] - If `false` and the classes are currently active, they will remain on the element. If `true` they will be removed.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.removeClassToggle = function (reset) {
			if (_cssClassElm && reset) {
				_cssClassElm.removeClass(_cssClasses);
			}
			ScrollScene.off("start.internal_class end.internal_class");
			_cssClasses = undefined;
			_cssClassElm = undefined;
			return ScrollScene;
		};

		/**
		 * Add the scene to a controller.  
		 * This is the equivalent to `ScrollMagic.addScene(scene)`.
		 * @public
		 * @example
		 * // add a scene to a ScrollMagic controller
		 * scene.addTo(controller);
		 *
		 * @param {ScrollMagic} controller - The controller to which the scene should be added.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.addTo = function (controller) {
			if (!(controller instanceof ScrollMagic)) {
				log(1, "ERROR: supplied argument of 'addTo()' is not a valid ScrollMagic controller");
			} else if (_parent != controller) {
				// new parent
				if (_parent) { // I had a parent before, so remove it...
					_parent.removeScene(ScrollScene);
				}
				_parent = controller;
				validateOption();
				updateDuration(true);
				updateTriggerElementPosition(true);
				updateScrollOffset();
				updatePinSpacerSize();
				_parent.info("container").on("resize." + NAMESPACE, function () {
					updateRelativePinSpacer();
					if (ScrollScene.triggerHook() > 0) {
						ScrollScene.trigger("shift", {reason: "containerSize"});
					}
				});
				log(3, "added " + NAMESPACE + " to controller");
				controller.addScene(ScrollScene);
				ScrollScene.update();
			}
			return ScrollScene;
		};

		/**
		 * **Get** or **Set** the current enabled state of the scene.  
		 * This can be used to disable this scene without removing or destroying it.
		 * @public
		 *
		 * @example
		 * // get the current value
		 * var enabled = scene.enabled();
		 *
	 	 * // disable the scene
		 * scene.enabled(false);
		 *
		 * @param {boolean} [newState] - The new enabled state of the scene `true` or `false`.
		 * @returns {(boolean|ScrollScene)} Current enabled state or parent object for chaining.
		 */
		this.enabled = function (newState) {
			if (!arguments.length) { // get
				return _enabled;
			} else if (_enabled != newState) { // set
				_enabled = !!newState;
				ScrollScene.update(true);
			}
			return ScrollScene;
		};
		
		/**
		 * Remove the scene from its parent controller.  
		 * This is the equivalent to `ScrollMagic.removeScene(scene)`.
		 * The scene will not be updated anymore until you readd it to a controller.
		 * To remove the pin or the tween you need to call removeTween() or removePin() respectively.
		 * @public
		 * @example
		 * // remove the scene from its parent controller
		 * scene.remove();
		 *
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		this.remove = function () {
			if (_parent) {
				_parent.info("container").off("resize." + NAMESPACE);
				var tmpParent = _parent;
				_parent = undefined;
				log(3, "removed " + NAMESPACE + " from controller");
				tmpParent.removeScene(ScrollScene);
			}
			return ScrollScene;
		};

		/**
		 * Destroy the scene and everything.
		 * @public
		 * @example
		 * // destroy the scene without resetting the pin and tween to their initial positions
		 * scene = scene.destroy();
		 *
		 * // destroy the scene and reset the pin and tween
		 * scene = scene.destroy(true);
		 *
		 * @param {boolean} [reset=false] - If `true` the pin and tween (if existent) will be reset.
		 * @returns {null} Null to unset handler variables.
		 */
		this.destroy = function (reset) {
			ScrollScene.removeTween(reset);
			ScrollScene.removePin(reset);
			ScrollScene.removeClassToggle(reset);
			ScrollScene.trigger("destroy", {reset: reset});
			ScrollScene.remove();
			ScrollScene.off("start end enter leave progress change update shift destroy shift.internal change.internal progress.internal");
			log(3, "destroyed " + NAMESPACE + " (reset: " + (reset ? "true" : "false") + ")");
			return null;
		};

		/*
		 * ----------------------------------------------------------------
		 * EVENTS
		 * ----------------------------------------------------------------
		 */
		
		/**
		 * Scene start event.  
		 * Fires whenever the scroll position its the starting point of the scene.  
		 * It will also fire when scrolling back up going over the start position of the scene. If you want something to happen only when scrolling down/right, use the scrollDirection parameter passed to the callback.
		 *
		 * For details on this event and the order in which it is fired, please review the {@link ScrollScene.progress} method.
		 *
		 * @event ScrollScene.start
		 *
		 * @example
		 * scene.on("start", function (event) {
		 * 		alert("Hit start point of scene.");
		 * });
		 *
		 * @property {object} event - The event Object passed to each callback
		 * @property {string} event.type - The name of the event
		 * @property {ScrollScene} event.target - The ScrollScene object that triggered this event
		 * @property {number} event.progress - Reflects the current progress of the scene
		 * @property {string} event.state - The current state of the scene `"BEFORE"`, `"DURING"` or `"AFTER"`
		 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
		 */
		/**
		 * Scene end event.  
		 * Fires whenever the scroll position its the ending point of the scene.  
		 * It will also fire when scrolling back up from after the scene and going over its end position. If you want something to happen only when scrolling down/right, use the scrollDirection parameter passed to the callback.
		 *
		 * For details on this event and the order in which it is fired, please review the {@link ScrollScene.progress} method.
		 *
		 * @event ScrollScene.end
		 *
		 * @example
		 * scene.on("end", function (event) {
		 * 		alert("Hit end point of scene.");
		 * });
		 *
		 * @property {object} event - The event Object passed to each callback
		 * @property {string} event.type - The name of the event
		 * @property {ScrollScene} event.target - The ScrollScene object that triggered this event
		 * @property {number} event.progress - Reflects the current progress of the scene
		 * @property {string} event.state - The current state of the scene `"BEFORE"`, `"DURING"` or `"AFTER"`
		 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
		 */
		/**
		 * Scene enter event.  
		 * Fires whenever the scene enters the "DURING" state.  
		 * Keep in mind that it doesn't matter if the scene plays forward or backward: This event always fires when the scene enters its active scroll timeframe, regardless of the scroll-direction.
		 *
		 * For details on this event and the order in which it is fired, please review the {@link ScrollScene.progress} method.
		 *
		 * @event ScrollScene.enter
		 *
		 * @example
		 * scene.on("enter", function (event) {
		 * 		alert("Entered a scene.");
		 * });
		 *
		 * @property {object} event - The event Object passed to each callback
		 * @property {string} event.type - The name of the event
		 * @property {ScrollScene} event.target - The ScrollScene object that triggered this event
		 * @property {number} event.progress - Reflects the current progress of the scene
		 * @property {string} event.state - The current state of the scene `"BEFORE"`, `"DURING"` or `"AFTER"`
		 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
		 */
		/**
		 * Scene leave event.  
		 * Fires whenever the scene's state goes from "DURING" to either "BEFORE" or "AFTER".  
		 * Keep in mind that it doesn't matter if the scene plays forward or backward: This event always fires when the scene leaves its active scroll timeframe, regardless of the scroll-direction.
		 *
		 * For details on this event and the order in which it is fired, please review the {@link ScrollScene.progress} method.
		 *
		 * @event ScrollScene.leave
		 *
		 * @example
		 * scene.on("leave", function (event) {
		 * 		alert("Left a scene.");
		 * });
		 *
		 * @property {object} event - The event Object passed to each callback
		 * @property {string} event.type - The name of the event
		 * @property {ScrollScene} event.target - The ScrollScene object that triggered this event
		 * @property {number} event.progress - Reflects the current progress of the scene
		 * @property {string} event.state - The current state of the scene `"BEFORE"`, `"DURING"` or `"AFTER"`
		 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
		 */
		/**
		 * Scene update event.  
		 * Fires whenever the scene is updated (but not necessarily changes the progress).
		 *
		 * @event ScrollScene.update
		 *
		 * @example
		 * scene.on("update", function (event) {
		 * 		console.log("Scene updated.");
		 * });
		 *
		 * @property {object} event - The event Object passed to each callback
		 * @property {string} event.type - The name of the event
		 * @property {ScrollScene} event.target - The ScrollScene object that triggered this event
		 * @property {number} event.startPos - The starting position of the scene (in relation to the conainer)
		 * @property {number} event.endPos - The ending position of the scene (in relation to the conainer)
		 * @property {number} event.scrollPos - The current scroll position of the container
		 */
		/**
		 * Scene progress event.  
		 * Fires whenever the progress of the scene changes.
		 *
		 * For details on this event and the order in which it is fired, please review the {@link ScrollScene.progress} method.
		 *
		 * @event ScrollScene.progress
		 *
		 * @example
		 * scene.on("progress", function (event) {
		 * 		console.log("Scene progress changed.");
		 * });
		 *
		 * @property {object} event - The event Object passed to each callback
		 * @property {string} event.type - The name of the event
		 * @property {ScrollScene} event.target - The ScrollScene object that triggered this event
		 * @property {number} event.progress - Reflects the current progress of the scene
		 * @property {string} event.state - The current state of the scene `"BEFORE"`, `"DURING"` or `"AFTER"`
		 * @property {string} event.scrollDirection - Indicates which way we are scrolling `"PAUSED"`, `"FORWARD"` or `"REVERSE"`
		 */
		/**
		 * Scene change event.  
		 * Fires whenvever a property of the scene is changed.
		 *
		 * @event ScrollScene.change
		 *
		 * @example
		 * scene.on("change", function (event) {
		 * 		console.log("Scene Property \"" + event.what + "\" changed to " + event.newval);
		 * });
		 *
		 * @property {object} event - The event Object passed to each callback
		 * @property {string} event.type - The name of the event
		 * @property {ScrollScene} event.target - The ScrollScene object that triggered this event
		 * @property {string} event.what - Indicates what value has been changed
		 * @property {mixed} event.newval - The new value of the changed property
		 */
		/**
		 * Scene shift event.  
		 * Fires whenvever the start or end **scroll offset** of the scene change.
		 * This happens explicitely, when one of these values change: `offset`, `duration` or `triggerHook`.
		 * It will fire implicitly when the `triggerElement` changes, if the new element has a different position (most cases).
		 * It will also fire implicitly when the size of the container changes and the triggerHook is anything other than `onLeave`.
		 *
		 * @event ScrollScene.shift
		 * @since 1.1.0
		 *
		 * @example
		 * scene.on("shift", function (event) {
		 * 		console.log("Scene moved, because the " + event.reason + " has changed.)");
		 * });
		 *
		 * @property {object} event - The event Object passed to each callback
		 * @property {string} event.type - The name of the event
		 * @property {ScrollScene} event.target - The ScrollScene object that triggered this event
		 * @property {string} event.reason - Indicates why the scene has shifted
		 */
		/**
		 * Scene destroy event.  
		 * Fires whenvever the scene is destroyed.
		 * This can be used to tidy up custom behaviour used in events.
		 *
		 * @event ScrollScene.destroy
		 * @since 1.1.0
		 *
		 * @example
		 * scene.on("enter", function (event) {
		 *        // add custom action
		 *        $("#my-elem").left("200");
		 *      })
		 *      .on("destroy", function (event) {
		 *        // reset my element to start position
		 *        if (event.reset) {
		 *          $("#my-elem").left("0");
		 *        }
		 *      });
		 *
		 * @property {object} event - The event Object passed to each callback
		 * @property {string} event.type - The name of the event
		 * @property {ScrollScene} event.target - The ScrollScene object that triggered this event
		 * @property {boolean} event.reset - Indicates if the destroy method was called with reset `true` or `false`.
		 */
		 
		 /**
		 * Add one ore more event listener.  
		 * The callback function will be fired at the respective event, and an object containing relevant data will be passed to the callback.
		 * @public
		 *
		 * @example
		 * function callback (event) {
		 * 		console.log("Event fired! (" + event.type + ")");
		 * }
		 * // add listeners
		 * scene.on("change update progress start end enter leave", callback);
		 *
		 * @param {string} name - The name or names of the event the callback should be attached to.
		 * @param {function} callback - A function that should be executed, when the event is dispatched. An event object will be passed to the callback.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		 this.on = function (name, callback) {
			if ($.isFunction(callback)) {
				var names = $.trim(name).toLowerCase()
							.replace(/(\w+)\.(\w+)/g, '$1.' + NAMESPACE + '_$2') // add custom namespace, if one is defined
							.replace(/( |^)(\w+)(?= |$)/g, '$1$2.' + NAMESPACE ); // add namespace to regulars.
				$(ScrollScene).on(names, callback);
			} else {
				log(1, "ERROR calling method 'on()': Supplied argument is not a valid callback!");
			}
			return ScrollScene;
		 };

		 /**
		 * Remove one or more event listener.
		 * @public
		 *
		 * @example
		 * function callback (event) {
		 * 		console.log("Event fired! (" + event.type + ")");
		 * }
		 * // add listeners
		 * scene.on("change update", callback);
		 * // remove listeners
		 * scene.off("change update", callback);
		 *
		 * @param {string} name - The name or names of the event that should be removed.
		 * @param {function} [callback] - A specific callback function that should be removed. If none is passed all callbacks to the event listener will be removed.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		 this.off = function (name, callback) {
			var names = $.trim(name).toLowerCase()
						.replace(/(\w+)\.(\w+)/g, '$1.' + NAMESPACE + '_$2') // add custom namespace, if one is defined
						.replace(/( |^)(\w+)(?= |$)/g, '$1$2.' + NAMESPACE + '$3'); // add namespace to regulars.
			$(ScrollScene).off(names, callback);
			return ScrollScene;
		 };

		 /**
		 * Trigger an event.
		 * @public
		 *
		 * @example
		 * this.trigger("change");
		 *
		 * @param {string} name - The name of the event that should be triggered.
		 * @param {object} [vars] - An object containing info that should be passed to the callback.
		 * @returns {ScrollScene} Parent object for chaining.
		 */
		 this.trigger = function (name, vars) {
			log(3, 'event fired:', name, "->", vars);
			var event = $.Event($.trim(name).toLowerCase(), vars);
			$(ScrollScene).trigger(event);
			return ScrollScene;
		 };

		// INIT
		construct();
		return ScrollScene;
	};
	return ScrollScene;
});

	/*
	 * ----------------------------------------------------------------
	 * global logging functions and making sure no console errors occur
	 * ----------------------------------------------------------------
	 */

	var debug = (function (console) {
		var loglevels = ["error", "warn", "log"];
		if (!console.log) {
			console.log = function(){}; // no console log, well - do nothing then...
		}
		for(var i = 0, method; i<loglevels.length; i++) { // make sure methods for all levels exist.
			method = loglevels[i];
			if (!console[method]) {
				console[method] = console.log; // prefer .log over nothing
			}
		}
		// debugging function
		return function (loglevel) {
			if (loglevel > loglevels.length || loglevel <= 0) loglevel = loglevels.length;
			var now = new Date(),
				time = ("0"+now.getHours()).slice(-2) + ":" + ("0"+now.getMinutes()).slice(-2) + ":" + ("0"+now.getSeconds()).slice(-2) + ":" + ("00"+now.getMilliseconds()).slice(-3),
				method = loglevels[loglevel-1],
				args = Array.prototype.splice.call(arguments, 1),
				func = Function.prototype.bind.call(console[method], console);

			args.unshift(time);
			func.apply(console, args);
		};
	}(window.console = window.console || {}));
	// a helper function that should generally be faster than jQuery.offset() and can also return position in relation to viewport.
	var getOffset = function (elem, relativeToViewport) {
		var offset = {top: 0, left: 0};
		elem = elem[0]; // tmp workaround until jQuery dependency is removed.
		if (elem && elem.getBoundingClientRect) { // check if available
			var rect = elem.getBoundingClientRect();
			offset.top = rect.top;
			offset.left = rect.left;
			if (!relativeToViewport) { // clientRect is by default relative to viewport...
				offset.top += (window.pageYOffset || document.scrollTop  || 0) - (document.clientTop  || 0);
				offset.left += (window.pageXOffset || document.scrollLeft  || 0) - (document.clientLeft || 0);
			}
		}
		return offset;
	};
	var isDomElement = function (o){
		return (
			typeof HTMLElement === "object" ? o instanceof HTMLElement : //DOM2
			o && typeof o === "object" && o !== null && o.nodeType === 1 && typeof o.nodeName==="string"
		);
	};
	var isMarginCollapseType = function (str) {
		return ["block", "flex", "list-item", "table", "-webkit-box"].indexOf(str) > -1;
	};
	// implementation of requestAnimationFrame
	var animationFrameCallback = window.requestAnimationFrame;
	var animationFrameCancelCallback = window.cancelAnimationFrame;

	// polyfill -> based on https://gist.github.com/paulirish/1579671
	(function (window) {
		var
			lastTime = 0,
			vendors = ['ms', 'moz', 'webkit', 'o'],
			i;

		// try vendor prefixes if the above doesn't work
		for (i = 0; !animationFrameCallback && i < vendors.length; ++i) {
			animationFrameCallback = window[vendors[i] + 'RequestAnimationFrame'];
			animationFrameCancelCallback = window[vendors[i] + 'CancelAnimationFrame'] || window[vendors[i] + 'CancelRequestAnimationFrame'];
		}

		// fallbacks
		if (!animationFrameCallback) {
			animationFrameCallback = function (callback) {
				var
					currTime = new Date().getTime(),
					timeToCall = Math.max(0, 16 - (currTime - lastTime)),
					id = window.setTimeout(function () { callback(currTime + timeToCall); }, timeToCall);
				lastTime = currTime + timeToCall;
				return id;
			};
		}
		if (!animationFrameCancelCallback) {
			animationFrameCancelCallback = function (id) {
				window.clearTimeout(id);
			};
		}
	}(window));

})(this || window);;(function($) {
  var version = '1.5.3',
      optionOverrides = {},
      defaults = {
        exclude: [],
        excludeWithin:[],
        offset: 0,

        // one of 'top' or 'left'
        direction: 'top',

        // jQuery set of elements you wish to scroll (for $.smoothScroll).
        //  if null (default), $('html, body').firstScrollable() is used.
        scrollElement: null,

        // only use if you want to override default behavior
        scrollTarget: null,

        // fn(opts) function to be called before scrolling occurs.
        // `this` is the element(s) being scrolled
        beforeScroll: function() {},

        // fn(opts) function to be called after scrolling occurs.
        // `this` is the triggering element
        afterScroll: function() {},
        easing: 'swing',
        speed: 400,

        // coefficient for "auto" speed
        autoCoefficient: 2,

        // $.fn.smoothScroll only: whether to prevent the default click action
        preventDefault: true
      },

      getScrollable = function(opts) {
        var scrollable = [],
            scrolled = false,
            dir = opts.dir && opts.dir === 'left' ? 'scrollLeft' : 'scrollTop';

        this.each(function() {

          if (this === document || this === window) { return; }
          var el = $(this);
          if ( el[dir]() > 0 ) {
            scrollable.push(this);
          } else {
            // if scroll(Top|Left) === 0, nudge the element 1px and see if it moves
            el[dir](1);
            scrolled = el[dir]() > 0;
            if ( scrolled ) {
              scrollable.push(this);
            }
            // then put it back, of course
            el[dir](0);
          }
        });

        // If no scrollable elements, fall back to <body>,
        // if it's in the jQuery collection
        // (doing this because Safari sets scrollTop async,
        // so can't set it to 1 and immediately get the value.)
        if (!scrollable.length) {
          this.each(function() {
            if (this.nodeName === 'BODY') {
              scrollable = [this];
            }
          });
        }

        // Use the first scrollable element if we're calling firstScrollable()
        if ( opts.el === 'first' && scrollable.length > 1 ) {
          scrollable = [ scrollable[0] ];
        }

        return scrollable;
      };

  $.fn.extend({
    scrollable: function(dir) {
      var scrl = getScrollable.call(this, {dir: dir});
      return this.pushStack(scrl);
    },
    firstScrollable: function(dir) {
      var scrl = getScrollable.call(this, {el: 'first', dir: dir});
      return this.pushStack(scrl);
    },

    smoothScroll: function(options, extra) {
      options = options || {};

      if ( options === 'options' ) {
        if ( !extra ) {
          return this.first().data('ssOpts');
        }
        return this.each(function() {
          var $this = $(this),
              opts = $.extend($this.data('ssOpts') || {}, extra);

          $(this).data('ssOpts', opts);
        });
      }

      var opts = $.extend({}, $.fn.smoothScroll.defaults, options),
          locationPath = $.smoothScroll.filterPath(location.pathname);

      this
      .unbind('click.smoothscroll')
      .bind('click.smoothscroll', function(event) {
        var link = this,
            $link = $(this),
            thisOpts = $.extend({}, opts, $link.data('ssOpts') || {}),
            exclude = opts.exclude,
            excludeWithin = thisOpts.excludeWithin,
            elCounter = 0, ewlCounter = 0,
            include = true,
            clickOpts = {},
            hostMatch = ((location.hostname === link.hostname) || !link.hostname),
            pathMatch = thisOpts.scrollTarget || ( $.smoothScroll.filterPath(link.pathname) === locationPath ),
            thisHash = escapeSelector(link.hash);

        if ( !thisOpts.scrollTarget && (!hostMatch || !pathMatch || !thisHash) ) {
          include = false;
        } else {
          while (include && elCounter < exclude.length) {
            if ($link.is(escapeSelector(exclude[elCounter++]))) {
              include = false;
            }
          }
          while ( include && ewlCounter < excludeWithin.length ) {
            if ($link.closest(excludeWithin[ewlCounter++]).length) {
              include = false;
            }
          }
        }

        if ( include ) {

          if ( thisOpts.preventDefault ) {
            event.preventDefault();
          }

          $.extend( clickOpts, thisOpts, {
            scrollTarget: thisOpts.scrollTarget || thisHash,
            link: link
          });

          $.smoothScroll( clickOpts );
        }
      });

      return this;
    }
  });

  $.smoothScroll = function(options, px) {
    if ( options === 'options' && typeof px === 'object' ) {
      return $.extend(optionOverrides, px);
    }
    var opts, $scroller, scrollTargetOffset, speed, delta,
        scrollerOffset = 0,
        offPos = 'offset',
        scrollDir = 'scrollTop',
        aniProps = {},
        aniOpts = {};

    if (typeof options === 'number') {
      opts = $.extend({link: null}, $.fn.smoothScroll.defaults, optionOverrides);
      scrollTargetOffset = options;
    } else {
      opts = $.extend({link: null}, $.fn.smoothScroll.defaults, options || {}, optionOverrides);
      if (opts.scrollElement) {
        offPos = 'position';
        if (opts.scrollElement.css('position') === 'static') {
          opts.scrollElement.css('position', 'relative');
        }
      }
    }

    scrollDir = opts.direction === 'left' ? 'scrollLeft' : scrollDir;

    if ( opts.scrollElement ) {
      $scroller = opts.scrollElement;
      if ( !(/^(?:HTML|BODY)$/).test($scroller[0].nodeName) ) {
        scrollerOffset = $scroller[scrollDir]();
      }
    } else {
      $scroller = $('html, body').firstScrollable(opts.direction);
    }

    // beforeScroll callback function must fire before calculating offset
    opts.beforeScroll.call($scroller, opts);

    scrollTargetOffset = (typeof options === 'number') ? options :
                          px ||
                          ( $(opts.scrollTarget)[offPos]() &&
                          $(opts.scrollTarget)[offPos]()[opts.direction] ) ||
                          0;

    aniProps[scrollDir] = scrollTargetOffset + scrollerOffset + opts.offset;
    speed = opts.speed;

    // automatically calculate the speed of the scroll based on distance / coefficient
    if (speed === 'auto') {

      // $scroller.scrollTop() is position before scroll, aniProps[scrollDir] is position after
      // When delta is greater, speed will be greater.
      delta = aniProps[scrollDir] - $scroller.scrollTop();
      if(delta < 0) {
        delta *= -1;
      }

      // Divide the delta by the coefficient
      speed = delta / opts.autoCoefficient;
    }

    aniOpts = {
      duration: speed,
      easing: opts.easing,
      complete: function() {
        opts.afterScroll.call(opts.link, opts);
      }
    };

    if (opts.step) {
      aniOpts.step = opts.step;
    }

    if ($scroller.length) {
      $scroller.stop().animate(aniProps, aniOpts);
    } else {
      opts.afterScroll.call(opts.link, opts);
    }
  };

  $.smoothScroll.version = version;
  $.smoothScroll.filterPath = function(string) {
    string = string || '';
    return string
      .replace(/^\//,'')
      .replace(/(?:index|default).[a-zA-Z]{3,4}$/,'')
      .replace(/\/$/,'');
  };

  // default options
  $.fn.smoothScroll.defaults = defaults;

  function escapeSelector (str) {
    return str.replace(/(:|\.)/g,'\\$1');
  }

})(jQuery);;/*
 *  jQuery OwlCarousel v1.3.3
 *
 *  Copyright (c) 2013 Bartosz Wojciechowski
 *  http://www.owlgraphic.com/owlcarousel/
 *
 *  Licensed under MIT
 *
 */

/*JS Lint helpers: */
/*global dragMove: false, dragEnd: false, $, jQuery, alert, window, document */
/*jslint nomen: true, continue:true */

if (typeof Object.create !== "function") {
    Object.create = function (obj) {
        function F() {}
        F.prototype = obj;
        return new F();
    };
}
(function ($, window, document) {

    var Carousel = {
        init : function (options, el) {
            var base = this;

            base.$elem = $(el);
            base.options = $.extend({}, $.fn.owlCarousel.options, base.$elem.data(), options);

            base.userOptions = options;
            base.loadContent();
        },

        loadContent : function () {
            var base = this, url;

            function getData(data) {
                var i, content = "";
                if (typeof base.options.jsonSuccess === "function") {
                    base.options.jsonSuccess.apply(this, [data]);
                } else {
                    for (i in data.owl) {
                        if (data.owl.hasOwnProperty(i)) {
                            content += data.owl[i].item;
                        }
                    }
                    base.$elem.html(content);
                }
                base.logIn();
            }

            if (typeof base.options.beforeInit === "function") {
                base.options.beforeInit.apply(this, [base.$elem]);
            }

            if (typeof base.options.jsonPath === "string") {
                url = base.options.jsonPath;
                $.getJSON(url, getData);
            } else {
                base.logIn();
            }
        },

        logIn : function () {
            var base = this;

            base.$elem.data("owl-originalStyles", base.$elem.attr("style"));
            base.$elem.data("owl-originalClasses", base.$elem.attr("class"));

            base.$elem.css({opacity: 0});
            base.orignalItems = base.options.items;
            base.checkBrowser();
            base.wrapperWidth = 0;
            base.checkVisible = null;
            base.setVars();
        },

        setVars : function () {
            var base = this;
            if (base.$elem.children().length === 0) {return false; }
            base.baseClass();
            base.eventTypes();
            base.$userItems = base.$elem.children();
            base.itemsAmount = base.$userItems.length;
            base.wrapItems();
            base.$owlItems = base.$elem.find(".owl-item");
            base.$owlWrapper = base.$elem.find(".owl-wrapper");
            base.playDirection = "next";
            base.prevItem = 0;
            base.prevArr = [0];
            base.currentItem = 0;
            base.customEvents();
            base.onStartup();
        },

        onStartup : function () {
            var base = this;
            base.updateItems();
            base.calculateAll();
            base.buildControls();
            base.updateControls();
            base.response();
            base.moveEvents();
            base.stopOnHover();
            base.owlStatus();

            if (base.options.transitionStyle !== false) {
                base.transitionTypes(base.options.transitionStyle);
            }
            if (base.options.autoPlay === true) {
                base.options.autoPlay = 5000;
            }
            base.play();

            base.$elem.find(".owl-wrapper").css("display", "block");

            if (!base.$elem.is(":visible")) {
                base.watchVisibility();
            } else {
                base.$elem.css("opacity", 1);
            }
            base.onstartup = false;
            base.eachMoveUpdate();
            if (typeof base.options.afterInit === "function") {
                base.options.afterInit.apply(this, [base.$elem]);
            }
        },

        eachMoveUpdate : function () {
            var base = this;

            if (base.options.lazyLoad === true) {
                base.lazyLoad();
            }
            if (base.options.autoHeight === true) {
                base.autoHeight();
            }
            base.onVisibleItems();

            if (typeof base.options.afterAction === "function") {
                base.options.afterAction.apply(this, [base.$elem]);
            }
        },

        updateVars : function () {
            var base = this;
            if (typeof base.options.beforeUpdate === "function") {
                base.options.beforeUpdate.apply(this, [base.$elem]);
            }
            base.watchVisibility();
            base.updateItems();
            base.calculateAll();
            base.updatePosition();
            base.updateControls();
            base.eachMoveUpdate();
            if (typeof base.options.afterUpdate === "function") {
                base.options.afterUpdate.apply(this, [base.$elem]);
            }
        },

        reload : function () {
            var base = this;
            window.setTimeout(function () {
                base.updateVars();
            }, 0);
        },

        watchVisibility : function () {
            var base = this;

            if (base.$elem.is(":visible") === false) {
                base.$elem.css({opacity: 0});
                window.clearInterval(base.autoPlayInterval);
                window.clearInterval(base.checkVisible);
            } else {
                return false;
            }
            base.checkVisible = window.setInterval(function () {
                if (base.$elem.is(":visible")) {
                    base.reload();
                    base.$elem.animate({opacity: 1}, 200);
                    window.clearInterval(base.checkVisible);
                }
            }, 500);
        },

        wrapItems : function () {
            var base = this;
            base.$userItems.wrapAll("<div class=\"owl-wrapper\">").wrap("<div class=\"owl-item\"></div>");
            base.$elem.find(".owl-wrapper").wrap("<div class=\"owl-wrapper-outer\">");
            base.wrapperOuter = base.$elem.find(".owl-wrapper-outer");
            base.$elem.css("display", "block");
        },

        baseClass : function () {
            var base = this,
                hasBaseClass = base.$elem.hasClass(base.options.baseClass),
                hasThemeClass = base.$elem.hasClass(base.options.theme);

            if (!hasBaseClass) {
                base.$elem.addClass(base.options.baseClass);
            }

            if (!hasThemeClass) {
                base.$elem.addClass(base.options.theme);
            }
        },

        updateItems : function () {
            var base = this, width, i;

            if (base.options.responsive === false) {
                return false;
            }
            if (base.options.singleItem === true) {
                base.options.items = base.orignalItems = 1;
                base.options.itemsCustom = false;
                base.options.itemsDesktop = false;
                base.options.itemsDesktopSmall = false;
                base.options.itemsTablet = false;
                base.options.itemsTabletSmall = false;
                base.options.itemsMobile = false;
                return false;
            }

            width = $(base.options.responsiveBaseWidth).width();

            if (width > (base.options.itemsDesktop[0] || base.orignalItems)) {
                base.options.items = base.orignalItems;
            }
            if (base.options.itemsCustom !== false) {
                //Reorder array by screen size
                base.options.itemsCustom.sort(function (a, b) {return a[0] - b[0]; });

                for (i = 0; i < base.options.itemsCustom.length; i += 1) {
                    if (base.options.itemsCustom[i][0] <= width) {
                        base.options.items = base.options.itemsCustom[i][1];
                    }
                }

            } else {

                if (width <= base.options.itemsDesktop[0] && base.options.itemsDesktop !== false) {
                    base.options.items = base.options.itemsDesktop[1];
                }

                if (width <= base.options.itemsDesktopSmall[0] && base.options.itemsDesktopSmall !== false) {
                    base.options.items = base.options.itemsDesktopSmall[1];
                }

                if (width <= base.options.itemsTablet[0] && base.options.itemsTablet !== false) {
                    base.options.items = base.options.itemsTablet[1];
                }

                if (width <= base.options.itemsTabletSmall[0] && base.options.itemsTabletSmall !== false) {
                    base.options.items = base.options.itemsTabletSmall[1];
                }

                if (width <= base.options.itemsMobile[0] && base.options.itemsMobile !== false) {
                    base.options.items = base.options.itemsMobile[1];
                }
            }

            //if number of items is less than declared
            if (base.options.items > base.itemsAmount && base.options.itemsScaleUp === true) {
                base.options.items = base.itemsAmount;
            }
        },

        response : function () {
            var base = this,
                smallDelay,
                lastWindowWidth;

            if (base.options.responsive !== true) {
                return false;
            }
            lastWindowWidth = $(window).width();

            base.resizer = function () {
                if ($(window).width() !== lastWindowWidth) {
                    if (base.options.autoPlay !== false) {
                        window.clearInterval(base.autoPlayInterval);
                    }
                    window.clearTimeout(smallDelay);
                    smallDelay = window.setTimeout(function () {
                        lastWindowWidth = $(window).width();
                        base.updateVars();
                    }, base.options.responsiveRefreshRate);
                }
            };
            $(window).resize(base.resizer);
        },

        updatePosition : function () {
            var base = this;
            base.jumpTo(base.currentItem);
            if (base.options.autoPlay !== false) {
                base.checkAp();
            }
        },

        appendItemsSizes : function () {
            var base = this,
                roundPages = 0,
                lastItem = base.itemsAmount - base.options.items;

            base.$owlItems.each(function (index) {
                var $this = $(this);
                $this
                    .css({"width": base.itemWidth})
                    .data("owl-item", Number(index));

                if (index % base.options.items === 0 || index === lastItem) {
                    if (!(index > lastItem)) {
                        roundPages += 1;
                    }
                }
                $this.data("owl-roundPages", roundPages);
            });
        },

        appendWrapperSizes : function () {
            var base = this,
                width = base.$owlItems.length * base.itemWidth;

            base.$owlWrapper.css({
                "width": width * 2,
                "left": 0
            });
            base.appendItemsSizes();
        },

        calculateAll : function () {
            var base = this;
            base.calculateWidth();
            base.appendWrapperSizes();
            base.loops();
            base.max();
        },

        calculateWidth : function () {
            var base = this;
            base.itemWidth = Math.round(base.$elem.width() / base.options.items);
        },

        max : function () {
            var base = this,
                maximum = ((base.itemsAmount * base.itemWidth) - base.options.items * base.itemWidth) * -1;
            if (base.options.items > base.itemsAmount) {
                base.maximumItem = 0;
                maximum = 0;
                base.maximumPixels = 0;
            } else {
                base.maximumItem = base.itemsAmount - base.options.items;
                base.maximumPixels = maximum;
            }
            return maximum;
        },

        min : function () {
            return 0;
        },

        loops : function () {
            var base = this,
                prev = 0,
                elWidth = 0,
                i,
                item,
                roundPageNum;

            base.positionsInArray = [0];
            base.pagesInArray = [];

            for (i = 0; i < base.itemsAmount; i += 1) {
                elWidth += base.itemWidth;
                base.positionsInArray.push(-elWidth);

                if (base.options.scrollPerPage === true) {
                    item = $(base.$owlItems[i]);
                    roundPageNum = item.data("owl-roundPages");
                    if (roundPageNum !== prev) {
                        base.pagesInArray[prev] = base.positionsInArray[i];
                        prev = roundPageNum;
                    }
                }
            }
        },

        buildControls : function () {
            var base = this;
            if (base.options.navigation === true || base.options.pagination === true) {
                base.owlControls = $("<div class=\"owl-controls\"/>").toggleClass("clickable", !base.browser.isTouch).appendTo(base.$elem);
            }
            if (base.options.pagination === true) {
                base.buildPagination();
            }
            if (base.options.navigation === true) {
                base.buildButtons();
            }
        },

        buildButtons : function () {
            var base = this,
                buttonsWrapper = $("<div class=\"owl-buttons\"/>");
            base.owlControls.append(buttonsWrapper);

            base.buttonPrev = $("<div/>", {
                "class" : "owl-prev",
                "html" : base.options.navigationText[0] || ""
            });

            base.buttonNext = $("<div/>", {
                "class" : "owl-next",
                "html" : base.options.navigationText[1] || ""
            });

            buttonsWrapper
                .append(base.buttonPrev)
                .append(base.buttonNext);

            buttonsWrapper.on("touchstart.owlControls mousedown.owlControls", "div[class^=\"owl\"]", function (event) {
                event.preventDefault();
            });

            buttonsWrapper.on("touchend.owlControls mouseup.owlControls", "div[class^=\"owl\"]", function (event) {
                event.preventDefault();
                if ($(this).hasClass("owl-next")) {
                    base.next();
                } else {
                    base.prev();
                }
            });
        },

        buildPagination : function () {
            var base = this;

            base.paginationWrapper = $("<div class=\"owl-pagination\"/>");
            base.owlControls.append(base.paginationWrapper);

            base.paginationWrapper.on("touchend.owlControls mouseup.owlControls", ".owl-page", function (event) {
                event.preventDefault();
                if (Number($(this).data("owl-page")) !== base.currentItem) {
                    base.goTo(Number($(this).data("owl-page")), true);
                }
            });
        },

        updatePagination : function () {
            var base = this,
                counter,
                lastPage,
                lastItem,
                i,
                paginationButton,
                paginationButtonInner;

            if (base.options.pagination === false) {
                return false;
            }

            base.paginationWrapper.html("");

            counter = 0;
            lastPage = base.itemsAmount - base.itemsAmount % base.options.items;

            for (i = 0; i < base.itemsAmount; i += 1) {
                if (i % base.options.items === 0) {
                    counter += 1;
                    if (lastPage === i) {
                        lastItem = base.itemsAmount - base.options.items;
                    }
                    paginationButton = $("<div/>", {
                        "class" : "owl-page"
                    });
                    paginationButtonInner = $("<span></span>", {
                        "text": base.options.paginationNumbers === true ? counter : "",
                        "class": base.options.paginationNumbers === true ? "owl-numbers" : ""
                    });
                    paginationButton.append(paginationButtonInner);

                    paginationButton.data("owl-page", lastPage === i ? lastItem : i);
                    paginationButton.data("owl-roundPages", counter);

                    base.paginationWrapper.append(paginationButton);
                }
            }
            base.checkPagination();
        },
        checkPagination : function () {
            var base = this;
            if (base.options.pagination === false) {
                return false;
            }
            base.paginationWrapper.find(".owl-page").each(function () {
                if ($(this).data("owl-roundPages") === $(base.$owlItems[base.currentItem]).data("owl-roundPages")) {
                    base.paginationWrapper
                        .find(".owl-page")
                        .removeClass("active");
                    $(this).addClass("active");
                }
            });
        },

        checkNavigation : function () {
            var base = this;

            if (base.options.navigation === false) {
                return false;
            }
            if (base.options.rewindNav === false) {
                if (base.currentItem === 0 && base.maximumItem === 0) {
                    base.buttonPrev.addClass("disabled");
                    base.buttonNext.addClass("disabled");
                } else if (base.currentItem === 0 && base.maximumItem !== 0) {
                    base.buttonPrev.addClass("disabled");
                    base.buttonNext.removeClass("disabled");
                } else if (base.currentItem === base.maximumItem) {
                    base.buttonPrev.removeClass("disabled");
                    base.buttonNext.addClass("disabled");
                } else if (base.currentItem !== 0 && base.currentItem !== base.maximumItem) {
                    base.buttonPrev.removeClass("disabled");
                    base.buttonNext.removeClass("disabled");
                }
            }
        },

        updateControls : function () {
            var base = this;
            base.updatePagination();
            base.checkNavigation();
            if (base.owlControls) {
                if (base.options.items >= base.itemsAmount) {
                    base.owlControls.hide();
                } else {
                    base.owlControls.show();
                }
            }
        },

        destroyControls : function () {
            var base = this;
            if (base.owlControls) {
                base.owlControls.remove();
            }
        },

        next : function (speed) {
            var base = this;

            if (base.isTransition) {
                return false;
            }

            base.currentItem += base.options.scrollPerPage === true ? base.options.items : 1;
            if (base.currentItem > base.maximumItem + (base.options.scrollPerPage === true ? (base.options.items - 1) : 0)) {
                if (base.options.rewindNav === true) {
                    base.currentItem = 0;
                    speed = "rewind";
                } else {
                    base.currentItem = base.maximumItem;
                    return false;
                }
            }
            base.goTo(base.currentItem, speed);
        },

        prev : function (speed) {
            var base = this;

            if (base.isTransition) {
                return false;
            }

            if (base.options.scrollPerPage === true && base.currentItem > 0 && base.currentItem < base.options.items) {
                base.currentItem = 0;
            } else {
                base.currentItem -= base.options.scrollPerPage === true ? base.options.items : 1;
            }
            if (base.currentItem < 0) {
                if (base.options.rewindNav === true) {
                    base.currentItem = base.maximumItem;
                    speed = "rewind";
                } else {
                    base.currentItem = 0;
                    return false;
                }
            }
            base.goTo(base.currentItem, speed);
        },

        goTo : function (position, speed, drag) {
            var base = this,
                goToPixel;

            if (base.isTransition) {
                return false;
            }
            if (typeof base.options.beforeMove === "function") {
                base.options.beforeMove.apply(this, [base.$elem]);
            }
            if (position >= base.maximumItem) {
                position = base.maximumItem;
            } else if (position <= 0) {
                position = 0;
            }

            base.currentItem = base.owl.currentItem = position;
            if (base.options.transitionStyle !== false && drag !== "drag" && base.options.items === 1 && base.browser.support3d === true) {
                base.swapSpeed(0);
                if (base.browser.support3d === true) {
                    base.transition3d(base.positionsInArray[position]);
                } else {
                    base.css2slide(base.positionsInArray[position], 1);
                }
                base.afterGo();
                base.singleItemTransition();
                return false;
            }
            goToPixel = base.positionsInArray[position];

            if (base.browser.support3d === true) {
                base.isCss3Finish = false;

                if (speed === true) {
                    base.swapSpeed("paginationSpeed");
                    window.setTimeout(function () {
                        base.isCss3Finish = true;
                    }, base.options.paginationSpeed);

                } else if (speed === "rewind") {
                    base.swapSpeed(base.options.rewindSpeed);
                    window.setTimeout(function () {
                        base.isCss3Finish = true;
                    }, base.options.rewindSpeed);

                } else {
                    base.swapSpeed("slideSpeed");
                    window.setTimeout(function () {
                        base.isCss3Finish = true;
                    }, base.options.slideSpeed);
                }
                base.transition3d(goToPixel);
            } else {
                if (speed === true) {
                    base.css2slide(goToPixel, base.options.paginationSpeed);
                } else if (speed === "rewind") {
                    base.css2slide(goToPixel, base.options.rewindSpeed);
                } else {
                    base.css2slide(goToPixel, base.options.slideSpeed);
                }
            }
            base.afterGo();
        },

        jumpTo : function (position) {
            var base = this;
            if (typeof base.options.beforeMove === "function") {
                base.options.beforeMove.apply(this, [base.$elem]);
            }
            if (position >= base.maximumItem || position === -1) {
                position = base.maximumItem;
            } else if (position <= 0) {
                position = 0;
            }
            base.swapSpeed(0);
            if (base.browser.support3d === true) {
                base.transition3d(base.positionsInArray[position]);
            } else {
                base.css2slide(base.positionsInArray[position], 1);
            }
            base.currentItem = base.owl.currentItem = position;
            base.afterGo();
        },

        afterGo : function () {
            var base = this;

            base.prevArr.push(base.currentItem);
            base.prevItem = base.owl.prevItem = base.prevArr[base.prevArr.length - 2];
            base.prevArr.shift(0);

            if (base.prevItem !== base.currentItem) {
                base.checkPagination();
                base.checkNavigation();
                base.eachMoveUpdate();

                if (base.options.autoPlay !== false) {
                    base.checkAp();
                }
            }
            if (typeof base.options.afterMove === "function" && base.prevItem !== base.currentItem) {
                base.options.afterMove.apply(this, [base.$elem]);
            }
        },

        stop : function () {
            var base = this;
            base.apStatus = "stop";
            window.clearInterval(base.autoPlayInterval);
        },

        checkAp : function () {
            var base = this;
            if (base.apStatus !== "stop") {
                base.play();
            }
        },

        play : function () {
            var base = this;
            base.apStatus = "play";
            if (base.options.autoPlay === false) {
                return false;
            }
            window.clearInterval(base.autoPlayInterval);
            base.autoPlayInterval = window.setInterval(function () {
                base.next(true);
            }, base.options.autoPlay);
        },

        swapSpeed : function (action) {
            var base = this;
            if (action === "slideSpeed") {
                base.$owlWrapper.css(base.addCssSpeed(base.options.slideSpeed));
            } else if (action === "paginationSpeed") {
                base.$owlWrapper.css(base.addCssSpeed(base.options.paginationSpeed));
            } else if (typeof action !== "string") {
                base.$owlWrapper.css(base.addCssSpeed(action));
            }
        },

        addCssSpeed : function (speed) {
            return {
                "-webkit-transition": "all " + speed + "ms ease",
                "-moz-transition": "all " + speed + "ms ease",
                "-o-transition": "all " + speed + "ms ease",
                "transition": "all " + speed + "ms ease"
            };
        },

        removeTransition : function () {
            return {
                "-webkit-transition": "",
                "-moz-transition": "",
                "-o-transition": "",
                "transition": ""
            };
        },

        doTranslate : function (pixels) {
            return {
                "-webkit-transform": "translate3d(" + pixels + "px, 0px, 0px)",
                "-moz-transform": "translate3d(" + pixels + "px, 0px, 0px)",
                "-o-transform": "translate3d(" + pixels + "px, 0px, 0px)",
                "-ms-transform": "translate3d(" + pixels + "px, 0px, 0px)",
                "transform": "translate3d(" + pixels + "px, 0px,0px)"
            };
        },

        transition3d : function (value) {
            var base = this;
            base.$owlWrapper.css(base.doTranslate(value));
        },

        css2move : function (value) {
            var base = this;
            base.$owlWrapper.css({"left" : value});
        },

        css2slide : function (value, speed) {
            var base = this;

            base.isCssFinish = false;
            base.$owlWrapper.stop(true, true).animate({
                "left" : value
            }, {
                duration : speed || base.options.slideSpeed,
                complete : function () {
                    base.isCssFinish = true;
                }
            });
        },

        checkBrowser : function () {
            var base = this,
                translate3D = "translate3d(0px, 0px, 0px)",
                tempElem = document.createElement("div"),
                regex,
                asSupport,
                support3d,
                isTouch;

            tempElem.style.cssText = "  -moz-transform:" + translate3D +
                                  "; -ms-transform:"     + translate3D +
                                  "; -o-transform:"      + translate3D +
                                  "; -webkit-transform:" + translate3D +
                                  "; transform:"         + translate3D;
            regex = /translate3d\(0px, 0px, 0px\)/g;
            asSupport = tempElem.style.cssText.match(regex);
            support3d = (asSupport !== null && asSupport.length === 1);

            isTouch = "ontouchstart" in window || window.navigator.msMaxTouchPoints;

            base.browser = {
                "support3d" : support3d,
                "isTouch" : isTouch
            };
        },

        moveEvents : function () {
            var base = this;
            if (base.options.mouseDrag !== false || base.options.touchDrag !== false) {
                base.gestures();
                base.disabledEvents();
            }
        },

        eventTypes : function () {
            var base = this,
                types = ["s", "e", "x"];

            base.ev_types = {};

            if (base.options.mouseDrag === true && base.options.touchDrag === true) {
                types = [
                    "touchstart.owl mousedown.owl",
                    "touchmove.owl mousemove.owl",
                    "touchend.owl touchcancel.owl mouseup.owl"
                ];
            } else if (base.options.mouseDrag === false && base.options.touchDrag === true) {
                types = [
                    "touchstart.owl",
                    "touchmove.owl",
                    "touchend.owl touchcancel.owl"
                ];
            } else if (base.options.mouseDrag === true && base.options.touchDrag === false) {
                types = [
                    "mousedown.owl",
                    "mousemove.owl",
                    "mouseup.owl"
                ];
            }

            base.ev_types.start = types[0];
            base.ev_types.move = types[1];
            base.ev_types.end = types[2];
        },

        disabledEvents :  function () {
            var base = this;
            base.$elem.on("dragstart.owl", function (event) { event.preventDefault(); });
            base.$elem.on("mousedown.disableTextSelect", function (e) {
                return $(e.target).is('input, textarea, select, option');
            });
        },

        gestures : function () {
            /*jslint unparam: true*/
            var base = this,
                locals = {
                    offsetX : 0,
                    offsetY : 0,
                    baseElWidth : 0,
                    relativePos : 0,
                    position: null,
                    minSwipe : null,
                    maxSwipe: null,
                    sliding : null,
                    dargging: null,
                    targetElement : null
                };

            base.isCssFinish = true;

            function getTouches(event) {
                if (event.touches !== undefined) {
                    return {
                        x : event.touches[0].pageX,
                        y : event.touches[0].pageY
                    };
                }

                if (event.touches === undefined) {
                    if (event.pageX !== undefined) {
                        return {
                            x : event.pageX,
                            y : event.pageY
                        };
                    }
                    if (event.pageX === undefined) {
                        return {
                            x : event.clientX,
                            y : event.clientY
                        };
                    }
                }
            }

            function swapEvents(type) {
                if (type === "on") {
                    $(document).on(base.ev_types.move, dragMove);
                    $(document).on(base.ev_types.end, dragEnd);
                } else if (type === "off") {
                    $(document).off(base.ev_types.move);
                    $(document).off(base.ev_types.end);
                }
            }

            function dragStart(event) {
                var ev = event.originalEvent || event || window.event,
                    position;

                if (ev.which === 3) {
                    return false;
                }
                if (base.itemsAmount <= base.options.items) {
                    return;
                }
                if (base.isCssFinish === false && !base.options.dragBeforeAnimFinish) {
                    return false;
                }
                if (base.isCss3Finish === false && !base.options.dragBeforeAnimFinish) {
                    return false;
                }

                if (base.options.autoPlay !== false) {
                    window.clearInterval(base.autoPlayInterval);
                }

                if (base.browser.isTouch !== true && !base.$owlWrapper.hasClass("grabbing")) {
                    base.$owlWrapper.addClass("grabbing");
                }

                base.newPosX = 0;
                base.newRelativeX = 0;

                $(this).css(base.removeTransition());

                position = $(this).position();
                locals.relativePos = position.left;

                locals.offsetX = getTouches(ev).x - position.left;
                locals.offsetY = getTouches(ev).y - position.top;

                swapEvents("on");

                locals.sliding = false;
                locals.targetElement = ev.target || ev.srcElement;
            }

            function dragMove(event) {
                var ev = event.originalEvent || event || window.event,
                    minSwipe,
                    maxSwipe;

                base.newPosX = getTouches(ev).x - locals.offsetX;
                base.newPosY = getTouches(ev).y - locals.offsetY;
                base.newRelativeX = base.newPosX - locals.relativePos;

                if (typeof base.options.startDragging === "function" && locals.dragging !== true && base.newRelativeX !== 0) {
                    locals.dragging = true;
                    base.options.startDragging.apply(base, [base.$elem]);
                }

                if ((base.newRelativeX > 8 || base.newRelativeX < -8) && (base.browser.isTouch === true)) {
                    if (ev.preventDefault !== undefined) {
                        ev.preventDefault();
                    } else {
                        ev.returnValue = false;
                    }
                    locals.sliding = true;
                }

                if ((base.newPosY > 10 || base.newPosY < -10) && locals.sliding === false) {
                    $(document).off("touchmove.owl");
                }

                minSwipe = function () {
                    return base.newRelativeX / 5;
                };

                maxSwipe = function () {
                    return base.maximumPixels + base.newRelativeX / 5;
                };

                base.newPosX = Math.max(Math.min(base.newPosX, minSwipe()), maxSwipe());
                if (base.browser.support3d === true) {
                    base.transition3d(base.newPosX);
                } else {
                    base.css2move(base.newPosX);
                }
            }

            function dragEnd(event) {
                var ev = event.originalEvent || event || window.event,
                    newPosition,
                    handlers,
                    owlStopEvent;

                ev.target = ev.target || ev.srcElement;

                locals.dragging = false;

                if (base.browser.isTouch !== true) {
                    base.$owlWrapper.removeClass("grabbing");
                }

                if (base.newRelativeX < 0) {
                    base.dragDirection = base.owl.dragDirection = "left";
                } else {
                    base.dragDirection = base.owl.dragDirection = "right";
                }

                if (base.newRelativeX !== 0) {
                    newPosition = base.getNewPosition();
                    base.goTo(newPosition, false, "drag");
                    if (locals.targetElement === ev.target && base.browser.isTouch !== true) {
                        $(ev.target).on("click.disable", function (ev) {
                            ev.stopImmediatePropagation();
                            ev.stopPropagation();
                            ev.preventDefault();
                            $(ev.target).off("click.disable");
                        });
                        handlers = $._data(ev.target, "events").click;
                        owlStopEvent = handlers.pop();
                        handlers.splice(0, 0, owlStopEvent);
                    }
                }
                swapEvents("off");
            }
            base.$elem.on(base.ev_types.start, ".owl-wrapper", dragStart);
        },

        getNewPosition : function () {
            var base = this,
                newPosition = base.closestItem();

            if (newPosition > base.maximumItem) {
                base.currentItem = base.maximumItem;
                newPosition  = base.maximumItem;
            } else if (base.newPosX >= 0) {
                newPosition = 0;
                base.currentItem = 0;
            }
            return newPosition;
        },
        closestItem : function () {
            var base = this,
                array = base.options.scrollPerPage === true ? base.pagesInArray : base.positionsInArray,
                goal = base.newPosX,
                closest = null;

            $.each(array, function (i, v) {
                if (goal - (base.itemWidth / 20) > array[i + 1] && goal - (base.itemWidth / 20) < v && base.moveDirection() === "left") {
                    closest = v;
                    if (base.options.scrollPerPage === true) {
                        base.currentItem = $.inArray(closest, base.positionsInArray);
                    } else {
                        base.currentItem = i;
                    }
                } else if (goal + (base.itemWidth / 20) < v && goal + (base.itemWidth / 20) > (array[i + 1] || array[i] - base.itemWidth) && base.moveDirection() === "right") {
                    if (base.options.scrollPerPage === true) {
                        closest = array[i + 1] || array[array.length - 1];
                        base.currentItem = $.inArray(closest, base.positionsInArray);
                    } else {
                        closest = array[i + 1];
                        base.currentItem = i + 1;
                    }
                }
            });
            return base.currentItem;
        },

        moveDirection : function () {
            var base = this,
                direction;
            if (base.newRelativeX < 0) {
                direction = "right";
                base.playDirection = "next";
            } else {
                direction = "left";
                base.playDirection = "prev";
            }
            return direction;
        },

        customEvents : function () {
            /*jslint unparam: true*/
            var base = this;
            base.$elem.on("owl.next", function () {
                base.next();
            });
            base.$elem.on("owl.prev", function () {
                base.prev();
            });
            base.$elem.on("owl.play", function (event, speed) {
                base.options.autoPlay = speed;
                base.play();
                base.hoverStatus = "play";
            });
            base.$elem.on("owl.stop", function () {
                base.stop();
                base.hoverStatus = "stop";
            });
            base.$elem.on("owl.goTo", function (event, item) {
                base.goTo(item);
            });
            base.$elem.on("owl.jumpTo", function (event, item) {
                base.jumpTo(item);
            });
        },

        stopOnHover : function () {
            var base = this;
            if (base.options.stopOnHover === true && base.browser.isTouch !== true && base.options.autoPlay !== false) {
                base.$elem.on("mouseover", function () {
                    base.stop();
                });
                base.$elem.on("mouseout", function () {
                    if (base.hoverStatus !== "stop") {
                        base.play();
                    }
                });
            }
        },

        lazyLoad : function () {
            var base = this,
                i,
                $item,
                itemNumber,
                $lazyImg,
                follow;

            if (base.options.lazyLoad === false) {
                return false;
            }
            for (i = 0; i < base.itemsAmount; i += 1) {
                $item = $(base.$owlItems[i]);

                if ($item.data("owl-loaded") === "loaded") {
                    continue;
                }

                itemNumber = $item.data("owl-item");
                $lazyImg = $item.find(".lazyOwl");

                if (typeof $lazyImg.data("src") !== "string") {
                    $item.data("owl-loaded", "loaded");
                    continue;
                }
                if ($item.data("owl-loaded") === undefined) {
                    $lazyImg.hide();
                    $item.addClass("loading").data("owl-loaded", "checked");
                }
                if (base.options.lazyFollow === true) {
                    follow = itemNumber >= base.currentItem;
                } else {
                    follow = true;
                }
                if (follow && itemNumber < base.currentItem + base.options.items && $lazyImg.length) {
                    base.lazyPreload($item, $lazyImg);
                }
            }
        },

        lazyPreload : function ($item, $lazyImg) {
            var base = this,
                iterations = 0,
                isBackgroundImg;

            if ($lazyImg.prop("tagName") === "DIV") {
                $lazyImg.css("background-image", "url(" + $lazyImg.data("src") + ")");
                isBackgroundImg = true;
            } else {
                $lazyImg[0].src = $lazyImg.data("src");
            }

            function showImage() {
                $item.data("owl-loaded", "loaded").removeClass("loading");
                $lazyImg.removeAttr("data-src");
                if (base.options.lazyEffect === "fade") {
                    $lazyImg.fadeIn(400);
                } else {
                    $lazyImg.show();
                }
                if (typeof base.options.afterLazyLoad === "function") {
                    base.options.afterLazyLoad.apply(this, [base.$elem]);
                }
            }

            function checkLazyImage() {
                iterations += 1;
                if (base.completeImg($lazyImg.get(0)) || isBackgroundImg === true) {
                    showImage();
                } else if (iterations <= 100) {//if image loads in less than 10 seconds 
                    window.setTimeout(checkLazyImage, 100);
                } else {
                    showImage();
                }
            }

            checkLazyImage();
        },

        autoHeight : function () {
            var base = this,
                $currentimg = $(base.$owlItems[base.currentItem]).find("img"),
                iterations;

            function addHeight() {
                var $currentItem = $(base.$owlItems[base.currentItem]).height();
                base.wrapperOuter.css("height", $currentItem + "px");
                if (!base.wrapperOuter.hasClass("autoHeight")) {
                    window.setTimeout(function () {
                        base.wrapperOuter.addClass("autoHeight");
                    }, 0);
                }
            }

            function checkImage() {
                iterations += 1;
                if (base.completeImg($currentimg.get(0))) {
                    addHeight();
                } else if (iterations <= 100) { //if image loads in less than 10 seconds 
                    window.setTimeout(checkImage, 100);
                } else {
                    base.wrapperOuter.css("height", ""); //Else remove height attribute
                }
            }

            if ($currentimg.get(0) !== undefined) {
                iterations = 0;
                checkImage();
            } else {
                addHeight();
            }
        },

        completeImg : function (img) {
            var naturalWidthType;

            if (!img.complete) {
                return false;
            }
            naturalWidthType = typeof img.naturalWidth;
            if (naturalWidthType !== "undefined" && img.naturalWidth === 0) {
                return false;
            }
            return true;
        },

        onVisibleItems : function () {
            var base = this,
                i;

            if (base.options.addClassActive === true) {
                base.$owlItems.removeClass("active");
            }
            base.visibleItems = [];
            for (i = base.currentItem; i < base.currentItem + base.options.items; i += 1) {
                base.visibleItems.push(i);

                if (base.options.addClassActive === true) {
                    $(base.$owlItems[i]).addClass("active");
                }
            }
            base.owl.visibleItems = base.visibleItems;
        },

        transitionTypes : function (className) {
            var base = this;
            //Currently available: "fade", "backSlide", "goDown", "fadeUp"
            base.outClass = "owl-" + className + "-out";
            base.inClass = "owl-" + className + "-in";
        },

        singleItemTransition : function () {
            var base = this,
                outClass = base.outClass,
                inClass = base.inClass,
                $currentItem = base.$owlItems.eq(base.currentItem),
                $prevItem = base.$owlItems.eq(base.prevItem),
                prevPos = Math.abs(base.positionsInArray[base.currentItem]) + base.positionsInArray[base.prevItem],
                origin = Math.abs(base.positionsInArray[base.currentItem]) + base.itemWidth / 2,
                animEnd = 'webkitAnimationEnd oAnimationEnd MSAnimationEnd animationend';

            base.isTransition = true;

            base.$owlWrapper
                .addClass('owl-origin')
                .css({
                    "-webkit-transform-origin" : origin + "px",
                    "-moz-perspective-origin" : origin + "px",
                    "perspective-origin" : origin + "px"
                });
            function transStyles(prevPos) {
                return {
                    "position" : "relative",
                    "left" : prevPos + "px"
                };
            }

            $prevItem
                .css(transStyles(prevPos, 10))
                .addClass(outClass)
                .on(animEnd, function () {
                    base.endPrev = true;
                    $prevItem.off(animEnd);
                    base.clearTransStyle($prevItem, outClass);
                });

            $currentItem
                .addClass(inClass)
                .on(animEnd, function () {
                    base.endCurrent = true;
                    $currentItem.off(animEnd);
                    base.clearTransStyle($currentItem, inClass);
                });
        },

        clearTransStyle : function (item, classToRemove) {
            var base = this;
            item.css({
                "position" : "",
                "left" : ""
            }).removeClass(classToRemove);

            if (base.endPrev && base.endCurrent) {
                base.$owlWrapper.removeClass('owl-origin');
                base.endPrev = false;
                base.endCurrent = false;
                base.isTransition = false;
            }
        },

        owlStatus : function () {
            var base = this;
            base.owl = {
                "userOptions"   : base.userOptions,
                "baseElement"   : base.$elem,
                "userItems"     : base.$userItems,
                "owlItems"      : base.$owlItems,
                "currentItem"   : base.currentItem,
                "prevItem"      : base.prevItem,
                "visibleItems"  : base.visibleItems,
                "isTouch"       : base.browser.isTouch,
                "browser"       : base.browser,
                "dragDirection" : base.dragDirection
            };
        },

        clearEvents : function () {
            var base = this;
            base.$elem.off(".owl owl mousedown.disableTextSelect");
            $(document).off(".owl owl");
            $(window).off("resize", base.resizer);
        },

        unWrap : function () {
            var base = this;
            if (base.$elem.children().length !== 0) {
                base.$owlWrapper.unwrap();
                base.$userItems.unwrap().unwrap();
                if (base.owlControls) {
                    base.owlControls.remove();
                }
            }
            base.clearEvents();
            base.$elem
                .attr("style", base.$elem.data("owl-originalStyles") || "")
                .attr("class", base.$elem.data("owl-originalClasses"));
        },

        destroy : function () {
            var base = this;
            base.stop();
            window.clearInterval(base.checkVisible);
            base.unWrap();
            base.$elem.removeData();
        },

        reinit : function (newOptions) {
            var base = this,
                options = $.extend({}, base.userOptions, newOptions);
            base.unWrap();
            base.init(options, base.$elem);
        },

        addItem : function (htmlString, targetPosition) {
            var base = this,
                position;

            if (!htmlString) {return false; }

            if (base.$elem.children().length === 0) {
                base.$elem.append(htmlString);
                base.setVars();
                return false;
            }
            base.unWrap();
            if (targetPosition === undefined || targetPosition === -1) {
                position = -1;
            } else {
                position = targetPosition;
            }
            if (position >= base.$userItems.length || position === -1) {
                base.$userItems.eq(-1).after(htmlString);
            } else {
                base.$userItems.eq(position).before(htmlString);
            }

            base.setVars();
        },

        removeItem : function (targetPosition) {
            var base = this,
                position;

            if (base.$elem.children().length === 0) {
                return false;
            }
            if (targetPosition === undefined || targetPosition === -1) {
                position = -1;
            } else {
                position = targetPosition;
            }

            base.unWrap();
            base.$userItems.eq(position).remove();
            base.setVars();
        }

    };

    $.fn.owlCarousel = function (options) {
        return this.each(function () {
            if ($(this).data("owl-init") === true) {
                return false;
            }
            $(this).data("owl-init", true);
            var carousel = Object.create(Carousel);
            carousel.init(options, this);
            $.data(this, "owlCarousel", carousel);
        });
    };

    $.fn.owlCarousel.options = {

        items : 5,
        itemsCustom : false,
        itemsDesktop : [1199, 4],
        itemsDesktopSmall : [979, 3],
        itemsTablet : [768, 2],
        itemsTabletSmall : false,
        itemsMobile : [479, 1],
        singleItem : false,
        itemsScaleUp : false,

        slideSpeed : 200,
        paginationSpeed : 800,
        rewindSpeed : 1000,

        autoPlay : false,
        stopOnHover : false,

        navigation : false,
        navigationText : ["prev", "next"],
        rewindNav : true,
        scrollPerPage : false,

        pagination : true,
        paginationNumbers : false,

        responsive : true,
        responsiveRefreshRate : 200,
        responsiveBaseWidth : window,

        baseClass : "owl-carousel",
        theme : "owl-theme",

        lazyLoad : false,
        lazyFollow : true,
        lazyEffect : "fade",

        autoHeight : false,

        jsonPath : false,
        jsonSuccess : false,

        dragBeforeAnimFinish : true,
        mouseDrag : true,
        touchDrag : true,

        addClassActive : false,
        transitionStyle : false,

        beforeUpdate : false,
        afterUpdate : false,
        beforeInit : false,
        afterInit : false,
        beforeMove : false,
        afterMove : false,
        afterAction : false,
        startDragging : false,
        afterLazyLoad: false
    };
}(jQuery, window, document));;$(document).ready(function(){
	//auto size to screen
	var screenHeight = $(window).height();
	$(".welcomePage__background").css("height", screenHeight);

	$(window).resize(function() {
		var screenHeight = $(window).height();
		$(".welcomePage__background").css("height", screenHeight);
	});

	//RWD nav
	if ($(window).width() <= 991) {
		$(".navigation__menu .menu").wrap("<div class='hamburger'></div>");
	}
	$(window).resize(function() {
		if ($(window).width() <= 991 && $(".hamburger").length < 0) {
			$(".navigation__menu .menu").wrap("<div class='hamburger'></div>");
		}
	});

	$(".hamburger").click(function() {
		$(".hamburger .menu").slideToggle();
	});

	// slider carousel
	$("#owl-mySlider").owlCarousel({ 
		autoPlay: 3000,
		slideSpeed : 300,
		paginationSpeed : 400,
		singleItem: true,
	});

	//scrollTo
	$(".navigation__logo a").click(function() {
		var target = this.hash;
		$.smoothScroll({
          scrollTarget: target
        });
	});

	$(".navigation__menu .menu-link").click(function() {
		var target = this.hash;
		$.smoothScroll({
          scrollTarget: target,
          offset: -95
        });
	});

	//services show/hide banner	
	$(".services__banner").children().first().show();
	$(".list-item").click(function() {
		$idName = $(this).find(".ico").attr("id");
		$(".services__banner img").fadeOut("slow").finish();
		$(".services__banner").find("." + $idName).fadeIn("slow");
	});

	//colorBox popUp
	$(".gallery-item--popUp").colorbox({rel:'gallery-item--popUp'});	
});