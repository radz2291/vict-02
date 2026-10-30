/** Keep a useful centre at desktop widths; compact layouts retain their existing dock. */
export function exclusiveWorkspacePanels(width:number,chatWidth:number,drawerWidth:number):boolean {
 return width>0&&(width<=1000||width-chatWidth-drawerWidth-12<560);
}
