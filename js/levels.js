'use strict';
/* Темы, уровни, сюжет и процедурная (детерминированная) генерация трасс */

const SKIES = {
  dawn: { top: '#3b4a78', mid: '#d9876b', bot: '#f6c78f', sun: '#ffd9a0', sunY: 0.72, dark: 0.12 },
  day: { top: '#4d8fcf', mid: '#9fcbe8', bot: '#e3ecee', sun: '#fff6d8', sunY: 0.2, dark: 0 },
  noon: { top: '#6aa6d8', mid: '#cfe3ea', bot: '#f2e6c8', sun: '#ffffff', sunY: 0.12, dark: 0 },
  dusk: { top: '#23264a', mid: '#9a4a66', bot: '#f0955a', sun: '#ffb070', sunY: 0.78, dark: 0.22 },
  night: { top: '#03050c', mid: '#0b1324', bot: '#1b2638', sun: '#dfe8ff', sunY: 0.18, dark: 0.66, moon: true },
  storm: { top: '#12171c', mid: '#2e383f', bot: '#4b5760', sun: '#9aa', sunY: 0.2, dark: 0.5, moon: false, noSun: true },
  fog: { top: '#7e898d', mid: '#aab3b4', bot: '#c7cdcc', sun: '#fff', sunY: 0.25, dark: 0.05, noSun: true },
  fire: { top: '#1a0c0a', mid: '#5a2014', bot: '#d0602a', sun: '#ff9a50', sunY: 0.85, dark: 0.45, noSun: true }
};

const THEMES = {
  suburbs: { ground: '#5e4630', top: '#5f8a3a', topHi: '#86b04e', far: 'hills', mid: 'houses', near: 'trees', farCol: '#5b6f7a', midCol: '#3d4a4c', nearCol: '#2c3a2c', decor: ['house', 'tree', 'lamp', 'fence', 'tree', 'pole'], dust: 'rgba(120,100,70,', props: ['crate', 'wreck', 'tire', 'barrier'], surface: 'grass' },
  highway: { ground: '#4b4038', top: '#4a4a4e', topHi: '#6b6b70', far: 'hills', mid: 'city', near: 'none', farCol: '#6a7a86', midCol: '#46525a', decor: ['billboard', 'lamp', 'sign', 'pole', 'rail'], dust: 'rgba(110,105,100,', props: ['wreck', 'wreck', 'barrier', 'crate', 'tire'], surface: 'asphalt' },
  refinery: { ground: '#3a2c22', top: '#403632', topHi: '#6a5a50', far: 'hills', mid: 'industry', near: 'pipes', farCol: '#6b3a2a', midCol: '#2a1a16', decor: ['tank', 'pipe', 'flare', 'lamp', 'fence'], dust: 'rgba(90,80,70,', props: ['barrel', 'barrel', 'crate', 'wreck', 'barrier'], surface: 'gravel', fires: true },
  desert: { ground: '#b88a55', top: '#d9b27a', topHi: '#efd39f', far: 'mesas', mid: 'dunes', near: 'none', farCol: '#b77c5a', midCol: '#c9955e', decor: ['cactus', 'rock', 'skull', 'pole', 'deadtree'], dust: 'rgba(200,170,120,', props: ['crate', 'wreck', 'tire', 'barrel'], surface: 'sand' },
  canyon: { ground: '#8a4f32', top: '#b36b42', topHi: '#d08a5a', far: 'mesas', mid: 'cliffs', near: 'none', farCol: '#a06248', midCol: '#7a4430', decor: ['rock', 'cactus', 'minecart', 'deadtree'], dust: 'rgba(170,110,80,', props: ['crate', 'barrel', 'tire'], surface: 'sand' },
  ghost: { ground: '#5a4632', top: '#7a6344', topHi: '#9c8260', far: 'mesas', mid: 'western', near: 'none', farCol: '#3a3344', midCol: '#241f28', decor: ['saloon', 'watertower', 'deadtree', 'pole', 'fence'], dust: 'rgba(120,100,80,', props: ['crate', 'barrel', 'wreck'], surface: 'dirt' },
  forest: { ground: '#3e3024', top: '#3f5a2e', topHi: '#5d7e42', far: 'mountains', mid: 'pines', near: 'pines', farCol: '#44505e', midCol: '#26332c', nearCol: '#1a241d', decor: ['pine', 'pine', 'rock', 'sign', 'log'], dust: 'rgba(90,80,60,', props: ['crate', 'tire', 'wreck'], surface: 'grass' },
  snow: { ground: '#6b6a70', top: '#e8eef4', topHi: '#ffffff', far: 'mountains', mid: 'snowpines', near: 'none', farCol: '#8a9aac', midCol: '#4a5a66', decor: ['snowpine', 'rock', 'sign', 'cabin'], dust: 'rgba(235,240,250,', props: ['crate', 'wreck', 'barrel'], surface: 'snow' },
  dam: { ground: '#56544e', top: '#7b7a74', topHi: '#a09f98', far: 'mountains', mid: 'damwall', near: 'none', farCol: '#2e3640', midCol: '#3b3f44', decor: ['lamp', 'rail', 'pole', 'sign'], dust: 'rgba(120,120,115,', props: ['barrier', 'wreck', 'crate', 'barrel'], surface: 'concrete' },
  docks: { ground: '#3a4046', top: '#555c62', topHi: '#737b82', far: 'city', mid: 'cranes', near: 'none', farCol: '#4d5866', midCol: '#2c333a', decor: [], dust: 'rgba(110,110,110,', props: [], surface: 'concrete', sea: true },
  sea: { ground: '#6a6048', top: '#c9b98a', topHi: '#e2d4a8', far: 'islands', mid: 'lighthouse', near: 'none', farCol: '#3f4d58', midCol: '#26313a', decor: [], dust: 'rgba(200,190,160,', props: [], surface: 'sand', sea: true },
  island: { ground: '#6b5a3e', top: '#58833e', topHi: '#7fae55', far: 'islands', mid: 'palms', near: 'none', farCol: '#5a7486', midCol: '#2c4a36', decor: ['palm', 'rock', 'bunker', 'fence', 'palm'], dust: 'rgba(190,170,120,', props: ['crate', 'barrel', 'wreck', 'sandbags'], surface: 'grass' },
  carrier: { ground: '#2b3034', top: '#4a5258', topHi: '#6d777e', far: 'ocean', mid: 'superstructure', near: 'none', farCol: '#1d2833', midCol: '#20262b', decor: ['deckmark', 'jet', 'lamp', 'deckmark'], dust: 'rgba(100,100,100,', props: ['crate', 'barrel', 'wreck', 'sandbags'], surface: 'steel', fires: true }
};

const CHAPTERS = [
  { title: 'Глава I', name: 'Пепел Верхнеречья', text: 'Прошло девять дней с тех пор, как Верхнеречье перестало отвечать на звонки. Сначала закрыли мост. Потом больницу. Потом — всё остальное. Механик Алекс Рой девять дней не выходил из своего гаража. На десятый у него кончилась вода.' },
  { title: 'Глава II', name: 'Мёртвая степь', text: 'Степь не прощает ошибок. Сотни километров пыли, соли и тишины — если не считать тех, кто бредёт по дороге следом, на звук мотора.' },
  { title: 'Глава III', name: 'Перевал', text: 'Горы встретили их холодом и дождём. Туда, где кончается асфальт, мертвецы забредают редко. Но те, что забрели, давно голодны.' },
  { title: 'Глава IV', name: 'Гавань утопленников', text: 'Вода поднялась до вторых этажей. Мыс Надежды превратился в город каналов — и мёртвые научились в них плавать.' },
  { title: 'Глава V', name: 'Северная звезда', text: 'Последний рывок. Остров, открытое море и корабль, на котором больше не осталось безопасных мест.', textB: 'Последний рывок. Остров, где бросили людей, открытое море и корабль, который придётся взять силой.' }
];

// реплика: кто, текст и параметры — name (подменить имя, напр. «???»), sfx (звук при показе)
const L = (who, text, o) => Object.assign({ who, text }, o || {});
// текст сцены с учётом ветки сюжета: после выбора «Стаи» у поздних уровней свои брифинги и финалы
function storyLines(lv, part, save) {
  const b = save && save.branch === 'raiders' && lv[part + 'B'];
  return b || lv[part];
}

