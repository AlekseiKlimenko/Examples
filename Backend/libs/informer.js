var crypto = require('crypto'),
	log = require(INCPATH + '/log.js')(module),
	config = require(INCPATH + '/config.js'),
	UserModel = require(INCPATH + '/mongoose.js').UserModel,
	GameModel = require(INCPATH + '/mongoose.js').GameModel,
	InformerModel = require(INCPATH + '/mongoose.js').InformerModel,
	helper = require(INCPATH + '/helper.js'),
	Q = require('q');

// Super-constructor with eventEmitter.
require('util').inherits(Informer, require('events').EventEmitter);


function Informer() {
	// Use EventEmitter
	require('events').EventEmitter.call(this);
};

Informer.prototype.init = function() {
	// Save the context.
	var that = this;

	this.informer = {};

	InformerModel.createInstance().done(function(informer) {
		that.informer = informer;
		that.emit('init', informer);
	});

};

Informer.prototype.set = function(obj, callback) {
	var that = this;
	//here go save
	for(var prop in obj) {
		if (typeof that.informer[prop] == 'undefined') {
			log.warn('Property "' + prop + '" doesn t exists in Informer model.')
			continue;
		}

		that.informer[prop] = obj[prop];
	}

	callback(that.informer);

	that.informer.save();
};

Informer.prototype.get = function() {
	return this.informer;
};

Informer.prototype.save = function() {
	this.informer.save();
};

Informer.prototype.update = function(callback) {
	var that = this;

	that._getData(function(error, informers){
		// send informers
		that.set(informers, callback);
	});
};

Informer.prototype.delete = function() {
	InformerModel.find().remove().exec();
	this.informer = {};
};

Informer.prototype._getData = function(callback) {
	var promises = [];

	// max jackpot==
	var maxJackpotDefer = Q.defer();
	
	GameModel
		.findOne()
  		.sort('-jackpot')
		.exec(function(err, doc) {
			if (err) {
				log.warn('Get history err: ' + err);
				return maxJackpotDefer.reject(err);
			}

			if (doc == null) {
				return maxJackpotDefer.resolve({key:'maxJackpot', val:0});
			}


			return maxJackpotDefer.resolve({key:'maxJackpot', val:doc.jackpot});
		});

	promises.push(maxJackpotDefer.promise);

	var maxJackpotTodayDefer = Q.defer();

	var today = helper.getToday();

	GameModel
		.findOne({created : {$gt : today}})
		.sort('-jackpot')
		.exec(function(err, doc) {
			if (err) {
				log.warn('Get history err: ' + err);
				return maxJackpotTodayDefer.reject(err);
			}

			if (doc == null) {
				return maxJackpotTodayDefer.resolve({key:'todayMaxJackpot', val:0});
			}

			return maxJackpotTodayDefer.resolve({key:'todayMaxJackpot', val:doc.jackpot});
		});

	promises.push(maxJackpotTodayDefer.promise);

	var lastWinnerDefer = Q.defer();

	GameModel
		.findOne()
		.sort('-created')
		.exec(function(err, doc) {
			if (err) {
				log.warn('Get history err: ' + err);
				return lastWinnerDefer.reject(err);
			}

			if (doc == null || doc.winner == undefined) {
				return lastWinnerDefer.resolve({key:'lastWinner', val:{}});
			}
			var tmp = doc.winner;
			tmp.jackpot = doc.jackpot;
			return lastWinnerDefer.resolve({key:'lastWinner', val:tmp});
		});

	promises.push(lastWinnerDefer.promise);

	var todayGamesDefer = Q.defer();

	GameModel
		.count({created : {$gt : today}})
		.exec(function(err, count) {
			if (err) {
				log.warn('Get history err: ' + err);
				return todayGamesDefer.reject(err);
			}

			if (count == null) {
				return todayGamesDefer.resolve({key:'todayGames', val: 0});
			}

			return todayGamesDefer.resolve({key:'todayGames', val: count});
		});

	promises.push(todayGamesDefer.promise);

	var todayPlayersDefer = Q.defer();

	UserModel
		.count({"stats.lastGame" : {$gt : today}})
		.exec(function(err, count) {
			if (err) {
				log.warn('Get history err: ' + err);
				return todayPlayersDefer.reject(err);
			}

			if (count == null) {
				return todayPlayersDefer.resolve({key:'todayPlayers', val: 0});
			}

			return todayPlayersDefer.resolve({key:'todayPlayers', val: count});
		});

	promises.push(todayPlayersDefer.promise);

	var todayWonDefer = Q.defer();

	GameModel
		.aggregate(
			{
			  '$match' : { 'created' : { '$gt' : today } }
			},
		    { $group: {
		    	_id : null,
		        total:   { $sum: "$jackpot" },
		    }})
		.exec(function(err, result) {
			if (err) {
				log.warn('Get history err: ' + err);
				return todayWonDefer.reject(err);
			}

			if (typeof result == 'undefined' || result == null || typeof result[0] == 'undefined' || typeof result[0].total == 'undefined') {
				return todayWonDefer.resolve({key:'todayWon', val: 0});
			}

			return todayWonDefer.resolve({key:'todayWon', val: result[0].total});
		});

	promises.push(todayWonDefer.promise);

	var todayItemsDefer = Q.defer();
	GameModel
		.aggregate(
			{
				'$match' : { 'created' : { '$gt' : today } }
			},
		    { $group: {
		    	_id : null,
		        total:   { $sum : {$size : "$items"}},
		    }})
		.exec(function(err, result) {
			if (err) {
				log.warn('Get history err: ' + err);
				return todayItemsDefer.reject(err);
			}

			if (typeof result == 'undefined' || result == null || typeof result[0] == 'undefined' || typeof result[0].total == 'undefined') {
				return todayItemsDefer.resolve({key:'todayItems', val: 0});
			}

			return todayItemsDefer.resolve({key:'todayItems', val: result[0].total});
		});

	promises.push(todayItemsDefer.promise);
	
	Q.all(promises).spread(function(obj1, obj2, obj3, obj4, obj5, obj6, obj7) {
		var counters = {};

		Array.prototype.slice.call(arguments).forEach(function(arg) {
			counters[arg.key] = arg.val;
		});

		callback(false, counters);

	}, function(error) {
		callback(error);
	});
};


module.exports = Informer;