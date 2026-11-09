/* ================= CONFIG =================
   Paste your keys between the quotes (see the Phase 3 setup guide).
   Leave a value empty to keep that feature switched off. */
window.FH_CONFIG={
  googleClientId:'',      // Google Drive backups – OAuth "Web client" ID, ends with .apps.googleusercontent.com
  recaptchaSiteKey:'6Ld1-BEuAAAAACuATBAA7uQ3VEFwfGpW4tVvIsUx'     // Firebase App Check – reCAPTCHA Enterprise (Fraud Defense) Web key ID
};
const APP_VERSION='3.2';
/* ================= STATE ================= */
const $=id=>document.getElementById(id);
const uid=()=>(crypto.randomUUID?crypto.randomUUID().replace(/-/g,'').slice(0,16):Math.random().toString(36).slice(2,14));
const KINDS=['income','expenses','savings','goals','allocs','transfers','bills','adjustments'];
const defaultWallets=(startCash=0)=>[{id:'w_cash',name:'Cash',type:'cash',start:+startCash||0},{id:'w_gcash',name:'GCash',type:'ewallet',start:0},{id:'w_maya',name:'Maya',type:'ewallet',start:0},{id:'w_bank',name:'Bank',type:'bank',start:0},{id:'w_cc',name:'Credit Card',type:'credit',start:0}];
const EMPTY=()=>{const d=new Date();return {
  settings:{startDate:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,startCash:0,startOther:0,startGoal:0,sal15:0,sal30:0,lastBackup:'',lastBackupWhere:'',backupTo:'file',backupRemind:true,driveFolder:''},
  lists:{
    expense:['Rent','Food','Commute','Grocery','Online Shopping','Online Payment','Gift','Electric','Water','Internet','Others'],
    income:['Salary','13th Month Pay','Bonus','Side Gig','Other Income'],
    savings:['Emergency Fund','General Savings','Investment','Travel / Major Purchase','Goal','Others']
  },
  budget:{},wallets:defaultWallets(0),income:[],expenses:[],savings:[],goals:[],allocs:[],transfers:[],bills:[],adjustments:[]};};
let S=EMPTY(), userName='', userEmail='';
let adjustmentsAvailable=true;
const LS={get:(k,d)=>{try{const v=localStorage.getItem(k);return v===null?d:v;}catch(_){return d;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(_){}}};
let loaded=new Set(), ready=false, readyTimer=null;
function markLoaded(k){if(ready) return; loaded.add(k); if(loaded.size>=KINDS.length+1) setReady();}
function setReady(){if(ready) return; ready=true; clearTimeout(readyTimer); document.body.classList.remove('loading'); schedule();}
/* ---- cloud write helpers (FB comes from the Firebase module) ---- */
const cloudOK=()=>{if(!window.FB||!window.FB.uid()){toast('Not signed in');return false;}return true;};
function cPut(kind,rec){if(!cloudOK())return;const {id,...d}=rec;FB.put(kind,id,JSON.parse(JSON.stringify(d)));}
function cMeta(){if(!cloudOK())return;FB.putMeta(JSON.parse(JSON.stringify({settings:S.settings,lists:S.lists,budget:S.budget,wallets:S.wallets})));}
/* ---- cloud read hooks ---- */
let _rq=0;function schedule(){if(_rq)return;_rq=requestAnimationFrame(()=>{_rq=0;render();});}
window.onData=(k,rows)=>{S[k]=rows;markLoaded(k);schedule();};
window.onAdjustmentPermissionDenied=()=>{adjustmentsAvailable=false;schedule();toast('Wallet reconciliation is unavailable until the updated Firestore rules are published.');};
window.onMeta=m=>{const d=EMPTY();S.settings={...d.settings,...(m&&m.settings||{})};S.lists=(m&&m.lists)||d.lists;S.budget=(m&&m.budget)||{};
  S.wallets=(m&&Array.isArray(m.wallets)&&m.wallets.length)?m.wallets:defaultWallets(m&&m.settings&&m.settings.startCash);markLoaded('meta');schedule();};
window.setSync=st=>{const el=$('syncBadge');if(!el)return;el.className='sync '+st;el.innerHTML='<i></i>'+({synced:'Synced',saving:'Saving…',offline:'Offline – will sync'}[st]);};
window.onSignedIn=u=>{adjustmentsAvailable=true;$('auth').classList.add('hide');
  userName=((u.displayName||'').trim().split(/\s+/)[0])||'';userEmail=u.email||'';
  loaded=new Set();ready=false;document.body.classList.add('loading');clearTimeout(readyTimer);readyTimer=setTimeout(setReady,8000);
  const av=u.photoURL?`<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">`:esc((u.displayName||u.email||'?')[0].toUpperCase());
  $('topRight').innerHTML=`<div class="syncrow"><span class="sync offline" id="syncBadge"><i></i>Connecting…</span><div class="avatar" title="${esc(u.email||'')}">${av}</div></div>`;
  $('acctAv').innerHTML=av;$('acctEmail').textContent=u.email||u.displayName||'';render();};
window.onSignedOut=()=>{S=EMPTY();ready=false;closeSheet();render();$('topRight').innerHTML='';$('auth').classList.remove('hide');
  $('authLoading').style.display='none';$('authBtn').style.display='';};
window.showAuthError=e=>{$('authLoading').style.display='none';$('authBtn').style.display='';
  $('authErr').textContent=e.code==='auth/unauthorized-domain'?'This site address is not authorized in Firebase (Authentication → Settings → Authorized domains).':(e.code?'Sign-in failed: '+e.code:e.message);};
setTimeout(()=>{if(!window.FB) window.showAuthError({message:'Could not load the sync service. Check your internet connection and reload.'});},12000);

/* ================= HELPERS ================= */
const peso=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2});
const fmt=v=>peso.format(+v||0);
const pct=v=>((+v||0)*100).toFixed(1)+'%';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const P=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};
const today=()=>iso(new Date());
const eom=(y,m)=>new Date(y,m+1,0);
const payday30=(y,m)=>{const e=eom(y,m).getDate();return new Date(y,m,Math.min(30,e));};
const inR=(d,a,b)=>d&&d>=a&&d<=b;
const sum=(arr,f=x=>x.amount)=>arr.reduce((t,x)=>t+(+f(x)||0),0);
const nice=s=>s?P(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
const short=d=>d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const isCash=e=>e.paidFrom!=='Goal Funds';
const savSigned=s=>s.action==='Deposit'?+s.amount:-s.amount;
const parseAmt=v=>+String(v??'').replace(/[^\d.]/g,'')||0;
function fmtAmtInput(v){let s=String(v??'').replace(/[^\d.]/g,'');if(s==='')return '';const i=s.indexOf('.');if(i>=0)s=s.slice(0,i+1)+s.slice(i+1).replace(/\./g,'');
  let [a,b]=s.split('.');a=(a||'').replace(/^0+(?=\d)/,'');const ai=a?Number(a).toLocaleString('en-US'):'0';return b!==undefined?ai+'.'+b.slice(0,2):ai;}
const buzz=()=>{try{navigator.vibrate&&navigator.vibrate(12);}catch(_){}};
function toast(m,act){const t=$('toast');t.innerHTML=`<span>${esc(m)}</span>`+(act?`<button class="tact">${esc(act.label)}</button>`:'');
  t.classList.toggle('has',!!act);t.classList.add('show');if(act) t.querySelector('.tact').onclick=()=>{t.classList.remove('show');act.fn();};
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),act?6000:2200);}
const cssv=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---- derived fields (mirror the workbook formulas) ---- */
function payCycle(r){
  if(!r.covStart||!r.covEnd) return '';
  const a=P(r.covStart),b=P(r.covEnd);
  if(a.getDate()===1&&b.getDate()===15) return '1st-15th';
  if(b.getDate()===eom(b.getFullYear(),b.getMonth()).getDate()) return '16th-Month End';
  return 'Custom / Partial';
}
function stdPayday(r){
  const c=payCycle(r); if(!c||!r.covEnd) return '';
  const b=P(r.covEnd);
  if(c==='1st-15th') return iso(new Date(b.getFullYear(),b.getMonth(),15));
  if(c==='16th-Month End') return iso(payday30(b.getFullYear(),b.getMonth()));
  return '';
}
function timing(r){
  if(!r.date) return 'Pending';
  const sp=stdPayday(r), due=r.adjPay||sp;
  if(!due) return 'Unscheduled';
  if(r.date<due) return 'Paid Early';
  if(r.date>due) return 'Paid Late';
  if(r.adjPay&&sp&&r.adjPay<sp) return 'Adjusted Early';
  if(r.adjPay&&sp&&r.adjPay>sp) return 'Adjusted Late';
  return r.adjPay?'On Adjusted Date':'On Time';
}
function periodRange(monthStr,view){
  const d=P(monthStr),y=d.getFullYear(),m=d.getMonth();
  const p30=payday30(y,m);
  switch(view){
    case '1st-14th': return [iso(new Date(y,m,1)),iso(new Date(y,m,14))];
    case '15th-Payday Eve': return [iso(new Date(y,m,15)),iso(new Date(p30.getTime()-864e5))];
    case 'Payday-14th': return [iso(p30),iso(new Date(y,m+1,14))];
    default: return [iso(new Date(y,m,1)),iso(eom(y,m))];
  }
}
/* ---- wallets ---- */
const isCredit=w=>!!w&&w.type==='credit';
const defaultWallet=()=>{const w=S.wallets.find(w=>!isCredit(w))||S.wallets[0];return w?w.id:'';};
const wById=id=>S.wallets.find(w=>w.id===id);
const wOf=r=>(r&&r.wallet&&wById(r.wallet))?r.wallet:defaultWallet();
function wFlows(w,a,b,excludeAdjustmentId){const id=w.id;
  const inc=sum(S.income.filter(r=>wOf(r)===id&&inR(r.date,a,b)));
  const exp=sum(S.expenses.filter(e=>isCash(e)&&wOf(e)===id&&inR(e.date,a,b)));
  const dep=sum(S.savings.filter(r=>r.action==='Deposit'&&wOf(r)===id&&inR(r.date,a,b)));
  const wd=sum(S.savings.filter(r=>r.action==='Withdrawal'&&wOf(r)===id&&inR(r.date,a,b)));
  const tin=sum(S.transfers.filter(t=>t.to===id&&inR(t.date,a,b))), tout=sum(S.transfers.filter(t=>t.from===id&&inR(t.date,a,b)));
  const adjustment=sum(S.adjustments.filter(r=>r.wallet===id&&r.id!==excludeAdjustmentId&&inR(r.date,a,b)),r=>r.delta);
  return {in:inc+wd+tin,out:exp+dep+tout,adjustment};}
function walletBal(w,end,excludeAdjustmentId){const f=wFlows(w,S.settings.startDate,end||today(),excludeAdjustmentId);return (isCredit(w)?-(+w.start||0):(+w.start||0))+f.in-f.out+f.adjustment;}
const srcOf=r=>r.paidFrom==='Goal Funds'?'__goal':wOf(r);
function srcToFields(src){return src==='__goal'?{paidFrom:'Goal Funds',wallet:''}:{paidFrom:'Cash Balance',wallet:src||defaultWallet()};}
const WI={cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',ewallet:'<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/>',bank:'<path d="M3 10h18L12 4z"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',credit:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',goal:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'};
const WTYPE={cash:'Cash',ewallet:'E-wallet',bank:'Bank',credit:'Credit card'};
function wColor(id){const i=S.wallets.findIndex(w=>w.id===id);return ['#10B981','#0EA5E9','#22C55E','#6366F1','#EF4444','#8B5CF6','#F59E0B','#14B8A6','#EC4899','#64748B'][(i<0?0:i)%10];}
const svgI=(d,sw=2)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
function wIcon(id){const w=wById(id);const t=id==='__goal'?'goal':(w?w.type:'cash');const c=id==='__goal'?'#8B5CF6':wColor(id);return `<span class="cico" style="--c:${c}">${svgI(WI[t])}</span>`;}
const wName=id=>id==='__goal'?'Goal Funds':((wById(id)||{}).name||'—');
/* ---- bills ---- */
function nextPayday(fromIso){const d=P(fromIso),y=d.getFullYear(),m=d.getMonth();const c15=new Date(y,m,15),c30=payday30(y,m);
  if(d<c15) return iso(c15); if(d<c30) return iso(c30); return iso(new Date(y,m+1,15));}
const ymOf=(y,m)=>`${y}-${pad(m+1)}`;
function billDue(b,y,m){return iso(new Date(y,m,Math.min(+b.dueDay||1,eom(y,m).getDate())));}
const billPayment=(b,ym)=>S.expenses.find(e=>e.billId===b.id&&e.billMonth===ym);
function billAllotmentData(b,ym){
  const saved=(b.allotments||{})[ym];
  if(typeof saved==='number') return {amount:Math.max(0,saved),wallet:defaultWallet()};
  const wallet=saved&&S.wallets.some(w=>w.id===saved.wallet&&!isCredit(w))?saved.wallet:defaultWallet();
  return {amount:Math.max(0,+(saved&&saved.amount)||0),wallet};
}
const billAllotment=(b,ym)=>billAllotmentData(b,ym).amount;
function billState(b,y,m){const ym=ymOf(y,m),due=billDue(b,y,m),t=today();
  const paid=billPayment(b,ym); if(paid) return {ym,due,st:'paid',paid};
  if((b.skips||[]).includes(ym)) return {ym,due,st:'skipped'};
  const days=Math.round((P(due)-P(t))/864e5);
  return {ym,due,days,st:days<0?'overdue':days<=3?'soon':'scheduled'};}
function upcomingBills(){const t=today(),np=nextPayday(t),T=P(t),out=[],N=new Date(T.getFullYear(),T.getMonth()+1,1);
  const months=[[T.getFullYear(),T.getMonth()],[N.getFullYear(),N.getMonth()]];
  S.bills.filter(b=>b.status!=='Paused').forEach(b=>months.forEach(([y,m])=>{
    const x=billState(b,y,m); if(x.st==='paid'||x.st==='skipped'||x.due>np) return;
    if(b.created&&x.ym<b.created.slice(0,7)) return;
    out.push({b,...x});}));
  return {np,list:out.sort((a,b)=>a.due.localeCompare(b.due))};}
function billsNeedingAllotment(){const T=P(today()),N=new Date(T.getFullYear(),T.getMonth()+1,1),out=[];
  S.bills.filter(b=>b.status!=='Paused').forEach(b=>[[T.getFullYear(),T.getMonth()],[N.getFullYear(),N.getMonth()]].forEach(([y,m])=>{
    const x=billState(b,y,m);
    const remaining=Math.max(0,(+b.amount||0)-billAllotment(b,x.ym));
    if(x.days<0||x.days>5||x.st==='paid'||x.st==='skipped'||(b.created&&x.ym<b.created.slice(0,7))||remaining<=0.005) return;
    out.push({b,...x,remaining});}));
  return out.sort((a,b)=>a.due.localeCompare(b.due));}
function billAllotments(ym=today().slice(0,7)){
  const [y,month]=ym.split('-').map(Number),m=month-1,out={};
  S.bills.forEach(b=>{
    if(b.status==='Paused'||(b.created&&ym<b.created.slice(0,7))) return;
    const state=billState(b,y,m);
    if(state.st==='paid'||state.st==='skipped') return;
    const allot=billAllotmentData(b,ym);
    if(allot.amount&&wById(allot.wallet)&&!isCredit(wById(allot.wallet))) out[allot.wallet]=(out[allot.wallet]||0)+allot.amount;
  });
  return out;
}
const billAllotted=(wallet,ym)=>billAllotments(ym)[wallet]||0;
function dueLabel(x){return x.st==='overdue'?`<small class="due-over">Overdue · ${short(P(x.due))}</small>`:x.days===0?`<small class="due-soon">Due today</small>`:x.days===1?`<small class="due-soon">Due tomorrow · ${short(P(x.due))}</small>`:`<small class="${x.st==='soon'?'due-soon':'due-ok'}">In ${x.days} days · ${short(P(x.due))}</small>`;}
const ordinal=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};

