var SteamUser = 				require('steam-user')
	,TradeOfferManager = require('steam-tradeoffer-manager')
	, getSteamAPIKey = 			require('steam-web-api-key')
	, SteamConfirmations = 		require('steamcommunity-mobile-confirmations')
	, http = 					require('http')
	, xss = 					require('xss')
	, Q = 						require('q')
	, FifoArray = 				require('fifo-array')
	, fs = 						require('fs')

	, log = 					require(INCPATH + '/log.js')(module)
	, config = 					require(INCPATH + '/config.js')
	, utill = 					require(INCPATH + '/utill');

// Super-constructor with eventEmitter.
require('util').inherits(Bot, require('events').EventEmitter);
// require('util').inherits(BotManager, require('events').EventEmitter);

// ===================================================
// Auth party.
// ===================================================
var BotAuth = function(option) {
	var _getOption = function() {
		var deferred = Q.defer();
		if (!option.accountName) {
			log.error("!option.accountName");
			deferred.reject('Please fill account.option.accountName at config.json.');
			return deferred.promise;
		}
		if (!option.password) {
			log.error("!option.password");
			deferred.reject('Please fill account.option.password at config.json.');
			return deferred.promise;
		}

		// Detect preferred method of auth.
		if (option.ssfn && fs.existsSync(ABSPATH+'/'+option.ssfn)) {

			var sha = require('crypto').createHash('sha1');
			sha.update(fs.readFileSync(ABSPATH+'/'+option.ssfn));
			sha = new Buffer(sha.digest(), 'binary');

			option['shaSentryfile'] = sha;
			option['method'] = 'ssfn';

			deferred.resolve(option);
			return deferred.promise;

		} else if (fs.existsSync(ABSPATH+'/sentry')) {
			option['shaSentryfile'] = fs.readFileSync(ABSPATH+'/sentry');
			option['method'] = 'sentry';

			deferred.resolve(option);
			return deferred.promise;

		// @todo add variant 2fa, witch calculate two_factor on the first step

		} else {
			option['method'] = 'nothing';

			deferred.resolve(option);
			return deferred.promise;
		}
	};

	var init = function() {
		var deferredAuth = Q.defer()
			, that = this;

		_getOption.call(this).then(function(option){
			log.info('Auth: Preferred auth method ('+option.botSteamId+'): ' + option.method);
			// setSentry if exists
			if (option['shaSentryfile']) {
				that._steamClient.setSentry(option['shaSentryfile']);
			}

			// Start the logOn process.
			that._steamClient.logOn({
				"accountName" : option.accountName,
				"password" : option.password
			});

			// Email or App confirmation needed.
			that._steamClient.on('steamGuard', function(domain, callback, lastCodeWrong) {
				if (domain) {
					// ask for the email auth key
					var rl = require('readline').createInterface({
						"input": process.stdin,
						"output": process.stdout
					});

					rl.question('Steam Guard Code (from email ***@' + domain + ': ', function(emailCode) {
						rl.close();

						option['authCode'] = emailCode;

						callback(emailCode);
					});

				} else {
					// if there are no shared_secret - reject
					if (!option.shared_secret) {
						log.error('Auth: Startup failed! We have no shared_secret for this account.');
						deferredAuth.reject();
						return;
					}

					// generate app code via steam-totp
					if (lastCodeWrong) {
						log.debug('Auth: WAIT 15 sec before next try, because last code was wrong');
					}
					
					setTimeout(function(){
						var SteamTotp = require('steam-totp'),
							appCode = SteamTotp.generateAuthCode(option.shared_secret);
	
						log.debug("Auth: generated App code: " + appCode + ". Trying to relogin.");
						callback(appCode);
						
					}, (lastCodeWrong ? 15000 : 1));
				}
			});

			// All right, enableTwoFactor if needed.
			that._steamClient.on('loggedOn', function(details){
				log.info('Auth: logged on!');

				// enableTwoFactor, if previous logOn was with email confirmation
				if (option.autoEnable2FA && (option['authCode'] || (option['method'] == 'ssfn' && !option['shared_secret']))) {
					that._steamClient.enableTwoFactor(function(response){
						if (response.status != 1) {
							log.error('Auth: Enabling 2FA: error given');

						} else {
							log.debug('Auth: Enabling 2FA: ok, finalize');

							var promptSMS = function() {
								var rl = require('readline').createInterface({
									"input": process.stdin,
									"output": process.stdout
								});

								rl.question('SMS verification code:', function(smsCode) {
									rl.close();

									that._steamClient.finalizeTwoFactor(response.shared_secret, smsCode, function(err2faFin){
										if (err2faFin) {
											log.error('Auth: Enabling 2FA: finalize: ' + err2faFin);

											// retry
											if (err2faFin.message == "Invalid activation code") {
												promptSMS();
											}

										} else {
											log.info('Auth: Enabling 2FA: finalize: ok, save secrets to config');
											// save secrets to config
											config.set('account'+botID+':option:shared_secret', response.shared_secret);
											config.set('account'+botID+':option:identity_secret', response.identity_secret);
											config.set('account'+botID+':option:revocation_code', response.revocation_code);
											config.set('account'+botID+':option:device_id', response.serial_number);
											config.save(function(err){
												if (err) {
													log.error('Auth: Enabling 2FA: can\'t save secrets to config', err);
												}
											})
										}
									});
								});
							}

							// get SMS code from prompt
							promptSMS();
						}
					});
				
				// Go forward.
				} else {
					that._steamClient.once('webSession', function(sessionID, cookies) {
						// test

						that._steamClient.getSteamGuardDetails(function(enabled, enabledTime, machineTime, canTrade){
							log.info('Auth: SteamGuard INFO');
							log.debug(enabled, enabledTime, machineTime, canTrade)
						});
						getSteamAPIKey({
							sessionID: sessionID,
							webCookie: cookies

						}, function(err, APIKey) {
							if (err) {
								var url = "bot/set_status/" + option.botSteamId;
								doApiCall(url,"post",{status:"Can not get API key"}).then(function(obj){
									log.error('Auth: can\'t get API key – limited account (need to buy a game)', err);
								});

								deferredAuth.reject();
								return;
							}

							log.debug("Auth: Got API key: " + APIKey);
							log.info('Auth: ready!');
							that._confirmClient = new SteamConfirmations({
								    steamid:         option.botSteamId,
								    identity_secret: option.identity_secret,
								    device_id:       option.device_id,
								    webCookie:       cookies,
								});

							that._offersClient.setCookies(cookies, function(err) {
								if (err) {
									console.log(err);
									process.exit(1); // Fatal error since we couldn't get our API key
									var url = "bot/set_status/" + option.botSteamId;
										doApiCall(url,"post",{status:"Can not get API key"}).then(function(obj){
									});
									return;
								}
								console.log("Got API key: " + that._offersClient.apiKey);
							});
							deferredAuth.resolve();
						});
					});
				}
			});

		}, function(reason){
			var url = "bot/set_status/" + option.botSteamId;
			doApiCall(url,"post",{status:"Auth: Startup failed!"}).then(function(obj){
				log.error('Auth: Startup failed! ', reason);
			});
			deferredAuth.reject();
		});
		return deferredAuth.promise;
	};

	// @todo needed for re-weblogon, if session is expired
	var webLogOn = function() {
	};

	return {
		init : init,
		webLogOn : webLogOn
	}
};

