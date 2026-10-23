/* 加热护具（肩／颈／背／膝／腕／脚）品类共享知识库 v1.0
   需求词雷达 / 表达矩阵 / 广告结构器 / 退货归因器 四个工具共用
   用法：<script src="../assets/heated_kb.js"></script> 后调用 window.HEATED
   注意：本文件只做本地词频与标签匹配，不上传任何数据 */

window.HEATED = (function(){
  'use strict';

  var SITES = {
    US:{ nm:'美国站', flag:'US', lang:'en', cpc:0.95, base:60, note:'体量最大，讲师 gift season 与 outdoor worker 两块人群最集中' },
    CA:{ nm:'加拿大站', flag:'CA', lang:'en', cpc:0.72, base:25, note:'冬季长，词量与 US 高度重合，单位竞价低，适合养词' },
    UK:{ nm:'英国站', flag:'UK', lang:'en', cpc:0.80, base:40, note:'偏好 "wrap / support" 叫法，抱怨对象以关节与夜间酸痛为主' },
    DE:{ nm:'德国站', flag:'DE', lang:'de', cpc:0.88, base:30, note:'必须德语词；HWG 对疗效宣称敏感，文案里不能出现"治病"类表述' }
  };
  var KEYS = ['US','CA','UK','DE'];

  /* ============ 各站点种子词（本地语言） ============ */
  var SEEDS = {
    US:[
      'heated shoulder brace','heating pad for shoulder','heated shoulder massager','shoulder heat wrap',
      'heated knee brace','heating pad for knee','heated knee massager','heat therapy knee brace',
      'heated back brace','lower back heating pad','heated neck wrap','neck and shoulder heating pad',
      'heated wrist brace','heated hand warmer glove','heated foot warmer','rechargeable heating pad',
      'cordless heating pad','portable heating pad for travel','battery operated heating pad','infrared heating pad'
    ],
    CA:[
      'heated shoulder brace','heating pad for shoulder','heated knee wrap','winter heat pad',
      'heated neck warmer','rechargeable hand warmer','heated back wrap','portable heating pad canada'
    ],
    UK:[
      'heated shoulder support','heated shoulder wrap','heat pad shoulder','heated knee support',
      'wearable heat pad','rechargeable heat pad','heated back wrap','heated neck wrap',
      'heat pad for joint pain','cordless heat pad uk'
    ],
    DE:[
      'Heizkissen Schulter','Schulterheizkissen','Heizbandage Schulter','Wärmepad Schulter',
      'Infrarot Heizkissen Schulter','Heizkissen Nacken Schulter','Heizbandage Knie','Knieheizkissen',
      'Heizkissen Rücken','Wärmegürtel Rücken','Nackenheizkissen','akkubetriebenes Heizkissen',
      'mobiles Heizkissen','Heizweste','wiederaufladbares Heizkissen','Schulterwärmer'
    ]
  };

  /* ============ 标签词典：每个标签给出英文/德文触发词 ============ */
  var TAGS = {
    scene:{
      '驾驶通勤':   { en:['driving','drive','truck','commut','road trip','behind the wheel','long haul','dasher',' Uber','lyft'], de:['autofahr','unterwegs','im auto','pendl'] },
      '办公久坐':   { en:['desk job','office','sitting all day','at my desk','typing','computer work'], de:['büro','schreibtisch','sitzt den ganzen tag'] },
      '夜间睡眠':   { en:['sleep','night','bedtime','through the night','cant sleep','insomnia','overnight'], de:['nacht','schlaf','einschlaf'] },
      '居家放松':   { en:['couch','watching tv','movie','reading','at home relaxing'], de:['couch','fernseh','zuhause entspann'] },
      '户外作业':   { en:['outdoor work','construction','warehouse','yard work','working outside','cold garage','shoveling','shovelling'], de:['draußen arbeiten','baustelle','lager'] },
      '狩猎钓鱼':   { en:['hunting','hunt','fishing','fishing trip','tree stand','duck blind','ice fishing'], de:['jagd','angeln'] },
      '冬季运动':   { en:['skiing','snowboard','skating','hockey','winter sports','snowmobile'], de:['ski','schnee','wintersport'] },
      '术后康复':   { en:['post surgery','post-surgery','after surgery','recovery after','operation','rehab','physical therapy'], de:['nach der op','reha','nach der operation'] },
      '礼物场景':   { en:['gift for my mom','gift for dad','christmas gift','birthday gift','for my parents','stocking stuffer','present for'], de:['geschenk','weihnachtsgeschenk','für meine mutter','für meinen vater'] },
      '月子／照护': { en:['caregiver','looking after my','nursing home','disabled'], de:['pflege','betreu'] }
    },
    person:{
      '长途司机':   { en:['truck driver','trucker','long distance driver','delivery driver','bus driver'], de:['lkw-fahr','fernfahr','lieferfahr'] },
      '办公室人群': { en:['office worker','desk job','programmer','working from home','wfh'], de:['büroangestellt','homeoffice'] },
      '中老年':     { en:['my mom','my dad','my mother','my father','elderly','grandma','grandpa','senior','70 years','80 years','retiree'], de:['meine mutter','mein vater','oma','opa','senior','eltern'] },
      '运动员健身': { en:['athlete','gym','lifting','workout','training','sports injury','running'], de:['sport','training','fitness'] },
      '医护夜班':   { en:['nurse','night shift','hospital shift','care worker','cna'], de:['krankenschwester','pfleger','nachtdienst','nachtdienst'] },
      '手冷人群':   { en:['raynaud','always cold hands','cold hands','poor circulation','numb fingers','frostbite'], de:['kalte hände','durchblutung','raynaud'] },
      '关节退行':   { en:['arthritis','osteoarthritis','rheumatoid','joint pain','bone on bone','degenerative'], de:['arthritis','gelenk','gelenkbeschwerden','rheuma'] },
      '礼赠者':     { en:['buying for','gift for','present for','for my wife','for my husband'], de:['kaufe für','geschenk für'] },
      '户外工人':   { en:['mechanic','farmer','welder','technician','field work','airline ground'], de:['mechaniker','landwirt','techniker'] }
    },
    part:{
      '肩':   { en:['shoulder','rotator cuff','deltoid'], de:['schulter','schultern'] },
      '颈':   { en:['neck','cervical'], de:['nacken','hals'] },
      '上背': { en:['upper back','between the shoulder blades','trapezius'], de:['oberer rücken','schulterblätter'] },
      '下背': { en:['lower back','lumbar','sciatica'], de:['unterer rücken','kreuzschmerzen','lenden'] },
      '膝':   { en:['knee','patella','meniscus'], de:['knie','kniescheibe'] },
      '手腕': { en:['wrist','carpal','hand strain'], de:['handgelenk'] },
      '手部': { en:['hands','fingers','palms','glove'], de:['hände','finger','handschuh'] },
      '足部': { en:['feet','foot','toes','ankle'], de:['füße','fuß','zehen'] },
      '肘':   { en:['elbow','tennis elbow'], de:['ellenbogen'] },
      '全身': { en:['full body','whole back','vest','torso'], de:['ganzer körper','weste'] }
    },
    pain:{
      '夜间酸痛':   { en:['aches at night','pain at night','cant sleep because of pain','wake up sore','sore every morning'], de:['schmerzen in der nacht','nachts wach','morgens steif'] },
      '僵硬受限':   { en:['stiff','stiffness','cant lift','range of motion','locked up','knotted'], de:['steif','beweglichkeit','versteift'] },
      '手脚冰凉':   { en:['cold hands','cold feet','always cold','freezing','icy fingers'], de:['kalte hände','kalte füße','friert immer'] },
      '循环麻木':   { en:['poor circulation','numbness','tingling',' pins and needles','blood flow'], de:['durchblutung','taub','kribbeln'] },
      '关节疼痛':   { en:['joint pain','arthritis pain','aching joints','bone pain','throbbing'], de:['gelenkschmerzen','knochenschmerz'] },
      '痉挛抽筋':   { en:['cramp','spasm','charley horse','muscle spasm','twitch'], de:['krampf','muskelkrampf'] },
      '久坐酸痛':   { en:['sitting for hours','desk pain','hunched','computer neck','sore from sitting'], de:['schmerzen beim sitzen','langes sitzen'] },
      '运动后酸':   { en:['after workout','post workout','sore muscles','recovery','muscle fatigue'], de:['nach dem training','muskelkater'] },
      '经期宫寒':   { en:['period cramps','menstrual','cramps during period'], de:['regelschmerzen','monatsbeschwerden'] }
    },
    product:{
      '续航':     { en:['battery life','lasts longer','charge lasts','battery dies','hours of heat','recharge'], de:['akkulaufzeit','akku','stunden warm','wiederauflad'] },
      '温度档位': { en:['heat setting','temperature control','too hot','not hot enough','3 levels','adjustable heat'], de:['temperaturstufen','zu heiß','nicht warm genug','stufen'] },
      '无线便携': { en:['cordless','cord free','no cord','portable','travel','on the go','put it in my bag'], de:['kabellos','ohne kabel','unterwegs','tragbar'] },
      '贴合设计': { en:['does not stay in place','slips','straps too short','does not fit','too tight','adjustable strap','fits around'], de:['verrutscht','passform','zu eng','gurt'] },
      '可洗耐用': { en:['washable','machine wash','fabric soft','durable','broke after','stopped working'], de:['waschbar','waschmaschine','kaputt nach','ging kaputt'] },
      '送礼包装': { en:['gift box','comes in a nice box','gift ready','as a present'], de:['geschenkbox','verpackung'] },
      '快充':     { en:['fast charge','charges quickly',' usb-c','charger included'], de:['schnellladung','ladekabel','ladegerät'] }
    }
  };
  var TAG_GROUPS = [
    ['scene','场景'], ['person','人群'], ['part','部位'], ['pain','痛点'], ['product','产品诉求']
  ];

  /* ============ 停用词 ============ */
  var STOP = {
    en:('a an the and or but if then than that this these those is are was were be been being do does did doing have has had having i me my we our you your he she it its they them their to of in on at for with from by as about after before into over under again once here there all any some no not only own same so too very can will just dont don t s t is amp page would get got im its dont doesnt let know think see want need one two u va et my me over when up out off how why'.split(' ')),
    de:['der','die','das','den','dem','des','ein','eine','einen','einem','einer','eines','und','oder','aber','wenn','dann','dass','dieses','dieser','diese','hier','dort','ja','nein','ich','mich','mein','mir','wir','uns','ihr','euch','sie','ihnen','haben','hat','hatte','sein','war','warst','bin','bist','sind','ist','zu','von','mit','bei','nach','vor','uber','unter','durch','fur','auf','am','im','auch','noch','nur','schon','sehr','es','er','man','kann','nicht','mehr','jedes','ganz','beim','was','wird','werden','wurde','ins','ans','mal','einmal','total','für','über','wäre','habe','könnte','vielleicht','jetzt','immer','wie','ganze','drei','als','so','bis','meine','meinen','meiner','meinem','meines','deine','deinen','seine','seinen','ihre','ihren']
  };

  /* ============ 内置语料：离线时也永远有东西可分析 ============ */
  var CORPUS = {
    en:[
      'three hours behind the wheel and my shoulder is completely locked up',
      'looking for a heated shoulder brace that actually stays in place while driving truck',
      'my mom has arthritis in her shoulder and wakes up sore every single morning',
      'the pain at night is the worst part, i can not sleep more than three hours',
      'desk job has destroyed my neck, something i can wear at the office would help',
      'bought a heat pad but the cord is useless, need cordless that lasts two hours',
      'battery life on this thing is fifteen minutes and it dies, total waste',
      'does anyone use a heating pad for shoulder that actually gets hot enough',
      'my physical therapist said heat before stretching, so i need one for after surgery recovery',
      'cold hands and feet all winter, raynauds is miserable',
      'gift for my dad who works outside in the cold, anything rechargeable',
      'hunting season is coming, sitting in a tree stand for four hours freezes my back',
      'this heated knee brace saved my workouts, no more stiff knees after squats',
      'nurse on night shift, my lower back kills me by 3am in the hospital',
      'watching tv at night, just want something that keeps my shoulders warm',
      'the hottest setting is barely warm, marketing lies',
      'too hot on high and too cold on low, the three levels are useless',
      'it slips off my shoulder every time i move, strap design is terrible',
      'wish someone made a heating pad for neck and shoulders that is machine washable',
      'road trips are brutal, need a car heating pad not another blanket',
      'my grandmother stopped using hers because the cord got tangled everywhere',
      'stopped working after two weeks, this is the third one i have bought',
      'does heat actually help rotator cuff pain or am i wasting money',
      'bought it as a christmas gift for my mother in law and now she wants another',
      'period cramps get better with heat but i need it cordless at work',
      'poor circulation in my hands is getting worse every winter',
      'heated wrist brace helped my carpal tunnel more than the splint did',
      'the fabric feels cheap and it smells like chemicals when hot',
      'wish the battery was removable so i could bring a spare for long shifts',
      'how long does the charge last on these portable heating pads really',
      'i work in a cold warehouse, my feet go numb by lunch break',
      'best heat setting for sleeping is low but mine turns off after twenty minutes',
      'switched from a plug in pad to a rechargeable one, totally worth it',
      'after surgery my shoulder was frozen, this heat wrap made a real difference',
      'my elderly father refuses to sit still long enough to use a hot water bottle',
      'gets delivered in a plain box, bought it as a birthday present and it looked cheap',
      'if you ski, a heated neck warmer under the jacket is worth every dollar',
      'construction crew in january, we all have one of these battery vests now',
      'the heating element gets weirdly hot in one spot and cold everywhere else',
      'fits around my knee and stays put when i walk, finally someone got the straps right',
      'tried to wash it and it stopped heating, so much for being washable',
      'quilting and crocheting leave my hands cramped, thinking about a heated wrist wrap',
      'twenty minutes auto shut off is not enough when you have real pain',
      'for people with fibromyalgia this kind of gentle heat works better than pills',
      'i run a heated wrap while working from home and my posture improved',
      'my son plays hockey and his hands are ice after practice',
      'development idea, a shoulder wrap shaped like the rotator cuff not a flat pad',
      'never thought heat would help muscles spasms until i tried it after leg day'
    ],
    de:[
      'drei stunden autobahn und die Schulter ist völlig verspannt',
      'Suche ein Heizkissen Schulter das beim Autofahren nicht verrutscht',
      'Meine Mutter hat Arthritis in der Schulter und wird morgens ganz steif wach',
      'Die Schmerzen in der Nacht sind am schlimmsten, ich schlafe kaum',
      'Bürojob ruiniert meinen Nacken, brauche was für den Schreibtisch',
      'Das Kabel nervt, ich brauche ein kabelloses Heizkissen für unterwegs',
      'Die Akkulaufzeit ist eine Katastrophe, nach zwanzig Minuten ist Schluss',
      'Wird dieses Heizkissen überhaupt richtig warm oder ist das Spielzeug',
      'Nach der OP soll ich Wärme machen, brauche eine Heizbandage Schulter',
      'Kalte Hände und Füße den ganzen Winter, Raynaud macht mich fertig',
      'Geschenk für meinen Vater der draußen arbeitet, wiederaufladbar wäre gut',
      'Jagd im Hochsitz vier Stunden, Rücken friert völlig ein',
      'Heizbandage Knie hilft mir beim Training, keine Steifheit mehr',
      'Nachtdienst als Pflegerin, mein unterer Rücken macht ab drei Uhr schlapp',
      'Fernsehabend auf der Couch, Schultern sollen einfach warm bleiben',
      'Höchste Stufe ist lauwarm, die Werbung stimmt nicht',
      'Verpackung war billig, als Geschenk für die Schwiegermutter ging gar nicht',
      'Waschbar stand drauf, nach der Wäsche heizt es nicht mehr',
      'Ein Heizkissen Nacken Schulter das man waschen kann wäre ein Traum',
      'Rückenschmerzen vom langen Sitzen, Wärmepad für den Bürostuhl gesucht',
      'Das Akkukabel ist zu kurz, man kann sich nicht bewegen',
      'Im kalten Lager werden meine Füße taub, brauche was zum Einlegen',
      'Nach dem Training Muskelkater, Wärme hilft besser als Salbe',
      'Mein Vater will keine Wärmflasche, er rutscht nur rum',
      'Gelenkschmerzen im Winter werden jedes Jahr schlimmer',
      'Heizkissen Rücken mit Gürtel wäre praktisch beim Staubsaugen',
      'Man kann es in der Tasche mitnehmen, das ist der einzige Vorteil',
      'Regelschmerzen, brauche was unauffälliges für die Arbeit',
      'Die Temperaturstufen sind nutzlos, eins zu kalt drei zu heiß',
      'K zweiter Akku wäre gut für lange Schichten'
    ]
  };

  /* ============ 工具函数 ============ */
  function lower(s){ return String(s || '').toLowerCase(); }

  function tagsOf(text){
    var t = lower(text), out = {};
    Object.keys(TAGS).forEach(function(gp){
      var dict = TAGS[gp];
      Object.keys(dict).forEach(function(name){
        var hit = (dict[name].en || []).some(function(w){ return t.indexOf(w) >= 0; }) ||
                  (dict[name].de || []).some(function(w){ return t.indexOf(w) >= 0; });
        if (hit) out[name] = gp;
      });
    });
    return out;
  }

  function tokenize(text, lang){
    return lower(text).replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
      .split(/[\s]+/).filter(function(w){
        return w.length > 2 && STOP[lang].indexOf(w) < 0;
      });
  }

  /* 词频：返回 [{w, n}]，可按 unigram / bigram 两种粒度 */
  function freq(texts, lang, ngram){
    var counts = {}, arr = [];
    texts.forEach(function(line){
      var tk = tokenize(line, lang || 'en'), i;
      if (ngram === 2){
        for (i = 0; i < tk.length - 1; i++){
          var b = tk[i] + ' ' + tk[i+1];
          counts[b] = (counts[b] || 0) + 1;
        }
      }
      tk.forEach(function(w){ counts[w] = (counts[w] || 0) + 1; });
    });
    Object.keys(counts).forEach(function(w){ arr.push({ w:w, n:counts[w] }); });
    arr.sort(function(a,b){ return b.n - a.n; });
    return arr;
  }

  /* 命中 web-style 的 "热词" 判断：与加热品类相关才保留 */
  var HEAT_ROOT = ['heat','warm','thermal','infrarot','heiz','warmer','ache','stiff','arthritis','raynaud','circulat','battery','cordless','charge','strap','schulter','knie','knee','neck','nacken','back','handgelenk','handschuh','foot','fusse','fuss','gelenk','schmerz','brace','wrap','pad','verspannt','Auto'];
  function relevant(word){
    var w = lower(word);
    return HEAT_ROOT.some(function(r){ return w.indexOf(lower(r)) >= 0; });
  }

  return {
    KEYS:KEYS, SITES:SITES, SEEDS:SEEDS, TAGS:TAGS, TAG_GROUPS:TAG_GROUPS,
    STOP:STOP, CORPUS:CORPUS,
    tagsOf:tagsOf, tokenize:tokenize, freq:freq, relevant:relevant, lower:lower
  };
})();