/* ---- core calculations ---- */
function balances(asOf){
  const s=S.settings, st=s.startDate, end=asOf||today();
  const inc=sum(S.income.filter(r=>inR(r.date,st,end)));
  const cashExp=sum(S.expenses.filter(e=>isCash(e)&&inR(e.date,st,end)));
  const goalExp=sum(S.expenses.filter(e=>!isCash(e)&&inR(e.date,st,end)));
  const sv=S.savings.filter(r=>inR(r.date,st,end));
  const netSav=sum(sv,savSigned);
  const goalSav=sum(sv.filter(r=>r.account==='Goal'),savSigned);
  const goalFunds=(+s.startGoal||0)+goalSav-goalExp;
  const other=(+s.startOther||0)+netSav-goalSav;
  const cash=sum(S.wallets.filter(w=>!isCredit(w)),w=>walletBal(w,end));
  const owed=-sum(S.wallets.filter(isCredit),w=>walletBal(w,end));
  const reserved=end===today()?sum(Object.values(billAllotments()),x=>x):0;
  return {inc,cashExp,goalExp,netSav,cash,availableCash:cash-reserved,owed,other,goalFunds,totalSav:other+goalFunds};
}
function periodStats(a,b){
  const s=S.settings;
  const inc=sum(S.income.filter(r=>inR(r.date,a,b)));
  const exp=sum(S.expenses.filter(e=>inR(e.date,a,b)));
  const cred=new Set(S.wallets.filter(isCredit).map(w=>w.id));
  const cashExp=sum(S.expenses.filter(e=>isCash(e)&&!cred.has(wOf(e))&&inR(e.date,a,b)));
  const creditExp=sum(S.expenses.filter(e=>isCash(e)&&cred.has(wOf(e))&&inR(e.date,a,b)));
  const goalExpP=sum(S.expenses.filter(e=>!isCash(e)&&inR(e.date,a,b)));
  const cardPay=sum(S.transfers.filter(t=>inR(t.date,a,b)&&!cred.has(t.from)&&cred.has(t.to)))-sum(S.transfers.filter(t=>inR(t.date,a,b)&&cred.has(t.from)&&!cred.has(t.to)));
  const dep=sum(S.savings.filter(r=>r.action==='Deposit'&&inR(r.date,a,b)));
  const wd=sum(S.savings.filter(r=>r.action==='Withdrawal'&&inR(r.date,a,b)));
  const netSav=dep-wd, net=inc-cashExp-cardPay-netSav;
  const before=iso(new Date(P(a).getTime()-864e5));
  const opening=a<=s.startDate?sum(S.wallets.filter(w=>!isCredit(w)),w=>+w.start||0):balances(before).cash;
  const adjustment=sum(S.adjustments.filter(r=>!isCredit(wById(r.wallet))&&inR(r.date,a,b)),r=>r.delta);
  return {inc,exp,cashExp,creditExp,goalExpP,cardPay,dep,wd,netSav,net,rate:inc?netSav/inc:0,opening,adjustment,closing:opening+net+adjustment,savEnd:balances(b).totalSav};
}
function goalStats(){
  return S.goals.map(g=>{
    const alloc=sum(S.allocs.filter(a=>a.goal===g.id));
    const need=Math.max(g.target-alloc,0);
    const f=g.target>0?Math.min(alloc/g.target,1):0;
    const status=need===0?'Goal Achieved':(g.date&&today()>g.date?'Past Target':'In Progress');
    return {...g,alloc,need,f,status};
  });
}
function monthsList(){
  const st=P(S.settings.startDate), out=[];
  const dates=[...S.income,...S.expenses,...S.savings,...S.transfers,...S.adjustments].map(r=>r.date).filter(Boolean).sort();
  const now=new Date(), last=dates.length?P(dates[dates.length-1]):now;
  const endM=Math.max(last.getFullYear()*12+last.getMonth(),now.getFullYear()*12+now.getMonth())+1;
  for(let k=st.getFullYear()*12+st.getMonth();k<=endM;k++) out.push(iso(new Date(Math.floor(k/12),k%12,1)));
  return out;
}
const mLabel=s=>P(s).toLocaleDateString('en-US',{month:'long',year:'numeric'});
function fillSelect(el,opts,first){
  const cur=el.value;
  el.innerHTML=(first||'')+opts.map(o=>typeof o==='string'?`<option>${esc(o)}</option>`:`<option value="${esc(o.v)}">${esc(o.l)}</option>`).join('');
  if([...el.options].some(o=>o.value===cur)) el.value=cur;
}

/* ================= ICONS & SMALL COMPONENTS ================= */
const PAL=['#10B981','#F59E0B','#6366F1','#8B5CF6','#0EA5E9','#EF4444','#14B8A6','#EC4899','#84CC16','#64748B','#F97316','#06B6D4'];
const IC={
 wallet:'<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
 up:'<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',down:'<path d="M17 7L7 17"/><path d="M16 17H7V8"/>',
 piggy:'<path d="M19 7h-1.5A6 6 0 0 0 6 9.5V10a3 3 0 0 0-3 3v1h3a6 6 0 0 0 3 4v2h3v-1h2v1h3v-2.5A6 6 0 0 0 20 12V8a1 1 0 0 0-1-1z"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 flow:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',gauge:'<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',stack:'<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>',
 check:'<path d="M20 6L9 17l-5-5"/>',bill:'<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
 swap:'<path d="M7 7h13l-4-4M17 17H4l4 4"/>',list:'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'
};
const CI={
 'Rent':'<path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
 'Food':'<path d="M7 2v20"/><path d="M4 2v6a3 3 0 0 0 6 0V2"/><path d="M17 2c-2 2-3 5-3 8h3v12"/>',
 'Commute':'<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16"/><circle cx="8" cy="14.5" r="1"/><circle cx="16" cy="14.5" r="1"/><path d="M7 18v3M17 18v3"/>',
 'Grocery':'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11l2-8H6"/>',
 'Online Shopping':'<path d="M5 7h14l-1 14H6z"/><path d="M9 7a3 3 0 0 1 6 0"/>',
 'Online Payment':'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
 'Gift':'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z"/>',
 'Electric':'<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
 'Water':'<path d="M12 2.5s7 7.5 7 12.5a7 7 0 0 1-14 0c0-5 7-12.5 7-12.5z"/>',
 'Internet':'<path d="M2 8.5a15 15 0 0 1 20 0"/><path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
 'Salary':'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
 '13th Month Pay':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 'Bonus':'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
 'Side Gig':'<rect x="4" y="4" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
 'Other Income':'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
 'Emergency Fund':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v6M9 11h6"/>',
 'General Savings':'<path d="M19 7h-1.5A6 6 0 0 0 6 9.5V10a3 3 0 0 0-3 3v1h3a6 6 0 0 0 3 4v2h3v-1h2v1h3v-2.5A6 6 0 0 0 20 12V8a1 1 0 0 0-1-1z"/>',
 'Investment':'<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
 'Travel / Major Purchase':'<path d="M10.5 13.5L3 11l18-8-8 18-2.5-7.5z"/>',
 'Goal':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'
};
const CI_DEFAULT='<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>';
function catIcon(kind,name){const list=S.lists[kind]||[];const i=list.indexOf(name);const col=PAL[(i<0?list.length:i)%PAL.length];
  return `<span class="cico" style="--c:${col}">${svgI(CI[name]||CI_DEFAULT)}</span>`;}
const kpi=(l,v,s,cls='',ic='wallet',tone='em')=>`<div class="kpi"><div class="ico t-${tone}">${svgI(IC[ic]||'')}</div><div style="min-width:0"><div class="l">${l}</div><div class="v ${cls}">${v}</div>${s?`<div class="s">${s}</div>`:''}</div></div>`;
const emptyState=(ic,title,text,btn)=>`<div class="es"><div class="esi">${svgI(IC[ic]||CI_DEFAULT)}</div><b>${title}</b><p>${text}</p>${btn||''}</div>`;
function statusPill(s){const c={'Goal Achieved':'good','Past Target':'bad','In Progress':'','On Time':'good','On Adjusted Date':'good','Paid Early':'good','Adjusted Early':'good','Paid Late':'bad','Adjusted Late':'warn','Pending':'warn','Unscheduled':''}[s]??'';return s?`<span class="pill ${c}">${esc(s)}</span>`:'';}
const kfmt=v=>v>=1000?'₱'+(v/1000).toFixed(v>=10000?0:1).replace(/\.0$/,'')+'k':'₱'+Math.round(v);
const charts={};
function mkChart(id,cfg){if(charts[id]){charts[id].destroy();delete charts[id];} if(typeof Chart==='undefined') return; charts[id]=new Chart($(id),cfg);}
function chartTheme(){if(typeof Chart==='undefined')return;Chart.defaults.font.family='"Segoe UI Variable","Segoe UI",Inter,Roboto,Arial,sans-serif';Chart.defaults.color=cssv('--muted');
  Chart.defaults.plugins.legend.labels.usePointStyle=true;Chart.defaults.plugins.legend.labels.boxWidth=8;Chart.defaults.plugins.tooltip.backgroundColor='#0F1E3D';Chart.defaults.plugins.tooltip.padding=10;Chart.defaults.plugins.tooltip.cornerRadius=8;}
const gridOpt=()=>({grid:{color:cssv('--line')},border:{display:false}});
const secOpen=id=>{const el=document.querySelector(`details[data-sec="${id}"]`);return !!(el&&el.open);};

/* ================= ACTIVITY ITEMS / ROWS ================= */
const goalName=id=>(S.goals.find(g=>g.id===id)||{}).name||'(deleted goal)';
function buildItems(kinds){const out=[];const has=k=>kinds.includes(k);
  if(has('expenses')) S.expenses.forEach(r=>out.push({kind:'expenses',r,date:r.date||'',title:r.type,sub:[wName(srcOf(r)),r.note].filter(Boolean),amt:-(+r.amount||0),icon:catIcon('expense',r.type),tag:r.billId?'<span class="pill">Bill</span>':''}));
  if(has('income')) S.income.forEach(r=>{const tm=timing(r);out.push({kind:'income',r,date:r.date||'',title:r.type,sub:[wName(wOf(r)),r.desc,payCycle(r)].filter(Boolean),amt:+r.amount||0,icon:catIcon('income',r.type),tag:(tm&&tm!=='On Time'&&tm!=='Unscheduled')?statusPill(tm):''});});
  if(has('transfers')) S.transfers.forEach(r=>out.push({kind:'transfers',r,date:r.date||'',title:`${wName(r.from)} → ${wName(r.to)}`,sub:[r.note||'Transfer'],amt:+r.amount||0,mv:true,icon:`<span class="cico" style="--c:#6366F1">${svgI(IC.swap)}</span>`}));
  if(has('savings')) S.savings.forEach(r=>out.push({kind:'savings',r,date:r.date||'',title:`${r.action==='Deposit'?'Saved to':'Withdrew from'} ${r.account}`,sub:[wName(wOf(r)),r.note].filter(Boolean),amt:r.action==='Deposit'?-(+r.amount||0):+r.amount||0,mv:true,icon:catIcon('savings',r.account)}));
  if(has('allocs')) S.allocs.forEach(r=>out.push({kind:'allocs',r,date:r.date||'',title:goalName(r.goal),sub:[r.note||'Allocation'],amt:+r.amount||0,mv:true,icon:catIcon('savings','Goal')}));
  if(has('adjustments')) S.adjustments.forEach(r=>{const w=wById(r.wallet);out.push({kind:'adjustments',r,date:r.date||'',title:`Reconciled ${wName(r.wallet)}`,sub:[isCredit(w)?`Amount owed: ${fmt(r.actual)}`:`Balance: ${fmt(r.actual)}`,r.note].filter(Boolean),amt:+r.delta||0,icon:wIcon(r.wallet),tag:'<span class="pill">Reconciliation</span>'});});
  return out.sort((a,b)=>(!a.date?-1:!b.date?1:b.date.localeCompare(a.date)));}
