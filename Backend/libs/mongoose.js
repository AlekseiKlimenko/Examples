var mongoose    = require('mongoose'),
	log         = require(INCPATH + '/log')(module),
	helper		= require(INCPATH + '/helper'),
	config		= require(INCPATH + '/config');
	Q           = require('q');

// Connection party.
mongoose.connect(config.get('db'));
var db = mongoose.connection;

db.on('error', function (err) {
    log.error('connection error:', err.message);
});
db.once('open', function callback () {
    log.info("Connected to DB!");
});

// Schemas.
var Schema = mongoose.Schema;

var User = new Schema({
	tradelink : { type : String, default : '' },
	steamid : { type : String, required : true },
	personaname : { type : String, required : true },
	realname : { type : String, required : true },
	avatar : { type : String, required : true },
	avatarmedium : { type : String, required : true },
	avatarfull : { type : String, required : true },
	profileurl : { type : String, required : true },
    created: { type: Date, default: Date.now },
    stats : {
    	played : { type : Number, default : 0 },
    	won : { type : Number, default : 0 },
    	total : { type : Number },//test default
    	lastGame : { type : Date },
    	weekly : { type : Schema.Types.Mixed },
    	monthly : { type : Schema.Types.Mixed },
    	daily : { type : Schema.Types.Mixed }
    },
    isAdmin : { type : String },
    muted : { type : Date },
    invited : { type : String },
    // points: {type: Number}, // "default: 10000" - For tests
});

// steamid is the ID of user WHO invites
var Invite = new Schema({
	inviter : {},
	user : {},
	bonus : { type : Number },
	created: { type: Date, default: Date.now },
	confirmed : { type : Boolean, default : false }
});

var UsersBalance = new Schema({
	steamid : { type : String, required : true },
	balance : { type : Number, default : 0 }
});

var Item = new Schema({
	name : { type : String, required : true, trim: true, unique : true, dropDups: true },
	price : {
		type : Number,
		required : true,
		set : function(num) {
			return num.toFixed(2)
		}
	},
	currency : { type : Number, required : true },
	createdAt: { type: Date, expires: 86400, default: Date.now },
	status : { type : String, default : 'temp' }
});

var ItemManual = new Schema({
	name : { type : String, required : true, trim: true, unique : true, dropDups: true },
	price : {
		type : Number,
		required : true,
		set : function(num) {
			return num.toFixed(2)
		}
	},
	currency : { type : Number, required : true },
	createdAt: { type : Date, default : Date.now },
	status : { type : String, default : 'manual' }
});

var GameItem = new Schema({
	price : {
		type : Number,
		set : function(num) {
			return num.toFixed(2)
		}
	},
	classid : { type : Number },
	instanceid : { type : Number },
	description : {
		icon_url : { type : String },
		name : { type : String, required : true },
		type : { type : String, required : true },
		description : { type : String },
		market_hash_name : { type : String, required : true },
		color : {
			type : String,
			set : function(item) {
				return helper.getColor(item).color;
			}
		},
		background_color : {
			type : String,
			set : function(item) {
				return helper.getColor(item).background_color;
			}
		}
	}
});

var GameTradeOffer = new Schema({
	id : { type : Number },
	items_to_receive : [ GameItem ],
	steamid_other : { type : String, required : true },
	user : {},
	result : {type : Number},
	total : {
		type : Number
	},
	points : {type : Number},
	total : {
		type : Number
	},
	fTicket : { type : Number },
	lTicket : { type : Number }
});

