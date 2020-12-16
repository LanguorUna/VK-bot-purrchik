const VkBot = require('node-vk-bot-api')
const Api = require('node-vk-bot-api/lib/api');
const Markup = require('node-vk-bot-api/lib/Markup')
const Scene = require('node-vk-bot-api/lib/Scene')
const Stage = require('node-vk-bot-api/lib/Stage')
const Session = require('node-vk-bot-api/lib/session')
const Datastore = require('nedb-promise')
const TOKEN = require('./token').TOKEN

const db = {};
db.customers = Datastore({ filename: 'db/customers.db' });
db.schedule = Datastore({ filename: 'db/schedule.db' });

db.customers.loadDatabase();
db.schedule.loadDatabase();

const bot = new VkBot(TOKEN);

const sceneShowRecords = new Scene('Записи',
  async (ctx)=> {
    ctx.scene.enter('Привет');
    const records = await db.schedule.find({ idVk: ctx.message.from_id, date: { $gte: new Date()} })
    if(records.length > 0){
      let str = 'Ваши записи:\n';
      for (let i = 0; i < records.length; i++) {
        str += `${i+1}) ${getDateString(records[i].date)}\n` 
      }
      ctx.reply(str);
    } else {
      ctx.reply('Пока у тебя нет записей\nЭто можно исправить 😽');
    }
  }
);

const sceneRecord = new Scene('Запись',

  async (ctx) => {
    ctx.scene.next();

    const dates = await getDates(new Date());
    const datesString = getDateStrings(dates);

    ctx.reply(`Выберите дату и время:`, null, Markup
      .keyboard([
        [
          Markup.button({ action: { type: 'text', label: datesString[0], payload: (+dates[0]).toString() }, color: 'positive' }), 
          Markup.button({ action: { type: 'text', label: datesString[1], payload: (+dates[1]).toString() }, color: 'positive' })
        ],
        [
          Markup.button({ action: { type: 'text', label: datesString[2], payload: (+dates[2]).toString() }, color: 'positive' }), 
          Markup.button({ action: { type: 'text', label: datesString[3], payload: (+dates[3]).toString() }, color: 'positive' })
        ],
        [
          Markup.button({ action: { type: 'text', label: datesString[4], payload: (+dates[4]).toString() }, color: 'positive' }),
          Markup.button({ action: { type: 'text', label: datesString[5], payload: (+dates[5]).toString() }, color: 'positive' })
        ],
        [
          Markup.button('Отмена', 'negative')
        ]
      ])
      .oneTime());
  },

  (ctx) => {
    if (ctx.message.text !== 'Отмена' && ctx.message.payload) {
      db.schedule.insert({ idVk: ctx.message.from_id, servise: '', date: new Date(+ctx.message.payload), status: false });

      ctx.reply('Выберите услугу:', null, Markup
        .keyboard([
          [Markup.button('Маникюр', 'positive'), Markup.button('Педикюр', 'positive')],
          [Markup.button('Отмена', 'negative')]
        ])
        .oneTime());

      ctx.scene.next();
    } else {
      ctx.scene.enter('Запись', [3]);
    }
  },

  async (ctx) => {
    if (ctx.message.text == 'Маникюр' || ctx.message.text == 'Педикюр') {

      db.schedule.update({ idVk: ctx.message.from_id, servise: '' }, { $set: { servise: ctx.message.text } });

      ctx.reply('(Сер кот гордится тобой)', null, null, 6334);

      setTimeout(() => {
        bot.sendMessage(ctx.message.from_id, 'Успешно!\nЗа день до назначенной записи вам придёт уведомление!');
      }, 30);

      ctx.scene.enter('Привет');
    } else {
      db.schedule.remove({ idVk: ctx.message.from_id, servise: '' });
      ctx.scene.enter('Запись', [3]);
    }
  },

  (ctx) => {
    ctx.scene.enter('Привет');
  }
)

const sceneHello = new Scene('Привет',
  (ctx) => {
    ctx.scene.next();
    ctx.reply('Я бот Пурчик✨\nДля записи на услугу нажмите на кнопку Записаться на ноготочки💅🏻', null, Markup
      .keyboard([
        [Markup.button('Мои записи')],
        [Markup.button('Записаться на ноготочки💅🏻', 'primary')]
      ])
      .oneTime());
  },
  (ctx) => {
    if (ctx.message.text === 'Записаться на ноготочки💅🏻') {
      ctx.scene.enter('Запись');
    }
    else if (ctx.message.text === 'Мои записи') {
      ctx.scene.enter('Записи');
    }
    else {
      ctx.scene.enter('Привет', [0]);
    }
  }
)

const session = new Session()
const stage = new Stage(sceneRecord,sceneShowRecords, sceneHello)
bot.use(session.middleware())
bot.use(stage.middleware())

bot.command('Начать', (ctx) => {
  ctx.scene.enter('Привет');
})

bot.on((ctx) => {
  ctx.scene.enter('Привет');
})

function getWeekDay(date) {
  date = date || new Date();
  const days = ['Вc', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const day = date.getDay();

  return days[day];
}

function getMonthString(date) {
  date = date || new Date();
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const month = date.getMonth();

  return months[month];
}

async function getDates(date) {
  const dates = [];
  const curr = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 10, 0);
  dates.push(await getNextDate(curr, true));

  for (let i = 1; i < 6; i++) {
    dates.push(await getNextDate(dates[dates.length - 1]));
  }

  return dates;
}

function getDateStrings(dates) {
  return dates.map(date => getDateString(date));
}

function getDateString(date) {
  return `${getWeekDay(date)} ${date.getDate()} ${getMonthString(date)} ${date.getHours()}:${date.getMinutes()}0`;
}

async function getNextDate(date, isStart = false) {
  let next = date;
  if (next.getDay() == 0) {
    next = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1, 10, 0);
    isStart = true;
  }

  if (next.getDay() == 6) {
    next = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 2, 10, 0);
    isStart = true;
  }

  if (!isStart) {
    if (next.getHours() == 10) {
      next = new Date(next.getFullYear(), next.getMonth(), next.getDate(), 14, 0);
    }

    else if (next.getHours() == 14) {
      next = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1, 10, 0);
    }
  }

  let docs = await db.schedule.find({ date: next });

  if (docs.length == 0) {
    return next;

  } else {
    return getNextDate(next);
  }
}

/**
 * Оповещение клиентов о записи
 * @param {number} beforeDays - за какое кол-во дней оповестить
 */
async function notifyUsers(beforeDays){

  const now = new Date();
  let users = await db.schedule.find({ status: false, date: { $lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + beforeDays, now.getHours(), now.getMinutes())} })

  if(users.length > 0){
    let vkUser;
    users.forEach(async user => {
      vkUser = (await Api('users.get', {
        user_ids: user.idVk,
        access_token: TOKEN,
      })).response[0];

      bot.sendMessage(user.idVk,`Привет, ${vkUser.first_name}!💅🏻\nХочу напомнить что у тебя есть запись:\n${getDateString(user.date)}\n\nХороших ноготочков!💖 `);
      db.schedule.update({ idVk: user.idVk, date: user.date }, { $set: { status: true } });
    });
  }
}

bot.startPolling(() => {
  console.log('Бот запущен');

  //оповестить при старте
  //notifyUsers(1);

  //задача оповещения
  //setInterval(notifyUsers.bind(null, 1), 60*60*1000);
  //setInterval(notifyUsers.bind(null, 10), 5000);
})