function rowHtml(it){const cls=it.mv?'mv':it.amt>0?'in':'';const sign=it.mv?'':it.amt>0?'+':it.amt<0?'−':'';
  return `<div class="trow" data-kind="${it.kind}" data-id="${it.r.id}"><div class="tmain">${it.icon}<div class="tt"><b>${esc(it.title)} ${it.tag||''}</b><small>${it.sub.map(esc).join(' · ')||'&nbsp;'}</small></div><div class="ta ${cls}">${sign}${fmt(Math.abs(it.amt))}</div></div></div>`;}
function dayLabel(d){if(!d) return 'Pending';const t=today(),y=iso(new Date(Date.now()-864e5));if(d===t) return 'Today';if(d===y) return 'Yesterday';
  const D=P(d);return D.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',...(D.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})});}
function groupsHtml(items,limit){const g=[],idx={};(limit?items.slice(0,limit):items).forEach(it=>{const k=it.date||'pending';if(!(k in idx)){idx[k]=g.length;g.push({k,items:[]});}g[idx[k]].items.push(it);});
  return g.map(x=>{const out=sum(x.items.filter(i=>i.kind==='expenses'),i=>-i.amt),inn=sum(x.items.filter(i=>i.kind==='income'),i=>i.amt);
    const right=[out?`−${fmt(out)}`:'',inn?`+${fmt(inn)}`:''].filter(Boolean).join(' · ');
    return `<div class="tgroup"><div class="tgh"><span>${dayLabel(x.k==='pending'?'':x.k)}</span><span>${right}</span></div><div class="tlist">${x.items.map(rowHtml).join('')}</div></div>`;}).join('');}

/* ================= HOME ================= */
function renderDash(){
  const month=$('fMonth').value, view=$('fPeriod').value; if(!month) return;
  const [a,b]=periodRange(month,view);
  const d=P(month),y=d.getFullYear(),m=d.getMonth(),mA=iso(new Date(y,m,1)),mB=iso(eom(y,m)),t=today();
  $('mLbl').textContent=mLabel(month);
  const idx=$('fMonth').selectedIndex;document.querySelectorAll('[data-mstep]').forEach(x=>x.disabled=(+x.dataset.mstep<0?idx<=0:idx>=$('fMonth').options.length-1));
  document.querySelectorAll('#pSeg button').forEach(x=>x.classList.toggle('on',x.dataset.period===view));
  $('periodHead').textContent=`${view==='Full Month'?mLabel(month):`${short(P(a))} – ${short(P(b))}`} · selected period`;
  const now=balances(), p=periodStats(a,b), goalFundsAlloc=sum(S.allocs);
  const ub=upcomingBills(), ubTotal=sum(ub.list,x=>+x.b.amount||0);
  const reserved=now.cash-now.availableCash;
  const days=Math.max(1,Math.round((P(ub.np)-P(t))/864e5));
  const nCash=S.wallets.filter(w=>!isCredit(w)).length;
  const npL=short(P(ub.np)), dl=`${days} day${days===1?'':'s'}`;
  const status=now.availableCash>=0
    ?`<div class="hm-status ok"><span class="si">${svgI(IC.check,2.4)}</span><div class="st"><b>${fmt(now.availableCash/days)} <span>/ day</span></b>safe to spend for ${dl} until payday (${npL})</div></div>`
    :`<div class="hm-status short"><span class="si">${svgI(IC.alert,2.2)}</span><div class="st"><b>${fmt(-now.availableCash)} <span>below zero</span></b>Your available wallet balances are below zero.</div></div>`;
  $('heroMain').innerHTML=`<div class="hm-top"><div class="l">Money in hand</div><div class="v">${fmt(now.availableCash)}</div><div class="s">Across ${nCash} wallet${nCash===1?'':'s'}${reserved>0.005?` · ${fmt(reserved)} allotted to bills`:''}${now.owed>0.005?' · excludes credit cards':''}</div></div>
    ${status}
    <div class="hm-stats"><div><span>Net worth</span><b>${fmt(now.cash+now.totalSav-now.owed)}</b></div>${now.owed>0.005?`<div><span>Card owed</span><b>${fmt(now.owed)}</b></div>`:`<div><span>Total savings</span><b>${fmt(now.totalSav)}</b></div>`}<div><span>Bills before payday</span><b>${fmt(ubTotal)}</b></div></div>`;
  // budget card
  const monthExp=S.expenses.filter(e=>inR(e.date,mA,mB));
  const budTotal=S.lists.expense.reduce((s,c)=>s+(+S.budget[c]||0),0), spentM=sum(monthExp), used=budTotal?spentM/budTotal:0, left=budTotal-spentM;
  const isCur=month.slice(0,7)===t.slice(0,7), daysLeft=isCur?eom(y,m).getDate()-P(t).getDate()+1:0;
  const rc=used>1?'var(--red)':used>=.8?'var(--amber)':'var(--em)';
  $('budgetCard').innerHTML=budTotal?`<div class="ring lg" style="--p:${Math.min(used,1)*100};--rc:${rc}"><span>${Math.round(used*100)}%</span></div><div style="min-width:0"><div class="l">Budget left · ${d.toLocaleDateString('en-US',{month:'long'})}</div><div class="v ${left<0?'neg':''}">${left<0?fmt(-left)+' over':fmt(left)}</div><div class="s">${fmt(spentM)} of ${fmt(budTotal)} spent${isCur?` · ${daysLeft} day${daysLeft===1?'':'s'} left`:''}</div></div>`
    :`<div class="ring lg"><span>—</span></div><div><div class="l">No monthly budget yet</div><div class="s" style="margin:4px 0 8px">Set limits per category to track what's left.</div><button class="btn sec sm" data-goto="settings">Set budget</button></div>`;
  $('kpiNow').innerHTML=kpi('Total savings',fmt(now.totalSav),'Other + goal funds','','shield','navy')+kpi('Goal funds',fmt(now.goalFunds),`${fmt(goalFundsAlloc)} allocated`,now.goalFunds<0?'neg':'','target','violet');
  $('wStrip').innerHTML=S.wallets.map(w=>{const v=walletBal(w),available=v-(isCredit(w)?0:billAllotted(w.id));return `<div class="wchip" data-goto="wallets">${wIcon(w.id)}<div><div class="l">${esc(w.name)}</div><b class="${available<0?'neg':''}">${isCredit(w)?(v<0?'Owed '+fmt(-v):fmt(v)):fmt(available)}</b></div></div>`;}).join('');
  // alerts
  const al=[];
  ub.list.filter(x=>x.st==='overdue').forEach(x=>al.push(`<div class="alert bad"><span><b>${esc(x.b.name)}</b> was due ${nice(x.due)} and isn't marked paid.</span></div>`));
  billsNeedingAllotment().forEach(x=>al.push(`<div class="alert warn"><span>${billAllotment(x.b,x.ym)?`You still have ${fmt(x.remaining)} left to allot for <b>${esc(x.b.name)}</b>`:`You did not allot money for <b>${esc(x.b.name)}</b> yet; ${fmt(x.remaining)} remains to allot`} before its due date (${nice(x.due)}).</span><button class="btn sm abtn" data-goto="bills">Allot money</button></div>`));
  S.lists.expense.forEach(c=>{const bd=+S.budget[c]||0, sp=sum(monthExp.filter(e=>e.type===c));
    if(bd>0&&sp>bd) al.push(`<div class="alert bad"><span><b>${esc(c)}</b> is over budget by ${fmt(sp-bd)} this month.</span></div>`);
    else if(bd>0&&sp>=bd*0.8) al.push(`<div class="alert warn"><span><b>${esc(c)}</b> has used ${pct(sp/bd)} of its budget.</span></div>`);});
  if(goalFundsAlloc>now.goalFunds+0.005) al.push(`<div class="alert bad"><span>Goal allocations (${fmt(goalFundsAlloc)}) exceed available goal funds (${fmt(now.goalFunds)}).</span></div>`);
  const bd=backupDue(); if(bd) al.push(`<div class="alert warn"><span>${bd.days==null?"You haven't made a backup yet.":`Your last backup was ${bd.days} days ago.`} A monthly backup keeps a safe copy outside the app.</span><button class="btn sm abtn" data-backup>Back up now</button></div>`);
  const pend=S.income.filter(r=>!r.date).length; if(pend) al.push(`<div class="alert warn"><span>${pend} income record${pend>1?'s':''} pending (no date received).</span></div>`);
  $('alerts').innerHTML=al.join('');
  renderChecklist(); renderUpcoming(ub); renderHeat(month);
  // period KPIs
  $('kpiPeriod').innerHTML=
    kpi('Income received',fmt(p.inc),'','','up','em')+
    kpi('Expenses',fmt(p.exp),[p.creditExp>0.005?`${fmt(p.creditExp)} on credit`:'',p.goalExpP>0.005?`${fmt(p.goalExpP)} from goal funds`:''].filter(Boolean).join(' · '),'','down','red')+
    kpi('Net savings',fmt(p.netSav),`Savings rate ${pct(p.rate)}`,'','piggy','teal')+
    kpi('Net cash flow',fmt(p.net),'After spending, card payments & savings',p.net<0?'neg':'pos','flow','navy');
  // spending section
  renderCompare(month);
  const rows=S.lists.expense.map(c=>({c,bd:+S.budget[c]||0,sp:sum(monthExp.filter(e=>e.type===c))})).filter(x=>x.bd>0||x.sp>0);
  $('budgetTbl').innerHTML=rows.length?rows.map(x=>{const r=x.bd?x.sp/x.bd:(x.sp>0?1.01:0),cls=r>1?'over':r>=.8?'near':'';
    return `<div class="brow"><div class="bn">${catIcon('expense',x.c)}<span>${esc(x.c)}</span></div><div class="bb"><div class="bar"><i class="${cls}" style="width:${Math.min(r,1)*100}%"></i></div></div><div class="bv"><b class="${x.bd&&x.sp>x.bd?'neg':''}">${fmt(x.sp)}</b>${x.bd?'of '+fmt(x.bd):'no budget'}</div></div>`;}).join('')+
    `<div class="brow" style="font-weight:800"><div class="bn"><span>Total</span></div><div class="bb"><div class="bar"><i class="${used>1?'over':used>=.8?'near':''}" style="width:${Math.min(used,1)*100}%"></i></div></div><div class="bv"><b>${fmt(spentM)}</b>of ${fmt(budTotal)}</div></div><div class="note">Categories with no budget and no spending are hidden.</div>`
    :emptyState('gauge','No budget or spending yet','Set category limits to see progress here.','<button class="btn sec sm" data-goto="settings">Set budget</button>');
  if(secOpen('spend')){const pExp=S.expenses.filter(e=>inR(e.date,a,b));
    const cats=S.lists.expense.map((c,i)=>({c,v:sum(pExp.filter(e=>e.type===c)),col:PAL[i%PAL.length]})).filter(x=>x.v>0);
    mkChart('chCat',{type:'doughnut',data:{labels:cats.map(x=>x.c),datasets:[{data:cats.map(x=>x.v),backgroundColor:cats.map(x=>x.col),borderColor:cssv('--card'),borderWidth:3,hoverOffset:8,borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:innerWidth<760?'bottom':'right'},tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.raw)} (${pct(c.raw/p.exp)})`}}}}});}
  // flow section
  const sal=c=>sum(S.income.filter(r=>r.type==='Salary'&&payCycle(r)===c&&r.covStart>=mA&&r.covEnd<=mB));
  const a15=sal('1st-15th'),a30=sal('16th-Month End'),st=S.settings,e15=+st.sal15||0,e30=+st.sal30||0;
  const srow=(l,e,ac)=>`<tr><td>${l}</td><td class="n">${fmt(e)}</td><td class="n">${fmt(ac)}</td><td class="n ${ac-e<0?'neg':'pos'}">${fmt(ac-e)}</td></tr>`;
  $('salaryTbl').innerHTML=`<table><tr><th>Pay cycle</th><th class="n">Expected</th><th class="n">Actual</th><th class="n">Diff</th></tr>${srow('15th',e15,a15)}${srow('30th',e30,a30)}<tr class="total"><td>Total</td><td class="n">${fmt(e15+e30)}</td><td class="n">${fmt(a15+a30)}</td><td class="n">${fmt(a15+a30-e15-e30)}</td></tr></table>`;
  const cr=(l,v)=>`<tr><td>${l}</td><td class="n">${fmt(v)}</td></tr>`;
  $('cashTbl').innerHTML=`<table>${cr('Opening cash',p.opening)}${cr('+ Income received',p.inc)}${cr('− Spent from wallets',p.cashExp)}${Math.abs(p.cardPay)>0.005?cr('− Credit card payments',p.cardPay):''}${cr('− Savings deposited',p.dep)}${cr('+ Savings withdrawn',p.wd)}${p.adjustment?cr('± Wallet adjustments',p.adjustment):''}<tr class="total"><td>Closing cash</td><td class="n">${fmt(p.closing)}</td></tr>${cr('Total savings at period end',p.savEnd)}</table>`;
  // trend section
  const pInc=S.income.filter(r=>inR(r.date,a,b));
  $('incBreak').innerHTML=`<table><tr><th>Income type</th><th class="n">Amount</th><th class="n">Share</th></tr>${S.lists.income.map(tp=>{const v=sum(pInc.filter(r=>r.type===tp));return `<tr><td><span class="catcell">${catIcon('income',tp)}${esc(tp)}</span></td><td class="n">${fmt(v)}</td><td class="n">${pct(p.inc?v/p.inc:0)}</td></tr>`;}).join('')}<tr class="total"><td>Total</td><td class="n">${fmt(p.inc)}</td><td class="n">${p.inc?'100.0%':'0.0%'}</td></tr></table>`;
  if(secOpen('trend')){const tr=[];for(let k=5;k>=0;k--){const dd=new Date(y,m-k,1);tr.push([iso(dd),iso(eom(dd.getFullYear(),dd.getMonth()))]);}
    const ts=tr.map(([x,z])=>periodStats(x,z));
    mkChart('chTrend',{type:'bar',data:{labels:tr.map(([x])=>P(x).toLocaleDateString('en-US',{month:'short',year:'2-digit'})),
      datasets:[{label:'Income',data:ts.map(s=>s.inc),backgroundColor:'#10B981',borderRadius:6,maxBarThickness:18},{label:'Expenses',data:ts.map(s=>s.exp),backgroundColor:document.documentElement.dataset.theme==='dark'?'#6366F1':'#1B2F5B',borderRadius:6,maxBarThickness:18},{label:'Net savings',data:ts.map(s=>s.netSav),backgroundColor:'#F59E0B',borderRadius:6,maxBarThickness:18}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',align:'end'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw)}`}}},scales:{x:{grid:{display:false},border:{display:false}},y:{beginAtZero:true,...gridOpt()}}}});}
  const gs=goalStats();
  $('goalDash').innerHTML=gs.length?goalCards(gs):emptyState('target','No goals yet','Save up for something you want.','<button class="btn sec sm" data-new="goals">+ Add goal</button>');
}
function renderCompare(month){
  const d=P(month),y=d.getFullYear(),m=d.getMonth(),t=today(),isCur=month.slice(0,7)===t.slice(0,7);
  const pd=new Date(y,m-1,1),py=pd.getFullYear(),pm=pd.getMonth();
  let a1=iso(new Date(y,m,1)),b1=iso(eom(y,m)),a0=iso(pd),b0=iso(eom(py,pm));
  if(isCur){const day=P(t).getDate();b1=t;b0=iso(new Date(py,pm,Math.min(day,eom(py,pm).getDate())));}
  const c1={},c0={};S.expenses.forEach(e=>{const v=+e.amount||0;if(inR(e.date,a1,b1))c1[e.type]=(c1[e.type]||0)+v;if(inR(e.date,a0,b0))c0[e.type]=(c0[e.type]||0)+v;});
  const T1=sum(Object.values(c1),x=>x),T0=sum(Object.values(c0),x=>x);
  $('cmpTitle').textContent=`vs ${pd.toLocaleDateString('en-US',{month:'long'})}${isCur?' (same days)':''}`;
  const pill=(a,b)=>{if(b<=0) return a>0?'<span class="pill warn">New</span>':'';const c=(a-b)/b;if(Math.abs(c)<.005) return '<span class="pill">Same</span>';return `<span class="pill ${c>0?'bad':'good'}">${c>0?'▲':'▼'} ${Math.abs(c*100).toFixed(0)}%</span>`;};
  const cats=[...new Set([...Object.keys(c1),...Object.keys(c0)])].sort((x,z)=>(c1[z]||0)-(c1[x]||0));
  if(!cats.length){$('cmpBox').innerHTML=emptyState('flow','Nothing to compare yet','Spending from this month and last month will appear here.');return;}
  const diff=T1-T0;
  $('cmpBox').innerHTML=`<div class="cmptot"><div><div class="l">${isCur?'Spent so far':'Spent'}</div><b>${fmt(T1)}</b></div><div style="text-align:center;align-self:center">${pill(T1,T0)}</div><div style="text-align:right"><div class="l">Last month${isCur?' by now':''}</div><b>${fmt(T0)}</b></div></div>
    <div class="note" style="margin:0 0 6px">${T0>0?`You've spent <b>${fmt(Math.abs(diff))} ${diff>0?'more':'less'}</b> than ${pd.toLocaleDateString('en-US',{month:'long'})}${isCur?' at this point':''}.`:'No spending recorded last month.'}</div>`+
    cats.slice(0,8).map(c=>`<div class="brow"><div class="bn">${catIcon('expense',c)}<span>${esc(c)}</span></div><div class="bb" style="text-align:right">${pill(c1[c]||0,c0[c]||0)}</div><div class="bv"><b>${fmt(c1[c]||0)}</b>was ${fmt(c0[c]||0)}</div></div>`).join('');
}
function renderUpcoming(ub){
  $('upTitle').textContent=`Upcoming bills · before ${short(P(ub.np))}`;
  const el=$('upBills');
  if(!S.bills.length){el.innerHTML=emptyState('bill','No recurring bills yet','Add rent, internet and utilities to see what\'s due before payday.','<button class="btn sec sm" data-goto="bills">Set up bills</button>');return;}
  if(!ub.list.length){el.innerHTML=`<div class="alert good" style="margin:0"><span>All bills before payday are paid. Nice!</span></div>`;return;}
  const tot=sum(ub.list,x=>+x.b.amount||0), after=balances().availableCash;
  el.innerHTML=`<div class="billsum"><div>Due before payday<b>${fmt(tot)}</b></div><div style="text-align:right">Safe to spend before payday<b class="${after<0?'neg':''}">${fmt(after)}</b></div></div>`+
    ub.list.map(x=>{const allot=billAllotmentData(x.b,x.ym);return `<div class="bill">${catIcon('expense',x.b.category)}<div class="bm"><b>${esc(x.b.name)}</b>${dueLabel(x)}${allot.amount?`<small class="bill-allotment">Allotted ${fmt(allot.amount)} from ${esc(wName(allot.wallet))}</small>`:''}</div><span class="amt">${fmt(x.b.amount)}</span><button class="btn sm" data-billpay="${x.b.id}|${x.ym}">Pay</button></div>`;}).join('');
}
let heatSel=null;
function renderHeat(month){
  const d=P(month),y=d.getFullYear(),m=d.getMonth(),n=eom(y,m).getDate(),t=today();
  $('heatTitle').textContent=`Spending calendar · ${d.toLocaleDateString('en-US',{month:'long'})}`;
  const tot={};S.expenses.forEach(e=>{if(e.date&&e.date.slice(0,7)===month.slice(0,7)) tot[e.date]=(tot[e.date]||0)+(+e.amount||0);});
  const mx=Math.max(0,...Object.values(tot));
  const lvl=v=>!v?0:v/mx<=.25?1:v/mx<=.5?2:v/mx<=.75?3:4;
  let h=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="hd">${x}</div>`).join('');
  for(let i=0;i<new Date(y,m,1).getDay();i++) h+='<div class="hc blank"></div>';
  let noSpend=0,top=null;
  for(let k=1;k<=n;k++){const ds=iso(new Date(y,m,k)),v=tot[ds]||0;
    if(ds<=t&&ds>=S.settings.startDate&&!v) noSpend++; if(v&&(!top||v>tot[top])) top=ds;
    h+=`<div class="hc l${lvl(v)}${ds===t?' today':''}${ds>t?' future':''}${ds===heatSel?' sel':''}" data-heat="${ds}" title="${nice(ds)}: ${fmt(v)}"><span>${k}</span>${v?`<small>${kfmt(v)}</small>`:''}</div>`;}
  let det='';
  if(heatSel&&heatSel.slice(0,7)===month.slice(0,7)){const es=S.expenses.filter(e=>e.date===heatSel);
    det=`<div class="hdetail"><b>${nice(heatSel)}</b> · ${fmt(tot[heatSel]||0)}${es.length?es.map(e=>`<div class="row"><span class="catcell">${catIcon('expense',e.type)}${esc(e.type)}${e.note?`&nbsp;<span style="color:var(--muted)">· ${esc(e.note)}</span>`:''}</span><b>${fmt(e.amount)}</b></div>`).join(''):'<div class="note">No spending this day.</div>'}</div>`;}
  $('heatMap').innerHTML=`<div class="heat">${h}</div>
    <div class="hlegend">Less <i style="background:var(--soft)"></i><i style="background:var(--h1)"></i><i style="background:var(--h2)"></i><i style="background:var(--h3)"></i><i style="background:var(--h4)"></i> More</div>
    <div class="note">${top?`Highest: <b>${short(P(top))}</b> (${fmt(tot[top])}) · `:''}No-spend days so far: <b>${noSpend}</b>. Tap a day for details.</div>${det}`;
}
function goalCards(gs){return `<div class="goalcards">${gs.map(g=>`<div class="gcard" data-gcard="${g.id}"><div class="top"><div style="min-width:0"><b>${esc(g.name)}</b><div style="margin-top:6px">${statusPill(g.status)}</div></div><div class="ring" style="--p:${(g.f*100).toFixed(1)}"><span>${Math.round(g.f*100)}%</span></div></div>
  <div class="bar"><i class="${g.f>=1?'done':''}" style="width:${g.f*100}%"></i></div>
  <div class="gmeta"><span>${fmt(g.alloc)} saved</span><span>${fmt(g.target)}</span></div>
  <div class="gmeta"><span>${fmt(g.need)} to go</span><span>${g.date?'by '+nice(g.date):'no target date'}</span></div></div>`).join('')}</div>`;}
function renderChecklist(){const el=$('checklist');if(!ready||LS.get('fh.ckl','')==='hide'){el.innerHTML='';return;}
  const items=[{t:'Set your wallet balances',d:S.wallets.some(w=>+w.start),go:'wallets'},{t:'Add your expected salary',d:(+S.settings.sal15||0)+(+S.settings.sal30||0)>0,go:'settings'},
    {t:'Set a monthly budget',d:Object.values(S.budget).some(v=>+v>0),go:'settings'},{t:'Add your recurring bills',d:S.bills.length>0,go:'bills'},{t:'Log your first expense',d:S.expenses.length>0,go:'qa'}];
  const n=items.filter(x=>x.d).length; if(n===items.length){el.innerHTML='';return;}
  const empty=!S.income.length&&!S.expenses.length&&!S.goals.length;
  el.innerHTML=`<div class="card ckl"><div class="row-between"><h2>Get set up · ${n} of ${items.length} done</h2><button class="ibtn" data-ckhide>Hide</button></div><div class="bar" style="margin-bottom:6px"><i style="width:${n/items.length*100}%"></i></div>
    ${items.map(x=>`<div class="ck${x.d?' done':''}" data-ck="${x.go}"><i>${x.d?'✓':''}</i><span>${x.t}</span><em>›</em></div>`).join('')}
    ${empty?`<div class="note">Have a backup file from the old version? <button class="linkbtn" data-goto="settings" style="padding:0">Import it in Settings</button>.</div>`:''}</div>`;}

/* ================= OTHER TABS ================= */
let actFilter='all';
function renderActivity(){
  const q=$('actQ').value.trim().toLowerCase(), mon=$('actMonth').value, qn=q.replace(/[₱,\s]/g,'');
  let items=buildItems(actFilter==='all'?['expenses','income','transfers','savings','adjustments']:[actFilter]);
  if(mon!=='all') items=items.filter(it=>!it.date?it.kind==='income':it.date.slice(0,7)===mon.slice(0,7));
  if(q) items=items.filter(it=>(it.title+' '+it.sub.join(' ')).toLowerCase().includes(q)||(qn&&/^\d+(\.\d+)?$/.test(qn)&&String(Math.abs(it.amt)).startsWith(qn)));
  document.querySelectorAll('#actSeg button').forEach(x=>x.classList.toggle('on',x.dataset.af===actFilter));
  const inn=sum(items.filter(i=>i.kind==='income'),i=>i.amt), out=sum(items.filter(i=>i.kind==='expenses'),i=>-i.amt), adj=sum(items.filter(i=>i.kind==='adjustments'),i=>i.amt);
  $('actSum').innerHTML=items.length?`<span><b>${items.length}</b> entr${items.length===1?'y':'ies'}</span><span>In <b class="pos">${fmt(inn)}</b></span><span>Out <b>${fmt(out)}</b></span>${adj?`<span>Adjustments <b>${fmt(adj)}</b></span>`:''}`:'';
  $('actList').innerHTML=items.length?groupsHtml(items):(q||mon!=='all'||actFilter!=='all')?emptyState('search','No matches','Try a different search, month or filter.','<button class="btn sec sm" data-act-reset>Clear filters</button>')
    :emptyState('list','No activity yet','Log your first expense or income to get started.','<button class="btn sm" data-new="expenses">+ Add expense</button>');
  $('actHint').textContent=items.length?(matchMedia('(pointer:coarse)').matches?'Tip: swipe a row right to edit, left to delete.':'Click any row to edit or delete it.'):'';
}
function renderBills(){
  const T=P(today()),y=T.getFullYear(),m=T.getMonth(),ub=upcomingBills();
  const paidM=S.bills.map(b=>billState(b,y,m)).filter(x=>x.st==='paid');
  const active=S.bills.filter(b=>b.status!=='Paused').map(b=>({b,x:billState(b,y,m)}))
    .filter(({b,x})=>x.st!=='paid'&&x.st!=='skipped'&&(!b.created||x.ym>=b.created.slice(0,7)));
  const cash=balances().cash,allotted=sum(active,({b,x})=>billAllotment(b,x.ym)),available=cash-allotted;
  $('billAllocationSummary').innerHTML=`<div>Wallet balance<b>${fmt(cash)}</b></div><div>Allotted this month<b>${fmt(allotted)}</b></div><div>Available to spend<b class="${available<0?'neg':''}">${fmt(available)}</b></div>`;
  $('kpiBills').innerHTML=kpi('Due before payday',fmt(sum(ub.list,x=>+x.b.amount||0)),`${ub.list.length} bill${ub.list.length===1?'':'s'} · payday ${short(P(ub.np))}`,'','bill','amber')+
    kpi('Overdue',String(ub.list.filter(x=>x.st==='overdue').length),'',ub.list.some(x=>x.st==='overdue')?'neg':'','alert','red')+
    kpi('Paid this month',fmt(sum(paidM,x=>x.paid.amount)),`${paidM.length} of ${S.bills.filter(b=>b.status!=='Paused').length} active bills`,'','check','em');
  const pre=['Rent','Internet','Electric','Water'].filter(c=>S.lists.expense.includes(c)&&!S.bills.some(b=>b.category===c));
  $('billPresets').innerHTML=pre.length?`<span class="note" style="margin:0">Quick start:</span>`+pre.map(c=>`<button class="qcat" type="button" data-preset="${esc(c)}">${catIcon('expense',c)}${esc(c)}</button>`).join(''):'';
  const rs=[...S.bills].sort((a,b)=>(+a.dueDay||0)-(+b.dueDay||0));
  $('billList').innerHTML=rs.length?`<div class="tlist">${rs.map(b=>{const x=billState(b,y,m);
    const allot=billAllotment(b,x.ym);
    const st=b.status==='Paused'?'<span class="pill">Paused</span>':x.st==='paid'?`<span class="pill good">Paid ${short(P(x.paid.date))}</span>`:x.st==='skipped'?'<span class="pill">Skipped</span>':x.st==='overdue'?'<span class="pill bad">Overdue</span>':x.st==='soon'?`<span class="pill warn">Due ${short(P(x.due))}</span>`:`<span class="pill">Due ${short(P(x.due))}</span>`;
    const can=b.status!=='Paused'&&x.st!=='paid'&&x.st!=='skipped';
    const allotData=billAllotmentData(b,x.ym);
    return `<div class="trow" data-kind="bills" data-id="${b.id}"><div class="tmain">${catIcon('expense',b.category)}<div class="tt"><b>${esc(b.name)} ${st}</b><small>${fmt(b.amount)} · every ${ordinal(+b.dueDay)} · ${esc(wName(b.src||defaultWallet()))}</small><small class="bill-allotment">${allot?`Allotted ${fmt(allot)} from ${esc(wName(allotData.wallet))} of ${fmt(b.amount)}`:'Nothing allotted'} for this month</small></div><div class="tacts">${can?`<button class="ibtn" data-billallot="${b.id}|${x.ym}">${allot?'Edit allotment':'Allot'}</button><button class="ibtn" data-billskip="${b.id}|${x.ym}">Skip</button><button class="btn sm" data-billpay="${b.id}|${x.ym}">Pay</button>`:''}</div></div></div>`;}).join('')}</div>`
    :emptyState('bill','No recurring bills yet','Add a bill above or tap a quick-start category.','<button class="btn sm" data-new="bills">+ Add bill</button>');
}
function openBillAllotment(id,ym){
  const b=S.bills.find(z=>z.id===id);if(!b)return;
  const f=$('billAllotForm');f.reset();f.dataset.billId=id;f.dataset.month=ym;
  const allot=billAllotmentData(b,ym);
  f.elements.amount.value=allot.amount?fmtAmtInput(allot.amount):'';f.elements.wallet.value=allot.wallet;
  openSheet({title:`Allot to ${b.name} · ${P(ym+'-01').toLocaleDateString('en-US',{month:'long',year:'numeric'})}`,node:f});
  if(!matchMedia('(pointer:coarse)').matches)setTimeout(()=>f.elements.amount.focus(),60);
}
$('billAllotForm').addEventListener('submit',e=>{
  e.preventDefault();const f=e.target,amount=parseAmt(f.elements.amount.value),wallet=f.elements.wallet.value;
  if(!Number.isFinite(amount)||amount<0||amount>1000000000){toast('Enter a valid amount');return;}
  const b=S.bills.find(z=>z.id===f.dataset.billId),ym=f.dataset.month;
  if(!b||!ym){toast('This bill is no longer available');return;}
  if(!wById(wallet)||isCredit(wById(wallet))){toast('Choose a non-credit wallet');return;}
  if(!cloudOK())return;
  const allotments={...(b.allotments||{})};
  if(amount)allotments[ym]={amount,wallet};else delete allotments[ym];
  cPut('bills',{...b,allotments});closeSheet();toast(amount?`${fmt(amount)} allotted to ${b.name}`:'Bill allotment cleared');buzz();
});
function renderWallets(){
  const b=balances(), t=today(), mA=t.slice(0,8)+'01';
  $('kpiW').innerHTML=kpi('Money in hand',fmt(b.availableCash),'After bill allotments','','wallet','em')+kpi('Credit card owed',fmt(Math.max(b.owed,0)),'',b.owed>0.005?'neg':'','down','red')+kpi('Cash minus debt',fmt(b.cash-b.owed),'','','flow','navy');
  $('walletWarning').innerHTML=adjustmentsAvailable?'':`<div class="alert warn">Wallet reconciliation is unavailable because Firestore rules do not yet allow the adjustments collection. Publish the updated <b>firestore.rules</b> in Firebase Console to enable it.</div>`;
  $('wCards').innerHTML=S.wallets.map(w=>{const v=walletBal(w),reserved=isCredit(w)?0:billAllotted(w.id),available=v-reserved,f=wFlows(w,mA,t);
    return `<div class="wcard" data-wcard="${w.id}" style="--c:${wColor(w.id)}"><div class="top">${wIcon(w.id)}<div style="min-width:0"><b>${esc(w.name)}</b><span>${WTYPE[w.type]||''}</span></div></div>
      <div class="bal ${available<0?'neg':''}">${isCredit(w)?(v<0?fmt(-v)+' owed':fmt(v)):fmt(available)}${reserved?`<small class="bal-detail">${fmt(reserved)} allotted · ${fmt(v)} balance</small>`:''}</div>
      <div class="flows"><span>▲ In ${fmt(f.in)}</span><span>▼ Out ${fmt(f.out)}</span><span>Adjustment ${f.adjustment>=0?'+':''}${fmt(f.adjustment)}</span><span>this month</span></div>
      ${adjustmentsAvailable?`<button class="btn sec sm" type="button" data-reconcile="${esc(w.id)}">Reconcile</button>`:''}</div>`;}).join('');
  const it=buildItems(['transfers']);
  $('trfList').innerHTML=it.length?groupsHtml(it,8):emptyState('swap','No transfers yet','Move money between wallets, like a GCash cash-in or a card payment.','<button class="btn sec sm" data-new="transfers">New transfer</button>');
}
function renderSavings(){
  const b=balances(), s=S.settings, st=s.startDate, t=today();
  $('kpiSav').innerHTML=kpi('Total savings',fmt(b.totalSav),'','','shield','navy')+kpi('Other savings',fmt(b.other),'','','piggy','teal')+kpi('Goal funds',fmt(b.goalFunds),'','','target','violet')+kpi('Deposited',fmt(sum(S.savings.filter(r=>r.action==='Deposit'))),'all time','','up','em');
  const ac=S.lists.savings.map(a=>{const rs=S.savings.filter(r=>r.account===a&&inR(r.date,st,t));const dep=sum(rs.filter(r=>r.action==='Deposit')),wd=sum(rs.filter(r=>r.action==='Withdrawal'));
    const extra=a==='Goal'?(+s.startGoal||0)-b.goalExp:0;return {a,dep,wd,extra,bal:dep-wd+extra};});
  $('savAcctList').innerHTML=ac.map(x=>`<div class="brow"><div class="bn">${catIcon('savings',x.a)}<span>${esc(x.a)}</span></div><div class="bb" style="font-size:11px;color:var(--muted)">+${fmt(x.dep)} · −${fmt(x.wd)}${x.extra?` · adj ${fmt(x.extra)}`:''}</div><div class="bv"><b class="${x.bal<0?'neg':''}">${fmt(x.bal)}</b>net</div></div>`).join('')+
    `<div class="brow"><div class="bn"><span>Starting other savings</span></div><div class="bb"></div><div class="bv"><b>${fmt(s.startOther)}</b></div></div>`;
  const it=buildItems(['savings']);
  $('savList').innerHTML=it.length?groupsHtml(it):emptyState('piggy','No savings activity yet','Deposit to an account to start building savings.','<button class="btn sm" data-new="savings" data-action="Deposit">+ Deposit</button>');
}
function renderGoals(){
  const b=balances(), gs=goalStats(), alloc=sum(S.allocs), need=sum(gs,g=>g.need);
  $('kpiGoals').innerHTML=kpi('Goal fund balance',fmt(b.goalFunds),'','','target','violet')+kpi('Allocated',fmt(alloc),'',alloc>b.goalFunds+0.005?'neg':'','check','em')+kpi('Unallocated',fmt(b.goalFunds-alloc),'',b.goalFunds-alloc<0?'neg':'','wallet','teal')+kpi('Still needed',fmt(need),'','','flow','amber');
  $('goalCardsTab').innerHTML=gs.length?goalCards(gs):`<div class="card">${emptyState('target','No goals yet','Add something you\'re saving for, like a gadget or a trip.','<button class="btn sm" data-new="goals">+ Add goal</button>')}</div>`;
  const it=buildItems(['allocs']);
  $('allocList').innerHTML=it.length?groupsHtml(it):emptyState('stack','No allocations yet','Deposit to the “Goal” savings account, then allocate funds to a goal.');
}
function renderSettings(){
  const ae=document.activeElement; if(ae&&ae.closest&&ae.closest('#tab-settings')&&ae.tagName==='INPUT') return;
  const f=$('setForm'); Object.entries(S.settings).forEach(([k,v])=>{if(f.elements[k]) f.elements[k].value=v;});
  $('budEdit').innerHTML=`<table><tr><th>Category</th><th class="n">Budget (PHP)</th></tr>${S.lists.expense.map(c=>`<tr><td><span class="catcell">${catIcon('expense',c)}${esc(c)}</span></td><td class="n"><input type="number" inputmode="decimal" step="0.01" min="0" data-bud="${esc(c)}" value="${+S.budget[c]||0}" style="width:130px;text-align:right;display:inline-block"></td></tr>`).join('')}
    <tr class="total"><td>Total</td><td class="n">${fmt(S.lists.expense.reduce((t,c)=>t+(+S.budget[c]||0),0))}</td></tr></table>`;
  const L={expense:'Expense categories',income:'Income types',savings:'Savings accounts'};
  $('listsEdit').innerHTML=Object.entries(L).map(([k,l])=>`<div style="margin-bottom:14px"><h3>${l}</h3><div class="chips">${S.lists[k].map((x,i)=>`<span class="chip">${esc(x)}${(k==='savings'&&x==='Goal')||(k==='income'&&x==='Salary')?'':`<button data-rmlist="${k}" data-i="${i}" title="Remove" aria-label="Remove ${esc(x)}">×</button>`}</span>`).join('')}</div>
    <form data-addlist="${k}" style="display:flex;gap:6px"><input name="v" placeholder="Add new…" required><button class="btn sec sm" type="submit">Add</button></form></div>`).join('')+'<div class="note">“Salary” and “Goal” are required for salary tracking and goal funds, so they can\'t be removed.</div>';
  renderBackupInfo(); renderAppInfo();
  $('secInfo').innerHTML=(FH_CONFIG.recaptchaSiteKey?'<span class="pill good">App Check on</span> ':'')+'Access is limited to your Google account. This site is protected by reCAPTCHA and the Google <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy Policy</a> and <a href="https://policies.google.com/terms" target="_blank" rel="noopener">Terms of Service</a> apply.';
  const pref=document.documentElement.dataset.pref||'auto';document.querySelectorAll('#themeSeg button').forEach(x=>x.classList.toggle('on',x.dataset.themeSet===pref));
}

/* ================= RENDER DISPATCH ================= */
let curTab='dash';
const TITLES={activity:['Activity','All your income, expenses, transfers and savings'],bills:['Bills','Recurring bills and what\'s due before payday'],wallets:['Wallets','Cash, e-wallets, bank and credit cards'],savings:['Savings','Deposits, withdrawals and account balances'],goals:['Goals','Plan and fund the things you want'],settings:['Settings','Balances, budget, categories and appearance']};
function refreshSelects(){
  const ms=monthsList().map(v=>({v,l:mLabel(v)}));
  const fm=$('fMonth'),had=fm.value; fillSelect(fm,ms);
  if(!had||![...fm.options].some(o=>o.value===had)){const tm=today().slice(0,7)+'-01'; fm.value=ms.some(x=>x.v===tm)?tm:ms[ms.length-1].v;}
  const am=$('actMonth'),hadA=am.dataset.init; fillSelect(am,ms.slice().reverse(),'<option value="all">All months</option>');
  if(!hadA){const tm=today().slice(0,7)+'-01'; am.value=ms.some(x=>x.v===tm)?tm:'all'; am.dataset.init='1';}
  fillSelect($('incType'),S.lists.income);fillSelect($('expType'),S.lists.expense);fillSelect($('savAcctSel'),S.lists.savings);
  fillSelect($('allocGoal'),S.goals.map(g=>({v:g.id,l:g.name})));fillSelect($('billCat'),S.lists.expense);
  const wc=S.wallets.filter(w=>!isCredit(w)).map(w=>({v:w.id,l:w.name})), wa=S.wallets.map(w=>({v:w.id,l:w.name+(isCredit(w)?' (credit)':'')}));
  document.querySelectorAll('.wsel-cash').forEach(el=>fillSelect(el,wc));
  document.querySelectorAll('.wsel-w').forEach(el=>fillSelect(el,wa));
  document.querySelectorAll('.wsel-all').forEach(el=>fillSelect(el,[...wa,{v:'__goal',l:'Goal Funds'}]));
}
function render(){
  refreshSelects();
  const hr=new Date().getHours();
  const tt=curTab==='dash'?[`Good ${hr<12?'morning':hr<18?'afternoon':'evening'}${userName?', '+userName:''}`,new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})]:TITLES[curTab];
  $('pageTitle').textContent=tt[0];$('pageSub').textContent=tt[1];
  const bb=balances();$('sideCash').textContent=fmt(bb.availableCash);
  const nb=upcomingBills().list.filter(x=>x.st==='overdue'||x.st==='soon').length;
  [document.querySelector('#nav [data-tab=bills]'),document.querySelector('#mnav [data-tab=more]')].forEach(btn=>{let bd=btn.querySelector('.nbadge');
    if(nb){if(!bd){bd=document.createElement('span');bd.className='nbadge';btn.appendChild(bd);}bd.textContent=nb;}else if(bd) bd.remove();});
  const mb=$('moreBadge');mb.style.display=nb?'':'none';mb.textContent=nb;
  if(curTab==='dash') renderDash();
  if(curTab==='activity') renderActivity();
  if(curTab==='bills') renderBills();
  if(curTab==='wallets') renderWallets();
  if(curTab==='savings') renderSavings();
  if(curTab==='goals') renderGoals();
  if(curTab==='settings') renderSettings();
}

/* ================= NAVIGATION ================= */
const MORE_TABS=['bills','savings','goals','settings'];
function go(tab){
  curTab=tab;
  document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
  document.querySelectorAll('#mnav [data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab||(x.dataset.tab==='more'&&MORE_TABS.includes(tab))));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id==='tab-'+tab));
  closeSheet(); scrollTo({top:0}); render();
}
$('nav').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b) go(b.dataset.tab);});
$('mnav').addEventListener('click',e=>{const b=e.target.closest('button');if(!b) return;
  if(b.id==='mPlus'){openQA();return;}
  if(b.dataset.tab==='more'){openSheet({title:'More',node:$('moreMenu')});return;}
  if(b.dataset.tab) go(b.dataset.tab);});
$('fab').onclick=()=>openQA();

/* ================= SHEET & DIALOG ================= */
const store=$('formStore'); let sheetNode=null;
function openSheet({title,node,del,seg}){
  if(sheetNode&&sheetNode!==node) store.appendChild(sheetNode);
  sheetNode=node; $('shTitle').textContent=title; $('shBody').innerHTML=''; $('shBody').appendChild(node);
  $('shSeg').innerHTML=seg?`<div class="seg">${[['qa','Expense'],['income','Income'],['transfers','Transfer']].map(([k,l])=>`<button type="button" data-segto="${k}" class="${k===seg?'on':''}">${l}</button>`).join('')}</div>`:'';
  $('shFoot').innerHTML=del?'<button class="btn danger sm" id="shDel" type="button">Delete</button>':'';
  if(del) $('shDel').onclick=del;
  $('sheetOv').classList.remove('hide'); document.body.classList.add('noscroll'); $('shBody').scrollTop=0;
}
function closeSheet(){
  $('sheetOv').classList.add('hide'); document.body.classList.remove('noscroll');
  if(sheetNode){store.appendChild(sheetNode); sheetNode=null;}
  Object.keys(editing).forEach(k=>editing[k]=null); qaCtx=null; wEditId=null;
}
$('shClose').onclick=closeSheet;
$('sheetOv').addEventListener('click',e=>{if(e.target.id==='sheetOv') closeSheet();});
function askConfirm({title,msg,ok='Confirm',cancel='Cancel',danger=false}){return new Promise(res=>{
  $('dlgT').textContent=title;$('dlgM').innerHTML=msg;const okb=$('dlgOk'),cb=$('dlgCancel');
  okb.textContent=ok;okb.className='btn'+(danger?' dangerfill':'');cb.style.display=cancel?'':'none';cb.textContent=cancel||'';
  const done=v=>{$('dlgOv').classList.add('hide');res(v);};okb.onclick=()=>done(true);cb.onclick=()=>done(false);
  $('dlgOv').onclick=e=>{if(e.target.id==='dlgOv') done(false);};$('dlgOv').classList.remove('hide');setTimeout(()=>okb.focus(),30);});}
addEventListener('keydown',e=>{if(e.key!=='Escape') return; if(!$('dlgOv').classList.contains('hide')){$('dlgCancel').click();return;} if(!$('sheetOv').classList.contains('hide')) closeSheet();});

/* ================= FORMS ================= */
const FORMS={
  expenses:{form:'expForm',noun:'expense',title:'Add expense',add:'Add expense',num:['amount']},
  income:{form:'incForm',noun:'income',title:'Add income',add:'Add income',num:['amount']},
  transfers:{form:'trfForm',noun:'transfer',title:'Transfer between wallets',add:'Transfer',num:['amount']},
  savings:{form:'savForm',noun:'savings entry',title:'Savings activity',add:'Save',num:['amount']},
  bills:{form:'billForm',noun:'bill',title:'Add recurring bill',add:'Add bill',num:['amount','dueDay']},
  goals:{form:'goalForm',noun:'goal',title:'Add goal',add:'Add goal',num:['target']},
  allocs:{form:'allocForm',noun:'allocation',title:'Allocate goal funds',add:'Allocate',num:['amount']}
};
const editing={}; let salOpen=false;
function syncSal(){const f=$('incForm'),isSal=f.elements.type.value==='Salary',hasVal=['covStart','covEnd','adjPay','note'].some(k=>f.elements[k].value);
  const show=isSal||salOpen||hasVal; $('salDet').classList.toggle('hide',!show); $('salToggle').textContent=show?'Salary details ▴':'Salary details ▾'; $('salToggle').style.display=isSal?'none':'';}
$('incType').addEventListener('change',syncSal);
$('salToggle').onclick=()=>{salOpen=!salOpen;syncSal();};
function openForm(kind,rec,preset,seg){
  const c=FORMS[kind],f=$(c.form); f.reset(); salOpen=false; refreshSelects();
  editing[kind]=rec?rec.id:null;
  if(f.elements.date&&kind!=='goals') f.elements.date.value=today();
  if(rec){Object.entries(rec).forEach(([k,v])=>{const el=f.elements[k];if(!el||typeof v==='object'||el instanceof RadioNodeList) return;el.value=el.classList&&el.classList.contains('amt')?fmtAmtInput(v):v;});
    if(kind==='expenses') f.elements.src.value=srcOf(rec);
    if(kind==='income'||kind==='savings') f.elements.wallet.value=wOf(rec);}
  Object.entries(preset||{}).forEach(([k,v])=>{const el=f.elements[k];if(el) el.value=el.classList&&el.classList.contains('amt')?fmtAmtInput(v):v;});
  if(kind==='income') syncSal();
  f.querySelector('.submit').textContent=rec?'Save changes':c.add;
  openSheet({title:rec?'Edit '+c.noun:c.title,node:f,seg:rec?null:seg,del:rec?()=>{const id=rec.id;closeSheet();deleteRec(kind,id);}:null});
  if(!rec&&!matchMedia('(pointer:coarse)').matches) setTimeout(()=>{const a=f.querySelector('.amt,input[name=name]');a&&a.focus();},60);
}
Object.entries(FORMS).forEach(([kind,c])=>{
  const f=$(c.form);
  f.addEventListener('submit',e=>{
    e.preventDefault();
    const o={}; [...f.elements].forEach(el=>{if(!el.name||el.type==='submit'||el.type==='button') return; o[el.name]=c.num.includes(el.name)?parseAmt(el.value):el.value.trim();});
    const amtKey=c.num.find(k=>k!=='dueDay');
    if(amtKey&&!(o[amtKey]>0)){toast('Enter an amount');return;}
    if((kind==='bills'||kind==='goals')&&!o.name){toast('Enter a name');return;}
    if(kind==='bills'&&!(o.dueDay>=1&&o.dueDay<=31)){toast('Due day must be 1–31');return;}
    if(kind==='income'&&((o.covStart&&!o.covEnd)||(!o.covStart&&o.covEnd))){toast('Add both coverage dates, or neither');return;}
    if(kind==='income'&&o.covStart&&o.covEnd<o.covStart){toast('Coverage end is before start');return;}
    if(kind==='transfers'&&o.from===o.to){toast('Choose two different wallets');return;}
    if(kind==='allocs'&&!o.goal){toast('Add a goal first');return;}
    if(['expenses','transfers','savings','allocs'].includes(kind)&&!o.date) o.date=today();
    if(kind==='expenses'){Object.assign(o,srcToFields(o.src));delete o.src;}
    if(!cloudOK()) return;
    const cur=editing[kind]&&S[kind].find(r=>r.id===editing[kind]);
    if(!cur&&kind==='bills'){o.created=today();o.skips=[];}
    cPut(kind,cur?{...cur,...o}:{id:uid(),...o});
    closeSheet(); toast(cur?'Changes saved':`${cap(c.noun)} added`); buzz();
  });
});
function openEdit(kind,id){const rec=(S[kind]||[]).find(r=>r.id===id);if(!rec)return;
  if(kind==='adjustments'){openReconcile(wById(rec.wallet),rec);return;}
  if(FORMS[kind]) openForm(kind,rec);}
function deleteRec(kind,id){
  const rec=(S[kind]||[]).find(r=>r.id===id); if(!rec||!cloudOK()) return;
  const gone=[{k:kind,r:rec}]; if(kind==='goals') S.allocs.filter(a=>a.goal===id).forEach(a=>gone.push({k:'allocs',r:a}));
  FB.bulk(gone.map(g=>({k:g.k,id:g.r.id,del:true}))); buzz();
  const noun=kind==='adjustments'?'reconciliation':FORMS[kind].noun;
  toast(`${cap(noun)} deleted${gone.length>1?` (+${gone.length-1} allocation${gone.length>2?'s':''})`:''}`,{label:'Undo',fn:()=>{FB.bulk(gone.map(g=>{const {id,...d}=g.r;return {k:g.k,id,d:JSON.parse(JSON.stringify(d))};}));toast('Restored');}});
}

/* ---- wallets ---- */
let wEditId=null;
const setWLbl=()=>{$('wStartLbl').firstChild.textContent=$('wForm').elements.type.value==='credit'?'Amount owed at start (PHP)':'Starting balance (PHP)';};
$('wForm').elements.type.addEventListener('change',setWLbl);
function walletUsed(id){const d=id===defaultWallet(),m=r=>r.wallet===id||(d&&!wById(r.wallet));
  return S.income.some(m)||S.expenses.some(r=>isCash(r)&&m(r))||S.savings.some(m)||S.transfers.some(t=>t.from===id||t.to===id)||
    S.bills.some(b=>b.src===id||Object.values(b.allotments||{}).some(a=>typeof a==='number'?d&&a>0:!!a&&a.wallet===id))||S.adjustments.some(r=>r.wallet===id);}
function openWalletForm(w){const f=$('wForm');f.reset();
  if(w){f.elements.name.value=w.name;f.elements.type.value=w.type;f.elements.start.value=fmtAmtInput(w.start||0);}
  setWLbl();f.querySelector('.submit').textContent=w?'Save changes':'Add wallet';
  openSheet({title:w?'Edit wallet':'Add wallet',node:f,del:w?()=>{const id=w.id;closeSheet();deleteWallet(id);}:null});
  wEditId=w?w.id:null;}
$('wForm').addEventListener('submit',e=>{e.preventDefault();const f=e.target,o={name:f.elements.name.value.trim(),type:f.elements.type.value,start:parseAmt(f.elements.start.value)};
  if(!o.name){toast('Enter a wallet name');return;}
  if(S.wallets.some(w=>w.name.toLowerCase()===o.name.toLowerCase()&&w.id!==wEditId)){toast('A wallet with that name exists');return;}
  if(!cloudOK()) return;
  if(wEditId){const w=wById(wEditId);
    if(isCredit(w)!==(o.type==='credit')&&walletUsed(w.id)){toast("Can't switch between credit and non-credit once used");return;}
    if(o.type==='credit'&&!isCredit(w)&&S.wallets.filter(x=>!isCredit(x)).length<=1){toast('You need at least one non-credit wallet');return;}
    Object.assign(w,o);}
  else S.wallets.push({id:'w_'+uid().slice(0,10),...o});
  const was=wEditId; cMeta(); closeSheet(); render(); toast(was?'Wallet updated':'Wallet added'); buzz();});
function openReconcile(w,rec){
  if(!adjustmentsAvailable){toast('Publish the updated Firestore rules before reconciling wallets');return;}
  if(!w){toast('This wallet is no longer available');return;}
  const f=$('recForm');f.reset();f.dataset.wallet=w.id;f.dataset.id=rec?rec.id:'';
  $('recActualLbl').firstChild.textContent=isCredit(w)?'Actual amount owed (PHP)':'Actual balance (PHP)';
  f.elements.date.min=S.settings.startDate;f.elements.date.max=today();f.elements.date.value=rec?rec.date:today();
  f.elements.actual.value=rec?fmtAmtInput(rec.actual):'';f.elements.note.value=rec&&rec.note||'';
  const refresh=()=>{
    const date=f.elements.date.value||today(),current=walletBal(w,date,rec&&rec.id);
    const currentText=isCredit(w)?(current<0?fmt(-current)+' owed':fmt(current)):fmt(current);
    const actualText=f.elements.actual.value.trim();
    let preview=`Tracked ${isCredit(w)?'amount owed':'balance'} on ${nice(date)}: <b>${currentText}</b>`;
    if(actualText){
      const actual=parseAmt(actualText),delta=(isCredit(w)?-actual:actual)-current;
      preview+=`<br>Adjustment: <b>${delta>0?'+':''}${fmt(delta)}</b>`;
    }
    $('recPreview').innerHTML=preview;
  };
  f.elements.date.onchange=refresh;f.elements.actual.oninput=refresh;refresh();
  openSheet({title:rec?'Edit reconciliation':'Reconcile '+w.name,node:f,
    del:rec?()=>{const id=rec.id;closeSheet();deleteRec('adjustments',id);}:null});
}
$('recForm').addEventListener('submit',e=>{
  e.preventDefault();const f=e.target,w=wById(f.dataset.wallet),recId=f.dataset.id;
  if(!w){toast('This wallet is no longer available');return;}
  const date=f.elements.date.value,actualText=f.elements.actual.value.trim(),actual=parseAmt(actualText);
  if(!date||date<S.settings.startDate||date>today()){toast('Choose a date between your tracker start date and today');return;}
  if(actualText===''||!Number.isFinite(actual)||actual<0||actual>1000000000){toast('Enter a valid actual balance');return;}
  if(!cloudOK())return;
  const current=walletBal(w,date,recId||undefined),delta=(isCredit(w)?-actual:actual)-current;
  if(!Number.isFinite(delta)||Math.abs(delta)>1000000000){toast('The adjustment is outside the allowed amount range');return;}
  const rec={id:recId||uid(),wallet:w.id,date,actual,delta,note:f.elements.note.value.trim()};
  cPut('adjustments',rec);closeSheet();toast(recId?'Reconciliation updated':'Wallet reconciled');buzz();
});
async function deleteWallet(id){
  const w=wById(id); if(!w) return;
  if(!isCredit(w)&&S.wallets.filter(x=>!isCredit(x)).length<=1){toast('You need at least one non-credit wallet');return;}
  if(walletUsed(id)){await askConfirm({title:'This wallet is in use',msg:`<b>${esc(w.name)}</b> has entries, transfers or bills linked to it. Move or delete those first, or keep the wallet.`,ok:'OK',cancel:false});return;}
  if(!cloudOK()) return; const i=S.wallets.indexOf(w); S.wallets.splice(i,1); cMeta(); render(); buzz();
  toast('Wallet deleted',{label:'Undo',fn:()=>{S.wallets.splice(i,0,w);cMeta();render();toast('Restored');}});
}

/* ---- quick add ---- */
let qaCtx=null;
function openQA(pre){pre=pre||{};const f=$('qaForm');f.reset();refreshSelects();
  const since=iso(new Date(Date.now()-90*864e5)),cnt={};S.expenses.forEach(e=>{if(e.date>=since) cnt[e.type]=(cnt[e.type]||0)+1;});
  const cats=S.lists.expense.map((c,i)=>[c,i]).sort((a,b)=>(cnt[b[0]]||0)-(cnt[a[0]]||0)||a[1]-b[1]).map(x=>x[0]);
  const sel=pre.type||cats[0];
  $('qaCats').innerHTML=cats.map(c=>`<button type="button" class="qcat${c===sel?' on':''}" data-qcat="${esc(c)}">${catIcon('expense',c)}${esc(c)}</button>`).join('');
  const src=pre.src||LS.get('fh.lastSrc',''), ss=$('qaSrc'); if(src&&[...ss.options].some(o=>o.value===src)) ss.value=src;
  if(pre.amount) $('qaAmt').value=fmtAmtInput(pre.amount);
  $('qaDate').value=today(); if(pre.note) $('qaNote').value=pre.note;
  $('qaSubmit').textContent=pre.billId?'Mark as paid':'Add expense';
  openSheet({title:pre.title||'Add expense',node:f,seg:pre.billId?null:'qa'});
  qaCtx=pre;
  setTimeout(()=>{const a=$('qaAmt');a.focus();if(pre.amount&&a.select) a.select();},80);}
$('qaForm').addEventListener('submit',e=>{e.preventDefault();const f=e.target,on=document.querySelector('#qaCats .qcat.on');
  const amt=parseAmt(f.elements.amount.value); if(!(amt>0)){toast('Enter an amount');$('qaAmt').focus();return;}
  if(!on){toast('Pick a category');return;}
  if(!cloudOK()) return;
  const rec={id:uid(),type:on.dataset.qcat,amount:amt,date:f.elements.date.value||today(),note:f.elements.note.value.trim(),...srcToFields(f.elements.src.value)};
  const bill=qaCtx&&qaCtx.billId; if(bill){rec.billId=qaCtx.billId;rec.billMonth=qaCtx.billMonth;}
  LS.set('fh.lastSrc',f.elements.src.value);
  cPut('expenses',rec); closeSheet(); buzz();
  toast(bill?'Bill marked paid':`${fmt(amt)} · ${rec.type} added`,{label:'Undo',fn:()=>{FB.bulk([{k:'expenses',id:rec.id,del:true}]);toast('Removed');}});});

/* ================= CLICKS ================= */
document.addEventListener('click',async e=>{
  const t=e.target, c=s=>t.closest(s);
  let x;
  if((x=c('[data-mstep]'))){const fm=$('fMonth'),i=fm.selectedIndex+(+x.dataset.mstep);if(i>=0&&i<fm.options.length){fm.selectedIndex=i;heatSel=null;render();}return;}
  if((x=c('[data-period]'))){$('fPeriod').value=x.dataset.period;render();return;}
  if((x=c('[data-af]'))){actFilter=x.dataset.af;render();return;}
  if((x=c('[data-act-filter]'))){actFilter=x.dataset.actFilter;$('actMonth').value='all';go('activity');return;}
  if(c('[data-act-reset]')){actFilter='all';$('actQ').value='';$('actMonth').value='all';render();return;}
  if((x=c('[data-segto]'))){const k=x.dataset.segto;if(k==='qa') openQA(); else openForm(k,null,{},k);return;}
  if((x=c('[data-new]'))){const k=x.dataset.new;closeSheet();if(k==='wallet') openWalletForm(); else openForm(k,null,x.dataset.action?{action:x.dataset.action}:{});return;}
  if((x=c('[data-goto]'))){go(x.dataset.goto);return;}
  if((x=c('[data-qcat]'))&&c('#qaCats')){document.querySelectorAll('#qaCats .qcat').forEach(q=>q.classList.toggle('on',q===x));return;}
  if((x=c('[data-qamt]'))){$('qaAmt').value=fmtAmtInput(x.dataset.qamt);return;}
  if((x=c('[data-heat]'))){heatSel=heatSel===x.dataset.heat?null:x.dataset.heat;renderHeat($('fMonth').value);return;}
  if((x=c('[data-billallot]'))){const [id,ym]=x.dataset.billallot.split('|');openBillAllotment(id,ym);return;}
  if((x=c('[data-billpay]'))){const [id,ym]=x.dataset.billpay.split('|'),b=S.bills.find(z=>z.id===id);if(b) openQA({title:'Pay '+b.name,type:b.category,amount:b.amount,src:b.src,note:b.name,billId:b.id,billMonth:ym});return;}
  if((x=c('[data-billskip]'))){const [id,ym]=x.dataset.billskip.split('|'),b=S.bills.find(z=>z.id===id);if(!b||!cloudOK()) return;
    cPut('bills',{...b,skips:[...new Set([...(b.skips||[]),ym])]});buzz();
    toast(`${b.name} skipped for ${P(ym+'-01').toLocaleDateString('en-US',{month:'long'})}`,{label:'Undo',fn:()=>{const nb=S.bills.find(z=>z.id===id);if(nb) cPut('bills',{...nb,skips:(nb.skips||[]).filter(s=>s!==ym)});}});return;}
  if((x=c('[data-preset]'))){const cat=x.dataset.preset;openForm('bills',null,{name:cat,category:cat,amount:+S.budget[cat]||''});setTimeout(()=>$('billForm').elements.dueDay.focus(),90);toast('Now set the due day');return;}
  if((x=c('[data-reconcile]'))){openReconcile(wById(x.dataset.reconcile));return;}
  if((x=c('[data-wcard]'))){openWalletForm(wById(x.dataset.wcard));return;}
  if((x=c('[data-gcard]'))){openEdit('goals',x.dataset.gcard);return;}
  if((x=c('[data-ck]'))){const g=x.dataset.ck;if(g==='qa') openQA(); else {go(g); if(g==='settings') setTimeout(()=>$('budCard').scrollIntoView({behavior:'smooth',block:'start'}),60);}return;}
  if(c('[data-ckhide]')){LS.set('fh.ckl','hide');render();toast('Checklist hidden. You can bring it back in Settings.');return;}
  if(c('[data-ckshow]')){LS.set('fh.ckl','');go('dash');return;}
  if((x=c('[data-theme-set]'))){applyTheme(x.dataset.themeSet);return;}
  if((x=c('[data-rmlist]'))){const k=x.dataset.rmlist,i=+x.dataset.i,v=S.lists[k][i];
    const used=(k==='expense'&&(S.expenses.some(z=>z.type===v)||S.bills.some(z=>z.category===v)))||(k==='income'&&S.income.some(z=>z.type===v))||(k==='savings'&&S.savings.some(z=>z.account===v));
    if(used&&!await askConfirm({title:`Remove “${v}”?`,msg:'It\'s used by existing entries. They\'ll keep this value, but it won\'t be offered in lists anymore.',ok:'Remove',danger:true})) return;
    S.lists[k].splice(i,1); cMeta(); render(); toast('Removed',{label:'Undo',fn:()=>{S.lists[k].splice(i,0,v);cMeta();render();}}); return;}
  if((x=c('.trow[data-id]'))){if(c('button')||x.dataset.swiped) return; openEdit(x.dataset.kind,x.dataset.id);return;}
});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-addlist]'); if(!f) return; e.preventDefault();
  const k=f.dataset.addlist,v=f.elements.v.value.trim(); if(!v) return; if(S.lists[k].includes(v)){toast('Already exists');return;}
  S.lists[k].push(v); if(k==='expense'&&S.budget[v]===undefined) S.budget[v]=0; cMeta(); render(); toast('Added');});
document.addEventListener('input',e=>{const el=e.target;if(el.classList&&el.classList.contains('amt')){const v=fmtAmtInput(el.value);if(v!==el.value) el.value=v;}});
let _sq;$('actQ').addEventListener('input',()=>{clearTimeout(_sq);_sq=setTimeout(render,150);});
$('actMonth').addEventListener('change',render);
document.querySelectorAll('details.sec').forEach(d=>{const id=d.dataset.sec;
  d.open=LS.get('fh.sec.'+id,innerWidth>760||id==='spend'?'1':'0')==='1';
  d.addEventListener('toggle',()=>{LS.set('fh.sec.'+id,d.open?'1':'0');if(d.open&&curTab==='dash') renderDash();});});

/* ---- swipe rows (touch) ---- */
let sw=null;
document.addEventListener('touchstart',e=>{const r=e.target.closest('.trow[data-id]');if(!r||e.target.closest('button')){sw=null;return;}const p=e.touches[0];sw={r,x:p.clientX,y:p.clientY,dx:0,lock:null};},{passive:true});
document.addEventListener('touchmove',e=>{if(!sw) return;const p=e.touches[0],dx=p.clientX-sw.x,dy=p.clientY-sw.y;
  if(sw.lock===null&&(Math.abs(dx)>10||Math.abs(dy)>10)) sw.lock=Math.abs(dx)>Math.abs(dy)*1.2?'x':'y';
  if(sw.lock!=='x') return; sw.dx=Math.max(-130,Math.min(130,dx));
  sw.r.querySelector('.tmain').style.transform=`translateX(${sw.dx}px)`;sw.r.classList.toggle('sl',sw.dx<0);sw.r.classList.toggle('sr',sw.dx>0);},{passive:true});
document.addEventListener('touchend',()=>{if(!sw) return;const {r,dx,lock}=sw;sw=null;const m=r.querySelector('.tmain');
  m.style.transition='transform .2s';m.style.transform='';setTimeout(()=>{m.style.transition='';r.classList.remove('sl','sr');},220);
  if(lock!=='x') return; r.dataset.swiped='1'; setTimeout(()=>{delete r.dataset.swiped;},400);
  if(dx<=-90) deleteRec(r.dataset.kind,r.dataset.id); else if(dx>=90) openEdit(r.dataset.kind,r.dataset.id);});
/* ---- swipe month switcher ---- */
(()=>{let sx=null;const el=$('mswDash');el.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;},{passive:true});
  el.addEventListener('touchend',e=>{if(sx===null) return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>50){const fm=$('fMonth'),i=fm.selectedIndex+(dx<0?1:-1);if(i>=0&&i<fm.options.length){fm.selectedIndex=i;heatSel=null;render();}}});})();

/* ================= SETTINGS ================= */
$('setForm').addEventListener('submit',e=>{e.preventDefault();const f=e.target;
  Object.keys(S.settings).forEach(k=>{if(!f.elements[k]) return; S.settings[k]=k==='startDate'?f.elements[k].value:+f.elements[k].value||0;});
  document.activeElement.blur&&document.activeElement.blur(); cMeta(); render(); toast('Settings saved'); buzz();});
$('budForm').addEventListener('submit',e=>{e.preventDefault();
  document.querySelectorAll('[data-bud]').forEach(i=>S.budget[i.dataset.bud]=+i.value||0); document.activeElement.blur&&document.activeElement.blur(); cMeta(); render(); toast('Budget saved'); buzz();});
function applyTheme(pref){LS.set('fh.theme',pref);
  const d=pref==='dark'||(pref==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.dataset.pref=pref;
  document.querySelector('meta[name=theme-color]').content=d?'#0A1120':'#0F1E3D';chartTheme();render();}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(LS.get('fh.theme','auto')==='auto') applyTheme('auto');});}catch(_){}

/* ================= DATA TOOLS ================= */
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('btnExport').onclick=downloadBackup;
$('btnCsv').onclick=()=>{
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`, rows=[['Kind','Date','Type/Category','Amount','Paid From / Action','Account','Wallet','Description/Note']];
  S.income.forEach(r=>rows.push(['Income',r.date,r.type,r.amount,'','',wName(wOf(r)),r.desc]));
  S.expenses.forEach(r=>rows.push(['Expense',r.date,r.type,r.amount,r.paidFrom,'',wName(srcOf(r)),r.note]));
  S.savings.forEach(r=>rows.push(['Savings',r.date,'',r.amount,r.action,r.account,wName(wOf(r)),r.note]));
  S.transfers.forEach(r=>rows.push(['Transfer',r.date,'',r.amount,wName(r.from)+' → '+wName(r.to),'','',r.note]));
  S.adjustments.forEach(r=>rows.push(['Reconciliation',r.date,'',r.delta,'', '',wName(r.wallet),`${isCredit(wById(r.wallet))?'Amount owed':'Balance'}: ${r.actual}${r.note?` · ${r.note}`:''}`]));
  download(`finance-hub-transactions-${today()}.csv`,rows.map(r=>r.map(q).join(',')).join('\n'),'text/csv');};
