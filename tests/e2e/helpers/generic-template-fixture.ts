/** 夹具刻意把行数据放在闭包，并逐行绑定事件；复制 DOM 无法通过继续计算的断言。 */
export const genericTemplateFixture = `<!doctype html><html><body>
<input id="customer"><textarea id="note"></textarea><div id="editable" contenteditable="true"></div>
<input id="include" type="checkbox"><select id="choices" multiple><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>
<select id="percent"><option value="0">0%</option><option value="custom">自定义</option></select>
<button id="add">新增行</button><div id="rows"></div><output id="sum"></output>
<input id="photo" type="file" accept="image/*"><img id="picture" style="display:none">
<script>(function(){
 let rows=[], percent=0;
 function calc(){document.getElementById('sum').textContent=String(rows.reduce((sum,r)=>sum+r.value,0)*(1+percent/100));}
 document.getElementById('percent').onchange=function(){percent=this.value==='custom'?Number(prompt('输入比例','5')):Number(this.value);calc();};
 function add(){let model={value:0},div=document.createElement('div');div.innerHTML='<input class="amount" type="number"><button class="remove">删除行</button>';
 rows.push(model);document.getElementById('rows').appendChild(div);
 div.querySelector('input').addEventListener('input',function(){model.value=Number(this.value);calc();});
 div.querySelector('button').addEventListener('click',function(){if(confirm('删除这行？')){rows=rows.filter(r=>r!==model);div.remove();calc();}});calc();}
 document.getElementById('add').onclick=add;add();
 document.getElementById('photo').onchange=function(){let img=document.getElementById('picture');img.src=URL.createObjectURL(this.files[0]);img.style.display='block';this.value='';};
})();</script></body></html>`;
