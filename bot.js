if (process.env.NODE_ENV !== "production") {
	require("dotenv").config({ path: __dirname + "/.env" });
}

const Discord = require("discord.js");
const cfg = require("./config.json");
const ytdl = require("ytdl-core");

const client = new Discord.Client();
const queue = new Map();

client.once("ready", () => {
	console.log("Ready for action!");
});

client.once("reconnecting", () => {
	console.log("Brb, I'm reconnecting!");
});

client.once("disconnect", () => {
	console.log("Disconnecting!");
});

client.on("message", (message) => {

	// Palautetaan jos viesti ei ala configissa asetetulla prefixillä, on alle 2 merkkiä pitkä tai viestin lähettäjä on botti itse.
	if (!message.content.startsWith(cfg.prefix) || message.content.length < 2 || message.author.bot) return;

	// Pidetään vain prefixin jälkeinen osa viestistä ja jaetaan se komentoon ja komennon parametreihin
	const args = message.content.slice(cfg.prefix.length).split(/ +/);
	const cmd = args.shift().toLowerCase();

	const serverQueue = queue.get(message.guild.id);

	// Yksinkertainen komento, jolla voi tarkistaa onko botti päällä vai ei
	if (cmd === "ping") {
		message.channel.send("Pong!");
	}

	else if (cmd === "roll") {
		const roll = args[0] ? args.shift().toLowerCase() : "1d20";
		const match = roll.match(/^\s*(\d+)?\s*d\s*(\d+)\s*(.*?)\s*$/);

		if (!match) {
			message.channel.send("I'm not reaaallly sure what you're trying to do. Maybe try 2d8+4 instead? :)");
		}

		const amount = match[1] ? parseInt(match[1]) : 1,
			dice = match[2] ? parseInt(match[2]) : 20,
			results = [];

		let result,
			// eslint-disable-next-line no-unused-vars
			modifier = 0,
			modifiers;

		for (let i = 0; i < amount; i++) {
			if (dice !== 0) {
				result = Math.floor(Math.random() * dice + 1);
			}
			else {
				result = 0;
			}
			results.push(result);
		}

		if (match[3]) {
			modifiers = match[3].match(/([+-]\s*\d+)/g);
			for (let i = 0; i < modifiers.length; i++) {
				const num = parseInt(modifiers[i]);
				modifier += num;
				results.push(num);
			}
		}

		let finalResult = 0;
		for (let i = 0; i < results.length; i++) {
			finalResult += results[i];
		}

		const reply = "<@" + message.author.id + ">" +
			" is rolling **" +
			roll +
			"**. Result: **" +
			results.join("** + **") +
			"** = **" +
			finalResult +
			"**!";

		message.channel.send(reply);

	}

	else if (cmd === "play") {
		execute(message, serverQueue);
		return;
	}
	else if (cmd === "skip") {
		skip(message, serverQueue);
		return;
	}
	else if (cmd === "stop") {
		stop(message, serverQueue);
		return;
	}

	// Jos komentoa ei tunnisteta, palauttaa botti virheen. TODO: Arvo randomilla joku "hauska" lause.
	else {
		console.error("Command not recognized: " + cmd);
		message.channel.send(
			"I'm sorry, but I don't recognize that language. Is that some sort of Gnollish gibberish I'm too sophisticated to understand?",
		);
	}
});

// Tällä aloitetaan biisiensoitto
async function execute(message, serverQueue) {
	const args = message.content.split(/ +/).slice(1);

	// Käyttäjän pitää olla jollain voice-kanavalla, koska botti joinaa käyttäjän nykyiselle voice-kanavalle
	const voiceChannel = message.member.voice.channel;
	if (!voiceChannel) return message.reply("clear your ears first! You need to be able to hear me. Try joining a voice channel, maybe that helps.");

	// Botilla pitää olla oikeus puhua ja liittyä voice-kanaville
	const permissions = voiceChannel.permissionsFor(message.client.user);
	if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) return message.reply("You gotta let me speak first. Also are you sure I'm allowed to join your voice channel?");

	// Haetaan biisi youtubesta
	const songInfo = await ytdl.getInfo(args[0]);
	const song = {
		title: songInfo.title,
		url: songInfo.video_url,
	};

	// Biisijonon rakennus
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: message.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 1,
			playing: true,
		};

		queue.set(message.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			const connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(message.guild, queueConstruct.songs[0]);
		}

		catch (e) {
			console.log(e);
			queue.delete(message.guild.id);
			return message.channel.send(e);
		}
	}

	else {
		serverQueue.songs.push(song);
		return message.channel.send(`**${song.title}** has been added to the queue!`);
	}
}

// Skippaa nykyisen biisin, kunhan viestin lähettäjä on samalla voice
function skip(message, serverQueue) {
	if (!message.member.voice.channel) return message.reply("I can't hear you! Try joining the same voice channel with me.");
	if (!serverQueue) return message.reply("I'm not even playing anything!");
	serverQueue.connection.dispatcher.end();

	return message.reply("you got it, boss! Skipping this one.");
}

// Lopettaa biisien soiton, tyhjentää biisilistan ja lähtee voice-kanavalta
function stop(message, serverQueue) {
	if (!message.member.voice.channel) return message.reply("I can't hear you! Try joining the same voice channel with me.");
	if (!serverQueue) return message.reply("I'm not even playing anything!");

	serverQueue.songs = [];
	serverQueue.connection.dispatcher.end();

	return message.channel.send("Okay, okay, I'm stopping the music! The party is over.");
}

// Varsinainen biisinsoitto
function play(server, song) {
	const serverQueue = queue.get(server.id);
	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(server.id);
		return;
	}

	const dispatcher = serverQueue.connection
		.play(ytdl(song.url))
		.on("finish", () => {
			serverQueue.songs.shift();
			play(server, serverQueue.songs[0]);
		})
		.on("error", (error) => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
	serverQueue.textChannel.send(`This one's called: **${song.title}**`);
}

// Loggaa sisään Discordiin
client.login(process.env.DISCORD_TOKEN);
