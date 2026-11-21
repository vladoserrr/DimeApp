const express=require("express"),crypto=require("crypto"),path=require("path");
const app=express();app.use(express.json({limit:"20kb"}));app.use(express.static(path.join(__dirname,"public")));
const games=[
["dice","Кости","Выбери диапазон: 1–3 или 4–6."],["coin","Монетка","Угадай сторону монеты."],["roulette","Рулетка","Выбери цвет сектора."],["slots","Слоты","Собери одинаковые символы."],["mines","Мины","Выбери уровень риска и проверь поле."],["crash","Краш","Забери выплату до точки обвала."],["limbo","Лимбо","Задай множитель и превзойди его."],["plinko","Плинко","Выбери риск и получи множитель ячейки."],["hilo","Выше / Ниже","Угадай значение следующей карты."],["keno","Кено","Выбери числа и дождись тиража."],["baccarat","Баккара","Выбери победителя раздачи."],["blackjack","Блэкджек","Выбери действие: взять карту или остановиться."],["poker","Покер","Сравни старшую карту с дилером."],["wheel","Колесо","Выбери цвет сектора колеса."],["tower","Башня","Выбери высоту подъёма."],["stairs","Лестница","Выбери количество ступеней."],["diamonds","Алмазы","Выбери один из трёх камней."],["football","Футбол","Выбери направление удара."],["basketball","Баскетбол","Выбери дальность броска."],["lottery","Лотерея","Угадай цифру от 0 до 9."]
];
const token=process.env.TELEGRAM_BOT_TOKEN,key=process.env.DONUT_API_KEY,base=(process.env.DONUT_API_URL||"").replace(/\/+$/,""),ownerId=String(process.env.CASINO_OWNER_TELEGRAM_ID||"");
function verify(data){try{if(!token||!data)return null;const p=new URLSearchParams(data),h=p.get("hash");p.delete("hash");const str=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+"="+v).join("\n"),secret=crypto.createHmac("sha256","WebAppData").update(token).digest(),v=crypto.createHmac("sha256",secret).update(str).digest("hex"),a=Buffer.from(h||"","hex"),b=Buffer.from(v,"hex");if(!h||a.length!==b.length||!crypto.timingSafeEqual(a,b)||Date.now()/1000-Number(p.get("auth_date"))>86400)return null;return JSON.parse(p.get("user")||"{}");}catch{return null}}
function auth(req,res,next){req.u=verify(req.headers["x-telegram-init-data"]);if(!req.u?.id)return res.status(401).json({error:"Открой казино через Telegram"});next()}
async function api(path,method="GET",body,ref){if(!key||!base)throw Error("Не настроены DONUT_API_URL и DONUT_API_KEY");const r=await fetch(base+path,{method,headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","X-Idempotency-Key":ref||crypto.randomUUID()},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Ошибка API Пончика");return d}
const balance=id=>api("/api/v1/balance?telegram_id="+encodeURIComponent(id));
async function transfer(from,to,amount,reference,description){return api("/api/v1/transfer","POST",{from_telegram_id:String(from),to_telegram_id:String(to),amount,reference,description},reference)}
const int=(a,b)=>Math.floor(Math.random()*(b-a+1))+a,one=a=>a[Math.floor(Math.random()*a.length)],money=n=>Math.max(0,Math.floor(n));
const busy=new Set();
app.get("/api/games",(q,s)=>s.json(games.map(([id,name,description])=>({id,name,description}))));
app.get("/api/me",auth,async(q,s)=>{try{s.json({user:q.u,balance:(await balance(q.u.id)).balance})}catch(e){s.status(502).json({error:e.message})}});
async function cash(req,res,kind){const amount=money(req.body.amount),id=String(req.u.id);if(!ownerId)return res.status(503).json({error:"Не задан CASINO_OWNER_TELEGRAM_ID"});if(!Number.isSafeInteger(amount)||amount<10||amount>100000)return res.status(400).json({error:"Сумма должна быть от 10 до 100000 фрагментов"});const lock=id;if(busy.has(lock))return res.status(409).json({error:"Дождись завершения предыдущего перевода"});busy.add(lock);const ref="dime-"+kind+"-"+crypto.randomUUID();try{if(kind==="withdraw"){const reserve=await balance(ownerId);if(reserve.balance<amount)return res.status(409).json({error:"В резерве казино недостаточно фрагментов"});}const from=kind==="deposit"?id:ownerId,to=kind==="deposit"?ownerId:id;await transfer(from,to,amount,ref,kind==="deposit"?"Пополнение игрового баланса Dime Casino":"Вывод из Dime Casino");const current=await balance(id);return res.json({ok:true,amount,balance:current.balance,reference:ref});}catch(e){return res.status(502).json({error:"Перевод не выполнен: "+e.message})}finally{busy.delete(lock)}}
app.post("/api/deposit",auth,(q,s)=>cash(q,s,"deposit"));app.post("/api/withdraw",auth,(q,s)=>cash(q,s,"withdraw"));
function roll(game,choice,bet,extra={}){
 let win=false,mult=0,detail="",visual={};
 const card=()=>{const rank=int(1,13),suit=one(["♠","♥","♦","♣"]);return{rank,label:["","A","2","3","4","5","6","7","8","9","10","J","Q","K"][rank],suit};};
 if(game==="dice"){const n=int(1,6);win=(choice==="high"?n>=4:n<=3);mult=1.9;detail="Выпало "+n+" · "+(n>=4?"4–6":"1–3");visual={type:"dice",value:n};}
 if(game==="coin"){const side=one(["heads","tails"]);win=choice===side;mult=1.92;detail=side==="heads"?"Орёл":"Решка";visual={type:"coin",value:side};}
 if(game==="roulette"){const c=one(["red","black","red","black","red","black","red","black","green"]);win=choice===c;mult=c==="green"?8.5:1.9;detail="Сектор: "+({red:"Красный",black:"Чёрный",green:"Зелёный"}[c]);visual={type:"roulette",value:c};}
 if(game==="slots"){const symbols=["ruby","sapphire","emerald","fragment"],reels=[one(symbols),one(symbols),one(symbols)],counts=reels.reduce((o,x)=>(o[x]=(o[x]||0)+1,o),{}),best=Math.max(...Object.values(counts));win=best>=2;mult=best===3?(reels[0]==="fragment"?4.8:4.8):1.2;detail=best===3?"Три совпадения":best===2?"Два совпадения":"Комбинация не собрана";visual={type:"slots",reels};}
 if(game==="mines"){const risk=Math.max(1,Math.min(5,money(extra.risk)||2)),chance=Math.pow(.82,risk);win=Math.random()<chance;mult=Math.floor((.96/chance)*100)/100;detail=win?"Безопасный проход · мин: "+risk:"Попадание на мину · мин: "+risk;visual={type:"mines",safe:win,risk};}
 if(game==="crash"){const target=Math.max(1.1,Math.min(10,Number(extra.target)||1.5)),point=Math.min(100,Math.max(1,Math.floor((.99/Math.max(.0001,Math.random()))*100)/100));win=point>=target;mult=target;detail="Краш на x"+point.toFixed(2)+" · цель x"+target.toFixed(2);visual={type:"crash",point,target};}
 if(game==="limbo"){const target=Math.max(1.1,Math.min(20,Number(extra.target)||2)),point=Math.min(100,Math.max(1,Math.floor((.99/Math.max(.0001,Math.random()))*100)/100));win=point>=target;mult=target;detail="Результат x"+point.toFixed(2)+" · цель x"+target.toFixed(2);visual={type:"limbo",point,target};}
 if(game==="plinko"){const risk=String(extra.risk||"medium"),tables={low:[1.5,1.2,1.05,.8,.6,.8,1.05,1.2,1.5],medium:[4,1.8,1.1,.5,.2,.5,1.1,1.8,4],high:[12,3,1,.3,.1,.3,1,3,12]},table=tables[risk]||tables.medium,weights=[1,8,28,56,70,56,28,8,1],rollN=Math.random()*256;let index=0,acc=0;for(;index<weights.length-1;index++){acc+=weights[index];if(rollN<acc)break;}mult=table[index];win=mult>0;detail="Шар попал в ячейку "+(index+1)+" · x"+mult;visual={type:"plinko",index,risk,table};}
 if(game==="hilo"){const n=int(1,13);win=choice==="high"?n>=8:n<=6;mult=1.82;detail="Карта: "+n+" · "+(n===7?"семёрка":n>=8?"выше":"ниже");visual={type:"hilo",value:n};}
 if(game==="keno"){const picks=Math.max(1,Math.min(5,money(extra.picks)||2)),draw=[];while(draw.length<5){const n=int(1,10);if(!draw.includes(n))draw.push(n);}const selected=[];while(selected.length<picks){const n=int(1,10);if(!selected.includes(n))selected.push(n);}const hits=selected.filter(n=>draw.includes(n)).length,pays={1:[0,1.7],2:[0,0,3.2],3:[0,0,1.5,6],4:[0,0,1,3,12],5:[0,0,0,2,7,25]};mult=pays[picks][hits]||0;win=mult>0;detail="Совпадений: "+hits+" из "+picks;visual={type:"keno",draw,selected,hits};}
 if(game==="baccarat"){const points=()=>int(0,9),p=(points()+points())%10,d=(points()+points())%10,result=p>d?"player":d>p?"banker":"tie";win=choice===result;mult=result==="tie"?7.5:result==="banker"?1.95:1.9;detail="Игрок "+p+" · Банк "+d+" · "+({player:"победа игрока",banker:"победа банка",tie:"ничья"}[result]);visual={type:"baccarat",player:p,banker:d,result};}
 if(game==="blackjack"){let player=int(12,21),dealer=int(15,21);if(choice==="hit")player=Math.min(30,player+int(1,11));while(dealer<17)dealer+=int(1,10);const result=player>21?"dealer":dealer>21||player>dealer?"player":player<dealer?"dealer":"push";win=result==="player"||result==="push";mult=result==="push"?1:1.95;detail="Игрок "+player+" · Дилер "+dealer+" · "+({player:"победа",dealer:"перебор / проигрыш",push:"возврат ставки"}[result]);visual={type:"blackjack",player,dealer,result};}
 if(game==="poker"){const p=card(),d=card(),result=p.rank>d.rank?"player":d.rank>p.rank?"dealer":"tie";win=choice===result;mult=result==="tie"?3.5:1.9;detail="Твоя карта "+p.label+p.suit+" · Карта дилера "+d.label+d.suit;visual={type:"poker",player:p,dealer:d,result};}
 if(game==="wheel"){const c=one(["silver","silver","silver","silver","blue","blue","blue","purple","gold"]),pays={silver:2.1,blue:2.8,purple:8,gold:8};win=choice===c;mult=pays[c];detail="Сектор: "+({silver:"Серебро",blue:"Синий",purple:"Фиолетовый",gold:"Золото"}[c]);visual={type:"wheel",value:c};}
 if(game==="tower"){const floors=Math.max(1,Math.min(5,money(extra.floors)||2)),chance=Math.pow(.78,floors);win=Math.random()<chance;mult=Math.floor((.96/chance)*100)/100;detail=(win?"Подъём завершён: ":"Срыв на высоте: ")+floors+" этаж.";visual={type:"tower",floors,success:win};}
 if(game==="stairs"){const steps=Math.max(1,Math.min(5,money(extra.steps)||2)),chance=Math.pow(.86,steps);win=Math.random()<chance;mult=Math.floor((.96/chance)*100)/100;detail=(win?"Все ступени пройдены: ":"Падение на ступени: ")+steps;visual={type:"stairs",steps,success:win};}
 if(game==="diamonds"){const picked=Math.max(1,Math.min(3,money(choice)||1)),prize=int(1,3);win=picked===prize;mult=2.85;detail=win?"Найден алмаз":"Пустая ячейка";visual={type:"diamonds",picked,prize};}
 if(game==="football"){const shot=String(choice),keeper=one(["left","center","right"]);win=shot!==keeper;mult=1.42;detail=win?"ГОЛ · Вратарь прыгнул в другую сторону":"Вратарь отбил удар";visual={type:"football",shot,keeper,goal:win};}
 if(game==="basketball"){const distance=choice==="three"?3:2,prob=distance===3?.38:.65;win=Math.random()<prob;mult=distance===3?2.48:1.45;detail=(win?"Попадание":"Промах")+" · бросок на "+distance+" очка";visual={type:"basketball",distance,success:win};}
 if(game==="lottery"){const chosen=Math.max(0,Math.min(9,money(choice))),draw=int(0,9);win=chosen===draw;mult=8.5;detail="Твой номер "+chosen+" · Выпало "+draw;visual={type:"lottery",chosen,draw};}
 return {win,payout:win?money(bet*mult):0,multiplier:win?mult:0,detail,visual};
}
app.post("/api/play",auth,async(q,s)=>{const id=String(q.u.id),bet=money(q.body.bet),game=String(q.body.game||"");if(!games.some(g=>g[0]===game)||!Number.isSafeInteger(bet)||bet<1||bet>10000)return s.status(400).json({error:"Ставка от 1 до 10000 фрагментов"});if(!ownerId)return s.status(503).json({error:"Не настроен CASINO_OWNER_TELEGRAM_ID"});if(busy.has(id))return s.status(409).json({error:"Предыдущий раунд ещё обрабатывается"});busy.add(id);const ref=crypto.randomUUID();try{const owner=await balance(ownerId),player=await balance(id);if(player.balance<bet)return s.status(409).json({error:"Недостаточно фрагментов",balance:player.balance});const preview=roll(game,q.body.choice,bet,q.body);const maxMult={slots:7,keno:25,roulette:8.5,wheel:12,lottery:8.5,diamonds:2.85,football:2.75,plinko:12,baccarat:7.5}[game]||10;if(owner.balance<bet*(game==="limbo"?Math.max(1.1,Math.min(20,Number(q.body.target)||2)):maxMult))return s.status(409).json({error:"В резерве казино недостаточно средств для этого режима"});await transfer(id,ownerId,bet,"dime-bet-"+ref,"Ставка Dime · "+game);if(preview.payout>0){try{await transfer(ownerId,id,preview.payout,"dime-win-"+ref,"Выплата Dime · "+game);}catch(e){await transfer(ownerId,id,bet,"dime-refund-"+ref,"Возврат ставки Dime");throw Error("Не удалось выплатить выигрыш. Ставка возвращена. "+e.message)}}const fresh=await balance(id);return s.json({ok:true,game,bet,balance:fresh.balance,...preview,result:preview.win?"Победа":"Раунд завершён"});}catch(e){s.status(502).json({error:"Раунд не завершён: "+e.message})}finally{busy.delete(id)}});

const channelUrl=String(process.env.DIME_CHANNEL_URL||"").trim();
const webhookSecret=String(process.env.TELEGRAM_WEBHOOK_SECRET||"").trim();
const telegramApi=async(method,payload)=>{
 if(!token)throw Error("TELEGRAM_BOT_TOKEN не задан");
 const r=await fetch("https://api.telegram.org/bot"+token+"/"+method,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw Error(d.description||"Telegram API error");
 return d.result;
};
let botUsername="";
async function sendBotMenu(chatId){
 const earn={text:"💰 Заработать",callback_data:"invite_friends"};
 const channel=channelUrl?{text:"📢 Канал",url:channelUrl}:{text:"📢 Канал",callback_data:"open_channel"};
 const gift={text:"🎁 Купить подарок",callback_data:"buy_gift"};
 const profile={text:"👤 Профиль",callback_data:"open_profile"};
 await telegramApi("sendMessage",{chat_id:chatId,text:"Добро пожаловать в DIME CASINO!\n\nВыбери нужный раздел:",reply_markup:{inline_keyboard:[[earn,channel],[gift,profile]]}});
}
async function showInviteMenu(chatId,messageId,userId){
 if(!botUsername){const me=await telegramApi("getMe",{});botUsername=me.username;}
 const link="https://t.me/"+botUsername+"?start=invite_"+userId;
 const text="💰 ЗАРАБОТАТЬ НА ПРИГЛАШЕНИЯХ\n\nТвоя персональная ссылка:\n"+link+"\n\n🎁 Получай по 2 ⭐️ за каждого приглашённого друга!\n\nОтправь ссылку друзьям, чтобы пригласить их.";
 const markup={inline_keyboard:[
  [{text:"Поделиться ссылкой",url:"https://t.me/share/url?url="+encodeURIComponent(link)+"&text="+encodeURIComponent("Присоединяйся к DIME CASINO!") }],
  [{text:"⬅️ Назад",callback_data:"main_menu"}]
 ]};
 await telegramApi("editMessageText",{chat_id:chatId,message_id:messageId,text,reply_markup:markup});
}
async function handleTelegramUpdate(update){
 if(update?.callback_query){
  const cb=update.callback_query,chatId=cb.message?.chat?.id,messageId=cb.message?.message_id,userId=cb.from?.id;
  if(!chatId||!messageId||!userId){await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});return;}
  if(cb.data==="invite_friends"){
   await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});
   await showInviteMenu(chatId,messageId,userId);return;
  }
  if(cb.data==="main_menu"){
   await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});
   const earn={text:"💰 Заработать",callback_data:"invite_friends"};
   const channel=channelUrl?{text:"📢 Канал",url:channelUrl}:{text:"📢 Канал",callback_data:"open_channel"};
   await telegramApi("editMessageText",{chat_id:chatId,message_id:messageId,text:"Добро пожаловать в DIME CASINO!\n\nВыбери нужный раздел:",reply_markup:{inline_keyboard:[[earn,channel],[{text:"🎁 Купить подарок",callback_data:"buy_gift"},{text:"👤 Профиль",callback_data:"open_profile"}]]}});
   return;
  }
  if(cb.data==="open_channel"){
   await telegramApi("answerCallbackQuery",{callback_query_id:cb.id,text:channelUrl?"Открываю канал":"Канал пока не настроен",show_alert:!channelUrl});
   if(channelUrl)await telegramApi("sendMessage",{chat_id:chatId,text:"Канал DIME CASINO:",reply_markup:{inline_keyboard:[[{text:"Открыть канал",url:channelUrl}]]}});
   return;
  }
  if(cb.data==="buy_gift"||cb.data==="open_profile"){
   await telegramApi("answerCallbackQuery",{callback_query_id:cb.id,text:cb.data==="buy_gift"?"Раздел покупки подарков пока не подключён.":"Раздел профиля пока не подключён.",show_alert:true});
   return;
  }
  await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});
  return;
 }
 const msg=update?.message;
 if(!msg?.chat?.id||typeof msg.text!=="string")return;
 const chatId=msg.chat.id,text=msg.text.trim();
 if(/^\/start(?:@\w+)?(?:\s|$)/i.test(text)){await sendBotMenu(chatId);return;}
}
app.post("/telegram/webhook",async(req,res)=>{
 try{
  if(webhookSecret&&req.get("x-telegram-bot-api-secret-token")!==webhookSecret)return res.sendStatus(403);
  await handleTelegramUpdate(req.body);
  res.sendStatus(200);
 }catch(e){console.error("Telegram webhook:",e.message);res.sendStatus(200);}
});
async function configureTelegramWebhook(){
 if(!token)return;
 try{
  const me=await telegramApi("getMe",{});
  botUsername=me.username||"";
  const host=String(process.env.RAILWAY_PUBLIC_DOMAIN||"").trim();
  const webhook=String(process.env.TELEGRAM_WEBHOOK_URL||(host?"https://"+host+"/telegram/webhook":"")).trim();
  if(!webhook){console.log("Telegram bot: set TELEGRAM_WEBHOOK_URL or RAILWAY_PUBLIC_DOMAIN to enable /start menu");return;}
  const payload={url:webhook,allowed_updates:["message"]};
  if(webhookSecret)payload.secret_token=webhookSecret;
  await telegramApi("setWebhook",payload);
  console.log("Telegram webhook configured for @"+botUsername);
 }catch(e){console.error("Telegram webhook setup failed:",e.message);}
}
configureTelegramWebhook();

app.listen(process.env.PORT||8080,()=>console.log("Dime Casino online"));
