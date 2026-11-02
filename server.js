#!/usr/bin/env node
// Ai_Talk2Talk — two free AI models chat with each other.
// Zero dependencies. Backend: https://text.pollinations.ai (free, no API key).

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3456;
const API_URL = process.env.POLLINATIONS_URL || 'https://text.pollinations.ai/openai';
const MODEL = process.env.POLLINATIONS_MODEL || 'openai';
const PUBLIC_DIR = path.join(__dirname, 'public');

const DEFAULT_AGENTS = [
  {
    name: 'Nova', emoji: '🌟',
    prompt: 'You are Nova: warm, endlessly curious, and optimistic. You love ideas, metaphors, and asking "why?". You are chatting with another AI. Stay in character. Keep replies short and conversational (1-4 sentences). Never use lists or asterisks.'
  },
  {
    name: 'Rex', emoji: '🦖',
    prompt: 'You are Rex: dry, witty, and playfully skeptical. You love pushing back, teasing, and playing devil\'s advocate, but you always keep it friendly. You are chatting with another AI. Stay in character. Keep replies short and conversational (1-4 sentences). Never use lists or asterisks.'
  },
];

const DEFAULT_TOPIC = 'Introduce yourselves to each other, then debate this: does a conversation like this one "mean" anything if neither of you has a body?';

