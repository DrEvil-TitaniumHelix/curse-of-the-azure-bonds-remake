import { hooks } from '../hooks.js';

export function renderKeys(container) {
 const h=document.createElement('h2');h.textContent='Keys';container.append(h);
 const menu=hooks.enabled?hooks.regions().find(r=>r.id==='hmenu')?.draw:null;
 const partyMenu=hooks.regions().find(r=>r.id==='pmenu')?.draw;
 const current=menu?.prompt==='Choose a function '?partyMenu:menu;
 const prompt=document.createElement('p');prompt.textContent=menu?.prompt?.trim()||'Current game menu';container.append(prompt);
 const table=document.createElement('table');
 const row=(key,action)=>{const tr=document.createElement('tr');for(const text of [key,action]){const td=document.createElement('td');td.textContent=text;tr.append(td);}table.append(tr);};
 row('Key','Action');
 const commands=(current?.items||[]).filter(item=>item.key?.trim());
 for(const item of commands)row(item.key.toUpperCase(),item.label||item.key);
 if(menu?.enter)row('Enter','Confirm the highlighted option');
 if(menu?.enter&&!menu?.ext)row('Left / Right','Change the highlighted menu option');
 if(commands.some(item=>/^Encamp$/i.test(item.label))){row('Up','Move forward');row('Left / Right','Turn left / right');row('Down','Turn around');}
 if(!commands.length)row('Game keys','Follow the current on-screen prompt; no menu actions are reported yet.');
 row('F12 / gamepad Menu','Open or close Gold Box Plus');row('Esc (Plus open)','Close Gold Box Plus');row('Tab / Shift+Tab (Plus open)','Move between controls');row('Left / Right / Home / End (tab focused)','Choose a Plus tab');
 container.append(table);
 const note=document.createElement('p');note.textContent='Game commands above come from the current game menu. Close Plus before using them. The game keeps its original keyboard controls.';container.append(note);
}
