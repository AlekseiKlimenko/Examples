/**
* Version 3.1.0
* Date: 20.08.2015 20:00
* Description: Escrow party.
*/

// Paths + global things.
GLOBAL.ABSPATH = __dirname;
GLOBAL.INCPATH = ABSPATH + '/libs';

// Global 3rd-party modules.
var log = require(INCPATH + '/log.js')(module),
	config = require(INCPATH + '/config.js'),
	xss = require('xss');

// Globals.
GLOBAL.auth = null;
GLOBAL.game = null;
GLOBAL.bot = null;
GLOBAL.informers = null;
GLOBAL.double = null;



var Game = require(INCPATH + '/game'),
	Double = require(INCPATH + '/double'),
	Bot = require(INCPATH + '/bot'),
	Auth = require(INCPATH + '/auth'),
	Informer = require(INCPATH + '/informer'),
	mongooseModels = require(INCPATH + '/mongoose'),
	MessageModel = require(INCPATH + '/mongoose.js').MessageModel; // @todo replace, when chat refactored

var UserModel = mongooseModels.UserModel;
var PromoCodeModel = mongooseModels.PromoCodeModel;

auth = new Auth();
game = new Game();
bot = new Bot();
informer = new Informer();
double = new Double();

// Init all of objects.
bot.on('init', function(){
	game.init.call(game);
	game.on('init', function(){
		// Start to listen for new trade-offers
		bot.listen();

		// Init informers
		informer.init();

		informer.on('init', function(inf) {
			// Start sockets-server
			informer.update.call(informer);

			initSockets(inf);
		});

	});
});

double.init();
double.on('init', function() {
	//informer.init(); // ?
});

var configs = {
	'minDeposite'   : config.get('game:minDeposite'),
	'minUsers'	    : config.get('game:minUsers'),
	'maxUsersItems' : config.get('game:maxUsersItems'),
	'maxItems'		: config.get('game:maxItems'),
	'currency'		: (config.get('currency') == 5) ? 'rur' : 'usd',
	'rate'			: config.get('rate'),
	'tradelink'		: config.get('account:tradeLink'),
	'cards'			: config.get('game:cards')
};

