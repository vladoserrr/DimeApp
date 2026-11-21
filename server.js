const express=require("express"),crypto=require("crypto"),path=require("path"),fs=require("fs");
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

const channelUrl="https://t.me/+cB3iJtgVuoBjZjBi";
const webhookSecret=String(process.env.TELEGRAM_WEBHOOK_SECRET||"").trim();
const dataDir=process.env.DIME_DATA_DIR||path.join(__dirname,"data");
const dataFile=path.join(dataDir,"telegram-store.json");
function readStore(){try{return JSON.parse(fs.readFileSync(dataFile,"utf8"));}catch{return {users:{},promos:{},pending:{}};}}
let store=readStore();
function saveStore(){fs.mkdirSync(dataDir,{recursive:true});const tmp=dataFile+".tmp";fs.writeFileSync(tmp,JSON.stringify(store));fs.renameSync(tmp,dataFile);}
const telegramApi=async(method,payload)=>{
 if(!token)throw Error("TELEGRAM_BOT_TOKEN не задан");
 const r=await fetch("https://api.telegram.org/bot"+token+"/"+method,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
 const d=await r.json().catch(()=>({}));
 if(!r.ok||!d.ok)throw Error(d.description||"Telegram API error");
 return d.result;
};
let botUsername="",giftCache=null,giftCacheAt=0;
async function getGifts(){
 if(giftCache&&Date.now()-giftCacheAt<30000)return giftCache;
 const result=await telegramApi("getAvailableGifts",{});
 giftCache=(result.gifts||[]).filter(g=>Number(g.star_count)>0&&(!Number.isFinite(g.remaining_count)||g.remaining_count>0)).sort((a,b)=>a.star_count-b.star_count);
 giftCacheAt=Date.now();return giftCache;
}
function giftTitle(g){return (g.sticker?.emoji||"🎁")+" Подарок";}
function mainMarkup(){return {inline_keyboard:[
 [{text:"💰 Заработать",callback_data:"invite_friends"},{text:"📢 Канал",url:channelUrl}],
 [{text:"🎁 Купить подарок",callback_data:"gift_page:0"},{text:"👤 Профиль",callback_data:"open_profile"}]
 ]};}
async function sendBotMenu(chatId){
 await telegramApi("sendMessage",{chat_id:chatId,text:"Добро пожаловать в DIME CASINO!\n\nВыбери нужный раздел:",reply_markup:mainMarkup()});
}
async function showInviteMenu(chatId,messageId,userId){
 if(!botUsername){const me=await telegramApi("getMe",{});botUsername=me.username;}
 const link="https://t.me/"+botUsername+"?start=invite_"+userId;
 const text="💰 ЗАРАБОТАТЬ НА ПРИГЛАШЕНИЯХ\n\nТвоя персональная ссылка:\n"+link+"\n\n🎁 Получай по 2 ⭐️ за каждого приглашённого друга!\n\nОтправь ссылку друзьям, чтобы пригласить их.";
 await telegramApi("editMessageText",{chat_id:chatId,message_id:messageId,text,reply_markup:{inline_keyboard:[
  [{text:"Поделиться ссылкой",url:"https://t.me/share/url?url="+encodeURIComponent(link)+"&text="+encodeURIComponent("Присоединяйся к DIME CASINO!") }],
  [{text:"⬅️ Назад",callback_data:"main_menu"}]
 ]}});
}
async function showProfile(chatId,messageId,userId){
 let b;try{b=await balance(userId);}catch(e){b={balance:0};}
 const u=store.users[String(userId)]||{referrals:[],earned:0,gifts:0};
 const text="👤 ТВОЙ ПРОФИЛЬ\n\n⭐ Баланс: "+(Number(b.balance)||0).toLocaleString("ru-RU")+" ⭐️\n👥 Приглашено друзей: "+(u.referrals||[]).length+"\n💰 Заработано звёзд: "+(Number(u.earned)||0)+" ⭐️\n🎁 Куплено подарков: "+(Number(u.gifts)||0);
 await telegramApi("editMessageText",{chat_id:chatId,message_id:messageId,text,reply_markup:{inline_keyboard:[
  [{text:"🎟 Промокод",callback_data:"promo_enter"},{text:"⬅️ Назад",callback_data:"main_menu"}]
 ]}});
}
async function showGiftPage(chatId,messageId,page=0){
 const gifts=await getGifts(),perPage=6,totalPages=Math.max(1,Math.ceil(gifts.length/perPage)),p=Math.max(0,Math.min(totalPages-1,Number(page)||0)),slice=gifts.slice(p*perPage,(p+1)*perPage);
 if(!gifts.length){await telegramApi("editMessageText",{chat_id:chatId,message_id:messageId,text:"🎁 Сейчас доступных подарков нет.",reply_markup:{inline_keyboard:[[{text:"⬅️ Назад",callback_data:"main_menu"}]]}});return;}
 const rows=[];for(let i=0;i<slice.length;i++){const g=slice[i],idx=p*perPage+i;rows.push([{text:giftTitle(g)+" · "+g.star_count+" ⭐️",callback_data:"gift_buy:"+idx+":"+p}]);}
 const nav=[];if(p>0)nav.push({text:"←",callback_data:"gift_page:"+(p-1)});nav.push({text:(p+1)+"/"+totalPages,callback_data:"gift_noop"});if(p<totalPages-1)nav.push({text:"→",callback_data:"gift_page:"+(p+1)});if(nav.length)rows.push(nav);rows.push([{text:"⬅️ Назад",callback_data:"main_menu"}]);
 await telegramApi("editMessageText",{chat_id:chatId,message_id:messageId,text:"🎁 ПОДАРКИ TELEGRAM\n\nВыбери подарок. Цены указаны в Telegram Stars.",reply_markup:{inline_keyboard:rows}});
}
async function beginGiftPurchase(chatId,messageId,userId,index,page){
 const gifts=await getGifts(),g=gifts[Number(index)];
 if(!g){await showGiftPage(chatId,messageId,page);return;}
 const payload="dimegift:"+userId+":"+crypto.randomBytes(8).toString("hex");
 store.pending[payload]={userId:String(userId),giftId:g.id,starCount:Number(g.star_count),name:giftTitle(g),createdAt:Date.now()};saveStore();
 await telegramApi("editMessageText",{chat_id:chatId,message_id:messageId,text:"🎁 Выбран подарок: "+giftTitle(g)+"\nЦена: "+g.star_count+" ⭐️\n\nСейчас отправлю защищённый счёт Telegram. Оплата проходит в Telegram Stars.",reply_markup:{inline_keyboard:[[{text:"⬅️ К подаркам",callback_data:"gift_page:"+page}],[{text:"⬅️ Главное меню",callback_data:"main_menu"}]]}});
 await telegramApi("sendInvoice",{chat_id:chatId,title:giftTitle(g).slice(0,32),description:"Подарок Telegram для вашего аккаунта",payload,currency:"XTR",prices:[{label:giftTitle(g),amount:Number(g.star_count)}]});
}
async function registerReferral(userId,payload){
 const id=String(userId),isNew=!store.users[id];if(!isNew)return;
 const u=store.users[id]={referrals:[],earned:0,gifts:0,joinedAt:Date.now()};
 const match=/^invite_(\d+)$/.exec(payload||"");if(!match||match[1]===id)return;
 const ref=match[1],owner=store.users[ref]||(store.users[ref]={referrals:[],earned:0,gifts:0,joinedAt:Date.now()});
 if(owner.referrals.includes(id))return;
 try{await transfer(ownerId,ref,2,"dime-referral-"+id,"Награда за приглашение DIME");owner.referrals.push(id);owner.earned=(Number(owner.earned)||0)+2;u.referrer=ref;saveStore();}
 catch(e){console.error("Referral reward failed:",e.message);}
}
async function handlePromoMessage(msg){
 const id=String(msg.from.id),code=String(msg.text||"").trim().replace(/^\/promo\s*/i,"").toUpperCase();
 if(!code)return;
 const p=store.promos[code],u=store.users[id]||(store.users[id]={referrals:[],earned:0,gifts:0,joinedAt:Date.now()});
 if(!p||p.active===false)return telegramApi("sendMessage",{chat_id:msg.chat.id,text:"Промокод не найден или уже отключён."});
 p.used=p.used||[];if(p.used.includes(id))return telegramApi("sendMessage",{chat_id:msg.chat.id,text:"Ты уже активировал этот промокод."});
 if(p.limit>0&&p.used.length>=p.limit)return telegramApi("sendMessage",{chat_id:msg.chat.id,text:"Лимит активаций промокода исчерпан."});
 const amount=Math.floor(Number(p.amount)||0);if(amount<1)return telegramApi("sendMessage",{chat_id:msg.chat.id,text:"Промокод настроен некорректно."});
 await transfer(ownerId,id,amount,"dime-promo-"+code+"-"+id,"Промокод "+code);p.used.push(id);u.earned=(Number(u.earned)||0)+amount;saveStore();
 await telegramApi("sendMessage",{chat_id:msg.chat.id,text:"🎉 Промокод активирован! Начислено "+amount+" ⭐️."});
}
async function handleTelegramUpdate(update){
 if(update?.pre_checkout_query){
  const q=update.pre_checkout_query,p=store.pending[q.invoice_payload];
  const valid=p&&String(q.from.id)===p.userId&&Number(q.total_amount)===p.starCount&&q.currency==="XTR";
  await telegramApi("answerPreCheckoutQuery",{pre_checkout_query_id:q.id,ok:!!valid,...(!valid?{error_message:"Счёт недействителен. Открой каталог подарков и выбери подарок заново."}:{})});return;
 }
 const msg=update?.message;
 if(msg?.successful_payment){
  const payment=msg.successful_payment,p=store.pending[payment.invoice_payload],id=String(msg.from.id),charge=payment.telegram_payment_charge_id;
  store.paidCharges=store.paidCharges||{};
  if(!p||p.userId!==id||payment.currency!=="XTR"||Number(payment.total_amount)!==p.starCount||store.paidCharges[charge])return;
  store.paidCharges[charge]="processing";saveStore();
  try{
   await telegramApi("sendGift",{user_id:Number(id),gift_id:p.giftId,text:"Подарок от DIME CASINO"});
   const u=store.users[id]||(store.users[id]={referrals:[],earned:0,gifts:0,joinedAt:Date.now()});u.gifts=(Number(u.gifts)||0)+1;store.paidCharges[charge]="delivered";delete store.pending[payment.invoice_payload];saveStore();
   await telegramApi("sendMessage",{chat_id:msg.chat.id,text:"🎉 Оплата прошла! Подарок отправлен в твой Telegram-профиль."});
  }catch(e){
   console.error("Gift delivery failed:",e.message);
   try{await telegramApi("refundStarPayment",{user_id:Number(id),telegram_payment_charge_id:charge});store.paidCharges[charge]="refunded";}catch(re){console.error("Gift refund failed:",re.message);store.paidCharges[charge]="refund_failed";}
   delete store.pending[payment.invoice_payload];saveStore();
   await telegramApi("sendMessage",{chat_id:msg.chat.id,text:"Не удалось отправить подарок. Запрос на возврат Telegram Stars отправлен."});
  }return;
 }
 if(update?.callback_query){
  const cb=update.callback_query,chatId=cb.message?.chat?.id,messageId=cb.message?.message_id,userId=cb.from?.id;
  if(!chatId||!messageId||!userId){await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});return;}
  try{
   if(cb.data==="invite_friends"){await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});await showInviteMenu(chatId,messageId,userId);return;}
   if(cb.data==="open_profile"){await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});await showProfile(chatId,messageId,userId);return;}
   if(cb.data==="promo_enter"){await telegramApi("answerCallbackQuery",{callback_query_id:cb.id,text:"Отправь промокод сообщением в этот чат."});await telegramApi("editMessageText",{chat_id:chatId,message_id:messageId,text:"🎟 ПРОМОКОД\n\nОтправь промокод следующим сообщением, чтобы активировать его.",reply_markup:{inline_keyboard:[[{text:"⬅️ Назад в профиль",callback_data:"open_profile"}]]}});store.users[String(userId)]=store.users[String(userId)]||{referrals:[],earned:0,gifts:0,joinedAt:Date.now()};store.users[String(userId)].awaitingPromo=true;saveStore();return;}
   if(cb.data==="main_menu"){await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});await telegramApi("editMessageText",{chat_id:chatId,message_id:messageId,text:"Добро пожаловать в DIME CASINO!\n\nВыбери нужный раздел:",reply_markup:mainMarkup()});return;}
   if(cb.data==="gift_noop"){await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});return;}
   if(cb.data.startsWith("gift_page:")){await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});await showGiftPage(chatId,messageId,Number(cb.data.split(":")[1]));return;}
   if(cb.data.startsWith("gift_buy:")){await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});const [,idx,page]=cb.data.split(":");await beginGiftPurchase(chatId,messageId,userId,idx,page);return;}
   await telegramApi("answerCallbackQuery",{callback_query_id:cb.id});
  }catch(e){console.error("Telegram callback:",e.message);await telegramApi("answerCallbackQuery",{callback_query_id:cb.id,text:"Не удалось выполнить действие. Попробуй ещё раз.",show_alert:true}).catch(()=>{});}
  return;
 }
 if(!msg?.chat?.id||typeof msg.text!=="string")return;
 const chatId=msg.chat.id,text=msg.text.trim(),id=String(msg.from?.id||"");
 if(/^\/start(?:@\w+)?(?:\s|$)/i.test(text)){const payload=text.split(/\s+/)[1]||"";await registerReferral(id,payload);await sendBotMenu(chatId);return;}
 if(store.users[id]?.awaitingPromo){store.users[id].awaitingPromo=false;saveStore();await handlePromoMessage(msg);return;}
 if(/^\/promo\s+/i.test(text)){await handlePromoMessage(msg);return;}
 if(/^\/createpromo\s+/i.test(text)&&id===ownerId){
  const [,code,amount,limit]=text.split(/\s+/),cleanCode=String(code||"").toUpperCase();
  if(!/^[A-Z0-9_-]{3,24}$/.test(cleanCode)||Number(amount)<1)return telegramApi("sendMessage",{chat_id:chatId,text:"Формат: /createpromo CODE AMOUNT LIMIT"});
  store.promos[cleanCode]={amount:Math.floor(Number(amount)),limit:Math.max(0,Math.floor(Number(limit)||0)),used:[],active:true};saveStore();
  await telegramApi("sendMessage",{chat_id:chatId,text:"Промокод "+cleanCode+" создан. Награда: "+Math.floor(Number(amount))+" ⭐️."});return;
 }
}
app.post("/telegram/webhook",async(req,res)=>{
 try{
  if(webhookSecret&&req.get("x-telegram-bot-api-secret-token")!==webhookSecret)return res.sendStatus(403);
  await handleTelegramUpdate(req.body);res.sendStatus(200);
 }catch(e){console.error("Telegram webhook:",e.message);res.sendStatus(200);}
});
async function configureTelegramWebhook(){
 if(!token)return;
 try{
  const me=await telegramApi("getMe",{});botUsername=me.username||"";
  const host=String(process.env.RAILWAY_PUBLIC_DOMAIN||"").trim();
  const webhook=String(process.env.TELEGRAM_WEBHOOK_URL||(host?"https://"+host+"/telegram/webhook":"")).trim();
  if(!webhook){console.log("Telegram bot: set TELEGRAM_WEBHOOK_URL or RAILWAY_PUBLIC_DOMAIN to enable /start menu");return;}
  const payload={url:webhook,allowed_updates:["message","callback_query","pre_checkout_query"]};
  if(webhookSecret)payload.secret_token=webhookSecret;
  await telegramApi("setWebhook",payload);console.log("Telegram webhook configured for @"+botUsername);
 }catch(e){console.error("Telegram webhook setup failed:",e.message);}
}
configureTelegramWebhook();

app.listen(process.env.PORT||8080,()=>console.log("Dime Casino online"));