// ===================================================
// Main party.
// ===================================================
function Bot(botID) {
	// Use EventEmitter
	require('events').EventEmitter.call(this);

	// Stuff.
	var _clientDebug = function(msg) {
		// too many flood in debug messages
		return false;

		log.debug('Steam says: ' + msg);
	};
	var _clientDissconect = function(err){
		var url = "bot/set_status/" + botID.botSteamId;
		doApiCall(url,"post",{status:"disconnected"}).then(function(obj){
			log.error('Dissconected:',err);
		});
	}
	var _clientError = function(err){
		
		// @TODO handler for SessionReplaced
		
		if (err.message == 'InvalidPassword') {
			this._status = 'ERROR';
			var url = "bot/set_status/" + botID.botSteamId;
			doApiCall(url,"post",{status:"frozen"}).then(function(obj){
				log.error('Auth: Invalid Password – account is frozen because of 2FA or need to change the account.');
			});
		} else {
			var url = "bot/set_status/" + botID.botSteamId;
			doApiCall(url,"post",{status:"error"}).then(function(obj){
				log.error(err);
			});
		}
	};

	var _offersDebug = function(msg) {
		log.debug('Steam-tradeoffers says: ' + msg);
	};

	// Private.
	this._inventory = [];
	this._id = botID.botSteamId;
	this._status = 'OFF';

	// Steam client
	this._steamClient = new SteamUser({
		"promptSteamGuardCode" : false,
		"dataDirectory" : ABSPATH + '/data'
	});

	this._steamClient.on('debug', _clientDebug);
	this._steamClient.on('error', _clientError.bind(this));
	// this._steamClient.on('disconnected',_clientDissconect.bind(this));

	// Steam trade-offers client
	var that = this;
	this._offersClient  = new TradeOfferManager({
    "steam": that._steamClient ,
    "language": "en"
	});

	this._offersClient.on('debug', _offersDebug);

	// Confirm client.
	this._confirmClient = null;

	// Let's go!
	// this.emit('init');
	var that = this;
	BotAuth(botID).init.call(this).then(function(){
		that._status = 'ON';
		that.emit('init');
	});
}
//=============Offer===============
Bot.prototype.listenOffers = function(){
	this._offersClient.on('sentOfferChanged',function(offer,oldState){
		log.info("New status traide!");
		var statusOffer = null;
		switch(offer.state){
			case 1 : statusOffer = "invalid";
			break;

			case 2 : statusOffer = "active";
			break;

			case 3 : statusOffer = "confirm";
			break;

			case 4 : statusOffer = "countered";
			break;

			case 5 : statusOffer = "expired";
			break;

			case 6 : statusOffer = "canceled";
			break;

			case 7 : statusOffer = "declined";
			break;

			case 8 : statusOffer = "invalidItems";
			break;

			case 9 : statusOffer = "createdNeedsConfirmation";
			break;

			case 10 : statusOffer = "canceledBySecondFactor";
			break;

			case 11 : statusOffer = "inEscrow";
			break;

			default : statusOffer = "Error offer"
		}

		var data ={
			trade_id : offer.id,
			status : statusOffer
		}
		doApiCall("trade/change_status","get",data).then(function(data){
		})
	});
};