$('fileImport').onchange=e=>{const file=e.target.files[0];if(!file) return;const rd=new FileReader();
  rd.onload=async()=>{let d;try{d=JSON.parse(rd.result);if(!d.settings||!d.lists) throw 0;}catch(_){toast('Invalid backup file');return;}
    if(!cloudOK()) return;
    const n=KINDS.reduce((t,k)=>t+(Array.isArray(d[k])?d[k].length:0),0);
    if(!await askConfirm({title:'Import this backup?',msg:`This <b>replaces</b> the data in your cloud account with ${n} records from <b>${esc(file.name)}</b>. Export a backup first if you're not sure.`,ok:'Import',danger:true})) return;
    const ops=[];
    KINDS.forEach(k=>{const inc=Array.isArray(d[k])?d[k]:[];const keep=new Set(inc.map(r=>r.id));
      S[k].forEach(r=>{if(!keep.has(r.id)) ops.push({k,id:r.id,del:true});});
      inc.forEach(r=>{const {id,...rest}=r;ops.push({k,id:id||uid(),d:JSON.parse(JSON.stringify(rest))});});});
    ops.push({k:'meta',d:{settings:{...EMPTY().settings,...d.settings},lists:d.lists,budget:d.budget||{},wallets:(Array.isArray(d.wallets)&&d.wallets.length)?d.wallets:defaultWallets(d.settings&&d.settings.startCash)}});
    FB.bulk(ops);$('fMonth').value='';toast('Backup imported – syncing…');buzz();};
  rd.readAsText(file);e.target.value='';};