const LEVELS = [
  {
    id: 'garages', vehicle: 'rust', finish: 'garage', chapter: 0, name: 'Гаражный кооператив', type: 'land', theme: 'suburbs', time: 'dawn', weather: 'clear', length: 900, seed: 101, diff: 0.1,
    pool: { flat: 3, hills: 3, ramp: 2, crates: 2, horde: 2, wrecks: 1, up: 1, down: 1 }, zombies: { walker: 10, runner: 1 },
    intro: [
      L('narrator', 'Гаражный кооператив «Прогресс», окраина Верхнеречья. Утро десятого дня.'),
      L('semyon', '…кто слышит — приём. Говорит Семён, радиоточка на водонапорной башне. Кто живой — отзовись…', { name: '???' }),
      L('alex', 'Семён? Это Алекс, сорок второй бокс. Живой. Пока что.'),
      L('semyon', 'Алекс! Слушай внимательно. Военные передают: в порту Мыс Надежды стоит судно «Северная звезда». Берут всех. Через семь дней снимаются с якоря.', { emo: 'surprised' }),
      L('alex', 'Порт в тысяче километров отсюда. А у меня только Ржавчик и полбака.', { emo: 'tired' }),
      L('semyon', 'Значит, по полбака за раз. Главное — не стой на месте. Они сбегаются на звук мотора.')
    ],
    outro: [
      L('alex', 'Выбрался из кооператива. Ржавчик кашляет, но едет.'),
      L('semyon', 'Молодец. Дальше трасса М-9 — там пробка на двадцать километров. Ищи просвет… и ради бога, найди машину поприличнее.', { emo: 'smile' })
    ]
  },
  {
    id: 'highway', vehicle: 'rust', finish: 'garage', chapter: 0, name: 'Трасса М-9', type: 'land', theme: 'highway', time: 'day', weather: 'clear', length: 1100, seed: 202, diff: 0.2,
    pool: { flat: 2, wrecks: 4, ramp: 2, horde: 2, barricade: 2, bumps: 1, hills: 1 }, zombies: { walker: 8, runner: 2, fatty: 1 },
    intro: [
      L('narrator', 'Трасса М-9. Все пытались уехать одновременно. Никто не уехал.'),
      L('alex', 'Сотни машин. Двери открыты, ключи в замках… и никого.'),
      L('semyon', 'Не совсем никого. Смотри в оба — они любят прятаться между машинами.'),
      L('alex', 'Вижу фермерский пикап на обочине. «Мул». Если доберусь до развязки — вернусь за ним.')
    ],
    outro: [
      L('alex', 'Развязка позади. Впереди — дым. Очень много дыма.'),
      L('semyon', 'Это НПЗ «Южный». Горит третьи сутки. Объезда нет, Алекс. Только насквозь.')
    ]
  },
  {
    id: 'refinery', vehicle: 'mule', finish: 'garage', chapter: 0, name: 'Горящий НПЗ', type: 'land', theme: 'refinery', time: 'dusk', sky: 'fire', weather: 'ash', length: 1250, seed: 303, diff: 0.3,
    pool: { flat: 2, barrels: 3, ramp: 2, pit: 2, wrecks: 1, horde: 2, up: 1, down: 1, crates: 1 }, zombies: { walker: 7, runner: 2, fatty: 2, bloater: 1 },
    intro: [
      L('alex', 'Вернулся за «Мулом». Бак полный, ключ в замке. Прощай, Ржавчик — ты довёз меня дальше, чем я думал.'),
      L('narrator', 'Нефтеперерабатывающий завод «Южный». Небо здесь оранжевое даже ночью.'),
      L('semyon', 'Держись подальше от красных бочек. Одна искра — и тебя будут собирать по всей области.'),
      L('alex', 'Спасибо, Семён. Очень ободряет.', { emo: 'smirk' }),
      L('semyon', 'За заводом начинается степь. Там и встретимся — поможешь мне с самолётом.'),
      L('alex', 'С каким ещё самолётом?'),
      L('semyon', 'С кукурузником. Стоит на старом аэродроме «Степной». Заведём — и до моря долетим за день.')
    ],
    outro: [
      L('alex', 'Семён? Приём… Семён?'),
      L('semyon', 'Алекс… их много…', { emo: 'fear' }),
      L('alex', 'Семён, где ты? Куда мне ехать?', { emo: 'fear' }),
      L('semyon', '…Нет! Стойте! Я не знал!..', { emo: 'fear' }),
      L('radio', '*выстрел*', { sfx: 'gunshot' }),
      L('alex', 'Семён! Приём!..', { emo: 'fear' }),
      L('radio', '…шшшш…', { sfx: 'static' }),
      L('alex', 'Чёрт… Ладно. Надо ехать дальше.', { emo: 'sad' })
    ]
  },
  {
    id: 'saltflat', vehicle: 'mule', finish: 'gas', chapter: 1, name: 'Солончак', type: 'land', theme: 'desert', time: 'noon', weather: 'dust', length: 1350, seed: 404, diff: 0.35,
    pool: { flat: 3, hills: 3, ramp: 3, pit: 1, horde: 3, wrecks: 1, gas: 1, bumps: 1 }, zombies: { walker: 6, runner: 4, fatty: 1 },
    intro: [
      L('narrator', 'Высохшее солёное озеро. Отсюда видно на двадцать километров во все стороны.'),
      L('alex', 'А значит, и меня видно на двадцать километров. Отлично.', { emo: 'smirk' }),
      L('mira', 'Эй, водитель! Да-да, ты. Вижу тебя в бинокль.', { name: '???' }),
      L('alex', 'Кто это?'),
      L('mira', 'Мира. Сижу на крыше заправки на том краю солончака. Внизу штук сорок голодных. Вытащишь меня — покажу короткую дорогу через каньон.'),
      L('alex', 'Держись. Еду.')
    ],
    outro: [
      L('alex', 'Как ты оказалась тут одна?'),
      L('mira', 'Нас было шестеро. Утром приехали люди на джипах, с вороньими черепами на капотах. Забрали бензин, еду и всех, кто может держать автомат.', { emo: 'sad' }),
      L('mira', 'Меня не взяли. Я укусила их главного.', { emo: 'smirk' }),
      L('mira', 'Ладно, неплохо для ржавого корыта. В гараже заправки стоит мой «Кузнечик» — эндуро. Бензин есть, храбрости тоже.', { emo: 'smile' }),
      L('alex', 'Мотоцикл? Против толпы?'),
      L('mira', 'Мотоцикл — против каньона. Там мосты такие, что грузовик не пройдёт. Увидишь.')
    ]
  },
  {
    id: 'canyon', passenger: 'mira', vehicle: 'hopper', finish: 'garage', chapter: 1, name: 'Каньон Висельника', type: 'land', theme: 'canyon', time: 'day', weather: 'clear', length: 1450, seed: 505, diff: 0.45,
    pool: { flat: 2, canyon: 4, hills: 2, ramp: 2, horde: 2, up: 1, down: 1, crates: 1 }, zombies: { walker: 6, runner: 3, fatty: 1 },
    intro: [
      L('narrator', '«Мул» остался у заправки. Дальше — вдвоём на «Кузнечике»: Алекс за рулём, Мира сзади показывает дорогу.'),
      L('narrator', 'Каньон Висельника. Старые шахтёрские мосты висят здесь на канатах с позапрошлого века.'),
      L('mira', 'Правило простое: на мосту не тормози. Остановишься — он начнёт раскачиваться.'),
      L('alex', 'А если упадём?'),
      L('mira', 'Внизу их целое гнездо. Так что не рискуй.', { emo: 'smirk' })
    ],
    outro: [
      L('alex', 'Каньон позади. Руки до сих пор трясутся.', { emo: 'tired' }),
      L('mira', 'За холмами — Сухой Лог, старый шахтёрский городок. Там можно переночевать. Наверное.')
    ]
  },
  {
    id: 'ghosttown', passenger: 'mira', vehicle: 'bull', finish: 'garage', chapter: 1, name: 'Сухой Лог', type: 'land', theme: 'ghost', time: 'night', weather: 'clear', length: 1500, seed: 606, diff: 0.5,
    pool: { flat: 2, hills: 2, ramp: 2, horde: 4, crates: 2, barrels: 1, wrecks: 1, pit: 1 }, zombies: { walker: 6, runner: 3, fatty: 2, bloater: 1 },
    intro: [
      L('narrator', 'Сухой Лог. Люди уехали отсюда ещё до конца света. Теперь сюда вернулись… не люди.'),
      L('mira', 'Слишком тихо. Мне это не нравится.', { emo: 'determined' }),
      L('alex', 'Смотри — в пожарном депо стоит маслкар. Кто-то очень любил свою машину.'),
      L('mira', '«Бультерьер»? Если заведёшь — я твоя навеки.', { emo: 'smile' }),
      L('alex', '…', { emo: 'sad' }),
      L('mira', 'Шучу. Но заведи.', { emo: 'smirk' }),
      L('alex', 'Завёлся! «Кузнечика» оставим в депо — на двоих он всё равно тесный.')
    ],
    outro: [
      L('alex', 'Выехали. Солнце встаёт.'),
      L('mira', 'Впереди горы. Перевал, потом плотина, потом — море. Пять дней, Алекс. Успеваем.'),
      L('alex', 'Если перевал открыт.'),
      L('mira', 'Он никогда не бывает открыт. Поэтому мы и не спрашиваем разрешения.', { emo: 'smile' })
    ]
  },
  {
    id: 'pines', passenger: 'mira', vehicle: 'bull', finish: 'garage', chapter: 2, name: 'Сосновый хребет', type: 'land', theme: 'forest', time: 'dusk', weather: 'rain', length: 1550, seed: 707, diff: 0.55,
    pool: { hills: 3, up: 3, down: 3, ramp: 2, horde: 2, canyon: 1, wrecks: 1, bumps: 2, crates: 1 }, zombies: { walker: 6, runner: 3, fatty: 2, soldier: 1 },
    intro: [
      L('narrator', 'Сосновый хребет. Дождь не прекращается третий день.'),
      L('mira', 'Дорога размыта. На спусках держи нос ниже, иначе кувыркнёшься.'),
      L('alex', 'Тихо! Рация что-то ловит.'),
      L('valtz', '…всем, кто слышит. Говорит капитан Ирина Вальц, судно «Северная звезда». Эвакуация продолжается. Отход через четыре дня. Повторяю…'),
      L('mira', 'Они ещё там. Они правда ещё там!', { emo: 'smile' })
    ],
    outro: [
      L('alex', 'Капитан Вальц, приём! Нас двое, идём с юга через перевал.'),
      L('valtz', 'Принято, юг. Порт частично потерян, но мы держим седьмой причал. Торопитесь.')
    ]
  },
  {
    id: 'avalanche', passenger: 'mira', vehicle: 'hound', finish: 'garage', chapter: 2, name: 'Лавинный склон', type: 'land', theme: 'snow', time: 'day', weather: 'snow', length: 1650, seed: 808, diff: 0.62,
    pool: { down: 3, up: 2, hills: 2, ramp: 3, pit: 2, bigdrop: 2, horde: 2, wrecks: 1, canyon: 1 }, zombies: { walker: 5, runner: 3, fatty: 2, soldier: 2 },
    intro: [
      L('narrator', 'Верхняя точка перевала. Здесь снег лежит даже летом.'),
      L('mira', 'Внизу база спасателей. Там стоит «Цербер» — байк их начальника. Он бы не возражал.'),
      L('alex', 'Откуда знаешь?'),
      L('mira', 'Он стоит у ворот. В смысле — всё ещё стоит. Без головы.', { emo: 'smirk' }),
      L('alex', '«Бультерьер» на этом снегу только буксует. Пересаживаемся. …Поехали.'),
      L('narrator', 'Над перевалом, почти задевая верхушки елей, прошёл старый кукурузник.'),
      L('raven', 'Приём, вы двое. Я Ворон. Вижу вас. Военным не верьте — твари они.'),
      L('alex', 'Что за…'),
      L('mira', 'Он на нашей частоте. И на самолёте.'),
      L('alex', 'На кукурузнике… Семён хотел лететь на таком.')
    ],
    outro: [
      L('mira', 'Слышишь гул? Это не лавина.'),
      L('alex', 'Это вода. Плотина Каменная… её никто не обслуживает уже две недели.'),
      L('valtz', 'Юг, осторожно: по нашим данным, плотину прорвёт в ближайшие часы. Долина станет рекой.')
    ]
  },
  {
    id: 'dam', passenger: 'mira', vehicle: 'hound', finish: 'garage', chapter: 2, raiders: 'neutral', name: 'Плотина Каменная', type: 'land', theme: 'dam', time: 'night', sky: 'storm', weather: 'storm', length: 1750, seed: 909, diff: 0.7,
    pool: { flat: 2, ramp: 3, pit: 3, barricade: 3, horde: 3, wrecks: 2, barrels: 1, brute: 1 }, zombies: { walker: 5, runner: 3, fatty: 2, soldier: 3, bloater: 1 },
    intro: [
      L('narrator', 'Плотина Каменная. Ночь. Гроза. По гребню плотины проходит единственная дорога к побережью.'),
      L('mira', 'Если плотину прорвёт, пока мы на ней…'),
      L('alex', 'Значит, мы проедем быстрее, чем её прорвёт.'),
      L('mira', 'Мне нравится твой оптимизм. Он безумный, но нравится.', { emo: 'smile' }),
      L('valtz', 'И ещё: военные оставили на гребне заслоны. Там кто-то большой. Очень большой.'),
      L('raven', 'А больше ничего не хочешь им рассказать, капитан?'),
      L('valtz', 'Опять ты?', { emo: 'angry' }),
      L('raven', 'Что, не соскучилась? Скоро увидимся. А вы двое — если хотите жить, езжайте быстрее. На плотине мои люди, их не трогайте.', { emo: 'smirk' }),
      L('mira', 'Вы знакомы?'),
      L('valtz', 'Бывший начальник охраны порта. Дезертир. Не отвечайте ему.')
    ],
    outro: [
      L('narrator', 'За их спинами бетон не выдержал. Миллионы тонн воды хлынули в долину.'),
      L('mira', 'Мы… мы живы?', { emo: 'surprised' }),
      L('alex', 'Живы. И видим море.', { emo: 'smile' }),
      L('valtz', 'Юг, плохие новости. Порт пал. «Северная звезда» отошла от причала. Ждём вас в заливе у маяка до рассвета послезавтра. Потом — уходим.'),
      L('raven', 'Порт не пал, капитан. Порт взяли мы.', { emo: 'smirk' })
    ]
  },
  {
    id: 'docks', passenger: 'mira', vehicle: 'gull', finish: 'boathouse', chapter: 3, raiders: 'neutral', name: 'Затопленные доки', type: 'sea', theme: 'docks', time: 'dusk', weather: 'clear', length: 1500, seed: 1010, diff: 0.5, waves: 0.45,
    pool: { open: 2, debris: 3, pier: 3, swimmers: 3, sandbar: 1, wreckramp: 2 }, zombies: { walker: 5, runner: 2, swimmer: 6 },
    intro: [
      L('narrator', 'Порт Мыс Надежды. Точнее, то, что от него осталось.'),
      L('alex', 'Колёса здесь бесполезны. Нужна лодка.'),
      L('raven', 'Мои ребята оставили вам лодку у рыбацкого пирса. «Чайка». Забирайте — подарок.'),
      L('alex', 'С чего такая щедрость?'),
      L('raven', 'Нам нужны люди, которые умеют выживать. Выберетесь из доков — поговорим.'),
      L('mira', 'Мотор старый, но я такие заводила лет с пяти.'),
      L('mira', 'Следи, чтобы винт был в воде: в воздухе он просто молотит пустоту. И осторожно с мусором — и с тем, что под ним плавает.')
    ],
    outro: [
      L('alex', 'Выбрались из доков. Отсюда видно маяк.'),
      L('mira', 'Шторм идёт. Большой. «Чайка» его не переживёт.'),
      L('alex', 'Смотри, в ангаре контрабандистов — катер «Барракуда». Хозяин, кажется, уже не вернётся.'),
      L('valtz', 'Подтверждаю, юг. Шторм девять баллов. Держитесь носом к волне и не глушите мотор.'),
      L('raven', 'А теперь слушай внимательно, Алекс. «Северная звезда» не берёт всех. Кто не прошёл их проверку — того везут на остров Карантин и бросают там.'),
      L('raven', 'И твоего радиста, Семёна, пристрелили военные. За болтовню в эфире.', { emo: 'determined' }),
      L('alex', '…', { emo: 'sad' }),
      L('raven', 'Пришло время выбирать. Кого ты выберешь — их или нас?', { emo: 'determined', choice: [{ label: 'Военных — у них корабль', value: 'military' }, { label: '«Стаю» — за брошенных на Карантине', value: 'raiders' }] }),
      L('alex', 'Ворон, я всё понимаю. Но я за военных. У них есть корабль. А у тебя — только злость.', { branch: 'military', emo: 'determined' }),
      L('raven', 'Тогда пришло время вам всем умереть!', { branch: 'military', emo: 'angry' }),
      L('mira', 'Кажется, врагов у нас стало больше.', { branch: 'military', emo: 'tired' }),
      L('alex', 'Если про Карантин это правда… то я с вами, Ворон.', { branch: 'raiders' }),
      L('raven', 'Правильный выбор, механик. Добро пожаловать в Стаю.', { branch: 'raiders', emo: 'smile' }),
      L('valtz', 'Юг! Алекс, не делайте этого. Вы не знаете, кто он такой.', { branch: 'raiders' }),
      L('raven', 'Зато он теперь знает, кто вы, капитан. Отбой.', { branch: 'raiders' }),
      L('mira', 'Алекс… надеюсь, ты знаешь, что делаешь.', { branch: 'raiders', emo: 'sad' })
    ]
  },
  {
    id: 'storm', passenger: 'mira', afterChoice: true, vehicle: 'cuda', finish: 'boathouse', chapter: 3, name: 'Шторм у маяка', type: 'sea', theme: 'sea', time: 'night', sky: 'storm', weather: 'storm', length: 1800, seed: 1111, diff: 0.62, waves: 1.3,
    pool: { open: 4, swimmers: 3, debris: 2, wreckramp: 2, sandbar: 1, island: 1 }, zombies: { swimmer: 8, walker: 2 },
    intro: [
      L('narrator', 'Залив у маяка. Волны высотой с дом.'),
      L('alex', 'Скажи честно — у тебя морская болезнь?'),
      L('mira', 'А ты скажи честно — ты умеешь управлять лодкой?'),
      L('alex', 'Нет.'),
      L('mira', 'Тогда у меня морская болезнь.', { emo: 'smirk' }),
      L('valtz', 'Мы видим ваш огонь. Идите на прожектор маяка.'),
      L('valtz', 'И ещё, юг: на радаре малые цели. Идут к вам. Это не рыбаки.'),
      L('mira', 'Катера Ворона. С автоматами. Не давай им встать рядом — тарань или уходи на полном ходу.')
    ],
    outro: [
      L('valtz', '…юг, «Северная звезда» атакована изнутри. Среди эвакуированных были заражённые. Мы теряем нижние палубы.'),
      L('mira', 'Что? Капитан! Приём!'),
      L('raven', 'Я же обещал, капитан. Мои люди поднялись к вам на борт вместе с беженцами. И привели с собой гостей.', { emo: 'smirk' }),
      L('valtz', 'Уходим через Минный пролив. У пограничного пирса стоит катер «Броненосец» — берите. Встречаемся у острова Карантин.')
    ],
    introB: [
      L('narrator', 'Залив у маяка. Волны высотой с дом.'),
      L('alex', 'Скажи честно — у тебя морская болезнь?'),
      L('mira', 'А ты скажи честно — ты умеешь управлять лодкой?'),
      L('alex', 'Нет.'),
      L('mira', 'Тогда у меня морская болезнь.', { emo: 'smirk' }),
      L('raven', 'Мой катер идёт рядом. У маяка патруль Вальц — серые лодки с пулемётами. Они стреляют по всему, что плывёт к Карантину.'),
      L('mira', 'Ещё вчера мы плыли к ним на корабль. Сегодня они стреляют в нас. Отличный день.', { emo: 'smirk' })
    ],
    outroB: [
      L('narrator', 'Последний патрульный катер ушёл под воду у самого маяка.'),
      L('valtz', 'Юг… Алекс. На тех катерах были мои люди. Мальчишки.', { emo: 'sad' }),
      L('raven', 'А на Карантине — старики и дети, капитан. Война.', { emo: 'angry' }),
      L('valtz', '«Северная звезда» уходит в открытое море. Больше не выходите на эту частоту.'),
      L('raven', 'Дальше — Минный пролив. Военные заминировали его, чтобы с Карантина никто не уплыл. У пограничного пирса стоит «Броненосец» — берите.')
    ]
  },
  {
    id: 'mines', passenger: 'mira', afterChoice: true, vehicle: 'clad', finish: 'boathouse', chapter: 3, name: 'Минный пролив', type: 'sea', theme: 'sea', time: 'day', sky: 'fog', weather: 'fog', length: 1900, seed: 1212, diff: 0.72, waves: 0.7,
    pool: { open: 2, mines: 4, swimmers: 2, debris: 2, wreckramp: 2, pier: 1, sandbar: 1 }, zombies: { swimmer: 7, walker: 3, soldier: 1 },
    intro: [
      L('narrator', '«Барракуда» осталась у пограничного пирса с пробитым днищем. Теперь у них «Броненосец» — сталь, дизель и пулемётное гнездо.'),
      L('narrator', 'Минный пролив. Туман такой густой, что мины видно, только когда они уже рядом.'),
      L('mira', 'Мигающие красные огоньки — это мины. Не трогай мигающие красные огоньки.'),
      L('alex', 'Понял: красное — плохо.'),
      L('mira', 'И зомби на плотах. Кто вообще научил их плавать на плотах?'),
      L('alex', 'На плотах не только зомби. Люди Ворона тоже здесь. Хорошо, что теперь у нас есть пулемёт.')
    ],
    outro: [
      L('alex', 'Остров. Вижу остров!'),
      L('valtz', 'Остров Карантин. Там заброшенная военная база и топливо. «Северная звезда» подойдёт к северному берегу. Пересеките остров.')
    ],
    introB: [
      L('narrator', '«Барракуда» осталась у пограничного пирса с пробитым днищем. Теперь у них «Броненосец» — сталь, дизель и пулемётное гнездо.'),
      L('narrator', 'Минный пролив. Туман такой густой, что мины видно, только когда они уже рядом.'),
      L('mira', 'Мигающие красные огоньки — это мины. Не трогай мигающие красные огоньки.'),
      L('alex', 'Понял: красное — плохо.'),
      L('raven', 'В проливе военные патрули. Серые катера — ваши. Мои — с чёрными флагами, их не трогать.')
    ],
    outroB: [
      L('alex', 'Остров. Вижу остров!'),
      L('raven', 'Карантин. Лагерь за северной базой. Охрана — военные. Пробейтесь к воротам, остальное сделаем мы.'),
      L('mira', 'А если там никого нет?'),
      L('raven', 'Там есть. Уже неделю есть.')
    ]
  },
  {
    id: 'island', afterChoice: true, vehicle: 'jugg', finish: 'garage', chapter: 4, name: 'Остров Карантин', type: 'land', theme: 'island', time: 'day', weather: 'clear', length: 1900, seed: 1313, diff: 0.75,
    pool: { hills: 3, ramp: 3, barricade: 3, horde: 3, pit: 2, bigdrop: 1, canyon: 1, barrels: 1, brute: 1, gas: 1 }, zombies: { walker: 4, runner: 3, fatty: 2, soldier: 4, bloater: 1 },
    intro: [
      L('narrator', 'Остров Карантин. Когда-то сюда свозили больных чумой. История любит повторяться.'),
      L('narrator', 'За колючей проволокой — палаточный лагерь. Пустой. Только таблички с номерами.'),
      L('mira', 'Значит, Ворон не врал. Здесь держали тех, кого не взяли на корабль.', { emo: 'sad' }),
      L('valtz', '…Мы брали всех, кто прошёл проверку. Остальные ждали второго рейса.', { emo: 'sad' }),
      L('alex', 'И где они теперь?'),
      L('valtz', 'С ним. Остров держат люди Ворона. Будьте осторожны.'),
      L('mira', 'В ангаре базы стоит инкассаторский броневик. «Джаггернаут». По-моему, это знак.'),
      L('alex', 'Это знак, что его кто-то бросил. Но я возьму.'),
      L('mira', 'Тогда разделимся. Я обогну остров на «Броненосце», а ты пробейся через базу. Встречаемся у северного ангара.'),
      L('valtz', 'Юг, мы у северного берега, но долго ждать не сможем.')
    ],
    outro: [
      L('narrator', 'У северного ангара стоял кукурузник. На сиденье пилота лежала рация Семёна — пробитая пулей.'),
      L('alex', 'Это не военные его убили. Это твои люди, Ворон.', { emo: 'angry' }),
      L('raven', 'Старик сам виноват. Звал всех на корабль, где мест хватит не всем.', { emo: 'determined' }),
      L('alex', 'Северный берег! Где корабль?'),
      L('mira', 'Вон он… Он уходит. Алекс, он уходит!', { emo: 'fear' }),
      L('valtz', 'Простите. Нас атакуют. Держим курс в открытое море. Догоните — спустим аппарель. Если нет… простите.', { emo: 'sad' })
    ],
    introB: [
      L('narrator', 'Остров Карантин. Когда-то сюда свозили больных чумой. История любит повторяться.'),
      L('narrator', 'За колючей проволокой — палаточный лагерь. Сотни людей у сетки смотрят на море.'),
      L('mira', 'Ворон не врал. Их правда бросили.', { emo: 'sad' }),
      L('valtz', 'Юг, послушайте. Мы брали всех, кто прошёл проверку. Остальные ждали второго рейса. Мы не звери.'),
      L('alex', 'Второго рейса не будет, капитан. Мы оба это знаем.', { emo: 'determined' }),
      L('mira', 'В ангаре базы стоит инкассаторский броневик. «Джаггернаут». Им ворота и снесём.'),
      L('raven', 'Лагерь охраняют солдаты. Они будут стрелять. Мои ребята прикроют.')
    ],
    outroB: [
      L('narrator', 'Ворота лагеря упали под колёсами «Джаггернаута». Люди Ворона повели беженцев к берегу.'),
      L('narrator', 'У северного ангара стоял кукурузник. На сиденье пилота лежала рация Семёна — пробитая пулей.'),
      L('alex', 'Ворон. Откуда в твоём самолёте рация Семёна?', { emo: 'angry' }),
      L('raven', 'Старик сам виноват. Звал всех на корабль, где мест хватит не всем.', { emo: 'determined' }),
      L('mira', 'Мы воюем на стороне тех, кто его убил.', { emo: 'sad' }),
      L('alex', 'Сначала вытащим людей. С Вороном разберусь потом.'),
      L('raven', '«Северная звезда» уходит. Догоняйте на «Броненосце» — мои люди на борту откроют кормовую аппарель.')
    ]
  },
  {
    id: 'chase', passenger: 'mira', afterChoice: true, vehicle: 'clad', finish: 'shipramp', chapter: 4, name: 'Погоня', type: 'sea', theme: 'sea', time: 'dusk', sky: 'storm', weather: 'rain', length: 2000, seed: 1414, diff: 0.82, waves: 1.0,
    pool: { open: 3, swimmers: 3, debris: 3, mines: 2, wreckramp: 3, sandbar: 1 }, zombies: { swimmer: 9, walker: 3, soldier: 2 },
    intro: [
      L('narrator', 'Открытое море. Впереди — огни «Северной звезды». Позади — остров, над которым поднимается дым.'),
      L('narrator', '«Джаггернаут» остался в ангаре на берегу. Мира подогнала «Броненосец» к причалу — Алекс прыгнул на борт на ходу.'),
      L('mira', 'Мы догоним. Мы должны догнать.'),
      L('raven', 'Далеко собрался, Алекс? Мои катера быстрее твоего корыта.', { emo: 'smirk' }),
      L('alex', 'Держись крепче. Выжимаю всё.'),
      L('valtz', 'Вижу вас на радаре! Вы безумцы. Опускаем кормовую аппарель!', { emo: 'smile' })
    ],
    outro: [
      L('narrator', 'Катер влетел на кормовую аппарель в последний момент. За спиной с грохотом сомкнулись стальные ворота.'),
      L('valtz', 'Добро пожаловать на борт. Плохая новость: между вами и носовой площадкой — два километра палубы, и она больше не наша.'),
      L('alex', 'Что на носовой площадке?'),
      L('valtz', 'Вертолёт. Последний. В ангаре найдёте технику — всё, что заправлено, ваше.'),
      L('valtz', 'И ещё. Ворон на борту.')
    ],
    introB: [
      L('narrator', 'Открытое море. Впереди — огни «Северной звезды». Позади — Карантин и сотни людей на берегу.'),
      L('narrator', '«Джаггернаут» остался у ворот лагеря. Мира подогнала «Броненосец» к причалу — Алекс прыгнул на борт на ходу.'),
      L('valtz', 'Всем катерам охраны: огонь по «Броненосцу». Простите, Алекс.'),
      L('mira', 'Мы догоним. Мы должны догнать.'),
      L('raven', 'Жми, механик! Аппарель откроется через три минуты. Не успеете — второго шанса не будет.')
    ],
    outroB: [
      L('narrator', 'Катер влетел на кормовую аппарель в последний момент. За спиной с грохотом сомкнулись стальные ворота.'),
      L('raven', 'Корабль почти наш. Военные держат только нос.'),
      L('alex', 'Что на носу?'),
      L('raven', 'Вертолёт. Вальц хочет улететь, пока мы разворачиваем корабль к Карантину. В ангаре техника — берите всё, что заправлено.'),
      L('mira', 'Алекс. Не дай ему никого убить.', { emo: 'sad' })
    ]
  },
  {
    id: 'carrier', passenger: 'mira', afterChoice: true, vehicle: 'rhino', finish: 'helipad', chapter: 4, name: 'Палуба «Северной звезды»', type: 'land', theme: 'carrier', time: 'night', sky: 'fire', weather: 'rain', length: 2100, seed: 1515, diff: 0.92,
    pool: { flat: 2, ramp: 3, barricade: 4, horde: 4, barrels: 2, wrecks: 2, pit: 1, brute: 2 }, zombies: { walker: 4, runner: 4, fatty: 2, soldier: 5, bloater: 2 },
    final: true,
    intro: [
      L('narrator', 'В ангаре корабля нашёлся армейский бронетранспортёр «Носорог». Заправленный.'),
      L('narrator', 'Грузовая палуба «Северной звезды». Два километра стали, огня и мертвецов.'),
      L('mira', 'Вертолёт на носовой площадке! Если доберёмся — улетим все вместе.'),
      L('valtz', 'На носу трамплин — старая погрузочная аппарель. Разгоняйтесь и прыгайте на площадку. Мы держим её, сколько сможем.'),
      L('raven', 'Добро пожаловать на мою палубу, Алекс.', { emo: 'smirk' }),
      L('alex', 'Мира. Если что…', { emo: 'sad' }),
      L('mira', 'Никаких «если что». Жми на газ.', { emo: 'determined' })
    ],
    outro: [
      L('narrator', 'Машина оторвалась от трамплина и на мгновение повисла над чёрной водой.'),
      L('narrator', 'Колёса ударились о посадочную площадку. Винты вертолёта уже рвали дождь на части.'),
      L('valtz', 'Все на борту! Взлетаем!'),
      L('raven', 'Ты выбрал их, Алекс… Посмотрим, спасут ли они тебя.', { emo: 'angry' }),
      L('narrator', 'Внизу, на горящей палубе, осталась фигура в чёрном. Она больше не стреляла.'),
      L('mira', 'Алекс… мы сделали это. Мы правда сделали это.', { emo: 'smile' }),
      L('alex', 'Куда летим, капитан?'),
      L('valtz', 'На север. Говорят, на Зелёных островах есть город, где по ночам горит свет и никто не запирает двери.'),
      L('alex', 'А потом?'),
      L('valtz', 'А потом — второй рейс. На Карантин. Обещаю.', { emo: 'smile' }),
      L('narrator', 'Позади остались семь дней и тысяча мёртвых миль. Впереди был рассвет.'),
      L('narrator', 'КОНЕЦ «Северная звезда». Есть и другая концовка — выберите в доках «Стаю».')
    ],
    introB: [
      L('narrator', 'В ангаре корабля нашёлся армейский бронетранспортёр «Носорог». Заправленный.'),
      L('narrator', 'Грузовая палуба «Северной звезды». Два километра стали, огня, мертвецов — и последних солдат капитана Вальц.'),
      L('raven', 'Прорывайтесь к носу, мы идём следом. Вертолёт не должен взлететь.'),
      L('valtz', 'Юг, в вертолёте раненые. Если вы нас остановите, они не доживут до утра.', { emo: 'sad' }),
      L('mira', 'Алекс, это уже не наша война.', { emo: 'sad' }),
      L('alex', 'Доедем до площадки — там и решим, чья она.')
    ],
    outroB: [
      L('narrator', '«Носорог» с грохотом встал на посадочную площадку перед самым вертолётом.'),
      L('valtz', 'Всё, юг. Ваша взяла. Только отпустите раненых.', { emo: 'tired' }),
      L('raven', 'Вертолёт никуда не летит, капитан.'),
      L('alex', 'Летит. С ранеными и с капитаном.'),
      L('raven', 'Ты забыл, на чьей ты стороне, механик?', { emo: 'angry' }),
      L('alex', 'На стороне Семёна. Он звал всех на корабль. Корабль остаётся тебе, Ворон, — и ты развернёшь его к Карантину. За всеми.', { emo: 'determined' }),
      L('raven', '…А если нет?'),
      L('mira', 'Тогда проверим, кто из нас быстрее стреляет.', { emo: 'determined' }),
      L('raven', 'Ха. Старик бы тобой гордился. Разворачиваем корабль!', { emo: 'smile' }),
      L('mira', 'Я улетаю с ними, Алекс. Не могу остаться с людьми, которые убили Семёна.', { emo: 'sad' }),
      L('alex', 'Понимаю. Береги себя, Мира.', { emo: 'sad' }),
      L('narrator', 'Вертолёт ушёл на север. «Северная звезда» развернулась на юг, к Карантину.'),
      L('narrator', 'Через два дня на её палубу поднялись шестьсот человек, которых никто не собирался спасать.'),
      L('narrator', 'Иногда по ночам Алекс включал рацию на старой частоте Семёна. Никто не отвечал.'),
      L('narrator', 'КОНЕЦ «Стая». Есть и другая концовка — выберите в доках военных.')
    ]
  }
];

