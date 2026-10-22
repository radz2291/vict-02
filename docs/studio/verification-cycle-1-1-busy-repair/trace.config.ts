// Diagnostic logging in the TEST MODULE ONLY; product source is unchanged.
import base from './vitest.config.js';
export default {...base,plugins:[...(base.plugins??[]),{
 name:'independent-test-event-trace',enforce:'pre' as const,
 transform(code:string,id:string){
  if(id.replaceAll('\\','/').endsWith('/src/lib/server/designer-agent.ts'))return{code:code
   .replace('removeSubscription?.();',"console.log('AUDIT cleanup unsubscribe start',Date.now());removeSubscription?.();console.log('AUDIT cleanup unsubscribe end',Date.now());")
   .replace('if (composition) await settleWithin(composition.productAgent.flush(), 3000);',"console.log('AUDIT cleanup flush start',Date.now());if (composition) await settleWithin(composition.productAgent.flush(), 3000);console.log('AUDIT cleanup flush end',Date.now());")
   .replace('if (dedicated) await settleWithin(dedicated.close(), 3000);',"console.log('AUDIT cleanup close start',Date.now());if (dedicated) await settleWithin(dedicated.close(), 3000);console.log('AUDIT cleanup close end',Date.now());")
   .replace('// Only our fresh mkdtemp directory inside OS temp is eligible for removal.',"console.log('AUDIT cleanup remove start',Date.now(),directory);// Only our fresh mkdtemp directory inside OS temp is eligible for removal.")
   .replace('function configurationCredential(model: string): string {',"function configurationCredential(model: string): string {"),map:null};
  if(!id.replaceAll('\\','/').endsWith('/tests/designer-agent-mastra.test.ts'))return;
  const prelude="const auditStartedAt=Date.now();let auditEvents=0;const auditTimer=setInterval(()=>console.log('AUDIT waiting',Date.now()-auditStartedAt,'events',auditEvents),15000);auditTimer.unref();\n";
  const traced=code.replaceAll('events.push(event);',"auditEvents++;console.log('AUDIT event',Date.now()-auditStartedAt,event.type,event.type==='progress'?event.message:event.type==='done'?event.status:'');events.push(event);")
   .replaceAll("if (event.toolName === 'studio_screen_edit') {","console.log('AUDIT model tool result',Date.now()-auditStartedAt,event.toolName);if (event.toolName === 'studio_screen_edit') {")
   .replaceAll('const receipt = applyAgentProposal(bridge, event.proposal, epoch, false);',"const receipt = applyAgentProposal(bridge, event.proposal, epoch, false);console.log('AUDIT local receipt',Date.now()-auditStartedAt,receipt);")
   .replaceAll('await opened.finished;',"console.log('AUDIT awaiting finished',Date.now()-auditStartedAt);await opened.finished;console.log('AUDIT finished',Date.now()-auditStartedAt);");
  return{code:prelude+traced,map:null};
 }
}]};