$('btnClear').onclick=async()=>{if(!cloudOK())return;
  if(!await askConfirm({title:'Clear all entries?',msg:'This deletes all income, expenses, savings, goals, allocations, transfers and bills from your cloud account. Settings, wallets and budget are kept. <b>This can\'t be undone</b>, so export a backup first.',ok:'Delete everything',danger:true})) return;
  const ops=[];KINDS.forEach(k=>S[k].forEach(r=>ops.push({k,id:r.id,del:true})));FB.bulk(ops);toast('Entries cleared');};
$('btnSignOut').onclick=async()=>{if(await askConfirm({title:'Sign out?',msg:'You\'ll need to sign in with Google again on this device.',ok:'Sign out'})) FB.signOut();};
$('authBtn').onclick=()=>{$('authErr').textContent='';window.FB&&FB.signIn();};

function loadScript(src,test){return new Promise((res,rej)=>{if(test()) return res();const el=document.createElement('script');el.src=src;el.async=true;el.onload=()=>res();el.onerror=()=>rej(new Error('Could not load '+src.split('/')[2]+'. Check your internet connection.'));document.head.appendChild(el);});}
/* ================= BACKUPS ================= */
const driveReady=()=>!!(window.FH_CONFIG&&FH_CONFIG.googleClientId);
const daysSince=d=>d?Math.round((P(today())-P(d))/864e5):null;
function backupDue(){if(!ready||S.settings.backupRemind===false) return null;
  if(!(S.expenses.length+S.income.length+S.savings.length)) return null;
  const n=daysSince(S.settings.lastBackup); return (n===null||n>=30)?{days:n}:null;}
