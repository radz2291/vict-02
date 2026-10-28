import {describe,it,expect} from 'vitest';
import {agentOutcomeSummary,hasMatchingOutcomeCapture} from '../src/lib/designer/agent-outcome.js';
describe('receipt-only completion report',()=>{
  it('requires an available exact final source, not a retained startup context or source flag alone',()=>{
    const cursor={documentId:'screen',revision:'r1#0',digest:'abc',epoch:'epoch'};
    const regions=[{currentSource:true,cursor}];
    expect(hasMatchingOutcomeCapture(regions,cursor)).toBe(true);
    expect(hasMatchingOutcomeCapture(regions,undefined)).toBe(false);
    for(const key of ['documentId','revision','digest','epoch'] as const)expect(hasMatchingOutcomeCapture(regions,{...cursor,[key]:'changed'})).toBe(false);
    expect(hasMatchingOutcomeCapture([{...regions[0],currentSource:false}],cursor)).toBe(false);
  });
  it('does not promote a no-tool completion into task, appearance or behavior success',()=>{
    expect(agentOutcomeSummary({state:'completed',applied:0,matchingCapture:false,observationFailed:false})).toBe('No source changes were applied. No image assessment matches the final source. Behavior was not tested by this agent.');
  });
  it('distinguishes acknowledged source edits, matching image assessment and unverified semantics',()=>{
    const report=agentOutcomeSummary({state:'completed',applied:2,matchingCapture:true,observationFailed:false});
    expect(report).toContain('saving is separate');expect(report).toContain('claims remain unverified');expect(report).toContain('Behavior was not tested');
    expect(report).not.toMatch(/\bDone\b|\bSaved\b|footer|verified appearance/);
  });
  it('keeps failed observation distinct even if an earlier matching image exists',()=>{
    const report=agentOutcomeSummary({state:'failed',applied:1,matchingCapture:true,observationFailed:true});
    expect(report).toContain('did not finish successfully');expect(report).toContain('Source changes were applied');expect(report).toContain('Appearance checks did not finish');expect(report).not.toContain('was assessed');
  });
  it('preserves applied effects on cancellation without a completion claim',()=>{
    expect(agentOutcomeSummary({state:'cancelled',applied:1,matchingCapture:false,observationFailed:false})).toMatch(/^Stopped\. Source changes were applied/);
  });
});
