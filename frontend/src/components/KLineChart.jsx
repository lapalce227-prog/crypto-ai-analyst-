import { useEffect, useRef, useState, useContext, useCallback } from 'react'
import { createChart, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts'
import { AuthContext } from '../context/AuthContext'
import { Button } from '../components/ui/button'
import TokenSelector from './TokenSelector'
import { CandlestickChart, Wifi, WifiOff, MessageSquare, X, Send, Pencil } from 'lucide-react'

const SYMBOLS = [
  'BTC-USDT','ETH-USDT','SOL-USDT','BNB-USDT','XRP-USDT',
  'DOGE-USDT','SUI-USDT','APT-USDT','AVAX-USDT','PEPE-USDT',
  'LINK-USDT','NEAR-USDT','OP-USDT','ARB-USDT','DOT-USDT',
  'LTC-USDT','BCH-USDT','FIL-USDT','ATOM-USDT','ADA-USDT',
]
const INDICES = [{id:'IXIC',name:'纳斯达克'},{id:'SPX',name:'标普500'},{id:'000001.SS',name:'上证指数'},{id:'399001.SZ',name:'深证成指'}]
const INDEX_CATEGORIES = {'IXIC':'us','SPX':'us','000001.SS':'cn','399001.SZ':'cn'}
const TIMEFRAMES = [
  {label:'1s',bar:'1s',limit:300,ws:null,hasWs:false},{label:'15s',bar:'15s',limit:300,ws:null,hasWs:false},
  {label:'1m',bar:'1m',ws:'candle1m',limit:300,hasWs:true},{label:'5m',bar:'5m',ws:'candle5m',limit:300,hasWs:true},
  {label:'15m',bar:'15m',ws:'candle15m',limit:300,hasWs:true},{label:'1H',bar:'1H',ws:'candle1H',limit:300,hasWs:true},
  {label:'4H',bar:'4H',ws:'candle4H',limit:300,hasWs:true},{label:'1D',bar:'1D',ws:'candle1Dutc',limit:500,hasWs:true},
]

function calcEMA(data,period){const k=2/(period+1);let e=data[0].close;const r=[{time:data[0].time,value:e}];for(let i=1;i<data.length;i++){e=data[i].close*k+e*(1-k);r.push({time:data[i].time,value:e})}return r}
function calcMACD(candles){const n=candles.length;if(n<2)return[];const k12=2/13,k26=2/27,kd=2/10;let e12=candles[0].close,e26=candles[0].close,d=0;const r=[];for(let i=0;i<n;i++){if(i===0){r.push({time:candles[i].time,dif:0,dea:0,macd:0});continue}const c=candles[i].close;e12=c*k12+e12*(1-k12);e26=c*k26+e26*(1-k26);const dif=e12-e26;d=dif*kd+d*(1-kd);r.push({time:candles[i].time,dif:Math.round(dif*1e6)/1e6,dea:Math.round(d*1e6)/1e6,macd:Math.round((dif-d)*1e8)/1e8})}return r}
function calcRSI(candles,p=14){const r=[];let ag=0,al=0;for(let i=0;i<candles.length;i++){if(i===0){r.push({time:candles[i].time,value:null});continue}const ch=candles[i].close-candles[i-1].close,g=ch>0?ch:0,l=ch<0?-ch:0;if(i<=p){ag+=g;al+=l;if(i<p){r.push({time:candles[i].time,value:null});continue};ag/=p;al/=p}else{ag=(ag*(p-1)+g)/p;al=(al*(p-1)+l)/p}const rs=al===0?100:ag/al;r.push({time:candles[i].time,value:Math.round((100-100/(1+rs))*10)/10})}return r}
function calcBollinger(candles,p=20,m=2){const r=[];for(let i=0;i<candles.length;i++){if(i<p-1){r.push({time:candles[i].time,upper:null,middle:null,lower:null});continue}let s=0;for(let j=i-p+1;j<=i;j++)s+=candles[j].close;const sma=s/p;let sq=0;for(let j=i-p+1;j<=i;j++)sq+=(candles[j].close-sma)**2;const std=Math.sqrt(sq/p);r.push({time:candles[i].time,upper:Math.round((sma+m*std)*1e6)/1e6,middle:Math.round(sma*1e6)/1e6,lower:Math.round((sma-m*std)*1e6)/1e6})}return r}
function parseTime(val){if(!val)return Math.floor(Date.now()/1000);const n=Number(val);if(!isNaN(n)&&n>1e12)return Math.floor(n/1000);if(!isNaN(n)&&n>1e9)return n;const d=new Date(val);if(!isNaN(d.getTime()))return Math.floor(d.getTime()/1000);return Math.floor(Date.now()/1000)}

const MA_CONFIGS=[{p:7,c:'#f59e0b',l:'EMA7'},{p:25,c:'#ab47bc',l:'EMA25'},{p:99,c:'#3b82f6',l:'EMA99'}]

const BG='#0B0E11',BORDER='#1E2329',TEXT='#848E9C',GRID='#1a1d24'

export default function KLineChart(){
  const {apiFetch}=useContext(AuthContext)
  const mainRef=useRef(null),macdRef=useRef(null),rsiRef=useRef(null)
  const chartRef=useRef(null),macdChartRef=useRef(null),rsiChartRef=useRef(null)
  const candleRef=useRef(null),volumeRef=useRef(null),maRef=useRef([]),bbRef=useRef(null)
  const wsRef=useRef(null),wsTimerRef=useRef(null),candleDataRef=useRef([])

  const [symbol,setSymbol]=useState('BTC-USDT');const [isIndex,setIsIndex]=useState(false)
  const [tfIdx,setTfIdx]=useState(5);const [connected,setConnected]=useState(false)
  const [price,setPrice]=useState(null);const [status,setStatus]=useState('loading')
  const [showAI,setShowAI]=useState(false)
  const [chatMsgs,setChatMsgs]=useState([{role:'assistant',content:'你好！我可以帮你分析当前走势。'}])
  const [chatInput,setChatInput]=useState('');const [chatLoading,setChatLoading]=useState(false)
  const [active,setActive]=useState({ema7:false,ema25:false,ema99:false,macd:false,rsi:false,bollinger:false})
  const [drawMode,setDrawMode]=useState(false);const drawPtRef=useRef(null)
  const [hoverData,setHoverData]=useState(null);const [change24h,setChange24h]=useState(null)

  const tf=TIMEFRAMES[tfIdx];const dataSource=isIndex?'index':'okx'
  const toggle=useCallback(k=>setActive(p=>({...p,[k]:!p[k]})),[])

  // ---- Main Chart ----
  useEffect(()=>{
    const el=mainRef.current;if(!el)return
    el.innerHTML='';setStatus('loading');setConnected(false);setHoverData(null);setChange24h(null)
    maRef.current=[];bbRef.current=null;drawPtRef.current=null
    if(macdChartRef.current){try{macdChartRef.current.remove()}catch{};macdChartRef.current=null}
    if(rsiChartRef.current){try{rsiChartRef.current.remove()}catch{};rsiChartRef.current=null}
    if(macdRef.current)macdRef.current.innerHTML=''
    if(rsiRef.current)rsiRef.current.innerHTML=''
    if(wsRef.current){try{wsRef.current.close()}catch{};wsRef.current=null}
    if(wsTimerRef.current){clearTimeout(wsTimerRef.current);wsTimerRef.current=null}

    const chart=createChart(el,{width:el.clientWidth,height:400,layout:{background:{color:BG},textColor:TEXT},grid:{vertLines:{color:GRID},horzLines:{color:GRID}},crosshair:{mode:1,vertLine:{color:'#555',style:2,labelBackgroundColor:BORDER},horzLine:{color:'#555',style:2,labelBackgroundColor:BORDER}},timeScale:{borderColor:BORDER,timeVisible:true,secondsVisible:tf.bar==='1s'},rightPriceScale:{borderColor:BORDER}})
    const cSer=chart.addSeries(CandlestickSeries,{upColor:'#00b061',downColor:'#ef4444',borderUpColor:'#00b061',borderDownColor:'#ef4444',wickUpColor:'#00b061',wickDownColor:'#ef4444'})
    const vSer=chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:''});vSer.priceScale().applyOptions({scaleMargins:{top:0.82,bottom:0}})
    chartRef.current=chart;candleRef.current=cSer;volumeRef.current=vSer

    // ResizeObserver: chart resizes when AI panel opens/closes
    const roMain=new ResizeObserver(()=>{const w=el.clientWidth;if(w>0&&w!==chart.options().width)chart.applyOptions({width:w})});roMain.observe(el)

    // Crosshair tip
    const tip=document.createElement('div')
    tip.style.cssText='position:absolute;z-index:10;pointer-events:none;display:none;background:rgba(20,22,26,.96);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.06);border-radius:6px;padding:8px 10px;font-size:11px;font-family:"SF Mono",monospace;line-height:1.55;color:#d4d4d8;box-shadow:0 4px 24px rgba(0,0,0,.5);min-width:155px'
    el.style.position='relative';el.appendChild(tip)
    chart.subscribeCrosshairMove(param=>{
      if(!param.point||!param.time||!param.seriesData){tip.style.display='none';setHoverData(null);return}
      const d=param.seriesData.get(cSer);if(!d){tip.style.display='none';setHoverData(null);return}
      const o=d.open,h=d.high,l=d.low,c=d.close,chg=c-o,cp=o?(chg/o*100).toFixed(2):'0.00'
      const clr=chg>=0?'#00b061':'#ef4444'
      const dt=new Date(typeof param.time==='number'&&param.time>1e12?param.time:param.time*1000)
      const ts=dt.toLocaleString('zh-CN',tf.bar==='1D'?{month:'2-digit',day:'2-digit'}:{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
      tip.innerHTML=`<div style="color:#848E9C;margin-bottom:4px;font-size:10px">${ts}</div><div style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px"><span style="color:#848E9C">O</span><span style="color:#f59e0b;text-align:right">${o.toFixed(2)}</span><span style="color:#848E9C">H</span><span style="color:#00b061;text-align:right">${h.toFixed(2)}</span><span style="color:#848E9C">L</span><span style="color:#ef4444;text-align:right">${l.toFixed(2)}</span><span style="color:#848E9C">C</span><span style="color:${clr};text-align:right">${c.toFixed(2)}</span></div><div style="margin-top:3px;display:flex;justify-content:space-between"><span style="color:${clr}">${chg>=0?'+':''}${chg.toFixed(2)} (${chg>=0?'+':''}${cp}%)</span><span style="color:#848E9C">Vol ${d.volume||'-'}</span></div>`
      setHoverData({time:param.time,open:o,high:h,low:l,close:c,change:chg,changePct:cp})
      const x=Math.min(param.point.x+16,el.clientWidth-170),y=Math.max(8,param.point.y-130)
      tip.style.display='block';tip.style.left=x+'px';tip.style.top=y+'px'
    })

    let cancelled=false
    const doFetch=async()=>{
      if(dataSource==='index'&&INDEX_CATEGORIES[symbol]==='us'){
        const yfS=symbol==='SPX'?'%5EGSPC':'%5EIXIC'
        try{
          const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yfS}?interval=1m&range=1d`)
          if(!cancelled&&r.ok){
            const raw=await r.json();const res=raw?.chart?.result?.[0]
            if(res){
              const ts=res.timestamp||[],q=res.indicators?.quote?.[0]||{}
              const cl=ts.map((t,i)=>({time:t,open:q.open?.[i],high:q.high?.[i],low:q.low?.[i],close:q.close?.[i]})).filter(x=>x.open!=null)
              if(cl.length){
                const vol=ts.map((t,i)=>({time:t,value:q.volume?.[i]||0,color:(q.close?.[i]||0)>=(q.open?.[i]||0)?'rgba(0,176,97,0.3)':'rgba(239,68,68,0.3)'}))
                return{ok:true,_cl:cl,_vol:vol}
              }
            }
          }
        }catch{}
      }
      const apiPath=dataSource==='index'?`/api/index/candles?symbol=${symbol}&interval=1m&range=1d`:`/api/okx/candles?instId=${symbol}&bar=${tf.bar}&limit=${tf.limit}`
      try{const r=await fetch(apiPath);const json=await r.json();if(cancelled)return{ok:false};if(json.code!=='0'||!json.data?.length)return{ok:false};const raw=[...json.data].sort((a,b)=>Number(a[0])-Number(b[0]));const cl=raw.map(d=>({time:parseTime(d[0]),open:parseFloat(d[1]),high:parseFloat(d[2]),low:parseFloat(d[3]),close:parseFloat(d[4])}));const vol=raw.map((d,i)=>({time:cl[i].time,value:parseFloat(d[5]||0),color:parseFloat(d[4])>=parseFloat(d[1])?'rgba(0,176,97,0.3)':'rgba(239,68,68,0.3)'}));return{ok:true,_cl:cl,_vol:vol}}catch{return{ok:false}}
    }
    doFetch().then(res=>{if(cancelled)return;if(!res.ok||!res._cl.length){setStatus('error');return};candleDataRef.current=res._cl;cSer.setData(res._cl);vSer.setData(res._vol);chart.timeScale().fitContent();const last=res._cl[res._cl.length-1];setPrice(last.close);const first=res._cl[0],c24=last.close-first.close;setChange24h({change:c24,pct:first.close?(c24/first.close)*100:0,high:Math.max(...res._cl.map(x=>x.high)),low:Math.min(...res._cl.map(x=>x.low)),vol:res._vol.reduce((s,x)=>s+x.value,0)});setStatus('ok')}).catch(()=>{if(!cancelled)setStatus('error')})

    // WS / Polling
    let pollTimer=null
    if(dataSource==='okx'){
      if(tf.hasWs){
        let wsActive=true
        const updateCandle=(c)=>{
          if(!c)return
          try{cSer.update(c);vSer.update({time:c.time,value:c.vol,color:c.close>=c.open?'rgba(0,176,97,0.3)':'rgba(239,68,68,0.3)'})}catch{}
          setPrice(c.close)
          const data=candleDataRef.current,last=data[data.length-1]
          if(last&&last.time===c.time)data[data.length-1]={...last,open:c.open,high:c.high,low:c.low,close:c.close}
          else data.push({time:c.time,open:c.open,high:c.high,low:c.low,close:c.close})
        }
        const connectWs=(url,msg,parseFn)=>{
          if(!wsActive)return;let ws;try{ws=new WebSocket(url)}catch{return};wsRef.current=ws
          ws.onopen=()=>{if(wsActive)setConnected(true);if(typeof msg==='string')ws.send(msg);else ws.send(JSON.stringify(msg))}
          ws.onmessage=(e)=>{
            if(!wsActive)return
            try{const m=JSON.parse(e.data);const c=parseFn(m);if(c)updateCandle(c)}catch{}
          }
          const reconnect=()=>{if(wsActive){setConnected(false);wsTimerRef.current=setTimeout(()=>connectWs(url,msg,parseFn),3000)}}
          ws.onclose=()=>{if(wsRef.current===ws)reconnect()};ws.onerror=()=>{if(wsRef.current===ws)reconnect()}
        }

        // ---- Hyperliquid WS (primary) ----
        const coin=symbol.split('-')[0]
        const hlTfMap={candle1m:'1m',candle5m:'5m',candle15m:'15m',candle1H:'1h',candle4H:'4h',candle1Dutc:'1d'}
        const hlTf=hlTfMap[tf.ws]
        if(hlTf){
          connectWs('wss://api.hyperliquid.xyz/ws',
            {method:'subscribe',subscription:{type:'candle',coin,interval:hlTf}},
            (m)=>{
              if(m.channel==='candle'&&m.data){const d=m.data;return{time:Math.floor(Number(d.t)/1000),open:parseFloat(d.o),high:parseFloat(d.h),low:parseFloat(d.l),close:parseFloat(d.c),vol:parseFloat(d.v||0)}}
              return null
            })
        }

        // ---- Gate.io fallback (after 3s) ----
        const gt=tf.bar.replace('H','h').replace('D','d')
        setTimeout(()=>{
          if(!connected&&wsActive){
            try{wsRef.current?.close()}catch{}
            connectWs('wss://ws.gateio.ws/v4/',
              {time:Math.floor(Date.now()/1000),channel:'spot.candlesticks',event:'subscribe',payload:[gt,symbol.replace('-','_')]},
              (m)=>{
                if(m.data?.length>0){const d=m.data[0];return{time:Math.floor(Number(d[0])/(Number(d[0])>1e12?1000:1)),open:parseFloat(d[1]),high:parseFloat(d[2]),low:parseFloat(d[3]),close:parseFloat(d[4]),vol:parseFloat(d[5]||0)}}
                if(m.result?.t)return{time:Math.floor(Number(m.result.t)),open:parseFloat(m.result.o),high:parseFloat(m.result.h),low:parseFloat(m.result.l),close:parseFloat(m.result.c),vol:parseFloat(m.result.v||0)}
                return null
              })
          }
        },3000)

        // ---- OKX fallback (after 6s) ----
        setTimeout(()=>{
          if(!connected&&wsActive&&wsRef.current?.readyState!==WebSocket.OPEN){
            try{wsRef.current?.close()}catch{}
            connectWs('wss://ws.okx.com:8443/ws/v5/public',
              {op:'subscribe',args:[{channel:tf.ws,instId:symbol}]},
              (m)=>{
                if(m.data?.length>0){const d=m.data[0];return{time:Math.floor(Number(d[0])/(Number(d[0])>1e12?1000:1)),open:parseFloat(d[1]),high:parseFloat(d[2]),low:parseFloat(d[3]),close:parseFloat(d[4]),vol:parseFloat(d[5]||0)}}
                return null
              })
          }
        },6000)
      }else{
        pollTimer=setInterval(async()=>{try{const r=await fetch(`/api/okx/candles?instId=${symbol}&bar=${tf.bar}&limit=2`);const json=await r.json();if(json.code==='0'&&json.data?.length){const d=json.data[json.data.length-1];const c={time:parseTime(d[0]),open:parseFloat(d[1]),high:parseFloat(d[2]),low:parseFloat(d[3]),close:parseFloat(d[4]),vol:parseFloat(d[5]||0)};try{cSer.update(c);vSer.update({time:c.time,value:c.vol,color:c.close>=c.open?'rgba(0,176,97,0.3)':'rgba(239,68,68,0.3)'})}catch{};setPrice(c.close)}}catch{}},2000)
        setConnected(true)
      }
    }
    return ()=>{cancelled=true;if(wsRef.current){try{wsRef.current.close()}catch{};wsRef.current=null};if(wsTimerRef.current)clearTimeout(wsTimerRef.current);if(pollTimer)clearInterval(pollTimer);roMain.disconnect();chart.remove()}
  },[symbol,tfIdx,dataSource])

  // ---- EMA ----
  useEffect(()=>{const chart=chartRef.current;if(!chart||status!=='ok')return;for(const s of maRef.current){try{chart.removeSeries(s)}catch{}}maRef.current=[];const candles=candleDataRef.current;if(!candles?.length)return;for(const cfg of MA_CONFIGS){if(!active[`ema${cfg.p}`])continue;const s=chart.addSeries(LineSeries,{color:cfg.c,lineWidth:1,priceLineVisible:false,lastValueVisible:false});s.setData(calcEMA(candles,cfg.p));maRef.current.push(s)}},[active.ema7,active.ema25,active.ema99,status])

  // ---- Bollinger ----
  useEffect(()=>{const chart=chartRef.current;if(!chart||status!=='ok')return;if(bbRef.current){for(const s of Object.values(bbRef.current)){try{chart.removeSeries(s)}catch{}}bbRef.current=null}if(!active.bollinger)return;const candles=candleDataRef.current;if(!candles?.length)return;const bb=calcBollinger(candles).filter(d=>d.middle!=null);if(!bb.length)return;const up=chart.addSeries(LineSeries,{color:'#8b5cf6',lineWidth:1,priceLineVisible:false,lastValueVisible:false,lineStyle:2});const mid=chart.addSeries(LineSeries,{color:'#f59e0b',lineWidth:1,priceLineVisible:false,lastValueVisible:false});const low=chart.addSeries(LineSeries,{color:'#8b5cf6',lineWidth:1,priceLineVisible:false,lastValueVisible:false,lineStyle:2});up.setData(bb.map(d=>({time:d.time,value:d.upper})));mid.setData(bb.map(d=>({time:d.time,value:d.middle})));low.setData(bb.map(d=>({time:d.time,value:d.lower})));bbRef.current={up,mid,low}},[active.bollinger,status])

  // ---- MACD sub-chart ----
  useEffect(()=>{const el=macdRef.current,mc=chartRef.current,me=mainRef.current;if(!el||!mc||!me)return;if(!active.macd||status!=='ok'){if(macdChartRef.current){try{macdChartRef.current.remove()}catch{};macdChartRef.current=null};el.innerHTML='';return}if(!candleDataRef.current?.length)return;el.innerHTML='';try{const w=me.clientWidth||800,bs=mc.timeScale().options().barSpacing||8;const ch=createChart(el,{width:w,height:130,crosshair:{mode:0},timeScale:{visible:false,barSpacing:bs,rightOffset:mc.timeScale().options().rightOffset},rightPriceScale:{borderVisible:false},layout:{background:{color:BG},textColor:TEXT},grid:{vertLines:{visible:false},horzLines:{visible:false}}});macdChartRef.current=ch;const difS=ch.addSeries(LineSeries,{color:'#f59e0b',lineWidth:1,priceLineVisible:false,lastValueVisible:false});const deaS=ch.addSeries(LineSeries,{color:'#3b82f6',lineWidth:1,priceLineVisible:false,lastValueVisible:false});const histS=ch.addSeries(HistogramSeries,{});const refresh=()=>{const d=calcMACD(candleDataRef.current);if(!d||!d.length)return;difS.setData(d.map(x=>({time:x.time,value:x.dif})));deaS.setData(d.map(x=>({time:x.time,value:x.dea})));histS.setData(d.map(x=>({time:x.time,value:x.macd,color:(x.macd??0)>=0?'rgba(0,176,97,0.5)':'rgba(239,68,68,0.5)'})))};refresh();const sync=()=>{try{const l=mc.timeScale().getVisibleLogicalRange();if(l)ch.timeScale().setVisibleLogicalRange(l)}catch{}};sync();const h1=mc.timeScale().subscribeVisibleLogicalRangeChange(sync);const ro=new ResizeObserver(()=>{const nw=me.clientWidth||800;if(nw!==ch.options().width)ch.applyOptions({width:nw})});ro.observe(me);const iv=setInterval(refresh,2000);return()=>{mc.timeScale().unsubscribeVisibleLogicalRangeChange(h1);ro.disconnect();clearInterval(iv);ch.remove();macdChartRef.current=null}}catch(e){console.warn('MACD error:',e);el.innerHTML='<div class=\"text-[#848E9C] text-xs p-4\">MACD '+e.message+'</div>'}},[active.macd,status])

  // ---- RSI sub-chart ----
  useEffect(()=>{const el=rsiRef.current,mc=chartRef.current,me=mainRef.current;if(!el||!mc||!me)return;if(!active.rsi||status!=='ok'){if(rsiChartRef.current){try{rsiChartRef.current.remove()}catch{};rsiChartRef.current=null};el.innerHTML='';return}if(!candleDataRef.current?.length)return;el.innerHTML='';try{const w=me.clientWidth||800,bs=mc.timeScale().options().barSpacing||8;const ch=createChart(el,{width:w,height:130,crosshair:{mode:0},timeScale:{visible:false,barSpacing:bs,rightOffset:mc.timeScale().options().rightOffset},rightPriceScale:{borderVisible:false,autoScale:false},layout:{background:{color:BG},textColor:TEXT},grid:{vertLines:{visible:false},horzLines:{visible:false}}});rsiChartRef.current=ch;ch.priceScale('right').applyOptions({scaleMargins:{top:.05,bottom:.05}});const line=ch.addSeries(LineSeries,{color:'#8b5cf6',lineWidth:1.5,priceLineVisible:false,lastValueVisible:false});const r70=ch.addSeries(LineSeries,{color:'#ef4444',lineWidth:1,priceLineVisible:false,lastValueVisible:false,lineStyle:2});const r30=ch.addSeries(LineSeries,{color:'#00b061',lineWidth:1,priceLineVisible:false,lastValueVisible:false,lineStyle:2});const refresh=()=>{const d=calcRSI(candleDataRef.current).filter(x=>x.value!=null);if(!d||!d.length)return;line.setData(d);r70.setData(d.map(x=>({time:x.time,value:70})));r30.setData(d.map(x=>({time:x.time,value:30})))};refresh();const sync=()=>{try{const l=mc.timeScale().getVisibleLogicalRange();if(l)ch.timeScale().setVisibleLogicalRange(l)}catch{}};sync();const h1=mc.timeScale().subscribeVisibleLogicalRangeChange(sync);const ro=new ResizeObserver(()=>{const nw=me.clientWidth||800;if(nw!==ch.options().width)ch.applyOptions({width:nw})});ro.observe(me);const iv=setInterval(refresh,2000);return()=>{mc.timeScale().unsubscribeVisibleLogicalRangeChange(h1);ro.disconnect();clearInterval(iv);ch.remove();rsiChartRef.current=null}}catch(e){console.warn('RSI error:',e);el.innerHTML='<div class=\"text-[#848E9C] text-xs p-4\">RSI '+e.message+'</div>'}},[active.rsi,status])

  // ---- Draw ----
  useEffect(()=>{const chart=chartRef.current;if(!chart)return;const h=(param)=>{if(!drawMode||!param.point)return;const t=chart.timeScale().coordinateToTime(param.point.x);if(!t)return;const v=chart.priceScale('right').coordinateToPrice(param.point.y);if(v==null)return;if(!drawPtRef.current){drawPtRef.current={time:t,value:v};return};chart.addSeries(LineSeries,{color:'#f59e0b',lineWidth:1.5,priceLineVisible:false,lastValueVisible:false}).setData([{time:drawPtRef.current.time,value:drawPtRef.current.value},{time:t,value:v}]);drawPtRef.current=null};chart.subscribeClick(h);return()=>chart.unsubscribeClick(h)},[drawMode])

  const selectSymbol=(s,idx=false)=>{setIsIndex(idx);setSymbol(s);setConnected(false)}
  const sendChat=async()=>{if(!chatInput.trim())return;const q=chatInput;setChatInput('');setChatMsgs(m=>[...m,{role:'user',content:q}]);setChatLoading(true);try{const res=await apiFetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})});const data=await res.json();if(res.ok){setChatMsgs(m=>[...m,{role:'assistant',content:data.answer||'(空响应)'}])}else{setChatMsgs(m=>[...m,{role:'assistant',content:'错误: '+(data.detail||res.status)}])}}catch(e){setChatMsgs(m=>[...m,{role:'assistant',content:'AI 服务暂不可用: '+e.message}])};setChatLoading(false)}

  const btnS='text-[11px] h-7 px-2.5 rounded border border-[#1E2329] bg-[#0B0E11] text-[#848E9C] hover:text-white hover:border-[#333] transition-all font-medium'
  const btnA='text-[11px] h-7 px-2.5 rounded bg-white text-black font-medium'

  return(
    <div className="flex flex-col" style={{background:'#0B0E11',minHeight:'100vh',color:'#d4d4d8'}}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E2329] flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-0.5">
            <button className={!isIndex?btnA:btnS} onClick={()=>selectSymbol(SYMBOLS[0],false)}>加密货币</button>
            <button className={isIndex?btnA:btnS} onClick={()=>selectSymbol(INDICES[0].id,true)}>股指</button>
          </div>
          <TokenSelector tokens={isIndex?INDICES.map(s=>s.id):SYMBOLS} value={symbol} onChange={id=>selectSymbol(id,isIndex)} labelFn={isIndex?(id=>INDICES.find(s=>s.id===id)?.name||id):(s=>s.replace('-USDT',''))} className="border-[#1E2329] bg-[#0B0E11] text-white"/>
          <div className="flex gap-0.5">{TIMEFRAMES.map((t,i)=><button key={t.bar} className={tfIdx===i?btnA:btnS} onClick={()=>setTfIdx(i)}>{t.label}</button>)}</div>
          <span className="text-[#848E9C] text-xs">|</span>
          {MA_CONFIGS.map(c=><button key={c.l} onClick={()=>toggle(`ema${c.p}`)} className={`text-[10px] h-6 px-2 rounded border transition-all font-medium ${active[`ema${c.p}`]?'text-white border-transparent':'border-[#1E2329] text-[#848E9C] hover:text-white'}`} style={active[`ema${c.p}`]?{background:c.c}:{}}>{c.l}</button>)}
          <button onClick={()=>toggle('macd')} className={`text-[10px] h-6 px-2 rounded border transition-all font-medium ${active.macd?'bg-white text-black border-white':'border-[#1E2329] text-[#848E9C] hover:text-white'}`}>MACD</button>
          <button onClick={()=>toggle('rsi')} className={`text-[10px] h-6 px-2 rounded border transition-all font-medium ${active.rsi?'bg-white text-black border-white':'border-[#1E2329] text-[#848E9C] hover:text-white'}`}>RSI</button>
          <button onClick={()=>toggle('bollinger')} className={`text-[10px] h-6 px-2 rounded border transition-all font-medium ${active.bollinger?'bg-white text-black border-white':'border-[#1E2329] text-[#848E9C] hover:text-white'}`}>BOLL</button>
          <button onClick={()=>{setDrawMode(!drawMode);drawPtRef.current=null}} className={`text-[10px] h-6 px-2 rounded border transition-all font-medium flex items-center gap-1 ${drawMode?'bg-amber-500 text-black border-amber-500':'border-[#1E2329] text-[#848E9C] hover:text-white'}`}><Pencil size={10}/>画线</button>
        </div>
        <div className="flex items-center gap-3">
          {status==='ok'&&price&&<div className="flex items-baseline gap-2"><span className={`text-lg font-bold font-mono tabular-nums ${change24h?.change>=0?'text-[#00b061]':'text-[#ef4444]'}`}>{price.toLocaleString(void 0,{minimumFractionDigits:2,maximumFractionDigits:6})}</span>{change24h&&<span className={`text-xs ${change24h.change>=0?'text-[#00b061]':'text-[#ef4444]'}`}>{change24h.change>=0?'+':''}{change24h.pct.toFixed(2)}%</span>}</div>}
          <span className="text-[#848E9C] text-[11px] flex items-center gap-1">{connected?<Wifi size={12} className="text-[#00b061]"/>:<WifiOff size={12} className="text-[#848E9C]"/>}{connected?'实时':tf.hasWs?'实时':'轮询'}</span>
          {status==='loading'&&<span className="text-[#848E9C] text-[11px]">加载中...</span>}
          <button onClick={()=>setShowAI(!showAI)} className="text-xs text-[#848E9C] hover:text-white bg-transparent border-0 cursor-pointer">{showAI?'收起':'AI'}</button>
        </div>
      </div>
      <div className="flex flex-1" style={{minHeight:0}}>
        <div className="flex-1 flex flex-col min-w-0" style={{flex:showAI?'0 0 65%':'1 1 100%',transition:'flex 0.2s'}}>
          <div ref={mainRef} className="flex-1" style={{minHeight:400}}/>
          {active.macd&&<div className="border-t border-[#1E2329]"><div className="text-[10px] text-[#848E9C] px-2 py-0.5">MACD (12,26,9)</div><div ref={macdRef} style={{width:'100%',height:130}}/></div>}
          {active.rsi&&<div className="border-t border-[#1E2329]"><div className="text-[10px] text-[#848E9C] px-2 py-0.5">RSI (14)</div><div ref={rsiRef} style={{width:'100%',height:130}}/></div>}
        </div>
        {showAI&&<div className="flex flex-col border-l border-[#1E2329] bg-[#0B0E11]" style={{flex:'0 0 35%',minWidth:280}}>
          <div className="flex justify-between items-center px-3 py-2.5 border-b border-[#1E2329]"><span className="text-sm font-semibold text-[#d4d4d8]">AI 分析</span><button onClick={()=>setShowAI(false)} className="bg-transparent border-0 text-[#848E9C] cursor-pointer hover:text-white"><X size={14}/></button></div>
          <div className="flex-1 overflow-auto p-3 space-y-2">{chatMsgs.map((m,i)=><div key={i} style={{alignSelf:m.role==='user'?'flex-end':'flex-start',maxWidth:'90%'}}><span className="text-[10px] text-[#848E9C] mb-0.5 block">{m.role==='user'?'你':'AI'}</span><div className={`px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${m.role==='user'?'bg-white text-black':'bg-[#1a1d24] text-[#d4d4d8]'}`}>{m.content}</div></div>)}</div>
          {chatLoading&&<div className="text-[11px] text-[#848E9C] px-3">AI 思考中...</div>}
          <div className="p-2.5 border-t border-[#1E2329] flex gap-2"><form onSubmit={e=>{e.preventDefault();sendChat()}} className="flex-1 flex gap-2"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder={`问AI关于 ${symbol} 的走势...`} className="flex-1 h-8 text-xs bg-[#1a1d24] border border-[#1E2329] rounded px-3 text-[#d4d4d8] outline-none focus:border-[#333]"/><Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={chatLoading}><Send size={12}/></Button></form></div>
        </div>}
      </div>
    </div>
  )
}