function backupData(){const {settings,lists,budget,wallets}=S,o={version:APP_VERSION,exportedAt:new Date().toISOString(),settings,lists,budget,wallets};KINDS.forEach(k=>o[k]=S[k]);return o;}
function markBackup(where){S.settings.lastBackup=today();S.settings.lastBackupWhere=where;cMeta();render();}
function downloadBackup(){download(`finance-hub-backup-${today()}.json`,JSON.stringify(backupData(),null,2),'application/json');markBackup('file');toast('Backup downloaded');buzz();}
let gTok=null,gExp=0;
function driveToken(){
  if(gTok&&Date.now()<gExp-60000) return Promise.resolve(gTok);
  return loadScript('https://accounts.google.com/gsi/client',()=>!!(window.google&&google.accounts&&google.accounts.oauth2)).then(()=>new Promise((res,rej)=>{
    const c=google.accounts.oauth2.initTokenClient({client_id:FH_CONFIG.googleClientId,scope:'https://www.googleapis.com/auth/drive.file',hint:userEmail,
      callback:r=>{if(r.error) rej(new Error(r.error_description||r.error)); else {gTok=r.access_token;gExp=Date.now()+(+r.expires_in||3600)*1000;res(gTok);}},
      error_callback:e=>rej(new Error(e&&e.type==='popup_closed'?'The Google window was closed before finishing.':(e&&(e.message||e.type))||'Google sign-in failed.'))});
    c.requestAccessToken({prompt:''});}));
}
async function driveFetch(url,opt,tok){const r=await fetch(url,{...opt,headers:{Authorization:'Bearer '+tok,...(opt&&opt.headers||{})}});
  if(r.status===401){gTok=null;throw new Error('Google access expired. Tap Back up now again.');}
  if(!r.ok){let m='';try{m=(await r.json()).error.message;}catch(_){} throw new Error(`Google Drive error ${r.status}${m?': '+m:''}`);} return r.json();}
