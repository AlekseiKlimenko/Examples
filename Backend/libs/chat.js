var MessageModel = require(INCPATH + '/mongoose.js').MessageModel
	, log = 					require(INCPATH + '/log.js')(module)
	,Q = require('q');

function Chat(){
	require('events').EventEmitter.call(this);
};

Chat.prototype.getMessages = function (limit) {
	var deffered = Q.defer();
	var msgs = [];

	MessageModel
		.find()
		.limit(limit)
		.sort({_id:-1})
		.exec(function(err, list) {
			if (err) {
				console.log('Error getting messages');
				deffered.reject('Error getting messages');
				return deffered.promise;
			}
			list.reverse();
			msgs = msgs.concat(list);
			deffered.resolve(msgs);
			// console.log("msgs",msgs);
		});	
	return deffered.promise;
}

Chat.prototype.parseNick=function(message){
	
	['goo.gl', 'bit.ly', 'etc','csgofast.ru', 'csgfofast.com', 'csgoup.up', 'csgo.gl', 'csgo.as', 'luckerskins.ru', 'flashskins', 'csgocasinoo', 'csgo-fire.ru', 'cslots.ru', 'csgoduck.com', 'csgojoker.ru', 'oki91.ru', 'CSGOnest.RU', 'JOYSKINS.TOP', 'm9snik.com', 'm9snik-csgo.com', 'csgoin.com', 'itemgrad.com', 'РєСЃ РіРѕ Р°Рї', 'NINJACKPOT.COM', 'joyskins . top', 'JOYSKINS', 'CSGODICEGAME.COM', 'CSGOSELECTOR.RU', 'csgolou.com', 'http://skins-bat', 'CSBRO.RU', 'CSGAMBLING.RU', 'skinlord.ru', 'CSGO-MANIAC.com', 'csgo-rich.ru', 'CSGOHIDE.RU', 'CSGO-FATE.RU', 'csgodiamonds.com', 'CSGO4FUN.RU', 'CSGOPOT.COM', 'SKINOMAT.COM', 'CSGOComeback.com', 'CSGOSpeed.com', 'CSGOJoe.com', 'csgohouse.com', 'kickback.com', 'winaskin.com', 'opcrates.com', 'CSGOOFFLINE.COM', 'https://easydrop.ru/', 'easydrop.ru', 'CSgetto.com', 'csgoskins.net', 'VKCSGO.RU', 'CSGOTrophy.ru', 'CSGOLOU.COM', 'CSGOEASYSKIN.RU', 'csgoeasylot.com', 'itemup.ru', 'foxcs.ru', 'EVIL-BETS.RU', 'ITEAMGRAD.COM', 'csgofade.net', 'CSGO-FATE', 'http://su0.ru/4xqe', 'ONELEDAY.COM', 'CSGO-GOOSE.COM', 'csgo-gambler.com', 'CSGOW.RU', 'csgohot.com', 'csgoeasylot.com', 'CSFOX.RU', 'shurzgbets.com', 'CSGOTONY.COM','CSGO-HF.RU','CSGOFIRE.COM'].forEach(function(sw){
		var reg = new RegExp(sw, 'gi');
		if (reg.test(message)) {
			msg = msg.replace(reg,"eStars.tv");
			console.log(msg);
		}
	})
};

Chat.prototype.newMessage = function(msg,user){
	var deffered = Q.defer();
	var that = this;

	//create message time
	var createDate = new Date();
	var hours = createDate.getHours();
	var minutes = createDate.getMinutes();
	if (hours < 10) {
		hours = "0" + hours;
	}
	if (minutes < 10) {
		minutes = "0" + minutes;
	}
	createDate = hours + ":" + minutes;

	var url = msg.match(/http:\/\/csgotm.hqsale.com\/buy\/show\/[0-9]+/ig);

	if(url != null){
		url.forEach(function(msgItem){
			var id = msgItem.split('/');
			doApiCall('get_item_trade_name/' + id[id.length - 1],'get').then(function(req){
				var hrefItem = '<a href="'+ msgItem + '" >' + req + '</a>';
				msg = msg.replace(/http:\/\/csgotm.hqsale.com\/buy\/show\/[0-9]+/g,hrefItem);
				// that.parseNick(msg);
				var message = MessageModel({
					user: {
						steamId: user.steamid,
						chatname: user.personaname,
						profile: user.profileurl,
					},
					message: msg,
					createdAt : createDate
				});

				message.save(function(err){
				if (err) {
						log.error('Error in inserting to Mongo');
						deffered.reject('Error in inserting to Mongo');
						return deffered.promise;
						console.log(err);
						return;
					}
					deffered.resolve(message);
				});

			})
		})
	}else{
		// this.parseNick(msg);
		var message = MessageModel({
			user: {
				steamId: user.steamid,
				chatname: user.personaname,
				profile: user.profileurl,
			},
			message: msg,
			createdAt : createDate
		});

		message.save(function(err){
		if (err) {
				log.error('Error in inserting to Mongo');
				deffered.reject('Error in inserting to Mongo');
				return deffered.promise;
				console.log(err);
				return;
			}
			deffered.resolve(message);
		});
	}

	return deffered.promise;
}

Chat.prototype.removeMessage = function(msg){
	var deffered = Q.defer();
	MessageModel.findByIdAndRemove(msg, function(err, result){
		if (err) {
			console.log("error delete",err);
			deffered.reject("error delete")
			return deffered.promise;
		}
		else{
			deffered.resolve(result);
		}
		return deffered.promise;
	});
}
 
module.exports = Chat;