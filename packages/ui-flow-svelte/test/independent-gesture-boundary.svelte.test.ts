import {expect,test} from 'vitest';
import {flowGestureClasses,guardFlowGestures} from '../src/flow-gesture-boundary.js';

test('independent three-level ownership ignores guards outside the nearest root without cancelling native events',()=>{
 const outer=document.createElement('section'),middle=document.createElement('section'),inner=document.createElement('section'),wrapper=document.createElement('div'),target=document.createElement('div');
 wrapper.className='nopan nowheel';outer.append(wrapper);wrapper.append(middle);middle.append(inner);inner.append(target);document.body.append(outer);
 const roots=[outer,middle,inner],classes=roots.map((_,i)=>flowGestureClasses('independent-'+i)),actions=roots.map((root,i)=>guardFlowGestures(root,classes[i]));
 try{
  for(const type of ['mousedown','touchstart','wheel','dblclick']){
   const event=new Event(type,{bubbles:true,cancelable:true});expect(target.dispatchEvent(event)).toBe(true);expect(event.defaultPrevented).toBe(false);
   expect(outer.classList.contains(classes[0].noPanClass)).toBe(true);expect(middle.classList.contains(classes[1].noPanClass)).toBe(true);expect(inner.classList.contains(classes[2].noPanClass)).toBe(false);
   expect(outer.classList.contains(classes[0].noWheelClass)).toBe(true);expect(middle.classList.contains(classes[1].noWheelClass)).toBe(true);expect(inner.classList.contains(classes[2].noWheelClass)).toBe(false);
  }
 }finally{actions.reverse().forEach(action=>action.destroy());outer.remove();}
});

test('independent local pan and wheel policies remain separate and recover on the next clear gesture',()=>{
 const root=document.createElement('section'),control=document.createElement('input'),pane=document.createElement('div');root.append(control,pane);document.body.append(root);
 const classes=flowGestureClasses('independent-controls'),action=guardFlowGestures(root,classes);
 try{
  control.className='nopan';control.dispatchEvent(new Event('mousedown',{bubbles:true}));expect(root.classList.contains(classes.noPanClass)).toBe(true);expect(root.classList.contains(classes.noWheelClass)).toBe(false);
  control.className='nowheel';control.dispatchEvent(new Event('wheel',{bubbles:true}));expect(root.classList.contains(classes.noPanClass)).toBe(false);expect(root.classList.contains(classes.noWheelClass)).toBe(true);
  pane.dispatchEvent(new Event('wheel',{bubbles:true}));expect(root.classList.contains(classes.noPanClass)).toBe(false);expect(root.classList.contains(classes.noWheelClass)).toBe(false);
 }finally{action.destroy();root.remove();}
});

test('independent destroy removes all listener effects and per-root metadata without touching authored guards',()=>{
 const root=document.createElement('section'),child=document.createElement('div');root.className='authored-root';child.className='nopan nowheel';root.append(child);document.body.append(root);
 const classes=flowGestureClasses('independent-destroy'),action=guardFlowGestures(root,classes);
 child.dispatchEvent(new Event('wheel',{bubbles:true}));expect(root.classList.contains(classes.noWheelClass)).toBe(true);
 action.destroy();expect(root.hasAttribute('data-vict-flow-gesture-boundary')).toBe(false);expect(root.className).toBe('authored-root');expect(child.className).toBe('nopan nowheel');
 for(const type of ['mousedown','touchstart','wheel','dblclick'])child.dispatchEvent(new Event(type,{bubbles:true}));
 expect(root.className).toBe('authored-root');expect(root.hasAttribute('data-vict-flow-gesture-boundary')).toBe(false);root.remove();
 expect(new Set(['a-b','ab','a','💡','1','?'].map(id=>flowGestureClasses(id).noPanClass)).size).toBe(6);
});