async function driveFolder(tok){
  const id=S.settings.driveFolder;
  if(id){try{const f=await driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,trashed`,{},tok);if(!f.trashed) return id;}catch(e){if(/expired/.test(e.message)) throw e;}}
  const f=await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Finance Hub Backups',mimeType:'application/vnd.google-apps.folder'})},tok);
  S.settings.driveFolder=f.id; return f.id;
}
async function backupToDrive(){
  const tok=await driveToken(), folder=await driveFolder(tok), name=`finance-hub-backup-${today()}.json`, bnd='fh'+uid();
  const body=`--${bnd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name,parents:[folder],mimeType:'application/json'})}\r\n--${bnd}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(backupData())}\r\n--${bnd}--`;
  await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+bnd},body},tok);
  markBackup('drive'); toast(`Saved to Google Drive › Finance Hub Backups`); buzz();
}
let backingUp=false;
async function doBackup(){
  if(backingUp) return; if(!cloudOK()) return;
  if(S.settings.backupTo==='drive'&&driveReady()){backingUp=true;toast('Saving to Google Drive…');
    try{await backupToDrive();}catch(err){console.error(err);
      if(await askConfirm({title:"Couldn't save to Google Drive",msg:esc(err.message||String(err))+'<br><br>Download the backup to this device instead?',ok:'Download instead'})) downloadBackup();}
    finally{backingUp=false;}}
  else downloadBackup();
}
function renderBackupInfo(){
  const st=S.settings,n=daysSince(st.lastBackup);
  $('backupInfo').innerHTML=`<div class="kv"><span>Last backup</span><b>${st.lastBackup?`${nice(st.lastBackup)} · ${st.lastBackupWhere==='drive'?'Google Drive':'this device'}${n>0?` <span class="pill ${n>=30?'warn':''}">${n} day${n===1?'':'s'} ago</span>`:' <span class="pill good">today</span>'}`:'<span class="pill warn">Never</span>'}</b></div>`;
  const to=st.backupTo==='drive'&&driveReady()?'drive':'file';
  document.querySelectorAll('#bkSeg button').forEach(b=>{b.classList.toggle('on',b.dataset.bkto===to);if(b.dataset.bkto==='drive') b.disabled=!driveReady();});
  $('driveNote').innerHTML=driveReady()?(to==='drive'?'Backups go to a <b>Finance Hub Backups</b> folder in your Google Drive. The app can only see files it created there.':'Tip: choose Google Drive so backups are stored off this device.'):'Google Drive backups need a one-time setup (see the Phase 3 guide). Until then, backups download to this device.';
  $('bkRemind').checked=st.backupRemind!==false;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-backup]');if(b){doBackup();return;}
  const t=e.target.closest('[data-bkto]');if(t&&!t.disabled){S.settings.backupTo=t.dataset.bkto;cMeta();render();}});
$('bkRemind').addEventListener('change',e=>{S.settings.backupRemind=e.target.checked;cMeta();render();});

/* ================= INSTALLABLE APP / UPDATES ================= */
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
if(isStandalone()) document.documentElement.classList.add('standalone');
let installEvt=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;render();});
addEventListener('appinstalled',()=>{installEvt=null;toast('Finance Hub installed');render();});
function renderAppInfo(){
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);
  const inst=isStandalone()?'<span class="pill good">Installed</span>':installEvt?'<button class="btn sm" id="btnInstall">Install app</button>':ios?'<span style="font-weight:600">Share › Add to Home Screen</span>':'<span style="font-weight:600">Browser menu › Install app</span>';
  const sw='serviceWorker' in navigator&&navigator.serviceWorker.controller;
  $('appInfo').innerHTML=`<div class="kv"><span>Version</span><b>${APP_VERSION}</b></div><div class="kv"><span>Install on this device</span><b>${inst}</b></div><div class="kv"><span>Offline mode</span><b>${sw?'<span class="pill good">Ready</span>':'<span class="pill">Available after first load on the website</span>'}</b></div><div style="margin-top:10px"><button class="btn ghost sm" id="btnCheckUpd">Check for updates</button></div>`;
  const ib=$('btnInstall'); if(ib) ib.onclick=async()=>{installEvt.prompt();const c=await installEvt.userChoice.catch(()=>null);installEvt=null;render();if(c&&c.outcome==='accepted') buzz();};
  $('btnCheckUpd').onclick=()=>{checkUpdate(true);};
}
function showUpdate(){$('updBar').classList.add('show');}
$('updBtn').onclick=()=>{$('updTxt').textContent='Updating…';location.reload();};
$('updX').onclick=()=>$('updBar').classList.remove('show');
let manualCheck=false;
function checkUpdate(manual){
  if(!('serviceWorker' in navigator)||!navigator.serviceWorker.controller){if(manual) toast('Updates are checked automatically on the website.');return;}
  manualCheck=!!manual; navigator.serviceWorker.controller.postMessage('CHECK_UPDATE');
  if(manual){toast('Checking for updates…');setTimeout(()=>{if(manualCheck&&!$('updBar').classList.contains('show')) toast('You have the latest version');manualCheck=false;},4000);}
}
async function staleCheck(){try{const m=await caches.open('fh-meta'),r=await m.match('./__updated');if(r&&+(await r.text())>performance.timeOrigin) showUpdate();}catch(_){}}
if('serviceWorker' in navigator&&location.protocol==='https:'){
  navigator.serviceWorker.register('./sw.js').then(reg=>{
    staleCheck();
    setInterval(()=>{reg.update().catch(()=>{});checkUpdate(false);},30*60*1000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){reg.update().catch(()=>{});checkUpdate(false);}});
  }).catch(err=>console.warn('Service worker not registered',err));
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='UPDATE_READY'){manualCheck=false;showUpdate();}});
}
if(new URLSearchParams(location.search).get('add')==='expense'){history.replaceState(null,'',location.pathname);const t=setInterval(()=>{if(ready){clearInterval(t);openQA();}},300);setTimeout(()=>clearInterval(t),15000);}

/* ================= INIT ================= */
chartTheme();
let _rz,_wasNarrow=innerWidth<760;
addEventListener('resize',()=>{clearTimeout(_rz);_rz=setTimeout(()=>{const n=innerWidth<760;if(n!==_wasNarrow){_wasNarrow=n;render();}},200);});
render();
