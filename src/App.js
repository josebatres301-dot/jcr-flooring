import { useState, useEffect, useRef, useMemo } from "react";
import { db } from "./firebase";
import {
  collection, doc, getDocs, getDoc,
  setDoc, deleteDoc, updateDoc,
  onSnapshot, writeBatch,
} from "firebase/firestore";

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 430);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const APP_PASSWORD = "@Martian301";

const INIT_BUILDERS = [
  { id:"bryan",   name:"Bryan",          company:"Bryan Lagaly",        email:"bills4blh@gmail.com",         prefix:"BL",  lastNum:2176, color:"#3b82f6" },
  { id:"maple",   name:"Maple",          company:"Bridger on Maple LLC", email:"Mason@bridgercos.com",        prefix:"M",   lastNum:1135, color:"#10b981" },
  { id:"isaiah",  name:"Isaiah",         company:"Isaiah Ast",           email:"jill@solutionsofwichita.com", prefix:"IA",  lastNum:3103, color:"#8b5cf6" },
  { id:"mike",    name:"Mike",           company:"Mike Hampton",         email:"hamptonrenthomes@gmail.com",  prefix:"MH",  lastNum:1133, color:"#f59e0b" },
  { id:"dustin",  name:"Dustin",         company:"MPK Investments LLC",  email:"evansdustin@att.net",         prefix:"MPK", lastNum:6018, color:"#06b6d4" },
  { id:"kolby",   name:"Kolby",          company:"Kolby Kruse",          email:"hannah@kratosindustries.com", prefix:"KK",  lastNum:21,   color:"#ef4444" },
  { id:"maize",   name:"Bridger Maize",  company:"Bridger Maize LLC",    email:"Mason@bridgercos.com",        prefix:"MZ",  lastNum:21,   color:"#f97316" },
  { id:"central", name:"Bridger Central",company:"Bridger on Central",   email:"Mason@bridgercos.com",        prefix:"BC",  lastNum:2,    color:"#64748b" },
];

const BUILDER_COLORS = ["#3b82f6","#10b981","#8b5cf6","#f59e0b","#06b6d4","#ef4444","#f97316","#64748b","#ec4899","#14b8a6","#a855f7","#84cc16"];

const LINE_ITEM_PRESETS = [
  { desc:"LVP Install — Slab",       item:"LVP Install", unit:"SF",  price:1.15,   flat:false, autoDetail:qty=>`${qty} SQ FT on Slab @ $1.15/SF`,      qtyLabel:"SQ FT" },
  { desc:"LVP Install — Subfloor",   item:"LVP Install", unit:"SF",  price:1.75,   flat:false, autoDetail:qty=>`${qty} SQ FT on Subfloor @ $1.75/SF`,   qtyLabel:"SQ FT" },
  { desc:"Tile — Kitchen",           item:"Tile",         unit:"SF",  price:10.00,  flat:false, autoDetail:qty=>`${qty} SQFT Kitchen`,                   qtyLabel:"SQ FT" },
  { desc:"Tile — Backsplash Small",  item:"Tile",         unit:"job", price:50.00,  flat:true,  autoDetail:()=>`1 Small Backsplash`,                     qtyLabel:null    },
  { desc:"Tile — Backsplash Med",    item:"Tile",         unit:"job", price:75.00,  flat:true,  autoDetail:()=>`1 Medium Backsplash`,                    qtyLabel:null    },
  { desc:"Tile — Backsplash Large",  item:"Tile",         unit:"job", price:100.00, flat:true,  autoDetail:()=>`1 Large Backsplash`,                     qtyLabel:null    },
  { desc:"Tile — Lg + Sm Backsplash",item:"Tile",         unit:"job", price:150.00, flat:true,  autoDetail:()=>`1 Large, 1 Small Backsplash`,            qtyLabel:null    },
  { desc:"Quarter Round / Trim",     item:"Quarter Round",unit:"LF",  price:1.00,   flat:false, autoDetail:qty=>`${qty} Linear Feet`,                    qtyLabel:"LF"    },
  { desc:"Trip Fee",                 item:"Other",        unit:"job", price:100.00, flat:true,  autoDetail:()=>`Trip Fee`,                               qtyLabel:null    },
  { desc:"Concrete Drill/Prep",      item:"Other",        unit:"job", price:0.00,   flat:true,  autoDetail:()=>`Concrete Drill/Prep`,                    qtyLabel:null    },
  { desc:"Material Cost",            item:"Materials",    unit:"job", price:0.00,   flat:false, autoDetail:()=>`Material Cost`,                          qtyLabel:"$"     },
  { desc:"Other",                    item:"Other",        unit:"job", price:0.00,   flat:false, autoDetail:()=>``,                                       qtyLabel:"qty"   },
];

const INIT_ACTIVE = [
  // Bryan — active
  { id:1,  builder:"bryan",   invoiceNum:"BL2174", address:"1209/11 SE 10th St", city:"Newton, KS 67114",    jobType:"duplex", amount:2700.00, date:"3/31/26", lineItems:[], notes:"" },
  { id:2,  builder:"bryan",   invoiceNum:"BL2175", address:"1215/17 SE 10th St", city:"Newton, KS 67114",    jobType:"duplex", amount:2700.00, date:"3/31/26", lineItems:[], notes:"" },
  { id:3,  builder:"bryan",   invoiceNum:"BL2176", address:"1221/23 SE 10th St", city:"Newton, KS 67114",    jobType:"duplex", amount:2700.00, date:"4/16/26", lineItems:[], notes:"" },
  // Maple — active
  { id:4,  builder:"maple",   invoiceNum:"M1135",  address:"2405/2407 Taiga St",  city:"Goddard, KS 67052",  jobType:"duplex", amount:3300.00, date:"4/3/26",  lineItems:[], notes:"" },
  // Isaiah — active
  { id:5,  builder:"isaiah",  invoiceNum:"IA3101", address:"9369/71 E Wassall Ct",city:"Wichita, KS 67210",  jobType:"duplex", amount:4180.51, date:"3/25/26", lineItems:[], notes:"" },
  { id:6,  builder:"isaiah",  invoiceNum:"IA3102", address:"2113/15 N Reece St",  city:"Colwich, KS 67030",  jobType:"duplex", amount:3200.00, date:"3/29/26", lineItems:[], notes:"" },
  { id:7,  builder:"isaiah",  invoiceNum:"IA3103", address:"2119/21 N Reece St",  city:"Colwich, KS 67030",  jobType:"duplex", amount:3245.00, date:"4/7/26",  lineItems:[], notes:"" },
  // Kolby — active
  { id:8,  builder:"kolby",   invoiceNum:"KK019",  address:"17012/14 W Lawson Cir",city:"Wichita, KS 67052", jobType:"duplex", amount:2400.00, date:"3/19/26", lineItems:[], notes:"" },
  { id:9,  builder:"kolby",   invoiceNum:"KK020",  address:"17006/08 W Lawson Cir",city:"Wichita, KS 67052", jobType:"duplex", amount:2400.00, date:"3/27/26", lineItems:[], notes:"" },
  { id:10, builder:"kolby",   invoiceNum:"KK021",  address:"16901/03 W Lawson Cir",city:"Wichita, KS 67052", jobType:"duplex", amount:2400.00, date:"4/16/26", lineItems:[], notes:"" },
  // Bridger Maize — active
  { id:11, builder:"maize",   invoiceNum:"MZ021",  address:"12170/72 Rosemary St", city:"Maize, KS 67026",   jobType:"duplex", amount:3300.00, date:"4/3/26",  lineItems:[], notes:"" },
  // Bridger Central — active
  { id:12, builder:"central", invoiceNum:"BC002",  address:"707 N Rainbow Lake St 100/200",city:"Wichita, KS 67235",jobType:"duplex",amount:3300.00,date:"4/16/26",lineItems:[],notes:"" },
];