const SPEAKERS = {
  narrator: { name: '', color: '#d6c7a1' },
  alex: { name: 'Алекс', color: '#f0a040' },
  semyon: { name: 'Дед Семён (рация)', color: '#8fc0e0' },
  mira: { name: 'Мира', color: '#e57399' },
  valtz: { name: 'Капитан Вальц', color: '#8fe0b0' },
  raven: { name: 'Ворон', color: '#d0d4dc' },
  radio: { name: 'Рация', color: '#888' }
};

/* ------------------------------ Волны ------------------------------ */
// амплитуда может расти по длине трассы (шторм нарастает)
function makeWater(a0, a1, len) {
  const A0 = a0, A1 = a1 === undefined ? a0 : a1, LEN = len || 1;
  return {
    amp: Math.max(A0, A1),
    level: 0,
    ampAt(x) { return A0 + (A1 - A0) * clamp(x / LEN, 0, 1); },
    height(x, t) {
      const amp = A0 + (A1 - A0) * clamp(x / LEN, 0, 1);
      return amp * (0.55 * Math.sin(0.19 * x - 1.25 * t) + 0.3 * Math.sin(0.43 * x + 0.85 * t + 1.3) + 0.15 * Math.sin(0.93 * x - 2.2 * t + 0.4));
    }
  };
}

