/**
 * The screenplay, on a timeline.
 *
 * Every line is verbatim from THE MATRIX, Rev. 3/9/98, scenes 1 through 11.
 * `t` is global seconds; `dur` is how long the line stays up. VO = the phone
 * call we're listening in on; diegetic = spoken in the room.
 */

const VO = 'vo';
const D = 'diegetic';

export const DIALOGUE = [
  /* ---- 1  ON COMPUTER SCREEN ---- */
  { t: 5, dur: 1.7, who: 'CYPHER', text: 'Yeah?', emote: 'flat', style: VO },
  { t: 8.6, dur: 2.3, who: 'TRINITY', text: 'Is everything in place?', emote: 'cold', style: VO },
  { t: 12.6, dur: 2.7, who: 'TRINITY', text: 'I said, is everything in place?', emote: 'urgent', style: VO },
  { t: 15.9, dur: 2.7, who: 'CYPHER', text: "You weren't supposed to relieve me.", emote: 'flat', style: VO },
  { t: 18.9, dur: 2.7, who: 'TRINITY', text: 'I know but I felt like taking a shift.', emote: 'cold', style: VO },
  { t: 21.9, dur: 3.4, who: 'CYPHER', text: "You like him, don't you? You like watching him?", emote: 'amused', style: VO },
  { t: 25.6, dur: 1.9, who: 'TRINITY', text: "Don't be ridiculous.", emote: 'cold', style: VO },
  { t: 27.9, dur: 5.0, who: 'CYPHER', text: "We're going to kill him. Do you understand that? He's going to die just like the others.", emote: 'cold', style: VO },
  { t: 33.2, dur: 2.5, who: 'TRINITY', text: 'Morpheus believes he is the One.', emote: 'quiet', style: VO },
  { t: 36, dur: 1.3, who: 'CYPHER', text: 'Do you?', emote: 'flat', style: VO },
  { t: 37.6, dur: 2.9, who: 'TRINITY', text: "I... it doesn't matter what I believe.", emote: 'quiet', style: VO },
  { t: 40.8, dur: 1.9, who: 'CYPHER', text: "You don't, do you?", emote: 'amused', style: VO },
  { t: 43, dur: 3.7, who: 'TRINITY', text: 'If you have something to say, I suggest you say it to Morpheus.', emote: 'cold', style: VO },
  { t: 47, dur: 3.1, who: 'CYPHER', text: 'I intend to, believe me. Someone has to.', emote: 'flat', style: VO },
  { t: 50.6, dur: 1.7, who: 'TRINITY', text: 'Did you hear that?', emote: 'urgent', style: VO },
  { t: 52.4, dur: 1.4, who: 'CYPHER', text: 'Hear what?', emote: 'flat', style: VO },
  { t: 55, dur: 2.3, who: 'TRINITY', text: 'Are you sure this line is clean?', emote: 'urgent', style: VO },
  { t: 57.4, dur: 1.9, who: 'CYPHER', text: "Yeah, 'course I'm sure.", emote: 'flat', style: VO },
  { t: 59.4, dur: 1.7, who: 'TRINITY', text: 'I better go.', emote: 'resolve', style: VO },

  /* ---- 2  INT. HEART O' THE CITY HOTEL ---- */
  { t: 72, dur: 1.7, who: 'BIG COP', text: 'Police! Freeze!', emote: 'shout', style: D },
  { t: 74.8, dur: 2.7, who: 'BIG COP', text: 'Hands behind your head! Now! Do it!', emote: 'shout', style: D },

  /* ---- 3  EXT. HEART O' THE CITY HOTEL ---- */
  { t: 87, dur: 1.5, who: 'AGENT SMITH', text: 'Lieutenant?', emote: 'cold', style: D },
  { t: 88.9, dur: 1.3, who: 'LIEUTENANT', text: 'Oh shit.', emote: 'dread', style: D },
  { t: 90.6, dur: 2.7, who: 'AGENT SMITH', text: 'Lieutenant, you were given specific orders —', emote: 'cold', style: D },
  { t: 93.7, dur: 5.0, who: 'LIEUTENANT', text: "I'm just doing my job. You gimme that Juris-my dick-tion and you can cram it up your ass.", emote: 'shout', style: D },
  { t: 99.2, dur: 2.3, who: 'AGENT SMITH', text: 'The orders were for your protection.', emote: 'cold', style: D },
  { t: 101.9, dur: 2.3, who: 'LIEUTENANT', text: 'I think we can handle one little girl.', emote: 'amused', style: D },
  { t: 105, dur: 2.7, who: 'LIEUTENANT', text: "I sent two units. They're bringing her down now.", emote: 'flat', style: D },
  { t: 108.2, dur: 3.2, who: 'AGENT SMITH', text: 'No, Lieutenant, your men are already dead.', emote: 'cold', style: D },

  /* ---- 4  INT. HEART O' THE CITY HOTEL ---- */
  { t: 137.2, dur: 1.8, who: 'TRINITY', text: 'Shit.', emote: 'weary', style: D },

  /* ---- 6  INT. HEART O' THE CITY HOTEL ---- */
  { t: 143.5, dur: 1.4, who: 'MAN', text: 'Operator.', emote: 'flat', style: VO },
  { t: 145, dur: 3.1, who: 'TRINITY', text: "Morpheus! The line was traced! I don't know how.", emote: 'panic', style: D },
  { t: 148.4, dur: 4.1, who: 'MORPHEUS', text: 'I know. They cut the hardline. This line is not a viable exit.', emote: 'cold', style: VO },
  { t: 152.8, dur: 1.9, who: 'TRINITY', text: 'Are there any Agents?', emote: 'urgent', style: D },
  { t: 154.8, dur: 1.1, who: 'MORPHEUS', text: 'Yes.', emote: 'cold', style: VO },
  { t: 156, dur: 1.3, who: 'TRINITY', text: 'Goddamnit!', emote: 'panic', style: D },
  { t: 157.4, dur: 4.5, who: 'MORPHEUS', text: 'You have to focus. There is a phone. Wells and Lake. You can make it.', emote: 'resolve', style: VO },
  { t: 162.2, dur: 1.5, who: 'TRINITY', text: 'All right —', emote: 'resolve', style: D },
  { t: 163.8, dur: 1.1, who: 'MORPHEUS', text: 'Go.', emote: 'urgent', style: VO },

  /* ---- 9  EXT. ROOF ---- */
  { t: 191, dur: 2.1, who: 'COP', text: "That's it, we got her now.", emote: 'amused', style: D },
  { t: 197.6, dur: 2.5, who: 'COP', text: "Jesus Christ — that's impossible!", emote: 'panic', style: D },

  /* ---- A10  INT. BACK STAIRWELL ---- */
  { t: 212.5, dur: 4.2, who: 'TRINITY', text: "Get up, Trinity. You're fine. Get up — just get up!", emote: 'weary', style: D },

  /* ---- 11  EXT. STREET ---- */
  { t: 241.5, dur: 1.5, who: 'AGENT JONES', text: 'She got out.', emote: 'flat', style: D },
  { t: 243.4, dur: 1.7, who: 'AGENT SMITH', text: "It doesn't matter.", emote: 'cold', style: D },
  { t: 245.4, dur: 2.1, who: 'AGENT BROWN', text: 'The informant is real.', emote: 'quiet', style: D },
];

/** Chapter marks for the transport bar, keyed to the screenplay's scene numbers. */
export const CHAPTERS = [
  { t: 0, label: '1 · On Computer Screen' },
  { t: 63, label: "2 · Hotel — Room 303" },
  { t: 80, label: '3 · Ext. Hotel' },
  { t: 112, label: '4 · The Arrest Goes Wrong' },
  { t: 142, label: '6 · Operator' },
  { t: 165, label: '7 · Hall & Fire Escape' },
  { t: 179, label: '9 · Roof' },
  { t: 203, label: '10 · Window & Stairwell' },
  { t: 219, label: '11 · Street' },
  { t: 251, label: 'Title' },
];

export const RUNTIME = 265;
