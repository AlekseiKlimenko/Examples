angular.module('gameApp').controller('mainCtrl', ['$scope', '$timeout', 'socketFactory', 'ngDialog', 'ngNotify', '$interval', '$translate', '$cookies', '$filter', 'balance', function($scope, $timeout, socketFactory, ngDialog, ngNotify, $interval, $translate, $cookies, $filter, balance){
	
	// ngNotify defaults
	ngNotify.config({
		theme: 'pure',
		position: 'top',
		duration: 4000,
		type: 'info',
		sticky: false,
		html: true
	});

	// Cookies for lang
	if ($cookies.lang) {
		$scope.lang = $cookies.lang;
		$translate.use($cookies.lang);
	} else {
		$scope.lang = 'ru';
	}
	$scope.currency = ($scope.lang == 'ru') ? 'СЂСѓР±.' : '$';
	$scope.rates = {
		'ru' : 1,
		'en' : 75
	};
	$scope.socket_cs = socketFactory.cs;

	// @todo reuse with currentGame
	$scope.winnerName = '???';
	$scope.winnerChance = '???';
	$scope.winnerJackpot = '0.00';

	$scope.delta = 0; // hardcode - server wrong time problem
	$scope.currentGame = {};
	$scope.timer = 0;
	$scope.show = true; //show main min menu on iphone 5s

	// SOUNDS
	$scope.sound = angular.isUndefined($cookies.soundOff);
	$scope.toggleSound = function(newSound) {
		$scope.sound = newSound;

		if (newSound === false) {
			$cookies.soundOff = 1;

		} else {
			delete $cookies.soundOff;
		}
	}
	
	var betSounds = [
			document.getElementById('bet-1')
			, document.getElementById('bet-2')
			, document.getElementById('bet-3')
		]
		, rouletteStartSounds = [
			document.getElementById('roulette-start-1')
			, document.getElementById('roulette-start-2')
			, document.getElementById('roulette-start-3')
		]
		, startGame = document.getElementById('start-game-sound')
		, timerTickQuiet = document.getElementById('timer-tick-quiet')
		, timerTickLast5Seconds = document.getElementById('timer-tick-last-5-seconds');
		
	// volumes
	startGame.volume = 0.4;
	timerTickQuiet.volume = 0.4;
	timerTickLast5Seconds.volume = 0.4;
	rouletteStartSounds.forEach(function(rs){
		rs.volume = 0.6;
	})

	function arrayRand(arr) {
		return arr[Math.floor(Math.random()*arr.length)];
	}

	// AUTH.
	$scope.auth = window.authInit;
	$scope.balance = 0;
	(function () {
		$scope.$watch(function () {
			return balance.get();

		}, function (newVal, oldVal) {
			if ( newVal !== oldVal ) {
				$scope.balance = newVal;
			}
		});
	}());

	// hardcode, better idea to get from backend
	$scope.getUserImg = function(steamid) {
		if ($scope.currentGame.tradeoffers.length == 0) {
			return false;
		}

		var avatar = '';
		angular.forEach($scope.currentGame.tradeoffers ,function(value, key) {
			if (value.steamid_other == steamid) {
				avatar = value.user.avatarfull;
				return;
			}
		});

		return avatar;
	}
	
	// MAIN FUNCTION.
	var _gameUpdated = function(data, init) {
		if (!init) {
			// play sound if tradeoffer's length changed
			if ((($scope.currentGame || {}).tradeoffers || []).length < data.tradeoffers.length && $scope.sound) {
				arrayRand(betSounds).play();
			}
		}
		
		$scope.currentGame = data;

		// winner data
		$scope.loggedUser = false;

		// function display enter game
		angular.forEach($scope.currentGame.tradeoffers ,function(value, key) {
			if ($scope.auth.steamid == value.steamid_other) {
				$scope.loggedUser = true;
			} 
		});

		if (data.status == 'NEW' ) {
			$scope.winnerName = '???';
			$scope.winnerChance = '???';
			$scope.winnerJackpot = '0.00';
			
			// play
			if ($scope.currentGame.users.length == 0 && $scope.sound) {
				startGame.play();
			}
		}

		if (data.status == 'INPROGRESS' ) {
			$scope.timer = Math.floor((Date.parse(data.willEnd) - (Date.now() + $scope.delta))/1000);
			if ($scope.timer < 0) {
				$scope.timer = 0;
			}
		}

		if (data.status == 'WAIT') {
			$scope.timer = Math.floor((Date.parse(data.waitUntil) - (Date.now() + $scope.delta))/1000);
			if ($scope.timer < 0) {
				$scope.timer = 0;
			}
		}

		if (data.status == 'FINISHED') {
			$scope.timer = 0;
			$scope.winnerName = data.winner.user.personaname;
			$scope.winnerChance = (data.winner.chance*100).toFixed(2) + '%';
			$scope.winnerJackpot = data.jackpot;
		}

		function getAvatar(value) {
			return value.steamid_other == this.steamid;
		}

		if (data.status == 'ROULETTE' ) {
			// SOUND ON THE START OF ROULETTE
			if ($scope.sound) {
				arrayRand(rouletteStartSounds).play();
			}
			
			$scope.timeOfRoulette = Math.floor((Date.parse($scope.currentGame.roulette) - (Date.now() + $scope.delta))/1000);
			$scope.players = data.players;
			$scope.winner = data.winner;
		}
	
		$scope.$apply();
	};
	
	// go-go
	$scope.socket_cs.on('connect', function () {

		$scope.localHash = window.location.hash;
		window.onhashchange = function(){
			$scope.localHash = window.location.hash;
			
		}
		
		
		console.log($scope.localHash);
		$scope.stateChatSize = function(){
			var chatMain = document.querySelector('.chat-main');
			console.log(chatMain.className);
			if(chatMain.className == 'chat-main chat-dropp'){
				chatMain.classList.remove('chat-dropp');
			}else{
				chatMain.classList.add('chat-dropp');
			}
 
			  
		}

		window.onscroll = function () {
			var scrollTopChat = window.document.body.scrollTop;
			var chat = document.querySelector('.chat-site');
			if(scrollTopChat > 365){
				chat.classList.add('fix-scroll');
			}else{
				chat.classList.remove('fix-scroll');
			}
			// console.log('scroll',window.document.body.scrollTop)
		}

		//menuMin for opening the first time at a rate window < 1080px
			if(window.innerWidth <= 1080){
					$scope.show = false;
				}else{
					$scope.show = true;
				}
			window.onresize = function(){
				if(window.innerWidth <= 1080){
					$scope.show = false;
				}else{
					$scope.show = true;
				}
				console.log(window.innerWidth)
			}
      
		// get delta
		var clientTime = new Date().getTime();
		$scope.socket_cs.emit('getDelta', {clientTime : clientTime});

		// get user steamId
		$scope.socket_cs.emit('auth', window.authInit);
		$scope.socket_cs.once('auth', function(authData){
			console.log("auth",authData);
			$scope.auth = authData;
			$scope.$digest();

			$scope.socket_cs.emit('current-game');	
		});

		$scope.socket_cs.emit('informers');
	});
	
	$scope.socket_cs.on('delta', function(delta) {
		$scope.delta = delta;
	}); 
	
	// online changed
	$scope.socket_cs.on('online', function(online){
		$scope.userOnline = 40+online.total;  
		$scope.userOnlineLogged = 40+online.auth;

		$scope.$digest();
	});
	
	// decline notification
	$scope.socket_cs.on('decline', function (data) {
		if (data.message == 'ERROR_SET_TRADELINK') {
			$scope.openTradeLinkPopup();
			return;
		}

		// try to translate
		$translate(data.message).then(function (message) {
			ngNotify.set( message, 'error');

		// if no translation found
		}, function (err) {
			ngNotify.set( data.message, 'error');
		});
	});
	
	$scope.socket_cs.on('current-game', function(data){
		_gameUpdated(data, true);
		console.log(data)
	});

	$scope.socket_cs.on('current-game-updated', function(data) {				
		_gameUpdated(data, false);
		console.log(data)
	});
	
	$scope.socket_cs.on('informers', function(data) {
		$scope.informer = data.informer;
		$scope.infConfig = data.config;
		
		if ($scope.currentGame.status != 'ROULETTE') {
			$scope.lastWinner = data.informer.lastWinner;	
		}
		
		$scope.currency = ($scope.lang == 'ru') ? 'СЂСѓР±.' : '$';
	});
	
	// timer tick sound
	$scope.$on('timer-tick', function (event, data){
		if (!$scope.sound || $scope.currentGame.status != 'INPROGRESS') {
			return;
		}
		
		if (data.millis <= 30000 && data.millis > 5000) {
			timerTickQuiet.play();
				
		} else if (data.millis <= 5000) {
			timerTickLast5Seconds.play();
		}
	});

	// save tradelink
	$scope.saveTradeLink = function() {
		var pattern = /https?:\/\/steamcommunity\.com\/tradeoffer\/new\/\?partner=(\d[^&]+)&token=(\w+)/g;
		if (!pattern.test($scope.auth.tradelink)) {
			ngNotify.set('РћС€РёР±РєР°! Р’РІРµРґРёС‚Рµ РЅРѕСЂРјР°Р»СЊРЅСѓСЋ СЃСЃС‹Р»РєСѓ Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰С‘ СЂР°Р·.', 'error');
		} else {
			$scope.socket_cs.emit('save-tradelink', { tradelink : $scope.auth.tradelink });
			ngNotify.set('РЎСЃС‹Р»РєР° СѓСЃРїРµС€РЅРѕ СЃРѕС…СЂР°РЅРµРЅР°! РќРµ Р·Р°Р±СѓРґСЊС‚Рµ РѕС‚РєСЂС‹С‚СЊ РёРЅРІРµРЅС‚Р°СЂСЊ С‡С‚РѕР±С‹ РїРѕР»СѓС‡РёС‚СЊ РІС‹РёРіСЂС‹С€.', 'success');
			$scope.openMakeDepositModal();
			ngDialog.closeAll();

		}
	};

	// deposit card
	$scope.depositCard = function(type) {
		// if custom value 
		// @todo

		// check if exists
		if (angular.isUndefined($scope.infConfig.cards[type])) {
			$translate('ERROR_BAD_REQUEST').then(function(message){
				ngNotify.set(message, 'error');

			}, function(err){
				ngNotify.set('Please try again later', 'error');
			});

			return;
		}

		var price = $scope.infConfig.cards[type].price;

		// check auth
		if (! $scope.auth) {
			$scope.authWarning = true;
			$scope.openAuthPopup();
			return;
		}

		// check trade-link
		if (!$scope.auth.tradelink) {
			$scope.openTradeLinkPopup();
			return;
		}

		// check balance on the front-end
		if (!balance.check(price * $scope.infConfig.rate)) {
			$scope.balanceWarning = true;
			$scope.openBalanceDepositPopup();

			return;
		}

		// check currentGame status
		if ($scope.currentGame.status == 'WAIT' || $scope.currentGame.status == 'ROULETTE' || $scope.currentGame.status == 'FINISHED' || $scope.informer.isPause) {

			$translate('CARDS_ERROR_PAUSE').then(function(message){
				ngNotify.set(message, 'error');

			}, function(err){
				ngNotify.set('Game is paused', 'error');
			});

			return;
		}

		// try to place a bet
		$scope.socket_cs.emit('bet-card', { type : type });

		$scope.socket_cs.on('bet-card-error', function(data){
			if (data.error == 'ERROR_LOW_BALANCE') {
				$scope.balanceWarning = true;
				$scope.openBalanceDepositPopup();

				return;
			}

			$translate(data.error).then(function(message){
				ngNotify.set(message, 'error');

			}, function(err){
				ngNotify.set(data.error, 'error');
			});
		});
	};
	
	$scope.changeLanguage = function (key) {
		$translate.use(key);
		$scope.lang = key;

		$cookies.lang = key;
		$scope.currency = ($scope.lang == 'ru') ? 'СЂСѓР±.' : '$';
	};

	$scope.hoverIn = function(){
	   this.hoverEdit = true;
	};

	$scope.hoverOut = function(){
		this.hoverEdit = false;
	};

	// ============================================================
	// POPUPS
	// ============================================================
	
	$scope.openMakeDepositModal = function() {
		// check pause
		if ($scope.informer.isPause) {
			// @todo show ngNotify
			return;
		}

		// check trade-link
		if (!$scope.auth.tradelink) {
			$scope.openTradeLinkPopup();
			if($scope.auth.tradelink){
				$scope.openMakeDepositModal()
			}
			return;
		}

		// make deposit
		ngDialog.open({
			template: '/templates/make-deposit.html',
			controller: 'makeDepositCtrl',
			data: $scope.infConfig,
			className: 'deposit',
			closeByDocument : true,
			showClose : true,
			closeByEscape : true,
		});
	};

	$scope.openBalanceDepositPopup = function () {
		ngDialog.open({
			template: '/templates/popups/balance-deposit.html',
			scope : $scope,
			closeByDocument : true,
			showClose : true,
			closeByEscape : true,
			preCloseCallback : function(){
				$scope.balanceWarning = false;
			}
		});
	};

	$scope.validBalanceDeposite = function(deposite,validDeposit){ 
	
		if(validDeposit.$valid){
			console.log("valid true");
			window.location.href = "/app/payment.php?action=pay&sum="+deposite
		}
	}

	$scope.openTradeLinkPopup = function() {
		ngDialog.open({
			template : '/templates/popups/trade-link.html',
			scope : $scope,
			closeByDocument : true,
			showClose : true,
			closeByEscape : true
		});
	};

	$scope.openAuthPopup = function() {
		ngDialog.open({
			template : '/templates/popups/auth.html',
			scope : $scope,
			closeByDocument : true,
			showClose : true,
			closeByEscape : true,
			preCloseCallback : function(){
				$scope.authWarning = false;
			}
		});
	};

	$scope.$on('ngDialog.opened', function (e, $dialog) {
		var el = document.getElementsByClassName('wrapper-main');
		angular.element(el).addClass('blur');
	});

	$scope.$on('ngDialog.closing', function (e, $dialog) {
		var el = document.getElementsByClassName('wrapper-main');
		angular.element(el).removeClass('blur');
	});
}]);