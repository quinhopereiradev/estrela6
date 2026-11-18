# Roteiros dos boletins (fase 1: escritos à mão aqui; no Laravel, o Haiku escreve a partir dos posts aprovados do dia).
# Só usa posts SEM spoiler e SEM leak. Vozes Kokoro-82M (Apache-2.0).
V = {
  'anchor': ('am_michael', 1.02), 'flamingo': ('am_puck', 1.08), 'dolly': ('af_bella', 0.98),
  'earl': ('am_onyx', 0.94), 'static': ('am_fenrir', 0.92), 'marina': ('bf_isabella', 0.98),
  'ad': ('am_echo', 1.15), 'reporter': ('af_nicole', 1.02),
}
B = {
 'neon': [
  ('Six Star News Flash', [
   ('anchor', "This is the Six Star News desk on Neon, one oh four point seven. I'm Chad Harlow, and yes, the hair is real."),
   ('anchor', "Top story. The new trailer shows Vice City after dark, and viewers say the night cycle looks gorgeous. Local residents say it looks exactly like their electricity bill."),
   ('flamingo', "DJ Flamingo here, live from Ocean Drive. Chad, the neon is so bright tonight my sunglasses asked for sunglasses."),
   ('anchor', "Thank you, Flamingo. In other news, a new fan theory says radio stations change depending on where you are on the map. This station would like to remind you that we are everywhere. Like humidity."),
   ('ad', "This bulletin was brought to you by Glow Juice. The energy drink that makes you see sounds. Glow Juice. Side effects include more neon."),
   ('anchor', "That's the news. Stay shiny, Vice City."),
  ]),
  ('Rush Hour Report', [
   ('anchor', "Six Star News, rush hour edition. Traffic on the Causeway is moving at the speed of a tourist reading a map."),
   ('anchor', "The countdown to launch is almost over, and the official release date is still holding steady. Our newsroom has been refreshing the page so hard the button is now concave."),
   ('reporter', "Reporting from Port Gellhorn, where the community just shared its most chaotic police chase yet. Witnesses describe it as, quote, a lot of sirens and one very confident shopping cart."),
   ('anchor', "Remember, if it's not on the official channels, it's a rumor. If it's on a napkin, it's a napkin."),
   ('anchor', "Back to the music. This is Neon."),
  ]),
 ],
 'kalaga': [
  ('Farm Breakfast Bulletin', [
   ('dolly', "Mornin', Backroad Country. Dolly Pines with the farm breakfast bulletin, fresh as a biscuit and twice as warm."),
   ('dolly', "Down in the Keys, somebody drifted the highway for fifteen seconds straight, and the bridge survived. Folks up here have been drifting tractors for years. Nobody filmed it. Rude."),
   ('dolly', "And there's a new theory that the radio changes depending on where you drive. Well, honey, out here the radio changes when the cow leans on the antenna."),
   ('ad', "Pine Cone Pickups. Built for mud, priced for mud, smells like mud. Pine Cone Pickups."),
   ('dolly', "That's the news from the hills, on Six Star radio. Coffee's on, and the next song's for anybody who still has hay in their boots."),
  ]),
  ('Campfire News', [
   ('dolly', "Evening, friends. Gather 'round the fire for the Backroad campfire news."),
   ('dolly', "Launch day is just around the bend, and the official details haven't budged. Some of y'all have been counting down so long, your calendars filed a complaint."),
   ('dolly', "Port Gellhorn reports another wild police chase. Up here on the back roads, our chases are slower. Mostly goats."),
   ('dolly', "Stay warm, stay kind, and leave the marshmallows for the bears. This is Backroad Country."),
  ]),
 ],
 'gulf': [
  ('Rust Report', [
   ('earl', "Big Earl here with the Gulf Rust report. If it ain't loud, it ain't news."),
   ('earl', "Port Gellhorn just had its most chaotic police chase yet. The community clip shows three cruisers, one ferry ramp, and zero brakes. Respect."),
   ('earl', "Meanwhile, Vice City is showing off its fancy night lights in the new trailer. Cute. Over here we have one streetlight, and it's in a long-term relationship with a moth."),
   ('ad', "Gellhorn Grease. For engines, hinges, and emotional problems. Gellhorn Grease."),
   ('earl', "That's the rust report. Crank it up."),
  ]),
  ('Last Ferry Bulletin', [
   ('earl', "Last ferry bulletin, Gulf Rust, eighty eight point one."),
   ('earl', "Somebody drifted the Keys Highway for fifteen seconds and the bridge survived. Kid, come to Gellhorn. Our bridges have survived worse. Mostly me."),
   ('earl', "And the release date? Still official, still standing. Unlike my back."),
   ('earl', "Ferry leaves in five. Turn it up or get off the dock."),
  ]),
 ],
 'swamp': [
  ('Gator Watch', [
   ('anchor', "This is Gator Watch, the midday news from Swamp Static, ninety one point nine."),
   ('static', "Static here. The mist is thick, the frogs are loud, and the news is mostly true."),
   ('static', "A fan theory says the radio changes with where you are on the map. Down here, the radio changes when the swamp decides. The swamp has opinions."),
   ('anchor', "Over in Vice City, the new trailer shows the city at night, all neon and glass. Grassrivers residents responded by turning on one lantern. Out of politeness."),
   ('ad', "Bayou Bug Spray. Because the mosquitoes here have names, and some of them have lawyers. Bayou Bug Spray."),
   ('static', "Stay off the boardwalk after dark. This has been Gator Watch."),
  ]),
  ('Moon Over Hamlet', [
   ('static', "Moon's up over Hamlet. Static with the late swamp report."),
   ('static', "Launch is near, the official word hasn't changed, and the gators have been notified. They didn't care."),
   ('static', "Port Gellhorn had a wild police chase. If anybody needs a place to lay low, the swamp has plenty of room and absolutely no snacks."),
   ('static', "Static out. Mind the mud."),
  ]),
 ],
 'keys': [
  ('Coffee in the Keys', [
   ('marina', "Good morning, darlings. Marina Sol with coffee in the Keys, where the sea is warm and the news is gently stirred."),
   ('marina', "Our big local story. Someone drifted the Keys Highway for fifteen seconds straight, and the bridge survived. The pelicans gave it a seven out of ten. Pelicans are harsh critics."),
   ('marina', "In Vice City, the new trailer shows the skyline after dark. Lovely. We prefer our nights with a sunset, a hammock, and absolutely no sirens."),
   ('ad', "Coral Cove Resort. Where the towels are folded into swans and the swans are folded into towels. Coral Cove."),
   ('marina', "Sip slowly. This is Keys Lounge."),
  ]),
  ('Sunset Bulletin', [
   ('marina', "The sun is setting over the Overseas Highway. Marina Sol, with your sunset bulletin."),
   ('marina', "Launch is almost here, and the official details remain calm. Unlike the comments section."),
   ('marina', "A fan theory says the radio follows you across the map. Darling, if we're following you, at least we have good taste in music."),
   ('marina', "Goodnight from the Keys. Leave the sand where you found it."),
  ]),
 ],
}