const INIT_PAID = [
  // Bryan
  { id:101, builder:"bryan",   invoiceNum:"BL2164",  address:"600 Long Path Ct",         city:"Goddard, KS 67052",   amount:1650.00, dateInvoiced:"1/18/26", datePaid:"2/15/26" },
  { id:102, builder:"bryan",   invoiceNum:"BL2165",  address:"596 Long Path Ct",         city:"Goddard, KS 67052",   amount:1600.00, dateInvoiced:"1/18/26", datePaid:"2/15/26" },
  { id:103, builder:"bryan",   invoiceNum:"BL2166",  address:"604 Long Path Ct",         city:"Goddard, KS 67052",   amount:1600.00, dateInvoiced:"1/23/26", datePaid:"2/15/26" },
  { id:104, builder:"bryan",   invoiceNum:"BL2167",  address:"608 Long Path Ct",         city:"Goddard, KS 67052",   amount:1600.00, dateInvoiced:"2/7/26",  datePaid:"3/28/26" },
  { id:105, builder:"bryan",   invoiceNum:"BL2168",  address:"612 Long Path Ct",         city:"Goddard, KS 67052",   amount:1600.00, dateInvoiced:"2/13/26", datePaid:"3/28/26" },
  { id:106, builder:"bryan",   invoiceNum:"BL2169",  address:"1114/16 SE 10th St",       city:"Newton, KS 67114",    amount:2700.00, dateInvoiced:"2/25/26", datePaid:"3/28/26" },
  { id:107, builder:"bryan",   invoiceNum:"BL2170",  address:"1120/22 SE 10th St",       city:"Newton, KS 67114",    amount:2700.00, dateInvoiced:"3/7/26",  datePaid:"4/21/26" },
  { id:108, builder:"bryan",   invoiceNum:"BL2171",  address:"1202/04 SE 10th St",       city:"Newton, KS 67114",    amount:2700.00, dateInvoiced:"3/7/26",  datePaid:"4/21/26" },
  { id:109, builder:"bryan",   invoiceNum:"BL2172",  address:"1218/20 SE 10th St",       city:"Newton, KS 67114",    amount:2700.00, dateInvoiced:"3/7/26",  datePaid:"4/21/26" },
  { id:110, builder:"bryan",   invoiceNum:"BL2173",  address:"1203/05 SE 10th St",       city:"Newton, KS 67114",    amount:2700.00, dateInvoiced:"3/19/26", datePaid:"4/21/26" },
  // Bridger Central
  { id:111, builder:"central", invoiceNum:"BC001",   address:"703-100/200 Rainbow Lake St",city:"Wichita, KS 67235", amount:3300.00, dateInvoiced:"3/14/26", datePaid:"4/6/26"  },
  // Isaiah
  { id:112, builder:"isaiah",  invoiceNum:"IA3098",  address:"5222/24 S Chase Ave",      city:"Wichita, KS 67217",   amount:4579.49, dateInvoiced:"1/5/26",  datePaid:"2/10/26" },
  { id:113, builder:"isaiah",  invoiceNum:"IA3099",  address:"9339/41 E Wassall Ct",     city:"Wichita, KS 67210",   amount:3832.85, dateInvoiced:"1/13/26", datePaid:"2/10/26" },
  { id:114, builder:"isaiah",  invoiceNum:"IA3100",  address:"9345/47 E Wassall Ct",     city:"Wichita, KS 67210",   amount:4254.82, dateInvoiced:"2/7/26",  datePaid:"3/20/26" },
  // Kolby
  { id:115, builder:"kolby",   invoiceNum:"KK009",   address:"17142/44 W Lawson Cir",    city:"Goddard, KS 67052",   amount:2400.00, dateInvoiced:"1/5/26",  datePaid:"2/1/26"  },
  { id:116, builder:"kolby",   invoiceNum:"KK010",   address:"17136/38 W Lawson Cir",    city:"Goddard, KS 67052",   amount:2300.00, dateInvoiced:"1/5/26",  datePaid:"2/1/26"  },
  { id:117, builder:"kolby",   invoiceNum:"KK011",   address:"5308 W Rolly St 100/200",  city:"Wichita, KS 67215",   amount:2500.00, dateInvoiced:"1/18/26", datePaid:"2/15/26" },
  { id:118, builder:"kolby",   invoiceNum:"KK012",   address:"17154/56 W Lawson Cir",    city:"Wichita, KS 67052",   amount:2400.00, dateInvoiced:"2/4/26",  datePaid:"3/1/26"  },
  { id:119, builder:"kolby",   invoiceNum:"KK013",   address:"17124/26 W Lawson Cir",    city:"Wichita, KS 67052",   amount:2400.00, dateInvoiced:"2/7/26",  datePaid:"3/1/26"  },
  { id:120, builder:"kolby",   invoiceNum:"KK014",   address:"17145/47 W Lawson Cir",    city:"Wichita, KS 67052",   amount:2400.00, dateInvoiced:"2/13/26", datePaid:"3/15/26" },
  { id:121, builder:"kolby",   invoiceNum:"KK015",   address:"17139/41 W Lawson Cir",    city:"Wichita, KS 67052",   amount:2400.00, dateInvoiced:"2/17/26", datePaid:"3/15/26" },
  { id:122, builder:"kolby",   invoiceNum:"KK016",   address:"17133/35 W Lawson Cir",    city:"Wichita, KS 67052",   amount:2400.00, dateInvoiced:"3/3/26",  datePaid:"4/6/26"  },
  { id:123, builder:"kolby",   invoiceNum:"KK017",   address:"17018/20 W Lawson Cir",    city:"Wichita, KS 67052",   amount:2400.00, dateInvoiced:"3/3/26",  datePaid:"4/6/26"  },
  { id:124, builder:"kolby",   invoiceNum:"KK018",   address:"17127/29 W Lawson Cir",    city:"Wichita, KS 67052",   amount:2400.00, dateInvoiced:"3/13/26", datePaid:"4/6/26"  },
  // Maple
  { id:125, builder:"maple",   invoiceNum:"M1129",   address:"2138/40 W Elk Ridge Ave",  city:"Goddard, KS 67052",   amount:3300.00, dateInvoiced:"1/14/26", datePaid:"2/15/26" },
  { id:126, builder:"maple",   invoiceNum:"M1130",   address:"2144/46 W Elk Ridge Ave",  city:"Goddard, KS 67052",   amount:3500.00, dateInvoiced:"1/18/26", datePaid:"2/15/26" },
  { id:127, builder:"maple",   invoiceNum:"M1131",   address:"2400 W Elk Ridge Ave",     city:"Goddard, KS 67052",   amount:3650.00, dateInvoiced:"1/20/26", datePaid:"2/15/26" },
  { id:128, builder:"maple",   invoiceNum:"M1132",   address:"2150/52 W Elk Ridge Ave",  city:"Goddard, KS 67052",   amount:3300.00, dateInvoiced:"1/29/26", datePaid:"2/28/26" },
  { id:129, builder:"maple",   invoiceNum:"M1133",   address:"2156/58 W Elk Ridge Ave",  city:"Goddard, KS 67052",   amount:3500.00, dateInvoiced:"2/13/26", datePaid:"3/15/26" },
  { id:130, builder:"maple",   invoiceNum:"M1134",   address:"2411/2414 Taiga St",       city:"Goddard, KS 67052",   amount:3500.00, dateInvoiced:"3/11/26", datePaid:"4/21/26" },
  // Mike
  { id:131, builder:"mike",    invoiceNum:"MH1132",  address:"12711/13 N Cowboy St",     city:"Wichita, KS 67235",   amount:2500.00, dateInvoiced:"1/23/26", datePaid:"3/1/26"  },
  { id:132, builder:"mike",    invoiceNum:"MH1133",  address:"12705/07 N Cowboy St",     city:"Wichita, KS 67235",   amount:2500.00, dateInvoiced:"1/23/26", datePaid:"3/20/26" },
  // Dustin
  { id:133, builder:"dustin",  invoiceNum:"MPK6012", address:"16814/16 W Lawson St",     city:"Goddard, KS 67052",   amount:2700.00, dateInvoiced:"1/5/26",  datePaid:"2/1/26"  },
  { id:134, builder:"dustin",  invoiceNum:"MPK6013", address:"16808/10 W Lawson St",     city:"Goddard, KS 67052",   amount:2700.00, dateInvoiced:"1/30/26", datePaid:"3/1/26"  },
  { id:135, builder:"dustin",  invoiceNum:"MPK6014", address:"16802/04 W Lawson St",     city:"Goddard, KS 67052",   amount:2600.00, dateInvoiced:"2/7/26",  datePaid:"3/28/26" },
  { id:136, builder:"dustin",  invoiceNum:"MPK6015", address:"1932 S Mosley",            city:"Wichita, KS 67211",   amount:1875.00, dateInvoiced:"3/3/26",  datePaid:"4/6/26"  },
  { id:137, builder:"dustin",  invoiceNum:"MPK6016", address:"1126 W 6th Ave",           city:"El Dorado, KS 67042", amount:3050.00, dateInvoiced:"3/28/26", datePaid:"4/21/26" },
  { id:138, builder:"dustin",  invoiceNum:"MPK6017", address:"1128 W 6th Ave",           city:"El Dorado, KS 67042", amount:3050.00, dateInvoiced:"3/28/26", datePaid:"4/21/26" },
  { id:139, builder:"dustin",  invoiceNum:"MPK6018", address:"1204 W 6th Ave",           city:"El Dorado, KS 67042", amount:1575.00, dateInvoiced:"3/28/26", datePaid:"4/21/26" },
  // Bridger Maize
  { id:140, builder:"maize",   invoiceNum:"MZ010",   address:"12171/73 Northstar St",    city:"Maize, KS 67026",     amount:3300.00, dateInvoiced:"2/7/26",  datePaid:"3/15/26" },
  { id:141, builder:"maize",   invoiceNum:"MZ011",   address:"3669/71 N Azalea St",      city:"Maize, KS 67223",     amount:3300.00, dateInvoiced:"2/7/26",  datePaid:"3/15/26" },
  { id:142, builder:"maize",   invoiceNum:"MZ012",   address:"12195/97 Northstar St",    city:"Maize, KS 67026",     amount:3200.00, dateInvoiced:"2/13/26", datePaid:"3/15/26" },
  { id:143, builder:"maize",   invoiceNum:"MZ013",   address:"12244/46 Northstar St",    city:"Maize, KS 67026",     amount:3200.00, dateInvoiced:"2/19/26", datePaid:"3/15/26" },
  { id:144, builder:"maize",   invoiceNum:"MZ014",   address:"12219/21 Northstar St",    city:"Maize, KS 67026",     amount:3300.00, dateInvoiced:"2/19/26", datePaid:"3/15/26" },
  { id:145, builder:"maize",   invoiceNum:"MZ015",   address:"12267/69 Northstar St",    city:"Maize, KS 67026",     amount:3300.00, dateInvoiced:"2/25/26", datePaid:"3/28/26" },
  { id:146, builder:"maize",   invoiceNum:"MZ016",   address:"12268/70 Rosemary St",     city:"Maize, KS 67026",     amount:3300.00, dateInvoiced:"3/11/26", datePaid:"4/6/26"  },
  { id:147, builder:"maize",   invoiceNum:"MZ017",   address:"12218/20 Rosemary St",     city:"Maize, KS 67026",     amount:3300.00, dateInvoiced:"3/13/26", datePaid:"4/6/26"  },
  { id:148, builder:"maize",   invoiceNum:"MZ018",   address:"3631/33 N Azalea St",      city:"Maize, KS 67223",     amount:3300.00, dateInvoiced:"3/19/26", datePaid:"4/21/26" },
  { id:149, builder:"maize",   invoiceNum:"MZ019",   address:"12194/96 Rosemary St",     city:"Maize, KS 67026",     amount:3200.00, dateInvoiced:"3/27/26", datePaid:"4/21/26" },
  { id:150, builder:"maize",   invoiceNum:"MZ020",   address:"12242/44 Rosemary St",     city:"Maize, KS 67026",     amount:2800.00, dateInvoiced:"3/27/26", datePaid:"4/21/26" },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmt       = n => "$" + Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const todayStr  = () => { const d=new Date(); return `${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`; };
const nextNum   = (b,nums) => `${b.prefix}${String(nums[b.id]+1).padStart(3,"0")}`;
const ageDays   = dateStr => { const [m,d,y]=dateStr.split("/"); const then=new Date(`20${y}`,m-1,d); return Math.floor((Date.now()-then)/(86400000)); };
const blankItem = (pm={}) => { const p=LINE_ITEM_PRESETS[0]; return { id:Date.now()+Math.random(), desc:p.desc, item:p.item, unit:p.unit, qty:"", price:pm[p.desc]??p.price, flat:p.flat, autoDetail:p.autoDetail, qtyLabel:p.qtyLabel, priceOverridden:false }; };

// Strip functions and File objects before writing to Firestore
const serializeInvoice = inv => {
  const { receipts, ...rest } = inv;
  return { ...rest, lineItems:(inv.lineItems||[]).map(({ autoDetail, ...item }) => item) };
};

// ─── STYLES ──────────────────────────────────────────────────────────────────

const S = {
  app:  { fontFamily:"'DM Sans',sans-serif", background:"#0a0c12", minHeight:"100vh", display:"flex", justifyContent:"center" },
  wrap: { width:"100%", maxWidth:430, minHeight:"100vh", background:"#0a0c12", position:"relative", paddingBottom:88 },
  hdr:  { padding:"52px 20px 20px", background:"linear-gradient(160deg,#111525 0%,#0a0c12 100%)" },
  eye:  { fontSize:10, fontWeight:700, color:"#f0b429", letterSpacing:"0.18em", marginBottom:6 },
  ttl:  { fontSize:26, fontWeight:700, color:"#fff", letterSpacing:"-0.02em" },
  card: { background:"#12151f", borderRadius:14, border:"1px solid #1c2035", marginBottom:10 },
  cp:   { padding:"14px 16px" },
  lbl:  { fontSize:10, fontWeight:700, color:"#4a5170", letterSpacing:"0.1em", marginBottom:6 },
  inp:  { width:"100%", background:"#0a0c12", border:"1px solid #1c2035", borderRadius:10, padding:"10px 12px", color:"#e8eaf0", fontSize:14, outline:"none", boxSizing:"border-box" },
  sel:  { width:"100%", background:"#0a0c12", border:"1px solid #1c2035", borderRadius:10, padding:"10px 12px", color:"#e8eaf0", fontSize:14, outline:"none", cursor:"pointer", boxSizing:"border-box" },
  btnP: { width:"100%", padding:15, background:"#f0b429", color:"#0a0c12", borderRadius:12, border:"none", fontSize:15, fontWeight:700, cursor:"pointer" },
  btnS: { width:"100%", padding:13, background:"#12151f", color:"#9ca3bc", borderRadius:12, border:"1px solid #1c2035", fontSize:14, fontWeight:600, cursor:"pointer" },
  btnBk:{ background:"none", border:"none", color:"#4a5170", fontSize:13, cursor:"pointer", padding:0, marginBottom:16 },
  div:  { height:1, background:"#1c2035", margin:"10px 0" },
  tag:  (c,bg) => ({ fontSize:10, fontWeight:700, color:c, background:bg, padding:"3px 8px", borderRadius:100, border:`1px solid ${c}33` }),
};

// ─── NAV ICONS ───────────────────────────────────────────────────────────────

function NavIcon({ id, active }) {
  const c = active ? "#f0b429" : "#3a3f55";
  const icons = {
    home:    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    create:  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    tracker: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    history: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    settings:<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    contractors:<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  };
  return icons[id]||null;
}

function BottomNav({ screen, setScreen }) {
  const _w = useWindowWidth();
  const _isTablet = _w >= 768;
  const _isDesktop = _w >= 1024;
  if (_isDesktop) return null;
  const tabs = [
    {id:"home",        scr:"home",         label:"Home"},
    {id:"create",      scr:"c1",           label:"Invoice"},
    {id:"tracker",     scr:"tracker",      label:"Tracker"},
    {id:"history",     scr:"history",      label:"Finance"},
    {id:"contractors", scr:"contractors",  label:"Workers"},
    {id:"settings",    scr:"settings",     label:"Settings"},
  ];
  const inCreate = ["c1","c2","c3","preview"].includes(screen);
  return (
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:_isDesktop?900:_isTablet?"100%":430,background:"#0e1118",borderTop:"1px solid #1c2035",display:"flex",zIndex:100}}>
      {tabs.map(t=>{
        const active = screen===t.scr||(t.id==="create"&&inCreate);
        return (
          <button key={t.id} onClick={()=>setScreen(t.scr)} style={{flex:1,padding:"18px 0 14px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
            <NavIcon id={t.id} active={active}/>
            <span style={{fontSize:10,fontWeight:700,color:active?"#f0b429":"#3a3f55",letterSpacing:"0.05em"}}>{t.label.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── SIDEBAR NAV (desktop only) ──────────────────────────────────────────────

function SidebarNav({ screen, setScreen }) {
  const tabs = [
    {id:"home",        scr:"home",        label:"Home"},
    {id:"create",      scr:"c1",          label:"Invoice"},
    {id:"tracker",     scr:"tracker",     label:"Tracker"},
    {id:"history",     scr:"history",     label:"Finance"},
    {id:"contractors", scr:"contractors", label:"Workers"},
    {id:"settings",    scr:"settings",    label:"Settings"},
  ];
  const inCreate = ["c1","c2","c3","preview"].includes(screen);
  return (
    <div style={{width:200,flexShrink:0,background:"#0e1118",borderRight:"1px solid #1c2035",position:"sticky",top:0,height:"100vh",display:"flex",flexDirection:"column",overflowY:"auto"}}>
      <div style={{padding:"32px 20px 24px"}}>
        <div style={{fontSize:9,fontWeight:700,color:"#f0b429",letterSpacing:"0.18em",marginBottom:4}}>JCR FLOORING LLC</div>
        <div style={{fontSize:11,color:"#4a5170"}}>Dashboard</div>
      </div>
      {tabs.map(t=>{
        const active = screen===t.scr||(t.id==="create"&&inCreate);
        return (
          <button key={t.id} onClick={()=>setScreen(t.scr)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",background:active?"#f0b42912":"none",border:"none",borderLeft:`3px solid ${active?"#f0b429":"transparent"}`,cursor:"pointer",width:"100%",textAlign:"left"}}>
            <NavIcon id={t.id} active={active}/>
            <span style={{fontSize:13,fontWeight:600,color:active?"#f0b429":"#4a5170"}}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── LOCK SCREEN ─────────────────────────────────────────────────────────────

function LockScreen({onUnlock}) {
  const [pw,setPw]=useState(""); const [err,setErr]=useState(false); const [show,setShow]=useState(false);
  const go=()=>{if(pw===APP_PASSWORD)onUnlock();else{setErr(true);setPw("");setTimeout(()=>setErr(false),2000);}};
  return (
    <div style={{minHeight:"100vh",background:"#0a0c12",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'DM Sans',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{marginBottom:40,textAlign:"center"}}>
        <div style={{width:72,height:72,background:"#f0b42915",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",border:"1px solid #f0b42930"}}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f0b429" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"#f0b429",letterSpacing:"0.18em",marginBottom:8}}>JCR FLOORING LLC</div>
        <div style={{fontSize:26,fontWeight:700,color:"#fff",letterSpacing:"-0.02em"}}>Welcome Back</div>
        <div style={{fontSize:13,color:"#4a5170",marginTop:6}}>Enter your password to continue</div>
      </div>
      <div style={{width:"100%",maxWidth:320,display:"flex",flexDirection:"column",gap:12}}>
        <div style={{position:"relative"}}>
          <input type={show?"text":"password"} value={pw} onChange={e=>{setPw(e.target.value);setErr(false);}} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Password" autoFocus
            style={{width:"100%",background:"#12151f",border:`1px solid ${err?"#ef4444":"#1c2035"}`,borderRadius:14,padding:"16px 48px 16px 18px",color:"#e8eaf0",fontSize:16,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}/>
          <button onClick={()=>setShow(s=>!s)} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#4a5170",cursor:"pointer",fontSize:18}}>{show?"🙈":"👁"}</button>
        </div>
        {err&&<div style={{color:"#ef4444",fontSize:13,fontWeight:600,textAlign:"center"}}>Incorrect password. Try again.</div>}
        <button onClick={go} style={{width:"100%",padding:16,background:"#f0b429",color:"#0a0c12",borderRadius:14,border:"none",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Unlock App</button>
      </div>
    </div>
  );
}

// ─── INVOICE PDF PREVIEW (full design match) ─────────────────────────────────

function InvoiceCard({inv, builder}) {
  if(!inv||!builder) return null;
  const W = "100%";
  const NAVY  = "#0f2d5e";
  const BLUE  = "#1565c0";
  const ACC   = "#2563eb";
  const ACLTT = "#dbeafe";
  const GLT   = "#f8fafc";
  const GMED  = "#e2e8f0";
  const DARK  = "#0f172a";
  const MUTED = "#64748b";

  return (
    <div style={{background:"#fff",borderRadius:4,overflow:"hidden",marginBottom:16,boxShadow:"0 2px 16px rgba(0,0,0,0.18)",width:W}}>

      {/* Top accent line */}
      <div style={{height:4,background:ACC}}/>

      {/* Header */}
      <div style={{background:NAVY,padding:"20px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:"#fff",letterSpacing:"0.01em"}}>JCR Flooring LLC</div>
            <div style={{fontSize:11,color:"#93c5fd",marginTop:3}}>Jose Cigarroa</div>
            <div style={{fontSize:11,color:"#93c5fd"}}>3517 N Park Pl · Wichita, KS 67204</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-0.01em"}}>INVOICE</div>
            <div style={{display:"flex",flexDirection:"column",gap:3,marginTop:6,alignItems:"flex-end"}}>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:9,fontWeight:700,color:"#60a5fa",letterSpacing:"0.1em"}}>INVOICE #</span>
                <span style={{fontSize:12,fontWeight:700,color:"#fff"}}>{inv.invoiceNum}</span>
              </div>
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                <span style={{fontSize:9,fontWeight:700,color:"#60a5fa",letterSpacing:"0.1em"}}>DATE</span>
                <span style={{fontSize:11,color:"#fff"}}>{inv.date}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Amount banner */}
      <div style={{background:BLUE,padding:"12px 24px"}}>
        <div style={{fontSize:9,fontWeight:700,color:"#93c5fd",letterSpacing:"0.1em",marginBottom:2}}>AMOUNT DUE</div>
        <div style={{fontSize:26,fontWeight:800,color:"#fff",letterSpacing:"-0.02em"}}>{fmt(inv.amount)}</div>
      </div>

      {/* Bill To / Job Site */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,padding:"16px 24px",background:GLT}}>
        <div style={{background:"#fff",borderRadius:8,padding:"10px 12px",border:`1px solid ${GMED}`}}>
          <div style={{fontSize:8,fontWeight:700,color:ACC,letterSpacing:"0.12em",marginBottom:6}}>BILL TO</div>
          <div style={{fontSize:12,fontWeight:700,color:DARK}}>{builder.company}</div>
        </div>
        <div style={{background:"#fff",borderRadius:8,padding:"10px 12px",border:`1px solid ${GMED}`}}>
          <div style={{fontSize:8,fontWeight:700,color:ACC,letterSpacing:"0.12em",marginBottom:6}}>JOB SITE</div>
          <div style={{fontSize:12,fontWeight:700,color:DARK}}>{inv.address}</div>
          {inv.city&&<div style={{fontSize:10,color:MUTED,marginTop:2}}>{inv.city}</div>}
        </div>
      </div>

      {/* Line items */}
      <div style={{padding:"0 24px 8px"}}>
        {/* Table header */}
        <div style={{display:"grid",gridTemplateColumns:"1.2fr 2.2fr 0.5fr 1fr 1fr",background:NAVY,borderRadius:4,padding:"7px 10px",marginBottom:2,gap:6}}>
          {["ITEMS","DESCRIPTION","QTY","PRICE","AMOUNT"].map((h,i)=>(
            <div key={h} style={{fontSize:8,fontWeight:700,color:"#94a3b8",textAlign:i>=4?"right":"left"}}>{h}</div>
          ))}
        </div>

        {inv.lineItems&&inv.lineItems.length>0 ? inv.lineItems.map((it,i)=>(
          <div key={i} style={{display:"grid",gridTemplateColumns:"1.2fr 2.2fr 0.5fr 1fr 1fr",padding:"8px 10px",background:i%2===0?"#fff":"#f0f7ff",borderBottom:`1px solid ${GMED}`,gap:6,alignItems:"center"}}>
            <div style={{fontSize:10,fontWeight:700,color:DARK}}>{it.itemLabel||it.item||it.desc}</div>
            <div style={{fontSize:10,color:MUTED,lineHeight:1.3}}>{it.detail}</div>
            <div style={{fontSize:10,color:MUTED}}>{it.displayQty}</div>
            <div style={{fontSize:10,color:MUTED}}>{fmt(it.unitPrice??it.price)}</div>
            <div style={{fontSize:10,fontWeight:700,color:DARK,textAlign:"right"}}>{fmt(it.amount)}</div>
          </div>
        )) : (
          <div style={{padding:"16px 10px",textAlign:"center",color:MUTED,fontSize:12}}>No line items</div>
        )}

        {/* Notes */}
        {inv.notes&&(
          <div style={{padding:"10px 10px 0",borderTop:`1px solid ${GMED}`,marginTop:2}}>
            <span style={{fontSize:9,fontWeight:700,color:MUTED,letterSpacing:"0.08em"}}>NOTES: </span>
            <span style={{fontSize:10,color:MUTED}}>{inv.notes}</span>
          </div>
        )}

        {/* Total Due box */}
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,marginBottom:8}}>
          <div style={{background:NAVY,borderRadius:6,padding:"10px 16px",display:"flex",gap:32,alignItems:"center",minWidth:220}}>
            <span style={{fontSize:11,fontWeight:700,color:"#fff"}}>TOTAL DUE</span>
            <span style={{fontSize:15,fontWeight:800,color:ACLTT}}>{fmt(inv.amount)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{background:GLT,borderTop:`2px solid ${ACLTT}`,padding:"12px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:10,color:MUTED}}>Thank you for your business. Please remit payment upon receipt.</div>
          <div style={{fontSize:10,color:MUTED,marginTop:2}}>jcrflooringllc@gmail.com · JCR Flooring LLC · Wichita, KS 67204</div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div style={{height:4,background:ACC}}/>
    </div>
  );
}

// ─── CONFIRM MODAL ───────────────────────────────────────────────────────────

function ConfirmModal({title,message,onConfirm,onCancel,confirmLabel="Confirm",danger=false}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:999,padding:"0 0 20px"}}>
      <div style={{background:"#12151f",borderRadius:20,padding:24,width:"100%",maxWidth:430,border:"1px solid #1c2035"}}>
        <div style={{fontSize:16,fontWeight:700,color:"#e8eaf0",marginBottom:8}}>{title}</div>
        <div style={{fontSize:13,color:"#9ca3bc",marginBottom:20,lineHeight:1.5}}>{message}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button onClick={onCancel} style={{padding:13,background:"#1c2035",color:"#9ca3bc",borderRadius:12,border:"none",fontSize:14,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={onConfirm} style={{padding:13,background:danger?"#ef4444":"#f0b429",color:danger?"#fff":"#0a0c12",borderRadius:12,border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────

function HomeScreen({builders,invoices,paid,setScreen,setTBld}) {
  const w = useWindowWidth();
  const isTablet = w >= 768;
  const isDesktop = w >= 1024;
  const grand = invoices.reduce((s,i)=>s+i.amount,0);
  const now = new Date();
  const thisMonth = `${now.getMonth()+1}/${now.getFullYear()}`;
  const monthPaid = paid.filter(i=>{ const [m,,y]=i.datePaid.split("/"); return `${m}/20${y}`===`${now.getMonth()+1}/${now.getFullYear()}`; }).reduce((s,i)=>s+i.amount,0);
  const yearPaid  = paid.filter(i=>{ const [,,y]=i.datePaid.split("/"); return `20${y}`===String(now.getFullYear()); }).reduce((s,i)=>s+i.amount,0);
  const overdueCount = invoices.filter(i=>ageDays(i.date)>14).length;

  return (
    <div style={{paddingBottom:16}}>
      <div style={{...S.hdr,paddingBottom:24}}>
        <div style={S.eye}>JCR FLOORING LLC</div>
        <div style={{fontSize:13,color:"#4a5170",marginBottom:8}}>Outstanding Balance</div>
        <div style={{fontSize:48,fontWeight:800,color:"#fff",letterSpacing:"-0.03em",lineHeight:1}}>{fmt(grand)}</div>
        <div style={{fontSize:12,color:"#4a5170",marginTop:6}}>{invoices.length} active · {overdueCount>0&&<span style={{color:"#ef4444",fontWeight:700}}>{overdueCount} overdue</span>}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16}}>
          <div style={{background:"#10b98115",borderRadius:12,padding:"12px 14px",border:"1px solid #10b98130"}}>
            <div style={{fontSize:10,fontWeight:700,color:"#10b981",letterSpacing:"0.1em",marginBottom:4}}>THIS MONTH</div>
            <div style={{fontSize:18,fontWeight:800,color:"#10b981"}}>{fmt(monthPaid)}</div>
            <div style={{fontSize:10,color:"#4a5170",marginTop:2}}>collected</div>
          </div>
          <div style={{background:"#3b82f615",borderRadius:12,padding:"12px 14px",border:"1px solid #3b82f630"}}>
            <div style={{fontSize:10,fontWeight:700,color:"#3b82f6",letterSpacing:"0.1em",marginBottom:4}}>THIS YEAR</div>
            <div style={{fontSize:18,fontWeight:800,color:"#3b82f6"}}>{fmt(yearPaid)}</div>
            <div style={{fontSize:10,color:"#4a5170",marginTop:2}}>collected</div>
          </div>
        </div>
      </div>
      <div style={{padding:"0 16px"}}>
        <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:12}}>BUILDERS</div>
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":isTablet?"1fr 1fr":"1fr",gap:10}}>
        {builders.map(b=>{
          const total=invoices.filter(i=>i.builder===b.id).reduce((s,i)=>s+i.amount,0);
          const cnt=invoices.filter(i=>i.builder===b.id).length;
          const overdue=invoices.filter(i=>i.builder===b.id&&ageDays(i.date)>14).length;
          return (
            <div key={b.id} style={{...S.card,marginBottom:0,cursor:"pointer"}} onClick={()=>{setTBld(b.id);setScreen("tracker");}}>
              <div style={{...S.cp,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:40,height:40,borderRadius:10,background:b.color+"18",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:10,fontWeight:800,color:b.color}}>{b.prefix}</span>
                  </div>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{b.name}</div>
                    <div style={{display:"flex",gap:6,marginTop:3,alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#4a5170"}}>{cnt} invoice{cnt!==1?"s":""}</span>
                      {overdue>0&&<span style={{...S.tag("#ef4444","#ef444415")}}>{overdue} overdue</span>}
                    </div>
                  </div>
                </div>
                <div style={{fontSize:16,fontWeight:700,color:total>0?"#f0b429":"#2a2f45"}}>{fmt(total)}</div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

// ─── CREATE INVOICE SCREEN ────────────────────────────────────────────────────

function CreateScreen({builders,setScreen,builderNums,floorPlans,prices,toast,duplicateFrom,onInvoiceCreated,onSendInvoice,streetHistory}) {
  // Parse existing address into unit + street for duplicateFrom
  const _parseAddr=addr=>{const main=(addr||"").split(" · ")[0].trim();const sp=main.indexOf(" ");return sp===-1?{unit:"",street:main}:{unit:main.slice(0,sp),street:main.slice(sp+1)};};
  const _initAddr=_parseAddr(duplicateFrom?.address||"");

  const [step,setStep]=useState(1);
  const [bId,setBId]=useState(duplicateFrom?.builder||null);
  const [mode,setMode]=useState("lines");
  const [selPlan,setSelPlan]=useState(null);
  const [unitNum,setUnitNum]=useState(_initAddr.unit);
  const [streetName,setStreetName]=useState(_initAddr.street);
  const [streetOpen,setStreetOpen]=useState(false);
  const [city,setCity]=useState(duplicateFrom?.city||"");
  const [jobType,setJobType]=useState(duplicateFrom?.jobType||"duplex");
  const [invDate,setInvDate]=useState(todayStr());
  const [items,setItems]=useState(duplicateFrom?.lineItems?.length>0?duplicateFrom.lineItems.map(i=>({...i,id:Date.now()+Math.random()})):[blankItem(prices)]);
  const [notes,setNotes]=useState(duplicateFrom?.notes||"");
  const [receipts,setReceipts]=useState([]);
  const [bundle,setBundle]=useState([]); // [{invoice, builder, builderId, num, formState}]
  const [confirm,setConfirm]=useState(false);
  const [sending,setSending]=useState(false);

  const builder=builders.find(b=>b.id===bId);
  const plans=(bId&&floorPlans[bId])||[];
  const mult=jobType==="duplex"?2:1;

  const resolveItem=i=>{
    const preset=LINE_ITEM_PRESETS.find(p=>p.desc===i.desc);
    const isFl=i.flat??preset?.flat??false;
    const baseQty=isFl?1:parseFloat(i.qty||0);
    const dq=isFl?1:mult;
    const amt=baseQty*parseFloat(i.price||0)*(isFl?1:mult);
    const autoD=i.autoDetail||preset?.autoDetail;
    const detail=autoD?(isFl?autoD():autoD(baseQty)):(i.detail||"");
    const unitPrice=isFl?parseFloat(i.price||0):baseQty*parseFloat(i.price||0);
    const itemLabel=preset?.item||i.item||i.desc;
    return {...i,displayQty:dq,amount:amt,detail,itemLabel,unitPrice};
  };

  const resolvedItems=()=>{
    if(mode==="plan"&&selPlan){
      const base=selPlan.items.map(i=>{
        const preset=LINE_ITEM_PRESETS.find(p=>p.desc===i.desc);
        const isFl=preset?.flat||false;
        const dq=isFl?1:mult;
        const amt=i.qty*i.price*(isFl?1:mult);
        const unitPrice=isFl?i.price:i.qty*i.price;
        const autoD=preset?.autoDetail;
        const detail=autoD?(isFl?autoD():autoD(i.qty)):(i.detail||"");
        return {...i,displayQty:dq,amount:amt,unitPrice,detail,itemLabel:preset?.item||i.desc};
      });
      const extras=items.filter(i=>i.desc&&(i.qty||i.flat)).map(resolveItem);
      return [...base,...extras];
    }
    return items.filter(i=>i.desc&&(i.qty||i.flat)).map(resolveItem);
  };

  const total=resolvedItems().reduce((s,i)=>s+i.amount,0);
  const addItem=()=>setItems([...items,blankItem(prices)]);
  const delItem=id=>setItems(items.filter(i=>i.id!==id));
  const updItem=(id,f,v)=>setItems(items.map(it=>{
    if(it.id!==id)return it;
    if(f==="desc"){const p=LINE_ITEM_PRESETS.find(p=>p.desc===v);return p?{...it,desc:v,item:p.item,unit:p.unit,price:prices[p.desc]??p.price,flat:p.flat,autoDetail:p.autoDetail,qtyLabel:p.qtyLabel,qty:"",priceOverridden:false}:it;}
    if(f==="price")return{...it,price:v,priceOverridden:true};
    return{...it,[f]:v};
  }));

  const generate=()=>{
    const b=builder;
    const sameBIdCount=bundle.filter(x=>x.builderId===b.id).length;
    const newN=(builderNums[b.id]??0)+sameBIdCount+1;
    const invNum=`${b.prefix}${String(newN).padStart(3,"0")}`;
    const ri=resolvedItems();
    const fullAddr=[unitNum.trim(),streetName.trim()].filter(Boolean).join(" ");
    const inv={id:Date.now()+Math.random(),builder:b.id,invoiceNum:invNum,address:fullAddr+(city?" · "+city:""),city,jobType,amount:total,date:invDate,lineItems:ri,notes,receipts,floorPlan:selPlan?.name||null};
    setBundle(prev=>[...prev,{invoice:inv,builder:b,builderId:b.id,num:newN,formState:{unitNum,streetName,city,jobType,invDate,items,notes,selPlan,mode}}]);
    setStep(4);
  };

  const reset=()=>{setStep(1);setBId(null);setMode("lines");setSelPlan(null);setUnitNum("");setStreetName("");setCity("");setJobType("duplex");setInvDate(todayStr());setItems([blankItem(prices)]);setNotes("");setReceipts([]);setBundle([]);setConfirm(false);};

  const addAnother=()=>{
    const lastBId=bundle[bundle.length-1]?.builderId||null;
    setBId(lastBId);
    setMode("lines");setSelPlan(null);
    setUnitNum("");setStreetName("");setCity("");
    setJobType("duplex");setInvDate(todayStr());
    setItems([blankItem(prices)]);setNotes("");setReceipts([]);
    setStep(1);
  };

  // STEP 4 — Bundle Preview
  if(step===4&&bundle.length>0){
    const mainBuilder=bundle[0].builder;
    const subject=bundle.map(b=>b.invoice.invoiceNum).join(" + ");
    const bundleTotal=bundle.reduce((s,b)=>s+b.invoice.amount,0);

    const handleBackEdit=()=>{
      const last=bundle[bundle.length-1];
      if(last?.formState){
        const fs=last.formState;
        setUnitNum(fs.unitNum);setStreetName(fs.streetName);setCity(fs.city);
        setJobType(fs.jobType);setInvDate(fs.invDate);setItems(fs.items);
        setNotes(fs.notes);setSelPlan(fs.selPlan);setMode(fs.mode);
      }
      setBundle(prev=>prev.slice(0,-1));
      setStep(3);
    };

    return (
      <div style={{paddingBottom:16}}>
        {confirm&&(
          <ConfirmModal
            title={bundle.length===1?`Send Invoice ${subject}?`:`Send ${bundle.length} Invoices?`}
            message={`Email to ${mainBuilder.email}. Subject: ${subject}`}
            confirmLabel="Send"
            onConfirm={async()=>{
              setConfirm(false);setSending(true);
              try {
                for(const item of bundle){
                  await onInvoiceCreated(item.invoice,item.builderId,item.num);
                }
                await onSendInvoice(bundle.map(b=>b.invoice),mainBuilder);
                toast(`✓ ${subject} sent to ${mainBuilder.email}`);
                reset();
              } catch(e){
                toast(`Failed to send — ${e.message}`);
              } finally {setSending(false);}
            }}
            onCancel={()=>setConfirm(false)}
          />
        )}
        <div style={{...S.hdr,paddingBottom:20}}>
          <button style={S.btnBk} onClick={handleBackEdit}>← Back & Edit</button>
          <div style={{fontSize:11,fontWeight:700,color:"#10b981",letterSpacing:"0.15em",marginBottom:6}}>
            {bundle.length===1?"✓ INVOICE READY":`✓ ${bundle.length} INVOICES BUNDLED`}
          </div>
          <div style={S.ttl}>{bundle.length===1?"Preview":"Bundle Preview"}</div>
          {bundle.length>1&&<div style={{fontSize:12,color:"#4a5170",marginTop:4}}>Combined total: {fmt(bundleTotal)}</div>}
        </div>
        <div style={{padding:"0 16px"}}>
          {bundle.map((item,idx)=>(
            <div key={item.invoice.id} style={{position:"relative",marginBottom:12}}>
              <InvoiceCard inv={item.invoice} builder={item.builder}/>
              {bundle.length>1&&(
                <button onClick={()=>setBundle(prev=>prev.filter((_,i)=>i!==idx))} style={{position:"absolute",top:8,right:8,background:"#ef444418",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,fontSize:11,fontWeight:600,padding:"3px 10px",cursor:"pointer"}}>Remove</button>
              )}
            </div>
          ))}
          {bundle.length>1&&(
            <div style={{...S.card,border:"1px solid #f0b42930",marginBottom:12}}>
              <div style={{...S.cp,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#9ca3bc"}}>BUNDLE TOTAL ({bundle.length} invoices)</div>
                <div style={{fontSize:22,fontWeight:800,color:"#f0b429"}}>{fmt(bundleTotal)}</div>
              </div>
            </div>
          )}
          <button onClick={()=>!sending&&setConfirm(true)} style={{...S.btnP,background:sending?"#0d8a5e":"#10b981",color:"#fff",marginBottom:10,opacity:sending?0.8:1,cursor:sending?"default":"pointer"}}>
            {sending?"Sending…":`📧 Send ${subject} — ${fmt(bundleTotal)}`}
          </button>
          <div style={{fontSize:11,color:"#4a5170",textAlign:"center",marginBottom:12}}>To: {mainBuilder.email}</div>
          <button onClick={addAnother} style={{...S.btnS,marginBottom:10,border:"1px solid #f0b42944",color:"#f0b429"}}>+ Add Another Invoice</button>
          <button onClick={()=>setScreen("tracker")} style={{...S.btnS,marginBottom:10}}>View in Tracker</button>
          <button onClick={reset} style={S.btnS}>Create Another Invoice</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}>
        {step>1&&<button style={S.btnBk} onClick={()=>setStep(step-1)}>← Back</button>}
        <div style={S.eye}>NEW INVOICE — STEP {step} OF 3</div>
        <div style={S.ttl}>{step===1?"Select Builder":step===2?"Job Details":"Line Items"}</div>
      </div>
      <div style={{padding:"0 16px"}}>

        {/* STEP 1 */}
        {step===1&&(
          <>
            {builders.map(b=>(
              <div key={b.id} onClick={()=>setBId(b.id)} style={{...S.card,border:`1px solid ${bId===b.id?b.color:"#1c2035"}`,background:bId===b.id?b.color+"12":"#12151f",cursor:"pointer"}}>
                <div style={{...S.cp,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{b.name}</div>
                    <div style={{fontSize:11,color:"#4a5170",marginTop:2}}>{b.company}</div>
                  </div>
                  {bId===b.id&&<span style={{color:b.color,fontSize:18,fontWeight:700}}>✓</span>}
                </div>
              </div>
            ))}
            <button onClick={()=>bId&&setStep(2)} style={{...S.btnP,opacity:bId?1:0.35,marginTop:8}}>Continue →</button>
          </>
        )}

        {/* STEP 2 */}
        {step===2&&builder&&(
          <>
            <div style={S.card}><div style={S.cp}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div><div style={S.lbl}>BUILDER</div><div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{builder.name}</div><div style={{fontSize:11,color:"#4a5170"}}>{builder.company}</div></div>
                <div style={{textAlign:"right"}}><div style={S.lbl}>INVOICE #</div><div style={{fontSize:16,fontWeight:700,color:builder.color,fontFamily:"monospace"}}>{nextNum(builder,builderNums)}</div></div>
              </div>
            </div></div>

            <div style={S.card}><div style={S.cp}>
              <div style={S.lbl}>JOB SITE</div>
              <div style={{marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,color:"#4a5170",letterSpacing:"0.1em",marginBottom:4}}>UNIT / BUILDING #</div>
                <input value={unitNum} onChange={e=>setUnitNum(e.target.value)} placeholder="e.g. 2417/19" style={S.inp}/>
              </div>
              <div style={{position:"relative",marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,color:"#4a5170",letterSpacing:"0.1em",marginBottom:4}}>STREET NAME</div>
                <input value={streetName} onChange={e=>{setStreetName(e.target.value);setStreetOpen(true);}} onFocus={()=>setStreetOpen(true)} onBlur={()=>setTimeout(()=>setStreetOpen(false),150)} placeholder="e.g. Newton St" style={S.inp}/>
                {streetOpen&&streetName.length>0&&(streetHistory||[]).filter(s=>s.street.toLowerCase().includes(streetName.toLowerCase())).slice(0,8).length>0&&(
                  <div style={{position:"absolute",top:"100%",left:0,right:0,background:"#12151f",border:"1px solid #1c2035",borderRadius:10,zIndex:50,maxHeight:180,overflowY:"auto",marginTop:2}}>
                    {(streetHistory||[]).filter(s=>s.street.toLowerCase().includes(streetName.toLowerCase())).slice(0,8).map((s,i,arr)=>(
                      <div key={i} onMouseDown={e=>{e.preventDefault();setStreetName(s.street);setCity(s.city);setStreetOpen(false);}} style={{padding:"10px 14px",cursor:"pointer",borderBottom:i<arr.length-1?"1px solid #1c2035":"none"}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#e8eaf0"}}>{s.street}</div>
                        <div style={{fontSize:11,color:"#4a5170",marginTop:1}}>{s.city}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div style={{fontSize:9,fontWeight:700,color:"#4a5170",letterSpacing:"0.1em",marginBottom:4}}>CITY, STATE ZIP</div>
                <input value={city} onChange={e=>setCity(e.target.value)} placeholder="e.g. Newton, KS 67114" style={S.inp}/>
              </div>
            </div></div>

            <div style={S.card}><div style={S.cp}>
              <div style={S.lbl}>JOB TYPE</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["duplex","Duplex (×2)","Quantities doubled"],["house","House (×1)","Quantities as entered"]].map(([t,label,sub])=>(
                  <div key={t} onClick={()=>setJobType(t)} style={{padding:"12px",borderRadius:10,border:`1px solid ${jobType===t?"#f0b429":"#1c2035"}`,background:jobType===t?"#f0b42912":"#0a0c12",cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:13,fontWeight:700,color:jobType===t?"#f0b429":"#9ca3bc"}}>{label}</div>
                    <div style={{fontSize:10,color:jobType===t?"#f0b42988":"#4a5170",marginTop:2}}>{sub}</div>
                  </div>
                ))}
              </div>
            </div></div>

            <div style={S.card}><div style={S.cp}>
              <div style={S.lbl}>DATE</div>
              <input value={invDate} onChange={e=>setInvDate(e.target.value)} style={S.inp}/>
            </div></div>

            <div style={S.card}><div style={S.cp}>
              <div style={S.lbl}>INVOICE MODE</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[["lines","Line Items Only"],["plan","Use Floor Plan"]].map(([m,label])=>(
                  <div key={m} onClick={()=>{setMode(m);if(m==="lines")setSelPlan(null);}} style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${mode===m?"#f0b429":"#1c2035"}`,background:mode===m?"#f0b42912":"#0a0c12",cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:12,fontWeight:600,color:mode===m?"#f0b429":"#9ca3bc"}}>{label}</div>
                  </div>
                ))}
              </div>
            </div></div>

            {mode==="plan"&&(
              <div style={S.card}><div style={S.cp}>
                <div style={S.lbl}>FLOOR PLAN</div>
                {plans.length===0?(
                  <div style={{fontSize:13,color:"#4a5170",textAlign:"center",padding:"12px 0"}}>No floor plans for {builder.name} yet. Add them in Settings.</div>
                ):plans.map(p=>(
                  <div key={p.id} onClick={()=>setSelPlan(p)} style={{borderRadius:10,border:`1px solid ${selPlan?.id===p.id?"#f0b429":"#1c2035"}`,background:selPlan?.id===p.id?"#f0b42912":"#0a0c12",padding:"10px 14px",marginBottom:8,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"#e8eaf0"}}>{p.name}</div>
                      <div style={{fontSize:11,color:"#4a5170",marginTop:2}}>{p.items.length} items · {p.type}</div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={S.tag(p.type==="duplex"?"#3b82f6":"#10b981",p.type==="duplex"?"#3b82f615":"#10b98115")}>{p.type.toUpperCase()}</span>
                      {selPlan?.id===p.id&&<span style={{color:"#f0b429"}}>✓</span>}
                    </div>
                  </div>
                ))}
                {selPlan&&(
                  <div style={{marginTop:4,padding:"10px 12px",background:"#0a0c12",borderRadius:10,border:"1px solid #1c2035"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#4a5170",marginBottom:8}}>PREVIEW ({jobType==="duplex"?"×2 DUPLEX":"×1 HOUSE"})</div>
                    {selPlan.items.map((it,i)=>{
                      const preset=LINE_ITEM_PRESETS.find(p=>p.desc===it.desc);
                      const isFl=preset?.flat||false;
                      const autoD=preset?.autoDetail;
                      const detail=autoD?(isFl?autoD():autoD(it.qty)):"";
                      const amt=it.qty*it.price*(isFl?1:mult);
                      return (
                        <div key={i} style={{padding:"5px 0",borderBottom:i<selPlan.items.length-1?"1px solid #1c2035":"none"}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <div style={{fontSize:11,fontWeight:600,color:"#c8cce0"}}>{preset?.item||it.desc}</div>
                            <div style={{fontSize:11,fontWeight:700,color:"#f0b429"}}>{fmt(amt)}</div>
                          </div>
                          {detail&&<div style={{fontSize:10,color:"#4a5170",marginTop:1}}>{detail} × {isFl?1:mult}</div>}
                        </div>
                      );
                    })}
                    <div style={{...S.div,marginTop:8}}/>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#9ca3bc"}}>Plan Total</span>
                      <span style={{fontSize:13,fontWeight:800,color:"#f0b429"}}>{fmt(selPlan.items.reduce((s,i)=>{const p=LINE_ITEM_PRESETS.find(p=>p.desc===i.desc);return s+i.qty*i.price*(p?.flat?1:mult);},0))}</span>
                    </div>
                  </div>
                )}
              </div></div>
            )}

            <button onClick={()=>{if(!streetName||!city)return;if(mode==="plan"&&!selPlan)return;setStep(3);}} style={{...S.btnP,opacity:(streetName&&city&&(mode==="lines"||selPlan))?1:0.35}}>
              {mode==="plan"?"Add One-Offs & Review →":"Add Line Items →"}
            </button>
          </>
        )}

        {/* STEP 3 */}
        {step===3&&(
          <>
            {mode==="plan"&&selPlan&&(
              <div style={S.card}><div style={S.cp}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                  <div style={S.lbl}>FROM FLOOR PLAN: {selPlan.name.toUpperCase()}</div>
                  <span style={S.tag(mult===2?"#3b82f6":"#10b981",mult===2?"#3b82f615":"#10b98115")}>{mult===2?"DUPLEX ×2":"HOUSE ×1"}</span>
                </div>
                {selPlan.items.map((it,i)=>{
                  const preset=LINE_ITEM_PRESETS.find(p=>p.desc===it.desc);
                  const isFl=preset?.flat||false;
                  const autoD=preset?.autoDetail;
                  const detail=autoD?(isFl?autoD():autoD(it.qty)):"";
                  const dq=isFl?1:mult;
                  const amt=it.qty*it.price*(isFl?1:mult);
                  const unitPrice=isFl?it.price:it.qty*it.price;
                  return (
                    <div key={i} style={{padding:"6px 0",borderBottom:i<selPlan.items.length-1?"1px solid #1c2035":"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#c8cce0"}}>{preset?.item||it.desc}</div>
                        <div style={{fontSize:12,fontWeight:700,color:"#e8eaf0"}}>{fmt(amt)}</div>
                      </div>
                      <div style={{fontSize:10,color:"#4a5170",marginTop:2}}>{detail} · qty {dq} · {fmt(unitPrice)}/unit</div>
                    </div>
                  );
                })}
              </div></div>
            )}

            {items.map(item=>{
              const isFlatItem=item.flat??false;
              const baseQty=parseFloat(item.qty||0);
              const amount=isFlatItem?parseFloat(item.price||0):baseQty*parseFloat(item.price||0)*mult;
              const autoDesc=item.autoDetail?(isFlatItem?item.autoDetail():item.qty?item.autoDetail(item.qty):item.autoDetail("...")):"";
              return (
                <div key={item.id} style={S.card}><div style={S.cp}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div style={S.lbl}>{mode==="plan"?"ONE-OFF ITEM":"LINE ITEM"}</div>
                    {items.length>1&&<button onClick={()=>delItem(item.id)} style={{background:"none",border:"none",color:"#4a5170",fontSize:15,cursor:"pointer"}}>✕</button>}
                  </div>
                  <select value={item.desc} onChange={e=>updItem(item.id,"desc",e.target.value)} style={{...S.sel,marginBottom:8}}>
                    {LINE_ITEM_PRESETS.map(p=><option key={p.desc} value={p.desc}>{p.desc}</option>)}
                  </select>
                  {autoDesc&&<div style={{background:"#0a0c12",border:"1px solid #1c2035",borderRadius:10,padding:"8px 12px",marginBottom:8,fontSize:12,color:"#4a5170"}}>{autoDesc}{!isFlatItem&&mult===2&&" (×2 duplex)"}</div>}
                  {!isFlatItem&&(
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div>
                          <div style={{...S.lbl,fontSize:9}}>{item.qtyLabel||"QTY"}</div>
                          <input type="number" value={item.qty} onChange={e=>updItem(item.id,"qty",e.target.value)} placeholder="0" style={S.inp}/>
                        </div>
                        <div>
                          <div style={{...S.lbl,fontSize:9}}>AMOUNT</div>
                          <div style={{...S.inp,color:"#f0b429",fontWeight:700,display:"flex",alignItems:"center"}}>{fmt(amount)}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{fontSize:11,color:"#4a5170"}}>Rate: ${item.price}/{item.unit}</div>
                        {!item.priceOverridden
                          ?<button onClick={()=>updItem(item.id,"priceOverridden",true)} style={{background:"none",border:"1px solid #1c2035",color:"#9ca3bc",fontSize:11,padding:"3px 10px",borderRadius:8,cursor:"pointer"}}>Override Rate</button>
                          :<div style={{display:"flex",gap:6,alignItems:"center"}}>
                            <input type="number" value={item.price} onChange={e=>updItem(item.id,"price",e.target.value)} style={{...S.inp,width:80,fontSize:12}}/>
                            <button onClick={()=>{const p=LINE_ITEM_PRESETS.find(p=>p.desc===item.desc);setItems(prev=>prev.map(it=>it.id===item.id?{...it,price:prices[item.desc]??p?.price??0,priceOverridden:false}:it));}} style={{background:"none",border:"1px solid #ef444430",color:"#ef4444",fontSize:11,padding:"3px 8px",borderRadius:8,cursor:"pointer"}}>Reset</button>
                          </div>
                        }
                      </div>
                    </div>
                  )}
                  {isFlatItem&&(
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0"}}>
                      {!item.priceOverridden
                        ?<><div style={{fontSize:14,fontWeight:700,color:"#f0b429"}}>{fmt(item.price)}</div><button onClick={()=>updItem(item.id,"price",item.price)} style={{background:"none",border:"1px solid #1c2035",color:"#9ca3bc",fontSize:11,padding:"3px 10px",borderRadius:8,cursor:"pointer"}}>Override</button></>
                        :<><input type="number" value={item.price} onChange={e=>updItem(item.id,"price",e.target.value)} style={{...S.inp,width:90,fontSize:12}}/><button onClick={()=>{const p=LINE_ITEM_PRESETS.find(p=>p.desc===item.desc);setItems(prev=>prev.map(it=>it.id===item.id?{...it,price:prices[item.desc]??p?.price??0,priceOverridden:false}:it));}} style={{background:"none",border:"1px solid #ef444430",color:"#ef4444",fontSize:11,padding:"3px 8px",borderRadius:8,cursor:"pointer"}}>Reset</button></>
                      }
                    </div>
                  )}
                </div></div>
              );
            })}

            <button onClick={addItem} style={{width:"100%",padding:13,background:"none",color:"#f0b429",borderRadius:12,border:"1px dashed #f0b42944",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:12}}>
              + Add {mode==="plan"?"One-Off":"Line"} Item
            </button>

            <div style={S.card}><div style={S.cp}>
              <div style={S.lbl}>NOTES (optional)</div>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any special instructions..." rows={2} style={{...S.inp,resize:"none",lineHeight:1.5}}/>
            </div></div>

            <div style={S.card}><div style={S.cp}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={S.lbl}>ATTACH RECEIPTS (optional)</div>
                <span style={{fontSize:10,color:"#4a5170"}}>{receipts.length} attached</span>
              </div>
              {receipts.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
                  {receipts.map((r,i)=>(
                    <div key={i} style={{position:"relative",width:72,height:72}}>
                      <img src={r.url} alt="receipt" style={{width:72,height:72,objectFit:"cover",borderRadius:8,border:"1px solid #1c2035"}}/>
                      <button onClick={()=>setReceipts(prev=>prev.filter((_,j)=>j!==i))}
                        style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:"#ef4444",border:"none",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>â</button>
                      <div style={{fontSize:9,color:"#4a5170",marginTop:3,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:72}}>{r.name}</div>
                    </div>
                  ))}
                </div>
              )}
              <label style={{display:"block",width:"100%",padding:12,background:"none",color:"#f0b429",borderRadius:10,border:"1px dashed #f0b42944",fontSize:13,fontWeight:600,cursor:"pointer",textAlign:"center",boxSizing:"border-box"}}>
                ð Add Receipt Image
                <input type="file" accept="image/*" multiple style={{display:"none"}}
                  onChange={e=>{
                    const files=Array.from(e.target.files);
                    files.forEach(file=>{
                      const url=URL.createObjectURL(file);
                      setReceipts(prev=>[...prev,{name:file.name,url,file}]);
                    });
                    e.target.value="";
                  }}/>
              </label>
              {receipts.length>0&&<div style={{fontSize:10,color:"#4a5170",textAlign:"center",marginTop:6}}>Receipt images will be attached to the email</div>}
            </div></div>

            <div style={{...S.card,border:"1px solid #f0b42930"}}><div style={{...S.cp,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#9ca3bc"}}>INVOICE TOTAL</div>
                <div style={{fontSize:11,color:"#4a5170",marginTop:2}}>{jobType==="duplex"?"Duplex — quantities ×2":"House — quantities ×1"}</div>
              </div>
              <div style={{fontSize:28,fontWeight:800,color:"#f0b429"}}>{fmt(total)}</div>
            </div></div>

            <button onClick={generate} style={{...S.btnP,opacity:total>0?1:0.35}}>Generate Invoice ✓</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── TRACKER SCREEN ───────────────────────────────────────────────────────────

function TrackerScreen({builders,invoices,setScreen,tBld,setTBld,onDuplicate,onViewInvoice,onMarkPaid,onDeleteInvoice,onSaveManualInvoice}) {
  const w = useWindowWidth();
  const isTablet = w >= 768;
  const isDesktop = w >= 1024;
  const [confirmPay,setConfirmPay]=useState(null);
  const [confirmDelete,setConfirmDelete]=useState(null);
  const [showManual,setShowManual]=useState(false);
  const [manualForm,setManualForm]=useState({builderId:"",invoiceNum:"",address:"",city:"",date:todayStr(),jobType:"duplex",amount:"",notes:"",status:"active",datePaid:todayStr()});
  const [manualSaving,setManualSaving]=useState(false);
  const displayed=tBld?invoices.filter(i=>i.builder===tBld):invoices;
  const activeB=tBld?builders.find(b=>b.id===tBld):null;

  if(showManual){
    const saveManual=async()=>{
      if(!manualForm.builderId||!manualForm.invoiceNum||!manualForm.address||!manualForm.amount)return;
      setManualSaving(true);
      try{
        await onSaveManualInvoice(manualForm);
        setShowManual(false);
        setManualForm({builderId:"",invoiceNum:"",address:"",city:"",date:todayStr(),jobType:"duplex",amount:"",notes:"",status:"active",datePaid:todayStr()});
      }finally{setManualSaving(false);}
    };
    return (
      <div style={{paddingBottom:16}}>
        <div style={S.hdr}>
          <button style={S.btnBk} onClick={()=>setShowManual(false)}>← Back</button>
          <div style={S.eye}>TRACKER</div>
          <div style={S.ttl}>Log Manual Invoice</div>
          <div style={{fontSize:12,color:"#4a5170",marginTop:4}}>Record an invoice not created in the app</div>
        </div>
        <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:12}}>
          <div style={S.card}><div style={S.cp}>
            <div style={S.lbl}>BUILDER</div>
            <select value={manualForm.builderId} onChange={e=>setManualForm(p=>({...p,builderId:e.target.value,invoiceNum:""}))} style={S.sel}>
              <option value="">Select builder...</option>
              {builders.map(b=><option key={b.id} value={b.id}>{b.name} ({b.prefix})</option>)}
            </select>
          </div></div>
          <div style={S.card}><div style={S.cp}>
            <div style={S.lbl}>INVOICE NUMBER</div>
            <input value={manualForm.invoiceNum} onChange={e=>setManualForm(p=>({...p,invoiceNum:e.target.value.toUpperCase()}))} placeholder={manualForm.builderId?(()=>{const b=builders.find(b=>b.id===manualForm.builderId);return b?`e.g. ${b.prefix}023`:""})():""} style={S.inp}/>
          </div></div>
          <div style={S.card}><div style={S.cp}>
            <div style={S.lbl}>ADDRESS</div>
            <input value={manualForm.address} onChange={e=>setManualForm(p=>({...p,address:e.target.value}))} placeholder="e.g. 2417/19 Newton St" style={{...S.inp,marginBottom:8}}/>
            <div style={{fontSize:9,fontWeight:700,color:"#4a5170",letterSpacing:"0.1em",marginBottom:4}}>CITY, STATE ZIP</div>
            <input value={manualForm.city} onChange={e=>setManualForm(p=>({...p,city:e.target.value}))} placeholder="e.g. Newton, KS 67114" style={S.inp}/>
          </div></div>
          <div style={S.card}><div style={S.cp}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div><div style={S.lbl}>DATE INVOICED</div><input value={manualForm.date} onChange={e=>setManualForm(p=>({...p,date:e.target.value}))} style={S.inp}/></div>
              <div><div style={S.lbl}>AMOUNT ($)</div><input type="number" value={manualForm.amount} onChange={e=>setManualForm(p=>({...p,amount:e.target.value}))} placeholder="0.00" style={S.inp}/></div>
            </div>
          </div></div>
          <div style={S.card}><div style={S.cp}>
            <div style={S.lbl}>JOB TYPE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[["duplex","Duplex"],["house","House"]].map(([t,label])=>(
                <div key={t} onClick={()=>setManualForm(p=>({...p,jobType:t}))} style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${manualForm.jobType===t?"#f0b429":"#1c2035"}`,background:manualForm.jobType===t?"#f0b42912":"#0a0c12",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:600,color:manualForm.jobType===t?"#f0b429":"#9ca3bc"}}>{label}</div>
                </div>
              ))}
            </div>
          </div></div>
          <div style={S.card}><div style={S.cp}>
            <div style={S.lbl}>STATUS</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:manualForm.status==="paid"?12:0}}>
              {[["active","Active (Outstanding)"],["paid","Paid"]].map(([s,label])=>(
                <div key={s} onClick={()=>setManualForm(p=>({...p,status:s}))} style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${manualForm.status===s?(s==="paid"?"#10b981":"#3b82f6"):"#1c2035"}`,background:manualForm.status===s?(s==="paid"?"#10b98112":"#3b82f612"):"#0a0c12",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:12,fontWeight:600,color:manualForm.status===s?(s==="paid"?"#10b981":"#3b82f6"):"#9ca3bc"}}>{label}</div>
                </div>
              ))}
            </div>
            {manualForm.status==="paid"&&(
              <><div style={{fontSize:9,fontWeight:700,color:"#4a5170",letterSpacing:"0.1em",marginBottom:4}}>DATE PAID</div>
              <input value={manualForm.datePaid} onChange={e=>setManualForm(p=>({...p,datePaid:e.target.value}))} style={S.inp}/></>
            )}
          </div></div>
          <div style={S.card}><div style={S.cp}>
            <div style={S.lbl}>NOTES (optional)</div>
            <input value={manualForm.notes} onChange={e=>setManualForm(p=>({...p,notes:e.target.value}))} placeholder="Any notes..." style={S.inp}/>
          </div></div>
          <button onClick={saveManual} disabled={manualSaving} style={{...S.btnP,opacity:(manualForm.builderId&&manualForm.invoiceNum&&manualForm.address&&manualForm.amount&&!manualSaving)?1:0.35}}>
            {manualSaving?"Saving…":"Save Invoice"}
          </button>
        </div>
      </div>
    );
  }

  const doMarkPaid=async id=>{
    const inv=invoices.find(i=>i.id===id);
    if(!inv)return;
    await onMarkPaid(inv);
    setConfirmPay(null);
  };

  const doDelete=async id=>{
    const inv=invoices.find(i=>i.id===id);
    if(!inv)return;
    await onDeleteInvoice(inv);
    setConfirmDelete(null);
  };

  return (
    <div style={{paddingBottom:16}}>
      {confirmPay&&(
        <ConfirmModal
          title="Mark as Paid?"
          message={`Move ${confirmPay.invoiceNum} (${fmt(confirmPay.amount)}) to the Paid Invoice Log?`}
          confirmLabel="Mark Paid"
          onConfirm={()=>doMarkPaid(confirmPay.id)}
          onCancel={()=>setConfirmPay(null)}
        />
      )}
      {confirmDelete&&(
        <ConfirmModal
          title="Delete Invoice?"
          message={`Delete invoice ${confirmDelete.invoiceNum}? This cannot be undone.`}
          confirmLabel="Delete"
          danger={true}
          onConfirm={()=>doDelete(confirmDelete.id)}
          onCancel={()=>setConfirmDelete(null)}
        />
      )}
      <div style={S.hdr}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={S.eye}>INVOICE TRACKER</div>
          <button onClick={()=>setShowManual(true)} style={{background:"#f0b42918",border:"1px solid #f0b42930",color:"#f0b429",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",marginTop:2}}>+ Log Manual</button>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={S.ttl}>{activeB?activeB.name:"All Builders"}</div>
          {tBld&&<button onClick={()=>setTBld(null)} style={{background:"#1c2035",border:"none",color:"#9ca3bc",fontSize:11,padding:"5px 12px",borderRadius:8,cursor:"pointer"}}>All</button>}
        </div>
        <div style={{fontSize:12,color:"#4a5170",marginTop:4}}>
          {displayed.length} invoice{displayed.length!==1?"s":""} · {fmt(displayed.reduce((s,i)=>s+i.amount,0))} outstanding
        </div>
      </div>

      {!tBld&&(
        <div style={{padding:"0 16px 12px",display:"flex",gap:8,overflowX:"auto"}}>
          {builders.filter(b=>invoices.some(i=>i.builder===b.id)).map(b=>(
            <button key={b.id} onClick={()=>setTBld(b.id)} style={{background:"#12151f",border:`1px solid ${b.color}44`,color:b.color,borderRadius:100,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{b.prefix}</button>
          ))}
        </div>
      )}

      <div style={{padding:"0 16px"}}>
        {displayed.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:"#4a5170",fontSize:14}}>No outstanding invoices</div>}
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":isTablet?"1fr 1fr":"1fr",gap:10}}>
        {displayed.map(inv=>{
          const b=builders.find(b=>b.id===inv.builder);
          const days=ageDays(inv.date);
          const overdue=days>14;
          return (
            <div key={inv.id} style={{...S.card,marginBottom:0,border:`1px solid ${overdue?"#ef444330":"#1c2035"}`}}>
              <div style={S.cp}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{fontSize:13,fontWeight:700,color:b.color,fontFamily:"monospace"}}>{inv.invoiceNum}</div>
                      {overdue&&<span style={S.tag("#ef4444","#ef444415")}>{days}d</span>}
                    </div>
                    <div style={{fontSize:12,color:"#9ca3bc",marginTop:3}}>{inv.address}</div>
                    {inv.floorPlan&&<div style={{fontSize:11,color:"#4a5170",marginTop:1}}>📐 {inv.floorPlan}</div>}
                    <div style={{fontSize:11,color:"#4a5170",marginTop:1}}>{inv.date} · {inv.jobType==="duplex"?"Duplex":"House"}</div>
                  </div>
                  <div style={{fontSize:17,fontWeight:800,color:"#f0b429"}}>{fmt(inv.amount)}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                  <button onClick={()=>onViewInvoice(inv)} style={{padding:"7px",background:"#1c2035",border:"none",color:"#9ca3bc",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>View</button>
                  <button onClick={()=>onDuplicate(inv)} style={{padding:"7px",background:"#f0b42918",border:"1px solid #f0b42930",color:"#f0b429",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Duplicate</button>
                  <button onClick={()=>setConfirmPay(inv)} style={{padding:"7px",background:"#10b98118",border:"1px solid #10b98144",color:"#10b981",borderRadius:8,fontSize:11,fontWeight:700,cursor:"pointer"}}>Mark Paid ✓</button>
                  <button onClick={()=>setConfirmDelete(inv)} style={{padding:"7px",background:"#ef444418",border:"1px solid #ef444430",color:"#ef4444",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>Delete</button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}

// ─── FINANCE SCREEN ──────────────────────────────────────────────────────────

function HistoryScreen({builders, invoices, paid, onResend}) {
  const w = useWindowWidth();
  const isTablet = w >= 768;
  const isDesktop = w >= 1024;
  const [tab, setTab] = useState("overview");
  const [selMonth, setSelMonth] = useState(null);

  const now = new Date();
  const currentYear = now.getFullYear();

  // ── helpers ──
  // All invoices sent this year — paid + active (production view)
  const allInvoiced = [
    ...paid.map(i => ({...i, isPaid:true})),
    ...invoices.map(i => ({...i, dateInvoiced:i.date, isPaid:false})),
  ];
  const paidYear = allInvoiced.filter(i => {
    const [,,y] = i.dateInvoiced.split("/");
    return parseInt("20"+y) === currentYear;
  });
  const collectedYear = paid.filter(i => {
    const [,,y] = i.dateInvoiced.split("/");
    return parseInt("20"+y) === currentYear;
  });

  const monthName = m => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1];

  // Build monthly data for all 12 months
  const monthlyData = Array.from({length:12},(_,i)=>{
    const m = i+1;
    const invoices = paidYear.filter(inv => {
      const [mo] = inv.dateInvoiced.split("/");
      return parseInt(mo) === m;
    });
    return { month:m, label:monthName(m), invoices, total:invoices.reduce((s,i)=>s+i.amount,0), count:invoices.length };
  });

  const ytd = paidYear.reduce((s,i)=>s+i.amount,0);
  const ytdCollected = collectedYear.reduce((s,i)=>s+i.amount,0);
  const maxMonth = Math.max(...monthlyData.map(m=>m.total), 1);
  const avgPerInvoice = paidYear.length ? ytd / paidYear.length : 0;

  // Builder breakdown
  const builderBreakdown = builders.map(b => {
    const bInvs = paidYear.filter(i=>i.builder===b.id);
    return { ...b, total:bInvs.reduce((s,i)=>s+i.amount,0), count:bInvs.length, avg:bInvs.length?bInvs.reduce((s,i)=>s+i.amount,0)/bInvs.length:0 };
  }).filter(b=>b.count>0).sort((a,b)=>b.total-a.total);

  const thisMonthData = monthlyData[now.getMonth()];
  const lastMonthData = monthlyData[now.getMonth()>0 ? now.getMonth()-1 : 0] || {total:0,count:0};
  const momChange = lastMonthData.total > 0 ? ((thisMonthData.total - lastMonthData.total) / lastMonthData.total * 100) : 0;

  // Selected month detail
  const monthDetail = selMonth ? monthlyData[selMonth-1] : null;

  return (
    <div style={{paddingBottom:16}}>
      {/* Header */}
      <div style={{...S.hdr, paddingBottom:20}}>
        <div style={S.eye}>FINANCE</div>
        <div style={S.ttl}>{currentYear} Overview</div>
        <div style={{display:"flex",gap:16,marginTop:12}}>
          <div style={{background:"#10b98115",borderRadius:10,padding:"10px 14px",border:"1px solid #10b98130",flex:1}}>
            <div style={{fontSize:9,fontWeight:700,color:"#10b981",letterSpacing:"0.1em",marginBottom:3}}>INVOICED</div>
            <div style={{fontSize:17,fontWeight:800,color:"#10b981"}}>{fmt(ytd)}</div>
            <div style={{fontSize:10,color:"#4a5170",marginTop:1}}>{paidYear.length} invoices sent</div>
          </div>
          <div style={{background:"#3b82f615",borderRadius:10,padding:"10px 14px",border:"1px solid #3b82f630",flex:1}}>
            <div style={{fontSize:9,fontWeight:700,color:"#3b82f6",letterSpacing:"0.1em",marginBottom:3}}>COLLECTED</div>
            <div style={{fontSize:17,fontWeight:800,color:"#3b82f6"}}>{fmt(ytdCollected)}</div>
            <div style={{fontSize:10,color:"#4a5170",marginTop:1}}>{collectedYear.length} invoices paid</div>
          </div>
        </div>
      </div>

      {/* Sub-tab nav */}
      <div style={{display:"flex",gap:0,margin:"0 16px 16px",background:"#12151f",borderRadius:12,padding:4,border:"1px solid #1c2035"}}>
        {[["overview","Overview"],["months","By Month"],["builders","By Builder"],["log","Invoice Log"]].map(([t,label])=>(
          <button key={t} onClick={()=>{setTab(t);setSelMonth(null);}}
            style={{flex:1,padding:"8px 4px",borderRadius:9,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
              background:tab===t?"#f0b429":"none",
              color:tab===t?"#0a0c12":"#4a5170",
              transition:"all 0.15s"}}>
            {label}
          </button>
        ))}
      </div>

      <div style={{padding:"0 16px"}}>

        {/* ── OVERVIEW TAB ── */}
        {tab==="overview" && (
          <>
            {/* KPI cards */}
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr 1fr":"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{background:"#10b98115",borderRadius:12,padding:"14px",border:"1px solid #10b98130"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#10b981",letterSpacing:"0.12em",marginBottom:4}}>YEAR TO DATE</div>
                <div style={{fontSize:20,fontWeight:800,color:"#10b981"}}>{fmt(ytd)}</div>
                <div style={{fontSize:10,color:"#4a5170",marginTop:2}}>{paidYear.length} invoices paid</div>
              </div>
              <div style={{background:"#3b82f615",borderRadius:12,padding:"14px",border:"1px solid #3b82f630"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#3b82f6",letterSpacing:"0.12em",marginBottom:4}}>AVG PER INVOICE</div>
                <div style={{fontSize:20,fontWeight:800,color:"#3b82f6"}}>{fmt(avgPerInvoice)}</div>
                <div style={{fontSize:10,color:"#4a5170",marginTop:2}}>across all builders</div>
              </div>
              <div style={{background:"#f0b42915",borderRadius:12,padding:"14px",border:"1px solid #f0b42930"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#f0b429",letterSpacing:"0.12em",marginBottom:4}}>THIS MONTH</div>
                <div style={{fontSize:20,fontWeight:800,color:"#f0b429"}}>{fmt(thisMonthData.total)}</div>
                <div style={{fontSize:10,color:momChange>=0?"#10b981":"#ef4444",marginTop:2,fontWeight:600}}>
                  {lastMonthData.total>0?<>{momChange>=0?"▲":"▼"} {Math.abs(momChange).toFixed(0)}% vs last month</>:<span style={{color:"#4a5170"}}>invoiced this month</span>}
                </div>
              </div>
              <div style={{background:"#8b5cf615",borderRadius:12,padding:"14px",border:"1px solid #8b5cf630"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#8b5cf6",letterSpacing:"0.12em",marginBottom:4}}>BEST MONTH</div>
                {(() => {
                  const best = monthlyData.reduce((a,b)=>b.total>a.total?b:a, monthlyData[0]);
                  return <>
                    <div style={{fontSize:20,fontWeight:800,color:"#8b5cf6"}}>{fmt(best.total)}</div>
                    <div style={{fontSize:10,color:"#4a5170",marginTop:2}}>{best.label} · {best.count} invoices</div>
                  </>;
                })()}
              </div>
            </div>

            {/* Monthly bar chart */}
            <div style={{...S.card}}><div style={{...S.cp}}>
              <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:14}}>MONTHLY REVENUE</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:4,height:100,marginBottom:8}}>
                {monthlyData.map(m => {
                  const barH = m.total > 0 ? Math.max((m.total/maxMonth)*90, 4) : 0;
                  const isCurrent = m.month === now.getMonth()+1;
                  const isSelected = selMonth === m.month;
                  return (
                    <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",cursor:m.total>0?"pointer":"default"}}
                      onClick={()=>{ if(m.total>0){setSelMonth(m.month===selMonth?null:m.month); setTab("months");} }}>
                      <div style={{width:"100%",borderRadius:"3px 3px 0 0",
                        background: isSelected?"#f0b429":isCurrent?"#3b82f6":m.total>0?"#10b981":"#1c2035",
                        height:barH,transition:"all 0.2s",minHeight:m.total>0?4:0}}/>
                    </div>
                  );
                })}
              </div>
              <div style={{display:"flex",gap:4,marginBottom:4}}>
                {monthlyData.map(m=>(
                  <div key={m.month} style={{flex:1,textAlign:"center",fontSize:8,color:m.month===now.getMonth()+1?"#3b82f6":m.total>0?"#9ca3bc":"#2a2f45",fontWeight:m.month===now.getMonth()+1?700:400}}>
                    {m.label[0]}
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:4,marginBottom:6}}>
                {monthlyData.map(m=>(
                  <div key={m.month} style={{flex:1,textAlign:"center"}}>
                    {m.total>0&&(
                      <div style={{fontSize:7,fontWeight:700,color:m.month===now.getMonth()+1?"#3b82f6":"#10b981",lineHeight:1.2}}>
                        {m.total>=1000?`${(m.total/1000).toFixed(1)}k`:fmt(m.total).replace("$","")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{fontSize:10,color:"#4a5170",textAlign:"center"}}>By invoice date · tap a bar to drill in</div>
            </div></div>

            {/* Top builders quick view */}
            <div style={{...S.card,marginTop:4}}><div style={S.cp}>
              <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:12}}>TOP BUILDERS THIS YEAR</div>
              {builderBreakdown.slice(0,3).map((b,i)=>(
                <div key={b.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:i<2?12:0}}>
                  <div style={{fontSize:13,fontWeight:800,color:"#2a2f45",width:16}}>{i+1}</div>
                  <div style={{width:32,height:32,borderRadius:8,background:b.color+"18",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:9,fontWeight:800,color:b.color}}>{b.prefix}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#e8eaf0"}}>{b.name}</div>
                    <div style={{fontSize:10,color:"#4a5170"}}>{b.count} invoices</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#10b981"}}>{fmt(b.total)}</div>
                    <div style={{width:`${(b.total/ytd)*100}%`,minWidth:4,height:3,background:b.color,borderRadius:2,marginLeft:"auto",marginTop:3}}/>
                  </div>
                </div>
              ))}
            </div></div>
          </>
        )}

        {/* ── BY MONTH TAB ── */}
        {tab==="months" && (
          <>
            {selMonth && monthDetail ? (
              <>
                <button onClick={()=>setSelMonth(null)} style={{...S.btnBk, marginBottom:12}}>← All Months</button>
                <div style={{...S.card,border:`1px solid #f0b42930`}}><div style={S.cp}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{monthName(selMonth)} {currentYear}</div>
                    <div style={{fontSize:20,fontWeight:800,color:"#f0b429"}}>{fmt(monthDetail.total)}</div>
                  </div>
                  <div style={{fontSize:12,color:"#4a5170"}}>{monthDetail.count} invoice{monthDetail.count!==1?"s":""} · avg {fmt(monthDetail.count?monthDetail.total/monthDetail.count:0)}</div>
                </div></div>

                {/* Group by builder within month */}
                {builders.filter(b=>monthDetail.invoices.some(i=>i.builder===b.id)).map(b=>{
                  const bInvs = monthDetail.invoices.filter(i=>i.builder===b.id);
                  const bTotal = bInvs.reduce((s,i)=>s+i.amount,0);
                  return (
                    <div key={b.id}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0 6px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:28,height:28,borderRadius:7,background:b.color+"18",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{fontSize:8,fontWeight:800,color:b.color}}>{b.prefix}</span>
                          </div>
                          <span style={{fontSize:13,fontWeight:600,color:"#e8eaf0"}}>{b.name}</span>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,color:"#10b981"}}>{fmt(bTotal)}</span>
                      </div>
                      {bInvs.map(inv=>(
                        <div key={inv.id} style={{...S.card,marginLeft:36}}><div style={S.cp}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:b.color,fontFamily:"monospace"}}>{inv.invoiceNum}</div>
                              <div style={{fontSize:11,color:"#9ca3bc",marginTop:1}}>{inv.address}</div>
                              <div style={{fontSize:10,color:"#4a5170",marginTop:1}}>Invoiced {inv.dateInvoiced} · Paid {inv.datePaid}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:14,fontWeight:700,color:"#10b981"}}>{fmt(inv.amount)}</div>
                              <button onClick={()=>onResend(inv)} style={{marginTop:4,background:"none",border:"1px solid #1c2035",color:"#4a5170",borderRadius:6,padding:"3px 8px",fontSize:10,cursor:"pointer"}}>Resend</button>
                            </div>
                          </div>
                        </div></div>
                      ))}
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:12}}>{currentYear} — ALL MONTHS</div>
                <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":isTablet?"1fr 1fr":"1fr",gap:10}}>
                {monthlyData.filter(m=>m.total>0).map(m=>(
                  <div key={m.month} style={{...S.card,marginBottom:0,cursor:"pointer"}} onClick={()=>setSelMonth(m.month)}>
                    <div style={{...S.cp,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:"#e8eaf0"}}>{m.label} {currentYear}</div>
                        <div style={{fontSize:11,color:"#4a5170",marginTop:2}}>{m.count} invoice{m.count!==1?"s":""} paid</div>
                        <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                          {builders.filter(b=>m.invoices.some(i=>i.builder===b.id)).map(b=>(
                            <span key={b.id} style={{fontSize:9,fontWeight:700,color:b.color,background:b.color+"15",padding:"2px 6px",borderRadius:100}}>{b.prefix}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:18,fontWeight:800,color:"#10b981"}}>{fmt(m.total)}</div>
                        <div style={{fontSize:10,color:"#4a5170",marginTop:2}}>avg {fmt(m.total/m.count)}</div>
                        <span style={{color:"#4a5170",fontSize:14}}>›</span>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
                {monthlyData.filter(m=>m.total===0).length>0&&(
                  <div style={{fontSize:11,color:"#2a2f45",textAlign:"center",padding:"8px 0"}}>
                    {monthlyData.filter(m=>m.total===0).map(m=>m.label).join(", ")} — no invoices paid
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── BY BUILDER TAB ── */}
        {tab==="builders" && (
          <>
            <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:12}}>RANKED BY REVENUE — {currentYear}</div>
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":isTablet?"1fr 1fr":"1fr",gap:10}}>
            {builderBreakdown.map((b,i)=>(
              <div key={b.id} style={{...S.card,marginBottom:0}}><div style={S.cp}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                  <div style={{fontSize:16,fontWeight:800,color:"#2a2f45",width:20}}>#{i+1}</div>
                  <div style={{width:38,height:38,borderRadius:10,background:b.color+"18",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:10,fontWeight:800,color:b.color}}>{b.prefix}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#e8eaf0"}}>{b.name}</div>
                    <div style={{fontSize:11,color:"#4a5170"}}>{b.company}</div>
                  </div>
                  <div style={{fontSize:17,fontWeight:800,color:"#10b981"}}>{fmt(b.total)}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  <div style={{background:"#0a0c12",borderRadius:8,padding:"8px 10px",border:"1px solid #1c2035"}}>
                    <div style={{fontSize:9,color:"#4a5170",marginBottom:2}}>INVOICES</div>
                    <div style={{fontSize:15,fontWeight:700,color:"#e8eaf0"}}>{b.count}</div>
                  </div>
                  <div style={{background:"#0a0c12",borderRadius:8,padding:"8px 10px",border:"1px solid #1c2035"}}>
                    <div style={{fontSize:9,color:"#4a5170",marginBottom:2}}>AVG</div>
                    <div style={{fontSize:15,fontWeight:700,color:"#e8eaf0"}}>{fmt(b.avg)}</div>
                  </div>
                  <div style={{background:"#0a0c12",borderRadius:8,padding:"8px 10px",border:"1px solid #1c2035"}}>
                    <div style={{fontSize:9,color:"#4a5170",marginBottom:2}}>SHARE</div>
                    <div style={{fontSize:15,fontWeight:700,color:b.color}}>{ytd>0?(b.total/ytd*100).toFixed(0):0}%</div>
                  </div>
                </div>
                {/* Revenue bar */}
                <div style={{marginTop:10,height:4,background:"#1c2035",borderRadius:2}}>
                  <div style={{height:4,background:b.color,borderRadius:2,width:`${ytd>0?(b.total/ytd*100):0}%`,transition:"width 0.3s"}}/>
                </div>
              </div></div>
            ))}
            </div>
            {builderBreakdown.length===0&&<div style={{textAlign:"center",padding:"32px 0",color:"#4a5170",fontSize:13}}>No paid invoices this year yet</div>}
          </>
        )}

        {/* ── INVOICE LOG TAB ── */}
        {tab==="log" && (
          <LogTab builders={builders} paidYear={paidYear} ytd={ytd} onResend={onResend} currentYear={currentYear} fmt={fmt} S={S}/>
        )}

      </div>
    </div>
  );
}

function LogTab({builders, paidYear, ytd, onResend, currentYear, fmt, S}) {
  const [logFilter, setLogFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");

  const filtered = paidYear.filter(i => {
    const matchB = logFilter==="all" || i.builder===logFilter;
    const matchS = !logSearch || i.invoiceNum.toLowerCase().includes(logSearch.toLowerCase()) || i.address.toLowerCase().includes(logSearch.toLowerCase());
    return matchB && matchS;
  });
  const filteredTotal = filtered.reduce((s,i)=>s+i.amount,0);

  return (
          <>
            <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:10}}>ALL PAID INVOICES — {currentYear}</div>
            <input value={logSearch} onChange={e=>setLogSearch(e.target.value)} placeholder="Search invoice # or address..." style={{...S.inp,marginBottom:10}}/>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:8}}>
              <button onClick={()=>setLogFilter("all")} style={{background:logFilter==="all"?"#f0b429":"#12151f",color:logFilter==="all"?"#0a0c12":"#9ca3bc",border:`1px solid ${logFilter==="all"?"#f0b429":"#1c2035"}`,borderRadius:100,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>All</button>
              {builders.filter(b=>paidYear.some(i=>i.builder===b.id)).map(b=>(
                <button key={b.id} onClick={()=>setLogFilter(b.id)} style={{background:logFilter===b.id?b.color+"22":"#12151f",color:logFilter===b.id?b.color:"#9ca3bc",border:`1px solid ${logFilter===b.id?b.color+"44":"#1c2035"}`,borderRadius:100,padding:"5px 14px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>{b.prefix}</button>
              ))}
            </div>
            <div style={{fontSize:12,color:"#4a5170",marginBottom:10}}>{filtered.length} invoices · <span style={{color:"#10b981",fontWeight:700}}>{fmt(filteredTotal)}</span></div>
            {[...filtered].reverse().map((inv,i)=>{
              const b=builders.find(b=>b.id===inv.builder);
              if(!b) return null;
              return (
                <div key={inv.id||i} style={S.card}><div style={S.cp}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:b.color,fontFamily:"monospace"}}>{inv.invoiceNum}</div>
                      <div style={{fontSize:12,color:"#9ca3bc",marginTop:2}}>{inv.address}</div>
                      <div style={{fontSize:11,color:"#4a5170",marginTop:1}}>Invoiced {inv.dateInvoiced} · Paid {inv.datePaid}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:15,fontWeight:800,color:"#10b981"}}>{fmt(inv.amount)}</div>
                      <div style={{...S.tag(inv.isPaid?"#10b981":"#f0b429",inv.isPaid?"#10b98118":"#f0b42918"),display:"inline-block",marginTop:4}}>{inv.isPaid?"PAID ✓":"OUTSTANDING"}</div>
                    </div>
                  </div>
                  <button onClick={()=>onResend(inv)} style={{width:"100%",padding:"7px",background:"#1c2035",border:"none",color:"#9ca3bc",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer"}}>📧 Resend Invoice</button>
                </div></div>
              );
            })}
          </>
  );
}


// ─── CONTRACTOR PAYMENTS ──────────────────────────────────────────────────────
const parsePayYear  = s => { const p=(s||"").split("/"); const y=p[2]||""; return y.length>2?parseInt(y):parseInt("20"+y)||0; };
const parsePayMonth = s => parseInt((s||"").split("/")[0])||0;

function ContractorsScreen({workers,payments,onAddWorker,onUpdateWorker,onRemoveWorker,onAddPayment,onDeletePayment}) {
  const [view,setView]=useState("main"); // main | log | editWorker | addWorker
  const [selWorker,setSelWorker]=useState(null);
  const [form,setForm]=useState({worker:"",amount:"",date:todayStr(),notes:""});
  const [editName,setEditName]=useState("");
  const [newName,setNewName]=useState("");
  const [confirmDel,setConfirmDel]=useState(null);

  const now=new Date();
  const yearTotal=payments.filter(p=>parsePayYear(p.date)===now.getFullYear()).reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const yearWorker=id=>payments.filter(p=>p.worker===id&&parsePayYear(p.date)===now.getFullYear()).reduce((s,p)=>s+parseFloat(p.amount||0),0);

  const addPayment=()=>{
    if(!form.amount||!form.worker)return;
    onAddPayment({id:Date.now(),...form});
    setForm({worker:form.worker,amount:"",date:todayStr(),notes:""});
    setView("main");
  };

  const saveEdit=()=>{
    if(!editName.trim())return;
    onUpdateWorker(selWorker.id, editName.trim());
    setView("main");
  };

  const addWorker=()=>{
    if(!newName.trim())return;
    const id="w"+Date.now();
    onAddWorker({id,name:newName.trim()});
    setNewName("");
    setView("main");
  };

  const removeWorker=id=>{
    onRemoveWorker(id);
    setConfirmDel(null);
    setView("main");
  };

  // Worker profile view
  if(view==="editWorker"&&selWorker) {
    const w = selWorker;
    const wPayments = [...payments].filter(p=>p.worker===w.id).reverse();
    const wYear = yearWorker(w.id);
    const now2 = new Date();
    const wMonth = payments.filter(p=>{
      if(p.worker!==w.id) return false;
      return parsePayMonth(p.date)===now2.getMonth()+1&&parsePayYear(p.date)===now2.getFullYear();
    }).reduce((s,p)=>s+parseFloat(p.amount||0),0);
    const wAll = payments.filter(p=>p.worker===w.id).reduce((s,p)=>s+parseFloat(p.amount||0),0);
    return (
      <div style={{paddingBottom:16}}>
        <div style={S.hdr}>
          <button style={S.btnBk} onClick={()=>setView("main")}>← Back</button>
          <div style={S.eye}>WORKER PROFILE</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={S.ttl}>{w.name}</div>
            <button onClick={()=>setView("editName")} style={{background:"#1c2035",border:"none",color:"#9ca3bc",fontSize:12,padding:"6px 12px",borderRadius:8,cursor:"pointer"}}>Rename</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:14}}>
            <div style={{background:"#10b98115",borderRadius:10,padding:"10px 10px",border:"1px solid #10b98130",textAlign:"center"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#10b981",letterSpacing:"0.1em",marginBottom:3}}>THIS MONTH</div>
              <div style={{fontSize:15,fontWeight:800,color:"#10b981"}}>{fmt(wMonth)}</div>
            </div>
            <div style={{background:"#3b82f615",borderRadius:10,padding:"10px 10px",border:"1px solid #3b82f630",textAlign:"center"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#3b82f6",letterSpacing:"0.1em",marginBottom:3}}>THIS YEAR</div>
              <div style={{fontSize:15,fontWeight:800,color:"#3b82f6"}}>{fmt(wYear)}</div>
            </div>
            <div style={{background:"#f0b42915",borderRadius:10,padding:"10px 10px",border:"1px solid #f0b42930",textAlign:"center"}}>
              <div style={{fontSize:9,fontWeight:700,color:"#f0b429",letterSpacing:"0.1em",marginBottom:3}}>ALL TIME</div>
              <div style={{fontSize:15,fontWeight:800,color:"#f0b429"}}>{fmt(wAll)}</div>
            </div>
          </div>
        </div>
        <div style={{padding:"0 16px"}}>
          <button onClick={()=>{setForm({worker:w.id,amount:"",date:todayStr(),notes:""});setView("log");}} style={{...S.btnP,marginBottom:16}}>+ Log Payment for {w.name}</button>
          <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:10}}>PAYMENT HISTORY</div>
          {wPayments.length===0&&<div style={{textAlign:"center",padding:"24px 0",color:"#4a5170",fontSize:13}}>No payments logged yet</div>}
          {wPayments.map(p=>(
            <div key={p.id} style={S.card}><div style={S.cp}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#e8eaf0"}}>{fmt(parseFloat(p.amount))}</div>
                  <div style={{fontSize:11,color:"#4a5170",marginTop:2}}>{p.date}{p.notes&&` · ${p.notes}`}</div>
                </div>
                <button onClick={()=>onDeletePayment(p.id)} style={{background:"none",border:"none",color:"#4a5170",fontSize:13,cursor:"pointer",padding:"0 4px"}}>✕</button>
              </div>
            </div></div>
          ))}
          <div style={{...S.div,margin:"16px 0"}}/>
          <button onClick={()=>setConfirmDel(w)} style={{...S.btnS,color:"#ef4444",border:"1px solid #ef444430"}}>Remove Worker</button>
        </div>
        {confirmDel&&(
          <ConfirmModal
            title={`Remove ${confirmDel.name}?`}
            message="This will also delete all payment records for this worker. This cannot be undone."
            confirmLabel="Remove"
            danger={true}
            onConfirm={()=>removeWorker(confirmDel.id)}
            onCancel={()=>setConfirmDel(null)}
          />
        )}
      </div>
    );
  }

  // Rename worker view
  if(view==="editName"&&selWorker) return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}>
        <button style={S.btnBk} onClick={()=>setView("editWorker")}>← Back</button>
        <div style={S.eye}>WORKER</div>
        <div style={S.ttl}>Rename Worker</div>
      </div>
      <div style={{padding:"0 16px"}}>
        <div style={S.card}><div style={S.cp}>
          <div style={S.lbl}>WORKER NAME</div>
          <input value={editName} onChange={e=>setEditName(e.target.value)} placeholder="Enter name" style={S.inp} autoFocus/>
        </div></div>
        <button onClick={saveEdit} style={{...S.btnP,opacity:editName.trim()?1:0.35}}>Save Name</button>
      </div>
    </div>
  );

  // Add worker view
  if(view==="addWorker") return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}>
        <button style={S.btnBk} onClick={()=>setView("main")}>← Back</button>
        <div style={S.eye}>WORKERS</div>
        <div style={S.ttl}>Add Worker</div>
      </div>
      <div style={{padding:"0 16px"}}>
        <div style={S.card}><div style={S.cp}>
          <div style={S.lbl}>WORKER NAME</div>
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Enter full name" style={S.inp} autoFocus/>
        </div></div>
        <button onClick={addWorker} style={{...S.btnP,opacity:newName.trim()?1:0.35}}>Add Worker</button>
      </div>
    </div>
  );

  // Log payment view
  if(view==="log") return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}>
        <button style={S.btnBk} onClick={()=>setView("main")}>← Back</button>
        <div style={S.eye}>CONTRACTOR PAYMENTS</div>
        <div style={S.ttl}>Log Payment</div>
      </div>
      <div style={{padding:"0 16px"}}>
        <div style={S.card}><div style={S.cp}>
          <div style={S.lbl}>WORKER</div>
          <select value={form.worker} onChange={e=>setForm(p=>({...p,worker:e.target.value}))} style={S.sel}>
            <option value="">Select worker...</option>
            {workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div></div>
        <div style={S.card}><div style={S.cp}>
          <div style={S.lbl}>AMOUNT ($)</div>
          <input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} placeholder="0.00" style={S.inp}/>
        </div></div>
        <div style={S.card}><div style={S.cp}>
          <div style={S.lbl}>DATE</div>
          <input value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={S.inp}/>
        </div></div>
        <div style={S.card}><div style={S.cp}>
          <div style={S.lbl}>NOTES (optional)</div>
          <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Week of, job site, etc." style={S.inp}/>
        </div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button onClick={()=>setView("main")} style={S.btnS}>Cancel</button>
          <button onClick={addPayment} style={{...S.btnP,opacity:(form.amount&&form.worker)?1:0.35}}>Save Payment</button>
        </div>
      </div>
    </div>
  );

  // Main view
  return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}>
        <div style={S.eye}>CONTRACTOR PAYMENTS</div>
        <div style={S.ttl}>1099 Log</div>
        <div style={{fontSize:12,color:"#4a5170",marginTop:4}}>Track weekly cash payments</div>
        <div style={{background:"#f0b42915",borderRadius:12,padding:"12px 14px",marginTop:14,border:"1px solid #f0b42930"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#f0b429",letterSpacing:"0.1em",marginBottom:4}}>THIS YEAR TOTAL</div>
          <div style={{fontSize:22,fontWeight:800,color:"#f0b429"}}>{fmt(yearTotal)}</div>
          <div style={{fontSize:11,color:"#4a5170",marginTop:2}}>{payments.length} payment{payments.length!==1?"s":""} logged</div>
        </div>
      </div>

      <div style={{padding:"0 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em"}}>WORKERS</div>
          <button onClick={()=>setView("addWorker")} style={{background:"#f0b42918",border:"1px solid #f0b42930",color:"#f0b429",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add</button>
        </div>

        {workers.map(w=>(
          <div key={w.id} style={{...S.card,cursor:"pointer"}} onClick={()=>{setSelWorker(w);setEditName(w.name);setView("editWorker");}}>
            <div style={{...S.cp,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{w.name}</div>
                <div style={{fontSize:11,color:"#4a5170",marginTop:1}}>{payments.filter(p=>p.worker===w.id).length} payments logged</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#f0b429"}}>{fmt(yearWorker(w.id))}</div>
                  <div style={{fontSize:10,color:"#4a5170"}}>this year</div>
                </div>
                <span style={{color:"#4a5170",fontSize:16}}>›</span>
              </div>
            </div>
          </div>
        ))}

        <button onClick={()=>{setForm({worker:workers[0]?.id||"",amount:"",date:todayStr(),notes:""});setView("log");}} style={{...S.btnP,marginTop:4,marginBottom:16}}>+ Log Payment</button>

        {payments.length>0&&(
          <>
            <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:10}}>RECENT PAYMENTS</div>
            {[...payments].reverse().map(p=>{
              const w=workers.find(w=>w.id===p.worker);
              return (
                <div key={p.id} style={S.card}><div style={S.cp}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"#e8eaf0"}}>{w?.name||"Unknown"}</div>
                      <div style={{fontSize:11,color:"#4a5170",marginTop:2}}>{p.date}{p.notes&&` · ${p.notes}`}</div>
                    </div>
                    <div style={{fontSize:15,fontWeight:700,color:"#f0b429"}}>{fmt(parseFloat(p.amount))}</div>
                  </div>
                </div></div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}


function BuilderForm({isEdit, selBId, builders, setBuilders, setBuilderNums, setFloorPlans, setView, S}) {
  const eb = isEdit ? builders.find(b=>b.id===selBId) : null;
  const [fd, setFd] = useState(isEdit && eb ? {...eb} : {name:"",company:"",email:"",prefix:"",startNum:"1"});
  const colorIdx = builders.length % BUILDER_COLORS.length;
  const save = () => {
    if(!fd.name||!fd.company||!fd.prefix) return;
    if(isEdit) {
      setBuilders(prev=>prev.map(b=>b.id===selBId?{...b,...fd}:b));
      setView("builderDetail");
    } else {
      const id = fd.name.toLowerCase().replace(/[^a-z0-9]/g,"_")+Date.now();
      const newB = {id,name:fd.name,company:fd.company,email:fd.email,prefix:fd.prefix.toUpperCase(),lastNum:parseInt(fd.startNum||1)-1,color:BUILDER_COLORS[colorIdx]};
      setBuilders(prev=>[...prev,newB]);
      setBuilderNums(prev=>({...prev,[id]:parseInt(fd.startNum||1)-1}));
      setFloorPlans(prev=>({...prev,[id]:[]}));
      setView("main");
    }
  };
  return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}><button style={S.btnBk} onClick={()=>setView(isEdit?"builderDetail":"main")}>← Back</button><div style={S.eye}>SETTINGS</div><div style={S.ttl}>{isEdit?"Edit Builder":"Add Builder"}</div></div>
      <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:12}}>
        <div style={S.card}><div style={S.cp}><div style={S.lbl}>BUILDER NAME</div><input value={fd.name||""} onChange={e=>setFd(p=>({...p,name:e.target.value}))} placeholder="e.g. Bryan" style={S.inp}/></div></div>
        <div style={S.card}><div style={S.cp}><div style={S.lbl}>COMPANY NAME (Bill To)</div><input value={fd.company||""} onChange={e=>setFd(p=>({...p,company:e.target.value}))} placeholder="e.g. Bryan Lagaly" style={S.inp}/></div></div>
        <div style={S.card}><div style={S.cp}><div style={S.lbl}>EMAIL</div><input value={fd.email||""} onChange={e=>setFd(p=>({...p,email:e.target.value}))} placeholder="e.g. billing@example.com" style={S.inp}/></div></div>
        <div style={S.card}><div style={S.cp}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div><div style={S.lbl}>PREFIX</div><input value={fd.prefix||""} onChange={e=>setFd(p=>({...p,prefix:e.target.value.toUpperCase()}))} placeholder="e.g. BL" style={S.inp}/></div>
            {!isEdit&&<div><div style={S.lbl}>START INVOICE #</div><input type="number" value={fd.startNum||"1"} onChange={e=>setFd(p=>({...p,startNum:e.target.value}))} placeholder="1" style={S.inp}/></div>}
          </div>
        </div></div>
        {!isEdit&&fd.prefix&&<div style={{...S.card,border:"1px solid #1c2035"}}><div style={S.cp}><div style={{fontSize:11,color:"#4a5170",marginBottom:4}}>First invoice will be:</div><div style={{fontSize:18,fontWeight:700,color:"#f0b429",fontFamily:"monospace"}}>{fd.prefix}{String(parseInt(fd.startNum||1)).padStart(3,"0")}</div></div></div>}
        <button onClick={save} style={{...S.btnP,opacity:(fd.name&&fd.company&&fd.prefix)?1:0.35}}>{isEdit?"Save Changes":"Add Builder"}</button>
      </div>
    </div>
  );
}

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────

function SettingsScreen({builders,setBuilders,floorPlans,setFloorPlans,builderNums,setBuilderNums,prices,setPrices,onDeleteBuilder}) {
  const w = useWindowWidth();
  const isTablet = w >= 768;
  const isDesktop = w >= 1024;
  const [view,setView]=useState("main");
  const [selBId,setSelBId]=useState(null);
  const [editPlan,setEditPlan]=useState(null);
  const [planName,setPlanName]=useState("");
  const [planType,setPlanType]=useState("duplex");
  const [planItems,setPlanItems]=useState([]);
  const [confirmDeleteBuilder,setConfirmDeleteBuilder]=useState(false);

  const selBuilder=builders.find(b=>b.id===selBId);

  const addPI=()=>setPlanItems([...planItems,{desc:LINE_ITEM_PRESETS[0].desc,unit:LINE_ITEM_PRESETS[0].unit,qty:"",price:LINE_ITEM_PRESETS[0].price}]);
  const updPI=(idx,f,v)=>{const u=[...planItems];if(f==="desc"){const p=LINE_ITEM_PRESETS.find(p=>p.desc===v);u[idx]={...u[idx],desc:v,unit:p?.unit||"job",price:p?.price??0};}else u[idx]={...u[idx],[f]:v};setPlanItems(u);};
  const delPI=idx=>setPlanItems(planItems.filter((_,i)=>i!==idx));

  const openAdd=()=>{setPlanName("");setPlanType("duplex");setPlanItems([{desc:LINE_ITEM_PRESETS[0].desc,unit:LINE_ITEM_PRESETS[0].unit,qty:"",price:LINE_ITEM_PRESETS[0].price}]);setEditPlan(null);setView("editPlan");};
  const openEdit=p=>{setPlanName(p.name);setPlanType(p.type);setPlanItems(p.items.map(i=>({...i,qty:String(i.qty)})));setEditPlan(p);setView("editPlan");};
  const savePlan=()=>{
    const items=planItems.filter(i=>i.desc&&i.qty).map(i=>({...i,qty:parseFloat(i.qty)}));
    if(!planName||items.length===0)return;
    setFloorPlans(prev=>{
      const curr=[...(prev[selBId]||[])];
      if(editPlan){const idx=curr.findIndex(p=>p.id===editPlan.id);if(idx>-1)curr[idx]={...editPlan,name:planName,type:planType,items};}
      else curr.push({id:Date.now().toString(),name:planName,type:planType,items});
      return{...prev,[selBId]:curr};
    });
    setView("builder");
  };
  const delPlan=pid=>setFloorPlans(prev=>({...prev,[selBId]:(prev[selBId]||[]).filter(p=>p.id!==pid)}));

  if(view==="builderDetail") {
    const b = builders.find(b=>b.id===selBId);
    if(!b) return null;
    const plans = floorPlans[selBId]||[];
    return (
      <div style={{paddingBottom:16}}>
        {confirmDeleteBuilder&&(
          <ConfirmModal
            title={`Delete ${b.name}?`}
            message={`Delete ${b.name}? Their floor plans will be removed. Existing invoices and payment history will remain for record keeping.`}
            confirmLabel="Delete Builder"
            danger={true}
            onConfirm={async()=>{await onDeleteBuilder(selBId);setConfirmDeleteBuilder(false);setView("main");}}
            onCancel={()=>setConfirmDeleteBuilder(false)}
          />
        )}
        <div style={S.hdr}>
          <button style={S.btnBk} onClick={()=>setView("main")}>← Back</button>
          <div style={S.eye}>BUILDER</div>
          <div style={S.ttl}>{b.name}</div>
          <div style={{fontSize:12,color:"#4a5170",marginTop:4}}>{b.company}</div>
        </div>
        <div style={{padding:"0 16px"}}>
          <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:10}}>BUILDER INFO</div>
          <div style={S.card}><div style={S.cp}>
            <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
              <div><div style={S.lbl}>NAME</div><div style={{fontSize:14,color:"#e8eaf0"}}>{b.name}</div></div>
              <div style={S.div}/>
              <div><div style={S.lbl}>COMPANY (BILL TO)</div><div style={{fontSize:14,color:"#e8eaf0"}}>{b.company}</div></div>
              <div style={S.div}/>
              <div><div style={S.lbl}>EMAIL</div><div style={{fontSize:13,color:"#e8eaf0"}}>{b.email||"—"}</div></div>
              <div style={S.div}/>
              <div><div style={S.lbl}>INVOICE PREFIX</div><div style={{fontSize:14,color:b.color,fontFamily:"monospace",fontWeight:700}}>{b.prefix}</div></div>
            </div>
          </div></div>
          <button onClick={()=>setView("editBuilder")} style={{...S.btnS,marginBottom:20}}>Edit Builder Info</button>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em"}}>FLOOR PLANS</div>
            <button onClick={()=>{setPlanName("");setPlanType("duplex");setPlanItems([{desc:LINE_ITEM_PRESETS[0].desc,unit:LINE_ITEM_PRESETS[0].unit,qty:"",price:LINE_ITEM_PRESETS[0].price}]);setEditPlan(null);setView("editPlan");}} style={{background:"#f0b42918",border:"1px solid #f0b42930",color:"#f0b429",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ Add Plan</button>
          </div>
          {plans.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:"#4a5170",fontSize:13}}>No floor plans yet</div>}
          {plans.map(p=>(
            <div key={p.id} style={S.card}><div style={S.cp}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{p.name}</div>
                    <span style={S.tag(p.type==="duplex"?"#3b82f6":"#10b981",p.type==="duplex"?"#3b82f615":"#10b98115")}>{p.type.toUpperCase()}</span>
                  </div>
                  {p.items.map((it,i)=><div key={i} style={{fontSize:11,color:"#4a5170",marginTop:2}}>{it.desc} — {it.qty} {it.unit} @ ${it.price}</div>)}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginLeft:10}}>
                  <button onClick={()=>{setPlanName(p.name);setPlanType(p.type);setPlanItems(p.items.map(i=>({...i,qty:String(i.qty)})));setEditPlan(p);setView("editPlan");}} style={{background:"#1c2035",border:"none",color:"#9ca3bc",fontSize:11,padding:"5px 10px",borderRadius:8,cursor:"pointer"}}>Edit</button>
                  <button onClick={()=>setFloorPlans(prev=>({...prev,[selBId]:(prev[selBId]||[]).filter(fp=>fp.id!==p.id)}))} style={{background:"#ef444418",border:"1px solid #ef444430",color:"#ef4444",fontSize:11,padding:"5px 10px",borderRadius:8,cursor:"pointer"}}>Delete</button>
                </div>
              </div>
            </div></div>
          ))}

          <div style={{marginTop:32,paddingTop:16,borderTop:"1px solid #1c2035"}}>
            <button onClick={()=>setConfirmDeleteBuilder(true)} style={{width:"100%",padding:13,background:"#ef444418",border:"1px solid #ef444430",color:"#ef4444",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer"}}>Delete Builder</button>
          </div>
        </div>
      </div>
    );
  }

    if(view==="editPlan") return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}><button style={S.btnBk} onClick={()=>setView("builderDetail")}>← Back</button><div style={S.eye}>FLOOR PLAN</div><div style={S.ttl}>{editPlan?"Edit Plan":"New Floor Plan"}</div><div style={{fontSize:12,color:"#4a5170",marginTop:4}}>For {selBuilder?.name}</div></div>
      <div style={{padding:"0 16px"}}>
        <div style={S.card}><div style={S.cp}><div style={S.lbl}>PLAN NAME</div><input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="e.g. Newton, Rosemary, Taiga" style={S.inp}/></div></div>
        <div style={S.card}><div style={S.cp}>
          <div style={S.lbl}>TYPE</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["duplex","Duplex (×2)"],["house","House (×1)"]].map(([t,label])=>(
              <div key={t} onClick={()=>setPlanType(t)} style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${planType===t?"#f0b429":"#1c2035"}`,background:planType===t?"#f0b42912":"#0a0c12",cursor:"pointer",textAlign:"center"}}>
                <div style={{fontSize:12,fontWeight:600,color:planType===t?"#f0b429":"#9ca3bc"}}>{label}</div>
              </div>
            ))}
          </div>
        </div></div>
        <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.1em",margin:"4px 0 8px"}}>LINE ITEMS (per unit)</div>
        {planItems.map((item,idx)=>(
          <div key={idx} style={S.card}><div style={S.cp}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><div style={{...S.lbl,marginBottom:0}}>ITEM {idx+1}</div>{planItems.length>1&&<button onClick={()=>delPI(idx)} style={{background:"none",border:"none",color:"#4a5170",fontSize:14,cursor:"pointer"}}>✕</button>}</div>
            <select value={item.desc} onChange={e=>updPI(idx,"desc",e.target.value)} style={{...S.sel,marginBottom:8}}>{LINE_ITEM_PRESETS.map(p=><option key={p.desc} value={p.desc}>{p.desc}</option>)}</select>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <div><div style={{...S.lbl,fontSize:9}}>QTY PER UNIT</div><input type="number" value={item.qty} onChange={e=>updPI(idx,"qty",e.target.value)} placeholder="0" style={S.inp}/></div>
              <div><div style={{...S.lbl,fontSize:9}}>PRICE ($)</div><input type="number" value={item.price} onChange={e=>updPI(idx,"price",e.target.value)} style={S.inp}/></div>
            </div>
          </div></div>
        ))}
        <button onClick={addPI} style={{width:"100%",padding:12,background:"none",color:"#f0b429",borderRadius:12,border:"1px dashed #f0b42944",fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:12}}>+ Add Item</button>
        <button onClick={savePlan} style={{...S.btnP,opacity:planName&&planItems.some(i=>i.qty)?1:0.35}}>Save Floor Plan</button>
      </div>
    </div>
  );

  if(view==="builder"&&selBuilder) return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}><button style={S.btnBk} onClick={()=>setView("main")}>← Back</button><div style={S.eye}>FLOOR PLANS</div><div style={S.ttl}>{selBuilder.name}</div></div>
      <div style={{padding:"0 16px"}}>
        {(floorPlans[selBId]||[]).length===0&&<div style={{textAlign:"center",padding:"32px 0",color:"#4a5170",fontSize:14}}>No floor plans yet</div>}
        {(floorPlans[selBId]||[]).map(p=>(
          <div key={p.id} style={S.card}><div style={S.cp}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{p.name}</div>
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <span style={S.tag(p.type==="duplex"?"#3b82f6":"#10b981",p.type==="duplex"?"#3b82f615":"#10b98115")}>{p.type.toUpperCase()}</span>
                  <span style={{fontSize:10,color:"#4a5170"}}>{p.items.length} items</span>
                </div>
                {p.items.map((it,i)=><div key={i} style={{fontSize:11,color:"#4a5170",marginTop:3}}>{it.desc} — {it.qty} {it.unit} @ ${it.price}</div>)}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                <button onClick={()=>openEdit(p)} style={{background:"#1c2035",border:"none",color:"#9ca3bc",fontSize:11,padding:"5px 10px",borderRadius:8,cursor:"pointer"}}>Edit</button>
                <button onClick={()=>delPlan(p.id)} style={{background:"#ef444418",border:"1px solid #ef444430",color:"#ef4444",fontSize:11,padding:"5px 10px",borderRadius:8,cursor:"pointer"}}>Delete</button>
              </div>
            </div>
          </div></div>
        ))}
        <button onClick={openAdd} style={{...S.btnP,marginTop:8}}>+ Add Floor Plan</button>
      </div>
    </div>
  );

  if(view==="addBuilder") return <BuilderForm isEdit={false} builders={builders} setBuilders={setBuilders} setBuilderNums={setBuilderNums} setFloorPlans={setFloorPlans} setView={setView} S={S}/>;
  if(view==="editBuilder") return <BuilderForm isEdit={true} selBId={selBId} builders={builders} setBuilders={setBuilders} setBuilderNums={setBuilderNums} setFloorPlans={setFloorPlans} setView={setView} S={S}/>;

  if(view==="prices") return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}><button style={S.btnBk} onClick={()=>setView("main")}>← Back</button><div style={S.eye}>SETTINGS</div><div style={S.ttl}>Default Prices</div><div style={{fontSize:12,color:"#4a5170",marginTop:4}}>Applies to new invoices</div></div>
      <div style={{padding:"0 16px"}}>
        {LINE_ITEM_PRESETS.map(p=>(
          <div key={p.desc} style={S.card}><div style={S.cp}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:13,fontWeight:600,color:"#e8eaf0"}}>{p.desc}</div><div style={{fontSize:11,color:"#4a5170",marginTop:1}}>{p.flat?"Flat fee":"Per "+p.unit}</div></div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#4a5170"}}>$</span>
                <input type="number" value={prices[p.desc]??p.price} onChange={e=>setPrices(prev=>({...prev,[p.desc]:parseFloat(e.target.value)||0}))} style={{...S.inp,width:80,textAlign:"right"}}/>
              </div>
            </div>
          </div></div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{paddingBottom:16}}>
      <div style={S.hdr}><div style={S.eye}>SETTINGS</div><div style={S.ttl}>Settings</div></div>
      <div style={{padding:"0 16px"}}>
        <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:12}}>PRICING</div>
        <div style={{...S.card,cursor:"pointer"}} onClick={()=>setView("prices")}><div style={{...S.cp,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>Default Prices</div><div style={{fontSize:11,color:"#4a5170",marginTop:1}}>LVP, tile, backsplash, trim rates</div></div><span style={{color:"#4a5170",fontSize:16}}>›</span></div></div>
        <div style={{fontSize:10,fontWeight:700,color:"#4a5170",letterSpacing:"0.12em",marginBottom:12,marginTop:16}}>BUILDERS</div>
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr 1fr":isTablet?"1fr 1fr":"1fr",gap:10}}>
        {builders.map(b=>{
          const cnt=(floorPlans[b.id]||[]).length;
          return (
            <div key={b.id} style={{...S.card,marginBottom:0,cursor:"pointer"}} onClick={()=>{setSelBId(b.id);setView("builderDetail");}}>
              <div style={{...S.cp,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:40,height:40,borderRadius:10,background:b.color+"18",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:10,fontWeight:800,color:b.color}}>{b.prefix}</span></div>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:"#e8eaf0"}}>{b.name}</div>
                    <div style={{fontSize:11,color:"#4a5170",marginTop:1}}>{b.company}</div>
                    <div style={{fontSize:10,color:"#4a5170",marginTop:1}}>{cnt} floor plan{cnt!==1?"s":""}</div>
                  </div>
                </div>
                <span style={{color:"#4a5170",fontSize:16}}>›</span>
              </div>
            </div>
          );
        })}
        </div>
        <button onClick={()=>setView("addBuilder")} style={{...S.btnS,marginBottom:8}}>+ Add New Builder</button>
      </div>
    </div>
  );
}

// ─── VIEW INVOICE MODAL ───────────────────────────────────────────────────────

function ViewInvoiceModal({inv,builder,onClose,onResend}) {
  const [confirm,setConfirm]=useState(false);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:998,overflowY:"auto",padding:"20px 16px 100px"}}>
      {confirm&&<ConfirmModal title={`Resend ${inv.invoiceNum}?`} message={`Send to ${builder?.email}?`} confirmLabel="Send" onConfirm={()=>{setConfirm(false);onResend(inv);}} onCancel={()=>setConfirm(false)}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <button onClick={onClose} style={{background:"#12151f",border:"1px solid #1c2035",color:"#9ca3bc",borderRadius:10,padding:"8px 16px",fontSize:13,cursor:"pointer"}}>← Close</button>
        <button onClick={()=>setConfirm(true)} style={{background:"#10b981",border:"none",color:"#fff",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>📧 Resend</button>
      </div>
      <InvoiceCard inv={inv} builder={builder}/>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const appW = useWindowWidth();
  const appIsTablet = appW >= 768;
  const appIsDesktop = appW >= 1024;
  const [unlocked,setUnlocked]=useState(false);
  const [screen,setScreen]=useState("home");

  // ── core state (populated by Firestore on mount) ──
  const [builders,setBuilders]=useState([]);
  const [invoices,setInvoices]=useState([]);
  const [paid,setPaid]=useState([]);
  const [tBld,setTBld]=useState(null);
  const [floorPlans,setFloorPlans]=useState({});
  const [builderNums,setBuilderNums]=useState({});
  const [prices,setPrices]=useState({});
  const [workers,setWorkers]=useState([]);
  const [payments,setPayments]=useState([]);
  const [dataLoaded,setDataLoaded]=useState(false);

  const syncReady = useRef(false); // true after initial load; gates write-back useEffects

  const [toast,setToast]=useState(null);
  const [duplicateFrom,setDuplicateFrom]=useState(null);
  const [viewingInvoice,setViewingInvoice]=useState(null);

  // ── Firestore bootstrap ──────────────────────────────────────────────────────
  useEffect(() => {
    let unsubInvoices, unsubPaid;

    const init = async () => {
      const buildersSnap = await getDocs(collection(db,"builders"));

      if (buildersSnap.empty) {
        // ── First-ever launch: seed the database ──
        const batch = writeBatch(db);
        INIT_BUILDERS.forEach(b => batch.set(doc(db,"builders",b.id), b));
        INIT_ACTIVE.forEach(inv => batch.set(doc(db,"invoices",String(inv.id)), serializeInvoice(inv)));
        INIT_PAID.forEach(inv => batch.set(doc(db,"paid",String(inv.id)), inv));
        INIT_BUILDERS.forEach(b => batch.set(doc(db,"floorPlans",b.id), {plans:[]}));
        batch.set(doc(db,"prices","default"), Object.fromEntries(LINE_ITEM_PRESETS.map(p=>[p.desc,p.price])));
        batch.set(doc(db,"workers","w1"), {id:"w1",name:"Worker 1"});
        batch.set(doc(db,"workers","w2"), {id:"w2",name:"Worker 2"});
        await batch.commit();

        // Set local state directly (listeners will also fire shortly after)
        setBuilders(INIT_BUILDERS);
        setBuilderNums(Object.fromEntries(INIT_BUILDERS.map(b=>[b.id,b.lastNum])));
        setFloorPlans(Object.fromEntries(INIT_BUILDERS.map(b=>[b.id,[]])));
        setPrices(Object.fromEntries(LINE_ITEM_PRESETS.map(p=>[p.desc,p.price])));
        setWorkers([{id:"w1",name:"Worker 1"},{id:"w2",name:"Worker 2"}]);
      } else {
        // ── Subsequent launch: load all data ──
        const [fpSnap, priceDoc, workersSnap, paymentsSnap] = await Promise.all([
          getDocs(collection(db,"floorPlans")),
          getDoc(doc(db,"prices","default")),
          getDocs(collection(db,"workers")),
          getDocs(collection(db,"payments")),
        ]);

        const bList = buildersSnap.docs.map(d => d.data());
        setBuilders(bList);
        setBuilderNums(Object.fromEntries(bList.map(b=>[b.id,b.lastNum])));

        const fp = {};
        fpSnap.docs.forEach(d => { fp[d.id] = d.data().plans || []; });
        setFloorPlans(fp);

        if (priceDoc.exists()) setPrices(priceDoc.data());
        if (!workersSnap.empty) setWorkers(workersSnap.docs.map(d => d.data()));
        setPayments(paymentsSnap.docs.map(d => d.data()));
      }

      // ── Real-time listeners for invoices + paid (cross-device sync) ──
      unsubInvoices = onSnapshot(collection(db,"invoices"), snap => {
        setInvoices(snap.docs.map(d => d.data()));
      });
      unsubPaid = onSnapshot(collection(db,"paid"), snap => {
        setPaid(snap.docs.map(d => d.data()));
      });

      syncReady.current = true;
      setDataLoaded(true);
    };

    init();
    return () => { unsubInvoices?.(); unsubPaid?.(); };
  }, []);

  // ── Write-back watchers for Settings-managed collections ────────────────────
  useEffect(() => {
    if (!syncReady.current || builders.length === 0) return;
    builders.forEach(b => setDoc(doc(db,"builders",b.id), b));
  }, [builders]);

  useEffect(() => {
    if (!syncReady.current) return;
    Object.entries(floorPlans).forEach(([id, plans]) => {
      setDoc(doc(db,"floorPlans",id), {plans});
    });
  }, [floorPlans]);

  useEffect(() => {
    if (!syncReady.current || Object.keys(prices).length === 0) return;
    setDoc(doc(db,"prices","default"), prices);
  }, [prices]);

  // ── Action functions (Firestore writes; listeners handle local state for real-time collections) ──

  const createInvoice = async (inv, builderId, newNum) => {
    await setDoc(doc(db,"invoices",String(inv.id)), serializeInvoice(inv));
    setBuilderNums(prev => ({...prev,[builderId]:newNum}));
    await updateDoc(doc(db,"builders",builderId), {lastNum:newNum});
  };

  const markPaid = async (inv) => {
    const paidInv = {...inv, dateInvoiced:inv.date, datePaid:todayStr()};
    const {autoDetail:_a, receipts:_r, ...safePaid} = paidInv;
    await setDoc(doc(db,"paid",String(inv.id)), safePaid);
    await deleteDoc(doc(db,"invoices",String(inv.id)));
  };

  const deleteInvoice = async (inv) => {
    const builderId = inv.builder;
    const prevNum = builderNums[builderId] ?? 0;
    const newNum = Math.max(0, prevNum - 1);
    await deleteDoc(doc(db,"invoices",String(inv.id)));
    setBuilderNums(prev => ({...prev,[builderId]:newNum}));
    await updateDoc(doc(db,"builders",builderId), {lastNum:newNum});
  };

  const deleteBuilder = async (builderId) => {
    await deleteDoc(doc(db,"builders",builderId));
    await deleteDoc(doc(db,"floorPlans",builderId));
    setBuilders(prev => prev.filter(b => b.id !== builderId));
    setFloorPlans(prev => { const next={...prev}; delete next[builderId]; return next; });
    setBuilderNums(prev => { const next={...prev}; delete next[builderId]; return next; });
  };

  const addWorkerFn = async (worker) => {
    setWorkers(prev=>[...prev,worker]);
    await setDoc(doc(db,"workers",worker.id), worker);
  };

  const updateWorkerFn = async (id, name) => {
    setWorkers(prev=>prev.map(w=>w.id===id?{...w,name}:w));
    await updateDoc(doc(db,"workers",id), {name});
  };

  const removeWorkerFn = async (id) => {
    setWorkers(prev=>prev.filter(w=>w.id!==id));
    setPayments(prev=>prev.filter(p=>p.worker!==id));
    await deleteDoc(doc(db,"workers",id));
    const toDelete = payments.filter(p=>p.worker===id);
    await Promise.all(toDelete.map(p=>deleteDoc(doc(db,"payments",String(p.id)))));
  };

  const addPaymentFn = async (payment) => {
    setPayments(prev=>[...prev,payment]);
    await setDoc(doc(db,"payments",String(payment.id)), payment);
  };

  const deletePaymentFn = async (id) => {
    setPayments(prev=>prev.filter(p=>p.id!==id));
    await deleteDoc(doc(db,"payments",String(id)));
  };

  // ── Handlers ────────────────────────────────────────────────────────────────
  const showToast=msg=>{setToast(msg);setTimeout(()=>setToast(null),3500);};
  const handleDuplicate=inv=>{setDuplicateFrom(inv);setScreen("c1");};
  const handleViewInvoice=inv=>setViewingInvoice(inv);

  const sendInvoice = async (invoicesArg, builder) => {
    const invoiceList = Array.isArray(invoicesArg) ? invoicesArg : [invoicesArg];
    const res = await fetch('/api/send-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoices: invoiceList.map(inv => ({
          invoiceNum:     inv.invoiceNum,
          date:           inv.date || inv.dateInvoiced || '',
          address:        inv.address || '',
          city:           inv.city || '',
          jobType:        inv.jobType || 'duplex',
          amount:         inv.amount,
          lineItems:      inv.lineItems || [],
          notes:          inv.notes || '',
          builderName:    builder.name,
          builderCompany: builder.company,
          builderEmail:   builder.email,
        })),
        builderEmail: builder.email,
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error || 'Send failed');
    }
  };

  const saveManualInvoice = async ({builderId, invoiceNum, address, city, date, jobType, amount, notes, status, datePaid}) => {
    const id = Date.now();
    const inv = {id, builder:builderId, invoiceNum, address:address+(city?" · "+city:""), city, jobType, amount:parseFloat(amount)||0, date, notes, lineItems:[], floorPlan:null};
    if (status === "paid") {
      await setDoc(doc(db,"paid",String(id)), {...inv, dateInvoiced:date, datePaid});
    } else {
      await setDoc(doc(db,"invoices",String(id)), inv);
    }
    const b = builders.find(b=>b.id===builderId);
    if (b) {
      const numPart = parseInt(invoiceNum.replace(b.prefix,""))||0;
      const curNum = builderNums[builderId]??0;
      if (numPart > curNum) {
        setBuilderNums(prev=>({...prev,[builderId]:numPart}));
        await updateDoc(doc(db,"builders",builderId),{lastNum:numPart});
      }
    }
  };

  const handleResend = async (inv) => {
    const b = builders.find(b => b.id === inv.builder);
    if (!b) return;
    showToast(`Sending ${inv.invoiceNum}…`);
    try {
      await sendInvoice(inv, b);
      showToast(`✓ ${inv.invoiceNum} sent to ${b.email}`);
    } catch (e) {
      showToast(`Failed to send ${inv.invoiceNum}`);
    }
  };

  const streetHistory = useMemo(()=>{
    const seen=new Map();
    [...invoices,...paid].forEach(inv=>{
      const main=(inv.address||"").split(" · ")[0].trim();
      const cty=inv.city||"";
      if(!main||!cty)return;
      const sp=main.indexOf(" ");
      const street=sp===-1?main:main.slice(sp+1);
      if(!street)return;
      const key=`${street.toLowerCase()}|${cty.toLowerCase()}`;
      if(!seen.has(key))seen.set(key,{street,city:cty});
    });
    return Array.from(seen.values());
  },[invoices,paid]);

  if(!unlocked) return <LockScreen onUnlock={()=>setUnlocked(true)}/>;

  if(!dataLoaded) return (
    <div style={{minHeight:"100vh",background:"#0a0c12",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@keyframes jcr-spin{to{transform:rotate(360deg)}}`}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{width:44,height:44,border:"3px solid #1c2035",borderTopColor:"#f0b429",borderRadius:"50%",animation:"jcr-spin 0.8s linear infinite",marginBottom:24}}/>
      <div style={{fontSize:11,fontWeight:700,color:"#f0b429",letterSpacing:"0.18em"}}>JCR FLOORING LLC</div>
      <div style={{fontSize:13,color:"#4a5170",marginTop:6}}>Syncing data...</div>
    </div>
  );

  const viewingBuilder=viewingInvoice?builders.find(b=>b.id===viewingInvoice.builder):null;

  const screens={
    home:        <HomeScreen builders={builders} invoices={invoices} paid={paid} setScreen={setScreen} setTBld={setTBld}/>,
    c1:          <CreateScreen builders={builders} setScreen={setScreen} builderNums={builderNums} floorPlans={floorPlans} prices={prices} toast={showToast} duplicateFrom={duplicateFrom} onInvoiceCreated={createInvoice} onSendInvoice={sendInvoice} streetHistory={streetHistory}/>,
    tracker:     <TrackerScreen builders={builders} invoices={invoices} setScreen={setScreen} tBld={tBld} setTBld={setTBld} onDuplicate={handleDuplicate} onViewInvoice={handleViewInvoice} onMarkPaid={markPaid} onDeleteInvoice={deleteInvoice} onSaveManualInvoice={saveManualInvoice}/>,
    history:     <HistoryScreen builders={builders} invoices={invoices} paid={paid} onResend={handleResend}/>,
    contractors: <ContractorsScreen workers={workers} payments={payments} onAddWorker={addWorkerFn} onUpdateWorker={updateWorkerFn} onRemoveWorker={removeWorkerFn} onAddPayment={addPaymentFn} onDeletePayment={deletePaymentFn}/>,
    settings:    <SettingsScreen builders={builders} setBuilders={setBuilders} floorPlans={floorPlans} setFloorPlans={setFloorPlans} builderNums={builderNums} setBuilderNums={setBuilderNums} prices={prices} setPrices={setPrices} onDeleteBuilder={deleteBuilder}/>,
  };

  const navSetScreen = s => { if(s==="c1") setDuplicateFrom(null); setScreen(s); };

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      {appIsDesktop ? (
        <div style={{display:"flex",width:"100%",maxWidth:1100,minHeight:"100vh"}}>
          <SidebarNav screen={screen} setScreen={navSetScreen}/>
          <div style={{flex:1,minWidth:0,background:"#0a0c12",paddingBottom:24}}>
            {screens[screen]||screens.home}
          </div>
        </div>
      ) : (
        <div style={{...S.wrap, maxWidth: appIsTablet ? "100%" : 430}}>
          {screens[screen]||screens.home}
          <BottomNav screen={screen} setScreen={navSetScreen}/>
        </div>
      )}
      {viewingInvoice&&<ViewInvoiceModal inv={viewingInvoice} builder={viewingBuilder} onClose={()=>setViewingInvoice(null)} onResend={inv=>{handleResend(inv);setViewingInvoice(null);}}/>}
      {toast&&<div style={{position:"fixed",bottom:appIsDesktop?24:84,left:"50%",transform:"translateX(-50%)",background:"#10b981",color:"#fff",padding:"10px 22px",borderRadius:100,fontSize:13,fontWeight:700,zIndex:1000,whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,0.5)"}}>{toast}</div>}
    </div>
  );
}
