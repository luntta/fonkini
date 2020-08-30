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

		const reply = `<@${message.author.id}> is rolling **${roll}**. Result: **${results.join("** + **")}** = ** ${finalResult}**!`;

		message.channel.send(reply);

	}

	// Jos komentoa ei tunnisteta, palauttaa botti virheen. TODO: Arvo randomilla joku "hauska" lause.
	else {
		console.error("Command not recognized: " + cmd);
		message.channel.send(
			"I'm sorry, but I don't recognize that language. Is that some sort of Gnollish gibberish I'm too sophisticated to understand?",
		);
	}
});

// Loggaa sisään Discordiin
client.login(process.env.DISCORD_TOKEN);