var gameDouble = new Schema({
	id : { type : Number },
	clearGame : {
		// number : { type : Number, required : true },
		// hash : { type : String, required : true },
		// rate : { type : Number, required : true }
		hash : { type : String }
	},
	created : { type: Date, default: Date.now },
	users : [{
		steamid : { type : String, required : true },
		chance : { type : Number, required : true, default : 0 },
		total : {
			type : Number,
			required : true,
			default : 0
		},
		itemsCnt : {
			type : Number,
			required : true,
			default : 0
		}
	}],
	tradeoffers : {
		type : [GameTradeOffer],
	},
	jackpot : {
		type : Number,
		default : 0,
		set : function(num) {
			return num.toFixed(2);
		}
	},
	status : {
		type : String,
		enum : [ 'NEW', 'INPROGRESS', 'ROULETTE', 'FINISHED' ],
		default : 'NEW',
		set : function(val) {
			if (val == this.status) {
				return val;
			}

			if (val == 'NEW') {
				this.roll.state = 0;
			}

			if (val == 'INPROGRESS') {
				this.started = new Date;
				this.willEnd = new Date(new Date().valueOf() + config.get('gameDouble:duration')*1000);
				this.roll.state = 1;
			
			} else if (val == 'WAIT') {
				this.waitUntil = new Date(new Date().valueOf() + config.get('gameDouble:wait')*1000);
			
			} else if (val == 'ROULETTE') {
				this.roulette = new Date(new Date().valueOf() + config.get('gameDouble:roulette')*1000);
				this.roll.state = 2;
			} else if (val == 'FINISHED') {
				this.roll.state = 3;
			}

			return val;
		}
	},
	started : { type : Date },
	willEnd : { type : Date },
	waitUntil : { type : Date },
	roulette : { type : Date },
	gameLength : { type : Number }, // Не надо писать в бд)
	waitLength : { type : Number },
	rouletteLength : { type : Number },
	winner : {
		type : Schema.Types.Mixed,
		set : function(winnerTicket) {
			var winner, that = this;

			this.tradeoffers.forEach(function(offer, key){
				if (offer.fTicket <= winnerTicket && winnerTicket <= offer.lTicket) {
					winner = {
						user : offer.user,
						ticket : winnerTicket
					}

					that.users.forEach(function(user){
						if (user.steamid == winner.user.steamid) {
							winner.chance = user.chance;
						}
					});
				}
			});

			return winner;
		}
	},
	prize : {
		status : {
			type : String,
			enum : [ 'PENDING', 'SENT', 'ERROR' ],
			default : 'PENDING'
		},
		attempts : {
			type : Number,
			default : 0,
			required : true,
			set : function(value) {
				if (value >= 5) {
					this.prize.status = 'ERROR';
				}

				return value;
			}
		}
	}, 
	// Fields for csgodouble
	last: Array,
	roll: {
		state: {type: Number, default: 0},
		number: {type: Number},
		winningBetType: Number,
		now: Date,
		wobble: Number
	},
	time: Number
}, {validateBeforeSave:false});

var Game = new Schema({
	id : { type : Number },
	clearGame : {
		number : { type : Number, required : true },
		hash : { type : String, required : true },
		rate : { type : Number, required : true }
	},
	created : { type: Date, default: Date.now },
	users : [{
		steamid : { type : String, required : true },
		chance : { type : Number, required : true, default : 0 },
		total : {
			type : Number,
			required : true,
			default : 0
		},
		itemsCnt : {
			type : Number,
			required : true,
			default : 0
		}
	}],
	items : [ {
		info : {
			type : [GameItem]
		},
		isComission : { type : Boolean, default : false },
		steamid : { type : String, required : true },
		id : { type : Number, default : 0 }
	} ],
	tradeoffers : {
		type : [GameTradeOffer],

		// @WARN this setter is ok, because our main behaviour is to push offers
		// and then to empty the array. if we would to add any slice, logic will crash
		set : function(val) {
			// calculate the jackpot + fill items property
			var newTradeoffers = [].concat(val).concat(this.tradeoffers),
				items = [],
				users = {},
				jackpot = 0;

			newTradeoffers.forEach(function(offer){
				// items
				offer.items_to_receive.forEach(function(item){
					items.push({
						info : item,
						steamid : offer.steamid_other
					});
				});

				// jackpot
				jackpot += offer.total;

				// user
				if (typeof users[offer.steamid_other] === "undefined") {
					users[offer.steamid_other] = {
						steamid : offer.steamid_other,
						total : 0,
						itemsCnt : 0
					}
				}
				users[offer.steamid_other].total += offer.total;
				users[offer.steamid_other].itemsCnt += offer.items_to_receive.length;
			});

			this.jackpot = jackpot;
			this.items = items;

			// update chance of each user
			this.users = [];
			for (var steamId in users) {
				users[steamId].chance = (users[steamId].total / jackpot).toFixed(4);
				this.users.push(users[steamId]);
			}

			// tickets for clearGame
			val[0].fTicket = (((jackpot - val[0].total) / config.get('rate'))*100 + 1).toFixed();
			val[0].lTicket = ((jackpot / config.get('rate'))*100).toFixed();

			return val;
		}
	},
	jackpot : {
		type : Number,
		default : 0,
		set : function(num) {
			return num.toFixed(2);
		}
	},
	status : {
		type : String,
		enum : [ 'NEW', 'INPROGRESS', 'WAIT', 'ROULETTE', 'FINISHED' ],
		default : 'NEW',
		set : function(val) {
			if (val == this.status) {
				return val;
			}

			if (val == 'INPROGRESS') {
				this.started = new Date;
				this.willEnd = new Date(new Date().valueOf() + config.get('game:duration')*1000);
			
			} else if (val == 'WAIT') {
				this.waitUntil = new Date(new Date().valueOf() + config.get('game:wait')*1000);
			
			} else if (val == 'ROULETTE') {
				this.roulette = new Date(new Date().valueOf() + config.get('game:roulette')*1000);
			}

			return val;
		}
	},
	started : { type : Date },
	willEnd : { type : Date },
	waitUntil : { type : Date },
	roulette : { type : Date },
	gameLength : { type : Number }, // Не надо писать в бд)
	waitLength : { type : Number },
	rouletteLength : { type : Number },
	winner : {
		type : Schema.Types.Mixed,
		set : function(winnerTicket) {
			var winner, that = this;

			this.tradeoffers.forEach(function(offer, key){
				if (offer.fTicket <= winnerTicket && winnerTicket <= offer.lTicket) {
					winner = {
						user : offer.user,
						ticket : winnerTicket
					}

					that.users.forEach(function(user){
						if (user.steamid == winner.user.steamid) {
							winner.chance = user.chance;
						}
					});
				}
			});

			return winner;
		}
	},
	prize : {
		status : {
			type : String,
			enum : [ 'PENDING', 'SENT', 'ERROR' ],
			default : 'PENDING'
		},
		attempts : {
			type : Number,
			default : 0,
			required : true,
			set : function(value) {
				if (value >= 5) {
					this.prize.status = 'ERROR';
				}

				return value;
			}
		}
	}

}, {validateBeforeSave:false});

