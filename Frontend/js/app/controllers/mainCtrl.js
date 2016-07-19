angular.module('gameApp').controller('mainCtrl', ['$scope','$rootScope','$timeout', 'socketFactory', 'ngDialog', 'ngNotify', '$interval', '$translate', '$cookies', '$filter', 'balance','activeBets','tryLuck','$routeParams', function($scope,$rootScope, $timeout, socketFactory, ngDialog, ngNotify, $interval, $translate, $cookies, $filter, balance, activeBets,tryLuck,$routeParams){
	
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
	$scope.currency = ($scope.lang == 'ru') ? 'руб.' : '$';
	$scope.rates = {
		'ru' : 1,
		'en' : 75 
	}; 
	$scope.socket_cs = socketFactory.cs;

	$interval(function(){
		activeBets.show().then(function(result){
			$scope.gamesRate = result;
		})
	}, 300);

	// @todo reuse with currentGame 
	$scope.winnerName = '???';
	$scope.winnerChance = '???';
	$scope.winnerJackpot = '0.00';

	//local jackpot title
	$rootScope.HASH = 'main';
	$rootScope.lo = function(hash){ 
		$rootScope.HASH = hash;
	}

	$scope.delta = 0; // hardcode - server wrong time problem
	$scope.currentGame = {}; 
	$scope.timer = 0;
	$scope.show = true; //show main min menu on iphone 5s

	// SOUNDS
	$rootScope.sound = angular.isUndefined($cookies.soundOff);
	$scope.toggleSound = function(newSound) {
		$rootScope.sound = newSound;

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
	$rootScope.balance = 0;
	(function () {
		$rootScope.$watch(function () {
			return balance.get();

		}, function (newVal, oldVal) {
			if ( newVal !== oldVal ) {
				$rootScope.balance = newVal;
			}
		});
	}());


	$scope.socket_cs.emit('get-history');
	$scope.socket_cs.on('history', function(data) {
		$scope.lastGame = data[0];
		$scope.$digest();
	});

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
	var onSoundNewGame = true;
	var _gameUpdated = function(data, init) {
		if (!init) {
			// play sound if tradeoffer's length changed
			if ((($scope.currentGame || {}).tradeoffers || []).length < data.tradeoffers.length && $rootScope.sound) {
				arrayRand(betSounds).play();
			}
		}
		
		$scope.currentGame = data;
		$scope.rouletteRate = data.tradeoffers[data.tradeoffers.length-1];

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
			if ($scope.currentGame.users.length == 0 && $rootScope.sound && onSoundNewGame == true) {
				startGame.play();
				onSoundNewGame = false;
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
			onSoundNewGame = true;
		}

		function getAvatar(value) {
			return value.steamid_other == this.steamid;
		}

		if (data.status == 'ROULETTE' ) {
			// SOUND ON THE START OF ROULETTE
			if ($rootScope.sound) {
				arrayRand(rouletteStartSounds).play();
			}
			
			$scope.timeOfRoulette = Math.floor((Date.parse($scope.currentGame.roulette) - (Date.now() + $scope.delta))/1000);
			$scope.players = data.players;
					}
	
		$scope.$apply();
	};
	
	// go-go
	$scope.socket_cs.on('connect', function () {
		window.onhashchange = function(){
			$scope.localHash = window.location.hash;
		}
	
		$scope.stateChatSize = function(){
			var chatMain = document.querySelector('.chat-main');
			if(chatMain.className == 'chat-main chat-dropp'){
				chatMain.classList.remove('chat-dropp');
			}else{
				chatMain.classList.add('chat-dropp');
			}	  
		}

		window.onscroll = function () {
			var scrollTopChat = window.document.body.scrollTop;
			var chat = document.querySelector('.chat-site');
			if (chat === null) {
				return;
			}

			if(scrollTopChat > 365){
				chat.classList.add('fix-scroll');
			}else{
				chat.classList.remove('fix-scroll');
			}
		}

		// @todo menuMin for opening the first time at a rate window < 1080px
		if (window.innerWidth <= 1080){
			$scope.show = false;
		} else {
			$scope.show = true;
		}

		window.onresize = function(){
			if (window.innerWidth <= 1080){
				$scope.show = false;
			} else {
				$scope.show = true;
			}
		}
      
		// get delta
		var clientTime = new Date().getTime();
		$scope.socket_cs.emit('getDelta', {clientTime : clientTime});

		// get user steamId
		$scope.socket_cs.emit('auth', window.authInit);
		$scope.socket_cs.once('auth', function(authInit){
			$scope.auth = authInit;
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
		$scope.userOnline = online.total;  
		$scope.userOnlineLogged = online.auth;

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

	$scope.socket_cs.on('processingTradeOffer', function (data) {
		// try to translate
		$translate(data.message).then(function (message) {
			ngNotify.set( message + data.tradeOfferId, 'success');

		// if no translation found
		}, function (err) {
			ngNotify.set( data.message + data.tradeOfferId, 'success');
		});
	});
	
	$scope.socket_cs.on('current-game', function(data){
		_gameUpdated(data, true);
	});

	$scope.socket_cs.on('current-game-updated', function(data) {			
		_gameUpdated(data, false);
	});
	
	$scope.socket_cs.on('informers', function(data) {
		$scope.informer = data.informer;
		$scope.infConfig = data.config;
		$rootScope.isPauseModeBot = data.isPauseModeBot;
		
		if ($scope.currentGame.status != 'ROULETTE') {
			$scope.lastWinner = data.informer.lastWinner;	
		}
		
		$scope.currency = ($scope.lang == 'ru') ? 'руб.' : '$';
	});
	
	// timer tick sound
	$scope.$on('timer-tick', function (event, data){
		if (!$rootScope.sound || $scope.currentGame.status != 'INPROGRESS') {
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
			ngNotify.set('Ошибка! Введите нормальную ссылку и попробуйте ещё раз.', 'error');
		} else {
			$scope.socket_cs.emit('save-tradelink', { tradelink : $scope.auth.tradelink });
			ngNotify.set('Ссылка успешно сохранена! Не забудьте открыть инвентарь чтобы получить выигрыш.', 'success');
			$scope.openMakeDepositModal();
			ngDialog.closeAll();

		}
	};
	
	$scope.changeLanguage = function (key) {
		$translate.use(key);
		$scope.lang = key;

		$cookies.lang = key;
		$scope.currency = ($scope.lang == 'ru') ? 'руб.' : '$';
	};

	$scope.hoverIn = function(){
	   this.hoverEdit = true;
	};

	$scope.hoverOut = function(){
		this.hoverEdit = false;
	};


	//active menu roullete double and main
	$rootScope.locationActiveRoulette = function(hash){
		var arrayHash = [
			{hash : '#/'},
			{hash : '#/double'},
			{hash : '#/raffles'}
		];
		arrayHash.forEach(function(actionHash){
			if(hash == actionHash.hash){
				$rootScope.localActiveMenu = actionHash.hash;
			}else{
				$rootScope.localActiveMenu = hash;
				
			}
		})
	};

	$rootScope.$watch(
		function(){
			return window.location.hash;	
		},
		function(newVal, oldVal){
			$scope.closeChatDeposite = newVal;
			if(newVal != oldVal || newVal == '#/' || newVal == '#/double'){
				$rootScope.locationActiveRoulette(newVal)
			}
		}
	);

	// ============================================================
	// POPUPS
	// ============================================================
	
	$scope.checkTradelink = function() {
		// check pause
		if ($scope.informer.isPause) {
			// @todo show ngNotify
			return false;
		}

		// check trade-link
		if (!$scope.auth.tradelink) {
			$scope.openTradeLinkPopup();
			return false;
		}

		return true;
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