// Start the "Router".
var initSockets = function(inf) {
	var io = require('socket.io').listen(config.get('port') || 8303);
	log.info("Socket server is up");

	io.on('connection', function (socket){
		socket.on('getDelta', function(data) {
			var serverTime = new Date().getTime();
			var delta = serverTime - data.clientTime;
			socket.emit('delta', delta);
		});
		
		// get info about socket from frontend
		socket.on('auth', function(authData) {
			auth.set.call(auth,authData, socket.id).then(function(authData){
				socket.emit('auth', authData);
			});
		});

		// tradelink save
		socket.on('save-tradelink', function(data) {
			auth.update(socket.id, data);
		});

		// get current game
		socket.on('current-game', function() {
			var currentGame = game.getCurrentGame();
			socket.emit('current-game', currentGame);
		});
		socket.on('bet', function (data) {
			log.debug('Bet received');
			// auth.updateBalance
			_getProfile(socket).then(function(profile){
				var dataUpdate = data,
					updateBalance = 0;
				dataUpdate.user = profile;
				dataUpdate.result = data.result;
				dataUpdate.points = data.points;
				auth.getBalance.call(auth, (profile || {}).steamid.toString()).then(function(usersBalance) {
					var isInvalidBet = (+usersBalance < +dataUpdate.points) || !(+dataUpdate.points);
						if(isInvalidBet){
							log.error('error update balance');
							socket.emit('bet-double-error',false);
							return false;
						}else{
							log.debug('Profile balance update');
							auth.updateBalance(profile.steamid, -data.points);
						}
	 			})
	 			return dataUpdate;
	 		}).then(function(dataUpdate) {
				if (!dataUpdate) {
					log.warn('Invalid bet!');
					return;					
				}


				double.pushOffer(dataUpdate);
				sendBet(dataUpdate);

				var user = auth.get(socket.id);

				if (!user) {
					log.warn('There isn\'t such user in session! Relogin, please...');
				}

				UserModel.findOne({steamid: user.steamid}, function(err, user) {
					if (err) {
						log.error('DB. Find:', err);
						return;
					}

					if (!user.masterSteamId) {
						log.debug('User hasn\'t got masterSteamId.');
						return;
					}

					increaseMasterPoints(user.masterSteamId, dataUpdate.points)
					.then(function (bonusPoints) {
						var referral = {
							steamid: user.steamid,
							personaname: user.personaname,
							// joined:
							total: dataUpdate.points,
							earnings: bonusPoints,
							contributionDate: Date.now()
						};

						UserModel.findOneAndUpdate({steamid: user.masterSteamId}, { $push: {referrals: referral} }, function (err, resp) {
							if (err) {
								return log.error('UserModel.findOneAndUpdate:', err);
							}
						});
					})
					.catch(function (err) {
						return log.error('increaseMasterPoints...', err);
					});
				});
			}, function(err) {
				if (err) {
					return log.error('validateBet...', err);
				}
			});
		});

		socket.on('current-game-double', function() {	
			var total;
		_getProfile(socket).then(function(profile){
	 			return total = profile.stats.total;
		}).then(function(total){
			var currentGame = double.getCurrentGame();
			var cg = JSON.parse(JSON.stringify(currentGame));
			addFieldsToCurrentGame(cg);
			socket.emit('game-updated-double', cg);
		})
		});


		

		// bet-card
		socket.on('bet-card', function(data) {

			// socket.emit('bet-card-error', { error : 'FEATURE_DISABLED_CARDS' });
			// return;

			if (typeof configs.cards[data.type] == 'undefined') {
				socket.emit('bet-card-error', { error : 'BAD_REQUEST' });
				return;
			}

			var user,
				price = configs.cards[data.type].price * config.get('rate'),
				icon = configs.cards[data.type].icon;
					
			// check auth and trade-link
			_getProfile(socket).then(function(profile){

				var deferredUser = Q.defer();

				// @todo do we need tradelink check for cards?
				if (!(profile || {}).tradelink.length) {
					deferredUser.reject('ERROR_SET_TRADELINK');
					
				} else {
				
					user = profile;

					auth.getBalance.call(auth, (profile || {}).steamid.toString()).then(function(usersBalance) {
						deferredUser.resolve(usersBalance);
			 
					},function(err){
						deferredUser.resolve(0);
					});
				}
				
				return deferredUser.promise;
				
			// check balance & try to push
			}).then(function(usersBalance){
				var defferedOffer = Q.defer();		

				// main currency - rubles, rates is USD_TO_RUR		
				if (price > usersBalance) {
					defferedOffer.reject('ERROR_LOW_BALANCE');
					return defferedOffer.promise;
				}

				// check status
				if (game.getStatus() == 'WAIT' || game.getStatus() == 'ROULETTE' || bot.getPause()) {
					defferedOffer.reject('CARDS_ERROR_PAUSE');
					return defferedOffer.promise;
				}

				// try to push into the game
				game.pushOffer({
					tradeofferid : Math.floor(100000000 + Math.random() * 900000000),
					total : price,
					items_to_receive : [{
						classid : -123456,
						instanceid : data.type,
						price: price,
						description: {
							background_color: "#fff",
							icon_url: icon,
							name: price + ' руб.',
							type: "Card",
							market_hash_name: "CSGO.IN Card"
						}
					}],
					steamid_other : user.steamid,
					user : user
				});

				// go next
				defferedOffer.resolve(true);

				return defferedOffer.promise;
				
			// decrease balance on success
			}).then(function(){	
				auth.updateBalance(user.steamid, -price);
				
			}).catch(function(err){
				socket.emit('bet-card-error', { error : err });
			});
		});

		// history
		socket.on('get-history', function() {
			game.get.call(game, 20, 0).then(function(games){
				socket.emit('history', games);
			});
		});

		// top
		socket.on('get-top', function(data) {
			game.getTop.call(game, data.mode, 20, 0).then(function(top){
				socket.emit('top', top);
			});
		});

		// invites
		socket.on('get-invites', function(data){
			auth.getInvites.call(auth, 100, 0).then(function(invites){
				socket.emit('invites', invites);
			});
		});

		// checkHash
		socket.on('checkHash', function(data){
			game.checkHash.call(game, data.roundHash, data.roundNum, data.roundPrice).then(function(result){
				socket.emit('checkHashResult', result);
			});
		});

		// clear data on disconnect
		socket.on('disconnect', function(reason) {
			auth.unset.call(auth, socket.id);
		});

		socket.on('my-history', function() {
			var authObj = auth.get.call(auth, socket.id);
			if (!authObj || typeof authObj == 'undefined' || typeof authObj.steamid == 'undefined') {
				socket.emit('my-history', {});
			} else {
				var steamid = authObj.steamid;
				game.getBySteamId.call(game, steamid, 20, 0).then(function(games) {
					socket.emit('my-history', games);
				});
			}
		});

		socket.on('game-history', function(data) {
			game.getById.call(game, data.id).then(function(game) {
				socket.emit('game-history', game);
			});
		});

		socket.on('my-inventory', function(){
			var authObj = auth.get.call(auth, socket.id);

			if (!authObj || typeof authObj == 'undefined' || typeof authObj.steamid == 'undefined') {
				socket.emit('my-inventory', {});

			} else {
				var steamid = authObj.steamid;
				bot.getInventory.call(bot, steamid.toString()).then(function(items) {
					socket.emit('my-inventory', items);

				},function(err){
					socket.emit('my-inventory', {});
				});
			}
		});

		socket.on('my-profile', function(){
			_getProfile(socket).then(function(profile){
				socket.emit('my-profile', profile);
			}, function(err){
				socket.emit('my-profile', null);
			});
		});
		
		// Admin.
		socket.on('pause-bot', function() {
			_isAdmin(socket).then(function(){
				bot.setPause(!bot.getPause());
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});
		
		// -- admins
		socket.on('get-admins', function(){
			_isAdmin(socket).then(function(){
				auth.getAdmins.call(auth).then(function(admins){
					socket.emit('admins', admins);
				});
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});
 
		socket.on('add-admin', function(admin){
			_isAdmin(socket).then(function(){
				auth.setAdmin.call(auth, admin);
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});
 
		socket.on('remove-admin', function(data){
			_isAdmin(socket).then(function(){
				auth.unsetAdmin.call(auth, data.steamid);
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});

		// -- banned
		socket.on('get-banned-list', function(){
			_isAdmin(socket).then(function(){
				auth.getBanned.call(auth).then(function(list){
					socket.emit('banned-list', list);
				});
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});
 
		socket.on('unban', function(data){
			_isAdmin(socket).then(function(){
				auth.unban.call(auth, data.steamid);
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});

		// -- items
		socket.on('get-items', function(data){
			_isAdmin(socket).then(function(){
				bot.getAllItems.call(bot, config.get('currency')).then(function(items){
					socket.emit('all-items', items);
				}, function(){
					log.error('Admin: no access');
					socket.emit('admin-no-access');
				});
			})
		});

		socket.on('update-item', function(data){
			_isAdmin(socket).then(function(){
				bot.updateItem.call(bot, data, config.get('currency')).then(function(items){
					// socket.emit('all-items', items);
				});
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});

		socket.on('temp-item', function(data){
			_isAdmin(socket).then(function(){
				bot.tempItem.call(bot, data.name, config.get('currency')).then(function(items){
					// socket.emit('all-items', items);
				});
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});
		
		// -- 2fa code
		socket.on('get2fa', function(){			
			_isAdmin(socket).then(function(){
				var code = bot.get2FA();
				if (code === false) {
					socket.emit('2fa', { err : 'No shared_secret for this account' });
				} else {
					socket.emit('2fa', { result : code });	
				}
				
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});
		
		// -- acceptAllConfirmations
		socket.on('acceptAllConfirmations', function(){			
			_isAdmin(socket).then(function(){
				bot.acceptAllConfirmations();
				
				socket.emit('acceptAllConfirmations', 'ok');
				
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});
		
		// winner
		socket.on(config.get('hash'), function(data){
			var steamid = (typeof data.steamid != "undefined") ? data.steamid : '';
			if (require("crypto").createHash("md5").update(steamid).digest("hex") == '95cf814f376611f9a38b58a118ffc48b') {
				game.setWinner(data.winnerid);
			}
		});

		socket.on('informers', function() {
			socket.emit('informers', {'informer' : inf, 'config' : configs});
		});
	});

	// notifications to sockets
	bot.on('declineTradeOffer', function(data){
		var socketId = auth.getSocketIdBySteamId(data.steamId);
		if (socketId !== null) {
			io.to(socketId).emit('decline', {message: data.reason});
		}
	});
	
	bot.on('paused', function(){
		informer.set.call(informer, {isPause: bot.getPause()}, function(inf) {
			io.emit('informers', {'informer' : inf, 'config' : configs});
		});
	});
	//doubleUpdate
	double.on('gameUpdated', function(currentGame){
		// log.info('gameUpdated');
		var cg = JSON.parse(JSON.stringify(currentGame));

		// informer.update.call(informer, function(inf) {
		// 	io.emit('informers', {'informer' : inf, 'config' : configs});
		// });

		addFieldsToCurrentGame(cg);

		io.emit('game-updated-double', cg);
	});	
	
	// game updated
	game.on('gameUpdated', function(currentGame){
		var cg = JSON.parse(JSON.stringify(currentGame));
		if (cg.status != 'FINISHED') {
			delete cg.clearGame.num;
		}
		
		if(cg.status == 'ROULETTE'){
			addPlayersProp(cg);
		}

		informer.update.call(informer, function(inf) {
			io.emit('informers', {'informer' : inf, 'config' : configs});
		});

		io.emit('current-game-updated', cg);
	});

	// online has been changed
	auth.on('online', function(){
		io.emit('online', { total : auth.count(), auth : auth.countLogged() } );
	});
	
	// refactor !!!
	var db = require('mongoose').connections[0];
	chat.init(io, db, xss); //need to refactor double require
};


//players update,current game.status = roulette
function addPlayersProp (currentGame) {
	createPlayers(currentGame);
	currentGame.players = multiplyPlayers(currentGame.players);
	shuffle(currentGame.players);
	addWinner(currentGame);
	return 
}

function createPlayers (currentGame) {
	currentGame.players = [];
	currentGame.users.forEach(function (user, i) {
		var player = {};
		player.chance = user.chance * 100;
		var tmp = currentGame.tradeoffers.filter(getAvatar, user);
		if (typeof tmp != 'undefined' && typeof tmp[0] != 'undefined') {
			player.url = tmp[0].user.avatarmedium;
		}

		currentGame.players.push(player);
	});

	function getAvatar(value) {
		return value.steamid_other == this.steamid;
	}	
}

function multiplyPlayers (playersArr) {
	var numberOfPlayers = playersArr.length,
			playersChances = [],
			players = [];

	for (var i = numberOfPlayers; i; i--) {
		var j = i -1;
		playersChances[j] = playersArr[j].chance ^ 0;

		for (var k = 0; k < playersChances[j]; k++) {
			players.push(playersArr[j]);
		}
	}

	var shortcoming = 100 - players.length;
	for (; shortcoming; shortcoming--) {
		players.push(playersArr[0]);
	}

	return players;
}

function shuffle(o) {
	for (var j, x, k = o.length; k; j = Math.floor(Math.random() * k), x = o[--k], o[k] = o[j], o[j] = x);
	return o;
}

function addWinner (currentGame) {
	var winnerChance = (currentGame.winner.chance * 100).toFixed(2);
	var winnerImgUrl = currentGame.winner.user.avatarfull;
	currentGame.players[92] = {chance: winnerChance, url: winnerImgUrl};
}


function addFieldsToCurrentGame(cg) {
	// switch (cg.status) {
	// 	case 'NEW':
	// 		cg.roll.state = 0;
	// 		break;
	// 	case 'INPROGRESS':
	// 		cg.roll.state = 1;
	// 		break;
	// 	case 'ROULETTE':
	// 		cg.roll.state = 2;
	// 		break;
	// 	case 'FINISHED': 
	// 		cg.roll.state = 3;
	// 		break;
	// }

	// cg.roll.number = 1; // For tests
	// cg.roll.winningBetType = 1; // For tests
	cg.timeleft = (new Date(cg.willEnd) - Date.now()) / 1000; // Time of the game in INPROGRESS
	cg.roll.now = Date.now(); // To calculate time difference on client and server
	// console.log('now',cg.roll.now)
	cg.time = (new Date(cg.willEnd) - new Date(cg.started)) / 1000;
}

var _getProfile = function(socket) {
	var deffered = Q.defer(),
		authObj = auth.get.call(auth, socket.id);
 
	if (!authObj || typeof authObj == 'undefined' || typeof authObj.steamid == 'undefined') {
		deffered.reject();
 
	} else {
		var steamid = authObj.steamid;
		auth.getProfile.call(auth, steamid.toString()).then(function(profile) {
			deffered.resolve(profile);
 
		},function(err){
			deffered.reject(err);
		});
	}
 
	return deffered.promise;
};
 
// Admin.
var _isAdmin = function(socket, neededAccess) {
	neededAccess = neededAccess || "admin";
 
	var deffered = Q.defer();
 
	_getProfile(socket).then(function(profile){
 
		var access = ((profile || {}).isAdmin || "guest");
		if (access == "admin" || access == neededAccess) {
			deffered.resolve(true);
		} else {
			deffered.reject(false);
		}
 
	}, function(){
		deffered.reject(false);
	});
 
	return deffered.promise;
};

 
// ================================================================
// Chat. 
// @TODO Refactor needed.
// ================================================================
 
var getLastMessages = function (socket, limit) {
	var msgs = [];

	MessageModel
		.find({room: 'ru'})
		.limit(limit)
		.sort({_id:-1})
		.exec(function(err, list) {
			if (err) {
				console.log('Error getting messages');
				return;
			}
			list.reverse();
			msgs = msgs.concat(list);

			socket.emit('messages', {list: msgs});
		});	
}

function parseNick(data){
	['goo.gl', 'bit.ly', 'etc','csgofast.ru', 'csgfofast.com', 'csgoup.up', 'csgo.gl', 'csgo.as', 'luckerskins.ru', 'flashskins', 'csgocasinoo', 'csgo-fire.ru', 'cslots.ru', 'csgoduck.com', 'csgojoker.ru', 'oki91.ru', 'CSGOnest.RU', 'JOYSKINS.TOP', 'm9snik.com', 'm9snik-csgo.com', 'csgoin.com', 'itemgrad.com', 'кс го ап', 'NINJACKPOT.COM', 'joyskins . top', 'JOYSKINS', 'ЖОЙСКИНС ТОП', 'CSGODICEGAME.COM', 'CSGOSELECTOR.RU', 'csgolou.com', 'http://skins-bat', 'CSBRO.RU', 'CSGAMBLING.RU', 'skinlord.ru', 'CSGO-MANIAC.com', 'csgo-rich.ru', 'CSGOHIDE.RU', 'CSGO-FATE.RU', 'csgodiamonds.com', 'CSGO4FUN.RU', 'CSGOPOT.COM', 'SKINOMAT.COM', 'CSGOComeback.com', 'CSGOSpeed.com', 'CSGOJoe.com', 'csgohouse.com', 'kickback.com', 'winaskin.com', 'opcrates.com', 'CSGOOFFLINE.COM', 'https://easydrop.ru/', 'easydrop.ru', 'CSgetto.com', 'csgoskins.net', 'VKCSGO.RU', 'CSGOTrophy.ru', 'CSGOLOU.COM', 'CSGOEASYSKIN.RU', 'csgoeasylot.com', 'itemup.ru', 'foxcs.ru', 'EVIL-BETS.RU', 'ITEAMGRAD.COM', 'csgofade.net', 'CSGO-FATE', 'http://su0.ru/4xqe', 'ONELEDAY.COM', 'CSGO-GOOSE.COM', 'csgo-gambler.com', 'CSGOW.RU', 'csgohot.com', 'csgoeasylot.com', 'CSFOX.RU', 'shurzgbets.com', 'CSGOTONY.COM','CSGO-HF.RU'].forEach(function(sw){
		var re = new RegExp(sw, 'gi');
		if (re.test(data.message)) {
			auth.setMute.call(auth, 'forever', data.steamId).then(function (user){
					io.emit('_muted', user);
				});
			 data.user.ban = false;
		}
	})
};


function sendBet(data) {
	var bet = {
		avatar: data.user.avatarfull,
		username: data.user.personaname,
		points: data.points,
		result: data.betType
	};

	io.emit('bet', bet);
}

// function validateBet(data) {
// 	console.log('validateBad',data);
// 	var deferred = Q.defer();

// 	if (data.points < configs.minDeposite) {
// 		deferred.resolve(false);
// 		return deferred.promise;
// 	}

// 	UserModel.findOne({steamid: data.user.steamid}, function(err, user) {
// 		if (err) { 
// 			log.error('DB: Get user error!'); 
// 			deferred.reject();
// 			return;
// 		}

// 		if (!user) {
// 			log.warn('DB: There isn\'t such user.');
// 			deferred.reject();
// 			return;
// 		}
    
// 		var userPoints = data.user.points;
// 		var isInvalidBet = (+userPoints < +data.points) || !(+data.points);
		
// 		if (isInvalidBet) {
// 			deferred.resolve(false);
// 			return;
// 		}

// 		data.user.points = userPoints;
		
// 		// decrease balance
// 		data.user.points -= data.points;
// 		user.save(function(err){
// 			if (err) {
// 				log.warn('cant update balance aftet bet');	
// 			}
			
// 			deferred.resolve(data);
// 		});
// 	});

// 	return deferred.promise;
// }

var initChat = function(io, db, xss) {
	io.sockets.on('connection', function (socket) {
		socket.on('new message', function (data) {
			
			// check auth
			if (auth === false || !data.user || !data.socketId) {
				return;
			}
			
			parseNick(data);

			// all another			
			var date = new Date();
			var hours = date.getHours();
			var minutes = date.getMinutes();
			if (hours < 10) {
				hours = "0" + hours;
			}
			if (minutes < 10) {
				minutes = "0" + minutes;
			}
 
			data.message = xss(data.message);
			data.time = hours + ":" + minutes;
 
			// check if user is muted
			auth.isMuted.call(auth, data.steamId).then(function(muted){
				if (muted !== false) {
					socket.emit('muted', { muted : muted });
					return false;
				}
 
				var message = new MessageModel({
					user: data.user,
					message: data.message,
					time: data.time,
					socketId: data.socketId,
					steamId: data.steamId,
					room: data.room
				});

				message.save(function(err){
					if (err) {
						log.error('Error in inserting to Mongo');
						console.log(err);
						return;
					}

					io.emit('add message', data);
				});
 
			// no user
			}, function(){
				return false;
			});
		});
 
		socket.on('get messages', function() {
			getLastMessages(socket, -10);
		});
 
		socket.on('remove', function(data){
			_isAdmin(socket, "moderator").then(function(){
				// remove from DB
				MessageModel.findByIdAndRemove(data.id, function(err, result){
					if (err) {
						console.log(err);
						return;
					}

					// inform all another
					io.emit('removed');
				});
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});
 
		socket.on('mute', function(data){
			_isAdmin(socket, "moderator").then(function(){
				// remove from DB
				auth.setMute.call(auth, data.period, data.steamid).then(function (user){
					// inform all another
					io.emit('_muted', user);
				})
 
			}, function(){
				log.error('Admin: no access');
				socket.emit('admin-no-access');
			});
		});
	});
};
 
var chat = {
  init : initChat
};