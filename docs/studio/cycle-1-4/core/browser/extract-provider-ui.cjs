// Reproduce measurements from saved visible CUA artifacts only.
const fs = require('node:fs');
const path = require('node:path');
const directory = __dirname;
const pair = process.argv[2] || 'form';
const read = name => fs.readFileSync(path.join(directory, name), 'utf8').replace(/^\uFEFF/, '');
const optional = name => fs.existsSync(path.join(directory, name)) ? read(name) : null;
const knowledgeSections = new Set(['families','catalog','contracts','elements','palette','component']);
function extract(arm) {
  const prefix = `provider-${pair}-${arm}`;
  const completeTraceName = `${prefix}-expanded-trace-complete.dom.txt`;
  const traceName = fs.existsSync(path.join(directory,completeTraceName)) ? completeTraceName : `${prefix}-expanded-trace.dom.txt`;
  const detailsName = `${prefix}-details-01.dom.txt`;
  const trace = optional(traceName);
  const details = optional(detailsName);
  if (!trace || !details) return {arm, status:'awaiting terminal artifacts'};
  const events = [];
  for (const line of trace.split(/\r?\n/)) {
    const match = line.match(/^\s*- generic: (.*)$/);
    if (!match) continue;
    let value = match[1];
    if (value.startsWith('"')) { try { value = JSON.parse(value); } catch { continue; } }
    const event = value.match(/^([a-z-]+) (studio_\S+) (\d+) ms since turn start(?: (.*))?$/);
    if (!event) continue;
    let payload = null;
    if (event[4]) { try { payload = JSON.parse(event[4]); } catch {} }
    events.push({kind:event[1],tool:event[2],sinceTurnStartMs:Number(event[3]),payload,
      rawPayload:payload ? undefined : event[4] || undefined});
  }
  const numberMatch = regex => details.match(regex)?.slice(1).map(Number) || null;
  const total = numberMatch(/(\d+) tool calls · (\d+) refused · (\d+) calls after refusal · ([\d.]+) s elapsed/);
  const requests = numberMatch(/(\d+) authoring model requests · (\d+) image requests\. First confirmed edit ([\d.]+) s/);
  const usage = numberMatch(/Reported authoring usage: (\d+) input \/ (\d+) output tokens/);
  const categories = numberMatch(/(\d+) knowledge reads · (\d+) source reads · (\d+) edit calls · (\d+) observation calls/);
  const active = numberMatch(/Settled tool durations summed: ([\d.]+) s; tool-active interval union: ([\d.]+) s; outside-tool time: ([\d.]+) s/);
  const terminal = details.match(/(\d+) applied edits remain undoable\. Confirmed revision ([^.]+)\. Engine termination: ([^.]+)/);
  const committed = events.filter(event => event.kind === 'committed');
  const proposals = [...new Set(committed.map(event => event.payload?.proposalId || event.rawPayload?.match(/"proposalId":"([^"]+)"/)?.[1]).filter(Boolean))];
  const reads = events.filter(event => event.kind === 'observation' && event.tool === 'studio_screen_read').map(event => ({
    sinceTurnStartMs:event.sinceTurnStartMs,
    section:event.payload?.section || event.rawPayload?.match(/"section":"([^"]+)"/)?.[1] || null,
    cursor:event.payload?.cursor || null,
  }));
  const readCounts = {};
  for (const item of reads) readCounts[item.section || 'unavailable'] = (readCounts[item.section || 'unavailable'] || 0) + 1;
  const observations = events.filter(event => event.kind === 'observation' && event.tool === 'studio_screen_observe').map(event => ({
    resultAtMs:event.sinceTurnStartMs,ok:event.payload?.ok ?? null,metadata:event.payload?.metadata || null,
    imageDigest:event.payload?.imageDigest || null,confirmedImageDigest:event.payload?.confirmedImageDigest || null,
    captureAttempts:event.payload?.captureAttempts ?? null,captureRecoveryAttempts:event.payload?.captureRecoveryAttempts ?? null,
    revalidatedAt:event.payload?.revalidatedAt || null,interactionVerified:event.payload?.interactionVerified ?? null,
    observation:event.payload?.observation || null,
  }));
  const sourceName = `${prefix}-final-source.json`;
  const sourceRaw = optional(sourceName);
  const source = sourceRaw ? JSON.parse(sourceRaw) : null;
  return {arm,status:terminal?.[3] || 'terminal unparsed',artifacts:{trace:traceName,details:detailsName,source:sourceRaw?sourceName:null},
    uiMeasurements:total ? {toolCalls:total[0],refusedCalls:total[1],callsAfterRefusal:total[2],elapsedSeconds:total[3],
      authoringModelRequests:requests?.[0]??null,imageRequests:requests?.[1]??null,firstConfirmedEditSeconds:requests?.[2]??null,
      inputTokens:usage?.[0]??null,outputTokens:usage?.[1]??null,
      confirmedEdits:terminal?Number(terminal[1]):null,confirmedRevision:terminal?.[2]||null,
      categories:categories?{knowledge:categories[0],source:categories[1],edit:categories[2],observe:categories[3]}:null,
      summedToolSeconds:active?.[0]??null,toolActiveUnionSeconds:active?.[1]??null,outsideToolSeconds:active?.[2]??null}:null,
    traceCounts:{toolStarts:events.filter(event=>event.kind==='tool-start').length,committedReceipts:committed.length,uniqueAcknowledgedProposals:proposals.length,
      readSections:readCounts,knowledgeReadResults:reads.filter(item=>knowledgeSections.has(item.section)).length,
      sourceReadResults:reads.filter(item=>item.section&&!knowledgeSections.has(item.section)).length,
      firstToolStartMs:events.find(event=>event.kind==='tool-start')?.sinceTurnStartMs??null,
      firstCommittedReceiptMs:committed[0]?.sinceTurnStartMs??null,
      firstObservationStartMs:events.find(event=>event.kind==='tool-start'&&event.tool==='studio_screen_observe')?.sinceTurnStartMs??null},
    finalSource:source?{id:source.id,revision:source.revision,nodeCount:Object.keys(source.nodes).length,stateCount:Object.keys(source.localState||{}).length,
      stateKeys:Object.keys(source.localState||{})}:null,
    observations,events};
}
const output = {schema:'vict.studio.provider-ui-terminal-extract@1',pair,
  method:'Saved visible DOM/Source artifacts only. UI measurements retain displayed rounding. Trace result categories use delivered section names; no hidden state/API.',
  limits:'A terminal engine completion is not an interaction/intent verdict. Missing baseline host interval telemetry stays null. No exact provider latency, model steps, cost or statistical throughput inference.',
  arms:['baseline','candidate'].map(extract)};
fs.writeFileSync(path.join(directory,`provider-${pair}-terminal-analysis.json`),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.arms.map(({events,observations,...arm})=>({...arm,observationRegions:observations?.map(item=>({resultAtMs:item.resultAtMs,...item.metadata}))})),null,2));