Bot.prototype.makeOffer = function(userID,items,isSend) {
	var deffered = Q.defer();
	
	var that = this,
		offer = this._offersClient.createOffer(userID);

	//take away || send items on bot
	if(isSend == true){
		offer.addMyItems(items);
	}else{
		offer.addTheirItems(items);
	}

	offer.send(function (err, status) {
        if (err) {
            log.error("An error occurred sending the winnings bot trade offer. " + err);
            deffered.reject("error");
            return deffered.promise;

        } else if (status == 'pending') {
            log.warn('Email confirmation is enabled. You should disable.');
            that.acceptAllConfirmations();
            deffered.resolve(offer.id,200);
            return deffered.promise;
        } else {
            log.info('Winnings trade offer sent successfully');
            deffered.resolve(offer.id,200);
            return deffered.promise;
        }
       
	});
	 return deffered.promise;
};

// needed
Bot.prototype.acceptAllConfirmations = function() {
	var that = this;

	this._confirmClient.FetchConfirmations(function (err, confirmations){
		if (err) {
			log.warn('Fetching confirmations: ', err);
			return;
		}

		log.info('Fetching confirmations: received ' + confirmations.length + ' confirmations');
		if (!confirmations.length) {
			return;
		}

		confirmations.forEach(function(conf){
			that._confirmClient.AcceptConfirmation(conf, function(errAccept, result){
				if (err) {
					log.warn('Error while accepting confirmation for ', conf.descriptions[0]);
					return;
				}

				log.info('Confirmation accepted: ', result);
			});
		});
	});
};

// ===================================================
// BOT MANAGER
//====================================================
function BotManager() {
	require('events').EventEmitter.call(this);
};
BotManager.prototype.init = function(){
	var that = this,
		url = 'bot/get_started';

	doApiCall(url,"get").then(function(botList){
		if(!botList){
			return
		};
			that.initedBots = [];
			that._bots = {};

		JSON.parse(botList).forEach(function(botID){
			that._bots[botID] = that.startBot(botID);
			that.initedBots.push(botID);
		});
	});	
};

