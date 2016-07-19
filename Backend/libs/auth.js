var log = require(INCPATH + '/log.js')(module),
	config = require(INCPATH + '/config.js'),
	Q = require('q'),
	xss = require('xss');

// Super-constructor with eventEmitter.
require('util').inherits(Auth, require('events').EventEmitter);

function Auth() {
	// Use EventEmitter
	require('events').EventEmitter.call(this);
};

var sessions = {};

Auth.prototype.set = function(auth, socketId) {
		var deferredUser = Q.defer();

	//validate user auth
	if(auth === null){
		sessions[socketId] = auth;
		deferredUser.resolve(auth);
	}else{
		doApiCall('verify_token',"post",{token:auth.token,user_id:auth.id}).then(function(user){
			if(user !== null){
				sessions[socketId] = auth;
				deferredUser.resolve(JSON.parse(user));
			}
		})
	}
	this.emit("online");
	return deferredUser.promise;
};

Auth.prototype.get = function(socketId) {
	return (sessions[socketId] || null);
}

Auth.prototype.getUserBySocket = function(socket){
	var deffered = Q.defer();

	var user = this.get(socket.id);
	if(user !== null){
		deffered.resolve(user);
	}else{
		deffered.reject("Not user")
		return deffered.promise;
	}
	return deffered.promise;
};



Auth.prototype.unset = function(socketId) {
	// delete the session
	delete sessions[socketId];
	// inform
	this.emit('online');
};

Auth.prototype.disconnect = function(socket){
	var user = this.get(socket.id),
		that = this;
	if(user === null){
		this.unset(socket.id);
		return;
	}
	if(sessions[socket.id].steamid == user.steamid){
		this.unset(socket.id);
	}else{
		doApiCall('logout/' + user.id,"get").then(function(user){
			that.emit('online');
		});
	}
}

Auth.prototype.count = function() {
	return Object.keys(sessions).length;
};

Auth.prototype.countLogged = function() {
	var logged = 0;
	for (var sId in sessions) {
		if (sessions[sId] !== null) {
			logged++;
		} 
	}

	return logged;
};

Auth.prototype.notify = function(steamIdUser,msg){
	var that = this;
	var deffered = Q.defer();
	var userSocket = function(){
		for(user in sessions){
			if(sessions[user].steamid == steamIdUser){
				deffered.resolve(user);
				break;
			}else{
				deffered.reject("error notify");
			}
		}
		return deffered.promise;
	}
	userSocket().then(function(resolve){
		that.emit("notify",msg,resolve);
	})
	
}
module.exports = Auth;