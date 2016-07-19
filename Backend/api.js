var express = require('express'),
	bodyParser = require('body-parser'),
	app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/bot/start', function(req, res){
	var statusBot = botManager.instanceBySteamId(req.body.bot.botSteamId);
	if(statusBot === null){
		botManager.startBot(req.body.bot);
		res.status(200);
		res.send('Starting bot id:' + req.body.bot.botSteamId);
	}
});

app.get('/bot/stop/', function(req, res){
	botManager.stopBot(req.query.steamid);
	res.status(200);
    res.send('stop bot id:' + req.query.steamid);
});

app.get('/bot/restart/', function(req, res){
	botManager.restartBot(req.query.steamid);
	res.status(200);
    res.send('restart bot id:' + req.query.steamid);
});

app.post('/trade/send',function(req,res){
	botManager.makeOffer(req.body.bot_id,req.body.steam_id,req.body.items,req.body.is_send).then(function(id){
		res.status(200);
		res.send(id);
	}).catch(function(error){
			res.status(500);
			res.send();
		});
});

app.post('/notification',function(req,res){
	auth.notify(req.body.userID,req.body.message);
		res.status(200);
		res.send();
});
 
app.listen(8000);