<script lang="ts">
  import {getAllContexts,mount,unmount,onMount,type Snippet} from 'svelte';
  import ViewportContent from './ViewportContent.svelte';
  import {APPLICATION_DOCUMENT,APPLICATION_PORTAL_TARGET} from './context.js';
  let {children,title='Application viewport',height=560,content=$bindable<HTMLElement|undefined>(undefined),onKeydown,onPointerdown,onDimensions}:{
    children:Snippet;title?:string;height?:number;content?:HTMLElement;
    onKeydown?:(event:KeyboardEvent)=>void;onPointerdown?:(event:PointerEvent)=>void;
    onDimensions?:(dimensions:{width:number;height:number;model:'isolated-viewport'})=>void;
  }=$props();
  const contexts=getAllContexts();
  let frame:HTMLIFrameElement;
  let start:()=>void=()=>{};
  onMount(()=>{
    let child:ReturnType<typeof mount>|undefined,styles:MutationObserver|undefined,resize:ResizeObserver|undefined;
    let activeDocument:Document|undefined;
    function clean(){styles?.disconnect();resize?.disconnect();if(child)void unmount(child);child=undefined;content=undefined;}
    start=()=>{
      const doc=frame.contentDocument;if(!doc||doc===activeDocument)return;
      clean();activeDocument=doc;
      // This is the same compiled Svelte renderer, mounted in an actual browser
      // viewport. No authored JavaScript, source-to-code regeneration or iframe
      // screenshot substitute is introduced.
      doc.documentElement.lang=document.documentElement.lang||'en';
      doc.head.innerHTML='<meta name="viewport" content="width=device-width,initial-scale=1,interactive-widget=resizes-content">';
      const base=doc.createElement('base');base.href=document.baseURI;doc.head.append(base);
      const styleHost=doc.createElement('div');styleHost.dataset.viewportStyles='';doc.head.append(styleHost);
      const copyStyles=()=>{
        styleHost.replaceChildren(...Array.from(document.head.querySelectorAll('style,link[rel="stylesheet"]')).map(node=>node.cloneNode(true)));
      };
      copyStyles();styles=new MutationObserver(copyStyles);styles.observe(document.head,{subtree:true,childList:true,characterData:true});
      const reset=doc.createElement('style');reset.textContent='html,body{margin:0;padding:0;width:100%;min-height:100%;}body{position:relative;isolation:isolate;overflow:auto;background:white;}[data-application-content]{min-height:100dvh;position:relative;isolation:isolate;}';doc.head.append(reset);
      const outlet=doc.createElement('div');outlet.dataset.applicationOverlayOutlet='';doc.body.append(outlet);

      const context=new Map(contexts);context.set(APPLICATION_DOCUMENT,()=>doc);context.set(APPLICATION_PORTAL_TARGET,()=>content?.querySelector<HTMLElement>('.uv-canvas')??content??outlet);
      child=mount(ViewportContent,{target:doc.body,context,props:{children,onReady:(element:HTMLElement)=>{content=element;}}});
      doc.addEventListener('keydown',event=>onKeydown?.(event));doc.addEventListener('pointerdown',event=>onPointerdown?.(event),true);
      const measure=()=>onDimensions?.({width:doc.documentElement.clientWidth,height:doc.documentElement.clientHeight,model:'isolated-viewport'});
      resize=new ResizeObserver(measure);resize.observe(frame);measure();
    };
    start();return clean;
  });
</script>
<iframe bind:this={frame} {title} src="about:blank" onload={()=>start()} style:height={`${Math.max(160,Math.min(8192,height))}px`} data-application-viewport="isolated"></iframe>
<style>iframe{display:block;width:100%;border:0;background:white;min-width:0;}</style>