/* ------------------------------ Сборка трассы ------------------------------ */

// ширина основания декораций (для проверки ровности под ними)
const DECOR_FOOT = { house: 8, saloon: 9, tank: 7, cabin: 7, bunker: 6.5, jet: 16, billboard: 6, watertower: 5, gasstation: 22, fence: 5, rail: 7, pipe: 10, tree: 3, pine: 4, snowpine: 4, palm: 2, rock: 3.2, minecart: 2.5, log: 4 };
const FINISH_STOP = { garage: 8, gas: 7, boathouse: 9, shipramp: 16, helipad: 11 };
const ZOMBIE_KIND = { w: 'walker', r: 'runner', f: 'fatty', s: 'soldier', b: 'bloater' };

function profileHeight(profile, x) {
  if (x <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const [x1, h1] = profile[i - 1], [x2, h2] = profile[i];
    if (x <= x2) {
      const t = (x - x1) / Math.max(1e-6, x2 - x1);
      return h1 + (h2 - h1) * t * t * (3 - 2 * t);
    }
  }
  return profile[profile.length - 1][1];
}

function pointInPoly(px, py, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i], [xj, yj] = verts[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function generateLevel(def, opts = {}) {
  // ветка сюжета: после выбора «Стаи» на поздних уровнях враги — военные, а люди Ворона — союзники
  const branchB = opts.branch === 'raiders' && !!def.afterChoice;
  const humanSide = branchB ? 'military' : 'raiders';
  const rng = mulberry32(def.seed);
  const R = (a, b) => a + (b - a) * rng();
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const sea = def.type === 'sea';
  const theme = THEMES[def.theme];
  const design = LEVEL_DESIGN[def.id];
  const x0 = -90;
  const total = def.length + 360;
  const T = new Terrain(x0, total - x0, 0.5);
  T.zones = [];
  const spawns = [], decor = [], issues = [];
  const idx = x => clamp(Math.round((x - x0) / T.dx), 0, T.n - 1);
  const smooth = t => t * t * (3 - 2 * t);
  const phaseA = R(0, 10), phaseB = R(0, 10);
  const noise = (x) => Math.sin(x * 0.13 + phaseA) * 0.5 + Math.sin(x * 0.31 + phaseB) * 0.25 + Math.sin(x * 0.71) * 0.1;
  const fill = (xa, xb, fn) => {
    const i0 = idx(xa), i1 = idx(xb);
    for (let i = i0; i <= i1; i++) {
      const xx = x0 + i * T.dx;
      const t = xb > xa ? clamp((xx - xa) / (xb - xa), 0, 1) : 1;
      T.h[i] = fn(xx, t);
    }
  };
  const add = (x, make, kind = 'prop', meta = {}) => { const s = Object.assign({ x, make, kind }, meta); spawns.push(s); return s; };
  const zTypes = Object.entries(def.zombies);
  const pickZombie = (filter) => {
    const list = filter ? zTypes.filter(([k]) => filter(k)) : zTypes;
    if (!list.length) return sea ? 'swimmer' : 'walker';
    const tot = list.reduce((a, [, w]) => a + w, 0);
    let r = rng() * tot;
    for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
    return list[0][0];
  };
  const zombie = (x, type, yOverride) => add(x, g => new Zombie(g, type, x, yOverride !== undefined ? yOverride : g.world.terrain.heightAt(x) + 0.05), 'zombie', { zx: x, zy: yOverride });
  const raider = (x, yOverride, neutral, faction) => add(x, g => new Raider(g, x, yOverride !== undefined ? yOverride : g.world.terrain.heightAt(x) + 0.05, { neutral: neutral !== undefined ? neutral : def.raiders === 'neutral', faction: faction || humanSide }), 'zombie', { zx: x, zy: yOverride });
  const pickup = (x, type, y) => add(x, g => g.addPickup(x, y, type), 'pickup', { py: y, ptype: type });

  // ---------- старт ----------
  const startH = sea ? -2.5 : (design ? profileHeight(design.profile, 0) : 0);
  fill(x0, -60, (xx) => (sea ? 6 : startH) + (-60 - xx) * 1.2);
  if (sea) {
    fill(-60, -25, () => -2.5);
    add(-60, g => new StaticBlock(g, [[-62, -3], [-14, -3], [-14, 1.3], [-62, 1.3]], { style: 'wood', legs: [-50, -40, -30, -20], legTop: -3 }), 'static');
    decor.push({ type: 'startdock', x: -40, y: 1.3 });
  } else {
    fill(-60, 0, () => startH);
    decor.push({ type: 'start', x: -18, y: startH });
  }

  const goalX = def.length;
  const fin = def.finish || (sea ? 'boathouse' : 'garage');
  const statics = [];      // [verts, label] — для проверки пересечений
  const uppers = [];       // {x1,x2,top}
  const result = { avalanche: null, deaths: [] };

  if (opts.demo || !design) {
    // дорога для катсцен/меню: без препятствий, мягкие холмы, редкие зомби
    const startX = sea ? -25 : 0;
    if (sea) fill(startX, T.xEnd, (xx, t) => lerp(-2.5, -18, clamp((xx - startX) / 35, 0, 1)) + noise(xx) * clamp((xx - startX) / 35, 0, 1));
    else fill(startX, T.xEnd, (xx) => {
      const k = clamp((xx - startX) / 60, 0, 1);
      return startH + k * (1.1 * Math.sin((xx - startX) * 0.045) + 0.7 * Math.sin(xx * 0.021 + 1.3));
    });
    for (let zx = 90; zx < total - 120; zx += R(28, 48)) {
      const n = RI(1, 3);
      for (let i = 0; i < n; i++) {
        const px = zx + i * R(1.2, 2.5);
        if (sea) zombie(px, 'swimmer', 0);
        else zombie(px, pickZombie(k => k !== 'swimmer' && k !== 'brute' && k !== 'bloater'));
      }
    }
  } else {
    const items = design.items.filter(it => !it.side || (it.side === 'B') === branchB);
    // ---------- рельеф ----------
    const flatFrom = def.final ? Infinity : goalX - 45;
    const base = (xx) => profileHeight(design.profile, Math.min(xx, flatFrom, goalX + 400));
    if (sea) fill(-25, T.xEnd, (xx) => xx < 10 ? lerp(-2.5, base(10), smooth(clamp((xx + 25) / 35, 0, 1))) : base(xx));
    else fill(0, T.xEnd, (xx) => base(xx));
    // пропасти под мостами, провалы под обрушением
    for (const [a, b, depth] of (design.chasm || [])) fill(a + 1.5, b - 1.5, () => depth);
    for (const it of items) {
      if (it.t === 'collapse') { const d = base(it.x) - 22; fill(it.x - 1, it.x2 + 1, () => d); }
      if (it.t === 'reef') {
        const top = -0.5;
        fill(it.x - 8, it.x2 + 8, (xx) => {
          const k = xx < it.x ? smooth((xx - it.x + 8) / 8) : xx > it.x2 ? smooth((it.x2 + 8 - xx) / 8) : 1;
          return lerp(base(xx), top, k);
        });
      }
    }
    const g = (x) => T.heightAt(x);
    const gMin = (a, b) => { let m = Infinity; for (let x = a; x <= b; x += 0.5) m = Math.min(m, g(x)); return m; };
    const gMax = (a, b) => { let m = -Infinity; for (let x = a; x <= b; x += 0.5) m = Math.max(m, g(x)); return m; };
    const rampStyle = sea ? 'rust' : theme.surface === 'steel' ? 'metal' : (theme.surface === 'concrete' || theme.surface === 'asphalt') ? 'concrete' : 'wood';
    const addStatic = (verts, make, label) => { statics.push({ verts, label }); return add(Math.min(...verts.map(v => v[0])), make, 'static'); };
    const makeRamp = (xTop, yTop, len, style, label) => {
      const bottom = gMin(xTop - len, xTop) - 0.6;
      const verts = [[xTop - len, bottom], [xTop, bottom], [xTop, yTop], [xTop - 0.35, yTop]];
      addStatic(verts, gg => new StaticBlock(gg, verts, { style, friction: sea ? 0.15 : 0.8 }), label);
    };

    // верхние ярусы заменяют стоящие прямо перед ними трамплины
    for (const up of items.filter(i => i.t === 'upper')) {
      for (let k = items.length - 1; k >= 0; k--) {
        const r = items[k];
        if (r.t === 'ramp' && r.x < up.x && r.x > up.x - 25) items.splice(k, 1);
      }
    }

    for (const it of items) {
      switch (it.t) {
        case 'ramp': {
          const yTop = g(it.x) + it.h;
          makeRamp(it.x, yTop, Math.max(5, it.h * 3.2), rampStyle, 'трамплин');
          break;
        }
        case 'upper': {
          const top = it.h === 0 ? Math.max(g(it.x - 3), g(it.x2 + 3)) + 0.05 : g(it.x) + it.h;
          // за разрывом плита на 1 м ниже: машина приземляется, а не бьётся в торец
          const segs = it.gap ? [[it.x, it.gap[0], top], [it.gap[1], it.x2, top - 1.0]] : [[it.x, it.x2, top]];
          for (const [a, b, sTop] of segs) {
            const st = PLATFORM_STYLE[it.style] || PLATFORM_STYLE.roof;
            const verts = [[a, sTop - st.th], [b, sTop - st.th], [b, sTop], [a, sTop]];
            addStatic(verts, gg => new Platform(gg, a, b, sTop, it.style), 'ярус');
          }
          uppers.push({ x1: it.x, x2: it.x2, top, gap: it.gap, th: (PLATFORM_STYLE[it.style] || PLATFORM_STYLE.roof).th });
          // заезд: трамплин почти вровень с ярусом и небольшой разрыв — на скорости запрыгиваешь, медленно — падаешь на нижний путь
          if (it.h > 0) {
            const xr = it.x - 1.8;
            const rise = top + 0.15 - g(xr);
            makeRamp(xr, top + 0.15, Math.max(6, rise * 3), rampStyle, 'заезд на ярус');
          }
          // проверка просвета под ярусом
          if (it.h > 0) {
            const clearance = top - (PLATFORM_STYLE[it.style] || PLATFORM_STYLE.roof).th - gMax(it.x, it.x2);
            const vd = VEHICLE_BY_ID[def.vehicle];
            let vh = 2.2;
            if (vd && vd.wheels) vh = Math.max(...vd.hull.flat().map(p => p[1])) - Math.min(...vd.wheels.map(w => w.y - w.r)) + (vd.type === 'bike' ? 1.3 : 0);
            if (clearance < vh + 0.7) issues.push(`R4 ярус ${it.x}–${it.x2}: просвет ${clearance.toFixed(1)} м при высоте транспорта ${vh.toFixed(1)} м`);
          }
          break;
        }
        case 'bridge': {
          const rimA = g(it.x - 0.5), rimB = g(it.x2 + 0.5);
          const rim = Math.max(rimA, rimB);
          const yA = rimA - 0.1, yB = rimB - 0.1;
          const pieces = [];
          if (it.pillar !== undefined) {
            const p = it.pillar, floor = g(p) - 1;
            const pr = it.jump && it.gap ? it.gap[0] : p + 0.6;
            const pl = p - 0.6;
            const pv = [[pl - 0.2, floor], [pr + 0.2, floor], [pr, rim - 0.12], [pl, rim - 0.12]];
            addStatic(pv, gg => new StaticBlock(gg, pv, { style: 'rock' }), 'опора моста');
            pieces.push([it.x, yA, pl, rim - 0.12]);
            if (it.jump && it.gap) {
              // трамплин на опоре перед разрывом
              const rv = [[pl + 1, rim - 0.12], [pr, rim - 0.12], [pr, rim + 1.0], [pr - 0.3, rim + 1.0]];
              addStatic(rv, gg => new StaticBlock(gg, rv, { style: 'wood' }), 'трамплин на опоре');
              const post = it.gap[1];
              const qv = [[post - 0.5, g(post) - 1], [post + 0.5, g(post) - 1], [post + 0.4, rim - 0.12], [post - 0.4, rim - 0.12]];
              addStatic(qv, gg => new StaticBlock(gg, qv, { style: 'rock' }), 'столб за разрывом');
              pieces.push([post + 0.4, rim - 0.12, it.x2, yB]);
            } else pieces.push([p + 0.6, rim - 0.12, it.x2, yB]);
          } else pieces.push([it.x, yA, it.x2, yB]);
          for (const [a, ya, b, yb] of pieces) add(it.x, gg => new Bridge(gg, a, ya, b, yb, { plank: 1.0 }), 'bridge');
          break;
        }
        case 'wreck': {
          for (let i = 0; i < (it.n || 1); i++) {
            const wx = it.x + i * 4.3;
            if (i === 2 && it.n >= 3) { add(wx - 2, gg => new Wreck(gg, wx - 2.1, gg.world.terrain.heightAt(wx - 2.1) + 1.25, { mass: 200 }), 'prop', { foot: [wx - 4, wx], wreck: true }); continue; }
            add(wx, gg => new Wreck(gg, wx, gMin(wx - 1.9, wx + 1.9), it.light ? { mass: 200 } : {}), 'prop', { foot: [wx - 1.9, wx + 1.9], wreck: true });
          }
          break;
        }
        case 'crates': {
          const n = it.n || 1;
          const bottom = n >= 3 ? Math.ceil(n * 0.6) : n;
          for (let i = 0; i < n; i++) {
            const row = i < bottom ? 0 : 1;
            const col = row === 0 ? i : i - bottom;
            const cnt = row === 0 ? bottom : n - bottom;
            const px = it.x + (col - (cnt - 1) / 2) * 1.02;
            add(it.x - 1, gg => new Crate(gg, px, gMin(px - 0.5, px + 0.5) + row * 1.0 + 0.01, 1.0, { metal: it.metal }), 'prop', { foot: [px - 0.5, px + 0.5] });
          }
          break;
        }
        case 'barrels':
          for (let i = 0; i < (it.n || 1); i++) { const px = it.x + i * 1.0; add(px, gg => new Barrel(gg, px, gMin(px - 0.35, px + 0.35), true), 'prop', { foot: [px - 0.35, px + 0.35] }); }
          break;
        case 'barricade': {
          const parts = it.bags ? ['bags', 'bags', 'bags'] : ['barrier', 'bags', 'barrier'];
          parts.forEach((p, i) => {
            const px = it.x + (i - 1) * 1.9;
            add(px, gg => p === 'bags' ? new Sandbags(gg, px, gMin(px - 0.8, px + 0.8)) : new Barrier(gg, px, gMin(px - 0.9, px + 0.9), {}), 'prop', { foot: [px - 0.9, px + 0.9] });
          });
          break;
        }
        case 'logs': add(it.x, gg => new LogPile(gg, it.x, gMin(it.x - 2.2, it.x + 2.2)), 'prop', { foot: [it.x - 2.3, it.x + 2.3] }); break;
        case 'wagon': {
          const gy = gMin(it.x - 5.5, it.x + 5.5);
          const verts = [[it.x - 5.5, gy - 0.3], [it.x + 5.5, gy - 0.3], [it.x + 5.5, gy + 3.2], [it.x - 5.5, gy + 3.2]];
          addStatic(verts, gg => new Obstacle(gg, verts, 'wagon'), 'вагон');
          break;
        }
        case 'boom': {
          const verts = [[it.x - 1, -1.8], [it.x + 1, -1.8], [it.x + 1, 1.3], [it.x - 1, 1.3]];
          addStatic(verts, gg => new Obstacle(gg, verts, 'boom'), 'бон');
          break;
        }
        case 'overhead': {
          const top = it.h + 0.9;
          const verts = [[it.x, it.h], [it.x2, it.h], [it.x2, top], [it.x, top]];
          addStatic(verts, gg => new Platform(gg, it.x, it.x2, top, 'crane'), 'кран');
          break;
        }
        case 'fire': {
          const w = it.w || 6;
          let y = sea ? 0 : g(it.x);
          for (const u of uppers) if (it.x > u.x1 && it.x < u.x2 && !(u.gap && it.x > u.gap[0] && it.x < u.gap[1])) y = u.top;
          add(it.x - w / 2, gg => new FireZone(gg, it.x - w / 2, it.x + w / 2, y), 'prop');
          if (it.wreck) add(it.x, gg => new Wreck(gg, it.x, gMin(it.x - 1.9, it.x + 1.9), { burning: true }), 'prop', { foot: [it.x - 1.9, it.x + 1.9] });
          break;
        }
        case 'mine':
          for (let i = 0; i < (it.n || 1); i++) {
            const mx = it.x + i * 9;
            if (sea) add(mx, gg => new Floater(gg, mx, 0.2, 'mine'));
            else add(mx, gg => new Floater(gg, mx, gg.world.terrain.heightAt(mx) + 0.52, 'mine'), 'prop', { foot: [mx - 0.5, mx + 0.5] });
          }
          break;
        case 'raft':
          add(it.x, gg => new Floater(gg, it.x, 0.3, 'raft'));
          if (it.gun) raider(it.x, 1.0); else zombie(it.x, pickZombie(k => k === 'walker' || k === 'soldier' || k === 'runner'), 1.0);
          break;
        // стрелки «Стаи»: n человек с шагом ~2.2 м
        case 'gun': {
          const n = it.n || 1;
          const ally = it.side === 'B';
          for (let i = 0; i < n; i++) raider(it.x + (i - (n - 1) / 2) * 2.2, it.abs !== undefined ? it.abs : (sea ? 0 : undefined), ally ? true : it.neutral, ally ? 'raiders' : undefined);
          break;
        }
        // катер «Стаи»: ahead — ждёт впереди, chase — нагоняет из-за спины
        case 'rboat': {
          const bo = { role: it.role || 'chase', faction: it.side === 'B' ? 'raiders' : humanSide, ally: it.side === 'B' };
          if (bo.role === 'chase') add(it.x, gg => new RaiderBoatTrigger(gg, it.x, bo));
          else add(it.x, gg => new RaiderBoat(gg, it.x, 0.3, bo));
          break;
        }
        case 'cont': add(it.x, gg => new Floater(gg, it.x, 0.2, 'container')); zombie(it.x, pickZombie(k => k === 'walker' || k === 'soldier' || k === 'runner'), 1.9); break;
        case 'buoys': for (let bx = it.x; bx <= it.x2; bx += 30) add(bx, gg => new Floater(gg, bx, 0.4, 'buoy')); break;
        case 'pier': {
          const px = it.x - 7, top = 1.8, pl = 2.6;
          const v1 = [[px - 3, -4], [px + 7, -4], [px + 7, top], [px + 6.6, top]];
          addStatic(v1, gg => new StaticBlock(gg, v1, { style: 'wood', friction: 0.15 }), 'пирс');
          const v2 = [[px + 7, top - 0.45], [px + 7 + pl, top - 0.45], [px + 7 + pl, top], [px + 7, top]];
          addStatic(v2, gg => new StaticBlock(gg, v2, { style: 'wood', friction: 0.15, legs: [px + 7.4, px + 6.6 + pl], legTop: top - 0.45 }), 'настил пирса');
          zombie(px + 8.2, pickZombie(k => k === 'walker' || k === 'soldier'), top + 0.05);
          decor.push({ type: 'pierlamp', x: px + 7, y: top });
          break;
        }
        case 'wramp': {
          const rl = 13, rh = 2.4;
          const verts = [[it.x - rl - 4, -5], [it.x, -5], [it.x, rh], [it.x - 0.5, rh]];
          addStatic(verts, gg => new StaticBlock(gg, verts, { style: 'rust', friction: 0.12 }), 'корпус-трамплин');
          decor.push({ type: 'shipwreck', x: it.x - rl * 0.4, y: rh });
          break;
        }
        case 'collapse': {
          const top = g(it.x - 2) + 0;
          const edges = [it.x];
          for (const [a, b] of (it.gaps || [])) edges.push(a, b);
          edges.push(it.x2);
          for (let s = 0; s + 1 < edges.length; s += 2) {
            const a = edges[s], b = edges[s + 1];
            // за каждым разрывом плиты на 1 м ниже — чтобы приземляться, а не биться в торец
            const sTop = top - (s / 2) * 1.0;
            const n = Math.max(1, Math.round((b - a) / 8));
            for (let k = 0; k < n; k++) {
              const sa = a + (b - a) * k / n, sb = a + (b - a) * (k + 1) / n - 0.05;
              const verts = [[sa, sTop - 1.2], [sb, sTop - 1.2], [sb, sTop], [sa, sTop]];
              addStatic(verts, gg => new CollapseSlab(gg, sa, sb, sTop), 'плита');
            }
          }
          const rimTop = base(it.x - 2);
          fill(it.x - 1, it.x2 + 1, () => rimTop - 22);
          // конец зоны — спуск на 2 м к целому гребню, дальше рельеф
          const lastTop = top - Math.floor(edges.length / 2 - 1) * 1.0;
          if (lastTop < rimTop - 0.5) fill(it.x2 + 1, it.x2 + 12, (xx, t2) => lerp(lastTop, rimTop, smooth(t2)));
          result.deaths.push({ x: it.x, x2: it.x2, rim: lastTop });
          break;
        }
        case 'avalanche': result.avalanche = { x: it.x, x2: it.x2 }; break;
        case 'ice': T.zones.push([it.x, it.x2, it.f || 0.25]); break;
        case 'death': if (it.x2 > it.x) result.deaths.push({ x: it.x, x2: it.x2, rim: Math.max(g(it.x - 3), g(it.x2 + 3)) }); break;
        case 'sign': decor.push({ type: 'warn', x: it.x, y: 0, back: true }); break;
        case 'lamp': decor.push({ type: 'lamp', x: it.x, y: 0, back: true, seed: 1 }); break;
        case 'boss': add(it.x, gg => new Zombie(gg, 'brute', it.x, gg.world.terrain.heightAt(it.x) + 0.05), 'zombie', { zx: it.x }); break;
        case 'fuel': case 'cash': {
          let y = sea ? (it.y !== undefined ? it.y : 1) : it.abs !== undefined ? it.abs : g(it.x) + (it.y !== undefined ? it.y : 1.2);
          if (it.abs !== undefined) y = it.abs;
          pickup(it.x, it.t, y);
          break;
        }
        case 'z': {
          const n = it.n || 1;
          const spacing = n > 20 ? 1.6 : 1.35;
          for (let i = 0; i < n; i++) {
            const zx = it.x + (i - (n - 1) / 2) * spacing;
            let type = ZOMBIE_KIND[it.k || 'w'] || 'walker';
            if (sea && (!it.k || it.k === 'w')) type = 'swimmer';
            let zy;
            if (it.abs !== undefined) zy = it.abs;
            else if (sea) zy = 0;
            zombie(zx, type, zy);
          }
          break;
        }
      }
    }

    // ---------- финиш ----------
    const fy = sea ? 0 : g(goalX);
    decor.push({ type: 'finish', kind: fin, finish: true, x: goalX, y: fy, stopX: FINISH_STOP[fin], level: def.id });

    // ---------- проверка расстановки ----------
    const safeZones = items.filter(i => i.t === 'safe').map(i => [i.x, i.x2]);
    for (let i = spawns.length - 1; i >= 0; i--) {
      const s = spawns[i];
      // R9: у финиша ничего, что залезет в здание
      if (s.x > goalX - 14 && !(def.final && s.kind === 'static')) { spawns.splice(i, 1); continue; }
      // R9: безопасные зоны без зомби и препятствий
      if ((s.kind === 'zombie' || (s.kind === 'prop' && s.foot)) && safeZones.some(([a, b]) => s.x >= a && s.x <= b)) { issues.push(`R9 ${s.kind} в безопасной зоне ${s.x.toFixed(0)}`); spawns.splice(i, 1); continue; }
      // R7: зомби и предметы не внутри статичных тел
      if (s.kind === 'zombie') {
        const zx = s.zx !== undefined ? s.zx : s.x;
        const zy = s.zy !== undefined ? s.zy : g(zx) + 0.1;
        for (const st of statics) {
          if (pointInPoly(zx, zy + 0.2, st.verts) || pointInPoly(zx, zy + 1.0, st.verts)) {
            const xs = st.verts.map(v => v[0]);
            if (Math.max(...xs) - Math.min(...xs) < 3) {
              // узкий столб — сдвигаем зомби в сторону, а не ставим сверху
              const nx = Math.max(...xs) + 0.8;
              issues.push(`R7 зомби у «${st.label}» на ${zx.toFixed(0)} — сдвинут`);
              s.x = nx; s.zx = nx;
              s.make = ((orig, nx2) => gg => { const z = orig(gg); const b = z.body; b.x = nx2; b.y = gg.world.terrain.heightAt(nx2) + 0.05 + b.com.y; b.savePrev(); b.updateShapes(); return z; })(s.make, nx);
              break;
            }
            const topY = Math.max(...st.verts.map(v => v[1]));
            issues.push(`R7 зомби внутри «${st.label}» на ${zx.toFixed(0)} — поставлен сверху`);
            const newY = topY + 0.1;
            s.make = ((orig, ny) => gg => { const z = orig(gg); z.body.y = ny + z.t.h / 2 + 0.05; z.body.savePrev(); z.body.updateShapes(); return z; })(s.make, newY);
            break;
          }
        }
      }
      if (s.kind === 'prop' && s.foot) {
        const [a, b] = s.foot;
        for (const st of statics) {
          const yy = gMin(a, b) + 0.3;
          if (pointInPoly(a + 0.1, yy, st.verts) || pointInPoly(b - 0.1, yy, st.verts) || pointInPoly((a + b) / 2, yy, st.verts)) {
            issues.push(`R7 предмет внутри «${st.label}» на ${s.x.toFixed(0)} — убран`);
            spawns.splice(i, 1);
            break;
          }
        }
      }
      if (s.kind === 'pickup') {
        for (const st of statics) {
          if (pointInPoly(s.x, s.py, st.verts)) { issues.push(`R10 бонус внутри «${st.label}» на ${s.x.toFixed(0)} — поднят`); const top = Math.max(...st.verts.map(v => v[1])) + 1.2; const sx = s.x, tp = s.ptype; s.py = top; s.make = gg => gg.addPickup(sx, top, tp); break; }
        }
      }
    }
    // R5: перед приземлением после трамплина не должно быть стен выше трамплина
    for (const st of statics) {
      if (st.label !== 'трамплин') continue;
      const xTop = Math.max(...st.verts.map(v => v[0])), yTop = Math.max(...st.verts.map(v => v[1]));
      for (const o of statics) {
        if (o === st || o.label === 'трамплин') continue;
        const ox = Math.min(...o.verts.map(v => v[0])), oy = Math.max(...o.verts.map(v => v[1]));
        if (ox > xTop + 0.5 && ox < xTop + 8 && oy > yTop + 1.2 && o.label !== 'ярус' && o.label !== 'заезд на ярус') issues.push(`R5 «${o.label}» слишком близко за трамплином ${xTop.toFixed(0)}`);
      }
    }
    // R5: после конца яруса — 30 м зоны приземления без трамплинов и заслонов
    for (const u of uppers) {
      if (u.top - g(u.x2 + 1) < 2) continue;
      for (const st of statics) {
        if (st.label === 'ярус' || st.label === 'заезд на ярус') continue;
        const sx = Math.min(...st.verts.map(v => v[0]));
        if (sx > u.x2 && sx < u.x2 + 30) issues.push(`R5 «${st.label}» в зоне приземления после яруса ${u.x2}`);
      }
      for (const s of spawns) if (s.kind === 'prop' && s.foot && s.x > u.x2 + 2 && s.x < u.x2 + 30) issues.push(`R5 препятствие ${s.x.toFixed(0)} в зоне приземления после яруса ${u.x2}`);
    }
    if (issues.length && typeof console !== 'undefined') console.warn(`[трасса ${def.id}] автопроверка:`, issues);
  }

  // декорации фона
  if (!sea && theme.decor.length) {
    let dx = -40;
    const dr = mulberry32(def.seed + 7);
    while (dx < total) {
      const type = theme.decor[Math.floor(dr() * theme.decor.length)];
      decor.push({ type, x: dx, y: 0, s: 0.8 + dr() * 0.5, seed: Math.floor(dr() * 1000), back: true });
      dx += 8 + dr() * 22;
    }
    if (!opts.demo) for (let m = 250; m < def.length - 30; m += 250) decor.push({ type: 'marker', x: m, y: 0, text: m + ' м' });
  } else if (sea) {
    const dr = mulberry32(def.seed + 7);
    if (def.theme === 'docks') {
      let dx = -30;
      while (dx < total) { decor.push({ type: dr() < 0.5 ? 'piling' : 'sunkenhouse', x: dx, y: 0, s: 0.8 + dr() * 0.5, seed: Math.floor(dr() * 1000), back: true, seaDecor: true }); dx += 12 + dr() * 25; }
    }
  }
  // декор ставится только на ровную землю и не пересекается со стартом, финишем, ярусами и трамплинами
  const blockRanges = statics.map(s => { const xs = s.verts.map(v => v[0]); return [Math.min(...xs) - 8, Math.max(...xs) + 8]; });
  spawns.filter(s => s.kind === 'bridge').forEach(s => blockRanges.push([s.x - 10, s.x + 70]));
  for (let i = decor.length - 1; i >= 0; i--) {
    const d = decor[i];
    if (!(d.back || d.type === 'marker')) continue;
    if (d.type === 'warn' || d.type === 'lamp') { d.y = T.heightAt(d.x); continue; }
    if (d.seaDecor) continue;
    const foot = (DECOR_FOOT[d.type] || 1.5) * (d.s || 1);
    let lo = Infinity, hi = -Infinity;
    for (let k = 0; k <= 8; k++) { const yy = T.heightAt(d.x - foot / 2 + foot * k / 8); lo = Math.min(lo, yy); hi = Math.max(hi, yy); }
    const nearStart = d.x > -32 && d.x < 8;
    const nearGoal = !opts.demo && d.x > goalX - 20 && d.x < goalX + 40;
    const overStatic = foot > 1.2 && blockRanges.some(([a, b]) => d.x + foot / 2 > a && d.x - foot / 2 < b);
    if (hi - lo > (foot > 4 ? 0.4 : 0.8) || nearStart || nearGoal || (overStatic && d.type !== 'marker')) { decor.splice(i, 1); continue; }
    d.y = lo;
  }
  T.friction = sea ? 0.5 : (theme.surface === 'snow' ? 0.7 : theme.surface === 'sand' ? 0.8 : 0.95);
  T.finalize();
  spawns.sort((a, b) => a.x - b.x);
  decor.sort((a, b) => a.x - b.x);
  const waves = design && design.waves ? design.waves : [def.waves || 0.5, def.waves || 0.5];
  return { terrain: T, spawns, decor, goalX, issues, avalanche: result.avalanche, deaths: result.deaths, water: sea ? makeWater(waves[0], waves[1], def.length) : null };
}