BotManager.prototype.instanceBySteamId = function(steamid) {
	for (var botID in this._bots) {
		var bot = this._bots[botID];
		if (bot.botSteamId == steamid) {
			return bot;
		}
	}

	return null;
};

BotManager.prototype.startBot = function(botID){
	var _bot = null;

		_bot = new Bot(botID);
		_bot.once('init', function(){
			//listen error and status offers
			_bot.listenOffers();
			var url = "bot/set_status/" + botID.botSteamId,
				data = {status:"start"};
			doApiCall(url,"post",data).then(function(obj){
				log.info('Bot #' + botID.botSteamId + ' initialised');
			})
		});

		return _bot;
};

BotManager.prototype.stopBot = function(botID){
	var statusBot = this.instanceBySteamId(botID);
	if(statusBot !== null){
		for(var i =0;i<_bots.length;i++){
			if(_bots[i].botID == botID){
				_bots[i].botID.logOff();
				_bots.splice(i,1);
				var url = "bot/set_status/" + botID,
					data = {status:"stop"};
				doApiCall(url,"post",data).then(function(obj){
					log.info('Bot #' + botID + ' stop');
			})
			}else{
				doApiCall(url,"post",{status:"Not bot"}).then(function(obj){
				})
			}
		}
	}	
};

BotManager.prototype.restartBot = function(steamIdBot){
	var restartBot = null;
	this.initedBots.forEach(function(bot){
		if(bot.botSteamId == steamIdBot){
			restartBot = bot;
		}
	})
	this.stopBot(steamIdBot);
	this.startBot(restartBot);
}

BotManager.prototype.makeOffer = function(botId,userID,items,isSend) {
	var deffered = Q.defer();
	var offerID = null;
	for (var botID in this._bots) {
		var bot = this._bots[botID];
		if (bot._id == botId) {
			bot.makeOffer(userID,items,isSend).then(function(offer){
				deffered.resolve(offer);
            	return deffered.promise;
			}).catch(function(error){
				log.error("error make offer",error);
				deffered.reject("error");

			});
		}
	
	}
	return deffered.promise;
};
// ================================================================================
// STEAMANALYST.COM PARTY
// ================================================================================
var _analystLastSync = null,
	_analystSyncPeriod = 10800000; // once an hour
	
var _analystSync = function() {
	if (_analystLastSync === null || (_analystLastSync + _analystSyncPeriod <= Date.now())) {	

		// Start the timer at first		
		_analystLastSync = Date.now();
		setTimeout(function(){
			_analystSync()
		}, _analystSyncPeriod);
		
		// Main logic
		(function(){
			var defer = Q.defer();
			
			var options = {
				hostname: 'api.csgo-auth.com'
				,path: '/price/all'
				,method: 'GET'
				,headers: { 'Content-Type': 'application/json' }
			};
	
			var req = http.request(options, function(res) {
				res.setEncoding('utf8');
				
				var data  = '';
				res.on('data', function (chunk) {
					data += chunk;
				});
				
				res.on('end', function(){
					defer.resolve(data);
				});
			});
			
			req.on('error', function(e){
				log.error('Steamanalyst error: ' + e.message);
				defer.reject();
			});
			
			req.end();
			
			return defer.promise;
		
		})().then(function(data){	
								
			// Parse JSON.
			try{
				data = JSON.parse(data);
				
				var saved = 0;
				for (var name in data) {
					var price = convertPrice(data[name]),
						rate = config.get('rate');
					price = price * rate;
					ItemManualModel.update({name: name}, { price : price }, {upsert: true}, function (err) {
						if (err !== null) {
							log.warn('Steamanalyst: DB save error (usd)');
						}
					});
					
					saved++;
				}
				
				log.info('Steamanalyst: %d items updated', saved);
				
			} catch(e) {
				log.error('Steamanalyst: can\'t parse JSON. Next ');
				log.debug(e);
			}
		});
	}
};

module.exports = BotManager;