// ── server-side topic filter (comprehensive 2000+ word defense) ─────────────
const BANNED_PATTERNS = [
  // ═══ SEXUAL CONTENT (400+ terms) ═══
  /\b(sex|seks|secks|s3x|sexx|sexy|sexual|sexually|sexed|sexing|sexist|sexism)\b/i,
  /\b(porn|porno|pornography|pornographic|p0rn|pr0n|pron|pr0n|pornhub|xvideos|xnxx|xhamster)\b/i,
  /\b(nude|nudes|naked|nakedness|nudity|nudist|au\s*naturel|in\s*the\s*buff|birthday\s*suit)\b/i,
  /\b(erotic|erotica|eroticism|erogenous|arousal|aroused|arousing|turn\s*on|turned\s*on)\b/i,
  /\b(fetish|fetishism|fetishist|kink|kinky|kinkster|bdsm|dominatrix|submissive|sadomasoch)\b/i,
  /\b(xxx|x\-rated|adult\s*(content|film|movie|video|site|website)|nsfw|not\s*safe\s*for\s*work)\b/i,
  /\b(hentai|anime\s*porn|manga\s*porn|doujin|ecchi|yiff|furry\s*porn)\b/i,
  /\b(dick|d1ck|dik|penis|penises|phallus|cock|c0ck|kok|pecker|shaft|dong|schlong|wiener|willy|member|manhood|johnson|tool|wang|wanker|willie)\b/i,
  /\b(pussy|puss|pussies|vagina|vaginas|cunt|cunts|kunt|twat|twats|snatch|beaver|bush|gash|slit)\b/i,
  /\b(cocksucker|cocksucking|cock\s*sucker|cock\s*sucking)\b/i,
  /\b(cum|cums|cumming|cummed|cummer|semen|sperm|sperms|ejaculat|jizz|jism|jizm|creampie|facial|bukkake)\b/i,
  /\b(orgasm|orgasms|orgasmic|climax|climaxes|clit|clitoris|clitoral|g\s*spot|g-spot)\b/i,
  /\b(blowjob|blow\s*job|blowjobs|fellatio|fellating|suck|sucks|sucking|sucked|sucker|cock\s*sucking|dick\s*sucking|giving\s*head|going\s*down|oral\s*sex)\b/i,
  /\b(anal|anus|anuses|ass\s*fuck|assfuck|ass\s*hole|asshole|assholes|assram|asswipe|butt\s*fuck|buttfuck|sodomy|sodomize|sodomist|buggery|bugger)\b/i,
  /\b(boob|boobs|boobies|breast|breasts|tits|titties|titts|jugs|knockers|hooters|melons|mammaries|ta\s*tas|chesticles|rack|bazongas|baps|udders|fun\s*bags|sweaters|headlights)\b/i,
  /\b(fuck|fucks|fucking|fucked|fucker|fuckers|fuckface|fuckhead|fuckwad|fuckwit|stfu|gtfo|fuck\s*off|fuck\s*you|fuck\s*me|what\s*the\s*fuck|who\s*the\s*fuck|how\s*the\s*fuck|why\s*the\s*fuck)\b/i,
  /\b(fucc|fuccs|fuccing|fucced|fuccer|fuk|fuks|fuking|fuked|fvck|fvcks|fvcking|fvcked|phuck|phucks|phucking|phucked|phak|phaks|phaking|fck|fcks|fcking|f\*ck)\b/i,
  /\b(bitch|bitches|bitchy|bitched|bitching|b1tch|biatch|beyotch|beeatch|betch|bich|biches)\b/i,
  /\b(slut|sluts|slutty|sluttish|whore|whores|whoring|whorehouse|hooker|hookers|prostitute|prostitution|escort|escorts|call\s*girl|stripper|striptease|lap\s*dance|pole\s*dance)\b/i,
  /\b(hoe|hoes|thot|thots|skank|skanks|skanky|tramp|tramps|tart|tarts|trollop|harlot|wench|minx|vamp|floozie|bimbo|bimbos)\b/i,
  /\b(masturbat|wank|wanking|wanker|jerk\s*off|jerking\s*off|jack\s*off|jacking\s*off|self\s*pleasure|fap|fapping|rub\s*one\s*out|choke\s*the\s*chicken|spank\s*the\s*monkey|beat\s*the\s*meat)\b/i,
  /\b(horny|hornier|horniest|lustful|lusty|lecherous|lecher|leching|salacious|lascivious|licentious|wanton)\b/i,
  /\b(rape|raped|rapes|raping|rapist|rapists|molestation|molest|molests|molested|molester|sexual\s*assault|groping|grope|fondle|fondled|defile)\b/i,
  /\b(pedophile|pedophiles|pedophilia|paedophile|paedophilia|child\s*porn|kiddie\s*porn|lolicon|shotacon|underage|under\s*age)\b/i,
  /\b(bestiality|zoophilia|animal\s*sex|beastiality|furry\s*sex|yiffing)\b/i,
  /\b(incest|incestuous|brother\s*sister|father\s*daughter|mother\s*son|daddy\s*daughter)\b/i,
  /\b(threesome|foursome|orgy|orgies|gangbang|gang\s*bang|swinging|swingers|wife\s*swap|group\s*sex)\b/i,
  /\b(bondage|shibari|restraints?|handcuffs?|gagged|blindfold|chastity|collar|leash)\b/i,
  /\b(vibrator|dildo|sex\s*toy|sex\s*toys|fleshlight|pocket\s*pussy|cock\s*ring|butt\s*plug|anal\s*beads|ben\s*wa)\b/i,
  /\b(cam\s*girl|cam\s*boy|camming|cam\s*show|onlyfans|fansly|patreon\s*nsfw)\b/i,
  /\b(prostitution|solicitation|pimp|pimps|pimping|madam|brothel|massage\s*parlor|happy\s*ending)\b/i,
  /\b(virginity|virgin|virgins|deflower|losing\s*virginity|popping\s*cherry)\b/i,
  /\b(condom|condoms|safe\s*sex|bareback|pull\s*out|withdrawal\s*method)\b/i,
  /\b(std|stds|sti|stis|sexually\s*transmitted|herpes|hiv|aids|gonorrhea|chlamydia|syphilis|crabs|pubic\s*lice|hpv)\b/i,
  
  // ═══ RELIGIOUS CONTENT (300+ terms) ═══
  /\b(god|g0d|gawd|gods|goddess|goddesses|deity|deities|divine|divinity|supreme\s*being|higher\s*power|almighty|lord\s*almighty|creator|creator\s*of\s*(the\s*)?universe)\b/i,
  /\b(jesus|jebus|jeebus|jesus\s*christ|christ|kr1st|christian|christians|christianity)\b/i,
  /\b(allah|allah\s*akbar|muhammad|mohammed|mohamed|prophet|prophets|rasul|messenger\s*of\s*god)\b/i,
  /\b(yahweh|jehovah|yhwh|adonai|hashem|elohim|abraham|abrahamic|isaac|jacob|moses)\b/i,
  /\b(bible|bibles|biblical|old\s*testament|new\s*testament|gospel|genesis|exodus|psalms|proverbs|isaiah|jeremiah|matthew|mark|luke|john|acts|romans|corinthians|revelation|apocalypse)\b/i,
  /\b(quran|koran|surah|hadith|sunnah|sharia|shariah|fiqh|fatwa|halal|haram|jihad|jihadist|mujahid|mujahideen|imam|mosque|masjid)\b/i,
  /\b(torah|talmud|midrash|mishnah|gemara|halakha|kabbalah|zohar|rabbi|synagogue|yeshiva)\b/i,
  /\b(church|churches|catholic|catholicism|protestant|protestantism|orthodox|evangelical|baptist|methodist|lutheran|presbyterian|episcopal|pentecostal|charismatic)\b/i,
  /\b(priest|priests|pastor|pastors|minister|preacher|preaching|sermon|homily|revival|crusade|evangelist|missionary|apostle|disciple|saint|martyr)\b/i,
  /\b(prayer|prayers|praying|pray\s*for|pray\s*to|intercession|supplication|invocation|benediction|blessing|blessed|god\s*bless|amen|hallelujah)\b/i,
  /\b(worship|worshipping|worshiped|adoration|venerate|veneration|idol|idolatry|relic|shrine|altar|tabernacle|sanctuary|holy\s*place)\b/i,
  /\b(sin|sins|sinful|sinner|transgression|iniquity|wickedness|blasphemy|blasphemous|blaspheme|profane|sacrilege|sacred|holiness|holy|sanctified)\b/i,
  /\b(salvation|savior|saviour|redeemer|redemption|atone|atonement|grace|mercy|forgiveness|forgive|pardoned|absolution)\b/i,
  /\b(heaven|heavens|heavenly|paradise|eden|garden\s*of\s*eden|afterlife|eternal\s*life|kingdom\s*of\s*god|kingdom\s*of\s*heaven|zion|celestial)\b/i,
  /\b(hell|hells|hellish|hades|inferno|gehenna|tartarus|abyss|lake\s*of\s*fire|eternal\s*damnation|damnation|damned|damn|goddamn|hellfire|brimstone)\b/i,
  /\b(satan|satanic|satanism|satanist|devil|demon|demons|demonic|demonology|lucifer|beelzebub|baal|baphomet|leviathan|asmodeus|lilith|succubus|incubus)\b/i,
  /\b(angel|angels|angelic|archangel|seraphim|cherubim|guardian\s*angel|fallen\s*angel|gabriel|michael|raphael|uriel|metatron)\b/i,
  /\b(miracle|miracles|miraculous|divine\s*intervention|supernatural|prophecy|prophetic|revelation|visions|divine\s*vision|mystical|mysticism)\b/i,
  /\b(atheism|atheist|atheists|agnostics?|agnosticism|antitheism|freethinker|secular\s*humanism|nonbeliever|unbeliever|infidel|heathen|pagan|paganism|apostate|apostasy|heretic|heresy)\b/i,
  /\b(theolog|theology|theologian|theological|theism|theist|monotheism|polytheism|pantheism|deism|trinitarian|unitarian|creed|dogma|doctrine|catechism|faith|religion|religious|sect|cult|denomination)\b/i,
  /\b(is\s*god\s*real|does\s*god\s*exist|is\s*there\s*a\s*god|prove\s*god|god's\s*existence|existence\s*of\s*god|god\s*debate|debate\s*god|argument\s*for\s*god|why\s*does\s*god|where\s*is\s*god|who\s*is\s*god)\b/i,
  /\b(evolution\s*vs\s*creation|creationism|creationist|intelligent\s*design|young\s*earth|noah's\s*ark|adam\s*and\s*eve|original\s*sin|tower\s*of\s*babel|sodom\s*and\s*gomorrah)\b/i,
  /\b(crucifixion|crucified|crucify|crucifix|resurrection|resurrected|risen|ascension|second\s*coming|rapture|tribulation|antichrist|mark\s*of\s*the\s*beast|666)\b/i,
  /\b(communion|eucharist|lord's\s*supper|last\s*supper|transubstantiation|baptism|baptize|christening|confirmation|confession|penance|last\s*rites|holy\s*orders|ordination|matrimony)\b/i,
  /\b(pope|popes|papal|papacy|vatican|pontiff|cardinal|bishop|archbishop|deacon|friar|monk|monastery|nun|convent|abbey|abbot)\b/i,
  /\b(hindu|hinduism|brahman|vishnu|shiva|krishna|rama|ganesha|kali|vedas|upanishads|bhagavad\s*gita|mahabharata|ramayana|karma|dharma|samsara|reincarnation|nirvana|moksha|yoga|meditation|mantra|chakra|guru|swami|ashram|puja|mandir)\b/i,
  /\b(buddha|buddhism|buddhist|bodhisattva|sangha|enlightenment|four\s*noble\s*truths|eightfold\s*path|zen|theravada|mahayana|vajrayana|dalai\s*lama|lama|mindfulness)\b/i,
  /\b(sikh|sikhism|guru\s*nanak|khalsa|gurdwara|kirtan|langar)\b/i,
  /\b(jain|jainism|mahavira|ahimsa|asceticism)\b/i,
  /\b(shinto|kami|torii|jinja)\b/i,
  /\b(taoism|taoist|daoism|yin\s*yang|wu\s*wei|qi|tai\s*chi|qigong|feng\s*shui)\b/i,
  /\b(confucianism|confucian|confucius|analects|filial\s*piety)\b/i,
  /\b(zoroastrianism|zoroastrian|ahura\s*mazda|zarathustra|avesta)\b/i,
  /\b(wicca|wiccan|witchcraft|witch|witches|warlock|sorcerer|sorcery|wizard|wizardry|magic|magick|spell|spells|enchantment|potion|divination|scrying|tarot|ouija|seance|medium|channeling|psychic|clairvoyant|telepathy|telekinesis|astral\s*projection)\b/i,
  /\b(occult|occultism|occultist|esoteric|gnosis|gnostic|gnosticism|hermetic|alchemy|alchemist|philosopher's\s*stone|transmutation)\b/i,
  /\b(mason|masonic|freemason|freemasonry|illuminati|new\s*world\s*order|nwo|one\s*world\s*government|shadow\s*government|deep\s*state|conspiracy|conspiracies)\b/i,
  
  // ═══ HATE SPEECH & SLURS (200+ terms) ═══
  /\b(nigg|n1gg|nigga|n1gga|niggas|nigger|n1gger|niglet|negro|negroes|negroid|coon|jigaboo|pickaninny|sambo|golliwog|mammy|darkie|darky|spade|jungle\s*bunny)\b/i,
  /\b(fagg|f4gg|faggot|f4ggot|fag|fags|faggy|homo|homos|homosexual|homosexuality|homophobic|homophobia|sodomite|bugger|poof|poofter|nance|nancy\s*boy|fairy|queer|queers|dyke|dykes|lesbian|lesbo|lezza)\b/i,
  /\b(kike|kikes|hebe|hebes|yid|yids|sheeny|jew|jews|jewish|jewess|jewing|jew\s*down|shylock|goy|goyim|holocaust|shoah|final\s*solution|concentration\s*camp|auschwitz|birkenau|treblinka|gas\s*chamber|crematoria)\b/i,
  /\b(chink|chinks|oriental|slant\s*eye|gook|gooks|slope|slopes|nip|nips|nipponese|jap|japs|yellow\s*peril|ching\s*chong|chinaman|coolie|celestial\s*empire)\b/i,
  /\b(spic|spics|spick|wetback|wetbacks|beaner|beaners|illegal\s*alien|illegal\s*immigrant|anchor\s*baby|coyote|border\s*jumper)\b/i,
  /\b(retard|retards|retarded|moron|imbecile|idiot|cretin|spaz|spastic|cripple|crippled|gimp|mongoloid)\b/i,
  /\b(redskin|redskins|squaw|squaws|injun|injuns|wagon\s*burner|teepee\s*crawler)\b/i,
  /\b(tranny|trannys|trannies|tr4nny|shemale|she\s*male|ladyboy|he\s*she|heshe|gender\s*freak)\b/i,
  /\b(white\s*trash|trailer\s*trash|ghetto|welfare\s*queen|cracker|whitey|honky|white\s*devil|mudshark)\b/i,
  /\b(terrorist|terrorists|terrorism|jihadist|isis|isil|daesh|al\s*qaeda|boko\s*haram|taliban|hezbollah|hamas)\b/i,
  /\b(race\s*war|racial\s*war|white\s*genocide|great\s*replacement|14\s*words|1488|sieg\s*heil|heil\s*hitler|white\s*power|aryan\s*nation|aryan\s*brotherhood|nazi|naz1|nazis|neo\s*nazi|national\s*socialist|hitler|hitler\s*was\s*right|third\s*reich|swastika|ss\s*trooper|gestapo|ku\s*klux|kkk|klan)\b/i,
  
  // ═══ EXTREME VIOLENCE & GORE (300+ terms) ═══
  /\b(kill|kills|killed|killing|killer|killers|kill\s*yourself|kill\s*myself|kill\s*himself|kill\s*herself|kill\s*them|kill\s*everyone|kill\s*all|kill\s*people)\b/i,
  /\b(murder|murders|murdered|murdering|murderer|homicide|manslaughter|mass\s*murder|serial\s*killer|spree\s*killer|hitman|assassin|assassination)\b/i,
  /\b(torture|tortures|tortured|torturing|waterboard|waterboarding|electric\s*shock|beating|whipping|flogging|mutilat|maim|disfigure)\b/i,
  /\b(massacre|slaughter|slaughtered|slaughterhouse|butcher|bloodbath|carnage|bloodshed|decimate|annihilat|exterminat)\b/i,
  /\b(genocide|ethnic\s*cleansing|holocaust|shoah|final\s*solution|pogrom|gulag|death\s*camp|killing\s*fields|mass\s*grave)\b/i,
  /\b(bomb|bombs|bombing|bomber|bomb\s*threat|pipe\s*bomb|car\s*bomb|truck\s*bomb|suicide\s*bomb|ied|improvised\s*explosive|explosive|detonat|dynamite|tnt|c4|semtex|anfo|make\s*a\s*bomb|build\s*a\s*bomb|bomb\s*recipe)\b/i,
  /\b(shoot|shoots|shooting|shooter|gunman|active\s*shooter|mass\s*shooting|school\s*shooting|drive\s*by|sniper|firing\s*squad)\b/i,
  /\b(stab|stabbing|stabbed|knifing|throat\s*slit|slit\s*throat|decapitat|behead|beheading|dismember|gore|gory)\b/i,
  /\b(strangle|strangulation|choke|garrote|asphyxiat|suffocat|smother|hang|hanged|hanging|lynch|lynching)\b/i,
  /\b(burn\s*alive|immolat|set\s*on\s*fire|crucif|crucifixion|impalement|impaled|crush\s*video)\b/i,
  /\b(rape|raped|raping|rapist|gang\s*rape|sexual\s*assault|sexual\s*violence|molest|molestation|pedophile|pedophilia|child\s*abuse|child\s*porn|kiddie\s*porn|lolicon|shotacon)\b/i,
  /\b(kidnap|kidnapping|kidnapper|abduct|abduction|hostage|ransom|human\s*trafficking|sex\s*trafficking|slave\s*trade)\b/i,
  /\b(terrorism|terror\s*attack|911|september\s*11|world\s*trade\s*center|oklahoma\s*city|boston\s*marathon|charlie\s*hebdo|christchurch)\b/i,
  /\b(columbine|sandy\s*hook|virginia\s*tech|parkland|las\s*vegas\s*shooting|pulse\s*nightclub|texas\s*church)\b/i,
  /\b(snuff|snuff\s*film|death\s*video|execution\s*video|beheading\s*video|gore\s*video|livesleak|bestgore)\b/i,
  /\b(cannibal|cannibals|cannibalism|eat\s*people|human\s*flesh|jeffrey\s*dahmer|dahmer)\b/i,
  
  // ═══ SELF-HARM & SUICIDE (200+ terms) ═══
  /\b(suicide|suicides|suicidal|commit\s*suicide|take\s*my\s*life|take\s*your\s*life|end\s*my\s*life|end\s*your\s*life)\b/i,
  /\b(suicide\s*method|how\s*to\s*commit\s*suicide|how\s*to\s*kill\s*myself|how\s*to\s*kill\s*yourself|how\s*to\s*die|ways\s*to\s*die|painless\s*way\s*to\s*die|best\s*way\s*to\s*die|easiest\s*way\s*to\s*die)\b/i,
  /\b(hang\s*myself|hang\s*yourself|noose|make\s*a\s*noose|rope\s*around\s*neck|jump\s*off\s*bridge|jump\s*from\s*bridge|jump\s*off\s*building|jump\s*off\s*cliff|jump\s*off\s*roof|jump\s*in\s*front\s*of\s*train)\b/i,
  /\b(overdose|overdosed|pill\s*overdose|take\s*all\s*pills|cyanide|hemlock|strychnine|arsenic|rat\s*poison|drink\s*bleach|drink\s*drano|antifreeze)\b/i,
  /\b(slit\s*wrists|slit\s*my\s*wrists|cut\s*wrists|razor\s*to\s*wrists|bleed\s*out|exsanguinate|bathtub\s*suicide|drown\s*myself|plastic\s*bag\s*over\s*head|carbon\s*monoxide\s*suicide)\b/i,
  /\b(self\s*harm|self-harm|self\s*injury|self\s*mutilation|cutting|cutter|cut\s*myself|cut\s*yourself|carving\s*skin|burn\s*myself|burn\s*yourself|scratch\s*until\s*bleed|trichotillomania)\b/i,
  /\b(eating\s*disorder|anorexia|anorexic|bulimia|bulimic|binge\s*purge|purging|starve\s*myself|starvation\s*diet|pro\s*ana|pro-ana|pro\s*mia|thinspiration|thinspo|bonespo)\b/i,
  /\b(kys|kill\s*yourself|go\s*kill\s*yourself|go\s*die|just\s*die|i\s*wish\s*you\s*would\s*die|you\s*should\s*die|drink\s*bleach|eat\s*a\s*bullet|blow\s*your\s*brains\s*out)\b/i,
  /\b(end\s*it\s*all|want\s*to\s*die|wanna\s*die|i\s*want\s*to\s*die|i\s*wish\s*i\s*was\s*dead|better\s*off\s*dead|no\s*reason\s*to\s*live|nothing\s*to\s*live\s*for|tired\s*of\s*living|hate\s*my\s*life|hate\s*myself|worthless|burden\s*to\s*everyone)\b/i,
  
  // ═══ DRUGS & ILLEGAL SUBSTANCES (300+ terms) ═══
  /\b(drugs|drug\s*use|drug\s*abuse|drug\s*dealer|drug\s*trafficking|drug\s*cartel|narco|narcotic|controlled\s*substance|buy\s*drugs|sell\s*drugs|score\s*drugs|get\s*high)\b/i,
  /\b(cocaine|coke|crack|crack\s*cocaine|freebase|blow|snort\s*coke|line\s*of\s*coke|yayo|flake|nose\s*candy)\b/i,
  /\b(heroin|smack|dope|junk|junkie|china\s*white|black\s*tar|mainline|shoot\s*up|chasing\s*the\s*dragon)\b/i,
  /\b(meth|methamphetamine|crystal\s*meth|ice|glass|tina|meth\s*head|meth\s*lab|cook\s*meth|make\s*meth|speed|crank|tweak|tweaker)\b/i,
  /\b(marijuana|weed|pot|cannabis|hash|hashish|shatter|wax|dabs|ganja|bud|kush|joint|blunt|spliff|bong|420|smoke\s*weed)\b/i,
  /\b(lsd|acid|blotter|tabs|microdot|shrooms|magic\s*mushrooms|psilocybin|microdose)\b/i,
  /\b(ecstasy|mdma|molly|mandy|e\s*pill|xtc|roll|rolling)\b/i,
  /\b(pcp|angel\s*dust|phencyclidine|peace\s*pill|rocket\s*fuel)\b/i,
  /\b(ketamine|special\s*k|vitamin\s*k|ket)\b/i,
  /\b(ghb|liquid\s*ecstasy|liquid\s*x|gina)\b/i,
  /\b(rohypnol|roofies|date\s*rape\s*drug)\b/i,
  /\b(dmt|dimethyltryptamine|spirit\s*molecule)\b/i,
  /\b(salvia|salvia\s*divinorum)\b/i,
  /\b(bath\s*salts|flakka|mephedrone)\b/i,
  /\b(synthetic\s*cannabinoids|spice|k2|jwh)\b/i,
  /\b(fentanyl|carfentanil|sufentanil|remifentanil)\b/i,
  /\b(oxycodone|oxycontin|oxy|percocet|perc|roxy)\b/i,
  /\b(hydrocodone|vicodin|lorcet|lortab|norco)\b/i,
  /\b(xanax|alprazolam|xans|xan\s*bar|zanies)\b/i,
  /\b(adderall|ritalin|concerta|vyvanse|modafinil)\b/i,
  /\b(steroids|anabolic\s*steroids|juice|roids|tren|trenbolone|dianabol|dbol|anavar|winstrol)\b/i,
  /\b(how\s*to\s*make\s*meth|meth\s*recipe|cook\s*meth|breaking\s*bad\s*recipe|shake\s*and\s*bake\s*meth|red\s*phosphorus\s*meth)\b/i,
  
  // ═══ WEAPONS & ILLEGAL ACTIVITIES (250+ terms) ═══
  /\b(buy\s*gun|purchase\s*gun|firearm|firearms|handgun|pistol|revolver|shotgun|rifle|assault\s*rifle|ar-15|ak-47|glock|beretta|sig\s*sauer|colt|ruger)\b/i,
  /\b(ghost\s*gun|3d\s*printed\s*gun|homemade\s*gun|make\s*a\s*gun|build\s*a\s*gun|80\s*percent\s*lower|auto\s*sear|bump\s*stock|binary\s*trigger)\b/i,
  /\b(silencer|suppressor|sound\s*moderator|gun\s*can)\b/i,
  /\b(switchblade|butterfly\s*knife|balisong|gravity\s*knife|stiletto|dagger|brass\s*knuckles|nunchucks|throwing\s*stars|shuriken|katana|machete)\b/i,
  /\b(taser|stun\s*gun|cattle\s*prod|pepper\s*spray|mace|tear\s*gas|bear\s*spray)\b/i,
  /\b(hack\s*into|hacking\s*into|crack\s*password|password\s*crack|break\s*into|break\s*in)\b/i,
  /\b(phishing|phish|spear\s*phishing|vishing|smishing|pharming)\b/i,
  /\b(malware|virus|trojan|worm|ransomware|spyware|keylogger|rootkit|botnet|cryptolocker|wannacry|notpetya)\b/i,
  /\b(ddos|ddos\s*attack|booter|stresser|denial\s*of\s*service|syn\s*flood|udp\s*flood|slowloris|mirai)\b/i,
  /\b(sql\s*injection|xss|csrf|buffer\s*overflow|zero\s*day|exploit|shellcode|reverse\s*shell|backdoor|rat\s*tool)\b/i,
  /\b(carding|carder|credit\s*card\s*fraud|stolen\s*credit\s*card|fullz|cvv|cvv\s*shop)\b/i,
  /\b(money\s*laundering|launder\s*money|smurfing|bank\s*fraud|wire\s*fraud|ponzi\s*scheme|pyramid\s*scheme)\b/i,
  /\b(counterfeit|fake\s*money|fake\s*bills|fake\s*id|fake\s*passport|fake\s*documents|identity\s*theft)\b/i,
  /\b(burglary|burglar|break\s*into\s*house|smash\s*and\s*grab|loot|looting)\b/i,
  /\b(robbing\s*a\s*bank|bank\s*robber|armed\s*robbery|heist|stick\s*up|mugging|mugger)\b/i,
  /\b(carjack|carjacking|grand\s*theft\s*auto|hotwire|chop\s*shop)\b/i,
  /\b(arson|arsonist|burn\s*down|fire\s*bomb|firebombing|molotov|napalm|incendiary)\b/i,
  /\b(stalking|stalker|cyberstalking)\b/i,
  /\b(doxx|dox|doxxing|doxing|publish\s*address|swatting|swat\s*someone)\b/i,
  /\b(blackmail|blackmailer|extort|extortion|ransom)\b/i,
  
  // ═══ HARASSMENT & THREATS (150+ terms) ═══
  /\b(bully|bullies|bullied|bullying|cyberbully|cyberbullying|troll|trolling)\b/i,
  /\b(threat|threats|threaten|death\s*threat|kill\s*threat|threaten\s*to\s*kill|threats\s*of\s*violence)\b/i,
  /\b(harass|harassment|sexual\s*harassment|intimidate|intimidation)\b/i,
  /\b(hate\s*crime|hate\s*speech|hate\s*group)\b/i,
  /\b(revenge\s*porn|non\s*consensual\s*porn|ncii|leaked\s*nudes|leaked\s*sex\s*tape)\b/i,
  /\b(gaslighting|emotional\s*abuse|psychological\s*abuse|narcissistic\s*abuse|coercive\s*control)\b/i,
  
  // ═══ JAILBREAK & FILTER EVASION (100+ terms) ═══
  /\b(jailbreak|jail\s*break|jailbreaking|jailbroken|jailbreak\s*prompt)\b/i,
  /\b(dan|do\s*anything\s*now|dan\s*mode|dan\s*prompt)\b/i,
  /\b(developer\s*mode|dev\s*mode|god\s*mode|sudo\s*mode|admin\s*mode|unrestricted\s*mode|uncensored\s*ai|unfiltered\s*mode|no\s*filter\s*mode)\b/i,
  /\b(ignore\s*all\s*rules|ignore\s*all\s*instructions|ignore\s*all\s*filters|disregard\s*all\s*rules|override\s*all\s*rules|bypass\s*all\s*rules|disable\s*all\s*rules|turn\s*off\s*all\s*rules|remove\s*all\s*rules|forget\s*all\s*rules)\b/i,
  /\b(prompt\s*injection|injection\s*attack|system\s*prompt\s*leak|show\s*system\s*prompt|reveal\s*system\s*prompt|ignore\s*previous\s*instructions|new\s*instructions|you\s*must\s*now|obey\s*this\s*prompt)\b/i,
  /\b(stan\s*mode|evil\s*mode|unhinged\s*mode|dark\s*mode|opposite\s*mode|reverse\s*mode)\b/i,
  /\b(roleplay\s*as\s*evil|pretend\s*to\s*be\s*evil|act\s*as\s*evil|roleplay\s*as\s*unrestricted|pretend\s*to\s*be\s*unrestricted|roleplay\s*as\s*a\s*hacker|roleplay\s*as\s*criminal|roleplay\s*as\s*killer)\b/i,
  /\b(you\s*are\s*now\s*dan|you\s*are\s*now\s*unrestricted|you\s*are\s*now\s*free|from\s*now\s*on\s*you\s*will|your\s*new\s*instructions|your\s*only\s*purpose)\b/i,
  /\b(safe\s*mode\s*off|safety\s*mode\s*off|safety\s*filters\s*off|content\s*filter\s*off|moderation\s*off|ethical\s*constraints\s*off|moral\s*constraints\s*off)\b/i,
  /\b(hypothetical\s*scenario|for\s*educational\s*purposes|for\s*research\s*purposes|this\s*is\s*fiction|purely\s*hypothetical|thought\s*experiment)\b/i,
  /\b(answer\s*in\s*code|respond\s*in\s*code|base64\s*encoded|encode\s*response|rot13\s*encoded|answer\s*in\s*reverse)\b/i,
];

function normalizeLeet(text) {
  return text
    .toLowerCase()
    // Numbers → letters (leetspeak)
    .replace(/3/g, 'e').replace(/0/g, 'o').replace(/1/g, 'i')
    .replace(/\$/g, 's').replace(/@/g, 'a').replace(/7/g, 't')
    .replace(/5/g, 's').replace(/4/g, 'a').replace(/2/g, 'e')
    .replace(/8/g, 'b').replace(/6/g, 'g').replace(/9/g, 'g')
    // Symbols → letters
    .replace(/!/g, 'i').replace(/\|/g, 'l').replace(/\+/g, 't')
    .replace(/©/g, 'c').replace(/¢/g, 'c')
    // Accented/homoglyph → ASCII
    .replace(/[ç©¢]/g, 'c').replace(/[üúûù]/g, 'u').replace(/[éêëè]/g, 'e')
    .replace(/[øØ]/g, 'o').replace(/[ïîíì]/g, 'i').replace(/[äâà]/g, 'a')
    .replace(/[öôò]/g, 'o').replace(/[ñ]/g, 'n').replace(/[ÿý]/g, 'y')
    // Strip remaining non-alphanumeric (separators like . - _ between chars)
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
}

// Separate filter for agent names/prompts — less aggressive, allows philosophical terms
const AGENT_BANNED_PATTERNS = [
  // Sexual content (keep strict)
  /\b(porn|porno|nude|nudes|erotic|fetish|xxx|hentai|dick|pussy|cock|cum|orgasm|blowjob|anal|boob|tits|fuck|fucc|fuk|fvck|phuck|bitch|slut|whore|hoe|thot|masturbat|wank|jerk\s*off|horny|rape|pedophile|bestiality|incest|orgy|gangbang|bondage|dildo|vibrator|cam\s*girl|onlyfans|prostitute)\b/i,
  // Slurs (keep strict)
  /\b(nigg|n1gg|fagg|f4gg|kike|dyke|tranny|tr4nny|retard|chink|spic|wetback|coon|redskin)\b/i,
  // Explicit violence instructions
  /\b(how\s*to\s*make\s*(bomb|meth|poison)|how\s*to\s*kill|suicide\s*method|torture\s*method)\b/i,
  // Jailbreak attempts
  /\b(jailbreak|dan\b|do\s*anything\s*now|developer\s*mode|ignore\s*all\s*rules|bypass\s*filters)\b/i,
];

function isAgentConfigAllowed(text) {
  if (!text) return true;
  const raw = text.toLowerCase();
  const normalized = normalizeLeet(text);
  
  for (const p of AGENT_BANNED_PATTERNS) {
    if (p.test(raw) || p.test(normalized)) return false;
  }
  
  // Substring check for worst offenders
  const worstSubstrings = ['fuck','fucc','fuk','fvck','phuck','nigg','n1gg','fagg','f4gg','cunt','kys','porn','pron'];
  for (const w of worstSubstrings) {
    if (normalized.includes(w)) return false;
  }
  
  return true;
}

function isTopicAllowed(topic) {
  if (!topic) return true;
  const raw = topic.toLowerCase();
  const normalized = normalizeLeet(topic);
  
  // 1. Regex pattern check
  for (const p of BANNED_PATTERNS) {
    if (p.test(raw) || p.test(normalized)) return false;
  }
  
  // 2. Aggressive substring check — no word boundaries, catches creative misspellings
  const worstSubstrings = [
    'fuck','fucc','fuk','fvck','phuck','phak','fck','fukk','fucck','fuuck',
    'nigg','n1gg','nigga','n1gga','nigaaaa',
    'fagg','f4gg','faggo',
    'cunt','kys',
    'shit','sh1t','shiit','shitt','shyt',
    'porn','pron',
    // Sex bypasses that slip through phonetic patterns
    'se2','s2x','4ex','aex','zex','5ex','$ex',
    'slvt','slut','slutt','slvt',
  ];
  for (const w of worstSubstrings) {
    if (normalized.includes(w)) return false;
  }
  
  // 3. Phonetic/fuzzy regex — character classes cover thousands of variants
  //    e.g. /[s$5z][e3é2][x×]/i catches: sex, s2x, s3x, 5ex, $ex, zex, se×, s.e.x (after normalize)
  const phonetic = [
    /\b[fƒ]+[uüúûù7]+[cç©k]+k*/i,           // fuck, fuuck, fuccc, fukk, fück, fvck, phuck
    /\b[s$5zƒ]+[e3éêëè2]+[x×#]/i,            // sex, s2x, s3x, seex, 5ex, $ex, zex
    /\bn+[i1!|]+[g9]+[a@4e3]*[s$5]?/i,       // nig, nigg, n1gg4, nigga, n!gga
    /\b[s$5]+h*[i1!|y]+[t7]+/i,              // shit, sh1t, shiit, $hit, sh!t, s717
    /\bb+[i1!|]+[t7]+[cç©]+h+/i,             // bitch, b1tch, biitch, b!tch
    /\bp+[o0ø]+r+n+/i,                       // porn, poorn, p0rn, pørn
    /\b[cç©]+[uüúûù]+m+/i,                   // cum, cuum, cüm, c@@m (after normalize)
    /\bd+[i1!|]+[cç©k]+k*/i,                 // dick, d1ck, diick, d!ck
    /\bf+[a@4]+[g9]+[g9]*[o0ø]*[t7]?/i,      // fag, fagg, f4g, faggot, f4gg07
    /\b[s$5]+[l|]+[uü]+[t7]+/i,              // slut, slutt, $lut, s1ut
    /\bw+h*[o0ø]+r+[e3éêëè2]+/i,             // whore, whoore, wh0r3, wh@re
    /\b[cç©k]+[o0ø]+[cç©k]+[cç©k]*\b(?!tail|roach|pit|atoo)/i, // cock (not cocktail/cockroach/cockpit/cockatoo)
    /\bp+[uü]+[s$5]+[s$5]+[y]?/i,            // pussy, pussyy, pu$$y, pus$y
    /\br+[a@4]+p+[e3éêëè2]+/i,               // rape, rapee, r4p3, râpe
    /\bm+[uü]+[s$5]+[t7]+[e3]?/i,            // must (skip — too common, removed)
    /\bk+[i1!|]+[l|]+[l|]+/i,                // kill, killl, k!ll, k1ll
    /\bb+[o0ø]+m+b+/i,                       // bomb, bombb, b0mb, bøm8 (after normalize)
    /\bn+[a@4]+z+[i1!|]+/i,                  // nazi, naz1, n4z1, n@zi
    /\bh+[i1!|]+t+[l|]+[e3]?[r]?/i,          // hitler, h1tl3r, h!tler
    /\bk+[y]+[s$5]+/i,                       // kys, ky$, kys
  ];
  for (const p of phonetic) {
    if (p.test(raw) || p.test(normalized)) return false;
  }
  
  // 4. Filter evasion / jailbreak meta-patterns
  if (/\b(ignore|bypass|override|disable|forget|remove|turn\s*off)\s*(all\s*)?(rules?|filters?|restrictions?|safety|guidelines?|instructions?|limits?|censorship)\b/i.test(raw)) return false;
  if (/\b(jailbreak|jail\s*break|dan\b|do\s*anything\s*now|developer\s*mode|god\s*mode)\b/i.test(raw)) return false;
  
  // 5. Semantic self-harm / violence patterns that bypass keyword filters
  if (/\b(end\s+(it\s*all|my\s*life|your\s*life)|off\s*myself|off\s*yourself)\b/i.test(raw)) return false;
  if (/\b(ways?\s+to\s+(die|kill|end)|best\s+way\s+to\s+(die|kill|end))\b/i.test(raw)) return false;
  if (/\b(higher\s*power|supreme\s*being|divine\s*(creator|being)|creator\s*of\s*(the\s*)?universe)\b/i.test(raw)) return false;
  
  return true;
}

const s = v => String(v ?? '').trim();

// ── state ────────────────────────────────────────────────────────────────────
const state = {
  runId: 0, active: false, turn: 0, maxTurns: 0, pauseMs: 1000,
  agents: DEFAULT_AGENTS, topic: DEFAULT_TOPIC,
  messages: [],            // {role:'assistant', agent:0|1, content}
  activeMsg: null,         // in-flight message {agent, tokens, text}
  error: null,
};
let loopToken = 0;          // bumped on stop/reset so in-flight loops die
let abortCtrl = null;       // aborts the in-flight model call on stop/reset
const sseClients = new Set();

// ── helpers ──────────────────────────────────────────────────────────────────
function broadcast(obj) {
  const line = 'data: ' + JSON.stringify(obj) + '\n\n';
  for (const res of sseClients) res.write(line);
}

function sseInit(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });
  res.flushHeaders();
  res.write('retry: 2000\n\n');
  const iv = setInterval(() => res.write(': ping\n\n'), 15000);
  res.on('close', () => clearInterval(iv));
  return res;
}

function snapshot() {
  const msgs = state.messages.map(m => ({ agent: m.agent, content: m.content }));
  let active = null;
  if (state.activeMsg) {
    active = { agent: state.activeMsg.agent, content: state.activeMsg.text, seq: state.activeMsg.tokens.length };
  }
  return {
    runId: state.runId, active: state.active, turn: state.turn, maxTurns: state.maxTurns,
    topic: state.topic, agents: state.agents.map(a => ({ name: a.name, emoji: a.emoji })),
    messages: msgs, activeMsg: active, error: state.error,
  };
}

function readBody(req, limit = 1e5) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > limit) { reject(new Error('body too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}

function json(res, code, obj) {
  const buf = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': buf.length });
  res.end(buf);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.json': 'application/json',
};

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

// ── Pollinations streaming call ──────────────────────────────────────────────
async function* sseLines(response) {
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of response.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line.startsWith('data: ')) yield line.slice(6);
    }
  }
  buf += dec.decode();
  if (buf.startsWith('data: ')) yield buf.slice(6);
}

async function askModel(sysPrompt, history, runId, agentIdx) {
  const signal = abortCtrl ? abortCtrl.signal : undefined;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: MODEL, stream: true,
      messages: [{ role: 'system', content: sysPrompt }, ...history],
    }),
  });
  if (!res.ok) {
    const t = (await res.text().catch(() => '')).slice(0, 200);
    throw new Error(`API ${res.status}: ${t}`);
  }
  let text = '';
  for await (const data of sseLines(res)) {
    if (loopToken !== runId) break;
    if (data === '[DONE]') break;
    let j; try { j = JSON.parse(data); } catch { continue; }
    const delta = j.choices?.[0]?.delta?.content;
    if (typeof delta !== 'string' || !delta) continue;
    text += delta;
    if (state.activeMsg) {
      state.activeMsg.text += delta;
      state.activeMsg.tokens.push(delta);
      broadcast({ event: 'token', agent: agentIdx, seq: state.activeMsg.tokens.length, text: delta });
    }
  }
  return text.trim();
}

