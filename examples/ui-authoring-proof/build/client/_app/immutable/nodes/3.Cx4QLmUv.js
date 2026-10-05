import{a as n,f as d}from"../chunks/CVa_xE6x.js";import{q as E,A as O,K as T,F as b,z as C,s as u,g as t,B as k,I as h,y as c,C as y,x as G,J as H,G as J}from"../chunks/BOVszMWl.js";import{d as K,s as f,a as L}from"../chunks/BXOlZpij.js";import{i as I}from"../chunks/CmT3yktc.js";import{i as Q,h as N,D as U}from"../chunks/CJt06QAS.js";import{s as V,a as W}from"../chunks/BYNcFcRk.js";import{c as X,I as Y,s as Z,g as $}from"../chunks/B4AbNuLJ.js";function ee(l){return{id:l.params.id,actorRole:l.url.searchParams.get("as")==="technician"?"technician":"supervisor"}}const fe=Object.freeze(Object.defineProperty({__proto__:null,load:ee},Symbol.toStringTag,{value:"Module"}));var ae=d(`<style>/* Product shell presentation (not document source) */
    .app-page {
      max-width: 1040px;
      margin: 0 auto;
      padding: 24px;
      font-family: system-ui, sans-serif;
      color: #1c2430;
    }
    .app-header h1 {
      font-size: 1.4rem;
      margin: 0 0 4px;
    }
    .app-subtitle {
      color: #5b6572;
      margin: 0 0 20px;
      font-size: 0.9rem;
    }
    .decision-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      margin: 16px 0;
    }
    .decision-button {
      font: inherit;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid #0a6c96;
      background: #0a6c96;
      color: white;
      cursor: pointer;
    }
    .decision-button:disabled {
      opacity: 0.6;
      cursor: progress;
    }
    .feedback {
      font-size: 0.9rem;
      padding: 8px 12px;
      border-radius: 8px;
    }
    .feedback-success {
      background: #e5f6ec;
      color: #116337;
    }
    .feedback-error {
      background: #fdeaea;
      color: #8f1f1f;
    }
    .feedback-pending {
      background: #eef2f7;
      color: #33445c;
    }
    .queue-status,
    .app-note {
      font-size: 0.85rem;
      color: #5b6572;
    }</style>`),te=d('<p role="status"> </p>'),re=d(`<!> <div class="decision-bar"><button type="button" class="decision-button"> </button> <span class="app-note">The document’s Approve button and this control dispatch the SAME declared action through the SAME
        adapter boundary.</span></div>`,1),oe=d('<p role="alert">Inspection not found.</p>'),ie=d('<main class="app-page"><nav class="app-subtitle" aria-label="Breadcrumb"><a>← Queue</a> · viewing as <strong> </strong> </nav> <!> <!></main>');function ve(l,o){E(o,!0);const{detailPlan:z}=Q(),v=X(new Y(Z()));let a=O(T({record:null,activity:[],feedback:{kind:"idle",message:""}}));async function x(e){const r=await v.dispatch("inspection.list",{},{role:o.data.actorRole,actorId:"server"}),p=(r.ok?r.value.rows:[]).find(s=>s.id===e)??null;u(a,{...t(a),record:p,activity:v.adapter.activityFor(e)},!0)}x(o.data.id);async function A(){if(t(a).record===null)return;u(a,{...t(a),feedback:{kind:"pending",message:"Recording decision…"}},!0);const e=await v.dispatch("inspection.approve",{id:t(a).record.id,expectedDomainRevision:t(a).record.domainRevision},{role:o.data.actorRole,actorId:o.data.actorRole==="supervisor"?"s.hart":"t.nguyen"});e.ok?(await x(o.data.id),u(a,{...t(a),feedback:{kind:"success",message:"Inspection approved — status and activity refreshed."}},!0)):u(a,{...t(a),feedback:{kind:"error",message:`${e.code}: ${e.message}`}},!0)}const D=J(()=>{var e,r;return{findings:((e=t(a).record)==null?void 0:e.findings)??[],evidence:((r=t(a).record)==null?void 0:r.evidence)??[],activity:t(a).activity.map(i=>({entry:i.entry,actor:i.actor}))}});var g=ie();N("fyx8g7",e=>{var r=ae();n(e,r)});var m=k(g),_=k(m),R=c(_,2),S=h(R,!0),P=c(R);y(m);var w=c(m,2);{var j=e=>{var r=te(),i=h(r,!0);b(()=>{W(r,1,`feedback feedback-${t(a).feedback.kind??""}`),f(i,t(a).feedback.message)}),n(e,r)};I(w,e=>{t(a).feedback.kind!=="idle"&&e(j)})}var F=c(w,2);{var M=e=>{var r=re(),i=G(r);U(i,{get plan(){return z},get view(){return t(D)},get record(){return t(a).record},dispatch:async()=>({ok:!0}),navigate:()=>{},ariaLabel:"Inspection detail"});var p=c(i,2),s=k(p),B=h(s,!0);H(2),y(p),b(()=>{s.disabled=t(a).feedback.kind==="pending",f(B,t(a).feedback.kind==="pending"?"Recording decision…":"Approve this inspection")}),L("click",s,A),n(e,r)},q=e=>{var r=oe();n(e,r)};I(F,e=>{t(a).record!==null?e(M):e(q,-1)})}y(g),b(e=>{V(_,"href",`/?as=${o.data.actorRole??""}`),f(S,o.data.actorRole),f(P,` (${e??""})`)},[()=>$(o.data.actorRole).join(", ")]),n(l,g),C()}K(["click"]);export{ve as component,fe as universal};