var InformerSchema = new Schema({
	todayPlayers : { type : Number, default : 0 },
	todayItems : { type : Number, default : 0 },
	todayWon : { type : Number, default : 0 },
	todayMaxJackpot : { type : Number, default : 0 },
	todayGames : { type : Number, default : 0 },
	maxJackpot : { type : Number, default : 0 },
	isPause : { type : Boolean, default : false },
	lastWinner : {
        chance : { type : Number, default : 0 },
        ticket : { type : Number, default : 0 },
        jackpot : { type : Number, default : 0 },
        user : {
            profileurl : { type : String, default : ""},
            avatarfull : { type : String, default : ""},
            avatarmedium : { type : String, default : ""},
            realname : { type : String, default : ""},
            personaname : { type : String, default : ""},
            steamid: { type : String, default : ""},
            created: { type: Date, default: Date.now },
            tradelink: { type : String, default : ""}
        }
	}
});

InformerSchema.statics.createInstance = function () {
	var Informer = mongoose.model('Informer');
	var deferred = Q.defer();

	this
		.findOne()
		.exec(function(err, doc) {
			if (err) {
				log.warn('Get informer document error: ' + err);
				return deferred.reject(err);
			}

			if (typeof doc == 'undefined' || doc == null) {
				var doc = new Informer();
				doc.save();
				return deferred.resolve(doc);
			}
			return deferred.resolve(doc);
		});


	return deferred.promise;
};

var Message = new Schema({
	user: {},
	message: { type : String, required : true },
	createdAt: { type: Date, expires: 10800, default: Date.now },
	ban : { type : String },
	socketId: { type : String, required : true },
	steamId: { type : String, required : true },
	room: { type : String, required : true, enum : [ 'ru', 'en' ] }
});

module.exports.UserModel = mongoose.model('User', User);
module.exports.InviteModel = mongoose.model('Invite', Invite);
module.exports.UsersBalanceModel = mongoose.model('UsersBalance', UsersBalance);
module.exports.ItemModel = mongoose.model('Item', Item);
module.exports.ItemManualModel = mongoose.model('ItemManual', ItemManual);
module.exports.GameModel = mongoose.model('Game', Game);
module.exports.gameDoubleModel = mongoose.model('gameDouble', gameDouble);
module.exports.InformerModel = mongoose.model('Informer', InformerSchema);
module.exports.MessageModel = mongoose.model('Message', Message);