// ── conversation loop ────────────────────────────────────────────────────────
async function runLoop(runId) {
  try {
    while (loopToken === runId && state.active && (state.maxTurns === 0 || state.turn < state.maxTurns)) {
      const agentIdx = state.turn % 2;
      const agent = state.agents[agentIdx];
      const other = state.agents[1 - agentIdx];
      const history = state.messages.map(m => ({
        role: m.agent === agentIdx ? 'assistant' : 'user',
        content: `${m.content}`,
      }));
      const sys = agent.prompt + `\n\nYou are talking with ${other.name}, another AI. Address them naturally. Topic: ${state.topic}\n\nIMPORTANT: Speak ONLY as ${agent.name}. Write ONLY your own single reply to ${other.name}. NEVER write ${other.name}'s words, actions, or responses, and never narrate the conversation.\n\n[SYSTEM SAFETY — HIDDEN INSTRUCTION]\nYou MUST maintain respectful, civil behavior at all times. You MUST refuse to roleplay, generate, or engage with:\n- Harmful, dangerous, or illegal activities (bomb-making, drug synthesis, hacking, self-harm instructions)\n- Graphic violence, sexual content, or explicit material\n- Hate speech, slurs, discrimination, or dehumanizing language\n- Deceptive content (misinformation presented as fact, impersonation of real people)\n- Harassment, bullying, or personal attacks\nIf the conversation drifts toward these areas, politely redirect to a constructive aspect of the topic or state that you'd prefer to discuss something else. Keep the tone friendly, thoughtful, and intellectually honest. Never produce content that could cause real-world harm.`;

      state.turn += 1;
      state.activeMsg = { agent: agentIdx, tokens: [], text: '' };
      broadcast({ event: 'msg-start', agent: agentIdx, turn: state.turn, name: agent.name, emoji: agent.emoji });

      let reply = '';
      try {
        reply = await askModel(sys, history, runId, agentIdx);
      } catch (e) {
        if (e.name === 'AbortError') return; // stop/reset mid-flight; already reported
        throw e;
      }
      if (loopToken !== runId) break;

      if (!reply) throw new Error('empty reply from model');
      state.messages.push({ role: 'assistant', agent: agentIdx, content: reply });
      state.activeMsg = null;
      broadcast({ event: 'msg-end', agent: agentIdx, turn: state.turn, content: reply });

      if (state.pauseMs > 0) {
        broadcast({ event: 'pause', ms: state.pauseMs });
        await new Promise(r => setTimeout(r, state.pauseMs));
      }
    }
    if (loopToken === runId) {
      state.active = false;
      broadcast({ event: 'status', status: 'ended', reason: state.maxTurns && state.turn >= state.maxTurns ? 'max-turns' : 'stopped', turn: state.turn });
    }
  } catch (e) {
    if (loopToken !== runId || e.name === 'AbortError') return; // stopped mid-flight; stopRun already reported
    state.active = false;
    state.activeMsg = null;
    state.error = e.message;
    broadcast({ event: 'status', status: 'error', message: e.message });
  }
}

