// No mod-provided scripts are executed. Only these PNG picture targets are supported.
export const PICTURE_GROUPS = ['PIC','CPIC','SPRIT','HEAD','BODY','TITLE','ICON','COMSPR','BACPAC','SQRPACI','DUNGCOM','WILDCOM','RANDCOM','CHEAD','CBODY'];
export function safePath(value) {
 if(typeof value!=='string' || !value || value.length>240 || /[\\:\x00-\x1f]/.test(value) || value.startsWith('/') || value.split('/').some(s=>!s || s==='.' || s==='..')) throw new Error('Unsafe mod asset path');
 return value;
}
export function normalizeDax(name) {
 const stem=String(name).replaceAll('\\','/').split('/').pop().replace(/\.dax$/i,'').toUpperCase();
 const match=/^([A-Z]+)([1-8])?$/.exec(stem);
 return match?{group:match[1],dataSet:match[2]?Number(match[2]):null}:null;
}
export function parseManifest(value,{builtIn=false}={}) {
 const m=typeof value==='string'?JSON.parse(value):value;
 if(!m || m.schemaVersion!==1 || typeof m.id!=='string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(m.id)) throw new Error('Mod needs schemaVersion 1 and a valid id');
 for(const key of ['name','version','author']) if(typeof m[key]!=='string' || !m[key].trim() || m[key].length>160) throw new Error(`Mod needs ${key}`);
 if(m.profile!=='por') throw new Error('Mod profile must be por');
 if(!Array.isArray(m.overrides) || !m.overrides.length || m.overrides.length>128) throw new Error('Mod needs 1–128 PNG overrides');
 if(m.generator && (!builtIn || m.generator!=='sample-recolour-v1')) throw new Error('Mod scripts/generators are not supported');
 const targets=new Set();
 const overrides=m.overrides.map(o=>{
  const target=normalizeDax(o?.dax);
  if(!target || !PICTURE_GROUPS.includes(target.group) || !Number.isInteger(o.record) || o.record<0 || o.record>255) throw new Error('Invalid picture target');
  const dataSet=o.dataSet??target.dataSet;
  if(dataSet!==null && (!Number.isInteger(dataSet) || dataSet<1 || dataSet>8)) throw new Error('Invalid data set');
  if(target.dataSet && o.dataSet && target.dataSet!==o.dataSet) throw new Error('Conflicting data sets');
  const png=safePath(o.png);if(!/\.png$/i.test(png)) throw new Error('Override must be PNG');
  const key=`${target.group}:${dataSet??'*'}:${o.record}`;if(targets.has(key)) throw new Error('Duplicate override target');targets.add(key);
  return {dax:target.group,dataSet,record:o.record,png};
 });
 return {schemaVersion:1,id:m.id,name:m.name.trim(),version:m.version.trim(),author:m.author.trim(),profile:m.profile,description:typeof m.description==='string'?m.description.slice(0,1000):'',overrides,...(m.generator?{generator:m.generator}:{})};
}
export function matches(override,name,id) {
 const target=normalizeDax(name);
 return !!target && override.dax===target.group && override.record===id && (override.dataSet===null || override.dataSet===target.dataSet);
}