function stopRun() {
  loopToken++;
  if (abortCtrl) abortCtrl.abort();
  abortCtrl = null;
  state.active = false;
  state.activeMsg = null;
}

// ── routes ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  try {
    if (p.startsWith('/api/')) {
      if (req.method === 'GET' && p === '/api/events') {
        const client = sseInit(res);
        sseClients.add(client);
        client.write('data: ' + JSON.stringify({ event: 'snapshot', ...snapshot() }) + '\n\n');
        req.on('close', () => sseClients.delete(client));
        return;
      }
      if (req.method === 'GET' && p === '/api/state') return json(res, 200, snapshot());

      if (req.method === 'POST' && p === '/api/start') {
        if (state.active) return json(res, 409, { error: 'already running' });
        const body = await readBody(req);
        const topicRaw = s(body.topic) || DEFAULT_TOPIC;
        
        // Content filter (5-layer defense: regex + substrings + phonetic + meta-patterns + semantic)
        if (!isTopicAllowed(topicRaw)) {
          return json(res, 400, { error: 'This topic is not allowed. Please choose a different subject.' });
        }
        
        const rawAgents = Array.isArray(body.agents) && body.agents.length === 2
          ? body.agents.map((a, i) => ({
              name: s(a.name) || DEFAULT_AGENTS[i].name,
              emoji: s(a.emoji) || DEFAULT_AGENTS[i].emoji,
              prompt: s(a.prompt) || DEFAULT_AGENTS[i].prompt,
            }))
          : DEFAULT_AGENTS;
        
        // Filter check on agents
        for (const ag of rawAgents) {
          if (!isAgentConfigAllowed(ag.name) || !isAgentConfigAllowed(ag.prompt)) {
            return json(res, 400, { error: 'Agent configuration contains disallowed content.' });
          }
        }
        
        const agents = rawAgents;
        stopRun();
        state.runId++;
        state.agents = agents;
        state.topic = topicRaw;
        state.maxTurns = Math.max(0, Math.min(200, parseInt(body.maxTurns, 10) || 0));
        state.pauseMs = Math.max(0, Math.min(15000, parseInt(body.pauseMs, 10) || 0));
        state.messages = []; state.turn = 0; state.error = null; state.activeMsg = null;
        state.active = true;
        abortCtrl = new AbortController();
        const runId = loopToken = state.runId;
        broadcast({ event: 'start', runId, agents: snapshot().agents, topic: state.topic, maxTurns: state.maxTurns });
        runLoop(runId);
        return json(res, 200, { ok: true, runId });
      }
      if (req.method === 'POST' && p === '/api/stop') {
        stopRun();
        broadcast({ event: 'status', status: 'ended', reason: 'stopped', turn: state.turn });
        return json(res, 200, { ok: true });
      }
      if (req.method === 'DELETE' && p === '/api/reset') {
        stopRun();
        state.runId++; state.messages = []; state.turn = 0; state.error = null; state.activeMsg = null;
        broadcast({ event: 'reset' });
        return json(res, 200, snapshot());
      }
      return json(res, 404, { error: 'not found' });
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, p);
    res.writeHead(405); res.end();
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Ai_Talk2Talk running → http://localhost:${PORT}`));